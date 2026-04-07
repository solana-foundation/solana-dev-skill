---
title: Compute Budget Program
description: Kit-compatible @solana-program/compute-budget client for CU limits, priority fees, heap frames, CU estimation, and retry strategies.
---

# Compute Budget Program

Program address: `ComputeBudget111111111111111111111111111111`

```ts
import { COMPUTE_BUDGET_PROGRAM_ADDRESS } from '@solana-program/compute-budget';
```

Correctly budgeting compute units for your transaction increases the probability it gets accepted for processing. Without a declared CU limit, validators assume 200K CU per instruction. Since validators pack blocks to maximize throughput, they prefer transactions with tight budgets that clearly fit in remaining block space. Pairing a tight CU limit with a priority fee gives validators direct incentive to include your transaction. Total fee = base fee (5,000 lamports/sig) + (CU consumed × price per CU in micro-lamports).

## Instructions

### Set Compute Unit Limit

If you're using `createClient`/`createLocalClient` from `@solana/kit-client-rpc`, CU estimation is handled automatically via `sendTransaction()` — you don't need this. Use the manual instructions below when building transactions with `pipe()` or when you need direct control. See [overview.md](../overview.md) and [plugins.md](../plugins.md).

Always set based on simulation — overestimate wastes block space, underestimate fails the transaction.

```ts
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';

const ix = getSetComputeUnitLimitInstruction({ units: 200_000 });
```

### Set Compute Unit Price (Priority Fee)

Price per CU in micro-lamports — higher values improve inclusion during congestion.

```ts
import { getSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';

const ix = getSetComputeUnitPriceInstruction({ microLamports: 1000n });
```

### Request Heap Frame

Increases BPF heap beyond the default 32 KB — only needed when programs allocate large data structures (large account deserialization, Merkle trees, ZK proofs). Most transactions don't need this.

```ts
import { getRequestHeapFrameInstruction } from '@solana-program/compute-budget';

const ix = getRequestHeapFrameInstruction({ bytes: 256 * 1024 }); // 256 KB
```

## CU Estimation Helpers

Simulate before sending to set a tight CU limit and avoid overpaying on priority fees.

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

Build with priority fee → estimate CU via simulation → refresh blockhash (simulation consumed time) → sign and send.

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

## Priority Fee Estimation

Don't hardcode priority fees — use your RPC provider's fee estimation API to set competitive rates for current network conditions:

- [Helius Priority Fee API](https://docs.helius.dev/solana-apis/priority-fee-api)
- [QuickNode Priority Fee Add-on](https://marketplace.quicknode.com/add-on/solana-priority-fee)
- [Triton Priority Fees API](https://docs.triton.one/chains/solana/improved-priority-fees-api)
