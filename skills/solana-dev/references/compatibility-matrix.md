---
title: Version Compatibility Matrix
description: Reference table for matching Anchor, Solana CLI, Rust, and Node.js versions to avoid toolchain conflicts.
---

# Solana Version Compatibility Matrix

## Contents

- [Master Compatibility Table](#master-compatibility-table)
- [Solana CLI Version Mapping](#solana-cli-version-mapping)
- [Platform Tools → Rust Toolchain Mapping](#platform-tools-rust-toolchain-mapping)
- [GLIBC Requirements by OS](#glibc-requirements-by-os)
- [Anchor ↔ Solana Crate Versions](#anchor-solana-crate-versions)
- [Anchor CLI ↔ anchor-lang Crate Compatibility](#anchor-cli-anchor-lang-crate-compatibility)
- [SPL Token Crate Versions](#spl-token-crate-versions)
- [Node.js / TypeScript Requirements](#nodejs-typescript-requirements)
- [Known Working Combinations (Tested)](#known-working-combinations-tested)
- [Testing Tools: LiteSVM / Bankrun Compatibility](#testing-tools-litesvm-bankrun-compatibility)
- [Transaction v1 (SIMD-0385) Minimum Versions](#transaction-v1-simd-0385-minimum-versions)

## Master Compatibility Table

| Anchor Version | Release Date | Solana CLI | Rust Version | Platform Tools | GLIBC Req | Node.js | Key Notes |
|---|---|---|---|---|---|---|---|
| **1.1.x** (latest: 1.1.2) | Jun 2026 | 3.1.x (CI-tested: 3.1.10) | MSRV 1.89 | v1.52+ | ≥2.39 | ≥20.18 | anchor-syn on syn 2.0; versioned tx in anchor-client; `verifiedBuild` (OtterSec verify.osec.io); multiple named scripts in Anchor.toml; `anchor idl fetch-historical`; 1.1.2 tightens inter-crate `anchor-*` pins |
| **1.0.x** | Apr 2026 | 3.x | 1.79–1.85+ (stable) | v1.52 | ≥2.39 | ≥17 | TS pkg → `@anchor-lang/core`; `anchor test` defaults to surfpool; LiteSVM test template default on `anchor init`; `--install-agent-skills` flag; IDL in Program Metadata; no `solana` CLI shell-out; all `solana-*` deps must be `^3`; `solana-program` removed as project dep; `solana-signer` replaces `solana-sdk` for signing; `Migration<'info, From, To>` account type; duplicate mutable accounts disallowed (new `dup` constraint) |
| **0.32.x** | Oct 2025 | 2.1.x+ | 1.79–1.85+ (stable) | v1.50+ | ≥2.39 | ≥17 | Replaces `solana-program` with smaller crates; IDL builds on stable Rust; removes Solang |
| **0.31.1** | Apr 2025 | 2.0.x–2.1.x | 1.79–1.83 | v1.47+ | ≥2.39 ⚠️ | ≥17 | New Docker image `solanafoundation/anchor`; published under solana-foundation org. **Tested: binary requires GLIBC 2.39, not 2.38** |
| **0.31.0** | Mar 2025 | 2.0.x–2.1.x | 1.79–1.83 | v1.47+ | ≥2.39 ⚠️ | ≥17 | Solana v2 upgrade; dynamic discriminators; `LazyAccount`; `declare_program!` improvements. **Pre-built binary needs GLIBC 2.39** |
| **0.30.1** | Jun 2024 | 1.18.x (rec: 1.18.8+) | 1.75–1.79 | v1.43 | ≥2.31 | ≥16 | `declare_program!` macro; legacy IDL conversion; `RUSTUP_TOOLCHAIN` override |
| **0.30.0** | Apr 2024 | 1.18.x (rec: 1.18.8) | 1.75–1.79 | v1.43 | ≥2.31 | ≥16 | New IDL spec; token extensions; `cargo build-sbf` default; `idl-build` feature required |
| **0.29.0** | Oct 2023 | 1.16.x–1.17.x | 1.68–1.75 | v1.37–v1.41 | ≥2.28 | ≥16 | Account reference changes; `idl build` compilation method; `.anchorversion` file |

## Solana CLI Version Mapping

| Solana CLI | Agave Version | Era | solana-program Crate | Platform Tools | Status |
|---|---|---|---|---|---|
| **4.1.x** | v4.1.x (latest stable: 4.1.2, Jul 2026) | Jul 2026 | N/A (validator only) | v1.52+ | Stable |
| **3.1.x** | v3.1.x | Jan 2026 | N/A (validator only) | v1.52 | Stable — CI-tested pairing for Anchor 1.1.x (3.1.10) |
| **3.0.x** | v3.0.x | Late 2025 | N/A (validator only) | v1.52 | Stable (mainnet) |
| **2.1.x** | v2.1.x | Mid 2025 | 2.x | v1.47–v1.51 | Stable |
| **2.0.x** | v2.0.x | Early 2025 | 2.x | v1.44–v1.47 | Legacy |
| **1.18.x** | N/A (pre-Anza) | 2024 | 1.18.x | v1.43 | Legacy |
| **1.17.x** | N/A | 2023 | 1.17.x | v1.37–v1.41 | Deprecated |
| **1.16.x** | N/A | 2023 | 1.16.x | v1.35–v1.37 | Deprecated |

### Important: Solana CLI v3.x+
As of Agave v3.0.0, Anza **no longer publishes the `agave-validator` binary**. Operators must build from source. The CLI tools (for program development) remain available via `agave-install` or the install script.

### Agave 4.x vs SDK crate versions (Jul 2026)
Agave validator releases (4.x) are versioned **independently** from the SDK crates. `solana-program` is at 4.0.0 and `solana-sdk` at 4.0.1 (Feb 2026), but **Anchor 1.1.x still pins the 3.x crate line** (`solana-program = "3.0.0"` internally) and its CI installs Solana CLI 3.1.10. For Anchor projects, stay on `solana-*` `^3` crates until Anchor moves; for non-Anchor native programs you may use the 4.x crates with matching tooling.

## Platform Tools → Rust Toolchain Mapping

| Platform Tools | Bundled Rust | Bundled Cargo | LLVM/Clang | Target Triple | Notes |
|---|---|---|---|---|---|
| **v1.52** | ~1.85 (solana fork) | ~1.85 | Clang 20 | `sbpf-solana-solana` | Latest; used by Solana CLI 3.x |
| **v1.51** | ~1.84 (solana fork) | ~1.84 | Clang 19 | `sbpf-solana-solana` | |
| **v1.50** | ~1.83 (solana fork) | ~1.83 | Clang 19 | `sbpf-solana-solana` | |
| **v1.49** | ~1.82 (solana fork) | ~1.82 | Clang 18 | `sbpf-solana-solana` | |
| **v1.48** | rustc 1.84.1-dev | cargo 1.84.0 | Clang 19 | `sbpf-solana-solana` | **Verified.** Used by Solana CLI 2.2.16. ⚠️ Cargo does NOT support `edition2024` |
| **v1.47** | ~1.80 (solana fork) | ~1.80 | Clang 17 | `sbpf-solana-solana` | Used by Anchor 0.31.x |
| **v1.46** | ~1.79 (solana fork) | ~1.79 | Clang 17 | `sbf-solana-solana` | |
| **v1.45** | ~1.79 (solana fork) | ~1.79 | Clang 17 | `sbf-solana-solana` | |
| **v1.44** | ~1.78 (solana fork) | ~1.78 | Clang 16 | `sbf-solana-solana` | |
| **v1.43** | ~1.75 (solana fork) | ~1.75 | Clang 16 | `sbf-solana-solana` | Used by Anchor 0.30.x/Solana 1.18.x. ❌ Incompatible with CLI 2.2.16 (`sbpf-solana-solana` target not found) |

**Note:** Platform Tools ship a **forked** Rust compiler from [anza-xyz/rust](https://github.com/anza-xyz/rust). The version numbers approximate the upstream Rust equivalent. The forked compiler includes SBF/SBPF target support.

**⚠️ CRITICAL (Jan 2026):** Platform-tools v1.48 bundles `cargo 1.84.0` which does NOT support `edition = "2024"`. Multiple crates now require it: `blake3 ≥1.8.3`, `constant_time_eq ≥0.4.2`, `base64ct ≥1.8.3`, `indexmap ≥2.13.0`. Pin to safe versions: `blake3=1.8.2`, `constant_time_eq=0.3.1`, `base64ct=1.7.3`, `indexmap=2.11.4`. **Always commit Cargo.lock files.** See [common-errors.md](./common-errors.md#edition2024-crate-incompatibility-cargo-1840) for full details and fix scripts.

## GLIBC Requirements by OS

| OS / Distro | GLIBC Version | Compatible Anchor |
|---|---|---|
| **Ubuntu 24.04 (Noble)** | 2.39 | All (0.29–v1+) |
| **Ubuntu 22.04 (Jammy)** | 2.35 | 0.29–0.30.x only (build 0.31+ from source) |
| **Ubuntu 20.04 (Focal)** | 2.31 | 0.29–0.30.x only (build 0.31+ from source) |
| **Debian 12 (Bookworm)** | 2.36 | 0.29–0.30.x only ⚠️ **Tested: 0.31.1 and 0.32.1 pre-built binaries fail.** Build from source works for Anchor CLI, but `litesvm` 0.5.0 native binary also needs GLIBC 2.38+ |
| **Debian 13 (Trixie)** | 2.40 | All |
| **Fedora 39+** | ≥2.38 | All |
| **Arch Linux (rolling)** | Latest | All |
| **macOS 14+ (Sonoma)** | N/A (no GLIBC) | All |
| **macOS 12-13** | N/A | All |
| **Windows WSL2 (Ubuntu)** | Depends on distro | See Ubuntu version |

### Why GLIBC matters
Anchor 0.31+ and 0.32+ binaries are compiled against newer GLIBC. If your system's GLIBC is too old, you'll get:
```
anchor: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.38' not found
```

**Solutions:**
1. Upgrade your OS (recommended)
2. Build Anchor from source: `cargo install --git https://github.com/solana-foundation/anchor --tag v1.0.0 anchor-cli` (replace tag with desired version)
3. Use Docker (see install-guide.md)

## Anchor ↔ Solana Crate Versions

| Anchor | anchor-lang Crate | Project-level solana-* | Notes |
|---|---|---|---|
| **1.1.x** | 1.1.x (MSRV 1.89) | `^3` (granular crates) | Same rules as 1.0.x; 1.1.2 tightens `anchor-*` inter-crate pins — keep all `anchor-*` crates on the exact same version |
| **1.0.x** | 1.0.x | `^3` (granular crates) | `solana-program` removed from project deps; use `solana-signer` instead of `solana-sdk` for signing; all `solana-*` must be `^3` |
| **0.32.x** | 0.32.x | `2` (still `solana-program` or granular v2) | anchor-lang internals use granular crates; `solana-program` still valid in user Cargo.toml |
| **0.31.x** | 0.31.x | 2.x | Upgraded to Solana v2 crate ecosystem |
| **0.30.x** | 0.30.x | 1.18.x | Last version using Solana v1 crates |
| **0.29.x** | 0.29.x | 1.16.x–1.17.x | |

### Solana Granular Crate Ecosystem (Anchor 0.31+)
Anchor 0.31+ uses the Solana v2+ crate structure. The monolithic `solana-program` crate is being split into smaller crates:
- `solana-pubkey` / `solana-address`
- `solana-instruction`
- `solana-account-info`
- `solana-msg`
- `solana-invoke`
- `solana-entrypoint`
- `solana-signer` (use instead of `solana-sdk` in v1+)
- etc.

Anchor 0.32+ fully replaces `solana-program` in its own internals. **Anchor v1.0+** goes further: user-facing `Cargo.toml` files must also drop `solana-program` and bump any remaining `solana-*` crates to `^3`. The `anchor build` command warns on mismatched versions.

## Anchor CLI ↔ anchor-lang Crate Compatibility

The Anchor CLI checks version compatibility with the `anchor-lang` crate used in your project. **Mismatched versions will produce a warning.** Always keep these in sync:

```toml
# Cargo.toml (Anchor v1)
[dependencies]
anchor-lang = "1.0.0"

# Must match CLI:
# anchor --version → anchor-cli 1.0.0
```

```toml
# Cargo.toml (Anchor 0.32.x)
[dependencies]
anchor-lang = "0.32.1"

# anchor --version → anchor-cli 0.32.1
```

## SPL Token Crate Versions

| Anchor | anchor-spl | spl-token | spl-token-2022 | spl-associated-token-account |
|---|---|---|---|---|
| **1.1.x** | 1.1.x | Latest compatible | Latest compatible | Latest compatible |
| **1.0.x** | 1.0.x | Latest compatible | Latest compatible | Latest compatible |
| **0.32.x** | 0.32.x | Latest compatible | Latest compatible | Latest compatible |
| **0.31.x** | 0.31.x | 6.x | 5.x | 4.x |
| **0.30.x** | 0.30.x | 4.x–6.x | 3.x–4.x | 3.x |
| **0.29.x** | 0.29.x | 4.x | 1.x–3.x | 2.x–3.x |

## Node.js / TypeScript Requirements

| Anchor | TS Package | Node.js | TypeScript | Notes |
|---|---|---|---|---|
| **1.1.x** | `@anchor-lang/core ^1.1.0` | ≥20.18 | 5.x | `engines.node >= 20.18`; versioned transaction support |
| **1.0.x** | `@anchor-lang/core ^1.0.0` | ≥17 | 5.x | Renamed from `@coral-xyz/anchor`. IDL types now at root of `@anchor-lang/core` (was `@coral-xyz/anchor/dist/cjs/idl`) |
| **0.32.x** | `@coral-xyz/anchor ^0.32.x` | ≥17 | 5.x | |
| **0.31.x** | `@coral-xyz/anchor ^0.31.x` | ≥17 | 5.x | |
| **0.30.x** | `@coral-xyz/anchor ^0.30.x` | ≥16 | 4.x–5.x | |
| **0.29.x** | `@coral-xyz/anchor ^0.29.x` | ≥16 | 4.x | |

### Anchor v1 TypeScript Package Rename

The npm package moved from `@coral-xyz/anchor` to `@anchor-lang/core`. Update `package.json` and all imports:

```bash
# Find all occurrences to update
grep -r "@coral-xyz" --include="*.ts" --include="*.js" --include="package.json" .
grep -r "dist/cjs/idl" --include="*.ts" --include="*.js" .
```

```typescript
// Before (0.32.x)
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Idl } from "@coral-xyz/anchor/dist/cjs/idl";

// After (v1)
import * as anchor from "@anchor-lang/core";
import { Program, AnchorProvider, BN } from "@anchor-lang/core";
import { Idl } from "@anchor-lang/core";
```

IDL management now uses `anchor idl init` / `anchor idl upgrade` (CLI) or `@solana-program/program-metadata` (npm) — see [migrating-v0.32-to-v1.md](./anchor/migrating-v0.32-to-v1.md#5-close-legacy-idl-accounts-and-re-publish-deploy).

## Known Working Combinations (Tested)

### 🟢 Anchor 1.1.x (Recommended for new projects — Jul 2026)
```
Anchor CLI: 1.1.2
anchor-lang: 1.1.2
anchor-spl: 1.1.2
solana-* crates: ^3
litesvm (dev): 0.14.0  (Agave 4.1-based; check anchor-litesvm for a matching release)
mollusk-svm (dev): 0.14.0
TS: @anchor-lang/core ^1.1.0
Solana CLI: 3.1.10 (Anchor CI-tested pairing)
Platform Tools: v1.52+
Rust: ≥1.89 (anchor-lang MSRV)
Node.js: ≥20.18 (22.x LTS recommended)
OS: Ubuntu 24.04+ (GLIBC ≥2.39) or macOS 14+
Test runner: surfpool (default in anchor test)
```

### 🟢 Anchor 1.0.x (Existing v1 projects)
```
Anchor CLI: 1.0.3
anchor-lang: 1.0.3
anchor-spl: 1.0.3
solana-* crates: ^3
litesvm (dev): 0.8.2  (or 0.9.1 if solana-hash 4.0 / solana-vote-interface 5.0)
anchor-litesvm (dev): 0.3
TS: @anchor-lang/core ^1.0.0
Solana CLI: 3.x
Platform Tools: v1.52
Rust: 1.79–1.85+
Node.js: 20.x LTS
OS: Ubuntu 24.04+ (GLIBC ≥2.39) or macOS 14+
Test runner: surfpool (default in anchor test)
```

### 🟢 Anchor 0.32.x (Recommended for existing 0.32 projects staying pre-v1)
```
Anchor CLI: 0.32.1
anchor-lang: 0.32.1 (CLI and crate versions must match)
Solana CLI: 2.1.7+
Rust: 1.84.0+
Platform Tools: v1.52
Node.js: 20.x LTS
OS: Ubuntu 24.04+ (GLIBC ≥2.39) or macOS 14+
```

### 🟡 Legacy Compatible (For older systems)
```
Anchor CLI: 0.30.1
Solana CLI: 1.18.26
Rust: 1.79.0
Platform Tools: v1.43
Node.js: 18.x LTS
OS: Ubuntu 20.04+ or macOS 12+
```

### 🟡 Transitional (Upgrading from 0.30 → 0.31)
```
Anchor CLI: 0.31.0
Solana CLI: 2.0.x
Rust: 1.79.0
Platform Tools: v1.47
Node.js: 20.x LTS
OS: Ubuntu 24.04 or macOS 14+
```

## Testing Tools: LiteSVM / Bankrun Compatibility

### LiteSVM Rust Crate — Version Selection

Use the row that matches your workspace's resolved `solana-*` granular crate versions:

| litesvm (Rust) | solana-* era | Key markers | anchor-litesvm |
|---|---|---|---|
| **0.8.2** | `~3.0` | `solana-hash ~3.0`, `solana-vote-interface 4.0`, `solana-system-interface 2.0` | `0.3` (requires `anchor-lang ^1.0.0`, `litesvm ^0.8.2`) |
| **0.9.1** | `~3.1`–`~3.3` | `solana-hash 4.0`, `solana-vote-interface 5.0`, `solana-system-interface 3.0` | TBD — `anchor-litesvm 0.3` declared `litesvm ^0.8.2`; check for a newer release |
| **>0.10.0** | `3.3+` | follow latest releases | follow litesvm/anchor-litesvm release |

**Diagnostic:** run `cargo tree -d` — duplicate `solana-*` minor versions in the tree means the selected `litesvm` version is mismatched.

### LiteSVM npm Package (TypeScript tests)

| Tool | npm Package | GLIBC Req | Node.js | Notes |
|---|---|---|---|---|
| **LiteSVM 1.3.0** (current, Jul 2026) | `litesvm` | ≥2.38 | ≥18 | Agave 4.1-based; pairs with `@solana/kit-plugin-litesvm` 0.13 |
| **LiteSVM 0.5.0** | `litesvm` | ≥2.38 ⚠️ | ≥18 | **Tested: native binary (`litesvm.linux-x64-gnu.node`) fails on Debian 12 (GLIBC 2.36) with `undefined symbol: __isoc23_strtol`**. Works on Ubuntu 24.04+, macOS. Same GLIBC floor expected for 1.x binaries. |
| **LiteSVM 0.3.x** | `litesvm` | ≥2.31 | ≥16 | Older API, may work on older systems |
| **solana-bankrun** | `solana-bankrun` | ≥2.28 | ≥16 | Legacy — being replaced by LiteSVM |
| **anchor-bankrun** | `anchor-bankrun` | ≥2.28 | ≥16 | Legacy Anchor wrapper for bankrun |
| **anchor-litesvm** | `anchor-litesvm` | Same as litesvm | ≥18 | Anchor wrapper for LiteSVM |

### LiteSVM on Older Systems
If the `litesvm` npm native binary fails with GLIBC errors (verified on 0.5.0):
1. **Upgrade OS** to Ubuntu 24.04+ (recommended)
2. **Use Docker**: `FROM ubuntu:24.04` base image
3. **Fall back to `solana-bankrun`** temporarily
4. **Build litesvm from source** (requires Rust + napi-rs toolchain)

### Verified Test Environment (Jan 2026)
```
✅ Works: Anchor CLI 0.30.1 (built from source) + Solana CLI 2.2.16 + Rust 1.93.0 + Debian 12
❌ Fails: litesvm 0.5.0 native binary on Debian 12 (GLIBC 2.36)
❌ Fails: Anchor 0.31.1/0.32.1 pre-built binaries on Debian 12 (GLIBC 2.36)
✅ Works: cargo build-sbf (Solana 2.2.16, platform-tools v1.48) on Debian 12
✅ Works: Anchor 0.30.1 built from source with Rust 1.93.0 on Debian 12
```

---

## Transaction v1 (SIMD-0385) Minimum Versions

Full reference: [transactions-v1.md](./transactions-v1.md). Feature gate: `txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL`, targeted for Agave v4.2 (tentative).

| Component | Minimum for v1 | Notes |
|---|---|---|
| Anza CLI / Agave | **4.2.0** | v1 support and `maxSupportedTransactionVersion: 1`. Local test validator activates every feature at genesis |
| Surfpool | **1.5** | Enables the gate by default |
| `solana-message` (Rust) | **4.2.0** | `v1::Message` landed in 4.1.0; 4.2.0 adds the inherent `Message::serialize()` |
| `solana-rpc-client` (Rust) | 4.2.1 | `max_supported_transaction_version: Some(1)` |
| `@solana/kit` | **8.0.0** | 7.1.1 has the v1 codecs, config setters, and `maxSupportedTransactionVersion: 1`, but 8.0.0 is the first to *type* `createTransactionMessage({ version: 1 })` |
| `@solana/kit-plugin-rpc` | — | Reads fine; **sending v1 throws** through 0.18.0 (current) — use the manual `pipe()` path |
| `@solana/web3.js` (v3, `@rc`) | **3.0.0-rc.3** (pending) | [PR #3861](https://github.com/solana-foundation/solana-web3.js/pull/3861) (`compileToV1Message`) ready, unmerged. Published rc.2 has legacy/v0 only |
| `@solana/web3.js` 1.x | **1.99.0** (pending) | [PR #3866](https://github.com/solana-foundation/solana-web3.js/pull/3866) drafted, unmerged; latest published is 1.98.4. ⚠️ Read-only even then — 1.x never sends v1 |
| `solders` (Python) | **0.29.0** | Read and send. Earlier releases have neither |
| `solana-go` | unreleased | [PR #481](https://github.com/solana-foundation/solana-go/pull/481) |
| `yellowstone-grpc-proto` (Rust) | **12.6.0** | First release whose generated code has `Message.config` (field 7) |
| `yellowstone-grpc-client` (Rust) | **13.3.0** | 12.x connects, but pair either with a direct 12.6.0 proto pin |
| yellowstone-grpc geyser plugin | **15.1.1** | Earlier builds downgrade v1 to v0 before it reaches the wire |
| `@triton-one/yellowstone-grpc` | **6.0.0** | 5.x drops field 7 — a `^5.0.9` pin loses every v1 budget |

### ⚠️ Silent-failure pins

- `yellowstone-grpc-client` 13.3.0 only *requires* `yellowstone-grpc-proto = "12.5.0"`, which has no field 7. **Pin `yellowstone-grpc-proto = "12.6.0"` directly** and build `--locked`, or the resolver hands you a proto crate that drops every v1 config without erroring.
- yellowstone ships its Go client as pre-generated code that predates field 7. Generate stubs from the tag's `.proto` yourself.
- Protobuf clients discard unknown fields silently. A stale stub decodes a v1 message as v0 with an empty compute budget — no error, just missing data.
