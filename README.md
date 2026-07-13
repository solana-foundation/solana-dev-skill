# Solana Development Skill

A comprehensive [Agent Skill](https://agentskills.io/) for modern Solana development (July 2026 best practices). Works with every coding agent that has direct Agent Skills support: **Claude Code, OpenAI Codex / ChatGPT desktop, GitHub Copilot (CLI + coding agent), Gemini CLI, Cursor, Windsurf, Cline, OpenCode**, and anything else that reads `SKILL.md`.

## Overview

This skill gives your coding agent deep knowledge of the current Solana development ecosystem:

- **SDK**: `@solana/kit` v7 plugin clients (`createClient()` + `.use()`)
- **UI**: Wallet Standard connection via `@solana/kit-plugin-wallet` + `@solana/react`
- **Legacy Interop**: web3.js v3 — the classic API rebuilt on Kit internals
- **Programs**: Anchor 1.1.x (default), Pinocchio 0.11+ for high-performance needs
- **Testing**: Surfpool for integration tests (mainnet forking, cheatcodes, embedded SDK), LiteSVM/Mollusk for unit tests
- **Codegen**: Codama-first IDL and client generation
- **Security**: Comprehensive vulnerability patterns and prevention
- **Toolchain**: Version compatibility, common errors, and troubleshooting guides

## Installation

### Quick install (any agent, via skills.sh)

```bash
npx skills add solana-foundation/solana-dev-skill
```

The [skills CLI](https://www.skills.sh/) detects your installed agents and installs (or symlinks) the skill for each of them.

### Install script

```bash
git clone https://github.com/solana-foundation/solana-dev-skill
cd solana-dev-skill
./install.sh            # user-level: ~/.agents/skills + ~/.claude/skills
./install.sh --project  # project-level: .agents/skills + .claude/skills
./install.sh --link     # symlink instead of copy (auto-updates with git pull)
```

### Manual install

Copy (or symlink) `skills/solana-dev/` into your agent's skills directory:

| Agent | Project directory | Personal directory |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenAI Codex / ChatGPT desktop | `.agents/skills/` | `~/.agents/skills/` |
| GitHub Copilot (CLI, coding agent, VS Code) | `.github/skills/` or `.agents/skills/` | `~/.copilot/skills/` or `~/.agents/skills/` |
| Gemini CLI | `.gemini/skills/` or `.agents/skills/` | `~/.gemini/skills/` or `~/.agents/skills/` |
| Cursor | `.cursor/skills/` or `.agents/skills/` | `~/.cursor/skills/` or `~/.agents/skills/` |
| Windsurf | `.windsurf/skills/` or `.agents/skills/` | `~/.codeium/windsurf/skills/` |
| Cline | `.cline/skills/` or `.claude/skills/` | `~/.cline/skills/` |
| OpenCode | `.opencode/skills/` or `.agents/skills/` | `~/.config/opencode/skills/` |

`.agents/skills/` (cross-agent convention) plus `.claude/skills/` together cover all of the above.

## Skill Structure

```
skills/solana-dev/
├── SKILL.md                         # Main skill definition (required)
└── references/
    ├── kit/                         # @solana/kit: overview, plugins, react, codecs, accounts, codama, gotchas, advanced, programs/
    ├── frontend.md                  # UI patterns (Kit wallet plugin + @solana/react)
    ├── kit-web3-interop.md          # web3.js v3 boundary + v1 migration
    ├── testing.md                   # Testing (Surfpool/LiteSVM/Mollusk)
    ├── idl-codegen.md               # IDL and client generation
    ├── payments.md                  # Payments (Kit, Solana Pay, Kora)
    ├── security.md                  # Security vulnerabilities & prevention
    ├── resources.md                 # Curated reference links
    ├── compatibility-matrix.md      # Version compatibility tables (Anchor/Solana/Rust/GLIBC)
    ├── common-errors.md             # Error message → solution mappings
    ├── confidential-transfers.md    # Confidential transfers (Token-2022 ZK)
    ├── rpc-quick-lookups.md         # One-shot RPC reads via curl
    ├── programs/
    │   ├── anchor.md                # Anchor program development
    │   └── pinocchio.md             # Pinocchio (high-performance native)
    ├── anchor/
    │   └── migrating-v0.32-to-v1.md # Anchor v1 migration
    └── surfpool/
        ├── overview.md              # Surfpool local network guide
        └── cheatcodes.md            # Surfpool cheatcodes reference (26 surfnet_* methods)
```

## Usage

Once installed, your agent will automatically use this skill when you ask about:

- Solana dApp UI work (React / Next.js)
- Wallet connection and signing flows
- Transaction building, sending, and confirmation UX
- On-chain program development (Anchor or Pinocchio)
- Client SDK generation (typed program clients)
- Local testing (Surfpool, LiteSVM, Mollusk)
- Security hardening and audit-style reviews
- Surfpool local network setup and cheatcodes
- **Toolchain issues** (version mismatches, GLIBC errors, dependency conflicts)
- **Migration** between Anchor/Solana CLI versions, and web3.js v1 → v3

### Example Prompts

```
"Help me set up a Next.js app with Solana wallet connection"
"Create an Anchor program for a simple escrow"
"Convert this Anchor program to Pinocchio for better CU efficiency"
"Migrate this web3.js v1 script to web3.js v3"
"Write Surfpool integration tests for my token transfer flow"
"Review this program for security issues"
"I'm getting GLIBC_2.39 not found when running anchor"
"Help me upgrade from Anchor 0.32 to 1.1"
"What versions of Solana CLI work with Anchor 1.1?"
"Run Surfpool and create an account with 100 SOL and USDC"
```

## Stack Decisions

This skill encodes opinionated best practices:

| Layer | Default Choice | Alternative |
|-------|---------------|-------------|
| Client SDK | @solana/kit v7 (plugin clients) | web3.js v3 (legacy codebases) |
| Wallet / UI | @solana/kit-plugin-wallet + @solana/react | Wallet Standard hooks directly |
| Program Framework | Anchor 1.1.x | Pinocchio 0.11+ (performance) |
| Unit Testing | LiteSVM / Mollusk | — |
| Integration Testing | Surfpool (CLI or embedded @solana/surfpool) | solana-test-validator |
| Client Generation | Codama | — |

## Content Sources

This skill incorporates best practices from:

- [Blueshift Learning Platform](https://learn.blueshift.gg/) - Comprehensive Solana courses
- [Solana Official Documentation](https://solana.com/docs)
- [Solana Kit](https://www.solanakit.com/) - Kit docs and plugin ecosystem
- [solana-web3.js v3](https://github.com/solana-foundation/solana-web3.js/tree/v3.x) - Classic API on Kit internals
- [Anza/Pinocchio](https://github.com/anza-xyz/pinocchio) - Zero-dependency program development
- [LiteSVM](https://github.com/LiteSVM/litesvm) - Lightweight testing
- [Surfpool](https://docs.surfpool.run/) - Integration testing with mainnet state

## Progressive Disclosure

The skill follows the [Agent Skills](https://agentskills.io/specification) progressive disclosure pattern: the main `SKILL.md` provides core guidance, and agents read the specialized markdown files under `references/` only when needed for specific tasks.

## Benchmarks

`tests/run.ts` contains a small benchmark suite that checks skill trigger matching and MCP auto-install behavior:

```bash
cd tests && npm install && npx tsx run.ts
```

## Contributing

Contributions are welcome! Please ensure any updates reflect current Solana ecosystem best practices.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
