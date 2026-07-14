---
title: "Advanced: Manual Transactions, Direct RPC & Custom Plugins"
description: Manual transaction building with pipe composition, direct RPC client usage, RPC method reference, building custom plugins, and assembling domain-specific clients.
---

# Advanced: Manual Transactions, Direct RPC & Custom Plugins

This reference covers low-level patterns for when you need full control over the transaction lifecycle, direct RPC access, or want to build custom plugins and domain-specific clients.

For most use cases, prefer the plugin clients in [overview.md](overview.md) and [plugins.md](plugins.md).

---

## Manual Transaction Pipeline

### Transaction Flow

1. Create message → 2. Fee payer → 3. Lifetime → 4. Instructions → 5. Sign → 6. Send

### Pipe Composition

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction,
  prependTransactionMessageInstruction,
} from '@solana/kit';

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
);
```

### Fee Payer

```ts
// With signer (recommended) — enables signTransactionMessageWithSigners()
const msg = setTransactionMessageFeePayerSigner(signer, message);

// Address only — for multisig or when fee payer is a different party
const msg = setTransactionMessageFeePayer(feePayerAddress, message);
```

### Lifetime

```ts
// Blockhash
const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
const msg = setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, message);

// Durable nonce — auto-adds AdvanceNonceAccount instruction
const msg = setTransactionMessageLifetimeUsingDurableNonce(nonceInfo, message);
```

### Instructions

```ts
// Append
const msg = appendTransactionMessageInstruction(instruction, message);
const msg = appendTransactionMessageInstructions([i1, i2, i3], message);

// Prepend (for compute budget)
const msg = prependTransactionMessageInstruction(computeBudgetIx, message);
```

### Creating Raw Instructions

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

---

## Compute Budget

Should be used for production transactions.

### Setup CU Estimator

```ts
import {
  getSetComputeUnitPriceInstruction,
  estimateComputeUnitLimitFactory,
  estimateAndUpdateProvisoryComputeUnitLimitFactory,
} from '@solana-program/compute-budget';

const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
  estimateComputeUnitLimitFactory({ rpc })
);
```

### Full Pattern: Priority Fee + CU Estimation + Blockhash Refresh

```ts
// 1. Build message with priority fee
let message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(signer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  m => appendTransactionMessageInstruction(instruction, m),
  m => prependTransactionMessageInstruction(
    getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m
  ),
);

// 2. Estimate CU via simulation
message = await estimateAndUpdateCU(message);

// 3. REFRESH blockhash (simulation takes time, old one may expire)
const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

// 4. Sign and send
await signAndSendTransactionMessageWithSigners(message);
```

### Update Priority Fee Dynamically

```ts
import { updateOrAppendSetComputeUnitPriceInstruction } from '@solana-program/compute-budget';

const updated = updateOrAppendSetComputeUnitPriceInstruction(
  (current) => current === null ? 1000n : current * 2n,
  message
);
```

See [programs/compute-budget.md](programs/compute-budget.md) for the full CU reference.

---

## Signing

### With Embedded Signers (Recommended)

```ts
import { signTransactionMessageWithSigners } from '@solana/kit';

// Auto-discovers signers from fee payer + instruction accounts
const signed = await signTransactionMessageWithSigners(message);
```

### Sign and Send

```ts
import { signAndSendTransactionMessageWithSigners } from '@solana/kit';
const signature = await signAndSendTransactionMessageWithSigners(message);
```

### Manual: Compile + Sign Separately

```ts
import { compileTransaction, signTransaction, partiallySignTransaction } from '@solana/transactions';

const compiled = compileTransaction(message);
const signed = await signTransaction([keypair1, keypair2], compiled);

// Partial signing for multi-party flows
const partial = await partiallySignTransaction([keypair1], compiled);
```

---

## Sending

### Send and Confirm Factory

```ts
const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);

// Required type assertions before sending
assertIsTransactionWithBlockhashLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

### Durable Nonce

```ts
const sendNonceTx = sendAndConfirmDurableNonceTransactionFactory({ rpc, rpcSubscriptions });
assertIsFullySignedTransaction(signed);
assertIsTransactionWithDurableNonceLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);
await sendNonceTx(signed, { commitment: 'confirmed' });
```

### Utilities

```ts
import { getSignatureFromTransaction, getBase64EncodedWireTransaction } from '@solana/transactions';

const sig = getSignatureFromTransaction(signedTx);
const base64 = getBase64EncodedWireTransaction(signedTx);
```

---

## Complete Manual Example

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
  const estimateAndUpdateCU = estimateAndUpdateProvisoryComputeUnitLimitFactory(
    estimateComputeUnitLimitFactory({ rpc })
  );

  const { value: simBlockhash } = await rpc.getLatestBlockhash().send();

  let message = pipe(
    createTransactionMessage({ version: 0 }),
    m => setTransactionMessageFeePayerSigner(signer, m),
    m => setTransactionMessageLifetimeUsingBlockhash(simBlockhash, m),
    m => appendTransactionMessageInstruction(instruction, m),
    m => prependTransactionMessageInstruction(
      getSetComputeUnitPriceInstruction({ microLamports: 1000n }), m
    ),
  );

  message = await estimateAndUpdateCU(message);

  // Refresh blockhash after estimation
  const { value: freshBlockhash } = await rpc.getLatestBlockhash().send();
  message = setTransactionMessageLifetimeUsingBlockhash(freshBlockhash, message);

  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  const signed = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(signed);
  assertIsTransactionWithinSizeLimit(signed);
  await sendAndConfirm(signed, { commitment: 'confirmed' });
}
```

---

## Direct RPC Client

### Creating Clients

```ts
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const rpc = createSolanaRpc('https://api.devnet.solana.com');
const rpcSubs = createSolanaRpcSubscriptions('wss://api.devnet.solana.com');
```

### Custom Transport

```ts
const transport = createDefaultRpcTransport({
  url: 'https://my-rpc.example.com',
  headers: { 'Authorization': 'Bearer token' },
});
const rpc = createSolanaRpcFromTransport(transport);
```

### Making Calls

```ts
// All methods return pending request — call .send()
const { value: balance } = await rpc.getBalance(address).send();

// With abort
const controller = new AbortController();
await rpc.getBalance(address).send({ abortSignal: controller.signal });
```

### Return Types

Most methods return `{ value: T }`:
```ts
const { value: balance } = await rpc.getBalance(address).send();
const { value: blockhash } = await rpc.getLatestBlockhash().send();
```

Some return `T` directly:
```ts
const rentExempt = await rpc.getMinimumBalanceForRentExemption(80n).send();
const slot = await rpc.getSlot().send();
```

### Subscriptions

```ts
const sub = await rpcSubs.accountNotifications(address, {
  encoding: 'base64',
  commitment: 'confirmed',
}).subscribe();

for await (const notif of sub) {
  console.log('Changed:', notif);
}
```

### Commitment Levels

```ts
type Commitment = 'processed' | 'confirmed' | 'finalized';
// processed: seen by node
// confirmed: supermajority confirmed
// finalized: max lockout
```

### Airdrop (devnet/testnet)

```ts
import { airdropFactory, lamports } from '@solana/kit';

const airdrop = airdropFactory({ rpc, rpcSubscriptions });
await airdrop({
  recipientAddress: address('...'),
  lamports: lamports(1_000_000_000n),
  commitment: 'confirmed',
});
```

### RPC Method Reference

**Accounts**: `getAccountInfo`, `getMultipleAccounts`, `getBalance`, `getTokenAccountBalance`, `getTokenAccountsByOwner`, `getProgramAccounts`

**Transactions**: `sendTransaction`, `simulateTransaction`, `getTransaction`, `getSignatureStatuses`, `getSignaturesForAddress`

**Blocks**: `getBlock`, `getBlockHeight`, `getSlot`, `getLatestBlockhash`, `isBlockhashValid`

**Cluster**: `getClusterNodes`, `getEpochInfo`, `getHealth`, `getVersion`

**Misc**: `requestAirdrop`, `getMinimumBalanceForRentExemption`, `getFeeForMessage`

---

## Error Handling

```ts
import {
  isSolanaError,
  SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
} from '@solana/errors';

try {
  await sendAndConfirm(tx, { commitment: 'confirmed' });
} catch (e) {
  if (isSolanaError(e, SOLANA_ERROR__BLOCK_HEIGHT_EXCEEDED)) {
    console.error('Blockhash expired');
  }
  if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
    console.error('Preflight failed:', e.cause);
  }
}
```

---

## Building Custom Plugins

A plugin is a function that takes a client object and returns a new one (or a promise):

```ts
export type ClientPlugin<TInput extends object, TOutput extends Promise<object> | object> =
  (input: TInput) => TOutput;
```

### Basic Plugin

```ts
import { createClient } from '@solana/kit';

function apple() {
  return <T extends object>(client: T) => ({
    ...client,
    fruit: 'apple' as const,
  });
}

const client = createClient().use(apple());
client.fruit; // 'apple'
```

### Plugin with Requirements

Require that other plugins are installed first:

```ts
function appleTart() {
  return <T extends { fruit: 'apple' }>(client: T) => ({
    ...client,
    dessert: 'appleTart' as const,
  });
}

createClient().use(apple()).use(appleTart()); // ✅ Ok
createClient().use(appleTart());              // ❌ TypeScript error
```

### Async Plugin

```ts
function magicFruit() {
  return async <T extends object>(client: T) => {
    const fruit = await fetchSomeMagicFruit();
    return { ...client, fruit };
  };
}

// use() handles awaiting automatically
const client = await createClient().use(magicFruit()).use(apple());
```

---

## Assembling Domain-Specific Clients

The plugin system enables building purpose-built clients for specific domains. Here are real-world examples:

### Example: Kora (Gasless Transactions)

[Kora](https://github.com/solana-foundation/kora) builds a gasless payment client by composing standard plugins with a custom Kora plugin:

```ts
import { createClient } from '@solana/kit';
import { planAndSendTransactions, transactionPlanExecutor, transactionPlanner } from '@solana/kit-plugin-instruction-plan';
import { payer } from '@solana/kit-plugin-signer';
import { rpc } from '@solana/kit-plugin-rpc';

export async function createKitKoraClient(config) {
  return createClient()
    .use(rpc(config.rpcUrl))
    .use(koraPlugin({ apiKey: config.apiKey, endpoint: config.endpoint }))
    .use(payer(payerSigner))
    .use(transactionPlanner(koraTransactionPlanner))      // Custom planning logic
    .use(transactionPlanExecutor(koraTransactionExecutor)) // Custom execution via Kora API
    .use(planAndSendTransactions());
}

// Usage
const client = await createKitKoraClient({ endpoint, rpcUrl, feeToken, feePayerWallet });
await client.sendTransaction([myInstruction]); // Gasless!
```

Key pattern: Standard plugins (`rpc`, `payer`, `planAndSendTransactions`) combined with custom `transactionPlanner` and `transactionPlanExecutor` that route through Kora's gasless API.

### Example: Solana Pay

[Solana Pay](https://github.com/amilz/solana-pay) builds role-specific clients — a read-only merchant client and a full wallet client:

```ts
import { createClient } from '@solana/kit';
import { planAndSendTransactions } from '@solana/kit-plugin-instruction-plan';
import { payer } from '@solana/kit-plugin-signer';
import { rpc, rpcTransactionPlanExecutor, rpcTransactionPlanner } from '@solana/kit-plugin-rpc';

// Merchant: read-only, no payer needed
function createMerchantClient(config) {
  return createClient()
    .use(rpc(config.rpcUrl))
    .use(solanaPayMerchant()); // Adds client.pay.encodeURL, findReference, validateTransfer
}

// Wallet: full tx capabilities
function createWalletClient(config) {
  return createClient()
    .use(rpc(config.rpcUrl))
    .use(payer(config.payer))
    .use(rpcTransactionPlanner())
    .use(rpcTransactionPlanExecutor())
    .use(planAndSendTransactions())
    .use(solanaPayWallet()); // Adds client.pay.parseURL, createTransfer
}

// Usage
const merchant = createMerchantClient({ rpcUrl });
const url = merchant.pay.encodeURL({ recipient, amount: 1.5 });

const wallet = createWalletClient({ rpcUrl, payer: myWalletSigner });
const instructions = await wallet.pay.createTransfer({ recipient, amount: 1.5 });
await wallet.sendTransaction(instructions);
```

Key pattern: Same base plugins, different compositions for different roles. Domain logic added as custom plugins (`solanaPayMerchant`, `solanaPayWallet`).

### Pattern Summary

When building a domain-specific client:

1. Start with `createClient()` from `@solana/kit`
2. Add standard plugins for capabilities you need (`rpc`, `payer` from `@solana/kit-plugin-signer`, `planAndSendTransactions`)
3. Swap `transactionPlanner` / `transactionPlanExecutor` if you need custom tx lifecycle (like Kora)
4. Add your domain plugin(s) that extend the client with domain-specific methods
5. Export a factory function (`createMyClient(config)`) for consumers
