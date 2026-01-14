# Testing Strategy (LiteSVM / Mollusk / Surfpool)

## Testing Pyramid

1. **Unit tests (fast)**: LiteSVM or Mollusk
2. **Integration tests (realistic state)**: Surfpool
3. **Cluster smoke tests**: devnet/testnet/mainnet as needed

## LiteSVM

A lightweight Solana Virtual Machine that runs directly in your test process. Created by Aursen from Exotic Markets.

### When to Use LiteSVM

- Fast execution without validator overhead
- Direct account state manipulation
- Built-in performance profiling
- Multi-language support (Rust, TypeScript, Python)

### Rust Setup

```bash
cargo add --dev litesvm
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

### TypeScript Setup

```bash
npm i --save-dev litesvm
```

```typescript
import { LiteSVM } from 'litesvm';
import { PublicKey, Transaction, Keypair } from '@solana/web3.js';

const programId = new PublicKey("YourProgramId11111111111111111111111111111");
const svm = new LiteSVM();
svm.addProgramFromFile(programId, "target/deploy/program.so");

// Build transaction
const tx = new Transaction();
tx.recentBlockhash = svm.latestBlockhash();
tx.add(/* instructions */);
tx.sign(payer);

// Simulate first (optional)
const simulation = svm.simulateTransaction(tx);

// Execute
const result = svm.sendTransaction(tx);
```

### Account Types in LiteSVM

**System Accounts:**
- Payer accounts (contain lamports)
- Uninitialized accounts (empty, awaiting setup)

**Program Accounts:**
- Serialize with `borsh`, `bincode`, or `solana_program_pack`
- Calculate rent-exempt minimum balance

**Token Accounts:**
- Use `spl_token::state::Mint` and `spl_token::state::Account`
- Serialize with Pack trait

### Advanced LiteSVM Features

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

## Mollusk

A lightweight test harness providing direct interface to program execution without full validator runtime. Best for Rust-only testing with fine-grained control.

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

    // Create accounts
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

    // Build instruction
    let instruction = Instruction {
        program_id,
        accounts: vec![/* account metas */],
        data: vec![/* instruction data */],
    };

    // Execute with validation
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

### Token Program Helpers

```rust
use mollusk_svm_programs_token::token;

// Add token program to test environment
token::add_program(&mut mollusk);

// Create pre-configured token accounts
let mint_account = token::mint_account(decimals, supply, mint_authority);
let token_account = token::token_account(mint, owner, amount);
```

### CU Benchmarking

```rust
use mollusk_svm::MolluskComputeUnitBencher;

let bencher = MolluskComputeUnitBencher::new(mollusk)
    .must_pass(true)
    .out_dir("../target/benches");

bencher.bench(
    "deposit_instruction",
    &instruction,
    &accounts,
);
// Generates markdown report with CU usage and deltas
```

### Advanced Configuration

```rust
// Set compute budget
mollusk.set_compute_budget(200_000);

// Enable all feature flags
mollusk.set_feature_set(FeatureSet::all_enabled());

// Customize sysvars
mollusk.sysvars.clock = Clock {
    slot: 1000,
    epoch: 5,
    unix_timestamp: 1700000000,
    ..Default::default()
};
```

## Surfpool

SDK and tooling suite for integration testing with realistic cluster state. Surfnet is the local network component (drop-in replacement for solana-test-validator).

### When to Use Surfpool

- Complex CPIs requiring mainnet programs (e.g., Jupiter with 40+ accounts)
- Testing against realistic account state
- Time travel and block manipulation
- Account/program cloning between environments

### Setup

```bash
# Install Surfpool CLI
cargo install surfpool

# Start local Surfnet
surfpool start
```

### Connection Setup

```typescript
import { Connection } from '@solana/web3.js';

const connection = new Connection("http://localhost:8899", "confirmed");
```

### System Variable Control

```typescript
// Time travel to specific slot
await connection._rpcRequest('surfnet_timeTravel', [{
    absoluteSlot: 250000000
}]);

// Pause/resume block production
await connection._rpcRequest('surfnet_pauseClock', []);
await connection._rpcRequest('surfnet_resumeClock', []);
```

### Account Manipulation

```typescript
// Set account state
await connection._rpcRequest('surfnet_setAccount', [{
    pubkey: accountPubkey.toString(),
    lamports: 1000000000,
    data: Buffer.from(accountData).toString('base64'),
    owner: programId.toString(),
}]);

// Set token account
await connection._rpcRequest('surfnet_setTokenAccount', [{
    pubkey: ownerPubkey.toString(),        // Owner of the token account (wallet)
    mint: mintPubkey.toString(),
    owner: ownerPubkey.toString(),
    amount: "1000000",
}]);

// Clone account from another program
await connection._rpcRequest('surfnet_cloneProgramAccount', [{
    source: sourceProgramId.toString(),
    destination: destProgramId.toString(),
    account: accountPubkey.toString(),
}]);
```

### SOL Supply Configuration

```typescript
// Configure supply for economic edge case testing
await connection._rpcRequest('surfnet_setSupply', [{
    circulating: "500000000000000000",
    nonCirculating: "100000000000000000",
    total: "600000000000000000",
}]);
```

## Test Layout Recommendation

```
tests/
├── unit/
│   ├── deposit.rs      # LiteSVM or Mollusk
│   ├── withdraw.rs
│   └── mod.rs
├── integration/
│   ├── full_flow.rs    # Surfpool
│   └── mod.rs
└── fixtures/
    └── accounts.rs     # Shared test account setup
```

## CI Guidance

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: cargo test-sbf

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - name: Start Surfpool
        run: surfpool start --background
      - name: Run integration tests
        run: cargo test --test integration
```

## Best Practices

- Keep unit tests as the default CI gate (fast feedback)
- Use deterministic PDAs and seeded keypairs for reproducibility
- Minimize fixtures; prefer programmatic account creation
- Profile CU usage during development to catch regressions
- Run integration tests in separate CI stage to control runtime
