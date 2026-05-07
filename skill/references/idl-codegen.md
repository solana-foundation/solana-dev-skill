---
title: IDL & SDK Generation
description: Generate type-safe program clients from IDLs using Codama. Includes bundled scripts for on-chain IDL fetching and multi-language SDK generation.
---

# IDL + SDK generation (Codama)

## Goal
Never hand-maintain program clients. Use Codama to generate typed SDKs from IDLs.

## Bundled scripts

This skill ships two scripts in `scripts/` (same engine as [castaway.lol](https://castaway.lol)):

### Setup (once)
```bash
cd <skill-dir>/scripts && npm install
```

### fetch-idl.mjs -- Fetch on-chain Anchor IDL

```bash
# Mainnet (default)
node scripts/fetch-idl.mjs --program-id <PROGRAM_ID> > idl.json

# Devnet
node scripts/fetch-idl.mjs --program-id <PROGRAM_ID> --rpc https://api.devnet.solana.com > idl.json
```

Derives the Anchor IDL account address, fetches and decompresses the IDL. Outputs JSON to stdout. Exits 1 if no on-chain IDL found.

### generate-sdk.mjs -- Generate SDK from IDL

```bash
node scripts/generate-sdk.mjs --idl idl.json --lang js --out ./generated-sdk
```

| `--lang` | Output | Codama renderer |
|----------|--------|-----------------|
| `js` | TypeScript (@solana/kit) | `@codama/renderers-js` |
| `js-umi` | TypeScript (Metaplex Umi) | `@codama/renderers-js-umi` |
| `rust` | Rust (solana_sdk) | `@codama/renderers-rust` |
| `go` | Go | `@codama/renderers-go` |

Auto-detects Anchor vs native Codama IDL format.

### End-to-end example

```bash
# Fetch Jupiter IDL and generate TypeScript SDK
node scripts/fetch-idl.mjs --program-id JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4 > /tmp/jup.json
node scripts/generate-sdk.mjs --idl /tmp/jup.json --lang js --out ./jupiter-client
```

## Workflow for Claude

1. **Determine input**: program ID, local IDL file path, explorer URL, or `target/idl/*.json`
2. **Fetch IDL** (if program ID): run `fetch-idl.mjs`, save to temp file
3. **Determine language**: ask user if not specified, default `js`
4. **Generate**: run `generate-sdk.mjs`
5. **Report**: generated file paths + next steps (install deps, format)

If fetch fails, the program has no on-chain Anchor IDL. Ask user for local IDL file (e.g. `anchor build` output at `target/idl/`).

## Anchor -> Codama (manual alternative)

If not using the bundled scripts:
1. Produce Anchor IDL from build (`anchor build`)
2. Convert: `rootNodeFromAnchor()` from `@codama/nodes-from-anchor`
3. Render: `renderVisitor()` from `@codama/renderers-js`

Or use the Codama CLI:
```bash
npx codama init   # creates codama.json
npx codama run js # generates JS client
```

## Native Rust -> Shank -> Codama

For non-Anchor programs:
1. Use Shank macros to extract a Shank IDL from annotated Rust
2. Convert Shank IDL to Codama
3. Generate clients via Codama renderers

## Guidelines

- Codegen outputs should be checked into git if you need deterministic builds or want users to consume the client without running codegen
- Do not write IDLs by hand unless you have no alternative
- Do not hand-write Borsh layouts for programs you own; use the IDL/codegen pipeline
