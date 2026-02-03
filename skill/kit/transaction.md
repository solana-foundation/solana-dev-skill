# Solana Kit Transactions Reference

## Transaction Flow

1. Create message → 2. Fee payer → 3. Lifetime → 4. Instructions → 5. Sign → 6. Send

## Create Message

```ts
import { createTransactionMessage } from '@solana/transaction-messages';
const message = createTransactionMessage({ version: 0 }); // or 'legacy'
```

## Pipe Composition

```ts
import { pipe } from '@solana/functional';

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
);
```

## Fee Payer

```ts
// With signer (recommended) — enables signTransactionMessageWithSigners()
const msg = setTransactionMessageFeePayerSigner(signer, message);

// Address only — use for multisig or when fee payer is a different party
const msg = setTransactionMessageFeePayer(feePayerAddress, message);
```

**Note:** `setTransactionMessageFeePayerSigner` embeds the signer, allowing `signTransactionMessageWithSigners()` to discover and use it automatically.

## Lifetime

### Blockhash

```ts
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
const msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);
```

### Durable Nonce

See `reference/durable-nonce.md` for complete lifecycle (create account, fetch nonce, build tx, multi-party signing).

## Instructions

```ts
// Append
const msg = appendTransactionMessageInstruction(instruction, message);
const msg = appendTransactionMessageInstructions([i1, i2, i3], message);

// Prepend (for compute budget)
const msg = prependTransactionMessageInstruction(computeBudgetIx, message);
```

### Creating Instructions

```ts
import { AccountRole } from '@solana/instructions';

const instruction: Instruction = {
  programAddress: address('Token...'),
  accounts: [
    { address: source, role: AccountRole.WRITABLE_SIGNER },
    { address: dest, role: AccountRole.WRITABLE },
    { address: owner, role: AccountRole.READONLY_SIGNER },
  ],
  data: instructionData,
};
```


### Quick Pattern

```ts
// 1. Build message with priority fee
let message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
  m => prependTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m),
);

// 2. Estimate CU via simulation
message = await estimateAndUpdateCU(message);

// 3. ⚠️ REFRESH blockhash (simulation takes time)
const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

// 4. Send
await signAndSendTransactionMessageWithSigners(message);
```


### Compute Budget (Should be used for production)

```ts
import {
  getSetComputeUnitPriceInstruction,
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

// Setup auto-estimator
const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
  estimateComputeUnitLimitFactory({ rpc })
);

let updatedMessage = await estimateAndUpdateCU(message);
```

See `reference/programs/compute-budget.md` for full CU estimation patterns.

### Update Priority Fee Dynamically

```ts
import { updateOrAppendSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';

const updated = updateOrAppendSetComputeUnitPriceInstruction(
  (current) => current === null ? 1000n : current * 2n,
  message
);
```

## Signing

### Preferred: With Embedded Signers

```ts
import { signTransactionMessageWithSigners } from '@solana/signers';

// Signs using all signers embedded via setTransactionMessageFeePayerSigner
// and signer accounts in instructions
const signed = await signTransactionMessageWithSigners(transactionMessage);
```

### Manual: Compile + Sign Separately

```ts
import { compileTransaction, signTransaction, partiallySignTransaction } from '@solana/transactions';

// When you need explicit control or don't have signers embedded
const compiled = compileTransaction(message);
const signed = await signTransaction([keypair1, keypair2], compiled);

// Partial signing for multi-party flows
const partial = await partiallySignTransaction([keypair1], compiled);
```

**Recommendation:** Prefer `signTransactionMessageWithSigners` — less error-prone, automatic signer discovery.

## Sending

### Sign and Send

```ts
import { signAndSendTransactionMessageWithSigners } from '@solana/signers';
const signature = await signAndSendTransactionMessageWithSigners(transactionMessage);
```

### Send and Confirm

```ts
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
await sendAndConfirm(signedTx, { commitment: 'confirmed' });
```

### Durable Nonce

```ts
const sendNonceTx = sendAndConfirmDurableNonceTransactionFactory({ rpc, rpcSubscriptions });
await sendNonceTx(signedTx, { commitment: 'confirmed' });
```

## Utilities

### Get Signature

```ts
import { getSignatureFromTransaction } from '@solana/transactions';
const sig = getSignatureFromTransaction(signedTx);
```

### Serialize

```ts
import { getBase64EncodedWireTransaction } from '@solana/transactions';
const base64 = getBase64EncodedWireTransaction(signedTx);
```

## Complete Example

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  prependTransactionMessageInstruction, signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory, assertIsTransactionWithBlockhashLifetime,
  assertIsTransactionWithinSizeLimit,
} from '@solana/kit';
import {
  getSetComputeUnitPriceInstruction,
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

async function sendTx(rpc, rpcSubscriptions, signer, instruction) {
  // Setup CU estimator
  const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
    estimateComputeUnitLimitFactory({ rpc })
  );

  // Initial blockhash for simulation
  const { value: simBlockhash } = await rpc.getLatestBlockhash().send();

  // Build base message with priority fee
  let message = pipe(
    createTransactionMessage({ version: 0 }),
    m => setTransactionMessageFeePayerSigner(signer, m),
    m => setTransactionMessageLifetimeUsingBlockhash(simBlockhash, m),
    m => appendTransactionMessageInstruction(instruction, m),
    m => prependTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m),
  );

  // Estimate and set CU limit via simulation
  message = await estimateAndUpdateCU(message);

  // IMPORTANT: Refresh blockhash after estimation (simulation takes time)
  const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
  message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

  // Create send factory and send
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  assertIsTransactionWithinSizeLimit(signed);
  await sendAndConfirm(signed, { commitment: 'confirmed' });
}
```

## Error Handling

```ts
import { isSolanaError, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED } from '@solana/errors';

try {
  await sendAndConfirm(tx, { commitment: 'confirmed' });
} catch (e) {
  if (isSolanaError(e, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) {
    console.error('Blockhash expired');
  }
}
```