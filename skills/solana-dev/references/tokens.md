---
title: Tokens
description: How Solana tokens are modelled — mints, token accounts, ATAs and authorities, standard vs permanent delegation, SPL Token vs Token-2022, and how Token-2022 extensions are laid out, initialized and controlled.
---

# Tokens

Concepts shared by both token programs. For instruction-level code, see [Related pages](#related-pages).

## Contents

- [The token model](#the-token-model)
- [Delegation](#delegation)
- [Token vs Token-2022](#token-vs-token-2022)
- [How extensions work](#how-extensions-work)
- [Related pages](#related-pages)

## The token model

A **mint** describes one token: supply, decimals, and its mint and freeze authorities. A **token account** holds a balance of one mint for one owner: mint, owner, amount, delegate, state (initialized or frozen) and close authority. Balances never sit in a wallet's system account; a wallet can hold one or more token accounts per mint, and only one of them is its ATA.

Both are accounts owned by the token program. The `owner` *field* of a token account is the wallet or PDA that controls the balance. It is not the account's program owner, which is always the token program.

### Associated token accounts

An associated token account (ATA) is the canonical token account for a wallet and mint: a PDA of the Associated Token Account program (`ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL`) with seeds `[wallet, token program, mint]`. Anyone can derive it, and anyone can pay to create it; the wallet does not sign. `CreateIdempotent` succeeds without changes if the ATA already exists.

The ATA program creates Token-2022 ATAs with `ImmutableOwner`, so their owner can never change. SPL Token has no such guard: an ATA's owner can be reassigned with `SetAuthority`, so read the `owner` field instead of inferring it from the address.

### Authorities

| Authority | Lives on | What it can do | Once set to none |
|---|---|---|---|
| Mint authority | Mint | `MintTo` new supply. On Token-2022, it also signs `TokenMetadata` and `TokenGroup` initialization | No more tokens can be minted; burns can still reduce supply |
| Freeze authority | Mint | `FreezeAccount` / `ThawAccount` on any account of the mint. On Token-2022, it also updates `DefaultAccountState` | Nothing can be frozen, and frozen accounts can never be thawed |
| Owner | Token account | Transfer, burn, approve and revoke a delegate, close (when no close authority is set), and transfer ownership | Cannot be removed, only transferred |
| Close authority | Token account | `CloseAccount` once the balance is zero, reclaiming the rent lamports. Defaults to the owner when unset | The owner closes, and can appoint a new close authority |
| Mint close authority | Mint (Token-2022 `MintCloseAuthority`) | Close the mint once supply is zero | The mint cannot be closed |

Each authority is changed or removed with `SetAuthority`, signed by its current holder. Removing a mint's mint, freeze or mint close authority is permanent. Clearing a token account's close authority returns control to the owner, who can appoint another close authority later. An authority can be a keypair, a PDA (a program signs for it) or the token program's own `Multisig` account (m-of-n). Transferring ownership of a token account clears its delegate. A closed Token-2022 mint frees its address, which can then be initialized again with different extensions; see [security.md](security.md#mint-close-and-reinitialization-attacks).

## Delegation

**Standard delegate.** The owner signs `Approve` (or `ApproveChecked`) naming a delegate and an amount. The delegate can transfer or burn up to that amount, each use reduces `delegated_amount`, and the delegate is cleared when it reaches zero. A token account has at most one delegate: a new `Approve` replaces the previous delegate and amount. The owner can `Revoke` at any time; on Token-2022 the delegate can also revoke itself. Transferring ownership of the account clears the delegate too.

**Permanent delegate (Token-2022).** `PermanentDelegate` is set on the mint when it is created. The delegate can transfer or burn any amount from every token account of that mint, including accounts created later, with no approval and no signature from the owner. The program still applies its other checks: a frozen account cannot be debited, a paused mint blocks transfers and burns, and a mint with `PermissionedBurn` also needs that authority's signature to burn. Transfers by the permanent delegate must use `TransferChecked`, because the plain `Transfer` never reads the mint. The current delegate can hand the role to another address or remove it with `SetAuthority`; once removed, it cannot be set again.

| | Standard delegate | Permanent delegate |
|---|---|---|
| Program | SPL Token and Token-2022 | Token-2022 only |
| Set by | Token account owner (`Approve`) | Mint creator, at mint initialization |
| Scope | One token account | Every token account of the mint |
| Amount | Capped at the approved amount, reduced on use | Unlimited |
| Owner signature per use | No (granted up front) | Never needed |
| Ends when | Revoked, used up, replaced, or the account changes owner | The delegate rotates or removes itself |

## Token vs Token-2022

| Program | Address |
|---|---|
| SPL Token | `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` |
| Token-2022 (Token Extensions) | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` |
| Associated Token Account | `ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL` |

Token-2022 is a separate program with the same base instruction set and account layouts, plus extensions. A mint belongs to one program, and so do all of its token accounts.

### Account sizes

SPL Token accounts have fixed sizes: mint 82 bytes, token account 165, multisig 355. A Token-2022 mint or account without extensions is the same size and decodes the same way. With extensions, the account is laid out as:

1. The base layout. A mint is zero-padded to 165 bytes so mints and token accounts share the next offset.
2. One account-type byte at offset 165.
3. Extensions as TLV entries: a 2-byte type, a 2-byte length, then the value.

So Token-2022 sizes vary with the extension set. Compute them with `getMintSize` / `getTokenSize` (or the `GetAccountDataSize` instruction) rather than hardcoding a size or its rent. An account whose length would come out at exactly 355 bytes gets two padding bytes, so it is never confused with a multisig.

### Finding a mint's program

Read the mint account: its program owner is the token program to use for every instruction and ATA derivation involving that mint. Then decode it with the matching client's Codama fetcher.

```ts
import { fetchEncodedAccount } from '@solana/kit';
import { fetchMint as fetchTokenMint, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { fetchMint as fetchToken2022Mint, TOKEN_2022_PROGRAM_ADDRESS } from '@solana-program/token-2022';

const account = await fetchEncodedAccount(rpc, mintAddress);
if (!account.exists) throw new Error('mint not found');

// The owner picks the program, and with it the client
const mint =
  account.programAddress === TOKEN_PROGRAM_ADDRESS ? await fetchTokenMint(rpc, mintAddress)
  : account.programAddress === TOKEN_2022_PROGRAM_ADDRESS ? await fetchToken2022Mint(rpc, mintAddress)
  : null; // not a token mint
// mint.data.decimals, mint.data.supply, mint.data.mintAuthority, mint.data.freezeAuthority
// Token-2022 also has mint.data.extensions
```

`fetchMint` throws when no account exists at the address. When it may not exist (an address from user input, say), use `fetchMaybeMint`, which returns `exists: false` instead:

```ts
import { fetchMaybeMint } from '@solana-program/token-2022';

const maybeMint = await fetchMaybeMint(rpc, mintAddress);
if (maybeMint.exists) {
  // maybeMint.data, maybeMint.programAddress
}
```

The fetchers only decode the data; they don't check which program owns the account, so read `programAddress` as above before trusting the result. To decode an account you already fetched without a second request, use `decodeMint(account)` from the same package. Token accounts have the same set: `fetchToken`, `fetchMaybeToken` and `decodeToken`.

### Why `TransferChecked`

`TransferChecked` also passes the mint account and its decimals, and the program rejects a mismatch, so a wrong-mint or wrong-decimals transfer fails instead of moving the wrong amount. On Token-2022 it is required more often:

- **Plain `Transfer` is deprecated** in favour of `TransferChecked` or `TransferCheckedWithFee`.
- **Some mints reject it outright.** Plain `Transfer` fails with `MintRequiredForTransfer` when the source account carries `TransferFeeAmount`, `TransferHookAccount` or `PausableAccount`, which is every account of a mint with `TransferFeeConfig`, `TransferHook` or `Pausable`.
- **A permanent delegate is only recognised on checked transfers.**
- **Transfer fees:** `TransferCheckedWithFee` also asserts the expected fee.
- **Transfer hooks:** the caller must also pass the extra accounts listed in the hook's validation account.

The same reasoning applies to `MintToChecked`, `BurnChecked` and `ApproveChecked`.

### ATAs depend on the program

The token program address is one of the ATA seeds. The same wallet and mint therefore give different ATA addresses under SPL Token and Token-2022, and deriving with the wrong program gives an address where the account does not exist. Derive with the mint's own program (see [Finding a mint's program](#finding-a-mints-program)).

## How extensions work

### Mint and account extensions

| Mint extensions | Account extensions |
|---|---|
| `TransferFeeConfig`, `MintCloseAuthority`, `PermanentDelegate`, `DefaultAccountState`, `NonTransferable`, `TransferHook`, `InterestBearingConfig`, `ScaledUiAmount`, `Pausable`, `PermissionedBurn`, `MetadataPointer`, `TokenMetadata`, `GroupPointer`, `TokenGroup`, `GroupMemberPointer`, `TokenGroupMember`, `ConfidentialTransferMint`, `ConfidentialTransferFeeConfig`, `ConfidentialMintBurn` | `ImmutableOwner`, `MemoTransfer`, `CpiGuard`, `TransferFeeAmount`, `TransferHookAccount`, `NonTransferableAccount`, `PausableAccount`, `ConfidentialTransferAccount`, `ConfidentialTransferFeeAmount` |

**Mint extensions are chosen at creation.** Every mint extension's initialize instruction requires an uninitialized mint, and `Reallocate` accepts only account extensions, so nothing can be added to a mint after `InitializeMint`. The exceptions are `TokenMetadata`, `TokenGroup` and `TokenGroupMember`, which are written into an initialized mint. That needs the mint authority's signature and the matching pointer extension, so once the mint authority is revoked they can no longer be added. Values and authorities *inside* extensions can still change where the table below says so.

**Account extensions come from three places:**

- **Added automatically by `InitializeAccount`,** from the mint's extensions: `TransferFeeConfig` adds `TransferFeeAmount`, `TransferHook` adds `TransferHookAccount`, `Pausable` adds `PausableAccount`, and `NonTransferable` adds `NonTransferableAccount` and `ImmutableOwner`. The account must be created with room for them; the ATA program sizes this for you.
- **Chosen by the creator before `InitializeAccount`:** `ImmutableOwner` (always set on Token-2022 ATAs).
- **Enabled by the owner later:**
  - `MemoTransfer` and `CpiGuard`, which can be switched on and off.
  - `ConfidentialTransferAccount` via `ConfigureAccount`; on a mint with confidential transfer fees this also adds `ConfidentialTransferFeeAmount`.

  If the account has no room, call `Reallocate` first (the owner signs, a payer funds the extra rent).

### Initialization order

1. **`CreateAccount`** with space for the fixed-size extensions. Fund it with enough lamports for the final size if you will add metadata, because `TokenMetadata` grows the account and expects the rent to be there already.
2. **Each mint extension's initialize instruction**, including `MetadataPointer`, `GroupPointer` and `GroupMemberPointer`.
3. **`InitializeMint` / `InitializeMint2`.**
4. **`TokenMetadata` `Initialize`**, then `TokenGroup` `InitializeGroup` or `TokenGroupMember` `InitializeMember`. Token-2022 stores these inside the mint, and the matching pointer extension must already be on it. Set the pointer's address to the mint so readers can find them.

`InitializeMint` takes no signature from the mint account, so keep steps 1–3 in the same transaction as `CreateAccount`; otherwise someone else can initialize the account first.

### Extension reference

| Extension | Mint or Account | Set at init / changeable later | Controlling authority | What it allows |
|---|---|---|---|---|
| `TransferFeeConfig` | Mint | Init; fee changeable, taking effect two epochs after the change | Transfer-fee config authority (sets the fee); withdraw-withheld authority (collects it) | A fee of up to 10,000 bps, capped at `maximum_fee`, is withheld in the recipient's account on every transfer |
| `MintCloseAuthority` | Mint | Init; authority changeable | Close authority | Close the mint once supply is zero |
| `PermanentDelegate` | Mint | Init; delegate changeable or removable | The delegate itself | Transfer or burn from any account of the mint without the owner (see [Delegation](#delegation)) |
| `DefaultAccountState` | Mint | Init; state changeable | Freeze authority | New token accounts start `Frozen` (or `Initialized`) |
| `NonTransferable` | Mint | Init; permanent | None | Tokens cannot be transferred; minting and burning still work |
| `TransferHook` | Mint | Init; program ID changeable | Transfer-hook authority | While a hook program is set, every transfer CPIs into it, and the hook can reject the transfer |
| `InterestBearingConfig` | Mint | Init; rate changeable | Rate authority | The UI amount accrues interest; raw balances do not change |
| `ScaledUiAmount` | Mint | Init; multiplier changeable, with an effective timestamp | Scaled-UI-amount authority | The UI amount is the raw amount × multiplier (truncated) / 10^decimals; cannot be combined with `InterestBearingConfig` |
| `Pausable` | Mint | Init; pause and resume at any time | Pause authority | While paused, transfers, minting and burning all fail |
| `PermissionedBurn` | Mint | Init; authority changeable or removable | Permissioned-burn authority | Every burn also needs this authority's signature; the standard burn instructions are rejected while it is set |
| `MetadataPointer` | Mint | Init; address changeable | Metadata-pointer authority | Records which account holds the token's metadata (often the mint itself) |
| `TokenMetadata` | Mint | After `InitializeMint`; fields changeable | Update authority | Name, symbol, URI and extra key–value fields stored in the mint (variable length) |
| `GroupPointer` | Mint | Init; address changeable | Group-pointer authority | Records which account holds the group configuration |
| `TokenGroup` | Mint | After `InitializeMint`; max size and authority changeable | Group update authority | Marks the mint as a group (for example a collection) with a maximum member count |
| `GroupMemberPointer` | Mint | Init; address changeable | Group-member-pointer authority | Records which account holds the membership data |
| `TokenGroupMember` | Mint | After `InitializeMint`; fixed | None after creation (needs the member's mint authority and the group's update authority to create) | Records the mint's group and member number |
| `ConfidentialTransferMint` | Mint | Init; settings changeable | Confidential-transfer mint authority | Encrypted balances and amounts; the authority sets auto-approval and the auditor key, and approves accounts. See [confidential-transfers.md](confidential-transfers.md) |
| `ConfidentialTransferFeeConfig` | Mint | Init; authority changeable | Confidential-transfer-fee authority | Encrypted withheld fees; required when `TransferFeeConfig` and `ConfidentialTransferMint` are combined |
| `ConfidentialMintBurn` | Mint | Init; supply key rotatable | Mint authority | Confidential minting and burning; requires `ConfidentialTransferMint` |
| `ImmutableOwner` | Account | Before `InitializeAccount`; permanent | None | The account's owner can never change |
| `MemoTransfer` | Account | Enable or disable at any time | Owner | Incoming transfers must be preceded by a memo instruction |
| `CpiGuard` | Account | Enable or disable at any time, but not from a CPI | Owner | Inside a CPI, blocks owner-signed transfers, burns and approvals, and closes that send the rent anywhere but the owner. While on, the account's owner cannot be changed at all |
| `TransferFeeAmount` | Account | Added by `InitializeAccount` | None | Holds fees withheld from incoming transfers; the account cannot be closed until they are cleared |
| `TransferHookAccount` | Account | Added by `InitializeAccount` | None | Marks the account during a transfer so the hook can check it |
| `NonTransferableAccount` | Account | Added by `InitializeAccount` | None | Marks the account as holding a non-transferable mint |
| `PausableAccount` | Account | Added by `InitializeAccount` | None | Marks the account as holding a pausable mint |
| `ConfidentialTransferAccount` | Account | Configured by the owner after init | Owner; approval from the confidential-transfer mint authority unless auto-approve is on | Encrypted pending and available balances |
| `ConfidentialTransferFeeAmount` | Account | Added with `ConfidentialTransferAccount` on fee mints | None | Encrypted withheld fees; the account cannot be closed until they are cleared |

Every mint-level authority above can be rotated or removed with `SetAuthority` (or the extension's own update-authority instruction), and once removed it cannot be set again. The account owner can only be transferred. Some extension combinations are rejected at initialization, as noted in the table.

## Related pages

- [kit/programs/token.md](kit/programs/token.md): SPL Token instructions with Kit (mints, ATAs, transfers, delegation, instruction plans)
- [kit/programs/token-2022.md](kit/programs/token-2022.md): Token-2022 with Kit (account sizing, ATA derivation, fetching extensions)
- [confidential-transfers.md](confidential-transfers.md): implementing confidential transfers
- [security.md](security.md#token-2022-extension-security): program-side Token-2022 pitfalls (fee accounting, hook validation, mint close and reinitialization, closing token accounts)
