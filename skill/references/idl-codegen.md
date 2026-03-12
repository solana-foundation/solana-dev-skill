---
title: IDL & Client Code Generation
description: Generate type-safe program clients from IDLs using Codama, eliminating hand-maintained serializers across languages.
---

# IDLs + client generation (Codama / Shank / Kinobi)

## Goal
Never hand-maintain multiple program clients by manually re-implementing serializers.
Prefer an IDL-driven, code-generated workflow.

## Codama (preferred)
- Use Codama as the "single program description format" to generate:
  - TypeScript clients (including Kit-friendly output)
  - Rust clients (when available/needed)
  - documentation artifacts

## Anchor → Codama
If the program is Anchor:
1) Produce Anchor IDL from the build
2) Convert Anchor IDL to Codama nodes (nodes-from-anchor)
3) Render a Kit-native TypeScript client (codama renderers)

## Native Rust → Shank → Codama
If the program is native:
1) Use Shank macros to extract a Shank IDL from annotated Rust
2) Convert Shank IDL to Codama
3) Generate clients via Codama renderers

## Repository structure recommendation
- `programs/<name>/` (program source)
- `idl/<name>.json` (Anchor/Shank IDL)
- `codama/<name>.json` (Codama IDL)
- `clients/ts/<name>/` (generated TS client)
- `clients/rust/<name>/` (generated Rust client)

## Generation guardrails
- Codegen outputs should be checked into git if:
  - you need deterministic builds
  - you want users to consume the client without running codegen
- Otherwise, keep codegen in CI and publish artifacts.

## "Do not do this"
- Do not write IDLs by hand unless you have no alternative.
- Do not hand-write Borsh layouts for programs you own; use the IDL/codegen pipeline.
