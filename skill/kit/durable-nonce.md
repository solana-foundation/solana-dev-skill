# Solana Kit Durable Nonce Reference

Durable nonces allow transactions to remain valid indefinitely, instead of expiring after ~60 seconds.

## When to Use

- **Offline signing** — Sign now, submit later
- **Multi-party signing** — Collect signatures from multiple parties over time
- **Long-lived transactions** — Transactions that may take time to assemble or approve

Most transactions should use blockhash (simpler). Only use durable nonces when needed.

## Complete Lifecycle

### 1. Create Nonce Account

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  generateKeyPairSigner, lamports, assertIsTransactionWithBlockhashLifetime,
} from '@solana/kit';
import {
  getCreateAccountInstruction,
  getInitializeNonceAccountInstruction,
  getNonceSize,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';

// Generate keypair for nonce account
const nonceKeypair = await generateKeyPairSigner();

// Get rent-exempt minimum
const rentExempt = await rpc.getMinimumBalanceForRentExemption(BigInt(getNonceSize())).send();

// Build creation transaction
const { value: blockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  m => appendTransactionMessageInstructions([
    getCreateAccountInstruction({
      payer,
      newAccount: nonceKeypair,
      lamports: lamports(rentExempt),
      space: getNonceSize(),
      programAddress: SYSTEM_PROGRAM_ADDRESS,
    }),
    getInitializeNonceAccountInstruction({
      nonceAccount: nonceKeypair.address,
      nonceAuthority: payer.address,
    }),
  ], m),
);

const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

### 2. Fetch Nonce Value

```ts
import { fetchNonce } from '@solana-program/system';
import { Nonce } from '@solana/kit';

const nonceAccount = await fetchNonce(rpc, nonceKeypair.address);
const nonceValue = nonceAccount.data.blockhash as unknown as Nonce; // Nonce requires casting to Nonce type
```

### 3. Build Transaction with Durable Nonce

```ts
import { setTransactionMessageLifetimeUsingDurableNonce } from '@solana/kit';

const durableMessage = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingDurableNonce({
    nonce: nonceValue,
    nonceAccountAddress: nonceKeypair.address,
    nonceAuthorityAddress: payer.address,
  }, m),
  m => appendTransactionMessageInstruction(myInstruction, m),
);
```

**Key note:** `setTransactionMessageLifetimeUsingDurableNonce` automatically adds the AdvanceNonceAccount instruction. Do NOT manually prepend it or you will get a Program Error for attempting to advance a nonce twice in a slot.

### 4. Sign and Send

```ts
import {
  signTransactionMessageWithSigners,
  assertIsFullySignedTransaction,
  assertIsTransactionWithDurableNonceLifetime,
  assertIsTransactionWithinSizeLimit,
  sendAndConfirmDurableNonceTransactionFactory,
} from '@solana/kit';

const signed = await signTransactionMessageWithSigners(durableMessage);

// Type assertions required before send
assertIsFullySignedTransaction(signed);
assertIsTransactionWithDurableNonceLifetime(signed);
assertIsTransactionWithinSizeLimit(signed);

const sendAndConfirmDurableNonce = sendAndConfirmDurableNonceTransactionFactory({ rpc, rpcSubscriptions });
await sendAndConfirmDurableNonce(signed, { commitment: 'confirmed' });
```

## Multi-Party Signing Flow

When multiple parties need to sign:

### Party A (Initiator)

```ts
import {
  compileTransaction,
  getBase64EncodedWireTransaction,
  partiallySignTransaction,
} from '@solana/kit';

// Build message (Party A is fee payer)
const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(partyA, m),
  m => setTransactionMessageLifetimeUsingDurableNonce({
    nonce: nonceValue,
    nonceAccountAddress: nonceKeypair.address,
    nonceAuthorityAddress: partyA.address,
  }, m),
  m => appendTransactionMessageInstruction(instructionRequiringBothSigners, m),
);

// Compile and partially sign
const compiled = compileTransaction(message);
const partiallySigned = await partiallySignTransaction([partyA.keyPair], compiled);

// Serialize and send to Party B
const serialized = getBase64EncodedWireTransaction(partiallySigned);
```

### Party B (Co-signer)

```ts
import {
  getTransactionDecoder,
  getBase64Decoder,
  partiallySignTransaction,
  assertIsFullySignedTransaction,
  assertIsTransactionWithDurableNonceLifetime,
  assertIsTransactionWithinSizeLimit,
} from '@solana/kit';

// Deserialize
const decoder = getTransactionDecoder();
const transaction = decoder.decode(getBase64Decoder().decode(serialized));

// Add signature
const fullySigned = await partiallySignTransaction([partyB.keyPair], transaction);
assertIsFullySignedTransaction(fullySigned);

// IMPORTANT: After deserialization, lifetimeConstraint metadata is lost.
// You must re-attach it for type assertions to pass.
const fullySignedWithLifetime = {
  ...fullySigned,
  lifetimeConstraint: {
    nonce: nonceValue,
    nonceAccountAddress: nonceKeypair.address,
    nonceAuthorityAddress: partyA.address,
  },
};

// Send
assertIsTransactionWithDurableNonceLifetime(fullySignedWithLifetime);
assertIsTransactionWithinSizeLimit(fullySignedWithLifetime);
await sendAndConfirmDurableNonce(fullySignedWithLifetime, { commitment: 'confirmed' });
```

**Note:** In real multi-party flows, pass the `lifetimeConstraint` metadata alongside the serialized transaction (e.g., as JSON).

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "nonce has already been used" | Nonce was advanced | Fetch fresh nonce value |
| "missing signature" | Not all required signers signed | Use `assertIsFullySignedTransaction` to verify |
| Type error on send | Missing lifetime assertion | Add `assertIsTransactionWithDurableNonceLifetime` |
| `assertIsTransactionWithDurableNonceLifetime` fails after deserialize | `lifetimeConstraint` lost during serialization | Re-attach lifetime metadata manually |
| Type error: missing `TransactionWithinSizeLimit` | Size assertion required | Add `assertIsTransactionWithinSizeLimit` |
