---
title: "@solana/kit Quick Start"
description: Quick-start guide for @solana/kit using plugin clients for simple setup, transaction sending, account fetching, and common Solana patterns.
---

# @solana/kit Reference

`@solana/kit` is the JavaScript SDK for building Solana applications. Modular, tree-shakable, full TypeScript support.

## Installation

```bash
npm install @solana/kit @solana/kit-client-rpc
# or: pnpm add @solana/kit @solana/kit-client-rpc
```

Minimum version: `@solana/kit@^6.0.0` (recommended to fetch the latest version before installing)

## Quick Start

### Local Development

```ts
import { createLocalClient } from '@solana/kit-client-rpc';

const client = await createLocalClient();

// Payer is auto-generated and funded
console.log('Payer:', client.payer.address);
await client.sendTransaction([myInstruction]);
```

### Production (Mainnet/Devnet)

```ts
import { generateKeyPairSigner } from '@solana/kit';
import { createClient } from '@solana/kit-client-rpc';

const payer = await generateKeyPairSigner();
const client = createClient({
  url: 'https://api.devnet.solana.com',
  payer,
});

await client.sendTransaction([myInstruction]);
```

### Testing with LiteSVM

```ts
import { createClient } from '@solana/kit-client-litesvm';

const client = await createClient();
client.svm.addProgramFromFile(myProgramAddress, 'program.so');
await client.sendTransaction([myInstruction]);
```

## Client API

All clients from `@solana/kit-client-rpc` expose:

| Property/Method | Description |
|-----------------|-------------|
| `client.rpc` | RPC methods (`getBalance`, `getAccountInfo`, etc.) |
| `client.rpcSubscriptions` | WebSocket subscriptions |
| `client.payer` | Transaction fee payer signer |
| `client.sendTransaction(instructions)` | Plan + sign + send in one call |
| `client.planTransaction(instructions)` | Plan without executing |

`createLocalClient` also provides `client.airdrop(address, amount)`.

**Config options for `createClient`:**

| Option | Description |
|--------|-------------|
| `url` | Solana RPC endpoint (required) |
| `payer` | `TransactionSigner` fee payer (required) |
| `priorityFees` | `MicroLamports` per compute unit |
| `maxConcurrency` | Concurrent transaction limit (default: 10) |
| `skipPreflight` | Bypass simulation checks (default: false) |

See [plugins.md](plugins.md) for custom client composition and available plugins.

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
import { address, lamports } from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';
import { createLocalClient } from '@solana/kit-client-rpc';

const client = await createLocalClient();

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
import { generateKeyPairSigner } from '@solana/kit';
import { createLocalClient } from '@solana/kit-client-rpc';
import { tokenProgram } from '@solana-program/token';

const client = await createLocalClient().use(tokenProgram());
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

Programs that generate a plugin with Solana Kit follow the same pattern:

```ts
import { createClient } from '@solana/kit-client-rpc';
import { myProgram } from '@my-programs/operations';

const client = await createClient().use(tokenProgram());

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
| `@solana/kit` | Main SDK, re-exports all sub-packages |
| `@solana/kit-client-rpc` | Pre-configured RPC clients (`createClient`, `createLocalClient`) |
| `@solana/kit-client-litesvm` | Pre-configured LiteSVM client for testing |
| `@solana/kit-plugin-rpc` | RPC plugin for custom clients |
| `@solana/kit-plugin-payer` | Payer management plugin |
| `@solana/kit-plugin-airdrop` | Airdrop capability plugin |
| `@solana/kit-plugin-instruction-plan` | Transaction planning + execution plugin |
| `@solana/kit-plugin-litesvm` | LiteSVM plugin |
| `@solana/addresses` | Address validation |
| `@solana/accounts` | Account fetching/decoding |
| `@solana/codecs` | Data encoding/decoding |
| `@solana/rpc` | JSON RPC client |
| `@solana/rpc-subscriptions` | WebSocket subscriptions |
| `@solana/transactions` | Compile/sign/serialize |
| `@solana/transaction-messages` | Build tx messages |
| `@solana/signers` | Signing abstraction |
| `@solana/keychain` | Common Signing Interface for external signers |
| `@solana/instruction-plans` | Multi-instruction batching |
| `@solana/errors` | Error identification/decoding |
| `@solana/functional` | Pipe and compose utilities |
| `@solana/react` | React wallet hooks |

## Best Practices

1. **Use plugin clients** — `createClient` / `createLocalClient` for most use cases
2. **Use branded types** — `address()`, `lamports()`, `signature()`
3. **Use `@solana-program/*`** instruction builders over hand-rolled instruction data
4. **Handle account existence** — `assertAccountExists()` before decode
5. **Set compute budget** — use `priorityFees` config option or manual CU estimation for production

## Reference Files

- [plugins.md](plugins.md) — Plugin clients, custom composition, available plugins
- [accounts.md](accounts.md) — Fetching, decoding, batch, PDAs, subscriptions
- [codecs.md](codecs.md) — Complete codec patterns
- [react.md](react.md) — React hooks and wallet integration
- [codama.md](codama.md) — Codama patterns, naming conventions, program clients
- [gotchas.md](gotchas.md) — Common type errors & fixes
- [advanced.md](advanced.md) — Manual transaction building, direct RPC, building plugins, custom clients
- [programs/](programs/) — Program client references (system, token, token-2022, compute-budget)
