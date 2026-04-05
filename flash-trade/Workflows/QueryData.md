# QueryData Workflow

How to read markets, positions, prices, orders, and pool data from Flash Trade.

## Markets & Pools

```bash
# All markets (includes symbol, side, pool, max leverage)
curl $FLASH_API_URL/raw/markets

# All pools
curl $FLASH_API_URL/raw/pools

# All custodies (token configurations within pools)
curl $FLASH_API_URL/raw/custodies

# Single account by pubkey
curl $FLASH_API_URL/raw/markets/{pubkey}
curl $FLASH_API_URL/raw/pools/{pubkey}
curl $FLASH_API_URL/raw/custodies/{pubkey}
```

## Prices

```bash
# All oracle prices (Pyth Lazer, 200ms updates, mainnet only)
curl $FLASH_API_URL/prices

# Single price by symbol
curl $FLASH_API_URL/prices/SOL
curl $FLASH_API_URL/prices/BTC
curl $FLASH_API_URL/prices/ETH
```

**Response fields:** `price` (raw i64), `exponent` (i16), `priceUi` (human-readable), `timestampUs`, `marketSession` (`"regular"`, `"preMarket"`, `"postMarket"`, `"overNight"`, or `"closed"`)

## Positions (Enriched with PnL)

```bash
# All positions for a wallet (enriched with PnL, leverage, liquidation price)
curl "$FLASH_API_URL/positions/owner/{walletPubkey}?includePnlInLeverageDisplay=true"

# Raw position by pubkey (no enrichment)
curl $FLASH_API_URL/raw/positions/{positionPubkey}
```

**Enriched response includes:** `sideUi`, `marketSymbol`, `entryPriceUi`, `sizeUsdUi`, `collateralUsdUi`, `pnlWithFeeUsdUi`, `pnlPercentageWithFee`, `liquidationPriceUi`, `leverageUi`

## Orders (Enriched)

```bash
# All orders for a wallet (limit orders, TP, SL — enriched)
curl $FLASH_API_URL/orders/owner/{walletPubkey}

# Raw order by pubkey
curl $FLASH_API_URL/raw/orders/{orderPubkey}
```

**Response includes:** `limitOrders[]`, `takeProfitOrders[]`, `stopLossOrders[]` — each with trigger price, size, symbol, side.

## Pool Data (AUM, Utilization, LP Stats)

```bash
# All pools aggregated (AUM, utilization, LP price)
curl $FLASH_API_URL/pool-data

# Single pool by pubkey
curl $FLASH_API_URL/pool-data/{poolPubkey}

# Check if pool data is initialized
curl $FLASH_API_URL/pool-data/status/initialized
```

**Note:** Pool data is cached and refreshed every 15 seconds.

## Tokens

```bash
# List all supported tokens with decimals, mint keys, Pyth feed IDs
curl $FLASH_API_URL/tokens
```

**Response includes:** `symbol`, `mintKey`, `decimals`, `isStable`, `isVirtual`, `lazerId`, `isToken2022`

## Preview (Calculate Without Building Transaction)

```bash
# Preview fees for a limit order
curl -X POST $FLASH_API_URL/preview/limit-order-fees \
  -H "Content-Type: application/json" \
  -d '{"marketSymbol": "SOL", "inputAmountUi": "100", "outputAmountUi": "0.67", "side": "LONG"}'

# Preview exit fee for closing
curl -X POST $FLASH_API_URL/preview/exit-fee \
  -H "Content-Type: application/json" \
  -d '{"positionKey": "<position-pubkey>", "closeAmountUsdUi": "500"}'

# Preview TP/SL PnL calculation
curl -X POST $FLASH_API_URL/preview/tp-sl \
  -H "Content-Type: application/json" \
  -d '{"mode": "forward", "positionKey": "<position-pubkey>", "triggerPriceUi": "160"}'

# Preview margin adjustment
curl -X POST $FLASH_API_URL/preview/margin \
  -H "Content-Type: application/json" \
  -d '{"positionKey": "<position-pubkey>", "marginDeltaUsdUi": "50", "action": "ADD"}'
```

## Real-Time Streaming

For live updates, use WebSocket instead of polling:

```bash
# WebSocket: live positions + orders for a wallet
wscat -c "ws://$FLASH_API_HOST/owner/{walletPubkey}/ws?updateIntervalMs=1000"
```

See [WebSocketStreaming.md](../WebSocketStreaming.md) for full details.

## Data Freshness

| Source | Update Frequency | Notes |
|--------|-----------------|-------|
| Prices | 200ms (Pyth Lazer) | Mainnet only |
| Positions/Orders (WS) | Configurable (100ms-10s) | Real-time via WebSocket |
| Positions/Orders (REST) | On-demand | Read from DashMap cache |
| Pool Data | 15 seconds | Cached aggregate stats |
| Account Data (RPC bootstrap) | 30 seconds | Periodic full reload + gRPC streaming |

## OpenAPI / Swagger

Full interactive API documentation with schemas:

```bash
# Swagger UI
open $FLASH_API_URL/docs/

# OpenAPI JSON spec
curl $FLASH_API_URL/api-docs/openapi.json
```
