# Flash Trade Protocol Concepts

Core domain knowledge for developers integrating with Flash Trade.

## Pool-to-Peer Model

All trades execute against shared liquidity pools — no orderbook, no counterparty matching. Traders open leveraged positions against pool liquidity, and LPs earn fees from trading activity.

```
Pool (e.g., Crypto.1)
├── Custody: USDC    (collateral, stable)
├── Custody: SOL     (target, volatile)
├── Custody: BTC     (target, volatile)
├── Custody: ETH     (target, volatile)
├── Market: SOL-Long   (target=SOL, collateral=USDC)
├── Market: SOL-Short  (target=SOL, collateral=USDC)
├── Market: BTC-Long   ...
└── ...
```

**Benefits:** Near-zero slippage for typical trade sizes, instant settlement (single transaction), deep liquidity from aggregated LP deposits.

## Key Entities

### Pool
A liquidity container holding multiple token custodies and defining tradable markets. Each pool has its own FLP token for liquidity providers.

**Available pools:**

| Category | Example | Assets |
|----------|---------|--------|
| Crypto | `Crypto.1` | USDC, SOL, BTC, ETH, JitoSOL |
| Virtual | `Virtual.1` | USDC, XAU, XAG, EUR, GBP, CRUDEOIL |
| Governance | `Governance.1` | USDC, JUP, PYTH, JTO, RAY |
| Community | `Community.1`, `Community.2` | USDC, BONK, PENGU, WIF |
| RWA | `Remora.1` | USDC, TSLAr, NVDAr, SPYr |

### Custody
A token's configuration within a pool — fees, oracle setup, pricing limits, borrow rates. Each custody has independent parameters.

### Market
A tradable pair within a pool. Defined by: target custody + collateral custody + side (Long/Short). Markets have individual permissions (open, close, collateral withdrawal, size change).

### Position
A leveraged trade. Key fields: owner, market, entry price, size (in target token), collateral (in collateral token), PnL, liquidation price.

- **PDA derivation:** `["position", owner, pool, custody, side_byte]` where side_byte: Long=1, Short=2
- **One position per market per side per wallet.** If you open a second trade on the same market+side, it merges into the existing position (increases size and averages entry price). You cannot hold independent positions at different entry prices for the same market+side. This affects grid trading and DCA strategies — multiple limit orders for the same market+side will merge into a single position as they fill.

### Order Account
Stores trigger orders (TP/SL) and limit orders per market per owner. Max 5 of each type per market.

## Collateral & Leverage

**Leverage** = position size USD / collateral USD. A $100 collateral at 5x leverage = $500 position size.

**Collateral rules:**
- **Minimum >$10 after fees** for positions that need limit orders, TP, or SL. Entry fees reduce collateral, so use $11-12+ minimum.
- Long positions use the **target token** as collateral (SOL/SOL, ETH/ETH). USDC deposits are auto-swapped.
- Short positions use **USDC** as collateral.
- SOL positions use **JitoSOL** as underlying collateral on-chain.
- `addCollateral` takes amounts in **token decimals**; `removeCollateral` takes amounts in **USD** (6 decimals).

**Leverage limits (per custody):**
- Standard: 1x to ~100x (`max_init_leverage`)
- Degen Mode: up to 500x (`max_init_degen_leverage`)
- Post-entry limit (`max_leverage`) is more lenient than initial limit

## Fee Structure

Fees are configured per custody and are ratio-dependent:

| Fee Type | Typical Range | Notes |
|----------|--------------|-------|
| Open position | 4-8 BPS | Deducted from collateral at entry |
| Close position | 4-8 BPS | Deducted from proceeds at exit |
| Hourly borrow rate | Variable | Increases with pool utilization (Aave-style curve) |
| Swap | 10-30 BPS | Ratio-dependent (underweight token = lower fee) |
| LP deposit/withdrawal | 0-30 BPS | Incentivizes balanced pool composition |

**Fee discounts:** Staking FLASH tokens (FAF) provides trading fee discounts. 6 stake levels with increasing benefits. Referral accounts provide rebates.

## Degen Mode

Higher-than-standard leverage on select assets (SOL, BTC, ETH):
- Up to 500x initial leverage
- Separate tracking via `degenSizeUsd` field on Position
- Pool-level exposure cap (`Market.degen_exposure_usd`)
- Higher minimum collateral requirement (`min_degen_collateral_usd`)
- Not available for limit orders or trigger orders

## Virtual Tokens

Synthetic exposure to assets without actual token custody (forex, commodities, equities). The pool holds only USDC:
1. Trader deposits USDC collateral
2. Position tracks size/collateral in USD terms
3. Pyth oracle provides reference price
4. PnL settled in USDC based on price movement

**Examples:** XAU (gold), XAG (silver), EUR, GBP, CRUDEOIL, USDJPY, TSLAr, NVDAr, SPYr

**Identified by:** `Custody.is_virtual = true`

## Order Types

| Type | Execution | Collateral Requirement | Notes |
|------|-----------|----------------------|-------|
| Market | Immediate at oracle price + slippage | Any amount | Default order type |
| Limit | When price hits target (keeper-executed) | >$10 after fees | Max 5 per market |
| Take-Profit (TP) | When price hits profit target | >$10 after fees | Max 5 per market |
| Stop-Loss (SL) | When price hits loss limit | >$10 after fees | Max 5 per market |

Trigger orders (TP/SL) and limit orders are **executed by off-chain keepers**, not the position owner. Keeper latency may occur during high-volatility periods.

## Composability

The Composability Program (`FSWAPViR8ny5K96hezav8jynVubP2dJ2L7SbKzds2hwm`) enables atomic multi-step flows:
- **Swap-and-Open:** Swap one token to collateral, then open a position — single transaction
- **Close-and-Swap:** Close a position, then swap proceeds to another token
- **Swap-and-Add-Collateral:** Swap a token and add it as position collateral
- **Remove-Collateral-and-Swap:** Remove collateral and swap to another token

## Oracle Pricing

Flash Trade uses **Pyth Network** oracles:
- **Pyth Lazer:** Low-latency price feed (200ms updates) — used for trade execution
- **Pyth Hermes:** REST fallback for closed-market hours
- **Internal backup oracle:** Secondary price source for safety

**Important:** Pyth prices are **mainnet only**. Devnet returns stale/zero prices.

Oracle configuration per custody:
- `maxPriceAgeSec` — max staleness before `StaleOraclePrice` (6007)
- `maxConfBps` — max confidence interval
- `maxDivergenceBps` — max divergence between primary and backup oracles

## Privilege Levels

| Level | How to Get | Benefit |
|-------|-----------|---------|
| `None` | Default | Standard fees |
| `Stake` | Stake FLASH tokens | Trading fee discount (varies by stake level) |
| `Referral` | Create referral account | Fee rebates on referred trades |

## Precision Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `BPS_DECIMALS` | 4 (10,000) | Basis points denominator |
| `PRICE_DECIMALS` | 6 | Oracle price precision |
| `USD_DECIMALS` | 6 | USD value precision ($1 = 1,000,000) |
| `LP_DECIMALS` | 6 | FLP token precision |
| `RATE_DECIMALS` | 9 | Borrow rate precision |

## Program IDs

| Program | Mainnet | Devnet |
|---------|---------|--------|
| Perpetuals | `FLASH6Lo6h3iasJKWDs2F8TkW2UKf3s15C8PMGuVfgBn` | `FTPP4jEWW1n8s2FEccwVfS9KCPjpndaswg7Nkkuz4ER4` |
| Composability | `FSWAPViR8ny5K96hezav8jynVubP2dJ2L7SbKzds2hwm` | `SWAP4AE4N1if9qKD7dgfQgmRBRv1CtWG8xDs4HP14ST` |
| Pyth Lazer | `pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt` | — |

## Global & Pool Permissions

Both the `Perpetuals` global account and each `Pool` have 13 boolean permission flags:

```
allowSwap, allowAddLiquidity, allowRemoveLiquidity, allowOpenPosition,
allowClosePosition, allowCollateralWithdrawal, allowSizeChange,
allowLiquidation, allowLpStaking, allowFeeDistribution,
allowUngatedTrading, allowFeeDiscounts, allowReferralRebates
```

When `allowUngatedTrading` is false, traders need an NFT or referral account to trade (error 6046: `InvalidAccess`).

Markets also have individual `MarketPermissions`: `allowOpenPosition`, `allowClosePosition`, `allowCollateralWithdrawal`, `allowSizeChange`.
