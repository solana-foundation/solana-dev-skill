# Flash Trade TypeScript SDK Reference

Advanced integration path using `flash-sdk` for direct on-chain interaction. Use this when you need full control over transaction construction, custom program composition, or client-side computation.

**For most integrations, the [REST API](ApiReference.md) is simpler.** Use the SDK when you need:
- Client-side transaction building (no API dependency)
- Custom instruction composition with other Solana programs
- Direct on-chain view queries (ViewHelper)
- Composability flows (swap-and-open, close-and-swap)

## Setup

```typescript
import { PerpetualsClient, PoolConfig, Side, Privilege } from "flash-sdk";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const provider = new AnchorProvider(connection, wallet, { commitment: "processed" });

// Load pool config (canonical source of truth for pool addresses)
const poolConfig = PoolConfig.fromIdsByName("Crypto.1", "mainnet-beta");

// Create client
const client = new PerpetualsClient(
  provider,
  new PublicKey(poolConfig.programId),
  new PublicKey(poolConfig.perpComposibilityProgramId),
  new PublicKey(poolConfig.fbNftRewardProgramId),
  new PublicKey(poolConfig.rewardDistributionProgram.programId),
  { prioritizationFee: 10_000 },
);

// REQUIRED: Load address lookup tables before any transaction
await client.loadAddressLookupTable(poolConfig);
```

**Critical:** Always call `loadAddressLookupTable()` before any operation. Transactions fail without ALTs.

## Position Management

### Open Position

```typescript
const { instructions, additionalSigners } = await client.openPosition(
  "SOL",                                          // target symbol
  "USDC",                                         // collateral symbol
  { price: new BN(150_000_000), exponent: -6 },   // max entry price (slippage)
  new BN(100_000_000),                             // 100 USDC collateral (6 decimals)
  new BN(1_000_000_000),                           // 1 SOL size (9 decimals)
  Side.Long,
  poolConfig,
  Privilege.None,
);
const sig = await client.sendTransaction(instructions, additionalSigners);
```

**Gotchas:**
- `priceWithSlippage` = worst acceptable entry price. Above oracle for longs, below for shorts.
- `sizeAmount` uses **target token decimals** (SOL=9, BTC=8), NOT USD.
- Leverage = sizeUsd / collateralUsd. Enforced on-chain against custody limits.

### Close Position

```typescript
const { instructions, additionalSigners } = await client.closePosition(
  "SOL", "USDC",
  { price: new BN(140_000_000), exponent: -6 },  // min exit price (below oracle for longs)
  Side.Long, poolConfig, Privilege.None,
);
```

### Increase / Decrease Size

```typescript
// Increase
const { instructions } = await client.increaseSize(
  "SOL", "USDC", priceWithSlippage,
  new BN(500_000_000),  // add 0.5 SOL to size
  Side.Long, poolConfig, Privilege.None,
);

// Decrease
const { instructions } = await client.decreaseSize(
  "SOL", "USDC", priceWithSlippage,
  new BN(500_000_000),  // remove 0.5 SOL from size
  Side.Long, poolConfig, Privilege.None,
);
```

## Collateral

```typescript
// Add collateral (token decimals)
const { instructions } = await client.addCollateral(
  "SOL", "USDC",
  new BN(50_000_000),  // 50 USDC (6 decimals)
  Side.Long, poolConfig, Privilege.None,
);

// Remove collateral (USD value, 6 decimals)
const { instructions } = await client.removeCollateral(
  "SOL", "USDC",
  new BN(25_000_000),  // $25 USD
  Side.Long, poolConfig, Privilege.None,
);
```

**Note:** `addCollateral` = token decimals. `removeCollateral` = USD decimals. This asymmetry is intentional.

## Trigger Orders (TP/SL)

```typescript
// Place take-profit
const { instructions } = await client.placeTriggerOrder(
  "SOL", "USDC", Side.Long,
  {
    triggerPrice: { price: new BN(200_000_000), exponent: -6 },
    deltaSizeAmount: new BN(500_000_000),  // close 0.5 SOL at trigger
    isStopLoss: false,                      // false=TP, true=SL
  },
  poolConfig, Privilege.None,
);

// Edit trigger order
await client.editTriggerOrder("SOL", "USDC", Side.Long, {
  orderId: 0,  // index 0-4
  triggerPrice: { price: new BN(210_000_000), exponent: -6 },
  deltaSizeAmount: new BN(500_000_000),
  isStopLoss: false,
}, poolConfig, Privilege.None);

// Cancel trigger order
await client.cancelTriggerOrder("SOL", "USDC", Side.Long, {
  orderId: 0,
  isStopLoss: false,
}, poolConfig, Privilege.None);
```

## Limit Orders

```typescript
// Place limit order
const { instructions } = await client.placeLimitOrder(
  "SOL", "USDC", Side.Long,
  {
    limitPrice: { price: new BN(140_000_000), exponent: -6 },
    sizeAmount: new BN(1_000_000_000),
    reserveAmount: new BN(100_000_000),         // USDC collateral reserved
    stopLossPrice: { price: new BN(0), exponent: 0 },   // optional
    takeProfitPrice: { price: new BN(0), exponent: 0 },  // optional
  },
  poolConfig, Privilege.None,
);

// Cancel limit order (set sizeAmount=0)
await client.editLimitOrder("SOL", "USDC", Side.Long, {
  orderId: 0,
  limitPrice: { price: new BN(0), exponent: 0 },
  sizeAmount: new BN(0),  // size=0 signals cancellation
  stopLossPrice: { price: new BN(0), exponent: 0 },
  takeProfitPrice: { price: new BN(0), exponent: 0 },
}, poolConfig, Privilege.None);
```

## Composability (Atomic Multi-Step)

```typescript
// Swap token to collateral + open position (single transaction)
const { instructions } = await client.swapAndOpenPosition(
  "SOL",   // input token (will be swapped to collateral)
  "ETH",   // target
  "USDC",  // collateral
  priceWithSlippage, inputAmount, sizeAmount,
  Side.Long, poolConfig, Privilege.None,
);

// Close position + swap proceeds (single transaction)
const { instructions } = await client.closeAndSwapPosition(
  "ETH", "USDC", "SOL",  // target, collateral, output
  priceWithSlippage, Side.Long, poolConfig, Privilege.None,
);

// Swap + add collateral
const { instructions } = await client.swapAndAddCollateral(
  "SOL", "ETH", "USDC", amountIn,
  Side.Long, poolConfig, Privilege.None,
);

// Remove collateral + swap
const { instructions } = await client.removeCollateralAndSwap(
  "ETH", "USDC", "SOL", collateralDeltaUsd,
  Side.Long, poolConfig, Privilege.None,
);
```

## View Helpers (Read-Only Queries)

On-chain view queries that return pricing and PnL data without modifying state:

```typescript
import { ViewHelper } from "flash-sdk";
const viewHelper = new ViewHelper(connection, provider);

// Entry price and fees for a potential position
const { entryPrice, feeUsd } = await viewHelper.getEntryPriceAndFee(
  "SOL", "USDC", collateralAmount, sizeAmount, Side.Long, poolConfig
);

// Exit price and fees for closing
const { price, feeUsd } = await viewHelper.getExitPriceAndFee(
  "SOL", "USDC", Side.Long, poolConfig
);

// Current PnL
const { profit, loss } = await viewHelper.getPnl("SOL", "USDC", Side.Long, poolConfig);

// Full position data
const posData = await viewHelper.getPositionData("SOL", "USDC", Side.Long, poolConfig);

// Liquidation price
const liqPrice = await viewHelper.getLiquidationPrice("SOL", "USDC", Side.Long, poolConfig);

// Whether position is currently liquidatable
const isLiq = await viewHelper.getLiquidationState("SOL", "USDC", Side.Long, poolConfig);

// Oracle price
const oraclePrice = await viewHelper.getOraclePrice("SOL", poolConfig);

// Swap quote
const { amountOut, feeIn, feeOut } = await viewHelper.getSwapAmountAndFees(
  "USDC", "SOL", amountIn, poolConfig
);

// LP token price
const lpPrice = await viewHelper.getLpTokenPrice(poolConfig);

// Pool AUM
const aumUsd = await viewHelper.getAssetsUnderManagement(poolConfig);
```

## Liquidity Provision

```typescript
// Add liquidity and auto-stake
const { instructions } = await client.addLiquidityAndStake(
  "USDC", amountIn, minLpOut, poolConfig, Privilege.None,
);

// Add compounding liquidity (auto-reinvest rewards)
const { instructions } = await client.addCompoundingLiquidity(
  "USDC", amountIn, minCompoundingOut, poolConfig, Privilege.None,
);

// Remove liquidity
const { instructions } = await client.removeLiquidity(
  "USDC", lpAmountIn, minAmountOut, poolConfig, Privilege.None,
);

// FLP token price
const price = await client.getCompoundingLPTokenPrice(poolConfig);
```

**Tip:** LP fees depend on pool token ratios. Depositing an underweight token gets a fee discount.

## Staking

```typescript
// FLP staking
await client.depositStake("USDC", depositAmount, poolConfig);
await client.unstakeInstant("USDC", unstakeAmount, poolConfig);
await client.unstakeRequest("USDC", unstakeAmount, poolConfig);
await client.withdrawStake("USDC", poolConfig);
await client.collectStakeFees("USDC", poolConfig);

// FLASH token staking (fee discounts + referral rebates)
await client.depositTokenStake(depositAmount, poolConfig);
await client.collectTokenReward(poolConfig);
await client.collectRevenue(poolConfig);
await client.unstakeTokenInstant(amount, poolConfig);

// Referrals
await client.createReferral(poolConfig);
await client.collectRebate(poolConfig);
```

## Compute Budget

Flash Trade transactions need higher compute budgets:

| Operation | Recommended CU |
|-----------|---------------|
| Open/Close Position | 600,000 |
| Increase/Decrease Size | 600,000 |
| Add/Remove Collateral | 400,000 |
| Trigger/Limit Orders | 400,000 |
| Swap-and-Open / Close-and-Swap | 800,000 |
| Add/Remove Liquidity | 400,000 |

```typescript
import { ComputeBudgetProgram } from "@solana/web3.js";
const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 });
```

## Production Hardening

1. **Always load ALTs** before any operation
2. **Set priority fees** via `client.setPrioritizationFee(fee)`
3. **Validate oracle freshness** — stale prices cause error 6007
4. **Use slippage protection** — 1-3% from oracle for market orders
5. **Monitor pool utilization** — high utilization = higher borrow rates + potential 6032
6. **Handle keeper latency** — trigger/limit orders execute asynchronously
7. **Check permissions** — pools and markets can disable operations
8. **Use VersionedTransaction** — Flash Trade requires V0 transactions with ALTs
9. **Use PoolConfig for discovery** — never hardcode pool addresses
10. **Degen Mode guard** — check `PricingParams` before attempting >100x leverage

## Resources

- [flash-sdk on NPM](https://www.npmjs.com/package/flash-sdk)
- [Flash Trade SDK GitHub](https://github.com/flash-trade/flash-trade-sdk)
- [Flash Trade Docs](https://docs.flash.trade)
- [Flash Trade Audit Reports](https://github.com/flash-trade/Audits)
