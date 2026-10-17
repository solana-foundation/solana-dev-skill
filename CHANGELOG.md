# Changelog

Versions track the `metadata.version` field in `skills/solana-dev/SKILL.md`. Earlier releases predate this file; see the git history.

## 2.8.0 — Unreleased

New references for three Solana tools, each scoped to when to use it, how it fits the Kit 8 / transaction v1 defaults, the verified happy path, and gotchas, with links to the Markdown versions of the solana.com docs for everything else.

- kora.md: Kora paymaster.
- keychain.md: Solana Keychain 2.0 for backend signers.
- mosaic.md: Mosaic SDK 0.2.0. Template-to-extension table, sRFC-37 Token ACL and ABL model, and caveats: Kit 6, v0 only, sRFC-37 off by default.
- SKILL.md: new "Solana Foundation tools" routing table, a Keychain line in the signer defaults, and description triggers for gasless transactions, server-side signing and stablecoin issuance.
- frontend.md: the wallet send example uses `useSendTransaction` from `@solana/react` 8 in place of a hand-rolled `useAction` wrapper. `useAction` stays documented for other async flows, and `useSendTransactions` is pointed to for sends that may span several transactions.
- testing.md: the LiteSVM plugin section targets `@solana/kit` 8.x.
- payments.md: memos and reference accounts are described as payment correlation, not replay protection, since neither stops a second transfer in a separately signed transaction. A new "Retry and fulfillment boundaries" section covers storing the signature before submitting, rebroadcasting or reconciling before re-signing, and idempotent fulfillment that also requires a successful transaction at the required commitment. Adds Solana Pay, Memo program and transaction structure links.
- resources.md: the Solana Pay link points at `solana.com/docs/tools/solana-pay`.

## 2.7.0 — 2026-10-14

web3.js v3 is out of release candidate, solana-go's v1-transaction support is documented for both module lines, and the Rust toolchain and local-testing references move to Agave 4.3, LiteSVM 0.18, Mollusk 0.16 and Surfpool 1.6.1.

- SKILL.md, kit-web3-interop.md, frontend.md, README.md: web3.js v3 is no longer labeled RC. 3.0.0 shipped on 2026-10-01 and is on npm `next` until 2026-10-19, so install `@solana/web3.js@3` until then. It stays the migration target for v1 codebases, not the default for new work. kit-web3-interop.md summarizes the 3.0 breaking changes that bite most and links the release notes.
- kit-web3-interop.md, resources.md, README.md: links to the deleted `v3.x` branch now point at `main`, covering the repo, the migration guide and the migration skill.
- transactions-v1.md and compatibility-matrix.md: `solana-go` v1 support is in v1.23.0+ (`github.com/gagliardetto/solana-go`) as well as v2.0.0+ (`github.com/solana-foundation/solana-go/v2`). Current releases are v1.25.0 and v2.1.0, both needing Go 1.25+.
- transactions-v1.md and compatibility-matrix.md: current `@solana/kit` is 8.5.0, current `@solana/kit-plugin-wallet` is 0.21.0, and web3.js v3 is at 3.0.2.
- kit/gotchas.md: new entry for `SOLANA_ERROR__KEYS__VERIFICATION_REQUIRES_EXTRACTABLE_PUBLIC_KEY`, which kit 8.5's strict `verifySignature()` throws for non-extractable public keys.
- compatibility-matrix.md: Agave 4.3.x is the stable channel and 4.4.x the beta, with 4.2.x marked superseded. Notes the 5.x `solana-*` crate line (`solana-sdk` 5.0, `solana-message` 5.1), which pairs with Agave 4.4. Agave 4.3, LiteSVM and Mollusk still use the 4.x crates. The `agave-validator` binary is still not in the release tarballs.
- compatibility-matrix.md and testing.md: the Anchor 1.2.x / 1.1.x combinations now list `litesvm` 0.18.0 (MSRV 1.97.1; 0.17.x for older host toolchains) and `mollusk-svm` 0.16.2. The LiteSVM crate table covers 0.10 through 0.18 and their Agave eras. `anchor-litesvm` 0.4 pairs only with `litesvm` 0.11.x, and no release covers 0.13+.
- testing.md: upgrade notes for LiteSVM 0.17 and 0.18 (removed `get_feature_set`, the new `loaded_accounts_data_size` field, the SIMD-0437/0438 rent gates) and for Mollusk 0.15 and 0.16 (the payer argument, rent-exemption checks on by default, and the `mollusk-svm-account` builders).
- anchor/migrating-v0.32-to-v1.md: the litesvm dev-dependency table points at `anchor-litesvm` 0.4 and the matrix.
- surfpool/*: Surfpool v1.6.1. The cheatcode reference grows from 26 to 28 methods with `surfnet_deriveConfidentialKeys` and `surfnet_getConfidentialBalance`. Also covers the `surfpool stop` subcommand, the default slot time change from 400 ms to 250 ms, disposable embedded Kit clients (`using`), and the 1.6.1 optional peer ranges (`kit-plugin-rpc` / `-signer` `^0.18`). The reference also documents the parameters of the confidential cheatcodes and `setTokenAccount`'s `confidential` field, with an end-to-end example, and corrects `setTokenAccount`'s update keys to camelCase (`delegatedAmount`, `closeAuthority`).
- compatibility-matrix.md and common-errors.md: the LiteSVM npm table now covers 1.3–1.6, including the gnu and musl binaries and the Node ≥20 requirement. The litesvm 0.5.0 GLIBC failure is kept only as history. Advice to fall back to the deprecated `solana-bankrun` or to litesvm 0.3.x is removed.

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
