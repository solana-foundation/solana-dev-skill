---
title: Testing Strategy
description: A testing pyramid for Solana programs using LiteSVM and Mollusk for fast unit tests and Surfpool (CLI or embedded SDK) as the integration-testing centerpiece, with mainnet forking, cheatcodes, and CI patterns.
---

# Testing Strategy (LiteSVM / Mollusk / Surfpool)

## Testing Pyramid

1. **Unit tests (fast, in-process)**: LiteSVM or Mollusk
2. **Integration tests (realistic state, full RPC)**: Surfpool — CLI-spawned or embedded via the `@solana/surfpool` SDK
3. **Cluster smoke tests**: devnet/testnet/mainnet as needed

Surfpool is the centerpiece for integration testing: sub-second startup, lazy mainnet forking, 26 `surfnet_*` cheatcodes, transaction profiling, and an embeddable SDK so tests need no external daemon.

## Unit Tests: LiteSVM

A lightweight Solana Virtual Machine that runs directly in your test process. Surfpool itself is built on LiteSVM, so unit tests and integration tests share the same SVM semantics.

### When to Use LiteSVM

- Fast execution without validator overhead
- Direct account state manipulation
- Built-in CU reporting
- Multi-language support (Rust, TypeScript, Python)

### Rust Setup

```bash
cargo add --dev litesvm   # 0.14.x, Agave 4.1-based
```

```rust
use litesvm::LiteSVM;
use solana_sdk::{pubkey::Pubkey, signature::Keypair, transaction::Transaction};

#[test]
fn test_deposit() {
    let mut svm = LiteSVM::new();

    // Load your program
    let program_id = pubkey!("YourProgramId11111111111111111111111111111");
    svm.add_program_from_file(program_id, "target/deploy/program.so");

    // Create accounts
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();

    // Build and send transaction
    let tx = Transaction::new_signed_with_payer(
        &[/* instructions */],
        Some(&payer.pubkey()),
        &[&payer],
        svm.latest_blockhash(),
    );

    let result = svm.send_transaction(tx);
    assert!(result.is_ok());
}
```

For CPI call-tree assertions, see the companion `litesvm-cpi-tree` crate (added in litesvm 0.14).

### TypeScript Setup (Kit litesvm plugin)

Use `@solana/kit` (7.x) with the LiteSVM plugin — the same client API as production code, backed by an in-process SVM instead of an RPC:

```bash
npm i --save-dev litesvm @solana/kit-plugin-litesvm @solana/kit-plugin-signer
npm i @solana/kit @solana-program/system
```

```typescript
import { createClient, lamports } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { airdropSigner, generatedSigner } from '@solana/kit-plugin-signer';
import { getTransferSolInstruction } from '@solana-program/system';

const client = await createClient()
    .use(generatedSigner())      // async — await the final client
    .use(litesvm())
    .use(airdropSigner(lamports(1_000_000_000n)));

// Direct access to the underlying LiteSVM instance
client.svm.addProgramFromFile(programId, 'target/deploy/program.so');

const ix = getTransferSolInstruction({
    source: client.payer,
    destination: recipient,
    amount: lamports(1_000n),
});
await client.sendTransaction([ix]);
```

Do not use `@solana/web3.js` v1-style imports (`Connection`, `PublicKey`) in new test code — Kit is the standard client.

### Advanced LiteSVM Features (Rust)

```rust
// Modify clock sysvar
svm.set_sysvar(&Clock { slot: 1000, .. });

// Warp to slot
svm.warp_to_slot(5000);

// Configure compute budget
svm.set_compute_budget(ComputeBudget { max_units: 400_000, .. });

// Toggle signature verification (useful for testing)
svm.with_sigverify(false);

// Check compute units used
let result = svm.send_transaction(tx)?;
println!("CUs used: {}", result.compute_units_consumed);
```

## Unit Tests: Mollusk

A lightweight test harness (`mollusk-svm` 0.14.x) providing a direct interface to program execution without full validator runtime. Best for Rust-only testing with fine-grained control.

### When to Use Mollusk

- Fast execution for rapid development cycles
- Precise account state manipulation for edge cases
- Detailed performance metrics and CU benchmarking
- Custom syscall testing

### Setup

```bash
cargo add --dev mollusk-svm
cargo add --dev mollusk-svm-programs-token  # For SPL token helpers
cargo add --dev solana-sdk solana-program
```

### Basic Usage

```rust
use mollusk_svm::Mollusk;
use mollusk_svm::result::Check;
use solana_sdk::{account::Account, pubkey::Pubkey, instruction::Instruction};

#[test]
fn test_instruction() {
    let program_id = Pubkey::new_unique();
    let mollusk = Mollusk::new(&program_id, "target/deploy/program");

    let payer = (
        Pubkey::new_unique(),
        Account {
            lamports: 1_000_000_000,
            data: vec![],
            owner: solana_sdk::system_program::ID,
            executable: false,
            rent_epoch: 0,
        },
    );

    let instruction = Instruction {
        program_id,
        accounts: vec![/* account metas */],
        data: vec![/* instruction data */],
    };

    mollusk.process_and_validate_instruction(
        &instruction,
        &[payer],
        &[
            Check::success(),
            Check::compute_units(50_000),
        ],
    );
}
```

### Token Helpers and CU Benchmarking

```rust
use mollusk_svm_programs_token::token;
token::add_program(&mut mollusk);
let mint_account = token::mint_account(decimals, supply, mint_authority);
let token_account = token::token_account(mint, owner, amount);
```

```rust
use mollusk_svm::MolluskComputeUnitBencher;

let bencher = MolluskComputeUnitBencher::new(mollusk)
    .must_pass(true)
    .out_dir("../target/benches");
bencher.bench("deposit_instruction", &instruction, &accounts);
// Generates markdown report with CU usage and deltas
```

## Integration Tests: Surfpool

Surfpool (repo: [solana-foundation/surfpool](https://github.com/solana-foundation/surfpool), docs: [docs.surfpool.run](https://docs.surfpool.run)) provides a local surfnet — a drop-in replacement for `solana-test-validator` with lazy mainnet forking and 26 cheatcode RPC methods.

### When to Use Surfpool

- Complex CPIs requiring mainnet programs (e.g., Jupiter with 40+ accounts)
- Testing against realistic, lazily-cloned mainnet account state
- Time travel, clock control, and oracle/protocol scenario overrides
- CU profiling of full transactions via `surfnet_profileTransaction`
- Any test that needs a real JSON-RPC + WebSocket endpoint

### Install

```bash
# Primary install method
curl -sL https://run.surfpool.run/ | bash

# Keep up to date (v1.3.0+, SHA256-verified)
surfpool update
```

> **Warning:** Never run `cargo install surfpool` — the crates.io name is squatted by an unrelated crate. To build from source, clone the repo and run `cargo surfpool-install`. The `txtx/taps` Homebrew tap is stale (pinned to v1.0.0); don't use it.

### Two Ways to Run

1. **CLI-spawned**: `NO_DNA=1 surfpool start` (or `--ci --daemon` in CI). Tests connect to `http://127.0.0.1:8899`.
2. **Embedded SDK** (v1.2.0+): run a full surfnet in-process from the test file itself — no daemon, no port conflicts (dynamic ports). npm: `@solana/surfpool`; Rust: `surfpool-sdk = "1.5.0"`.

Prefer the embedded SDK for test suites: each suite owns its surfnet lifecycle and CI needs no service orchestration.

### Full Example: Kit + Embedded Surfpool (vitest)

```bash
npm i --save-dev @solana/surfpool vitest
npm i @solana/kit @solana/kit-plugin-rpc @solana/kit-plugin-signer @solana-program/system
```

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Surfnet } from '@solana/surfpool';
import {
    address,
    appendTransactionMessageInstruction,
    createClient,
    createTransactionMessage,
    getBase64EncodedWireTransaction,
    lamports,
    pipe,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
} from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { generatedSigner } from '@solana/kit-plugin-signer';
import { getTransferSolInstruction } from '@solana-program/system';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Minimal cheatcode helper — plain JSON-RPC over fetch
async function cheatcode(rpcUrl: string, method: string, params: unknown[]) {
    const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const { result, error } = await res.json();
    if (error) throw new Error(`${method}: ${error.message}`);
    return result;
}

const makeClient = (rpcUrl: string) =>
    createClient()
        .use(generatedSigner())              // async — await the final client
        .use(solanaRpc({ rpcUrl }));

let surfnet: Surfnet;
let client: Awaited<ReturnType<typeof makeClient>>;

beforeAll(async () => {
    surfnet = Surfnet.start();               // in-process surfnet, dynamic port
    client = await makeClient(surfnet.rpcUrl);

    // Fund the test signer via cheatcode (no faucet round-trip)
    await cheatcode(surfnet.rpcUrl, 'surfnet_setAccount', [
        client.payer.address,
        { lamports: 10_000_000_000 },
    ]);
});

afterAll(() => surfnet.stop());              // idempotent graceful shutdown

describe('deposit flow', () => {
    it('credits USDC set up via cheatcode', async () => {
        // Give the signer a 1,000 USDC ATA without minting
        await cheatcode(surfnet.rpcUrl, 'surfnet_setTokenAccount', [
            client.payer.address,
            USDC_MINT,
            { amount: 1_000_000_000 },
        ]);

        const balance = await client.rpc
            .getBalance(client.payer.address)
            .send();
        expect(balance.value).toBeGreaterThan(0n);

        // Exercise the program under test
        const ix = getTransferSolInstruction({
            source: client.payer,
            destination: address('11111111111111111111111111111111'),
            amount: lamports(1_000n),
        });
        await client.sendTransaction([ix]);
    });

    it('handles time-dependent logic via timeTravel', async () => {
        // Jump 30 days ahead; returns the resulting EpochInfo
        const epochInfo = await cheatcode(surfnet.rpcUrl, 'surfnet_timeTravel', [
            { absoluteTimestamp: Math.floor(Date.now() / 1000) + 30 * 86_400 },
        ]);
        expect(epochInfo.absoluteSlot).toBeGreaterThan(0);
        // Assert unlock/vesting/expiry behavior here
    });

    it('stays under the CU budget', async () => {
        // Build + sign the transaction under test, then encode it to
        // base64 wire format for profiling
        const ix = getTransferSolInstruction({
            source: client.payer,
            destination: address('11111111111111111111111111111111'),
            amount: lamports(1_000n),
        });
        const { value: blockhash } = await client.rpc.getLatestBlockhash().send();
        const signedTx = await signTransactionMessageWithSigners(pipe(
            createTransactionMessage({ version: 0 }),
            m => setTransactionMessageFeePayerSigner(client.payer, m),
            m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
            m => appendTransactionMessageInstruction(ix, m),
        ));
        const base64VersionedTx = getBase64EncodedWireTransaction(signedTx);

        // Simulates WITHOUT committing state; returns CU + pre/post snapshots
        const profile = await cheatcode(surfnet.rpcUrl, 'surfnet_profileTransaction', [
            base64VersionedTx, // base64-encoded VersionedTransaction
            'deposit',         // optional tag for surfnet_getProfileResultsByTag
        ]);
        expect(profile.computeUnitsConsumed).toBeLessThan(200_000);
    });
});
```

Notes:
- `Surfnet.start()` returns a pre-funded payer and cheatcode helpers on the instance as well; the raw `fetch` helper above works identically against a CLI-spawned surfnet.
- `surfnet.stop()` is idempotent — always wire it into `afterAll` so failed runs don't leak processes.
- npm package `@solana/surfpool` ships native binaries (napi-rs) for macOS x64/arm64 and Linux x64 GNU.

Rust equivalent with `surfpool-sdk`:

```rust
use surfpool_sdk::{Surfnet, BlockProductionMode};

let surfnet = Surfnet::builder()
    .block_production_mode(BlockProductionMode::Transaction)
    .start()?;
// surfnet.rpc_url(), pre-funded payer, cheatcode helpers
```

### Mainnet-Fork Testing

`surfpool start` forks mainnet by default — any account or program your test touches is lazily fetched from the remote RPC and cached locally. No `--clone` lists.

```bash
NO_DNA=1 surfpool start                       # mainnet fork (default)
NO_DNA=1 surfpool start --network devnet      # or devnet/testnet
NO_DNA=1 surfpool start --rpc-url https://my-rpc-provider.com
```

- **Live accounts**: `surfnet_streamAccount` re-fetches an account from the remote on every access (pass `{"includeOwnedAccounts": true}` to cascade); `surfnet_streamAccounts` registers several at once; `surfnet_offlineAccount` pins an account so it is never re-fetched.
- **Oracle/protocol scenarios**: `surfnet_registerScenario` schedules account overrides on a slot timeline using built-in templates (Pyth, Switchboard, Raydium, Kamino, Drift, ...). Example: set BTC/USD to $67,500 with template `pyth_btcusd` and values `{"price_message.price_value": 67500}`. Use `fetchBeforeUse` on an override to refresh from the live feed before applying deltas.
- **Snapshots**: `surfnet_exportSnapshot` (with sysvar/feature-gate filters since v1.4.0) captures forked state to JSON; reload deterministically with `surfpool start --snapshot ./snap.json`.
- **Snapshot → offline unit-test fixtures**: with `{"scope": {"preTransaction": "<signature>"}}`, `surfnet_exportSnapshot` returns the state of every account a transaction touched *as it was before execution*. Run the flow once against a fork, export the pre-state, and load those accounts into LiteSVM/Mollusk to replay the instruction as a deterministic, offline unit test — see [surfpool/cheatcodes.md](surfpool/cheatcodes.md#surfnet_exportsnapshot).

### Anchor Projects

Anchor 1.0+ uses surfpool as the default test runner: `anchor test` and `anchor localnet` spawn a surfnet automatically (current Anchor: 1.1.2, paired with Solana CLI 3.1.10). Running `surfpool start` in a project root detects both **Anchor and Pinocchio** projects and scaffolds txtx deployment runbooks (program names read from `Anchor.toml`).

For older test suites written against `solana-test-validator` semantics:

```bash
NO_DNA=1 surfpool start --legacy-anchor-compatibility --anchor-test-config-path ./Test.toml
```

## Cluster Smoke Tests

Keep a small suite that runs against devnet before releases: deploy, exercise one happy path per instruction, verify explorer-visible effects. Use Kit with `solanaRpc({ rpcUrl })` pointed at devnet and a funded keypair via `signerFromFile('~/.config/solana/id.json')`. These are slow and flaky by nature — never gate PRs on them.

## Test Layout Recommendation

```
tests/
├── unit/
│   ├── deposit.rs        # LiteSVM or Mollusk
│   ├── withdraw.rs
│   └── mod.rs
├── integration/
│   ├── full_flow.test.ts # Embedded @solana/surfpool + Kit
│   └── fork.test.ts      # Mainnet-fork scenarios
├── vitest.config.surfpool.ts
└── fixtures/
    └── accounts.rs       # Shared test account setup
```

## CI Guidance

Two options:

1. **Embedded SDK (preferred)** — no daemon to manage; `vitest` runs `Surfnet.start()` per suite on dynamic ports.
2. **CLI daemon** — `NO_DNA=1 surfpool start --ci --daemon` (`--ci` disables TUI, Studio, profiling, and logs; `--daemon` is Linux-only).

Run surfpool-backed suites serially. The solana-foundation/pay-kit pattern uses a dedicated vitest config:

```typescript
// vitest.config.surfpool.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/integration/**/*.test.ts'],
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 60_000,
        hookTimeout: 60_000,
    },
});
```

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: cargo test-sbf

  # Embedded SDK: @solana/surfpool ships its own native binaries —
  # no Surfpool CLI install step needed.
  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests (embedded SDK)
        run: npx vitest run --config vitest.config.surfpool.ts

  # Alternative: CLI-spawned daemon (only this variant needs the CLI installed)
  # integration-tests-cli:
  #   runs-on: ubuntu-latest
  #   needs: unit-tests
  #   steps:
  #     - uses: actions/checkout@v4
  #     - name: Install Surfpool
  #       run: curl -sL https://run.surfpool.run/ | bash
  #     - run: NO_DNA=1 surfpool start --ci --daemon
  #     - run: cargo test --test integration
```

Always prefix agent-run surfpool commands with `NO_DNA=1` (see [no-dna.org](https://no-dna.org)).

## Best Practices

- Keep unit tests (LiteSVM/Mollusk) as the default CI gate — fast feedback
- Use the embedded `@solana/surfpool` SDK for integration suites; reserve the CLI daemon for local dev with Studio
- Set up state with cheatcodes (`surfnet_setAccount`, `surfnet_setTokenAccount`) instead of long funding/minting transaction sequences
- Use `surfnet_timeTravel` + `surfnet_pauseClock` for deterministic time-dependent tests
- Track CU regressions with `surfnet_profileTransaction` tags + `surfnet_getProfileResultsByTag` (integration) and Mollusk benches (unit)
- Export snapshots of interesting forked states and commit them for reproducible `--snapshot` runs
- Use deterministic PDAs and seeded keypairs for reproducibility
- Run integration tests in a separate, serial CI stage to control runtime
