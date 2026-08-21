---
title: Curated Resources
description: Authoritative Solana learning platforms, documentation, tooling references, and community resources.
---

# Curated Resources (Source-of-Truth First)

## Learning Platforms
- [Blueshift](https://learn.blueshift.gg/) - Free, open-source Solana learning platform
- [Blueshift GitHub](https://github.com/blueshift-gg) - Course content and tools
- [Blueshift Research](https://blueshift.gg/research/) - Ecosystem research and announcements
- [Solana Cookbook](https://solanacookbook.com/)

## Core Solana Docs
- [Solana Documentation](https://solana.com/docs) (Core, RPC, Frontend, Programs)
- [RPC API Reference](https://solana.com/docs/rpc)

## Transaction v1 / Larger Transactions (SIMD-0385)
- [Larger Transaction Sizes upgrade guide](https://solana.com/upgrades/larger-transaction-sizes)
- [SIMD-0385 — transaction v1 format](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md)
- [SIMD-0296 — larger transactions](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md)
- [transaction-v1-examples](https://github.com/solana-foundation/transaction-v1-examples) (runnable Rust, TypeScript, Python, Go — send, decode, read blocks, index over gRPC)
- [Agave v4.2 release schedule](https://github.com/anza-xyz/agave/wiki/v4.2-Release-Schedule)

## Modern JS/TS SDK
- [@solana/kit Repository](https://github.com/anza-xyz/kit)
- [Solana Kit Docs](https://www.solanakit.com/) (createClient, plugins, getting started)
- [Kit Plugins Repository](https://github.com/anza-xyz/kit-plugins) (rpc, signer, wallet, litesvm, instruction-plan)
- [Solana Kit Docs on solana.com](https://solana.com/docs/clients/kit)

## web3.js v3 (classic API on Kit internals)
- [solana-web3.js v3.x branch](https://github.com/solana-foundation/solana-web3.js/tree/v3.x)
- [v1 → v3 Migration Guide](https://github.com/solana-foundation/solana-web3.js/blob/v3.x/docs/web3js-v1-to-v3-migration.md)
- [Sunrising Web3.js announcement](https://blueshift.gg/research/sunrising-web3js-reuniting-solanas-typescript-ecosystem)
- [web3.js API docs](https://solana-foundation.github.io/solana-web3.js/)

## Scaffolding
- [create-solana-dapp](https://github.com/solana-developers/create-solana-dapp)

## Program Frameworks

### Anchor
- [Anchor Repository](https://github.com/solana-foundation/anchor)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Anchor Version Manager (AVM)](https://www.anchor-lang.com/docs/avm)

### Pinocchio
- [Pinocchio Repository](https://github.com/anza-xyz/pinocchio)
- [pinocchio-system](https://crates.io/crates/pinocchio-system)
- [pinocchio-token](https://crates.io/crates/pinocchio-token)
- [Pinocchio Guide](https://github.com/vict0rcarvalh0/pinocchio-guide)
- [How to Build with Pinocchio (Helius)](https://www.helius.dev/blog/pinocchio)

## Testing

### Surfpool
- [Surfpool Documentation](https://solana.com/docs/tools/surfpool/)
- [Surfpool Repository](https://github.com/solana-foundation/surfpool)

### LiteSVM
- [LiteSVM Repository](https://github.com/LiteSVM/litesvm)
- [LiteSVM Docs](https://solana.com/docs/tools/litesvm)
- [litesvm crate](https://crates.io/crates/litesvm)
- [litesvm npm](https://www.npmjs.com/package/litesvm)

### Mollusk
- [Mollusk Repository](https://github.com/anza-xyz/mollusk)
- [mollusk-svm crate](https://crates.io/crates/mollusk-svm)

### Fuzzing
- [Trident (Ackee Solana fuzzer)](https://ackee.xyz/trident/docs/latest/)
- [Trident Repository](https://github.com/Ackee-Blockchain/trident)
- [Crucible Repository](https://github.com/asymmetric-research/crucible)

## IDLs and Codegen
- [Codama Repository](https://github.com/codama-idl/codama)
- [Codama Generating Clients](https://solana.com/docs/programs/codama-generating-clients)
- [Shank (Metaplex)](https://github.com/metaplex-foundation/shank)

## Tokens and NFTs
- [SPL Token Documentation](https://spl.solana.com/token)
- [Token-2022 Documentation](https://spl.solana.com/token-2022)
- [Metaplex Documentation](https://developers.metaplex.com/)

## Payments
- [Kora Documentation](https://docs.kora.network/)
- [Solana Pay](https://docs.solanapay.com/)

## Security
- [Blueshift Program Security Course](https://learn.blueshift.gg/en/courses/program-security)
- [r0bre's 100 Daily Solana Tips (accretionxyz)](https://accretionxyz.substack.com/p/r0bres-100-daily-solana-tips) - program design, security, and best-practice tips (distilled into [security.md](security.md) and [programs/design-patterns.md](programs/design-patterns.md))
- [cargo-expand (roll out macros to review generated code)](https://github.com/dtolnay/cargo-expand)

## Reference Programs Worth Reading
Well-built production programs to read for structure and conventions:
- [Squads Protocol v4 (Anchor)](https://github.com/Squads-Protocol/v4)
- [Sanctum's S (non-Anchor)](https://github.com/igneous-labs/S)
- [Ellipsis Labs' Plasma and gavel (non-Anchor)](https://github.com/Ellipsis-Labs/plasma)

## Performance and Optimization
- [Solana Optimized Programs](https://github.com/Laugharne/solana_optimized_programs)
- [sBPF Assembly SDK (blueshift)](https://github.com/blueshift-gg/sbpf)
- [sbpf (deanmlittle) — write/optimize programs in sBPF assembly](https://github.com/deanmlittle/sbpf)
- [Doppler Oracle (21 CU)](https://github.com/blueshift-gg/doppler)

## Cryptography Primer
- [Elliptic Curve Cryptography visual primer](https://curves.xargs.org)

## Agent Skills
- [Agent Skills Specification](https://agentskills.io/specification)
- [skills.sh (skill discovery + installer)](https://www.skills.sh/)
- [web3.js v1→v3 migration skill](https://github.com/solana-foundation/solana-web3.js/tree/v3.x/skills/web3js-v1-to-v3-migration)
