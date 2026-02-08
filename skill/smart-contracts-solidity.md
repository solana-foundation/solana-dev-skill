# Smart Contract Development on BNB Chain

## Toolchain Setup

### Foundry (preferred)
```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Create project
forge init my-bnb-project
cd my-bnb-project

# Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-commit

# remappings.txt
echo '@openzeppelin/=lib/openzeppelin-contracts/' > remappings.txt
```

### Hardhat (alternative)
```bash
npx hardhat init
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts@^5.1.0
```

### foundry.toml — BSC configuration
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.25"
via_ir = true
optimizer = true
optimizer_runs = 200
evm_version = "cancun"

[rpc_endpoints]
bsc = "${BSC_RPC_URL}"
bsc_testnet = "https://data-seed-prebsc-1-s1.binance.org:8545"
opbnb = "https://opbnb-mainnet-rpc.bnbchain.org"
opbnb_testnet = "https://opbnb-testnet-rpc.bnbchain.org"

[etherscan]
bsc = { key = "${BSCSCAN_API_KEY}", url = "https://api.bscscan.com/api" }
bsc_testnet = { key = "${BSCSCAN_API_KEY}", url = "https://api-testnet.bscscan.com/api" }
opbnb = { key = "${BSCSCAN_API_KEY}", url = "https://api-opbnb.bscscan.com/api" }
```

### hardhat.config.ts — BSC configuration
```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
      chainId: 56,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
    opbnb: {
      url: "https://opbnb-mainnet-rpc.bnbchain.org",
      chainId: 204,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
    opbnbTestnet: {
      url: "https://opbnb-testnet-rpc.bnbchain.org",
      chainId: 5611,
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      bsc: process.env.BSCSCAN_API_KEY || "",
      bscTestnet: process.env.BSCSCAN_API_KEY || "",
      opbnb: process.env.BSCSCAN_API_KEY || "",
      opbnbTestnet: process.env.BSCSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "opbnb",
        chainId: 204,
        urls: {
          apiURL: "https://api-opbnb.bscscan.com/api",
          browserURL: "https://opbnb.bscscan.com",
        },
      },
      {
        network: "opbnbTestnet",
        chainId: 5611,
        urls: {
          apiURL: "https://api-opbnb-testnet.bscscan.com/api",
          browserURL: "https://opbnb-testnet.bscscan.com",
        },
      },
    ],
  },
};

export default config;
```

## Solidity Patterns for BSC

### Contract structure (Foundry style)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MyBSCToken is ERC20, Ownable, ReentrancyGuard {
    constructor() ERC20("My Token", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
```

### Upgradeable contracts (UUPS pattern — preferred on BSC)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyVaultV1 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    uint256 public totalDeposits;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
    }

    function deposit() external payable {
        totalDeposits += msg.value;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
```

### Deployment scripts (Foundry)
```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Script, console} from "forge-std/Script.sol";
import {MyBSCToken} from "../src/MyBSCToken.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MyBSCToken token = new MyBSCToken();
        console.log("Token deployed to:", address(token));

        vm.stopBroadcast();
    }
}
```

```bash
# Deploy to BSC testnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url bsc_testnet \
  --broadcast \
  --verify \
  -vvvv

# Deploy to BSC mainnet
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url bsc \
  --broadcast \
  --verify \
  --slow \
  -vvvv
```

### Verification
```bash
# Foundry verification
forge verify-contract <CONTRACT_ADDRESS> src/MyBSCToken.sol:MyBSCToken \
  --chain-id 56 \
  --etherscan-api-key $BSCSCAN_API_KEY

# Hardhat verification
npx hardhat verify --network bsc <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

## Common BSC Contract Patterns

### WBNB wrapping/unwrapping
```solidity
interface IWBNB {
    function deposit() external payable;
    function withdraw(uint256 wad) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

// BSC Mainnet WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
// BSC Testnet WBNB: 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd
```

### Multicall pattern (batch reads)
```solidity
import {Multicall} from "@openzeppelin/contracts/utils/Multicall.sol";

contract MyContract is Multicall {
    // All public/external functions become batchable
    function getBalance(address user) external view returns (uint256) { ... }
    function getStake(address user) external view returns (uint256) { ... }
}
```

### Timelock + AccessControl for governance
```solidity
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract Governed is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    constructor(address timelock, address guardian) {
        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        _grantRole(OPERATOR_ROLE, timelock);
        _grantRole(GUARDIAN_ROLE, guardian);
    }
}
```

### Flash loan receiver (PancakeSwap v3 style)
```solidity
interface IPancakeV3FlashCallback {
    function pancakeV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}

contract FlashLoanReceiver is IPancakeV3FlashCallback {
    address immutable pool;

    function pancakeV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external {
        require(msg.sender == pool, "unauthorized");
        // Execute arbitrage / liquidation logic here
        // Repay: transfer borrowed + fee back to pool
    }
}
```

## Key Contract Addresses (BSC Mainnet)

| Contract | Address |
|----------|---------|
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` |
| BUSD | `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56` |
| USDT (BSC) | `0x55d398326f99059fF775485246999027B3197955` |
| USDC (BSC) | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` |
| PancakeSwap v3 Factory | `0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865` |
| PancakeSwap v3 Router | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` |
| Venus Comptroller | `0xfD36E2c2a6789Db23113685031d7F16329158384` |
| Chainlink BNB/USD | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` |

## Solidity version and EVM compatibility
- BSC supports up to Cancun EVM (transient storage, blob opcodes not relevant for BSC but opcodes are available).
- Use `pragma solidity ^0.8.25` for latest stable features.
- `PUSH0` opcode is supported (Solidity >=0.8.20 default).
- BSC has a 30M block gas limit — design contracts accordingly.
- opBNB has a 100M block gas limit — more headroom for complex operations.
