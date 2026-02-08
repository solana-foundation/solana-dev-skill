# BNB Chain Development Resources

## Official Documentation
- [BNB Chain Documentation](https://docs.bnbchain.org/) — Main docs portal
- [BSC Developer Docs](https://docs.bnbchain.org/bnb-smart-chain/) — BNB Smart Chain specifics
- [opBNB Documentation](https://docs.bnbchain.org/opbnb/) — Layer 2 development
- [BNB Greenfield Docs](https://docs.bnbchain.org/greenfield/) — Decentralized storage
- [BNB Chain GitHub](https://github.com/bnb-chain) — Official repositories

## Block Explorers
- [BscScan](https://bscscan.com/) — BSC mainnet explorer
- [BscScan Testnet](https://testnet.bscscan.com/) — BSC testnet explorer
- [opBNBScan](https://opbnb.bscscan.com/) — opBNB mainnet explorer
- [opBNBScan Testnet](https://opbnb-testnet.bscscan.com/) — opBNB testnet explorer
- [GreenfieldScan](https://greenfieldscan.com/) — Greenfield explorer

## Development Tooling

### Smart Contracts
- [Foundry](https://book.getfoundry.sh/) — Forge, Cast, Anvil, Chisel
- [Hardhat](https://hardhat.org/docs) — TypeScript-first development
- [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/) — Battle-tested base contracts
- [OpenZeppelin Defender](https://docs.openzeppelin.com/defender/) — Deployment, monitoring, automation
- [Remix IDE](https://remix.ethereum.org/) — Browser-based Solidity IDE

### Frontend
- [wagmi v2](https://wagmi.sh/) — React hooks for Ethereum
- [viem](https://viem.sh/) — TypeScript Ethereum client
- [RainbowKit](https://www.rainbowkit.com/docs/) — Wallet connection UI
- [Web3Modal (AppKit)](https://docs.walletconnect.com/appkit/overview) — WalletConnect wallet UI
- [ethers.js v6](https://docs.ethers.org/v6/) — Legacy JS library (prefer viem)

### Testing
- [Foundry Testing](https://book.getfoundry.sh/forge/tests) — Solidity-native testing
- [Hardhat Testing](https://hardhat.org/hardhat-runner/docs/guides/test-contracts) — TypeScript testing
- [Tenderly](https://tenderly.co/) — Fork, simulate, debug

### Security
- [Slither](https://github.com/crytic/slither) — Static analysis (Trail of Bits)
- [Aderyn](https://github.com/Cyfrin/aderyn) — Rust-based static analysis
- [Mythril](https://github.com/Consensys/mythril) — Symbolic execution
- [Certora](https://www.certora.com/) — Formal verification
- [Forta](https://forta.org/) — Runtime threat detection

## DeFi Protocols

### DEX
- [PancakeSwap](https://docs.pancakeswap.finance/) — Dominant AMM on BSC
- [PancakeSwap v4 Docs](https://developer.pancakeswap.finance/contracts/v4/overview) — Hooks architecture
- [THENA](https://docs.thena.fi/) — ve(3,3) concentrated liquidity
- [Biswap](https://docs.biswap.org/) — BSC DEX

### Lending
- [Venus Protocol](https://docs.venus.io/) — BSC lending (Compound-style)
- [Kinza Finance](https://docs.kinza.finance/) — Aave v3 fork on BSC
- [Radiant Capital](https://docs.radiant.capital/) — Cross-chain lending

### Liquid Staking & CDP
- [Lista DAO](https://docs.lista.org/) — slisBNB + lisUSD
- [Ankr Staking](https://www.ankr.com/docs/staking/) — ankrBNB liquid staking
- [Stader Labs](https://www.staderlabs.com/docs/) — BNBx liquid staking

### Yield
- [Alpaca Finance](https://docs.alpacafinance.org/) — Leveraged yield farming
- [Beefy Finance](https://docs.beefy.finance/) — Yield optimizer
- [Autofarm](https://docs.autofarm.network/) — Yield aggregator

### Stableswap
- [Wombat Exchange](https://docs.wombat.exchange/) — Single-sided stableswap
- [Ellipsis Finance](https://docs.ellipsis.finance/) — Curve-style on BSC

## Cross-Chain
- [LayerZero v2](https://docs.layerzero.network/v2) — Omnichain messaging
- [Stargate v2](https://stargateprotocol.gitbook.io/stargate) — Cross-chain liquidity
- [Wormhole](https://docs.wormhole.com/) — Cross-chain messaging
- [Axelar](https://docs.axelar.dev/) — Cross-chain communication
- [Celer cBridge](https://cbridge-docs.celer.network/) — Cross-chain bridge

## Account Abstraction
- [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337) — Standard specification
- [Biconomy](https://docs.biconomy.io/) — Smart accounts + paymaster
- [ZeroDev](https://docs.zerodev.app/) — Kernel smart accounts
- [permissionless.js](https://docs.pimlico.io/permissionless) — Framework-agnostic AA
- [Pimlico](https://docs.pimlico.io/) — Bundler + paymaster infrastructure
- [Stackup](https://docs.stackup.sh/) — Bundler + paymaster

## Oracles
- [Chainlink (BSC)](https://docs.chain.link/data-feeds/price-feeds/addresses?network=bnb-chain) — Price feeds
- [Binance Oracle](https://oracle.binance.com/) — Binance-operated oracle
- [Pyth Network](https://docs.pyth.network/) — High-frequency price feeds
- [Band Protocol](https://docs.bandchain.org/) — Oracle for BSC

## Indexing & Data
- [The Graph (BSC)](https://thegraph.com/docs/) — Subgraph indexing
- [SubQuery](https://academy.subquery.network/) — Flexible indexing
- [Covalent](https://www.covalenthq.com/docs/) — Unified API
- [Moralis](https://docs.moralis.io/) — Web3 data API
- [NodeReal](https://docs.nodereal.io/) — BSC Enhanced API + MegaNode RPC

## RPC Providers
- [BNB Chain Official RPCs](https://docs.bnbchain.org/bnb-smart-chain/developers/rpc/) — Free public RPCs
- [NodeReal](https://nodereal.io/) — MegaNode (BSC-focused)
- [Ankr](https://www.ankr.com/rpc/bsc/) — Public + premium BSC RPCs
- [QuickNode](https://www.quicknode.com/chains/bsc) — BSC + opBNB
- [Alchemy](https://www.alchemy.com/) — BSC support
- [Infura](https://www.infura.io/) — BSC support

## BNB Greenfield
- [Greenfield JS SDK](https://github.com/bnb-chain/greenfield-js-sdk) — JavaScript/TypeScript
- [Greenfield Go SDK](https://github.com/bnb-chain/greenfield-go-sdk) — Go
- [Greenfield CLI](https://github.com/bnb-chain/greenfield-cmd) — Command line tool
- [DCellar](https://dcellar.io/) — Greenfield file manager UI

## Community & Learning
- [BNB Chain Blog](https://www.bnbchain.org/en/blog) — Official updates
- [BNB Chain Forum](https://forum.bnbchain.org/) — Governance discussion
- [BNB Chain Discord](https://discord.com/invite/bnbchain) — Developer community
- [BSC Ecosystem](https://www.bnbchain.org/en/bsc-ecosystem) — Project directory
- [BNB Chain Grants](https://www.bnbchain.org/en/bsc-mvb-program) — Builder grants

## Contract Verification
- [BscScan Verify](https://bscscan.com/verifyContract) — Web UI verification
- [Sourcify](https://sourcify.dev/) — Decentralized verification
- [Foundry Verify](https://book.getfoundry.sh/forge/verify-contract) — CLI verification
