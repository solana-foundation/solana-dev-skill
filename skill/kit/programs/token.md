# SPL Token Program

Program address: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

```ts
import { TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
```

## Account Types

### Mint (82 bytes)

```ts
import { fetchMint, fetchMaybeMint, getMintSize } from '@solana-program/token';

const mint = await fetchMint(rpc, mintAddress);
// mint.data.decimals, mint.data.supply, mint.data.mintAuthority, mint.data.freezeAuthority
```

### Token Account (165 bytes)

```ts
import { fetchToken, fetchMaybeToken, getTokenSize } from '@solana-program/token';

const token = await fetchToken(rpc, tokenAddress);
// token.data.mint, token.data.owner, token.data.amount
```

### Multisig

```ts
import { fetchMultisig } from '@solana-program/token';

const multisig = await fetchMultisig(rpc, multisigAddress);
// multisig.data.m, multisig.data.n, multisig.data.signers
```

## PDA: Associated Token Account

```ts
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';

const [ata] = await findAssociatedTokenPda({
  owner: walletAddress,
  mint: mintAddress,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
```

## Key Instructions

### Initialize Mint

```ts
import { getInitializeMintInstruction } from '@solana-program/token';

const ix = getInitializeMintInstruction({
  mint: mintKeypair.address,
  decimals: 9,
  mintAuthority: authority.address,
  freezeAuthority: authority.address, // optional
});
```

### Transfer

```ts
import { getTransferInstruction, getTransferCheckedInstruction } from '@solana-program/token';

// Simple transfer
const ix = getTransferInstruction({
  source: sourceTokenAccount,
  destination: destTokenAccount,
  authority: owner,
  amount: 1_000_000n,
});

// Checked transfer (validates decimals)
const ix = getTransferCheckedInstruction({
  source: sourceTokenAccount,
  mint: mintAddress,
  destination: destTokenAccount,
  authority: owner,
  amount: 1_000_000n,
  decimals: 9,
});
```

### Mint To

```ts
import { getMintToInstruction, getMintToCheckedInstruction } from '@solana-program/token';

const ix = getMintToInstruction({
  mint: mintAddress,
  token: destinationTokenAccount,
  mintAuthority: authority,
  amount: 1_000_000_000n,
});
```

### Approve Delegate

```ts
import { getApproveInstruction } from '@solana-program/token';

const ix = getApproveInstruction({
  source: tokenAccount,
  delegate: delegateAddress,
  owner: owner,
  amount: 500_000n,
});
```

### Burn

```ts
import { getBurnInstruction } from '@solana-program/token';

const ix = getBurnInstruction({
  account: tokenAccount,
  mint: mintAddress,
  authority: owner,
  amount: 100_000n,
});
```

## Instruction Plans

Instruction plans handle multi-step operations (create ATA if needed, etc).

### Create Mint

```ts
import { getCreateMintInstructionPlan } from '@solana-program/token';
import { executeInstructionPlan } from '@solana/instruction-plans';

const plan = getCreateMintInstructionPlan({
  mint: mintKeypair,
  decimals: 9,
  mintAuthority: authority.address,
  payer,
  rpc,
});

await executeInstructionPlan(rpc, plan, { payer });
```

### Mint to ATA (Creates ATA if needed)

```ts
import { getMintToATAInstructionPlan } from '@solana-program/token';

const plan = getMintToATAInstructionPlan({
  mint: mintAddress,
  mintAuthority: authority,
  owner: recipientAddress,
  amount: 1_000_000_000n,
  payer,
  rpc,
});

await executeInstructionPlan(rpc, plan, { payer });
```

## Complete Pattern: Create Token + Mint

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  assertIsTransactionWithBlockhashLifetime, generateKeyPairSigner, lamports,
} from '@solana/kit';
import {
  getInitializeMintInstruction, getMintToInstruction,
  getMintSize, TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda,
  getCreateAssociatedTokenInstruction,
} from '@solana-program/token';
import { getCreateAccountInstruction } from '@solana-program/system';

// 1. Generate mint keypair
const mintKeypair = await generateKeyPairSigner();

// 2. Get rent
const mintRent = await rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())).send();

// 3. Derive ATA
const [ata] = await findAssociatedTokenPda({
  owner: recipient.address,
  mint: mintKeypair.address,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstructions([
    // Create mint account
    getCreateAccountInstruction({
      payer,
      newAccount: mintKeypair,
      lamports: lamports(mintRent),
      space: getMintSize(),
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    // Initialize mint
    getInitializeMintInstruction({
      mint: mintKeypair.address,
      decimals: 9,
      mintAuthority: payer.address,
    }),
    // Create ATA
    getCreateAssociatedTokenInstruction({
      payer,
      ata,
      owner: recipient.address,
      mint: mintKeypair.address,
    }),
    // Mint tokens
    getMintToInstruction({
      mint: mintKeypair.address,
      token: ata,
      mintAuthority: payer,
      amount: 1_000_000_000n,
    }),
  ], m),
);

const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```
