# Changelog

Versions track the `metadata.version` field in `skills/solana-dev/SKILL.md`. Earlier releases predate this file; see the git history.

## 2.7.0 — 2026-10-08

New references for three Solana tools, each scoped to when to use it, how it fits the Kit 8 / transaction v1 defaults, the verified happy path, and gotchas, with links to the Markdown versions of the solana.com docs for everything else.

- kora.md: Kora paymaster.
- keychain.md: Solana Keychain 2.0 for backend signers.
- mosaic.md: Mosaic SDK 0.2.0. Template-to-extension table, sRFC-37 Token ACL and ABL model, and caveats: Kit 6, v0 only, sRFC-37 off by default.
- SKILL.md: new "Solana Foundation tools" routing table, a Keychain line in the signer defaults, and description triggers for gasless transactions, server-side signing and stablecoin issuance.


## 2.6.0 — 2026-10-07

Anchor 1.2.1 is now the recommended version, and Anchor links point at its new home, `otter-sec/anchor`.

- compatibility-matrix.md: 1.2.x rows (Solana CLI 4.1.2 and Surfpool 1.5.0 in Anchor CI, MSRV 1.89, Node ≥20.18); 1.1.x kept as the previous line. The 1.2.1 `solana-v4` cargo feature for the 4.x `solana-*` crates is documented; `solana-v3` stays the default and the two are mutually exclusive.
- compatibility-matrix.md and transactions-v1.md: `@anchor-lang/core` 0.32.2 and 0.31.2 read v1 transactions through web3.js 1.99.0 and are published only under that name; 1.x through 1.2.1 do not read v1 yet.
- programs/anchor.md: new "Anchor 1.1 → 1.2" notes (stricter discriminator and `LazyAccount` checks, `is_signer` in generated metas, `anchor build --arch` / `--tools-version`, new `anchor-spl` helpers).
- Install and build-from-source commands use `github.com/otter-sec/anchor` and the v1.2.1, v0.32.2 and v0.31.2 tags (common-errors.md, compatibility-matrix.md, programs/anchor.md, anchor/migrating-v0.32-to-v1.md, resources.md).

## 2.5.1 — 2026-10-02

- transactions-v1.md and compatibility-matrix.md: `solana-go` v1 support shipped in v2.0.0.
- transactions-v1.md: the plugin-client executor margins the measured compute unit limit but writes the loaded accounts data size exactly as simulated.

## 2.5.0 — 2026-09-18

Transaction v1 is now the default transaction version, built through plugin clients.

- SKILL.md: `transactionConfig: { version: 1 }` on the RPC plugin is the recommended way to send; manual `pipe()` is the low-level alternative. Removed the claim that `rpcTransactionPlanner` rejects `version: 1` (fixed in `@solana/kit-plugin-rpc` 0.19.0).
- transactions-v1.md: dropped the pre-release banner (mainnet activation 2026-09-15, Agave 4.2.2). New "Sending v1 through plugin clients" and "Wallets" sections; the manual `pipe()` example is secondary. Library table updated for kit 8.3, kit-plugin-rpc 0.19, kit-plugin-litesvm 0.19, kit-plugin-wallet 0.20, web3.js 3.0.0-rc.3 and 1.99.0.
- Wallets: document `connected.supportedTransactionVersions.has(1)` from `@solana/kit-plugin-wallet` 0.20 (frontend.md, kit/plugins.md, kit/react.md).
- New v1 examples use Kit's resource estimators by default. Fixed limits remain documented for measured overrides, deliberate caps, and test fixtures. Legacy/v0 remain only as historical or wallet-fallback paths.
- compatibility-matrix.md: Agave 4.2.x row, `solana-*` 4.x crates for clients, v1 minimum-version table refreshed.
- kit/gotchas.md and common-errors.md: replaced the "planner throws on v1" entries with the plugin-rpc upgrade fix, the v0-by-default gotcha, the `microLamportsPerComputeUnit` vs `priorityFeeLamports` type error, and the wallet-rejects-v1 error.
