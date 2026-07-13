---
title: Kit ↔ web3.js Interop (web3.js v3)
description: Use web3.js v3 — the class-based API rebuilt on Solana Kit internals — for legacy-style code and dependencies, and migrate v1 codebases mechanically.
---

# Kit ↔ web3.js Interop (web3.js v3)

## The landscape (2026)

`@solana/web3.js` v3 is a rebuild of the classic class-based API (`Connection`, `Keypair`, `Transaction`) **on top of `@solana/kit` internals**. It was co-developed by Blueshift and the Solana Foundation ("Sunrising Web3.js") and reunifies the TypeScript ecosystem: Kit is the foundation, web3.js is the front door.

- **New greenfield code:** use `@solana/kit` directly (tree-shakable, functional, plugin clients).
- **Existing web3.js v1 codebases / teams with v1 muscle memory:** migrate to web3.js v3. Same import path, same classes, Kit underneath.
- **`@solana/web3-compat` is superseded.** It was an interim shim (web3.js 1.x API delegating to Kit 5). Do not introduce it in new work; replace it with web3.js v3 where found.

```bash
npm install @solana/web3.js@rc   # v3 line (3.0.0-rc.x); `latest` still points to 1.98.x
```

Pin exact versions in production while v3 is in RC.

## Why interop is now trivial

Because v3 is built on Kit, the two share types at the seams:

- `PublicKey` **is** `Address` — v3 literally exports `PublicKey` as a deprecated alias of its `Address` class. `pda.toBase58()` returns Kit's branded address string.
- A v3 `Keypair` structurally satisfies Kit's `KeyPairSigner` (`isKeyPairSigner(keypair) === true`) — pass it directly to Kit APIs, Kit plugins, and Codama-generated clients.
- Kit `MessagePartialSigner` / `TransactionPartialSigner` values can be passed directly to v3's `transaction.sign(...)`. No `createNoopSigner` adapter dance.
- The v1 `Signer` interface is renamed `Web3Signer`; the exported `Signer` type is a union of `Web3Signer` and Kit partial signers.

```ts
import { Connection, Address, Keypair } from '@solana/web3.js'; // v3

const keypair = await Keypair.generate();     // async now
keypair.publicKey;  // web3.js Address class — .toBase58() / .equals() / .toBytes()
keypair.address;    // Kit branded base58 string — hand this to Kit/Codama APIs

// Same keypair, both worlds:
await someWeb3Transaction.sign(keypair);                       // web3.js v3
await client.sendTransaction([kitInstruction]);                // Kit client (keypair as signer works)
```

## v1 → v3 migration (mechanical, not architectural)

Breaking themes to apply when migrating:

| v1 | v3 |
|---|---|
| `new PublicKey(...)` | `new Address(...)` (`PublicKey` alias deprecated, targeted for removal) |
| `Keypair.generate()` (sync) | `await Keypair.generate()` |
| `Keypair.fromSecretKey(...)` (sync) | `await Keypair.fromSecretKey(...)` |
| `PublicKey.findProgramAddressSync(...)` | `await Address.findProgramAddress(...)` (sync variants removed) |
| `tx.sign(...)` / `tx.partialSign(...)` (sync) | `await tx.sign(...)` / `await tx.partialSign(...)` |
| Default commitment `finalized` | Default commitment `confirmed` |
| RPC numbers as `number` | `bigint` for slots, block heights, lamports-like fields |
| `Buffer` account data | `Uint8Array` (and readonly RPC results; `AccountInfo` gains `space: bigint`) |
| `PublicKey.unique()`, `Account`, `FeeCalculator`, `getRecentBlockhash*` | Removed |

There is an official migration agent skill you can install and run:

```bash
npx skills add https://github.com/solana-foundation/solana-web3.js/tree/v3.x/skills/web3js-v1-to-v3-migration
```

A companion guide covers `@solana/spl-token` → `@solana-program/token` (`docs/web3js-spl-token-migration.md` in the same repo).

## Boundary rules (when both styles coexist)

- New modules: Kit types and Kit-first APIs (`Address`, `Signer`, instruction builders, codecs, Codama clients).
- Modules still on v3 classes: fine — they're Kit-backed. But don't let `Connection` and a Kit plugin client coexist as two sources of truth for RPC config; pick one per app and derive the other at the edge if a dependency demands it.
- A dependency that expects v1 objects (`Connection`, sync `Keypair`): upgrade the dependency or isolate it in an adapter module. Do not downgrade your app to v1.

## Decision checklist

If you're about to add web3.js to a project:
1) Greenfield? Use `@solana/kit` + plugins. Don't add web3.js at all.
2) Migrating a v1 codebase? Move to `@solana/web3.js@rc` (v3) — run the migration skill.
3) Found `@solana/web3-compat` in a codebase? Replace it with web3.js v3.
4) Need a typed client for your own program? Generate a Kit-native client with Codama instead of hand-writing web3-style calls.

## References

- Announcement: https://blueshift.gg/research/sunrising-web3js-reuniting-solanas-typescript-ecosystem
- Repo (v3 branch): https://github.com/solana-foundation/solana-web3.js/tree/v3.x
- Migration guide: https://github.com/solana-foundation/solana-web3.js/blob/v3.x/docs/web3js-v1-to-v3-migration.md
- API docs: https://solana-foundation.github.io/solana-web3.js/
