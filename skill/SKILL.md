---
name: bnb-chain-dev
description: End-to-end BNB Chain ecosystem development playbook (Jan 2026). Covers BNB Smart Chain (BSC), opBNB Layer 2, and BNB Greenfield decentralized storage. Prefer Foundry for smart contract development, wagmi v2 + viem for frontend, Hardhat for complex deploy pipelines. Covers BEP-20/721/1155 tokens, top DeFi protocol integrations (PancakeSwap v4, Venus, Lista DAO, THENA), cross-chain via LayerZero v2/Stargate, account abstraction (ERC-4337), gas optimization, and security checklists for all three chains.
user-invocable: true
---

# BNB Chain Development Skill (Ecosystem-Wide)

## What this Skill is for
Use this Skill when the user asks for:
- Smart contract development on BNB Smart Chain (BSC)
- opBNB Layer 2 dApp development (OP Stack-based)
- BNB Greenfield decentralized storage integration
- DeFi protocol integrations (PancakeSwap, Venus, THENA, Lista DAO, etc.)
- Frontend dApp development with wagmi/viem/RainbowKit
- Token standards: BEP-20, BEP-721, BEP-1155
- Cross-chain messaging and bridging (LayerZero, Stargate, Wormhole)
- Account abstraction and gasless transactions (ERC-4337)
- Gas optimization patterns for BSC and opBNB
- Security auditing and vulnerability prevention
- MEV protection and transaction privacy on BSC

## BNB Chain ecosystem overview
The BNB ecosystem consists of three complementary chains:
- **BNB Smart Chain (BSC)**: EVM-compatible L1 with ~3s block times, ~30M gas limit, validator set via staking. Chain ID: 56 (mainnet), 97 (testnet).
- **opBNB**: High-throughput L2 built on OP Stack, settles to BSC. ~1s block times, ~100M gas limit, ultra-low fees. Chain ID: 204 (mainnet), 5611 (testnet).
- **BNB Greenfield**: Decentralized object storage with on-chain permissions. Uses Cosmos SDK. Chain ID: 1017 (mainnet), 5600 (testnet).

## Default stack decisions (opinionated)

### 1. Smart contracts: Foundry-first
- Use Foundry (forge, cast, anvil, chisel) as primary toolchain.
- Solidity ^0.8.25 with `via-ir` for production builds.
- OpenZeppelin Contracts v5.x for battle-tested base contracts.
- Use Hardhat only when you need complex TypeScript deploy scripts or plugin ecosystems.

### 2. Frontend: wagmi v2 + viem
- Use `wagmi` v2 for React hooks (connect, read, write, wait for tx).
- Use `viem` directly for non-React or server-side chain interaction.
- Prefer RainbowKit or Web3Modal for wallet connection UI.
- Use `@tanstack/react-query` for caching (wagmi v2 dependency).

### 3. Token standards
- BEP-20 = ERC-20 on BSC. Use OpenZeppelin ERC20.
- BEP-721 = ERC-721 on BSC. Use OpenZeppelin ERC721.
- BEP-1155 = ERC-1155 on BSC. Use OpenZeppelin ERC1155.
- Prefer ERC-2612 (permit) for gasless approvals.

### 4. DeFi integrations
- PancakeSwap v4 for swaps (Singleton + Hooks architecture).
- Venus Protocol for lending/borrowing.
- Lista DAO for liquid staking (slisBNB) and CDP (lisUSD).
- THENA for ve(3,3) concentrated liquidity.

### 5. Testing
- Foundry `forge test` for unit/fuzz/invariant tests (fast, Solidity-native).
- Hardhat for TypeScript integration tests when needed.
- Fork testing with `--fork-url` against BSC mainnet for realistic state.
- Use Tenderly or custom devnets for staging.

### 6. Cross-chain
- LayerZero v2 OApp/OFT for omnichain messaging and tokens.
- Stargate v2 for cross-chain liquidity transfers.
- Native BSC ↔ opBNB bridge for L1/L2 asset movement.

## Operating procedure (how to execute tasks)

### 1. Classify the task layer
- **Contract layer**: Solidity smart contracts, upgrades, protocol logic
- **Frontend/dApp layer**: React UI, wallet connection, tx UX
- **DeFi integration layer**: Protocol interactions, swaps, lending, staking
- **L2/opBNB layer**: L2-specific patterns, bridging, fee optimization
- **Storage/Greenfield layer**: Object storage, permissions, data availability
- **Cross-chain layer**: Multi-chain messaging, bridging, OFT/OApp
- **Testing/CI layer**: Unit, integration, fork, fuzz, invariant tests
- **Infra layer**: RPC, indexing (The Graph/Subquery), monitoring

### 2. Pick the right building blocks
- Smart contracts: Foundry + OpenZeppelin v5.
- Frontend: wagmi v2 + viem + RainbowKit.
- DeFi: Protocol-specific SDKs and router contracts.
- L2: opBNB-specific RPC + L1/L2 messaging contracts.
- Storage: Greenfield SDK + SP (Storage Provider) APIs.
- Cross-chain: LayerZero v2 OApp contracts.

### 3. Implement with BNB-specific correctness
Always be explicit about:
- **Chain ID**: BSC (56/97), opBNB (204/5611), Greenfield (1017/5600)
- **RPC endpoints**: Use official or NodeReal/Ankr/QuickNode endpoints
- **Gas pricing**: BSC uses EIP-1559 (baseFee + priorityFee); opBNB has minimal fees
- **Block finality**: BSC ~15 blocks (~45s), opBNB settles to BSC
- **Token addresses**: WBNB, BUSD, USDT, USDC differ per chain — always verify
- **Contract verification**: Verify on BscScan / opBNBScan after deployment

### 4. Add tests
- Unit tests: `forge test` with Solidity test contracts.
- Fuzz tests: `forge test` with fuzz inputs for edge cases.
- Invariant tests: `forge test` for protocol invariants.
- Fork tests: `forge test --fork-url $BSC_RPC` for mainnet state.
- Integration tests: Hardhat scripts or Foundry scripts with broadcast.

### 5. Deliverables expectations
When implementing changes, provide:
- Exact files changed + diffs
- Commands to install/build/test/deploy
- Contract addresses and verification commands
- A short "risk notes" section for anything touching funds/approvals/bridges
- Gas estimates for key operations

## Progressive disclosure (read when needed)
- Smart contracts (Solidity): [smart-contracts-solidity.md](smart-contracts-solidity.md)
- Frontend (wagmi/viem): [frontend-wagmi-viem.md](frontend-wagmi-viem.md)
- Testing strategy: [testing.md](testing.md)
- Token standards (BEP-20/721/1155): [tokens-nfts.md](tokens-nfts.md)
- DeFi protocol integrations: [defi-protocols.md](defi-protocols.md)
- opBNB Layer 2: [opbnb.md](opbnb.md)
- BNB Greenfield storage: [greenfield.md](greenfield.md)
- Cross-chain (LayerZero/Stargate): [cross-chain.md](cross-chain.md)
- Account abstraction (ERC-4337): [account-abstraction.md](account-abstraction.md)
- Gas optimization: [gas-optimization.md](gas-optimization.md)
- Security checklist: [security.md](security.md)
- Reference links: [resources.md](resources.md)
