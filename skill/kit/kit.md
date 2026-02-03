# @solana/kit Reference

`@solana/kit` is the JavaScript SDK for building Solana applications. Modular, tree-shakable, full TypeScript support.

## Installation

```bash
npm install @solana/kit
# or: pnpm add @solana/kit / bun add @solana/kit
```

Minimum version: `@solana/kit@^5.0.0` (recommended to fetch the latest version before installing)

## Core Concepts

### Imports

```ts
// Convenience (includes all packages)
import { address, createSolanaRpc, lamports } from '@solana/kit';

// Individual packages (smaller bundles)
import { address } from '@solana/addresses';
import { createSolanaRpc } from '@solana/rpc';
```

### Codec Direction

- **`encode()`**: values → `Uint8Array`
- **`decode()`**: `Uint8Array` → values

### Branded Types

```ts
import { address, lamports, signature } from '@solana/kit';
const myAddress = address('So11111111111111111111111111111111111111112');
const myLamports = lamports(1_000_000_000n);
```

## Quick Patterns

### Generate Signer

```ts
import { generateKeyPairSigner } from '@solana/kit';
const signer = await generateKeyPairSigner();
// signer.address, signer.keyPair
```

### RPC Client

```ts
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const rpc = createSolanaRpc('https://api.devnet.solana.com');
const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');
```

### Quick Start with Plugins (Recommended)

For simpler setup, use `@solana/kit-plugins` which handles transaction building internally:

```ts
import { createDefaultLocalhostRpcClient } from '@solana/kit-plugins';

const client = await createDefaultLocalhostRpcClient();
await client.sendTransaction(myInstruction);
```

See [plugins.md](plugins.md) for preset clients, custom composition, and testing with LiteSVM.

### Build & Send Transaction

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  assertIsTransactionWithBlockhashLifetime,
} from '@solana/kit';

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(myInstruction, m),
);

const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

### Compute Budget (Required for production)

```ts
import {
  getSetComputeUnitPriceInstruction,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
  estimateComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
  estimateComputeUnitLimitFactory({ rpc })
);

// Add priority fee, estimate CU, refresh blockhash, send
// See transaction.md for full pattern
```

### Fetch Account

```ts
import { fetchEncodedAccount, assertAccountExists, decodeAccount } from '@solana/kit';

const account = await fetchEncodedAccount(rpc, myAddress);
assertAccountExists(account);
const decoded = decodeAccount(account, myDecoder);
```

### Codec Example

```ts
import { getStructCodec, getU32Codec, getU64Codec, addCodecSizePrefix, getUtf8Codec } from '@solana/kit';

type MyData = { name: string; amount: bigint };
const codec = getStructCodec([
  ['name', addCodecSizePrefix(getUtf8Codec(), getU32Codec())],
  ['amount', getU64Codec()],
]);

const bytes = codec.encode({ name: 'test', amount: 100n });
const data = codec.decode(bytes);
```

## Codama-Generated Program Clients

`@solana-program/*` packages are common Codama-generated, Kit-compatible clients:

| Package | Purpose |
|---------|---------|
| `@solana-program/system` | Account creation, transfers, nonces |
| `@solana-program/token` | SPL Token operations |
| `@solana-program/token-2022` | SPL Token Operations and Token Extensions (transfer fees, metadata, etc.) |
| `@solana-program/compute-budget` | CU limits & priority fees |
| `@solana-program/memo` | Memo program |
| `@solana-program/stake` | Staking operations |

**Note:** ATA functions (`findAssociatedTokenPda`, `getCreateAssociatedTokenInstruction`) are in `@solana-program/token` and `@solana-program/token-2022`, not a separate package.

See [codama.md](codama.md) for naming conventions and patterns.

## Package Overview

| Package | Purpose |
|---------|---------|
| `@solana/kit` | Main entry, re-exports all |
| `@solana/plugin-core` | Client plugin architecture |
| `@solana/kit-plugins` | Ready-to-use plugins & preset clients |
| `@solana/addresses` | Address validation |
| `@solana/accounts` | Account fetching/decoding |
| `@solana/codecs` | Data encoding/decoding |
| `@solana/rpc` | JSON RPC client |
| `@solana/rpc-subscriptions` | WebSocket subscriptions |
| `@solana/transactions` | Compile/sign/serialize |
| `@solana/transaction-messages` | Build tx messages |
| `@solana/signers` | Signing abstraction |
| `@solana/instruction-plans` | Multi-instruction batching |
| `@solana/errors` | Error identification/decoding |
| `@solana/functional` | Pipe and compose utilities |
| `@solana/react` | React wallet hooks |

For full package list, see individual `@solana/*` packages.

## Best Practices

1. **Use `pipe()`** for transaction building
2. **Use branded types** — `address()`, `lamports()`, `signature()`
3. **Always set compute budget** — estimate CUs, set priority fee
4. **Handle account existence** — `assertAccountExists()` before decode
5. **Use factories** — `sendAndConfirmTransactionFactory()`, `airdropFactory()`

## Reference Files

For detailed patterns:
- [accounts.md](accounts.md) — Fetching, parsing, decoding accounts
- [codecs.md](codecs.md) — Complete codec patterns
- [rpc.md](rpc.md) — RPC methods and subscriptions
- [react.md](react.md) — React hooks and wallet integration
- [transaction.md](transaction.md) — Transaction building, signing, compute budget
- [durable-nonce.md](durable-nonce.md) — Durable nonce lifecycle & multi-party signing
- [plugins.md](plugins.md) — Plugin architecture & kit-plugins
- [gotchas.md](gotchas.md) — Common type errors & fixes
- [codama.md](codama.md) — Codama patterns, naming conventions, program clients
- [programs/](programs/) — Program client references (system, token, token-2022, compute-budget)