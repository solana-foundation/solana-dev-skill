# BNB Chain Development Skill for Claude Code

A comprehensive Claude Code skill for modern BNB Chain ecosystem development (January 2026 best practices).

## Overview

This skill provides Claude Code with deep knowledge of the entire BNB Chain development ecosystem:

- **Smart Contracts**: Solidity with Foundry (preferred) or Hardhat, OpenZeppelin v5
- **Frontend**: wagmi v2 + viem for React/Next.js dApps, RainbowKit/Web3Modal for wallets
- **BNB Smart Chain (BSC)**: EVM-compatible L1, DeFi integrations, token standards
- **opBNB**: High-throughput L2 (OP Stack), ultra-low fees, L1/L2 bridging
- **BNB Greenfield**: Decentralized storage, on-chain permissions, BSC cross-chain
- **DeFi**: PancakeSwap v4, Venus, Lista DAO, THENA, Chainlink oracles
- **Cross-Chain**: LayerZero v2 OApp/OFT, Stargate v2, Wormhole
- **Account Abstraction**: ERC-4337 smart accounts, paymasters, session keys
- **Security**: EVM vulnerability patterns, BSC-specific concerns, audit checklists
- **Gas Optimization**: Storage packing, calldata optimization, opBNB L1 data fees

## Installation

### Quick Install

```bash
npx skills add https://github.com/bnb-chain/bnb-chain-dev-skill
```

### Manual Install

```bash
git clone https://github.com/bnb-chain/bnb-chain-dev-skill
cd bnb-chain-dev-skill
./install.sh
```

## Skill Structure

```
skill/
├── SKILL.md                    # Main skill definition (required entry point)
├── smart-contracts-solidity.md # Solidity + Foundry/Hardhat on BSC
├── frontend-wagmi-viem.md      # wagmi v2 + viem + RainbowKit/Web3Modal
├── testing.md                  # Foundry tests, fuzz, invariant, fork testing
├── tokens-nfts.md              # BEP-20/721/1155 token standards
├── defi-protocols.md           # PancakeSwap, Venus, Lista, THENA integrations
├── opbnb.md                    # opBNB Layer 2 development
├── greenfield.md               # BNB Greenfield decentralized storage
├── cross-chain.md              # LayerZero v2, Stargate, Wormhole, native bridge
├── account-abstraction.md      # ERC-4337 smart accounts + paymasters
├── gas-optimization.md         # Gas optimization for BSC and opBNB
├── security.md                 # EVM security vulnerabilities + checklists
└── resources.md                # Curated reference links
```

## Usage

Once installed, Claude Code will automatically use this skill when you ask about:

- BNB Smart Chain smart contract development
- opBNB Layer 2 dApp development
- BNB Greenfield storage integration
- DeFi protocol integrations on BSC
- Frontend dApp development for BNB ecosystem
- Cross-chain messaging and token bridging
- Account abstraction and gasless transactions
- Security auditing and gas optimization

### Example Prompts

```
"Help me set up a Foundry project for BSC with OpenZeppelin v5"
"Create an ERC-4337 smart account with session keys for BSC"
"Build a PancakeSwap v4 hook that implements dynamic fees"
"Write Foundry fork tests for my Venus Protocol integration"
"Deploy my token to both BSC and opBNB with LayerZero OFT"
"Set up a Next.js app with wagmi v2 for BSC + opBNB"
"Upload files to BNB Greenfield and manage access with groups"
"Review this contract for reentrancy and flash loan vulnerabilities"
"Optimize my contract's gas usage for opBNB deployment"
```

## Stack Decisions

This skill encodes opinionated best practices:

| Layer | Default Choice | Alternative |
|-------|---------------|-------------|
| Smart Contracts | Foundry + Solidity ^0.8.25 | Hardhat (complex deploys) |
| Base Contracts | OpenZeppelin v5 | - |
| Frontend Framework | wagmi v2 + viem | ethers.js v6 (legacy) |
| Wallet UI | RainbowKit | Web3Modal (AppKit) |
| DEX Integration | PancakeSwap v4 | THENA, Biswap |
| Lending | Venus Protocol | Kinza Finance |
| Liquid Staking | Lista DAO (slisBNB) | Ankr (ankrBNB) |
| Cross-Chain | LayerZero v2 | Stargate, Wormhole |
| Account Abstraction | ERC-4337 (permissionless.js) | Biconomy, ZeroDev |
| Testing | Foundry (forge test) | Hardhat |
| Oracles | Chainlink | Binance Oracle, Pyth |
| L2 | opBNB | - |
| Storage | BNB Greenfield | IPFS/Arweave |

## Ecosystem Coverage

### Chains
- **BNB Smart Chain (BSC)**: Full development lifecycle
- **opBNB**: L2-specific patterns, L1/L2 bridging, fee optimization
- **BNB Greenfield**: Storage operations, access control, BSC cross-chain

### Segments
- Smart contract development (Solidity)
- Frontend dApp development (React/Next.js)
- DeFi protocol integration
- Token creation and management
- NFT development and marketplaces
- Cross-chain messaging and bridging
- Account abstraction and gasless UX
- Security auditing
- Gas optimization
- Decentralized storage

## Content Sources

This skill incorporates best practices from:

- [BNB Chain Official Documentation](https://docs.bnbchain.org/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/5.x/)
- [Foundry Book](https://book.getfoundry.sh/)
- [wagmi Documentation](https://wagmi.sh/)
- [LayerZero v2 Documentation](https://docs.layerzero.network/v2)
- [PancakeSwap Developer Docs](https://developer.pancakeswap.finance/)
- [Venus Protocol Documentation](https://docs.venus.io/)

## Progressive Disclosure

The skill uses Claude Code's progressive disclosure pattern. The main `SKILL.md` provides core guidance and ecosystem overview. Claude reads the specialized markdown files only when needed for specific tasks.

## Contributing

Contributions are welcome! Please ensure any updates reflect current BNB Chain ecosystem best practices.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
