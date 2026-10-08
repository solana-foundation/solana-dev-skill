---
title: Mosaic (Token-2022 Issuance Templates)
description: Mosaic SDK — Token-2022 templates for stablecoins, tokenized securities, arcade tokens and money-market funds, sRFC-37 allowlist/blocklist compliance, Kit-version caveats, and when to hand-roll with @solana-program/token-2022 instead.
---

# Mosaic

Mosaic is a Solana Foundation TypeScript SDK (`@solana/mosaic-sdk`) for issuing and managing Token-2022 mints from opinionated templates. It wires each template's extension set and authorities consistently, and adds allowlist/blocklist compliance through sRFC-37 Token ACL. It also ships a CLI (`@solana/mosaic-cli`) and a Next.js dashboard.


## When to use Mosaic vs hand-rolling

Use Mosaic when the user wants a **regulated or permissioned token**: a stablecoin, tokenized security, money-market fund, or an allowlisted points/arcade token. Use it especially when they need sRFC-37 allowlist/blocklist freeze/thaw, which is otherwise a lot of wiring.

Hand-roll with `token2022Program()` from `@solana-program/token-2022` ([kit/programs/token-2022.md](kit/programs/token-2022.md)) for plain mints, single-extension tokens (transfer fee, metadata, non-transferable), or anything that must stay on the skill's Kit 8 + transaction v1 defaults.

## Templates

| Template function | Token-2022 extensions | Access control |
|---|---|---|
| `createStablecoinInitTransaction` | Metadata, Pausable, DefaultAccountState, ConfidentialTransferMint, PermanentDelegate | Allowlist or blocklist (default `'blocklist'`) |
| `createArcadeTokenInitTransaction` | Metadata, Pausable, DefaultAccountState, PermanentDelegate | Always allowlist |
| `createTokenizedSecurityInitTransaction` | Stablecoin set + PermissionedBurn + ScaledUiAmount | `aclMode` option |
| `createMmfInitTransaction` | Metadata, Pausable, DefaultAccountState (frozen), PermanentDelegate, TransferHook, optional confidential balances | `aclMode` option |
| `createCustomTokenInitTransaction` | Flag-driven (`enableMetadata`, `enablePausable`, `enableTransferFee`, …) | `aclMode` option |

All builders take a Kit 6 `rpc` and return a `FullTransaction`, an unsigned v0 message with fee payer and blockhash set. The caller signs and sends it. Authority and payer arguments accept `Address | TransactionSigner`. A bare `Address` becomes a noop signer, which suits wallet, custody and multisig flows.

## Compliance model (sRFC-37)

- **Token ACL** (`TACLkU6CiCdkQN2MjoyDkVg2yAH9zkxiHDsiztQ52TP`) takes over the mint's freeze authority and allows *permissionless thaw* when a gating program approves.
- **ABL gating program** (`GATEzzqxhJnsWF6vHRsgtixxSB8PaQdcqGEVTEHWiULz`) holds the allow or block list. It is a PDA keyed by `(authority, mint)`.
- **Blocklist mints (with `enableSrfc37: true`):** new token accounts start initialized, and only listed wallets get frozen.
- **Allowlist mints (with `enableSrfc37: true`):** new token accounts start frozen, and list membership thaws them.
- Manage lists with `createAddToBlocklistTransaction` / `createRemoveFromBlocklistTransaction` and `createAddToAllowlistTransaction` / `createRemoveFromAllowlistTransaction`. Each takes `(rpc, mint, account, authority)`.
- Other controls: `createPauseTransaction` / `createResumeTransaction`, `createForceTransferTransaction` / `createForceBurnTransaction` (permanent delegate), `getUpdateAuthorityTransaction`, and `inspectToken` (detects which template a mint matches; published 0.2.0 misreports tokenized-security and MMF mints as stablecoin or arcade).

## Gotchas

- **sRFC-37 is off by default.** Templates only set up Token ACL and the ABL list when `enableSrfc37` is `true` (the 14th positional argument of `createStablecoinInitTransaction`). Without it, the list helpers fall back to plain freeze/thaw by the freeze authority, and no on-chain list exists. Some README text says otherwise; the source is authoritative.
- **On the sRFC-37 path the freeze authority is forced to the mint authority.** A mismatched setup shows up later as `AccountFrozen` (`0x11`) on the first mint.
- **List changes must be signed by the authority that created the list.** The list PDA is derived from that authority.
- **`createMintToTransaction` takes a decimal amount** (e.g. `10.5`) and converts it with the mint's decimals, despite its docblock saying "raw amount".
- **Mint init plus sRFC-37 setup (plus confidential balances) can exceed the transaction size limit.** Create the mint with `enableSrfc37: false`, then run the Token ACL setup in a second transaction.
- **`createStablecoinInitTransaction` has 16 positional parameters.** Bind arguments to named locals to avoid misordering them.
- **The SDK pulls in WASM.** `@solana-program/token-2022` 0.10 imports `@solana/zk-sdk`, so importing the SDK (root or `@solana/mosaic-sdk/confidential`, where the confidential helpers live) can fail under plain Node ESM with `ERR_UNKNOWN_FILE_EXTENSION ".wasm"`, depending on the Node version. Bundlers handle it.

## Full documentation

Mosaic is not in the solana.com docs. The repo READMEs are canonical for API names, but where they disagree with source on behavior, the source wins.

| Topic | URL |
|---|---|
| Overview, templates | https://github.com/solana-foundation/mosaic |
| SDK README | https://github.com/solana-foundation/mosaic/blob/main/packages/sdk/README.md |
| SDK changelog (breaking changes, dependency pins) | https://github.com/solana-foundation/mosaic/blob/main/packages/sdk/CHANGELOG.md |
| CLI README | https://github.com/solana-foundation/mosaic/blob/main/packages/cli/README.md |
| sRFC-37 (Token ACL) | https://github.com/solana-foundation/SRFCs/discussions/2 |
| Token extensions guide | https://solana.com/docs/tokens/extensions |
