# System Program

Program address: `11111111111111111111111111111111`

```ts
import { SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';
```

## Account Types

### Nonce

```ts
import { fetchNonce, getNonceSize } from '@solana-program/system';

const size = getNonceSize(); // 80 bytes
const nonce = await fetchNonce(rpc, nonceAddress);
// nonce.data.authority, nonce.data.blockhash
```

## Key Instructions

### Create Account

```ts
import { getCreateAccountInstruction } from '@solana-program/system';
import { lamports } from '@solana/kit';

const ix = getCreateAccountInstruction({
  payer,
  newAccount,
  lamports: lamports(minRent),
  space: accountSize,
  programAddress: ownerProgram,
});
```

### Transfer SOL

```ts
import { getTransferSolInstruction } from '@solana-program/system';
import { lamports } from '@solana/kit';

const ix = getTransferSolInstruction({
  source: payer,
  destination: recipient.address,
  amount: lamports(1_000_000_000n), // 1 SOL
});
```

### Initialize Nonce Account

```ts
import { getInitializeNonceAccountInstruction } from '@solana-program/system';

const ix = getInitializeNonceAccountInstruction({
  nonceAccount,
  nonceAuthority: authority.address,
});
```

### Advance Nonce

```ts
import { getAdvanceNonceAccountInstruction } from '@solana-program/system';

const ix = getAdvanceNonceAccountInstruction({
  nonceAccount,
  nonceAuthority: authority,
});
```

## Complete Pattern: Create Account + Transfer

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  assertIsTransactionWithBlockhashLifetime, generateKeyPairSigner, lamports,
} from '@solana/kit';
import { getCreateAccountInstruction, getTransferSolInstruction, SYSTEM_PROGRAM_ADDRESS } from '@solana-program/system';

// Generate new account
const newAccount = await generateKeyPairSigner();

// Get minimum rent
const minRent = await rpc.getMinimumBalanceForRentExemption(0n).send();

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstructions([
    getCreateAccountInstruction({
      payer,
      newAccount,
      lamports: lamports(minRent),
      space: 0,
      programAddress: SYSTEM_PROGRAM_ADDRESS,
    }),
    getTransferSolInstruction({
      source: payer,
      destination: newAccount.address,
      amount: lamports(1_000_000_000n),
    }),
  ], m),
);

const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

## Error Handling

```ts
import { isSystemError, SYSTEM_ERROR__INSUFFICIENT_FUNDS } from '@solana-program/system';

try {
  await sendTransaction(tx);
} catch (e) {
  if (isSystemError(e, SYSTEM_ERROR__INSUFFICIENT_FUNDS)) {
    console.error('Not enough SOL for transfer');
  }
}
```
