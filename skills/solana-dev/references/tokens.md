---
title: Tokens
description: How tokens work on Solana — SPL Token vs Token-2022, mints and token accounts, ATAs, authorities, delegation and checked instructions, then how Token-2022 extensions are laid out, initialized and controlled.
---

# Tokens

How the two token programs model tokens, and what Token-2022 extensions change. This page covers concepts only. For instruction code, see [Related pages](#related-pages).

## Tokens on Solana

### Two programs

| Program | Address |
|---|---|
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| Token-2022 (Token Extensions) | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |

Token-2022 is a separate program, not an upgrade to SPL Token. It keeps SPL Token's base instructions and account layouts and adds extensions on top. A mint belongs to exactly one of the two programs, and every token account for that mint belongs to the same one.

To find out which, read the mint account's program owner. Use that program for every instruction involving the mint and for deriving its ATAs. Because the base layouts match, a Token-2022 decoder also reads SPL Token mints and accounts. Decoding doesn't check the owner, though, so check it yourself before trusting the data.

### Mints and token accounts

A **mint** defines a token: supply, decimals, mint authority and freeze authority. A **token account** holds one owner's balance of one mint: mint, owner, amount, delegate and delegated amount, state (initialized or frozen) and close authority.

The token program owns both kinds of account. A token account's `owner` field is the wallet or PDA that controls the balance, which is different from the account's program owner (always the token program). A wallet can own any number of token accounts for the same mint. Its balance is the sum across all of them, not just its ATA.

SPL Token accounts have fixed sizes: mint 82 bytes, token account 165, multisig 355. Token-2022 accounts without extensions are the same size. With extensions they are larger, and the size depends on which extensions they have (see [Account layout and sizing](#account-layout-and-sizing)).

### Associated token accounts

An associated token account (ATA) is the default token account for a wallet and mint. It's a PDA of the Associated Token Account program (`ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`) with seeds `[wallet, token program, mint]`.

- **The token program is a seed.** The same wallet and mint give a different ATA under each program. Deriving with the wrong program gives an address with no account behind it.
- **Anyone can create it.** Any payer can create a wallet's ATA, and the wallet doesn't sign. `CreateIdempotent` does nothing if the ATA already exists with that wallet as owner, so use it whenever the ATA might already be there. It fails if the ATA's owner was reassigned.
- **Owner immutability differs by program.** On Token-2022, the ATA program adds `ImmutableOwner`, so the owner can never change. SPL Token has no such guard, and an ATA's owner can be reassigned with `SetAuthority`. Read the `owner` field instead of assuming it matches the derivation.

### Authorities

| Authority | Lives on | Can | Once set to none |
|---|---|---|---|
| Mint authority | Mint | `MintTo` | No more minting, ever. Burns still lower supply |
| Freeze authority | Mint | `FreezeAccount` / `ThawAccount` on any token account of the mint | Nothing more can be frozen or thawed |
| Owner | Token account | Transfer, burn, approve and revoke a delegate, and set a new owner. While no close authority is set, also close the account or appoint a close authority | Can't be removed, only transferred |
| Close authority | Token account | `CloseAccount` once the balance is zero, sending the rent lamports to a destination of its choice | Falls back to the owner, who can appoint a new one |

Token-2022 extensions add more authorities; see the [extension reference](#extension-reference).

- `SetAuthority` changes or removes an authority, and the current holder signs it. Once a mint-level authority is set to none, nobody can sign to restore it, so the removal is permanent. The token account close authority is the exception noted above.
- An authority can be a keypair, a PDA (its program signs by CPI), or a token program `Multisig` account (m-of-n, up to 11 signers). A few Token-2022 roles must sign directly, so a `Multisig` can't fill them: the `TokenMetadata` and `TokenGroup` update authorities, the permissioned-burn authority, and the mint authority when it initializes metadata or group data.
- A frozen token account can't send, receive, burn, approve or revoke a delegate, or change authorities. It can still be closed once its balance is zero.

### Delegation

The owner signs `Approve` (or `ApproveChecked`) to let one other address spend from a token account, up to an amount.

- The delegate can transfer or burn up to the approved amount. Each use lowers `delegated_amount`, and the delegate is cleared when it reaches zero.
- A token account has at most one delegate. A new `Approve` replaces the previous delegate and amount.
- The owner can `Revoke` at any time. Token-2022 also lets the delegate revoke itself. On SPL Token, don't rely on that: the original program only accepts the owner, though p-token (its Pinocchio rewrite) also accepts the delegate.
- Transferring ownership of the account clears its delegate.

A Token-2022 mint can also have a mint-wide [permanent delegate](#permanent-delegate).

### Checked instructions

`TransferChecked`, `ApproveChecked`, `MintToChecked` and `BurnChecked` also take the mint's decimals, and the transfer and approve variants take the mint account too. The program rejects a wrong mint (`MintMismatch`) or wrong decimals (`MintDecimalsMismatch`). A client that misreads decimals then fails instead of moving the wrong amount. Use the checked variants by default. On Token-2022, plain `Transfer` fails outright for many mints; see [Plain `Transfer` on Token-2022](#plain-transfer-on-token-2022).

## Token-2022 extensions

### Account layout and sizing

A Token-2022 mint or token account with extensions is laid out as:

1. The base layout. A mint is zero-padded to 165 bytes, so mints and token accounts share the next offset.
2. One account-type byte at offset 165 (`1` for a mint, `2` for a token account).
3. The extensions as TLV entries: a 2-byte type, a 2-byte length, then the value.

Account size therefore depends on the extension set. Compute it with `getMintSize` / `getTokenSize` from `@solana-program/token-2022` or `ExtensionType::try_calculate_account_len` in Rust. The Rust helper only takes fixed-size extensions, so add the `TokenMetadata` entry's size yourself. For a token account of an existing mint, the `GetAccountDataSize` instruction also works. Derive rent from the computed size instead of hardcoding either one. An account whose size would come out at exactly 355 bytes gets 2 bytes of padding, so it can never be mistaken for a multisig.

### Mint vs account extensions

Each extension lives either on the mint or on a token account. The [extension reference](#extension-reference) says which.

**Mint extensions are fixed when the mint is created.** Each mint extension's initialize instruction only runs on an uninitialized mint, and `Reallocate` only adds account extensions. Nothing can be added to a mint's extension set after `InitializeMint`. The exceptions are `TokenMetadata`, `TokenGroup` and `TokenGroupMember`. They're written into an already-initialized mint, need the mint authority's signature, and need their pointer extension already on the mint. Once the mint authority is gone, they can't be added either. Values and authorities inside extensions can still change where the reference says so.

**Account extensions are added in one of three ways:**

- **By `InitializeAccount`, based on the mint.** `TransferFeeConfig` adds `TransferFeeAmount`, `TransferHook` adds `TransferHookAccount`, `Pausable` adds `PausableAccount`, and `NonTransferable` adds `NonTransferableAccount` and `ImmutableOwner`. The account must be created with room for them. The ATA program sizes this for you.
- **By the creator, before `InitializeAccount`.** This is `ImmutableOwner` (see [Associated token accounts](#associated-token-accounts)).
- **By the owner, later.** `MemoTransfer` and `CpiGuard` can each be switched on and off. `ConfidentialTransferAccount` is added by `ConfigureAccount`, which also adds `ConfidentialTransferFeeAmount` on mints with confidential transfer fees. If the account has no room, call `Reallocate` first. The owner signs it and a payer covers the extra rent.

### Initialization order

To create a mint with extensions:

1. **`CreateAccount`, sized for exactly the extensions initialized before `InitializeMint`.** A larger account makes `InitializeMint` fail with `InvalidAccountData`. If you'll add metadata or group data in step 4, fund the account for its final size now. Those instructions grow the account but don't add lamports.
2. **Each mint extension's initialize instruction**, including `MetadataPointer`, `GroupPointer` and `GroupMemberPointer`.
3. **`InitializeMint` / `InitializeMint2`.** This is also where invalid extension combinations are rejected (listed below).
4. **`TokenMetadata` `Initialize`, `TokenGroup` `InitializeGroup` or `TokenGroupMember` `InitializeMember`, in any order.** Token-2022 stores this data inside the mint itself, so point each pointer at the mint.

Keep steps 1–3 in one transaction. `InitializeMint` doesn't require the mint account's signature, so anyone can initialize an account that was created but left uninitialized.

`InitializeMint` fails with `InvalidExtensionCombination` when the mint has:

- `TransferFeeConfig` and `ConfidentialTransferMint` without `ConfidentialTransferFeeConfig`, or `ConfidentialTransferFeeConfig` without both of them
- `ConfidentialMintBurn` without `ConfidentialTransferMint`
- `NonTransferable` and `ConfidentialTransferMint` without `ConfidentialMintBurn`
- `ScaledUiAmount` and `InterestBearingConfig` together

It also fails with `MintCannotFreeze` when `DefaultAccountState` is `Frozen` and the mint has no freeze authority.

### Notable behaviors

#### Permanent delegate

`PermanentDelegate` names one address that can transfer or burn any amount from every token account of the mint, including accounts created later. It needs no approval and no signature from the owner. Other checks still apply to it:

- A frozen account can't be debited.
- A paused mint blocks its transfers and burns.
- On a mint with an active `PermissionedBurn` authority, its burns also need that authority's signature.
- On a `NonTransferable` mint, it can burn but not transfer.
- It can't touch confidential (encrypted) balances.

| | Standard delegate | Permanent delegate |
|---|---|---|
| Program | SPL Token and Token-2022 | Token-2022 only |
| Set by | Token account owner, with `Approve` | Mint creator, when the mint is created |
| Scope | One token account | Every token account of the mint |
| Amount | Up to the approved amount | Unlimited |
| Ends when | Revoked, used up, replaced, or the account changes owner | It hands the role off or removes itself |

A permanent delegate means the issuer can move or burn any holder's public balance at any time. Check for it before treating a token as user-controlled, for example as collateral. For program-side risks, see [security.md](security.md#permanent-delegate-authority).

#### Plain `Transfer` on Token-2022

- It's deprecated in favor of `TransferChecked` and `TransferCheckedWithFee`.
- It fails with `MintRequiredForTransfer` when the source account has `TransferFeeAmount`, `TransferHookAccount` or `PausableAccount`. Every token account of a mint with `TransferFeeConfig`, `TransferHook` or `Pausable` has one of these.
- It doesn't recognize a permanent delegate.

Two more requirements come with checked transfers. `TransferCheckedWithFee` also asserts the fee the caller expects, and fails with `FeeMismatch` if it's different. On a mint with a transfer hook, the caller must also pass the hook program, its validation account, and the extra accounts that validation account lists.

#### Closing and reopening a mint

With `MintCloseAuthority`, a mint whose supply is zero can be closed, which frees its address. Whoever controls that address can then create a new mint there with different extensions, while token accounts from the old mint still exist. See [security.md](security.md#mint-close-and-reinitialization-attacks).

### Extension reference

| Extension | On | When set; what changes later | Authority | Effect |
|---|---|---|---|---|
| `TransferFeeConfig` | Mint | At creation. The fee can change, and a new fee takes effect two epochs later | Transfer-fee config authority sets the fee; withdraw-withheld authority collects it | Every transfer withholds a fee in the recipient's account: a basis-point rate (up to 10,000), capped at `maximum_fee` |
| `MintCloseAuthority` | Mint | At creation. Authority changeable | Mint close authority | Close the mint once supply is zero |
| `PermanentDelegate` | Mint | At creation. Delegate changeable or removable | The delegate | See [Permanent delegate](#permanent-delegate) |
| `DefaultAccountState` | Mint | At creation. State changeable | Freeze authority | New token accounts start `Frozen` or `Initialized`. If the freeze authority is removed while the default is `Frozen`, new accounts start frozen for good |
| `NonTransferable` | Mint | At creation. Permanent | None | Tokens can't be transferred. Minting and burning still work |
| `TransferHook` | Mint | At creation. Program ID changeable | Transfer-hook authority | While a hook program is set, every transfer CPIs into it, and the hook can fail the transfer |
| `InterestBearingConfig` | Mint | At creation. Rate changeable | Rate authority | The UI amount accrues interest. Raw balances don't change |
| `ScaledUiAmount` | Mint | At creation. Multiplier changeable, effective from a set timestamp | Scaled-UI-amount authority | UI amount = raw amount × multiplier (truncated) / 10^decimals. Raw balances don't change |
| `Pausable` | Mint | At creation. Pause and resume at any time | Pause authority | While paused, transfers, mints and burns fail |
| `PermissionedBurn` | Mint | At creation. Authority changeable or removable | Permissioned-burn authority | Burns go through the extension's own burn instructions and need this authority's signature. Standard `Burn` / `BurnChecked` are rejected until the authority is removed |
| `MetadataPointer` | Mint | At creation. Address changeable | Metadata-pointer authority | Records which account holds the token's metadata, usually the mint itself |
| `TokenMetadata` | Mint | After `InitializeMint`. Fields changeable | Update authority | Name, symbol, URI and extra key-value fields, stored in the mint (variable length). Lengthening a field grows the account, so add lamports for the new size first |
| `GroupPointer` | Mint | At creation. Address changeable | Group-pointer authority | Records which account holds the group configuration |
| `TokenGroup` | Mint | After `InitializeMint`. Max size and authority changeable | Group update authority | Makes the mint a group, such as a collection, with a maximum member count |
| `GroupMemberPointer` | Mint | At creation. Address changeable | Group-member-pointer authority | Records which account holds the membership data |
| `TokenGroupMember` | Mint | After `InitializeMint`. Fixed | None after creation. Creating it needs the member mint's mint authority and the group's update authority | Records the mint's group and member number |
| `ConfidentialTransferMint` | Mint | At creation. Settings changeable | Confidential-transfer mint authority | Encrypted balances and transfer amounts. The authority sets auto-approval and the auditor key, and approves accounts. See [confidential-transfers.md](confidential-transfers.md) |
| `ConfidentialTransferFeeConfig` | Mint | At creation. Authority changeable | Confidential-transfer-fee authority toggles harvesting to the mint; withdrawals use the transfer-fee withdraw-withheld authority | Fees on confidential transfers, withheld as encrypted amounts |
| `ConfidentialMintBurn` | Mint | At creation. Supply key rotatable | Mint authority | Confidential minting and burning. Standard `MintTo` and `Burn` are rejected |
| `ImmutableOwner` | Account | Before `InitializeAccount`. Permanent | None | The account's owner can never change |
| `MemoTransfer` | Account | Switch on or off at any time | Owner | Incoming transfers must be preceded by a memo instruction |
| `CpiGuard` | Account | Switch on or off at any time, but not from a CPI | Owner | Inside a CPI, blocks owner-signed transfers, burns and approvals, setting a close authority, and closes that send the rent anywhere but the owner. While it's on, the owner can't be changed at all |
| `TransferFeeAmount` | Account | Added by `InitializeAccount` | None | Holds fees withheld from incoming transfers |
| `TransferHookAccount` | Account | Added by `InitializeAccount` | None | Flags the account as mid-transfer during the hook CPI, so the hook can check it's being called from a real transfer |
| `NonTransferableAccount` | Account | Added by `InitializeAccount` | None | Marks the account as holding a non-transferable mint |
| `PausableAccount` | Account | Added by `InitializeAccount` | None | Marks the account as holding a pausable mint |
| `ConfidentialTransferAccount` | Account | Configured by the owner after init | Owner, plus approval from the confidential-transfer mint authority unless auto-approve is on | Encrypted pending and available balances |
| `ConfidentialTransferFeeAmount` | Account | Added with `ConfidentialTransferAccount` on fee mints | None | Holds encrypted withheld fees |

`SetAuthority` changes the authorities in this table. The exceptions are the `TokenMetadata` and `TokenGroup` update authorities, which use those interfaces' own `UpdateAuthority` / `UpdateGroupAuthority` instructions. A token account with withheld fees or confidential balances can't be closed until they're cleared; see [security.md](security.md#token-account-closure-conditions).

## Related pages

- [kit/programs/token.md](kit/programs/token.md): SPL Token with Kit (mints, ATAs, transfers, delegation, instruction plans)
- [kit/programs/token-2022.md](kit/programs/token-2022.md): Token-2022 with Kit (account sizing, ATA derivation, fetching extensions)
- [programs/pinocchio.md](programs/pinocchio.md#token-programs): calling the token programs from Pinocchio
- [confidential-transfers.md](confidential-transfers.md): implementing confidential transfers
- [mosaic.md](mosaic.md): Token-2022 issuance templates for stablecoins and other regulated tokens
- [security.md](security.md#token-2022-extension-security): program-side Token-2022 pitfalls
