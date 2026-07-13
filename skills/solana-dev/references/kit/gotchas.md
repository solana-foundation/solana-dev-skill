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
// ✅ Fix: Assert fully signed
import { assertTransactionMessageIsFullySigned } from '@solana/transaction-messages';
assertTransactionMessageIsFullySigned(message);
```

### "Missing blockhash lifetime"

**Cause:** Message missing lifetime before signing/sending (manual pipeline only).

```ts
// ✅ Fix: Assert lifetime exists
import { assertTransactionMessageHasBlockhashLifetime } from '@solana/transaction-messages';
assertTransactionMessageHasBlockhashLifetime(message);
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

## Quick Reference

| Gotcha | Fix |
|--------|-----|
| Plugin ordering type error | Install dependencies before dependents (`signer()` before `solanaRpc`/`litesvm`) |
| Forgot to `await` async client | `const client = await createClient().use(signerFromFile(...)).use(solanaLocalRpc())` |
| `IInstruction` doesn't exist | Use `Instruction` from `@solana/kit` |
| "Transaction message must be signed" | `assertTransactionMessageIsFullySigned(msg)` |
| "Missing blockhash lifetime" | `assertTransactionMessageHasBlockhashLifetime(msg)` |
| Blockhash expired after CU estimation | Refresh blockhash AFTER `estimateAndUpdateCU()` |
| `signAndSendTransactionMessageWithSigners` type error | Use `setTransactionMessageFeePayerSigner` (not address) |
| Account doesn't exist runtime error | `assertAccountExists(account)` before decode |
| Wrong signer type for wallet | Use `TransactionSendingSigner` for wallets |
| Missing lifetime type on send | `assertIsTransactionWithBlockhashLifetime(signed)` |
| Missing size type on send | `assertIsTransactionWithinSizeLimit(signed)` |
| Durable nonce send type error | `assertIsTransactionWithDurableNonceLifetime(signed)` |
| `lifetimeConstraint` lost after deserialize | Re-attach `lifetimeConstraint` metadata manually |
| RPC URL wrapper issues | Use raw URL strings instead of `devnet()`/`mainnet()` |
