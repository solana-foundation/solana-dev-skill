# Solana Kit Accounts Reference

`@solana/kit` is the JavaScript SDK for building Solana applications. Modular, tree-shakable, full TypeScript support.

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

### RPC Client

```ts
import { createSolanaRpc, createSolanaRpcSubscriptions, devnet } from '@solana/kit';

const rpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const rpcSubs = createSolanaRpcSubscriptions(devnet('wss://api.devnet.solana.com'));
```

### Build & Send Transaction

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  signAndSendTransactionMessageWithSigners,
} from '@solana/kit';

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(myInstruction, m),
);

const signature = await signAndSendTransactionMessageWithSigners(message);
```

### Compute Budget (Required for production)

Always set compute units and priority fee:

```ts
import {
  getSetComputeUnitPriceInstruction,
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

// Setup estimator
const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
  estimateComputeUnitLimitFactory({ rpc })
);

// Build message with priority fee
let message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
  m => prependTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m),
);

// Estimate and set CU limit via simulation
message = await estimateAndUpdateCU(message);

// ⚠️ IMPORTANT: Refresh blockhash after estimation (simulation takes time)
const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);
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

## Package Overview

| Package | Purpose |
|---------|---------|
| `@solana/kit` | Main entry, re-exports all |
| `@solana/addresses` | Address validation |
| `@solana/accounts` | Account fetching/decoding |
| `@solana/codecs` | Data encoding/decoding |
| `@solana/rpc` | JSON RPC client |
| `@solana/rpc-subscriptions` | WebSocket subscriptions |
| `@solana/transactions` | Compile/sign/serialize |
| `@solana/transaction-messages` | Build tx messages |
| `@solana/signers` | Signing abstraction |
| `@solana/react` | React wallet hooks |
| `@solana-program/compute-budget` | CU limits & priority fees |

## Best Practices

1. **Use `pipe()`** for transaction building
2. **Use branded types** — `address()`, `lamports()`, `signature()`
3. **Always set compute budget** — estimate CUs, set priority fee
4. **Handle account existence** — `assertAccountExists()` before decode
5. **Use factories** — `sendAndConfirmTransactionFactory()`, `airdropFactory()`

## Reference Files

For detailed patterns:
- [codecs.md](codecs.md) — Complete codec patterns
- [rpc.md](rpc.md) — RPC methods and subscriptions
- [react.md](react.md) — React hooks and wallet integration
- [transaction.md](transaction.md) — Transaction building, signing, compute budget