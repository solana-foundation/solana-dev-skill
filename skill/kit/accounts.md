---
title: Accounts Reference
description: Account fetching, decoding, batch operations, PDA derivation, subscriptions, and token account queries using @solana/kit.
---

# Solana Kit Accounts Reference

## Fetch Single Account

```ts
import { fetchEncodedAccount, assertAccountExists, decodeAccount } from '@solana/kit';

const account = await fetchEncodedAccount(rpc, myAddress);
assertAccountExists(account); // Throws if account doesn't exist
const decoded = decodeAccount(account, myDecoder);
```

### Check Existence Without Throwing

```ts
const account = await fetchEncodedAccount(rpc, myAddress);
if (!account.exists) {
  // Handle missing account
}
```

## Fetch Multiple Accounts

```ts
const { value: accounts } = await rpc.getMultipleAccounts(
  [address1, address2, address3],
  { encoding: 'base64' },
).send();
```

## Typed Account Fetching (Codama)

Codama-generated clients provide typed fetch helpers:

```ts
import { fetchMint, fetchMaybeMint } from '@solana-program/token';

// Throws if not found
const mint = await fetchMint(rpc, mintAddress);
// mint.data.decimals, mint.data.supply — fully typed

// Returns null if not found
const maybeMint = await fetchMaybeMint(rpc, mintAddress);
```

## Account Decoding

See [./codecs.md](Codecs) for more information

### With Codama Decoder

```ts
import { decodeMint } from '@solana-program/token';

const account = await fetchEncodedAccount(rpc, mintAddress);
assertAccountExists(account);
const mint = decodeMint(account);
```

### With Custom Codec

```ts
import { decodeAccount } from '@solana/kit';
import { getStructDecoder, getU64Decoder, fixDecoderSize, getBytesDecoder } from '@solana/kit';

const myDecoder = getStructDecoder([
  ['authority', fixDecoderSize(getBytesDecoder(), 32)],
  ['amount', getU64Decoder()],
]);

const decoded = decodeAccount(account, myDecoder);
```

## PDA Derivation

```ts
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const [ata] = await findAssociatedTokenPda({
  owner: walletAddress,
  mint: mintAddress,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
```

### Custom PDA

```ts
import { getProgramDerivedAddress, getAddressEncoder } from '@solana/kit';

const [pda, bump] = await getProgramDerivedAddress({
  programAddress: myProgramAddress,
  seeds: [
    getAddressEncoder().encode(userAddress),
    new TextEncoder().encode('vault'),
  ],
});
```

## Account Subscriptions

```ts
const sub = await rpcSubs.accountNotifications(address, {
  encoding: 'base64',
  commitment: 'confirmed',
}).subscribe();

for await (const notif of sub) {
  console.log('Account changed:', notif);
}
```

## Token Account Queries

```ts
// All token accounts for an owner
const { value: tokenAccs } = await rpc.getTokenAccountsByOwner(
  ownerAddress,
  { programId: TOKEN_PROGRAM_ADDRESS },
  { encoding: 'jsonParsed' },
).send();

// Filter by mint
const { value: tokenAccs } = await rpc.getTokenAccountsByOwner(
  ownerAddress,
  { mint: mintAddress },
  { encoding: 'jsonParsed' },
).send();

// Token balance
const { value: balance } = await rpc.getTokenAccountBalance(tokenAccountAddress).send();
// balance.amount (string), balance.decimals, balance.uiAmount
```

## Program Account Queries

```ts
const accounts = await rpc.getProgramAccounts(programAddress, {
  encoding: 'base64',
  filters: [
    { memcmp: { offset: 0, bytes: 'base58discriminator...' } },
    { dataSize: 165n },
  ],
}).send();
```

## Account Existence Pattern

Always check existence before decoding raw accounts:

```ts
import { fetchEncodedAccount, assertAccountExists, decodeAccount } from '@solana/kit';

async function getAccountData<T>(rpc, address, decoder): Promise<T> {
  const account = await fetchEncodedAccount(rpc, address);
  assertAccountExists(account);
  return decodeAccount(account, decoder).data;
}
```

For Codama-generated clients, use `fetchMaybe*` variants to handle missing accounts gracefully.