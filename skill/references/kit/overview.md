---
title: "@solana/kit Quick Start"
description: Quick-start guide for @solana/kit using createClient + .use() plugin composition for RPC, signers, transaction sending, account fetching, and common Solana patterns.
---

# @solana/kit Reference

`@solana/kit` is the JavaScript SDK for building Solana applications. Modular, tree-shakable, full TypeScript support. Clients are built by composing plugins onto `createClient()` via `.use()`.

## Installation

```bash
npm install @solana/kit @solana/kit-plugin-rpc @solana/kit-plugin-signer
# or: pnpm add @solana/kit @solana/kit-plugin-rpc @solana/kit-plugin-signer
```

For LiteSVM testing add `@solana/kit-plugin-litesvm`. For Codama-generated program clients add the relevant `@solana-program/*` package(s).

Minimum version: Solana Kit v6.8.0.

## Quick Start

### Local Development

```ts
import { createClient } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';

// `signerFromFile` sets BOTH payer and identity to the loaded keypair (the common case).
// Other options:
//   - `signer(existingSigner)`              // explicit signer you already hold
//   - `generatedSignerWithSol(lamports(n))` // generate + airdrop a fresh keypair (must come AFTER solanaLocalRpc, or use rpcAirdrop first)
//   - `payer(...)` + `identity(...)`        // when fees and authority come from different keypairs
const client = await createClient()
  .use(signerFromFile('~/.config/solana/id.json'))
  .use(solanaLocalRpc());

console.log('Payer:', client.payer.address);
await client.sendTransaction([myInstruction]);
```

### Production (Mainnet/Devnet)

```ts
import { createClient } from '@solana/kit';
import { solanaDevnetRpc, solanaMainnetRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';

const client = createClient()
  .use(signer(mySigner)) // sets payer + identity; use payer(...) + identity(...) if they differ
  .use(solanaDevnetRpc()); // or solanaMainnetRpc({ rpcUrl: 'https://...' })

await client.sendTransaction([myInstruction]);
```

`solanaDevnetRpc()` defaults to `https://api.devnet.solana.com` and bundles airdrop. `solanaMainnetRpc({ rpcUrl })` is type-narrowed to a mainnet URL — no devnet-only methods like `airdrop`.

### Testing with LiteSVM

```ts
import { createClient } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { signer } from '@solana/kit-plugin-signer';

const client = createClient().use(signer(mySigner)).use(litesvm());

client.svm.addProgramFromFile(myProgramAddress, 'program.so');
await client.sendTransaction([myInstruction]);
```

Full documentation: [LiteSVM](https://www.litesvm.com/docs/typescript/getting-started).

## Client API

After applying `solanaRpc` / `solanaLocalRpc` / `solanaDevnetRpc` / `solanaMainnetRpc` (or `litesvm`), the client exposes:

| Property/Method | Description |
|-----------------|-------------|
| `client.rpc` | RPC methods (`getBalance`, `getAccountInfo`, etc.) |
| `client.rpcSubscriptions` | WebSocket subscriptions (RPC plugins only) |
| `client.payer` | Transaction fee payer signer (set by `signer()` or `payer()`) |
| `client.identity` | Authority signer (set by `signer()` or `identity()`) |
| `client.sendTransaction(instructions)` | Plan + sign + send in one call |
| `client.sendTransactions(plan)` | Execute a planned multi-tx plan |
| `client.planTransaction(s)` | Plan without executing |
| `client.getMinimumBalance(dataSize)` | Rent-exempt minimum lamports |
| `client.airdrop(address, lamports)` | Faucet (devnet/local/litesvm only) |
| `client.svm` | LiteSVM instance (litesvm plugin only) |

`solanaRpc({ ... })` accepts `rpcUrl` (required) plus `rpcSubscriptionsUrl`, `transactionConfig` (priority fees), `maxConcurrency`, `skipPreflight`, and the underlying `rpcConfig` / `rpcSubscriptionsConfig`. See [plugins.md](plugins.md) for the full options table, plugin catalog, and custom composition.

## Core Concepts

### Branded Types

```ts
import { address, lamports, signature } from '@solana/kit';

const myAddress = address('So11111111111111111111111111111111111111112');
const myLamports = lamports(1_000_000_000n);
const mySig = signature('5eykt...');
```

### Signers

```ts
import { generateKeyPairSigner } from '@solana/kit';
const signer = await generateKeyPairSigner();
// signer.address — the public key
// signer is a TransactionSigner
```

### Codec Direction

- **`encode()`**: values → `Uint8Array`
- **`decode()`**: `Uint8Array` → values

Always use native codecs (e.g., `getBase58Codec()`). Never import bs58.

See [codecs.md](codecs.md) for full codec patterns.

## Common Patterns

### Send SOL Transfer

```ts
import { createClient, address, lamports } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { getTransferSolInstruction } from '@solana-program/system';

const client = await createClient()
  .use(signerFromFile('~/.config/solana/id.json'))
  .use(solanaLocalRpc());

const ix = getTransferSolInstruction({
  source: client.payer,
  destination: address('recipient...'),
  amount: lamports(1_000_000_000n),
});

await client.sendTransaction([ix]);
```

### Fetch Account

```ts
import { fetchEncodedAccount, assertAccountExists, decodeAccount } from '@solana/kit';

const account = await fetchEncodedAccount(client.rpc, myAddress);
assertAccountExists(account);
const decoded = decodeAccount(account, myDecoder);
```

See [accounts.md](accounts.md) for batch fetching, PDAs, subscriptions, and token queries.

### Token Operations

Use the `tokenProgram()` plugin from `@solana-program/token` for a fluent token API. It auto-derives ATAs, auto-creates them if needed, and defaults the payer from the client.

```ts
import { createClient, generateKeyPairSigner } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { tokenProgram } from '@solana-program/token';

const client = await createClient()
  .use(signerFromFile('~/.config/solana/id.json'))
  .use(solanaLocalRpc())
  .use(tokenProgram());

const mintAuthority = await generateKeyPairSigner();
const mint = await generateKeyPairSigner();

// Create a new mint
await client.token.instructions
  .createMint({ newMint: mint, decimals: 2, mintAuthority: mintAuthority.address })
  .sendTransaction();

// Mint tokens to an owner's ATA (created automatically if needed)
await client.token.instructions
  .mintToATA({
    mint: mint.address,
    owner: recipientAddress,
    mintAuthority,
    amount: 1_000_000n,
    decimals: 2,
  })
  .sendTransaction();

// Transfer tokens to a recipient's ATA (auto-derives source + destination)
await client.token.instructions
  .transferToATA({
    mint: mint.address,
    authority: ownerSigner,
    recipient: recipientAddress,
    amount: 500n,
    decimals: 2,
  })
  .sendTransaction();
```

See [programs/token.md](programs/token.md) for low-level instruction patterns and [programs/token-2022.md](programs/token-2022.md) for Token Extensions.

### Custom Program Operations

Programs that ship a Kit plugin follow the same `.use()` pattern:

```ts
import { createClient } from '@solana/kit';
import { solanaDevnetRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';
import { myProgram } from '@my-programs/operations';

const client = createClient()
  .use(signer(mySigner))
  .use(solanaDevnetRpc())
  .use(myProgram());

await client.myProgram.instructions
  .handyInstruction({ /* args */ })
  .sendTransaction();
```

### RPC Queries

```ts
// Balance
const { value: balance } = await client.rpc.getBalance(myAddress).send();

// Token accounts
const { value: tokenAccs } = await client.rpc.getTokenAccountsByOwner(
  owner,
  { mint: mintAddr },
  { encoding: 'jsonParsed' },
).send();

// Latest blockhash
const { value: blockhash } = await client.rpc.getLatestBlockhash().send();
```

## Codama Program Clients

`@solana-program/*` packages are Codama-generated, Kit-compatible instruction builders:

| Package | Purpose |
|---------|---------|
| `@solana-program/system` | Account creation, transfers, nonces |
| `@solana-program/token` | SPL Token operations |
| `@solana-program/token-2022` | Token Extensions (transfer fees, metadata, etc.) |
| `@solana-program/compute-budget` | CU limits & priority fees |
| `@solana-program/memo` | Memo program |
| `@solana-program/stake` | Staking operations |

**Note:** These packages export both low-level `get{Name}Instruction()` helpers and higher-level program plugins (e.g., `tokenProgram()`) that attach fluent APIs to the client. ATA functions are in `@solana-program/token` and `@solana-program/token-2022`, not a separate package.

See [codama.md](codama.md) for naming conventions and patterns.

## Package Overview

| Package | Purpose |
|---------|---------|
| `@solana/kit` | Main SDK, re-exports all sub-packages, exports `createClient` |
| `@solana/kit-plugin-rpc` | All-in-one RPC plugins: `solanaRpc`, `solanaMainnetRpc`, `solanaDevnetRpc`, `solanaLocalRpc` (plus low-level `rpc`, `rpcAirdrop`, `rpcTransactionPlanner`, `rpcTransactionPlanExecutor`) |
| `@solana/kit-plugin-signer` | Signer plugins. Default `signer*` variants set both `payer` and `identity` (`signer`, `generatedSigner`, `generatedSignerWithSol`, `signerFromFile`, `airdropSigner`). Role-specific `payer*` and `identity*` variants for when the two roles differ. |
| `@solana/kit-plugin-litesvm` | All-in-one `litesvm` plugin (Node.js only) for in-memory testing |
| `@solana/kit-plugin-airdrop` | Standalone airdrop plugin (most users get this via `solanaDevnetRpc`/`solanaLocalRpc`) |
| `@solana/kit-plugin-instruction-plan` | `planAndSendTransactions` and instruction batching primitives |
| `@solana/addresses` | Address validation |
| `@solana/accounts` | Account fetching/decoding |
| `@solana/codecs` | Data encoding/decoding |
| `@solana/rpc` | JSON RPC client primitives |
| `@solana/rpc-subscriptions` | WebSocket subscription primitives |
| `@solana/transactions` | Compile/sign/serialize |
| `@solana/transaction-messages` | Build tx messages |
| `@solana/signers` | Signing abstraction |
| `@solana/keychain` | Common Signing Interface for external signers |
| `@solana/instruction-plans` | Multi-instruction batching |
| `@solana/errors` | Error identification/decoding |
| `@solana/functional` | Pipe and compose utilities |
| `@solana/react` | React wallet hooks |

## Best Practices

1. **Compose with `.use()`** — `createClient().use(signer(...)).use(solanaRpc(...))`; the signer plugin must come before the RPC/litesvm plugin. Use the role-specific `payer()` + `identity()` variants only when fees and authority come from different keypairs.
2. **Use branded types** — `address()`, `lamports()`, `signature()`.
3. **Use `@solana-program/*`** instruction builders over hand-rolled instruction data.
4. **Handle account existence** — `assertAccountExists()` before decode.
5. **Set compute budget** — pass `transactionConfig` to `solanaRpc({ ... })` or use manual CU estimation for production. See [programs/compute-budget.md](programs/compute-budget.md).

## Reference Files

- [plugins.md](plugins.md) — Plugin catalog, custom composition, ordering rules
- [accounts.md](accounts.md) — Fetching, decoding, batch, PDAs, subscriptions
- [codecs.md](codecs.md) — Complete codec patterns
- [react.md](react.md) — React hooks and wallet integration
- [codama.md](codama.md) — Codama patterns, naming conventions, program clients
- [gotchas.md](gotchas.md) — Common type errors & fixes
- [advanced.md](advanced.md) — Manual transaction building, direct RPC, building plugins, custom clients
- [programs/](programs/) — Program client references (system, token, token-2022, compute-budget)
