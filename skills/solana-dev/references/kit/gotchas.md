---
title: Common Gotchas
description: Common type errors and runtime pitfalls with @solana/kit and their fixes, including signer types, lifetime assertions, plugin ordering, and account existence.
---

# Solana Kit Gotchas

Common type errors and runtime pitfalls with their fixes.

## Plugin Client Gotchas

### Plugin Ordering — Type Error

**Cause:** Plugins installed before their dependencies. `solanaRpc` / `solanaLocalRpc` / `solanaDevnetRpc` / `litesvm` all require a `payer` to be installed first; low-level `rpcTransactionPlanner` / `rpcTransactionPlanExecutor` require `rpc` and `payer`.

```ts
// ❌ Type error — solanaRpc requires payer
createClient()
  .use(solanaRpc({ rpcUrl: url }))
  .use(signer(mySigner));

// ✅ Fix: signer first (sets payer + identity), then RPC bundle
createClient()
  .use(signer(mySigner))
  .use(solanaRpc({ rpcUrl: url }));
```

### Forgetting to `await` Async Client

**Cause:** Some plugins (e.g., `signerFromFile`, `generatedSigner`, `generatedSignerWithSol`) are async, and `.use()` automatically threads the promise through the chain.

```ts
// ❌ Runtime error — client is a Promise, not a client
const client = createClient()
  .use(signerFromFile('./id.json'))
  .use(solanaLocalRpc());
client.sendTransaction([ix]); // TypeError: not a function

// ✅ Fix: await the client
const client = await createClient()
  .use(signerFromFile('./id.json'))
  .use(solanaLocalRpc());
await client.sendTransaction([ix]);
```

---

## Type Errors

### `IInstruction` does not exist

**Cause:** Using old type name from legacy web3.js.

```ts
// ❌ Type error
import { IInstruction } from '@solana/kit';

// ✅ Fix: Use Instruction
import type { Instruction } from '@solana/kit';
```

### "Transaction message must be signed"

**Cause:** Trying to send unsigned message (manual pipeline only).

```ts
// ✅ Fix: Assert the signed transaction is fully signed
import { assertIsFullySignedTransaction } from '@solana/transactions';
assertIsFullySignedTransaction(signedTransaction);
```

### "Missing blockhash lifetime"

**Cause:** Message missing lifetime before signing/sending (manual pipeline only).

```ts
// ✅ Fix: Assert lifetime exists
import { assertIsTransactionMessageWithBlockhashLifetime } from '@solana/transaction-messages';
assertIsTransactionMessageWithBlockhashLifetime(message);
```

### `signAndSendTransactionMessageWithSigners` type error

**Cause:** Fee payer set as address, not signer.

```ts
// ❌ Type error — fee payer is address only
setTransactionMessageFeePayer(address, message);

// ✅ Fix: Use signer version
setTransactionMessageFeePayerSigner(signer, message);
```

### Wrong signer type for wallet

**Cause:** Using `TransactionSigner` for wallet that needs to send.

```ts
// Wallets that submit transactions need TransactionSendingSigner
type TransactionSendingSigner = {
  signAndSendTransactions(txs): Promise<SignatureBytes[]>;
};
```

### Missing Lifetime Type Assertion

**Cause:** `sendAndConfirm` requires typed lifetime assertion (manual pipeline only).

```ts
// ❌ Type error: Property '"__transactionWithBlockhashLifetime"' is missing
const signed = await signTransactionMessageWithSigners(message);
await sendAndConfirm(signed, { commitment: 'confirmed' });

// ✅ Fix: Assert lifetime + size types
assertIsTransactionWithBlockhashLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

### Missing `TransactionWithinSizeLimit`

**Cause:** Recent Kit versions require size assertion for send factories.

```ts
// ✅ Fix: Add size assertion
import { assertIsTransactionWithinSizeLimit } from '@solana/kit';
assertIsTransactionWithinSizeLimit(signed);
```

### RPC URL String vs Cluster Wrapper

**Cause:** Using `devnet()`/`mainnet()` wrappers when raw URL string expected.

```ts
// ❌ May cause issues
import { devnet } from '@solana/rpc-types';
const rpc = createSolanaRpc(devnet('https://my-custom-endpoint.com'));

// ✅ Simple: use raw URL strings directly
const rpc = createSolanaRpc('https://api.devnet.solana.com');
```

---

## Runtime Errors

### "Account does not exist"

**Cause:** Decoding account that may not exist.

```ts
// ❌ Runtime error if account missing
const account = await fetchEncodedAccount(rpc, address);
const decoded = decodeAccount(account, decoder);

// ✅ Fix: Assert existence first
const account = await fetchEncodedAccount(rpc, address);
assertAccountExists(account);
const decoded = decodeAccount(account, decoder);
```

### Blockhash expired after CU estimation

**Cause:** Simulation takes time, blockhash ages out. Only applies to manual pipeline — plugin clients handle this automatically.

```ts
// ❌ Blockhash may expire
let message = pipe(...blockhash...);
message = await estimateAndUpdateCU(message);
await signAndSendTransactionMessageWithSigners(message);

// ✅ Fix: Refresh blockhash AFTER estimation
let message = pipe(...blockhash...);
message = await estimateAndUpdateCU(message);
const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);
await signAndSendTransactionMessageWithSigners(message);
```

### Simulation fails with "account not found"

**Cause:** Account doesn't exist yet (e.g., PDA not initialized).

```ts
const account = await fetchEncodedAccount(rpc, address);
if (!account.exists) {
  // Handle missing account — may need to create it first
}
```

---

## Transaction v1 Gotchas

Full reference: [transactions-v1.md](../transactions-v1.md).

### `version: 1` throws on the plugin client

**Cause:** `rpcTransactionPlanner` in `@solana/kit-plugin-rpc` defines the `version: 1` config shape for forward compatibility but rejects it at runtime — still true as of 0.18.0.

```ts
// ❌ Runtime error: "Version 1 transactions are not yet supported by `rpcTransactionPlanner`."
createClient().use(signer(s)).use(solanaRpc({ rpcUrl, transactionConfig: { version: 1 } }));

// ✅ Fix: build v1 through the manual pipe with @solana/kit 8 directly
const message = pipe(
  createTransactionMessage({ version: 1 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(ix, m),
  m => setTransactionMessageConfig({ computeUnitLimit: 20_000, loadedAccountsDataSizeLimit: 64 * 1024 }, m),
);
```

### `createTransactionMessage({ version: 1 })` is a type error

**Cause:** `@solana/kit` 7.x has the v1 codecs and config setters but not the builder types. 8.0.0 is the first release that types it.

```bash
# ✅ Fix
pnpm add @solana/kit@^8.0.0
```

### v1 transaction fails with `MaxLoadedAccountsDataSizeExceeded`

**Cause:** Unset v1 config fields budget **zero**, not a default. Only `heapSize` falls back (32 KiB).

```ts
// ❌ Zero CU and zero loaded-accounts bytes — cannot run
createTransactionMessage({ version: 1 });

// ✅ Fix: set both explicitly, or measure them by simulation
const estimateResourceLimits = estimateResourceLimitsFactory({ rpc });
const message = await estimateAndSetResourceLimitsFactory(estimateResourceLimits)(
  fillTransactionMessageProvisoryResourceLimits(draft),
);
```

The estimate has no margin, and an account created between simulation and send is a step change from 0 to 64+ bytes — add headroom, rounding data size up to the next 32 KiB page.

### `setTransactionMessageComputeUnitPrice` type error on a v1 message

**Cause:** v0 states the priority fee as a *price* in micro-lamports per CU; v1 states a *total* in lamports. Kit splits them and enforces the split by type.

```ts
// ❌ Type error on a v1 message
setTransactionMessageComputeUnitPrice(250_000n, v1Message);

// ✅ Fix: total lamports, not a per-CU price
setTransactionMessagePriorityFeeLamports(5_000n, v1Message);
```

`setTransactionMessageConfig` is the mirror image — v1-only, rejected on legacy/v0.

### Priority fee or CU limit reads as 0 for some transactions

**Cause:** Scanning instructions for the ComputeBudget program. On v1 those values live in `message.config`, so the scan finds nothing and reports zero **without erroring**.

```ts
// ✅ Fix: version-agnostic readers
getTransactionMessageComputeUnitLimit(message);            // any version
getTransactionMessagePriorityFeeLamports(v1Message);       // v1 only
```

Over gRPC, discriminate on `Message.config` presence — never on the `versioned` boolean, which is `true` for both v0 and v1.

---

## Quick Reference

| Gotcha | Fix |
|--------|-----|
| Plugin ordering type error | Install dependencies before dependents (`signer()` before `solanaRpc`/`litesvm`) |
| Forgot to `await` async client | `const client = await createClient().use(signerFromFile(...)).use(solanaLocalRpc())` |
| `IInstruction` doesn't exist | Use `Instruction` from `@solana/kit` |
| "Transaction message must be signed" | `assertIsFullySignedTransaction(signedTx)` |
| "Missing blockhash lifetime" | `assertIsTransactionMessageWithBlockhashLifetime(msg)` |
| Blockhash expired after CU estimation | Refresh blockhash AFTER `estimateAndUpdateCU()` |
| `signAndSendTransactionMessageWithSigners` type error | Use `setTransactionMessageFeePayerSigner` (not address) |
| Account doesn't exist runtime error | `assertAccountExists(account)` before decode |
| Wrong signer type for wallet | Use `TransactionSendingSigner` for wallets |
| Missing lifetime type on send | `assertIsTransactionWithBlockhashLifetime(signed)` |
| Missing size type on send | `assertIsTransactionWithinSizeLimit(signed)` |
| Durable nonce send type error | `assertIsTransactionWithDurableNonceLifetime(signed)` |
| `lifetimeConstraint` lost after deserialize | Re-attach `lifetimeConstraint` metadata manually |
| RPC URL wrapper issues | Use raw URL strings instead of `devnet()`/`mainnet()` |
| `version: 1` throws on plugin client | Build v1 with the manual `pipe()` and `@solana/kit` 8 |
| `createTransactionMessage({ version: 1 })` type error | Upgrade to `@solana/kit` 8.0.0+ |
| v1 `MaxLoadedAccountsDataSizeExceeded` | Unset v1 limits are **zero** — set CU limit and loaded-accounts size explicitly |
| `setTransactionMessageComputeUnitPrice` rejected on v1 | Use `setTransactionMessagePriorityFeeLamports` (total lamports, not per-CU) |
| Priority fee / CU limit reads as 0 | v1 keeps them in `message.config`, not ComputeBudget instructions |
