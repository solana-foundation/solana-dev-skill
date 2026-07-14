---
title: Kit ↔ web3.js Interop
description: How to handle legacy web3.js code — web3.js v3 (Kit internals, currently RC) is the migration target; defer migration mechanics to the official migration skill.
---

# Kit ↔ web3.js Interop

## The landscape (2026)

`@solana/web3.js` v3 is a rebuild of the classic class-based API (`Connection`, `Keypair`, `Transaction`) on top of `@solana/kit` internals, co-developed by Blueshift and the Solana Foundation.

**Status: release candidate.** v3 ships as `@solana/web3.js@rc` (3.0.0-rc.x); the `latest` dist-tag still points to the 1.x line. Adoption is early and feedback is still being incorporated — if you use it, pin exact versions and expect some API churn between RCs. Treat v3 as the migration target for v1 codebases, not a default recommendation for new work.

## Decision routing

1. **Greenfield code** → use `@solana/kit` + plugins directly. Don't add web3.js at all. See [kit/overview.md](kit/overview.md).
2. **Migrating a v1 codebase** → use the official migration skill. It is maintained alongside the source in the solana-web3.js repo and kept current with each RC, so prefer it over hand-migrating from memory:
   ```bash
   npx skills add https://github.com/solana-foundation/solana-web3.js/tree/v3.x/skills/web3js-v1-to-v3-migration
   ```
   (Or install from the repo and select it: `npx skills add solana-foundation/solana-web3.js -s web3js-v1-to-v3-migration`.) A companion guide in the same repo covers `@solana/spl-token` → `@solana-program/token`.
3. **Found `@solana/web3-compat` in a codebase** → it is superseded (an interim shim running the v1 API on Kit 5). Do not introduce it in new work; plan a migration to v3 or Kit.
4. **A dependency expects v1 objects** (`Connection`, sync `Keypair`) → upgrade the dependency or isolate it in an adapter module. Do not downgrade your app to v1, and do not let legacy class types leak across the app.

## Why the boundary is cheap in v3

Because v3 is built on Kit, the seams are shared types rather than conversion shims:

- `PublicKey` is a deprecated alias of v3's `Address` class.
- A v3 `Keypair` structurally satisfies Kit's `KeyPairSigner` — it can be passed directly to Kit APIs, Kit plugins, and Codama-generated clients.

The migration skill covers the rest (async signing, `bigint` RPC numerics, removed APIs, commitment defaults).

## References

- Repo (v3 branch): https://github.com/solana-foundation/solana-web3.js/tree/v3.x
- Migration guide: https://github.com/solana-foundation/solana-web3.js/blob/v3.x/docs/web3js-v1-to-v3-migration.md
- Migration skill: https://github.com/solana-foundation/solana-web3.js/blob/v3.x/skills/web3js-v1-to-v3-migration/SKILL.md
- API docs: https://solana-foundation.github.io/solana-web3.js/
