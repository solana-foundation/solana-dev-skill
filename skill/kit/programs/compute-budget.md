# Compute Budget Program

Program address: `ComputeBudget111111111111111111111111111111`

```ts
import { COMPUTE_BUDGET_PROGRAM_ADDRESS } from '@solana-program/compute-budget';
```

## Instructions

### Set Compute Unit Limit

```ts
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';

const ix = getSetComputeUnitLimitInstruction({ units: 200_000 });
```

### Set Compute Unit Price (Priority Fee)

```ts
import { getSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';

const ix = getSetComputeUnitPriceInstruction({ microLamports: 1000n });
```

### Request Heap Frame

```ts
import { getRequestHeapFrameInstruction } from '@solana-program/compute-budget';

const ix = getRequestHeapFrameInstruction({ bytes: 256 * 1024 }); // 256 KB
```

## CU Estimation Helpers

### Basic Estimator

```ts
import { estimateComputeUnitLimitFactory } from '@solana-program/compute-budget';

const estimateCU = estimateComputeUnitLimitFactory({ rpc });
const estimatedUnits = await estimateCU(transactionMessage);
```

### Auto-Update Estimator

Estimates CU and updates the transaction message automatically:

```ts
import {
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
  estimateComputeUnitLimitFactory({ rpc })
);

// Returns message with CU limit instruction added/updated
const updatedMessage = await estimateAndUpdateCU(transactionMessage);
```

## Transaction Helpers

### Update or Append Instructions

```ts
import {
  updateOrAppendSetComputeUnitLimitInstruction,
  updateOrAppendSetComputeUnitPriceInstruction,
} from '@solana-program/compute-budget';

// Update CU limit (or add if not present)
const msg1 = updateOrAppendSetComputeUnitLimitInstruction(
  (current) => current === null ? 200_000 : current,
  transactionMessage
);

// Update priority fee dynamically
const msg2 = updateOrAppendSetComputeUnitPriceInstruction(
  (current) => current === null ? 1000n : current * 2n, // Double on retry
  transactionMessage
);
```

## Full Pattern: Build, Estimate, Send

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  prependTransactionMessageInstruction, signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory, assertIsTransactionWithBlockhashLifetime,
} from '@solana/kit';
import {
  getSetComputeUnitPriceInstruction,
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

async function sendWithComputeBudget(rpc, rpcSubscriptions, signer, instruction) {
  // Setup CU estimator
  const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
    estimateComputeUnitLimitFactory({ rpc })
  );

  // 1. Build base message with priority fee
  const { value: simBlockhash } = await rpc.getLatestBlockhash().send();

  let message = pipe(
    createTransactionMessage({ version: 0 }),
    m => setTransactionMessageFeePayerSigner(signer, m),
    m => setTransactionMessageLifetimeUsingBlockhash(simBlockhash, m),
    m => appendTransactionMessageInstruction(instruction, m),
    m => prependTransactionMessageInstruction(
      getSetComputeUnitPriceInstruction({ microLamports: 1000n }),
      m
    ),
  );

  // 2. Estimate CU via simulation (adds/updates CU limit instruction)
  message = await estimateAndUpdateCU(message);

  // 3. IMPORTANT: Refresh blockhash after estimation
  const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
  message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

  // 4. Sign and send
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  return sendAndConfirm(signed, { commitment: 'confirmed' });
}
```

## Priority Fee Strategy

```ts
import { updateOrAppendSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';

// Exponential backoff on retry
async function sendWithRetry(rpc, rpcSubscriptions, message, maxRetries = 3) {
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  let currentMessage = message;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Increase priority fee each retry
      currentMessage = updateOrAppendSetComputeUnitPriceInstruction(
        (current) => {
          const base = current ?? 1000n;
          return base * BigInt(2 ** i); // 1000, 2000, 4000...
        },
        currentMessage
      );

      // Refresh blockhash
      const { value: blockhash } = await rpc.getLatestBlockhash().send();
      currentMessage = setTransactionMessageLifetimeUsingBlockhash(blockhash, currentMessage);

      const signed = await signTransactionMessageWithSigners(currentMessage);
      assertIsTransactionWithBlockhashLifetime(signed);
      return await sendAndConfirm(signed, { commitment: 'confirmed' });
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
  }
}
```
