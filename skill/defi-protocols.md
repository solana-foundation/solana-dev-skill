# DeFi Protocol Integrations on BNB Chain

## Ecosystem Overview

| Protocol | Category | TVL Rank | Key Feature |
|----------|----------|----------|-------------|
| PancakeSwap | DEX (AMM) | #1 | v4 Hooks, concentrated liquidity |
| Venus Protocol | Lending | #2 | Isolated markets, VAI stablecoin |
| Lista DAO | Liquid Staking + CDP | #3 | slisBNB, lisUSD |
| THENA | DEX (ve3,3) | #4 | Concentrated liquidity, veTHE |
| Alpaca Finance | Leveraged Yield | #5 | Leveraged farming, lending |
| Stargate | Cross-chain bridge | #6 | Unified liquidity, LayerZero |
| Radiant Capital | Cross-chain lending | #7 | Omnichain lending (LayerZero) |
| Wombat Exchange | Stableswap | #8 | Single-sided stableswap |
| Biswap | DEX | #9 | v3 concentrated liquidity |
| Kinza Finance | Lending | #10 | Aave v3 fork on BSC |

---

## PancakeSwap v4

### Architecture
PancakeSwap v4 uses a **Singleton** pool model (all pools in one contract) with a **Hooks** system for extensibility.

### Swap via Smart Router
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IPancakeSwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(
        ExactInputSingleParams calldata params
    ) external payable returns (uint256 amountOut);
}

contract PancakeSwapper {
    IPancakeSwapRouter public immutable router;
    address constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955;

    constructor(address _router) {
        router = IPancakeSwapRouter(_router);
    }

    function swapBNBForUSDT(uint256 minOut) external payable {
        router.exactInputSingle{value: msg.value}(
            IPancakeSwapRouter.ExactInputSingleParams({
                tokenIn: WBNB,
                tokenOut: USDT,
                fee: 2500,  // 0.25% fee tier
                recipient: msg.sender,
                amountIn: msg.value,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );
    }
}
```

### PancakeSwap v4 Hooks (custom pool logic)
```solidity
import {BaseHook} from "@pancakeswap/v4-core/src/pool-cl/base/BaseHook.sol";
import {PoolKey} from "@pancakeswap/v4-core/src/types/PoolKey.sol";
import {Hooks} from "@pancakeswap/v4-core/src/libraries/Hooks.sol";

contract MyCustomHook is BaseHook {
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnsDelta: false,
            afterSwapReturnsDelta: false,
            afterAddLiquidityReturnsDelta: false,
            afterRemoveLiquidityReturnsDelta: false
        });
    }

    function beforeSwap(
        address sender,
        PoolKey calldata key,
        ICLPoolManager.SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Custom pre-swap logic (dynamic fees, TWAP oracle, etc.)
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
```

### Frontend integration (wagmi + PancakeSwap SDK)
```typescript
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, parseUnits } from "viem";

function useSwapBNBForToken(routerAddress: `0x${string}`) {
  const { writeContract, data: hash, isPending } = useWriteContract();

  async function swap(amountIn: string, minOut: string, tokenOut: `0x${string}`) {
    writeContract({
      address: routerAddress,
      abi: pancakeRouterAbi,
      functionName: "exactInputSingle",
      args: [{
        tokenIn: WBNB_ADDRESS,
        tokenOut,
        fee: 2500,
        recipient: address,
        amountIn: parseEther(amountIn),
        amountOutMinimum: parseUnits(minOut, 18),
        sqrtPriceLimitX96: 0n,
      }],
      value: parseEther(amountIn),
    });
  }

  return { swap, hash, isPending };
}
```

---

## Venus Protocol

### Lending/Borrowing
Venus is the dominant lending protocol on BSC (Compound/Aave-style).

```solidity
interface IVToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeem(uint256 redeemTokens) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function balanceOfUnderlying(address owner) external returns (uint256);
    function borrowBalanceCurrent(address account) external returns (uint256);
}

interface IComptroller {
    function enterMarkets(address[] calldata vTokens) external returns (uint256[] memory);
    function getAccountLiquidity(address account)
        external view returns (uint256 error, uint256 liquidity, uint256 shortfall);
}

contract VenusLender {
    IComptroller public comptroller;
    IVToken public vUSDT;
    IERC20 public usdt;

    function supplyAndBorrow(uint256 supplyAmount, uint256 borrowAmount) external {
        // 1. Supply collateral
        usdt.transferFrom(msg.sender, address(this), supplyAmount);
        usdt.approve(address(vUSDT), supplyAmount);
        require(vUSDT.mint(supplyAmount) == 0, "Mint failed");

        // 2. Enter market (enable as collateral)
        address[] memory markets = new address[](1);
        markets[0] = address(vUSDT);
        comptroller.enterMarkets(markets);

        // 3. Borrow
        require(vUSDT.borrow(borrowAmount) == 0, "Borrow failed");

        // 4. Transfer borrowed tokens to user
        usdt.transfer(msg.sender, borrowAmount);
    }
}
```

### Venus Isolated Markets (v4)
Venus v4 introduced isolated risk pools — each pool has independent collateral and risk parameters.

```solidity
interface IPoolRegistry {
    function getPoolByComptroller(address comptroller)
        external view returns (VenusPool memory);
}

// Each isolated pool has its own Comptroller
// Check pool-specific parameters before interacting
```

---

## Lista DAO

### Liquid Staking (slisBNB)
Lista DAO offers BNB liquid staking with slisBNB (staked liquid BNB).

```solidity
interface IListaStakeManager {
    function deposit() external payable;          // Stake BNB, receive slisBNB
    function requestWithdraw(uint256 amount) external; // Request unstake
    function claimWithdraw(uint256 idx) external;      // Claim after cooldown
    function convertBnbToSnBnb(uint256 amount) external view returns (uint256);
    function convertSnBnbToBnb(uint256 amount) external view returns (uint256);
}

// BSC Mainnet: Lista Stake Manager
// slisBNB token: 0xB0b84D294e0C75A6abe60171b70edEb2EFd14A1B
```

### CDP (lisUSD)
Lista DAO's CDP allows borrowing lisUSD against collateral.

```solidity
interface IListaInteraction {
    function deposit(
        address participant,
        address token,
        uint256 amount
    ) external;

    function borrow(
        address participant,
        address token,
        uint256 amount
    ) external;

    function payback(
        address participant,
        address token,
        uint256 amount
    ) external;

    function withdraw(
        address participant,
        address token,
        uint256 amount
    ) external;
}
```

---

## THENA (ve(3,3) DEX)

### Concentrated Liquidity + veToken model
THENA implements Solidly's ve(3,3) model with concentrated liquidity.

```solidity
interface ITHENARouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Route[] calldata routes,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        Route[] calldata routes
    ) external view returns (uint256[] memory amounts);
}

// veTHE locking for governance + fee sharing
interface IVotingEscrow {
    function createLock(uint256 amount, uint256 lockDuration) external returns (uint256 tokenId);
    function increaseAmount(uint256 tokenId, uint256 amount) external;
    function increaseUnlockTime(uint256 tokenId, uint256 lockDuration) external;
    function withdraw(uint256 tokenId) external;
}
```

---

## Chainlink Oracles on BSC

### Price feed integration
```solidity
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract PriceConsumer {
    AggregatorV3Interface internal bnbUsdFeed;
    AggregatorV3Interface internal ethUsdFeed;

    // BSC Mainnet feeds
    constructor() {
        bnbUsdFeed = AggregatorV3Interface(0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE);
        ethUsdFeed = AggregatorV3Interface(0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e);
    }

    function getBnbPrice() public view returns (uint256) {
        (, int256 price,, uint256 updatedAt,) = bnbUsdFeed.latestRoundData();
        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt < 3600, "Stale price");
        return uint256(price); // 8 decimals
    }
}
```

### Common BSC Chainlink feeds
| Pair | Address | Decimals |
|------|---------|----------|
| BNB/USD | `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE` | 8 |
| ETH/USD | `0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e` | 8 |
| BTC/USD | `0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf` | 8 |
| USDT/USD | `0xB97Ad0E74fa7d920791E90258A6E2085088b4320` | 8 |

---

## Yield Aggregation Pattern

### Auto-compounding vault (ERC-4626)
```solidity
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AutoCompoundVault is ERC4626 {
    using SafeERC20 for IERC20;

    constructor(IERC20 asset_)
        ERC4626(asset_)
        ERC20("Auto-Compound Vault", "acvToken")
    {}

    function harvest() external {
        // 1. Claim rewards from underlying protocol
        // 2. Swap rewards to underlying asset
        // 3. Deposit back into protocol
        // ERC4626 totalAssets() automatically reflects increased balance
    }

    function totalAssets() public view override returns (uint256) {
        // Return underlying balance including any pending rewards
        return _underlyingProtocolBalance();
    }

    function _underlyingProtocolBalance() internal view returns (uint256) {
        // Query underlying protocol for deposited + accrued amount
    }
}
```

## Integration Best Practices

1. **Always verify contract addresses** — use BscScan to confirm before integrating
2. **Check token decimals** — BSC tokens can have 6, 8, 9, or 18 decimals
3. **Handle fee-on-transfer tokens** — many BSC tokens take a % on transfer
4. **Use SafeERC20** — not all BSC tokens return `bool` from transfer
5. **Set slippage protection** — AMM swaps need `minAmountOut` and `deadline`
6. **Use multicall** — batch reads to reduce RPC calls (BSC has rate limits)
7. **Test on fork** — always fork-test protocol interactions before mainnet
