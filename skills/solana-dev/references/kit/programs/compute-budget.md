---
title: Compute Budget Program
description: Budgeting compute units, priority fees, heap, and loaded-accounts data — via message config on transaction v1 (the default) or @solana-program/compute-budget instructions on legacy/v0.
---

# Compute Budget Program

Program address: `ComputeBudget111111111111111111111111111111`

```ts
import { COMPUTE_BUDGET_PROGRAM_ADDRESS } from '@solana-program/compute-budget';
```

Use a tight compute budget so validators can schedule the transaction efficiently. Estimate resource limits from simulation; set fixed values only when you have reliable measurements or need an intentional cap.

## Where the budget lives depends on the transaction version

| | legacy / v0 | **v1 (default for new code)** |
|---|---|---|
| Compute unit limit | `SetComputeUnitLimit` instruction | `message.config.computeUnitLimit` |
| Priority fee | `SetComputeUnitPrice` — micro-lamports **per CU** | `message.config.priorityFeeLamports` — **total lamports** |
| Loaded accounts data size | `SetLoadedAccountsDataSizeLimit` instruction (default 64 MiB) | `message.config.loadedAccountsDataSizeLimit` (**default 0**) |
| Heap | `RequestHeapFrame` instruction | `message.config.heapSize` |
| Unset CU limit | 200K per instruction, max 1.4M | **0 CU** — the transaction cannot run |

On v1 the ComputeBudget program's instructions are **no-ops**: they execute successfully doing nothing, burn 150 CU and an instruction slot, and Kit's types reject the mismatched setters. Everything below under *Instructions* and *CU Estimation Helpers* is the legacy/v0 path. Full v1 reference: [transactions-v1.md](../../transactions-v1.md).

**Plugin clients estimate limits automatically.** With `solanaRpc({ transactionConfig: { version: 1, priorityFeeLamports } })`, `client.sendTransaction()` reserves and estimates both v1 limits. Legacy/v0 clients similarly manage ComputeBudget instructions. Use the manual APIs only with a manual `pipe()` pipeline. See [overview.md](../overview.md) and [plugins.md](../plugins.md).

## Version-routed setters (manual `pipe()` path)

`@solana/kit` 8 routes three of the four budget setters by message version, so the same call appends an instruction on legacy/v0 and writes `message.config` on v1:

```ts
import {
  setTransactionMessageComputeUnitLimit,        // any version
  setTransactionMessageLoadedAccountsDataSizeLimit, // any version
  setTransactionMessageHeapSize,                // any version
  setTransactionMessagePriorityFeeLamports,     // v1 only — total lamports
  setTransactionMessageComputeUnitPrice,        // legacy/v0 only — micro-lamports per CU
  setTransactionMessageConfig,                  // v1 only — whole budget in one call
} from '@solana/kit';

// Use these setters for measured overrides. For normal sends, estimate the
// limits with the resource-estimation pipeline below.
const v1 = setTransactionMessagePriorityFeeLamports(5_000n, message);
```

Estimate both v1 limits with `fillTransactionMessageProvisoryResourceLimits` and `estimateAndSetResourceLimitsFactory(estimateResourceLimitsFactory({ rpc }))`. See [Sizing the resource limits](../../transactions-v1.md#sizing-the-resource-limits).

## Instructions (legacy / v0)

### Set Compute Unit Limit

Always set based on simulation — overestimate wastes block space, underestimate fails the transaction.

```ts
import { getSetComputeUnitLimitInstruction } from '@solana-program/compute-budget';

const ix = getSetComputeUnitLimitInstruction({ units: 200_000 });
```

### Set Compute Unit Price (Priority Fee)

Price per CU in micro-lamports — higher values improve inclusion during congestion. Total fee on legacy/v0 = base fee (5,000 lamports/sig) + (CU consumed × price per CU in micro-lamports). On v1 the fee is stated directly as `priorityFeeLamports`.

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

## CU Estimation Helpers (legacy / v0)

Simulate before sending to set a tight CU limit and avoid overpaying on priority fees. These estimators emit ComputeBudget instructions; on v1 use `estimateResourceLimitsFactory` from `@solana/kit` instead.

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

## Transaction Helpers (legacy / v0)

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

## Full Pattern: Build, Estimate, Send (v1)

Build with the priority fee → reserve provisory limits → estimate both by one simulation → refresh blockhash (simulation consumed time) → sign and send over base64.

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  setTransactionMessagePriorityFeeLamports, fillTransactionMessageProvisoryResourceLimits,
  estimateResourceLimitsFactory, estimateAndSetResourceLimitsFactory,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  assertIsTransactionWithBlockhashLifetime, assertIsTransactionWithinSizeLimit, lamports,
} from '@solana/kit';

async function sendWithComputeBudget(rpc, rpcSubscriptions, signer, instruction) {
  const estimateAndSetLimits = estimateAndSetResourceLimitsFactory(estimateResourceLimitsFactory({ rpc }));

  // 1. Build the message with the priority fee (a total, not a per-CU price)
  const { value: simBlockhash } = await rpc.getLatestBlockhash().send();
  let message = pipe(
    createTransactionMessage({ version: 1 }),
    m => setTransactionMessageFeePayerSigner(signer, m),
    m => setTransactionMessageLifetimeUsingBlockhash(simBlockhash, m),
    m => appendTransactionMessageInstruction(instruction, m),
    m => setTransactionMessagePriorityFeeLamports(lamports(5_000n), m),
    // 2. Reserve space for both limits so the message simulates at its final size
    m => fillTransactionMessageProvisoryResourceLimits(m),
  );

  // 3. One simulation with both limits maxed; writes computeUnitLimit and
  //    loadedAccountsDataSizeLimit back. No margin — wrap the estimator to add some.
  message = await estimateAndSetLimits(message);

  // 4. Refresh blockhash after estimation
  const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
  message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

  // 5. Sign and send (sendAndConfirm submits over base64, as v1 requires)
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  assertIsTransactionWithinSizeLimit(signed); // 4096 bytes on v1
  return sendAndConfirm(signed, { commitment: 'confirmed' });
}
```

### Legacy / v0 equivalent

Same shape, with ComputeBudget instructions and the `@solana-program/compute-budget` estimator. Keep this only for code that must stay on v0 (e.g. a wallet that does not sign v1 yet).

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

async function sendWithComputeBudgetV0(rpc, rpcSubscriptions, signer, instruction) {
  const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
    estimateComputeUnitLimitFactory({ rpc })
  );
  const { value: simBlockhash } = await rpc.getLatestBlockhash().send();
  let message = pipe(
    createTransactionMessage({ version: 0 }),
    m => setTransactionMessageFeePayerSigner(signer, m),
    m => setTransactionMessageLifetimeUsingBlockhash(simBlockhash, m),
    m => appendTransactionMessageInstruction(instruction, m),
    m => prependTransactionMessageInstruction(getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m),
  );
  message = await estimateAndUpdateCU(message);
  const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
  message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);
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
