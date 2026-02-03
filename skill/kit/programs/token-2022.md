# Token-2022 (Token Extensions)

Program address: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

```ts
import { TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';
```

Token-2022 extends the base Token program with configurable extensions.

## When to Use Token-2022 vs Token

| Use Token-2022 | Use Token |
|----------------|-----------|
| Transfer fees needed | Simple fungible tokens |
| On-chain metadata | Maximum compatibility |
| Confidential transfers | Lowest compute cost |
| Transfer hooks | Existing ecosystem integration |
| Interest-bearing tokens | |
| Non-transferable tokens | |

## Extension Types

| Extension | Purpose |
|-----------|---------|
| `TransferFee` | Automatic fee collection on transfers |
| `Metadata` | On-chain token metadata (name, symbol, URI) |
| `MetadataPointer` | Points to metadata account |
| `ConfidentialTransfer` | Zero-knowledge encrypted balances |
| `TransferHook` | Custom program invoked on transfer |
| `PermanentDelegate` | Irrevocable delegate authority |
| `InterestBearing` | Automatic interest accrual |
| `NonTransferable` | Soulbound tokens |
| `DefaultAccountState` | Accounts frozen by default |
| `MintCloseAuthority` | Allow closing mint accounts |
| `GroupPointer` / `GroupMemberPointer` | Token groups |

## Variable Account Sizes

Unlike base Token, account sizes depend on extensions:

```ts
import { getMintSize, getTokenSize } from '@solana-program/token-2022';

// Without extensions
const baseSize = getMintSize(); // 82 bytes

// With extensions - pass extension configs
const sizeWithExtensions = getMintSize([
  { extension: 'TransferFeeConfig', ... },
  { extension: 'MetadataPointer', ... },
]);
```

## Account Fetching

Same patterns as base Token:

```ts
import { fetchMint, fetchToken } from '@solana-program/token-2022';

const mint = await fetchMint(rpc, mintAddress);
// Access extensions via mint.data.extensions
```

## Key Instructions

### Initialize with Transfer Fee

```ts
import {
  getInitializeMintInstruction,
  getInitializeTransferFeeConfigInstruction,
} from '@solana-program/token-2022';

// Must initialize extension BEFORE mint
const instructions = [
  getInitializeTransferFeeConfigInstruction({
    mint: mintKeypair.address,
    transferFeeConfigAuthority: authority.address,
    withdrawWithheldAuthority: authority.address,
    transferFeeBasisPoints: 100, // 1%
    maximumFee: 1_000_000_000n,
  }),
  getInitializeMintInstruction({
    mint: mintKeypair.address,
    decimals: 9,
    mintAuthority: authority.address,
  }),
];
```

### Initialize with Metadata

```ts
import {
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
} from '@solana-program/token-2022';
import { getInitializeInstruction as getInitializeMetadataInstruction } from '@solana-program/token-metadata';

// 1. Initialize metadata pointer (points mint to itself)
// 2. Initialize mint
// 3. Initialize metadata

const instructions = [
  getInitializeMetadataPointerInstruction({
    mint: mintKeypair.address,
    authority: authority.address,
    metadataAddress: mintKeypair.address, // Self-referential
  }),
  getInitializeMintInstruction({
    mint: mintKeypair.address,
    decimals: 9,
    mintAuthority: authority.address,
  }),
  getInitializeMetadataInstruction({
    mint: mintKeypair.address,
    metadata: mintKeypair.address,
    mintAuthority: authority,
    name: 'My Token',
    symbol: 'MTK',
    uri: 'https://example.com/metadata.json',
    updateAuthority: authority.address,
  }),
];
```

### Transfer (Same as Base Token)

```ts
import { getTransferCheckedInstruction } from '@solana-program/token-2022';

// Transfer fees are automatically deducted
const ix = getTransferCheckedInstruction({
  source: sourceTokenAccount,
  mint: mintAddress,
  destination: destTokenAccount,
  authority: owner,
  amount: 1_000_000n,
  decimals: 9,
});
```

### Harvest Withheld Fees

```ts
import { getHarvestWithheldTokensToMintInstruction } from '@solana-program/token-2022';

// Collect fees from token accounts back to mint
const ix = getHarvestWithheldTokensToMintInstruction({
  mint: mintAddress,
  sources: [tokenAccount1, tokenAccount2],
});
```

### Withdraw Withheld Fees

```ts
import { getWithdrawWithheldTokensFromMintInstruction } from '@solana-program/token-2022';

const ix = getWithdrawWithheldTokensFromMintInstruction({
  mint: mintAddress,
  destination: feeCollectorTokenAccount,
  withdrawWithheldAuthority: authority,
});
```

## Complete Pattern: Create Token with Transfer Fee

```ts
import {
  pipe, createTransactionMessage, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions,
  signTransactionMessageWithSigners, sendAndConfirmTransactionFactory,
  assertIsTransactionWithBlockhashLifetime, generateKeyPairSigner, lamports,
} from '@solana/kit';
import {
  getInitializeMintInstruction,
  getInitializeTransferFeeConfigInstruction,
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS,
} from '@solana-program/token-2022';
import { getCreateAccountInstruction } from '@solana-program/system';

// Calculate size with transfer fee extension
const mintSize = getMintSize([
  { extension: 'TransferFeeConfig' },
]);

const mintKeypair = await generateKeyPairSigner();
const mintRent = await rpc.getMinimumBalanceForRentExemption(BigInt(mintSize)).send();

const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

const message = pipe(
  createTransactionMessage({ version: 0 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstructions([
    getCreateAccountInstruction({
      payer,
      newAccount: mintKeypair,
      lamports: lamports(mintRent),
      space: mintSize,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    }),
    // Initialize extension FIRST
    getInitializeTransferFeeConfigInstruction({
      mint: mintKeypair.address,
      transferFeeConfigAuthority: payer.address,
      withdrawWithheldAuthority: payer.address,
      transferFeeBasisPoints: 50, // 0.5%
      maximumFee: 5_000_000_000n,
    }),
    // Then initialize mint
    getInitializeMintInstruction({
      mint: mintKeypair.address,
      decimals: 9,
      mintAuthority: payer.address,
    }),
  ], m),
);

const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
const signed = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(signed);
await sendAndConfirm(signed, { commitment: 'confirmed' });
```

## ATA for Token-2022

```ts
import { findAssociatedTokenPda } from '@solana-program/token-2022';

const [ata] = await findAssociatedTokenPda({
  owner: walletAddress,
  mint: mintAddress,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS, // Use Token-2022 program
});
```
