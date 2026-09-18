# Changelog

Versions track the `metadata.version` field in `skills/solana-dev/SKILL.md`. Earlier releases predate this file; see the git history.

## 2.5.0 — 2026-09-18

Transaction v1 is now the default transaction version, built through plugin clients.

- SKILL.md: `transactionConfig: { version: 1 }` on the RPC plugin is the recommended way to send; manual `pipe()` is the low-level alternative. Removed the claim that `rpcTransactionPlanner` rejects `version: 1` (fixed in `@solana/kit-plugin-rpc` 0.19.0).
- transactions-v1.md: dropped the pre-release banner (mainnet activation 2026-09-15, Agave 4.2.2). New "Sending v1 through plugin clients" and "Wallets" sections; the manual `pipe()` example is secondary. Library table updated for kit 8.3, kit-plugin-rpc 0.19, kit-plugin-litesvm 0.19, kit-plugin-wallet 0.20, web3.js 3.0.0-rc.3 and 1.99.0.
- Wallets: document `connected.supportedTransactionVersions.has(1)` from `@solana/kit-plugin-wallet` 0.20 (frontend.md, kit/plugins.md, kit/react.md).
- New v1 examples use Kit's resource estimators by default. Fixed limits remain documented for measured overrides, deliberate caps, and test fixtures. Legacy/v0 remain only as historical or wallet-fallback paths.
- compatibility-matrix.md: Agave 4.2.x row, `solana-*` 4.x crates for clients, v1 minimum-version table refreshed.
- kit/gotchas.md and common-errors.md: replaced the "planner throws on v1" entries with the plugin-rpc upgrade fix, the v0-by-default gotcha, the `microLamportsPerComputeUnit` vs `priorityFeeLamports` type error, and the wallet-rejects-v1 error.
