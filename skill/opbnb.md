# opBNB Layer 2 Development

## Overview
opBNB is an EVM-compatible Layer 2 built on the **OP Stack** (Optimism's modular rollup framework). It settles transaction batches to BNB Smart Chain (BSC) as the data availability (DA) layer.

### Key characteristics
| Property | Value |
|----------|-------|
| Type | Optimistic Rollup |
| Base framework | OP Stack (Bedrock) |
| Settlement layer | BNB Smart Chain (BSC) |
| Block time | ~1 second |
| Block gas limit | 100M (vs BSC's 30M) |
| Chain ID (mainnet) | 204 |
| Chain ID (testnet) | 5611 |
| Native token | BNB (same as BSC) |
| Challenge period | 7 days |
| Avg tx cost | < $0.001 |

## Network Configuration

### RPC Endpoints
```
# Mainnet
https://opbnb-mainnet-rpc.bnbchain.org
wss://opbnb-mainnet-rpc.bnbchain.org

# Testnet
https://opbnb-testnet-rpc.bnbchain.org
wss://opbnb-testnet-rpc.bnbchain.org
```

### Foundry configuration
```toml
# foundry.toml
[rpc_endpoints]
opbnb = "https://opbnb-mainnet-rpc.bnbchain.org"
opbnb_testnet = "https://opbnb-testnet-rpc.bnbchain.org"

[etherscan]
opbnb = { key = "${BSCSCAN_API_KEY}", url = "https://api-opbnb.bscscan.com/api" }
opbnb_testnet = { key = "${BSCSCAN_API_KEY}", url = "https://api-opbnb-testnet.bscscan.com/api" }
```

### Hardhat configuration
```typescript
networks: {
  opbnb: {
    url: "https://opbnb-mainnet-rpc.bnbchain.org",
    chainId: 204,
    accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    gasPrice: 1000000008, // 1 gwei + 8 (L2 minimum)
  },
  opbnbTestnet: {
    url: "https://opbnb-testnet-rpc.bnbchain.org",
    chainId: 5611,
    accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
  },
}
```

### viem chain definition
```typescript
import { defineChain } from "viem";

export const opBNB = defineChain({
  id: 204,
  name: "opBNB",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://opbnb-mainnet-rpc.bnbchain.org"] },
  },
  blockExplorers: {
    default: { name: "opBNBScan", url: "https://opbnb.bscscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});
```

## Deploying to opBNB

### Foundry deployment
```bash
# Deploy to opBNB testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url opbnb_testnet \
  --broadcast \
  --verify \
  -vvvv

# Deploy to opBNB mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url opbnb \
  --broadcast \
  --verify \
  --slow \
  -vvvv
```

### Verification on opBNBScan
```bash
forge verify-contract <ADDRESS> src/MyContract.sol:MyContract \
  --chain-id 204 \
  --etherscan-api-key $BSCSCAN_API_KEY \
  --verifier-url "https://api-opbnb.bscscan.com/api"
```

## L1 ↔ L2 Bridging

### Native bridge (BSC ↔ opBNB)
opBNB uses the OP Stack's built-in bridge contracts for moving assets between BSC (L1) and opBNB (L2).

```solidity
// L1 → L2 (Deposit): Called on BSC
interface IL1StandardBridge {
    function depositETH(
        uint32 minGasLimit,
        bytes calldata extraData
    ) external payable;

    function depositERC20(
        address l1Token,
        address l2Token,
        uint256 amount,
        uint32 minGasLimit,
        bytes calldata extraData
    ) external;
}

// L2 → L1 (Withdraw): Called on opBNB
interface IL2StandardBridge {
    function withdraw(
        address l2Token,
        uint256 amount,
        uint32 minGasLimit,
        bytes calldata extraData
    ) external payable;
}
```

### L1 → L2 message passing
```solidity
// Send a message from BSC to opBNB
interface IL1CrossDomainMessenger {
    function sendMessage(
        address target,
        bytes calldata message,
        uint32 minGasLimit
    ) external payable;
}

// Receive on opBNB
contract L2Receiver {
    address public l1Sender;
    IL2CrossDomainMessenger public messenger;

    function receiveMessage(uint256 value) external {
        require(
            msg.sender == address(messenger),
            "Only messenger"
        );
        require(
            messenger.xDomainMessageSender() == l1Sender,
            "Wrong L1 sender"
        );
        // Process cross-chain message
    }
}
```

### Bridge timing
| Direction | Time | Notes |
|-----------|------|-------|
| L1 → L2 (Deposit) | ~3-5 minutes | Waits for BSC finality |
| L2 → L1 (Withdraw) | ~7 days | Challenge period |
| L2 → L1 (Forced) | ~7 days | Through L1 portal |

## opBNB-Specific Development Considerations

### Gas pricing
- opBNB has extremely low gas costs (< $0.001 per tx)
- L2 execution fee = L2 gas price × L2 gas used
- L1 data fee = L1 base fee × calldata size (compressed)
- The L1 data fee is the dominant cost component

### Reducing L1 data fees
```solidity
// Minimize calldata — L1 data fee is proportional to calldata size
// Use tight packing, smaller types, batch operations

// BAD: Large calldata
function processMany(address[] calldata users, uint256[] calldata amounts) external { ... }

// BETTER: Pack data or use Merkle proofs
function processBatch(bytes calldata packedData) external {
    // Decode packed (address, uint96) pairs — 32 bytes instead of 52
}

// Use events for data that doesn't need to be in calldata
// Emit events instead of storing large data on-chain
```

### Block gas limit
- opBNB has 100M block gas limit (vs BSC's 30M)
- This allows more complex transactions and larger batch operations
- Useful for gaming, social, and high-throughput dApps

### Deposit + withdrawal patterns
```typescript
// Frontend: Deposit BNB from BSC to opBNB
import { useWriteContract } from "wagmi";

function useDepositToOpBNB() {
  const { writeContract } = useWriteContract();

  function deposit(amount: bigint) {
    writeContract({
      address: L1_STANDARD_BRIDGE_ADDRESS,
      abi: l1StandardBridgeAbi,
      functionName: "depositETH",
      args: [200000, "0x"], // minGasLimit, extraData
      value: amount,
      chainId: 56, // Must be on BSC
    });
  }

  return { deposit };
}
```

## opBNB Use Cases

### Gaming
- Ultra-low fees enable in-game microtransactions
- 100M gas limit supports complex game logic on-chain
- Sub-second block times for responsive UX

### Social
- Gasless-feeling interactions (fees < $0.001)
- On-chain social graph and content hashes
- Batch operations for social actions (like, follow, share)

### High-frequency DeFi
- Order book DEXes benefit from low costs
- Frequent rebalancing and compounding
- Micro-yield farming strategies become viable

## Key Contract Addresses (opBNB Mainnet)

| Contract | Address |
|----------|---------|
| L1StandardBridge (on BSC) | Check BNB Chain docs for latest |
| L2StandardBridge (on opBNB) | `0x4200000000000000000000000000000000000010` |
| L2CrossDomainMessenger | `0x4200000000000000000000000000000000000007` |
| L2ToL1MessagePasser | `0x4200000000000000000000000000000000000016` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| WBNB (opBNB) | Check opBNBScan for canonical address |

## Testing for opBNB

### Fork test against opBNB
```bash
forge test --fork-url https://opbnb-mainnet-rpc.bnbchain.org --match-contract OpBNBTest
```

### Local dev setup
```bash
# Use anvil with opBNB fork
anvil --fork-url https://opbnb-mainnet-rpc.bnbchain.org --chain-id 204
```

## Migration from BSC to opBNB

Most Solidity contracts deploy to opBNB without changes since it's EVM-compatible. Key differences:
1. **Gas costs** — Much lower, so some gas optimizations may be unnecessary overhead
2. **Block time** — 1s vs 3s, adjust any time-based logic
3. **L1 data fee** — Optimize calldata size to reduce costs
4. **Precompiles** — Same EVM precompiles available
5. **Block gas limit** — 100M allows larger operations
6. **Finality** — Different model (optimistic with challenge period)
