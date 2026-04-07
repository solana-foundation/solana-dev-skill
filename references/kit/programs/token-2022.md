---
title: Token-2022 (Token Extensions)
description: Kit-compatible @solana-program/token-2022 client — key differences from base Token program, account sizing, ATA derivation, and extension reference.
---

# Token-2022 (Token Extensions)

Program address: `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`

```ts
import { TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';
```

Token-2022 extends the base Token program with configurable extensions. For a full guide to available extensions and their use cases, see the [Token Extensions documentation](https://solana.com/docs/tokens/extensions).

## When to Use Token-2022 vs Token

| Use Token-2022 | Use Token |
|----------------|-----------|
| Transfer fees needed | Simple fungible tokens |
| On-chain metadata | Maximum compatibility |
| Confidential transfers | Lowest compute cost |
| Transfer hooks | Existing ecosystem integration |
| Interest-bearing tokens | |
| Non-transferable tokens | |

## Key Differences from Base Token

### Variable Account Sizes

Unlike base Token (fixed 82/165 byte accounts), Token-2022 sizes vary by extension. Calculate before creating or rent allocation fails:

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

### ATA Derivation

Same pattern as base Token, but you **must** pass `TOKEN_2022_PROGRAM_ADDRESS` — using the wrong program address derives the wrong ATA.

```ts
import { findAssociatedTokenPda, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';

const [ata] = await findAssociatedTokenPda({
  owner: walletAddress,
  mint: mintAddress,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
});
```

### Extension Initialization Order

Extension instructions must come **before** mint initialization — the runtime processes them in order and mint init finalizes the account.

### Account Fetching

Same patterns as base Token — extensions are accessible via `mint.data.extensions`:

```ts
import { fetchMint, fetchToken } from '@solana-program/token-2022';

const mint = await fetchMint(rpc, mintAddress);
// Access extensions via mint.data.extensions
```

## Extensions Reference

See [Token Extensions documentation](https://solana.com/docs/tokens/extensions) for implementation details on each extension.
