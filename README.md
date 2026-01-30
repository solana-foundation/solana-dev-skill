# Solana Development Skill for Claude Code

A comprehensive Claude Code skill for modern Solana development (January 2026 best practices).

## Overview

This skill provides Claude Code with deep knowledge of the current Solana development ecosystem:

- **UI**: Solana Foundation framework-kit (`@solana/client` + `@solana/react-hooks`)
- **SDK**: `@solana/kit` (v5.x) for new client work
- **Legacy Interop**: `@solana/web3-compat` for bridging to web3.js dependencies
- **Programs**: Anchor (default), Pinocchio for high-performance needs
- **Testing**: LiteSVM/Mollusk for unit tests, Surfpool for integration
- **Codegen**: Codama-first IDL and client generation
- **Security**: Comprehensive vulnerability patterns and prevention

## Installation

### Quick Install

```bash
npx skills add https://github.com/solana-foundation/solana-dev-skill
```

### Manual Install

```bash
git clone https://github.com/solana-foundation/solana-dev-skill
cd solana-dev-skill
./install.sh
```

## Skill Structure

```
skill/
├── SKILL.md                    # Main skill definition (required)
├── frontend-framework-kit.md   # UI patterns with framework-kit
├── kit-web3-interop.md         # Kit ↔ web3.js boundary patterns
├── programs-anchor.md          # Anchor program development
├── programs-pinocchio.md       # Pinocchio (high-performance native)
├── testing.md                  # Testing (LiteSVM/Mollusk/Surfpool)
├── idl-codegen.md              # IDL and client generation
├── payments.md                 # Payments with Commerce Kit
├── security.md                 # Security vulnerabilities & prevention
└── resources.md                # Curated reference links
```

## Usage

Once installed, Claude Code will automatically use this skill when you ask about:

- Solana dApp UI work (React / Next.js)
- Wallet connection and signing flows
- Transaction building, sending, and confirmation UX
- On-chain program development (Anchor or Pinocchio)
- Client SDK generation (typed program clients)
- Local testing (LiteSVM, Mollusk, Surfpool)
- Security hardening and audit-style reviews

### Example Prompts

```
"Help me set up a Next.js app with Solana wallet connection"
"Create an Anchor program for a simple escrow"
"Convert this Anchor program to Pinocchio for better CU efficiency"
"How do I integrate a legacy web3.js library with my Kit-based app?"
"Write LiteSVM tests for my token transfer instruction"
"Review this program for security issues"
```

## Stack Decisions

This skill encodes opinionated best practices:

| Layer | Default Choice | Alternative |
|-------|---------------|-------------|
| UI Framework | framework-kit | ConnectorKit (headless) |
| Client SDK | @solana/kit | @solana/web3-compat (boundary) |
| Program Framework | Anchor | Pinocchio (performance) |
| Unit Testing | LiteSVM / Mollusk | - |
| Integration Testing | Surfpool | solana-test-validator |
| Client Generation | Codama | Kinobi (Umi) |

## Content Sources

This skill incorporates best practices from:

- [Blueshift Learning Platform](https://learn.blueshift.gg/) - Comprehensive Solana courses
- [Solana Official Documentation](https://solana.com/docs)
- [Anza/Pinocchio](https://github.com/anza-xyz/pinocchio) - Zero-dependency program development
- [LiteSVM](https://github.com/LiteSVM/litesvm) - Lightweight testing
- [Surfpool](https://docs.surfpool.dev/) - Integration testing with mainnet state

## Progressive Disclosure

The skill uses Claude Code's progressive disclosure pattern. The main `SKILL.md` provides core guidance, and Claude reads the specialized markdown files only when needed for specific tasks.

## Contributing

Contributions are welcome! Please ensure any updates reflect current Solana ecosystem best practices.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
