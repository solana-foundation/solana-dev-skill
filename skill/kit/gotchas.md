# Solana Kit Gotchas

Common type errors and runtime pitfalls with their fixes.

## Type Errors

### `IInstruction` does not exist

**Cause:** Using old type name from legacy web3.js.

```ts
// ❌ Type error - IInstruction doesn't exist
import { IInstruction } from '@solana/kit';

// ✅ Fix: Use Instruction
import { Instruction } from '@solana/instructions';
// or from kit:
import type { Instruction } from '@solana/kit';
```

### "Transaction message must be signed"

**Cause:** Trying to send unsigned message.

```ts
// ❌ Type error
sendTransaction(message);

// ✅ Fix: Assert fully signed
import { assertTransactionMessageIsFullySigned } from '@solana/transaction-messages';
assertTransactionMessageIsFullySigned(message);
sendTransaction(message);
```

### "Missing blockhash lifetime"

**Cause:** Message missing lifetime before signing/sending.

```ts
// ❌ Type error
signAndSendTransactionMessageWithSigners(message);

// ✅ Fix: Assert lifetime exists
import { assertTransactionMessageHasBlockhashLifetime } from '@solana/transaction-messages';
assertTransactionMessageHasBlockhashLifetime(message);
// or set it:
setTransactionMessageLifetimeUsingBlockhash(blockhash, message);
```

### `signAndSendTransactionMessageWithSigners` type error

**Cause:** Fee payer set as address, not signer.

```ts
// ❌ Type error - fee payer is address
setTransactionMessageFeePayer(address, message);
signAndSendTransactionMessageWithSigners(message);

// ✅ Fix: Use signer version
setTransactionMessageFeePayerSigner(signer, message);
signAndSendTransactionMessageWithSigners(message);
```

### Wrong signer type for wallet

**Cause:** Using `TransactionSigner` for wallet that needs to send.

```ts
// Wallets that submit transactions need TransactionSendingSigner
type TransactionSendingSigner = {
  signAndSendTransactions(txs): Promise<SignatureBytes[]>;
};

// Use signAndSendTransactionMessageWithSigners for sending signers
```

### Missing Lifetime Type Assertion

**Cause:** `sendAndConfirm` requires typed lifetime assertion.

```ts
// ❌ Type error: Property '"__transactionWithBlockhashLifetime"' is missing
const signed = await signTransactionMessageWithSigners(message);
await sendAndConfirm(signed, { commitment: 'confirmed' });

// ✅ Fix: Assert lifetime type
import { assertIsTransactionWithBlockhashLifetime } from '@solana/kit';
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });

// For durable nonce:
import {
  assertIsFullySignedTransaction,
  assertIsTransactionWithDurableNonceLifetime,
  assertIsTransactionWithinSizeLimit,
} from '@solana/kit';
const signed = await signTransactionMessageWithSigners(message);
assertIsFullySignedTransaction(signed);
assertIsTransactionWithDurableNonceLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);
await sendAndConfirmDurableNonce(signed, { commitment: 'confirmed' });
```

### Missing `TransactionWithinSizeLimit`

**Cause:** Recent Kit versions require size assertion for send factories.

```ts
// ❌ Type error: missing TransactionWithinSizeLimit
const signed = await signTransactionMessageWithSigners(message);
await sendAndConfirm(signed, { commitment: 'confirmed' });

// ✅ Fix: Add size assertion
import { assertIsTransactionWithinSizeLimit } from '@solana/kit';
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

---

### RPC URL String vs Cluster Wrapper

**Cause:** Using `devnet()`/`mainnet()` wrappers when raw URL string expected.

```ts
// ❌ May cause issues if mismatched or unsupported
import { devnet } from '@solana/rpc-types';
const rpc = createSolanaRpc(devnet('https://my-custom-endpoint.com'));

// ✅ Simple: use raw URL strings directly
const rpc = createSolanaRpc('https://api.devnet.solana.com');
const rpc = createSolanaRpc('http://127.0.0.1:8899'); // localnet
```

The cluster wrappers are optional. For localnet testing and custom endpoints, prefer raw URL strings.

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

**Cause:** Simulation takes time, blockhash ages out.

```ts
// ❌ Blockhash may expire
let message = pipe(...blockhash...);
message = await estimateAndUpdateCU(message);  // Takes time
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
// Check if account exists before assuming it does
const account = await fetchEncodedAccount(rpc, address);
if (!account.exists) {
  // Handle missing account - may need to create it first
}
```

---

## Quick Reference

| Gotcha | Fix |
|--------|-----|
| `IInstruction` doesn't exist | Use `Instruction` from `@solana/instructions` |
| "Transaction message must be signed" | `assertTransactionMessageIsFullySigned(msg)` |
| "Missing blockhash lifetime" | `assertTransactionMessageHasBlockhashLifetime(msg)` |
| Blockhash expired after CU estimation | Refresh blockhash AFTER `estimateAndUpdateCU()` |
| `signAndSendTransactionMessageWithSigners` type error | Use `setTransactionMessageFeePayerSigner` (not address) |
| Account doesn't exist runtime error | `assertAccountExists(account)` before decode |
| Wrong signer type for wallet | Use `TransactionSendingSigner` for wallets |
| Simulation "account not found" | Check `account.exists` before operations |
| Missing lifetime type on send | `assertIsTransactionWithBlockhashLifetime(signed)` |
| Missing size type on send | `assertIsTransactionWithinSizeLimit(signed)` |
| Durable nonce send type error | `assertIsTransactionWithDurableNonceLifetime(signed)` |
| `lifetimeConstraint` lost after deserialize | Re-attach metadata manually (see durable-nonce.md) |
| RPC URL wrapper issues | Use raw URL strings instead of `devnet()`/`mainnet()` |
