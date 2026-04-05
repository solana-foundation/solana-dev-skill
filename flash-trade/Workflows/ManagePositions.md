# ManagePositions Workflow

Position lifecycle management — monitoring, risk management, and order management.

## Position Lifecycle

```
1. Open Position     →  Position exists on-chain
2. Monitor           →  Track PnL, leverage, liquidation risk
3. Manage Risk       →  Add/remove collateral, set TP/SL
4. Close/Reverse     →  Exit or flip direction
```

## Monitor Positions

### REST API (Polling)

```bash
# Get all positions with enriched PnL data
curl "$FLASH_API_URL/positions/owner/<WALLET>?includePnlInLeverageDisplay=true"
```

Key response fields per position:
- `sideUi` — "Long" or "Short"
- `marketSymbol` — "SOL", "BTC", etc.
- `entryPriceUi` — Weighted average entry price
- `sizeUsdUi` — Position size in USD
- `collateralUsdUi` — Current collateral in USD
- `pnlWithFeeUsdUi` — PnL after all fees
- `pnlPercentageWithFee` — PnL as percentage of collateral
- `liquidationPriceUi` — Price at which position gets liquidated
- `leverageUi` — Current effective leverage

### WebSocket (Real-Time)

```javascript
const ws = new WebSocket(`ws://${FLASH_API_HOST}/owner/${wallet}/ws?updateIntervalMs=1000`);
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "positions") {
    // msg.data = array of enriched positions
    for (const pos of msg.data) {
      console.log(`${pos.marketSymbol} ${pos.sideUi}: PnL ${pos.pnlWithFeeUsdUi} (${pos.pnlPercentageWithFee}%)`);
    }
  }
  if (msg.type === "orders") {
    // msg.data = array of order accounts with limitOrders, takeProfitOrders, stopLossOrders
  }
};
```

See [WebSocketStreaming.md](../WebSocketStreaming.md) for full details.

## Risk Management

### Check Liquidation Risk

A position is liquidated when the oracle price crosses the `liquidationPriceUi`. Monitor the gap between current price and liquidation price.

```bash
# Get current price
curl $FLASH_API_URL/prices/SOL

# Compare with position's liquidationPriceUi
# If gap is narrowing, consider adding collateral or reducing size
```

### Add Collateral (Reduce Leverage)

```bash
curl -X POST $FLASH_API_URL/transaction-builder/add-collateral \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_KEY>",
    "depositAmountUi": "50.0",
    "depositTokenSymbol": "USDC",
    "owner": "<WALLET>"
  }'
```

### Preview Margin Adjustment

Before adding/removing collateral, preview the effect:

```bash
curl -X POST $FLASH_API_URL/preview/margin \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_KEY>",
    "marginDeltaUsdUi": "50.00",
    "action": "ADD"
  }'
# Response: newLeverageUi, newLiquidationPriceUi, maxAmountUsdUi
```

## Set Take-Profit & Stop-Loss

### At Open Time

Include `takeProfit` and `stopLoss` in the open-position request:

```json
{
  "inputTokenSymbol": "USDC",
  "outputTokenSymbol": "SOL",
  "inputAmountUi": "100.0",
  "leverage": 5.0,
  "tradeType": "LONG",
  "owner": "<WALLET>",
  "takeProfit": "160.00",
  "stopLoss": "130.00"
}
```

### On Existing Positions

```bash
# Place TP
curl -X POST $FLASH_API_URL/transaction-builder/place-trigger-order \
  -d '{"marketSymbol":"SOL","side":"LONG","triggerPriceUi":"160","sizeAmountUi":"1.0","isStopLoss":false,"owner":"<WALLET>"}'

# Place SL
curl -X POST $FLASH_API_URL/transaction-builder/place-trigger-order \
  -d '{"marketSymbol":"SOL","side":"LONG","triggerPriceUi":"130","sizeAmountUi":"1.0","isStopLoss":true,"owner":"<WALLET>"}'
```

### Preview TP/SL Before Placing

```bash
# Forward mode: given trigger price, what's the PnL?
curl -X POST $FLASH_API_URL/preview/tp-sl \
  -d '{"mode":"forward","positionKey":"<KEY>","triggerPriceUi":"160"}'

# Reverse PnL mode: given target PnL, what trigger price?
curl -X POST $FLASH_API_URL/preview/tp-sl \
  -d '{"mode":"reverse_pnl","positionKey":"<KEY>","targetPnlUsdUi":"50"}'

# Reverse ROI mode: given target ROI%, what trigger price?
curl -X POST $FLASH_API_URL/preview/tp-sl \
  -d '{"mode":"reverse_roi","positionKey":"<KEY>","targetRoiPercent":"25"}'
```

### Manage Existing Orders

```bash
# View all orders for wallet
curl $FLASH_API_URL/orders/owner/<WALLET>

# Edit a trigger order (change price or size)
curl -X POST $FLASH_API_URL/transaction-builder/edit-trigger-order \
  -d '{"marketSymbol":"SOL","side":"LONG","orderId":0,"triggerPriceUi":"165","sizeAmountUi":"0.5","isStopLoss":false,"owner":"<WALLET>"}'

# Cancel a specific order
curl -X POST $FLASH_API_URL/transaction-builder/cancel-trigger-order \
  -d '{"marketSymbol":"SOL","side":"LONG","orderId":0,"isStopLoss":false,"owner":"<WALLET>"}'

# Cancel all orders for a market+side
curl -X POST $FLASH_API_URL/transaction-builder/cancel-all-trigger-orders \
  -d '{"marketSymbol":"SOL","side":"LONG","owner":"<WALLET>"}'
```

**Limits:** Max 5 TP orders + 5 SL orders + 5 limit orders per market per wallet.

## Close Position

```bash
# Full close
curl -X POST $FLASH_API_URL/transaction-builder/close-position \
  -d '{"positionKey":"<KEY>","inputUsdUi":"500","withdrawTokenSymbol":"USDC"}'

# Partial close (close $200 of a $500 position)
curl -X POST $FLASH_API_URL/transaction-builder/close-position \
  -d '{"positionKey":"<KEY>","inputUsdUi":"200","withdrawTokenSymbol":"USDC","keepLeverageSame":true}'
```

## Reverse Position

Atomically close and open opposite direction:

```bash
curl -X POST $FLASH_API_URL/transaction-builder/reverse-position \
  -d '{"positionKey":"<KEY>","owner":"<WALLET>"}'
```

## Bot Strategy Pattern

```
loop every N seconds:
  1. GET /prices/{symbol}          → current price
  2. GET /positions/owner/{wallet} → current positions + PnL
  3. Evaluate strategy conditions
  4. If action needed:
     a. POST /transaction-builder/{action} → get preview + tx
     b. Check preview (fees, leverage, liquidation price)
     c. Sign and submit transaction
     d. Confirm on-chain
  5. GET /orders/owner/{wallet}    → verify orders are correct
```

For real-time monitoring, use WebSocket instead of polling. See [WebSocketStreaming.md](../WebSocketStreaming.md).
