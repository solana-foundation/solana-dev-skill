# Flash Trade API Reference

REST API for the Flash Trade perpetuals protocol. Built with Axum 0.8 in Rust, serving real-time on-chain account data ingested via Yellowstone gRPC and Pyth Lazer price feeds.

**Base URL:** `$FLASH_API_URL` (e.g. `https://flashapi.trade`)

**Swagger UI:** `$FLASH_API_URL/docs/`

**OpenAPI JSON:** `$FLASH_API_URL/api-docs/openapi.json`

**Authentication:** None. The API is public with no auth headers required.

**WebSocket limits:** 10,000 global connections; 5 connections per owner wallet.

---

## Table of Contents

- [Error Format](#error-format)
- [Health](#health)
- [Raw Accounts](#raw-accounts)
  - [Perpetuals](#perpetuals)
  - [Pools](#pools)
  - [Custodies](#custodies)
  - [Markets](#markets)
  - [Positions (Raw)](#positions-raw)
  - [Orders (Raw)](#orders-raw)
- [Enriched Positions](#enriched-positions)
- [Enriched Orders](#enriched-orders)
- [Tokens](#tokens)
- [Prices](#prices)
- [Pool Data](#pool-data)
- [Transaction Builder -- Trading](#transaction-builder----trading)
  - [Open Position](#open-position)
  - [Close Position](#close-position)
  - [Reverse Position](#reverse-position)
- [Transaction Builder -- Collateral](#transaction-builder----collateral)
  - [Add Collateral](#add-collateral)
  - [Remove Collateral](#remove-collateral)
- [Transaction Builder -- Trigger Orders](#transaction-builder----trigger-orders)
  - [Place Trigger Order](#place-trigger-order)
  - [Edit Trigger Order](#edit-trigger-order)
  - [Cancel Trigger Order](#cancel-trigger-order)
  - [Cancel All Trigger Orders](#cancel-all-trigger-orders)
- [Transaction Builder -- Account Setup](#transaction-builder----account-setup)
  - [Init Token Stake](#init-token-stake)
  - [Create Referral](#create-referral)
- [Previews](#previews)
  - [Limit Order Fees](#limit-order-fees)
  - [Exit Fee](#exit-fee)
  - [TP/SL Preview](#tpsl-preview)
  - [Margin Preview](#margin-preview)
- [WebSocket Streaming](#websocket-streaming)

---

## Error Format

All error responses use the same JSON shape:

```json
{
  "error": "descriptive error message"
}
```

For transaction builder trigger-order endpoints, errors use:

```json
{
  "err": "descriptive error message"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `101` | WebSocket upgrade |
| `400` | Bad request / validation error / invalid pubkey / config error |
| `404` | Resource not found |
| `409` | Conflict |
| `429` | Too many requests (per-owner WebSocket limit) |
| `500` | Internal server error / compute error |
| `503` | Service unavailable (price missing, global connection limit) |

---

## Health

### `GET /health`

Returns service status and cached account counts.

**Response `200`:**

```json
{
  "status": "ok",
  "accounts": {
    "perpetuals": 1,
    "pools": 2,
    "custodies": 12,
    "markets": 10,
    "positions": 4500,
    "orders": 1200
  }
}
```

---

## Raw Accounts

These endpoints return raw Anchor-deserialized on-chain program account data as JSON. The response shapes mirror the on-chain Anchor IDL structs and are not documented in detail here -- see the Anchor IDL at `idls/perpetuals.json` for exact field definitions.

### Perpetuals

#### `GET /raw/perpetuals`

Returns all perpetuals accounts.

**Response `200`:**

```json
[
  {
    "pubkey": "FLASH6Lo6h3iasJKWDs2F8TkW2UKf3s15C8PMGuVfgBn",
    "account": { /* raw Anchor-deserialized perpetuals account */ }
  }
]
```

#### `GET /raw/perpetuals/{pubkey}`

Returns a single perpetuals account.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Perpetuals account public key (base58) |

**Response `200`:** Raw Anchor-deserialized perpetuals account JSON.

**Response `404`:** `{ "error": "perpetuals account {pubkey} not found" }`

---

### Pools

#### `GET /raw/pools`

Returns all pool accounts.

**Response `200`:**

```json
[
  {
    "pubkey": "2RLpwpC1X2FyMnVpwMGo9dTr8jGMfxHzU2S94MbYHBqn",
    "account": { /* raw Anchor-deserialized pool account */ }
  }
]
```

#### `GET /raw/pools/{pubkey}`

Returns a single pool account.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Pool account public key (base58) |

**Response `200`:** Raw pool account JSON.

**Response `404`:** `{ "error": "pool account {pubkey} not found" }`

---

### Custodies

#### `GET /raw/custodies`

Returns all custody accounts.

**Response `200`:**

```json
[
  {
    "pubkey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "account": { /* raw Anchor-deserialized custody account */ }
  }
]
```

#### `GET /raw/custodies/{pubkey}`

Returns a single custody account.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Custody account public key (base58) |

**Response `200`:** Raw custody account JSON.

**Response `404`:** `{ "error": "custody account {pubkey} not found" }`

---

### Markets

#### `GET /raw/markets`

Returns all market accounts.

**Response `200`:**

```json
[
  {
    "pubkey": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
    "account": { /* raw Anchor-deserialized market account */ }
  }
]
```

#### `GET /raw/markets/{pubkey}`

Returns a single market account.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Market account public key (base58) |

**Response `200`:** Raw market account JSON.

**Response `404`:** `{ "error": "market account {pubkey} not found" }`

---

### Positions (Raw)

#### `GET /raw/positions/{pubkey}`

Returns raw Anchor-deserialized position account data.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Position account public key (base58) |

**Response `200`:** Raw position account JSON.

**Response `404`:** `{ "error": "position account {pubkey} not found" }`

---

### Orders (Raw)

#### `GET /raw/orders/{pubkey}`

Returns raw Anchor-deserialized order account data.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pubkey` | path | string | yes | Order account public key (base58) |

**Response `200`:** Raw order account JSON.

**Response `404`:** `{ "error": "order account {pubkey} not found" }`

---

## Enriched Positions

### `GET /positions/owner/{owner}`

Returns all positions for an owner wallet, enriched with PnL, leverage, and liquidation data computed from current oracle prices.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `owner` | path | string | yes | Owner wallet public key (base58) |
| `includePnlInLeverageDisplay` | query | boolean | yes | Whether to factor PnL into the displayed leverage calculation |

**Response `200`:** Array of `PositionTableDataUiDto`

```json
[
  {
    "key": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "positionAccountData": "qryP5HpA99AAAAAA...",
    "sideUi": "Long",
    "marketSymbol": "SOL",
    "collateralSymbol": "USDC",
    "entryOraclePrice": {
      "price": "14852000000",
      "exponent": "-8",
      "confidence": "0",
      "timestamp": "1707900000"
    },
    "entryPriceUi": "148.52",
    "sizeAmountUi": "3.37",
    "sizeAmountUiKmb": "3.37",
    "sizeUsdUi": "500.00",
    "collateralAmountUi": "100.00",
    "collateralAmountUiKmb": "100.00",
    "collateralUsdUi": "100.00",
    "isDegen": false,
    "pnl": {
      "profitUsd": "12.50",
      "lossUsd": "0.00",
      "exitFeeUsd": "0.40",
      "borrowFeeUsd": "0.15",
      "exitFeeAmount": "0.002700",
      "borrowFeeAmount": "0.001012",
      "priceImpactUsd": "0",
      "priceImpactSet": false
    },
    "pnlWithFeeUsdUi": "11.95",
    "pnlPercentageWithFee": "11.95",
    "pnlWithoutFeeUsdUi": "12.50",
    "pnlPercentageWithoutFee": "12.50",
    "liquidationPriceUi": "120.30",
    "leverageUi": "5.00"
  }
]
```

All fields except `key` and `positionAccountData` are optional (omitted when `null` via `skip_serializing_if`). They may be absent if enrichment fails (e.g. missing market config or price data).

**Note on PnL values:** `pnlWithFeeUsdUi` and `pnlPercentageWithFee` are negative for losing positions (e.g., `"-15.30"` for a 15.3% loss). The `profitUsd` and `lossUsd` fields inside `pnl` are always non-negative — use `profitUsd` for gains and `lossUsd` for losses.

---

## Enriched Orders

### `GET /orders/owner/{owner}`

Returns all enriched orders for an owner wallet, including limit orders, take-profit, and stop-loss trigger orders.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `owner` | path | string | yes | Owner wallet public key (base58) |

**Response `200`:** Array of `OrderDataUiDto`

```json
[
  {
    "key": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "orderAccountData": "base64-encoded-raw-data...",
    "limitOrders": [
      {
        "market": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
        "orderId": 0,
        "sideUi": "Long",
        "symbol": "SOL",
        "reserveSymbol": "USDC",
        "reserveAmountUi": "100.00",
        "reserveAmountUsdUi": "100.00",
        "sizeAmountUi": "0.67",
        "sizeAmountUiKmb": "0.67",
        "sizeUsdUi": "500.00",
        "collateralAmountUi": "100.00",
        "collateralAmountUiKmb": "100.00",
        "collateralAmountUsdUi": "100.00",
        "entryOraclePrice": {
          "price": "14852000000",
          "exponent": "-8",
          "confidence": "0",
          "timestamp": "1707900000"
        },
        "entryPriceUi": "148.52",
        "leverageUi": "5.00",
        "liquidationPriceUi": "120.30",
        "limitTakeProfitPriceUi": "-",
        "limitStopLossPriceUi": "-",
        "receiveTokenSymbol": "USDC",
        "reserveTokenSymbol": "USDC"
      }
    ],
    "takeProfitOrders": [
      {
        "market": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
        "orderId": 0,
        "sideUi": "Long",
        "symbol": "SOL",
        "receiveTokenSymbol": "USDC",
        "sizeAmountUi": "0.67",
        "sizeAmountUiKmb": "0.67",
        "sizeUsdUi": "500.00",
        "type": "TP",
        "triggerPriceUi": "160.00",
        "leverage": ""
      }
    ],
    "stopLossOrders": [
      {
        "market": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
        "orderId": 0,
        "sideUi": "Long",
        "symbol": "SOL",
        "receiveTokenSymbol": "USDC",
        "sizeAmountUi": "0.67",
        "sizeAmountUiKmb": "0.67",
        "sizeUsdUi": "500.00",
        "type": "SL",
        "triggerPriceUi": "130.00",
        "leverage": ""
      }
    ]
  }
]
```

---

## Tokens

### `GET /tokens`

Returns all supported tokens from pool configuration. Deduplicated by mint address.

**Response `200`:** Array of `TokenDto`

```json
[
  {
    "symbol": "SOL",
    "mintKey": "So11111111111111111111111111111111111111112",
    "decimals": 9,
    "usdPrecision": 2,
    "tokenPrecision": 4,
    "isStable": false,
    "isVirtual": false,
    "lazerId": 7,
    "pythTicker": "Crypto.SOL/USD",
    "pythPriceId": "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    "isToken2022": false
  },
  {
    "symbol": "USDC",
    "mintKey": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "decimals": 6,
    "usdPrecision": 4,
    "tokenPrecision": 2,
    "isStable": true,
    "isVirtual": false,
    "lazerId": 19,
    "pythTicker": "Crypto.USDC/USD",
    "pythPriceId": "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    "isToken2022": false
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Token ticker symbol |
| `mintKey` | string | SPL token mint address (base58) |
| `decimals` | number | Token native decimals |
| `usdPrecision` | number | Display precision for USD values |
| `tokenPrecision` | number | Display precision for token amounts |
| `isStable` | boolean | Whether token is a stablecoin |
| `isVirtual` | boolean | Whether token is a virtual (synthetic) asset |
| `lazerId` | number | Pyth Lazer feed ID |
| `pythTicker` | string | Pyth ticker string (e.g. "Crypto.SOL/USD") |
| `pythPriceId` | string | Pyth price feed ID (hex) |
| `isToken2022` | boolean | Whether token uses SPL Token-2022 standard |

---

## Prices

### `GET /prices`

Returns all current oracle prices keyed by token symbol. Prices come from Pyth Lazer feeds (real-time, ~200ms updates). SOL and WSOL share the same feed and both keys are returned.

**Response `200`:**

```json
{
  "SOL": {
    "price": 14852000000,
    "exponent": -8,
    "confidence": 0,
    "priceUi": 148.52,
    "timestampUs": 1707900000000000,
    "marketSession": "regular"
  },
  "BTC": {
    "price": 6500000000000,
    "exponent": -8,
    "confidence": 0,
    "priceUi": 65000.0,
    "timestampUs": 1707900000000000,
    "marketSession": "regular"
  },
  "WSOL": {
    "price": 14852000000,
    "exponent": -8,
    "confidence": 0,
    "priceUi": 148.52,
    "timestampUs": 1707900000000000,
    "marketSession": "regular"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `price` | number | Raw integer price (multiply by `10^exponent` for decimal) |
| `exponent` | number | Price exponent (typically -8) |
| `confidence` | number | Confidence interval (always 0 for Lazer feeds) |
| `priceUi` | number | Human-readable price as float |
| `timestampUs` | number | Price timestamp in microseconds since epoch |
| `marketSession` | string | Market session status: `"regular"`, `"preMarket"`, `"postMarket"`, `"overNight"`, or `"closed"` |

### `GET /prices/{symbol}`

Returns the price for a single token. Symbol lookup is case-insensitive.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `symbol` | path | string | yes | Token symbol (e.g. `SOL`, `BTC`, `ETH`) |

**Response `200`:** Single `PriceResponse` object (same shape as above).

**Response `404`:** `{ "error": "price for symbol 'XYZ' not found" }`

---

## Pool Data

Aggregated pool statistics computed every 15 seconds. Includes TVL, utilization, LP price, custody ratios, and capacity metrics.

### `GET /pool-data`

Returns all pool data snapshots.

**Response `200`:**

```json
{
  "pools": [
    {
      "poolName": "Crypto Pool",
      "poolAddress": "2RLpwpC1X2FyMnVpwMGo9dTr8jGMfxHzU2S94MbYHBqn",
      "lpStats": {
        "lpTokenSupply": "1250000.00",
        "totalPoolValueUsd": "15000000.00",
        "lpPrice": "1.2000",
        "stableCoinPercentage": "35.20",
        "maxAumUsd": "50000000.00"
      },
      "custodyStats": [
        {
          "symbol": "SOL",
          "custodyAccount": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
          "priceUi": "148.52",
          "minRatioUi": "5.00",
          "maxRatioUi": "45.00",
          "targetRatioUi": "25.00",
          "currentRatioUi": "30.50",
          "utilizationUi": "42.30",
          "lockedAmountUi": "12500.0000",
          "assetsOwnedAmountUi": "29550.0000",
          "totalUsdOwnedAmountUi": "4389810.00",
          "availableToAddAmountUi": "14600.2500",
          "availableToAddUsdUi": "2168325.00",
          "availableToRemoveAmountUi": "25600.5000",
          "availableToRemoveUsdUi": "3801682.00",
          "minCapacityAmountUi": "5050.0000",
          "maxCapacityAmountUi": "45450.0000",
          "rewardPerLpStaked": "123456789",
          "openPositionFeeRate": "360",
          "closePositionFeeRate": "360",
          "limitPriceBufferBps": "100",
          "maxLeverage": "100.00",
          "maxDegenLeverage": "200.00",
          "delaySeconds": "0"
        }
      ]
    }
  ]
}
```

#### LP Stats Fields

| Field | Type | Description |
|-------|------|-------------|
| `lpTokenSupply` | string | Total LP tokens in circulation (UI format) |
| `totalPoolValueUsd` | string | Total pool value in USD (UI format) |
| `lpPrice` | string | LP token price in USD (UI format) |
| `stableCoinPercentage` | string | Percentage of pool value in stablecoins |
| `maxAumUsd` | string | Pool's maximum AUM limit in USD (UI format) |

#### Custody Stats Fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | string | Token symbol |
| `custodyAccount` | string | Custody account pubkey (base58) |
| `priceUi` | string | Current oracle price (UI format) |
| `minRatioUi` | string | Minimum pool ratio percentage |
| `maxRatioUi` | string | Maximum pool ratio percentage |
| `targetRatioUi` | string | Target pool ratio percentage |
| `currentRatioUi` | string | Current pool ratio percentage |
| `utilizationUi` | string | Utilization rate percentage (locked / owned * 100) |
| `lockedAmountUi` | string | Locked token amount (UI format) |
| `assetsOwnedAmountUi` | string | Total owned token amount (UI format) |
| `totalUsdOwnedAmountUi` | string | Total owned value in USD (UI format) |
| `availableToAddAmountUi` | string | Amount available to add as LP (token) |
| `availableToAddUsdUi` | string | Amount available to add as LP (USD) |
| `availableToRemoveAmountUi` | string | Amount available to remove as LP (token) |
| `availableToRemoveUsdUi` | string | Amount available to remove as LP (USD) |
| `minCapacityAmountUi` | string | Minimum capacity in token amount |
| `maxCapacityAmountUi` | string | Maximum capacity in token amount |
| `rewardPerLpStaked` | string | Raw u64 reward_per_lp_staked for BN math |
| `openPositionFeeRate` | string | Raw u64 open position fee rate (divide by RATE_POWER for decimal) |
| `closePositionFeeRate` | string | Raw u64 close position fee rate (divide by RATE_POWER for decimal) |
| `limitPriceBufferBps` | string | Limit order price buffer in basis points |
| `maxLeverage` | string | Maximum allowed leverage (UI format, e.g. "100.00") |
| `maxDegenLeverage` | string | Maximum degen-mode leverage (UI format, e.g. "200.00") |
| `delaySeconds` | string | Pricing delay in seconds |

### `GET /pool-data/{pool_pubkey}`

Returns data for a single pool.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `pool_pubkey` | path | string | yes | Pool public key (base58) |

**Response `200`:** Single `PoolDataSnapshot` object (same shape as one element in the `pools` array above).

**Response `404`:** `{ "error": "pool data for {pool_pubkey} not found" }`

### `GET /pool-data/status/initialized`

Returns whether pool data has been computed at least once after startup.

**Response `200`:**

```json
{
  "initialized": true
}
```

---

## Transaction Builder -- Trading

All transaction builder endpoints return a base64-encoded versioned Solana transaction (unsigned). The client must sign and submit.

### Open Position

#### `POST /transaction-builder/open-position`

Opens a new position or increases an existing one. Supports market orders, limit orders, and swaps. Optionally attaches TP/SL trigger orders.

**Preview-only mode:** Omit the `owner` field to get fee/leverage/entry-price calculations without building a transaction. The response will have `transactionBase64: null`.

**Request body:**

```json
{
  "inputTokenSymbol": "USDC",
  "outputTokenSymbol": "SOL",
  "inputAmountUi": "100.0",
  "leverage": 5.0,
  "tradeType": "LONG",
  "orderType": "MARKET",
  "limitPrice": "150.00",
  "degenMode": false,
  "tradingFeeDiscountPercent": 10.0,
  "userWhitelistAccount": "Hx4F8GnLq7bMwJgPE1osD4jGpSfR4VF2",
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
  "slippagePercentage": "0.5",
  "takeProfit": "160.00",
  "stopLoss": "130.00",
  "tokenStakeFafAccount": "FAFxR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "userReferralAccount": "REF1xR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "enableFundedWallet": false,
  "privilege": "STAKE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputTokenSymbol` | string | yes | Token symbol to pay with (e.g. "USDC", "SOL") |
| `outputTokenSymbol` | string | yes | Target market token symbol (e.g. "SOL", "BTC", "ETH") |
| `inputAmountUi` | string | yes | Input amount in human-readable format |
| `leverage` | number | yes | Desired leverage multiplier |
| `tradeType` | enum | yes | `"LONG"`, `"SHORT"`, or `"SWAP"` |
| `orderType` | enum | no | `"MARKET"` (default) or `"LIMIT"` |
| `limitPrice` | string | no | Trigger price for limit orders (UI format) |
| `degenMode` | boolean | no | Enable degen mode (higher max leverage) |
| `tradingFeeDiscountPercent` | number | no | Fee discount percentage from staking (0-100) |
| `userWhitelistAccount` | string | no | Whitelist account pubkey |
| `owner` | string | no | Wallet pubkey. **Omit for preview-only mode** (no tx built) |
| `slippagePercentage` | string | no | Slippage tolerance percentage (default: "0.5") |
| `takeProfit` | string | no | TP trigger price (UI format). Appends a TP trigger order instruction |
| `stopLoss` | string | no | SL trigger price (UI format). Appends a SL trigger order instruction |
| `tokenStakeFafAccount` | string | no | Token stake FAF account for fee discounts |
| `userReferralAccount` | string | no | Referral account for referral privilege |
| `enableFundedWallet` | boolean | no | Enable funded wallet privilege |
| `privilege` | enum | no | `"NONE"`, `"STAKE"`, or `"REFERRAL"`. Overrides automatic inference |

**Response `200`:**

```json
{
  "oldLeverage": "4.50",
  "newLeverage": "5.00",
  "oldEntryPrice": "145.00",
  "newEntryPrice": "148.52",
  "oldLiquidationPrice": "118.00",
  "newLiquidationPrice": "120.30",
  "entryFee": "0.45",
  "entryFeeBeforeDiscount": "0.50",
  "openPositionFeePercent": "0.03600",
  "availableLiquidity": "1234567.89",
  "youPayUsdUi": "100.00",
  "youRecieveUsdUi": "500.00",
  "marginFeePercentage": "0.00800",
  "outputAmount": "3370000000",
  "outputAmountUi": "3.37",
  "transactionBase64": "AQAAAA...",
  "swapInPriceUi": "148.52",
  "swapOutPriceUi": "1.00",
  "swapFeeUsdUi": "0.45",
  "takeProfitQuote": {
    "exitPriceUi": "155.00",
    "profitUsdUi": "12.50",
    "lossUsdUi": "0",
    "exitFeeUsdUi": "0.45",
    "receiveUsdUi": "112.05",
    "pnlPercentage": "12.50"
  },
  "stopLossQuote": {
    "exitPriceUi": "130.00",
    "profitUsdUi": "0",
    "lossUsdUi": "8.25",
    "exitFeeUsdUi": "0.40",
    "receiveUsdUi": "91.35",
    "pnlPercentage": "-8.25"
  },
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `oldLeverage` | string? | Existing position leverage (only when increasing position) |
| `newLeverage` | string | New position leverage after this trade |
| `oldEntryPrice` | string? | Existing entry price (only when increasing position) |
| `newEntryPrice` | string | Weighted-average entry price after this trade |
| `oldLiquidationPrice` | string? | Existing liquidation price (only when increasing position) |
| `newLiquidationPrice` | string | New liquidation price |
| `entryFee` | string | Entry fee in USD after discount |
| `entryFeeBeforeDiscount` | string | Entry fee in USD before discount |
| `openPositionFeePercent` | string | Fee rate as percentage (e.g. "0.03600" = 0.036%) |
| `availableLiquidity` | string | Available liquidity for this market in USD |
| `youPayUsdUi` | string | Total collateral paid in USD |
| `youRecieveUsdUi` | string | Position size received in USD. **Note:** "Recieve" is an intentional misspelling matching the backend field name — do not correct it. |
| `marginFeePercentage` | string | Hourly borrow rate percentage |
| `outputAmount` | string | Output size in native units (raw u64) |
| `outputAmountUi` | string | Output size in human-readable format |
| `transactionBase64` | string? | Base64-encoded versioned transaction (null when `owner` omitted) |
| `swapInPriceUi` | string? | Swap: min oracle price of input token |
| `swapOutPriceUi` | string? | Swap: max oracle price of output token |
| `swapFeeUsdUi` | string? | Swap: total fee in USD |
| `takeProfitQuote` | object? | TP trigger order quote (when `takeProfit` provided) |
| `stopLossQuote` | object? | SL trigger order quote (when `stopLoss` provided) |
| `err` | string? | Error message if computation failed |

---

### Close Position

#### `POST /transaction-builder/close-position`

Closes or partially closes an existing position.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "inputUsdUi": "500.00",
  "withdrawTokenSymbol": "USDC",
  "keepLeverageSame": false,
  "slippagePercentage": "0.5",
  "tradingFeeDiscountPercent": 10.0,
  "tokenStakeFafAccount": "FAFxR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "userReferralAccount": "REF1xR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "enableFundedWallet": false,
  "privilege": "STAKE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey to close |
| `inputUsdUi` | string | yes | USD amount to close. Use full size for complete close, partial for partial close |
| `withdrawTokenSymbol` | string | yes | Token to receive (e.g. "USDC", "SOL") |
| `keepLeverageSame` | boolean | no | Maintain current leverage during partial close |
| `slippagePercentage` | string | no | Slippage tolerance percentage (default: "0.5") |
| `tradingFeeDiscountPercent` | number | no | Fee discount from staking (0-100) |
| `tokenStakeFafAccount` | string | no | Token stake FAF account for fee discounts |
| `userReferralAccount` | string | no | Referral account for referral privilege |
| `enableFundedWallet` | boolean | no | Enable funded wallet privilege |
| `privilege` | enum | no | `"NONE"`, `"STAKE"`, or `"REFERRAL"` |

**Response `200`:**

```json
{
  "receiveTokenSymbol": "USDC",
  "receiveTokenAmountUi": "105.23",
  "receiveTokenAmountUsdUi": "105.23",
  "markPrice": "148.52",
  "entryPrice": "145.00",
  "existingLiquidationPrice": "120.30",
  "newLiquidationPrice": "0.00",
  "existingSize": "500.00",
  "newSize": "0.00",
  "existingCollateral": "100.00",
  "newCollateral": "0.00",
  "existingLeverage": "5.00",
  "newLeverage": "0.00",
  "settledPnl": "5.23",
  "fees": "0.36",
  "feesBeforeDiscount": "0.40",
  "lockAndUnsettledFeeUsd": "0.15",
  "transactionBase64": "AQAAAA...",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `receiveTokenSymbol` | string | Token being received |
| `receiveTokenAmountUi` | string | Receive amount in token (UI format) |
| `receiveTokenAmountUsdUi` | string | Receive amount in USD |
| `markPrice` | string | Current mark/exit price |
| `entryPrice` | string | Position entry price |
| `existingLiquidationPrice` | string | Liquidation price before close |
| `newLiquidationPrice` | string | Liquidation price after close ("0" for full close) |
| `existingSize` | string | Position size before close (USD) |
| `newSize` | string | Remaining size after close (USD) |
| `existingCollateral` | string | Collateral before close (USD) |
| `newCollateral` | string | Remaining collateral after close (USD) |
| `existingLeverage` | string | Leverage before close |
| `newLeverage` | string | Leverage after close |
| `settledPnl` | string | Settled PnL in USD (negative prefixed with "-") |
| `fees` | string | Total fees (exit + borrow) in USD after discount |
| `feesBeforeDiscount` | string | Total fees before discount |
| `lockAndUnsettledFeeUsd` | string? | Lock and unsettled fee (partial closes) |
| `transactionBase64` | string? | Base64-encoded versioned transaction |
| `err` | string? | Error message if computation failed |

---

### Reverse Position

#### `POST /transaction-builder/reverse-position`

Reverses an existing position (close Long, open Short with same collateral, or vice versa). Builds a combined close+open transaction.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
  "slippagePercentage": "0.5",
  "tradingFeeDiscountPercent": 10.0,
  "tokenStakeFafAccount": "FAFxR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "userReferralAccount": "REF1xR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "enableFundedWallet": false,
  "privilege": "STAKE",
  "degenMode": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey to reverse |
| `owner` | string | yes | Wallet pubkey (required -- builds combined transaction) |
| `slippagePercentage` | string | no | Slippage tolerance (default: "0.5") |
| `tradingFeeDiscountPercent` | number | no | Fee discount from staking (0-100) |
| `tokenStakeFafAccount` | string | no | Token stake FAF account |
| `userReferralAccount` | string | no | Referral account |
| `enableFundedWallet` | boolean | no | Enable funded wallet privilege |
| `privilege` | enum | no | `"NONE"`, `"STAKE"`, or `"REFERRAL"` |
| `degenMode` | boolean | no | Enable degen mode for the new position |

**Response `200`:**

```json
{
  "closeReceiveUsd": "105.23",
  "closeFees": "0.36",
  "closeSettledPnl": "5.23",
  "newSide": "Short",
  "newLeverage": "5.00",
  "newEntryPrice": "148.52",
  "newLiquidationPrice": "175.00",
  "newSizeUsd": "500.00",
  "newSizeAmountUi": "3.37",
  "newCollateralUsd": "98.00",
  "openEntryFee": "0.45",
  "transactionBase64": "AQAAAA...",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `closeReceiveUsd` | string | USD received from closing (after fees) |
| `closeFees` | string | Total close fees in USD |
| `closeSettledPnl` | string | Settled PnL from the close (negative = "-X.XX") |
| `newSide` | string | New position side: "Long" or "Short" |
| `newLeverage` | string | New position leverage |
| `newEntryPrice` | string | New position entry price |
| `newLiquidationPrice` | string | New position liquidation price |
| `newSizeUsd` | string | New position size in USD |
| `newSizeAmountUi` | string | New position size in target token |
| `newCollateralUsd` | string | Collateral for new position (after 2% haircut) |
| `openEntryFee` | string | Entry fee for the new position in USD |
| `transactionBase64` | string? | Base64-encoded versioned transaction (close + open combined) |
| `err` | string? | Error message if computation failed |

---

## Transaction Builder -- Collateral

### Add Collateral

#### `POST /transaction-builder/add-collateral`

Adds collateral to an existing position, reducing leverage.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "depositAmountUi": "50.0",
  "depositTokenSymbol": "USDC",
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
  "slippagePercentage": "0.5"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey |
| `depositAmountUi` | string | yes | Amount to deposit (UI format, in deposit token) |
| `depositTokenSymbol` | string | yes | Deposit token symbol (e.g. "USDC", "SOL") |
| `owner` | string | yes | Wallet pubkey (always required) |
| `slippagePercentage` | string | no | Slippage tolerance (default: "0.5") |

**Response `200`:**

```json
{
  "existingCollateralUsd": "100.00",
  "newCollateralUsd": "150.00",
  "existingLeverage": "5.00",
  "newLeverage": "3.33",
  "existingLiquidationPrice": "120.30",
  "newLiquidationPrice": "105.00",
  "depositUsdValue": "50.00",
  "maxAddableUsd": "10000.00",
  "transactionBase64": "AQAAAA...",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `existingCollateralUsd` | string | Current collateral in USD |
| `newCollateralUsd` | string | Collateral after adding |
| `existingLeverage` | string | Current leverage |
| `newLeverage` | string | New leverage after adding |
| `existingLiquidationPrice` | string | Current liquidation price |
| `newLiquidationPrice` | string | New liquidation price |
| `depositUsdValue` | string | USD value of the deposit |
| `maxAddableUsd` | string | Maximum addable amount in USD |
| `transactionBase64` | string? | Base64-encoded versioned transaction |
| `err` | string? | Error message if computation failed |

---

### Remove Collateral

#### `POST /transaction-builder/remove-collateral`

Removes collateral from an existing position, increasing leverage.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "withdrawAmountUsdUi": "25.00",
  "withdrawTokenSymbol": "USDC",
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
  "slippagePercentage": "0.5"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey |
| `withdrawAmountUsdUi` | string | yes | USD amount to withdraw |
| `withdrawTokenSymbol` | string | yes | Token to receive (e.g. "USDC", "SOL") |
| `owner` | string | yes | Wallet pubkey (always required) |
| `slippagePercentage` | string | no | Slippage tolerance (default: "0.5") |

**Response `200`:**

```json
{
  "existingCollateralUsd": "100.00",
  "newCollateralUsd": "75.00",
  "existingLeverage": "5.00",
  "newLeverage": "6.67",
  "existingLiquidationPrice": "120.30",
  "newLiquidationPrice": "130.00",
  "receiveAmountUi": "25.00",
  "receiveAmountUsdUi": "25.00",
  "maxWithdrawableUsd": "80.00",
  "transactionBase64": "AQAAAA...",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `existingCollateralUsd` | string | Current collateral in USD |
| `newCollateralUsd` | string | Collateral after removing |
| `existingLeverage` | string | Current leverage |
| `newLeverage` | string | New leverage after removing |
| `existingLiquidationPrice` | string | Current liquidation price |
| `newLiquidationPrice` | string | New liquidation price |
| `receiveAmountUi` | string | Amount to receive in withdraw token |
| `receiveAmountUsdUi` | string | USD value of receive amount |
| `maxWithdrawableUsd` | string | Maximum withdrawable in USD |
| `transactionBase64` | string? | Base64-encoded versioned transaction |
| `err` | string? | Error message if computation failed |

---

## Transaction Builder -- Trigger Orders

Trigger orders are take-profit (TP) and stop-loss (SL) orders that automatically close part or all of a position when a price threshold is reached.

These endpoints return structured errors with HTTP status codes (400, 404, 500) using the `{ "err": "..." }` format.

### Place Trigger Order

#### `POST /transaction-builder/place-trigger-order`

Places a new TP or SL trigger order on an existing position.

**Request body:**

```json
{
  "marketSymbol": "SOL",
  "side": "LONG",
  "triggerPriceUi": "160.00",
  "sizeAmountUi": "0.5",
  "isStopLoss": false,
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketSymbol` | string | yes | Market symbol (e.g. "SOL", "BTC") |
| `side` | enum | yes | Trade side: `"LONG"` or `"SHORT"` |
| `triggerPriceUi` | string | yes | Trigger price in UI format |
| `sizeAmountUi` | string | yes | Size to close in target token when trigger fires |
| `isStopLoss` | boolean | yes | `true` for stop-loss, `false` for take-profit |
| `owner` | string | yes | Wallet pubkey (position owner) |

**Response `200`:**

```json
{
  "transactionBase64": "AQAAAA..."
}
```

**Error responses:** `400`, `404`, `500` with `{ "err": "message" }`

---

### Edit Trigger Order

#### `POST /transaction-builder/edit-trigger-order`

Edits an existing trigger order's price and size.

**Request body:**

```json
{
  "marketSymbol": "SOL",
  "side": "LONG",
  "orderId": 0,
  "triggerPriceUi": "165.00",
  "sizeAmountUi": "0.5",
  "isStopLoss": false,
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketSymbol` | string | yes | Market symbol |
| `side` | enum | yes | `"LONG"` or `"SHORT"` |
| `orderId` | number | yes | Index of the trigger order to edit (0-4) |
| `triggerPriceUi` | string | yes | New trigger price in UI format |
| `sizeAmountUi` | string | yes | New size in target token |
| `isStopLoss` | boolean | yes | `true` for SL, `false` for TP |
| `owner` | string | yes | Wallet pubkey (must be original order owner) |

**Response `200`:**

```json
{
  "transactionBase64": "AQAAAA..."
}
```

**Error responses:** `400`, `404`, `500` with `{ "err": "message" }`

---

### Cancel Trigger Order

#### `POST /transaction-builder/cancel-trigger-order`

Cancels a single trigger order.

**Request body:**

```json
{
  "marketSymbol": "SOL",
  "side": "LONG",
  "orderId": 0,
  "isStopLoss": false,
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketSymbol` | string | yes | Market symbol |
| `side` | enum | yes | `"LONG"` or `"SHORT"` |
| `orderId` | number | yes | Index of the trigger order to cancel (0-4) |
| `isStopLoss` | boolean | yes | `true` for SL, `false` for TP |
| `owner` | string | yes | Wallet pubkey (must own the order) |

**Response `200`:**

```json
{
  "transactionBase64": "AQAAAA..."
}
```

**Error responses:** `400`, `404`, `500` with `{ "err": "message" }`

---

### Cancel All Trigger Orders

#### `POST /transaction-builder/cancel-all-trigger-orders`

Cancels all trigger orders for a given market and side.

**Request body:**

```json
{
  "marketSymbol": "SOL",
  "side": "LONG",
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketSymbol` | string | yes | Market symbol |
| `side` | enum | yes | `"LONG"` or `"SHORT"` |
| `owner` | string | yes | Wallet pubkey (must own the orders) |

**Response `200`:**

```json
{
  "transactionBase64": "AQAAAA..."
}
```

**Error responses:** `400`, `404`, `500` with `{ "err": "message" }`

---

## Transaction Builder -- Account Setup

### Init Token Stake

#### `POST /transaction-builder/init-token-stake`

Initializes a token stake (FAF) account PDA for the user. Required before staking for fee discounts.

**Request body:**

```json
{
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `owner` | string | yes | Wallet pubkey |

**Response `200`:**

```json
{
  "tokenStakeAccount": "FAFxR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "transactionBase64": "AQAAAA..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tokenStakeAccount` | string | Derived token stake account PDA |
| `transactionBase64` | string | Base64-encoded versioned transaction |

---

### Create Referral

#### `POST /transaction-builder/create-referral`

Creates a referral account linking the user to a referrer.

**Request body:**

```json
{
  "owner": "9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL",
  "referrer": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `owner` | string | yes | Wallet pubkey of the user creating the referral account |
| `referrer` | string | yes | Referrer's wallet pubkey (their token stake PDA is derived automatically) |

**Response `200`:**

```json
{
  "referralAccount": "REF1xR2D3YBQu4A7t5WCbTfLJ88gkQTZ2c8oKGPujNbqo",
  "transactionBase64": "AQAAAA..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `referralAccount` | string | Derived referral account PDA |
| `transactionBase64` | string | Base64-encoded versioned transaction |

---

## Previews

Preview endpoints perform fee, PnL, and margin calculations without building any transaction. Used for UI display before the user commits to a trade.

### Limit Order Fees

#### `POST /preview/limit-order-fees`

Calculates entry price, fee, liquidation price, and borrow rate for a limit order.

**Request body:**

```json
{
  "marketSymbol": "SOL",
  "inputAmountUi": "100.0",
  "outputAmountUi": "0.67",
  "side": "LONG",
  "limitPrice": "150.00",
  "tradingFeeDiscountPercent": 10.0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketSymbol` | string | yes | Market symbol (e.g. "SOL", "BTC") |
| `inputAmountUi` | string | yes | Input (collateral) amount in UI format |
| `outputAmountUi` | string | yes | Output (size) amount in UI format |
| `side` | enum | yes | `"LONG"` or `"SHORT"` |
| `limitPrice` | string | no | Limit price in UI format (uses live price if omitted) |
| `tradingFeeDiscountPercent` | number | no | Fee discount from staking (0-100) |

**Response `200`:**

```json
{
  "entryPriceUi": "148.52",
  "entryFeeUsdUi": "0.50",
  "liquidationPriceUi": "120.30",
  "borrowRateUi": "0.01200",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `entryPriceUi` | string | Computed entry price |
| `entryFeeUsdUi` | string | Entry fee in USD |
| `liquidationPriceUi` | string | Liquidation price |
| `borrowRateUi` | string | Hourly borrow rate (decimal format) |
| `err` | string? | Error message if computation failed |

---

### Exit Fee

#### `POST /preview/exit-fee`

Calculates exit fee and exit price for closing a position.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "closeAmountUsdUi": "500.00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey |
| `closeAmountUsdUi` | string | yes | USD amount to close |

**Response `200`:**

```json
{
  "exitFeeUsdUi": "0.40",
  "exitFeeAmountUi": "0.002700",
  "exitPriceUi": "148.52",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `exitFeeUsdUi` | string | Exit fee in USD |
| `exitFeeAmountUi` | string | Exit fee in token amount |
| `exitPriceUi` | string | Exit price after spread |
| `err` | string? | Error message |

---

### TP/SL Preview

#### `POST /preview/tp-sl`

Calculates TP/SL projections. Three modes:

- **`forward`** -- Given a trigger price, compute projected PnL
- **`reverse_pnl`** -- Given a target PnL in USD, compute the required trigger price
- **`reverse_roi`** -- Given a target ROI percentage, compute the required trigger price

Works with both existing positions (via `positionKey`) and hypothetical limit orders (via inline fields).

**Request body (forward mode, existing position):**

```json
{
  "mode": "forward",
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "triggerPriceUi": "160.00"
}
```

**Request body (reverse_pnl mode, inline limit order):**

```json
{
  "mode": "reverse_pnl",
  "marketSymbol": "SOL",
  "entryPriceUi": "148.52",
  "sizeUsdUi": "500.00",
  "collateralUsdUi": "100.00",
  "side": "LONG",
  "targetPnlUsdUi": "50.00"
}
```

**Request body (reverse_roi mode):**

```json
{
  "mode": "reverse_roi",
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "targetRoiPercent": 50.0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mode` | string | yes | `"forward"`, `"reverse_pnl"`, or `"reverse_roi"` |
| `positionKey` | string | conditional | Position pubkey (for existing positions) |
| `marketSymbol` | string | conditional | Market symbol (for inline limit orders) |
| `entryPriceUi` | string | conditional | Entry price (for inline limit orders) |
| `sizeUsdUi` | string | conditional | Size in USD (for inline limit orders) |
| `collateralUsdUi` | string | conditional | Collateral in USD (for inline limit orders) |
| `side` | enum | conditional | `"LONG"` or `"SHORT"` (for inline limit orders) |
| `triggerPriceUi` | string | conditional | Trigger price (forward mode) |
| `targetPnlUsdUi` | string | conditional | Target PnL in USD (reverse_pnl mode) |
| `targetRoiPercent` | number | conditional | Target ROI percentage (reverse_roi mode) |

**Response `200`:**

```json
{
  "pnlUsdUi": "50.00",
  "pnlPercentage": "50.00",
  "triggerPriceUi": "160.00",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `pnlUsdUi` | string? | Estimated PnL in USD (forward mode) |
| `pnlPercentage` | string? | PnL percentage (forward mode) |
| `triggerPriceUi` | string? | Computed trigger price (reverse modes) |
| `err` | string? | Error message |

---

### Margin Preview

#### `POST /preview/margin`

Previews the effect of adding or removing collateral on leverage and liquidation price.

**Request body:**

```json
{
  "positionKey": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "marginDeltaUsdUi": "50.00",
  "action": "ADD"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `positionKey` | string | yes | Position account pubkey |
| `marginDeltaUsdUi` | string | yes | Margin delta in USD |
| `action` | enum | yes | `"ADD"` or `"REMOVE"` |

**Response `200`:**

```json
{
  "newLeverageUi": "3.50",
  "newLiquidationPriceUi": "110.00",
  "maxAmountUsdUi": "500.00",
  "err": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `newLeverageUi` | string | New leverage after margin change |
| `newLiquidationPriceUi` | string | New liquidation price |
| `maxAmountUsdUi` | string | Maximum addable/removable amount in USD |
| `err` | string? | Error message |

---

## WebSocket Streaming

### `GET /owner/{owner}/ws`

Upgrades to a WebSocket connection that streams real-time enriched positions and orders for a specific owner.

| Parameter | In | Type | Required | Description |
|-----------|------|--------|----------|-------------|
| `owner` | path | string | yes | Owner wallet public key (base58) |
| `includePnlInLeverageDisplay` | query | boolean | yes | Include PnL in leverage display calculation |
| `updateIntervalMs` | query | number | no | Position update interval in milliseconds (default: 1000, min: 100, max: 10000) |

**Connection example:**

```
ws://$FLASH_API_URL/owner/9erjj6n8Hkrv9dVK1CjJatSNfCgUP6EbQ2hRbrsokRuL/ws?includePnlInLeverageDisplay=true&updateIntervalMs=1000
```

**Message format:**

The server sends two types of JSON messages:

**Positions update (sent at `updateIntervalMs` interval):**

```json
{
  "type": "positions",
  "data": [
    { /* PositionTableDataUiDto -- same shape as GET /positions/owner/{owner} */ }
  ]
}
```

**Orders update (sent only when orders change on-chain):**

```json
{
  "type": "orders",
  "data": [
    { /* OrderDataUiDto -- same shape as GET /orders/owner/{owner} */ }
  ]
}
```

### Connection Behavior

- On connect, the server immediately sends both a `positions` and an `orders` message with the current state.
- Positions are recalculated at the configured interval (price-dependent).
- Orders are only re-sent when on-chain order accounts change (event-driven via gRPC).
- Server sends WebSocket Ping frames every 30 seconds. If no Pong is received within 10 seconds, the connection is closed.
- The client does not need to send any messages after connecting.

### Connection Limits

| Limit | Value |
|-------|-------|
| Global connections | 10,000 |
| Per-owner connections | 5 |

**Error responses:**

| Status | Condition |
|--------|-----------|
| `429` | Per-owner connection limit reached (5 connections) |
| `503` | Global connection limit reached (10,000 connections) |

---

## Enum Reference

### TradeType

Serialized as `SCREAMING_SNAKE_CASE`:

| Value | Description |
|-------|-------------|
| `LONG` | Long position |
| `SHORT` | Short position |
| `SWAP` | Token swap (no leverage) |

### OrderType

Serialized as `SCREAMING_SNAKE_CASE`:

| Value | Description |
|-------|-------------|
| `MARKET` | Market order (executes immediately) |
| `LIMIT` | Limit order (executes at trigger price) |

### PrivilegeType

Serialized as `SCREAMING_SNAKE_CASE`:

| Value | Description |
|-------|-------------|
| `NONE` | No privilege |
| `REFERRAL` | Referred user privilege |
| `STAKE` | FAF staker privilege |

### MarginAction

Serialized as `SCREAMING_SNAKE_CASE`:

| Value | Description |
|-------|-------------|
| `ADD` | Add collateral to position |
| `REMOVE` | Remove collateral from position |

---

## Quick Reference: All Endpoints

| Method | Path | Tag |
|--------|------|-----|
| `GET` | `/health` | Health |
| `GET` | `/raw/perpetuals` | Raw Accounts |
| `GET` | `/raw/perpetuals/{pubkey}` | Raw Accounts |
| `GET` | `/raw/pools` | Raw Accounts |
| `GET` | `/raw/pools/{pubkey}` | Raw Accounts |
| `GET` | `/raw/custodies` | Raw Accounts |
| `GET` | `/raw/custodies/{pubkey}` | Raw Accounts |
| `GET` | `/raw/markets` | Raw Accounts |
| `GET` | `/raw/markets/{pubkey}` | Raw Accounts |
| `GET` | `/raw/positions/{pubkey}` | Raw Accounts |
| `GET` | `/raw/orders/{pubkey}` | Raw Accounts |
| `GET` | `/positions/owner/{owner}` | Positions |
| `GET` | `/orders/owner/{owner}` | Orders |
| `GET` | `/tokens` | Tokens |
| `GET` | `/prices` | Prices |
| `GET` | `/prices/{symbol}` | Prices |
| `GET` | `/pool-data` | Pool Data |
| `GET` | `/pool-data/{pool_pubkey}` | Pool Data |
| `GET` | `/pool-data/status/initialized` | Pool Data |
| `POST` | `/transaction-builder/open-position` | Trading |
| `POST` | `/transaction-builder/close-position` | Trading |
| `POST` | `/transaction-builder/reverse-position` | Trading |
| `POST` | `/transaction-builder/add-collateral` | Collateral |
| `POST` | `/transaction-builder/remove-collateral` | Collateral |
| `POST` | `/transaction-builder/place-trigger-order` | Trigger Orders |
| `POST` | `/transaction-builder/edit-trigger-order` | Trigger Orders |
| `POST` | `/transaction-builder/cancel-trigger-order` | Trigger Orders |
| `POST` | `/transaction-builder/cancel-all-trigger-orders` | Trigger Orders |
| `POST` | `/transaction-builder/init-token-stake` | Account Setup |
| `POST` | `/transaction-builder/create-referral` | Account Setup |
| `POST` | `/preview/limit-order-fees` | Previews |
| `POST` | `/preview/exit-fee` | Previews |
| `POST` | `/preview/tp-sl` | Previews |
| `POST` | `/preview/margin` | Previews |
| `GET` | `/owner/{owner}/ws` | Streaming |
| `GET` | `/metrics` | Prometheus (not in OpenAPI) |
