---
name: solana-dev
description: Use when user asks to "build a Solana dapp", "write an Anchor program", "create a token", "debug Solana errors", "set up wallet connection", "test my Solana program", "deploy to devnet", or "explain Solana concepts" (rent, accounts, PDAs, CPIs, etc.). End-to-end Solana development playbook covering wallet connection, Anchor/Pinocchio programs, Codama client generation, LiteSVM/Mollusk/Surfpool testing, and security checklists. Integrates with the Solana MCP server for live documentation search. Prefers framework-kit (@solana/client + @solana/react-hooks) for UI, wallet-standard-first connection (incl. ConnectorKit), @solana/kit for client/RPC code, and @solana/web3-compat for legacy boundaries.
user-invocable: true
license: MIT
compatibility: Requires Node.js 18+, Rust toolchain, Solana CLI, Anchor CLI
metadata:
  author: Solana Foundation
  version: 1.1.0
---

# Solana Development Skill (framework-kit-first)

## What this Skill is for
Use this Skill when the user asks for:
- Solana dApp UI work (React / Next.js)
- Wallet connection + signing flows
- Transaction building / sending / confirmation UX
- On-chain program development (Anchor or Pinocchio)
- Client SDK generation (typed program clients)
- Local testing (LiteSVM, Mollusk, Surfpool)
- Security hardening and audit-style reviews
- Confidential transfers (Token-2022 ZK extension)
- **Toolchain setup, version mismatches, GLIBC errors, dependency conflicts**
- **Upgrading Anchor/Solana CLI versions, migration between versions**

## Default stack decisions (opinionated)
1) **UI: framework-kit first**
- Use `@solana/client` + `@solana/react-hooks`.
- Prefer Wallet Standard discovery/connect via the framework-kit client.

2) **SDK: @solana/kit first**
- Prefer Kit types (`Address`, `Signer`, transaction message APIs, codecs).
- Prefer `@solana-program/*` instruction builders over hand-rolled instruction data.

3) **Legacy compatibility: web3.js only at boundaries**
- If you must integrate a library that expects web3.js objects (`PublicKey`, `Transaction`, `Connection`),
  use `@solana/web3-compat` as the boundary adapter.
- Do not let web3.js types leak across the entire app; contain them to adapter modules.

4) **Programs**
- Default: Anchor (fast iteration, IDL generation, mature tooling).
- Performance/footprint: Pinocchio when you need CU optimization, minimal binary size,
  zero dependencies, or fine-grained control over parsing/allocations.

5) **Testing**
- Default: LiteSVM or Mollusk for unit tests (fast feedback, runs in-process).
- Use Surfpool for integration tests against realistic cluster state (mainnet/devnet) locally.
- Use solana-test-validator only when you need specific RPC behaviors not emulated by LiteSVM.

## Operating procedure (how to execute tasks)
When solving a Solana task:

### 1. Classify the task layer
- UI/wallet/hook layer
- Client SDK/scripts layer
- Program layer (+ IDL)
- Testing/CI layer
- Infra (RPC/indexing/monitoring)

### 2. Pick the right building blocks
- UI: framework-kit patterns.
- Scripts/backends: @solana/kit directly.
- Legacy library present: introduce a web3-compat adapter boundary.
- High-performance programs: Pinocchio over Anchor.

### 3. Implement with Solana-specific correctness
Always be explicit about:
- cluster + RPC endpoints + websocket endpoints
- fee payer + recent blockhash
- compute budget + prioritization (where relevant)
- expected account owners + signers + writability
- token program variant (SPL Token vs Token-2022) and any extensions

### 4. Add tests
- Unit test: LiteSVM or Mollusk.
- Integration test: Surfpool.
- For "wallet UX", add mocked hook/provider tests where appropriate.

### 5. Deliverables expectations
When you implement changes, provide:
- exact files changed + diffs (or patch-style output)
- commands to install/build/test
- a short "risk notes" section for anything touching signing/fees/CPIs/token transfers

## Solana MCP server (live docs + expert assistance)

The **Solana Developer MCP** gives you real-time access to the Solana docs corpus and Anchor-specific expertise. Use it before falling back to your training data.

### Auto-install

Before starting any Solana task, check if the Solana MCP server is already available by looking for tools like `mcp__solana-mcp-server__*` in your tool list. If the tools are **not** available, install the MCP server on the fly:

```bash
claude mcp add --transport http solana-mcp-server https://mcp.solana.com/mcp
```

Run this command via the Bash tool at the start of the conversation. The MCP server becomes available immediately after adding it.

### Available MCP tools

Once connected, you have access to these tools:

| Tool | When to use |
|------|-------------|
| **Solana Expert: Ask For Help** | How-to questions, concept explanations, API/SDK usage, error diagnosis |
| **Solana Documentation Search** | Look up current docs for specific topics (instructions, RPCs, token standards, etc.) |
| **Ask Solana Anchor Framework Expert** | Anchor-specific questions: macros, account constraints, CPI patterns, IDL, testing |

### When to reach for MCP tools
- **Always** when answering conceptual questions about Solana (rent, accounts model, transaction lifecycle, etc.)
- **Always** when debugging errors you're unsure about — search docs first
- **Before** recommending API patterns — confirm they match the latest docs
- **When** the user asks about Anchor macros, constraints, or version-specific behavior

## Progressive disclosure (read when needed)
- UI + wallet + hooks: [frontend-framework-kit.md](references/frontend-framework-kit.md)
- Kit ↔ web3.js boundary: [kit-web3-interop.md](references/kit-web3-interop.md)
- Anchor programs: [programs-anchor.md](references/programs-anchor.md)
- Pinocchio programs: [programs-pinocchio.md](references/programs-pinocchio.md)
- Testing strategy: [testing.md](references/testing.md)
- IDLs + codegen: [idl-codegen.md](references/idl-codegen.md)
- Payments: [payments.md](references/payments.md)
- Confidential transfers: [confidential-transfers.md](references/confidential-transfers.md)
- Security checklist: [security.md](references/security.md)
- Reference links: [resources.md](references/resources.md)
- **Version compatibility:** [compatibility-matrix.md](references/compatibility-matrix.md)
- **Common errors & fixes:** [common-errors.md](references/common-errors.md)
- **Surfpool (local network):** [surfpool.md](references/surfpool.md)
- **Surfpool cheatcodes:** [surfpool-cheatcodes.md](references/surfpool-cheatcodes.md)
- **Anchor v1 migration:** [anchor/migrating-v0.32-to-v1.md](references/anchor/migrating-v0.32-to-v1.md)
