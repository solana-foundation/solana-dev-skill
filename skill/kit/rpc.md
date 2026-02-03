# Solana Kit RPC Reference

## Creating Clients

```ts
import { createSolanaRpc, createSolanaRpcSubscriptions, devnet, mainnet } from '@solana/kit';

// Devnet
const rpc = createSolanaRpc(devnet('https://api.devnet.solana.com'));
const rpcSubs = createSolanaRpcSubscriptions(devnet('wss://api.devnet.solana.com'));

// Mainnet
const rpc = createSolanaRpc(mainnet('https://api.mainnet-beta.solana.com'));

// Local (use raw URL string for localnet)
const rpc = createSolanaRpc('http://127.0.0.1:8899');
```

Also consider using [@solana/kit-plugins](plugins.md) for a simpler setup.  

### Custom Transport

```ts
const transport = createDefaultRpcTransport({
  url: mainnet('https://my-rpc.example.com'),
  headers: { 'Authorization': 'Bearer token' },
});
const rpc = createSolanaRpcFromTransport(transport);
```

## Making Calls

```ts
// All methods return pending request, call .send()
const balance = await rpc.getBalance(address).send();

// With abort
const controller = new AbortController();
await rpc.getBalance(address).send({ abortSignal: controller.signal });
```

## Return Types

Most methods return `{ value: T }`:

```ts
const { value: balance } = await rpc.getBalance(address).send();
const { value: blockhash } = await rpc.getLatestBlockhash().send();
const { value: tokenAccs } = await rpc.getTokenAccountsByOwner(owner, filter).send();
```

Some return `T` directly:

```ts
const rentExempt = await rpc.getMinimumBalanceForRentExemption(80n).send();  // bigint directly
const tx = await rpc.getTransaction(sig, opts).send();  // Transaction | null directly
const slot = await rpc.getSlot().send();  // number directly
```

When in doubt, check the return type in your IDE.

## Common Methods

### Accounts

```ts
// Single
const info = await rpc.getAccountInfo(address, { encoding: 'base64' }).send();

// Multiple
const accounts = await rpc.getMultipleAccounts([a1, a2], { encoding: 'base64' }).send();

// Balance
const { value: balance } = await rpc.getBalance(address).send();

// Token balance
const { value: tokenBal } = await rpc.getTokenAccountBalance(tokenAcc).send();
```

### Blockhash

```ts
const { value: { blockhash, lastValidBlockHeight } } = await rpc.getLatestBlockhash().send();
const { value: isValid } = await rpc.isBlockhashValid(blockhash).send();
```

### Transactions

```ts
// Send
const sig = await rpc.sendTransaction(base64Tx, {
  encoding: 'base64',
  skipPreflight: false,
}).send();

// Get
const tx = await rpc.getTransaction(sig, {
  encoding: 'jsonParsed',
  maxSupportedTransactionVersion: 0,
}).send();

// Status
const { value: statuses } = await rpc.getSignatureStatuses([sig1, sig2]).send();
```

### Simulation

```ts
const result = await rpc.simulateTransaction(base64Tx, {
  encoding: 'base64',
  replaceRecentBlockhash: true,
}).send();

if (result.value.err) {
  console.error('Failed:', result.value.err);
} else {
  console.log('CUs:', result.value.unitsConsumed);
}
```

### Program Accounts

```ts
const accounts = await rpc.getProgramAccounts(programAddr, {
  encoding: 'base64',
  filters: [
    { memcmp: { offset: 0, bytes: 'base58...' } },
    { dataSize: 165n },
  ],
}).send();
```

### Token Accounts

```ts
const { value: tokenAccs } = await rpc.getTokenAccountsByOwner(
  owner,
  { mint: mintAddr },
  { encoding: 'jsonParsed' },
).send();
```

## Subscriptions

```ts
// Account changes
const sub = await rpcSubs.accountNotifications(address, {
  encoding: 'base64',
  commitment: 'confirmed',
}).subscribe();

for await (const notif of sub) {
  console.log('Changed:', notif);
}

// Signature confirmation
const sub = await rpcSubs.signatureNotifications(sig, {
  commitment: 'confirmed',
}).subscribe();

for await (const notif of sub) {
  console.log('Status:', notif);
  break;
}

// Logs
const sub = await rpcSubs.logsNotifications(
  { mentions: [programAddr] },
  { commitment: 'confirmed' },
).subscribe();
```

## Commitment

```ts
type Commitment = 'processed' | 'confirmed' | 'finalized';
// processed: seen by node
// confirmed: supermajority confirmed
// finalized: max lockout
```

## Airdrop (devnet/testnet)

```ts
import { airdropFactory, lamports } from '@solana/kit';

const airdrop = airdropFactory({ rpc, rpcSubscriptions });
await airdrop({
  recipientAddress: address('...'),
  lamports: lamports(1_000_000_000n),
  commitment: 'confirmed',
});
```

## Error Handling

```ts
import { isSolanaError, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE } from '@solana/errors';

try {
  await rpc.sendTransaction(tx).send();
} catch (e) {
  if (isSolanaError(e, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
    console.error('Preflight failed:', e.cause);
  }
}
```

## Method Reference

**Accounts**: `getAccountInfo`, `getMultipleAccounts`, `getBalance`, `getTokenAccountBalance`, `getTokenAccountsByOwner`, `getProgramAccounts`

**Transactions**: `sendTransaction`, `simulateTransaction`, `getTransaction`, `getSignatureStatuses`, `getSignaturesForAddress`

**Blocks**: `getBlock`, `getBlockHeight`, `getSlot`, `getLatestBlockhash`, `isBlockhashValid`

**Cluster**: `getClusterNodes`, `getEpochInfo`, `getHealth`, `getVersion`

**Misc**: `requestAirdrop`, `getMinimumBalanceForRentExemption`, `getFeeForMessage`