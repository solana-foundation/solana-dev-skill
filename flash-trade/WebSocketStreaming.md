# WebSocket Streaming

Real-time streaming of positions, orders, and prices from the Flash Trade Builder API.

---

## 1. WebSocket Endpoint — Positions & Orders

### Connection

```
GET /owner/{owner}/ws
```

**URL construction:** Replace the `http(s)://` scheme of the Builder API endpoint with `ws(s)://`, then append the path.

```
wss://flashapi.trade/owner/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU/ws?includePnlInLeverageDisplay=true&updateIntervalMs=1000
```

The server responds with HTTP `101 Switching Protocols` to upgrade the connection.

### Path Parameters

| Parameter | Type   | Required | Description                                    |
|-----------|--------|----------|------------------------------------------------|
| `owner`   | string | Yes      | Owner wallet public key (base58-encoded)       |

### Query Parameters

| Parameter                       | Type   | Required | Default | Description                                                      |
|---------------------------------|--------|----------|---------|------------------------------------------------------------------|
| `includePnlInLeverageDisplay`   | bool   | Yes      | --      | When `true`, PnL is factored into the leverage calculation       |
| `updateIntervalMs`              | u64    | No       | `1000`  | How often the server recomputes position data (ms). Clamped to `[100, 10000]` |

### Message Types

The server sends two types of JSON text messages, distinguished by the `type` field:

| `type`        | When sent                                                                                                  |
|---------------|------------------------------------------------------------------------------------------------------------|
| `"positions"` | On every recomputation interval (price-driven). Sent immediately on connect, then at `updateIntervalMs`.   |
| `"orders"`    | Only when an on-chain order event fires (limit/TP/SL created, cancelled, or modified). Also sent on connect. |

Both messages are **full snapshots** (the complete array of all current positions or orders for the owner), not incremental diffs.

### Message Format

#### Positions Message

```json
{
  "type": "positions",
  "data": [
    {
      "key": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      "positionAccountData": "qryP5HpA99AAAA...",
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
      "pnlWithFeeUsdUi": "-15.30",
      "pnlPercentageWithFee": "-15.30",
      "pnlWithoutFeeUsdUi": "-14.75",
      "pnlPercentageWithoutFee": "-14.75",
      "liquidationPriceUi": "120.30",
      "leverageUi": "5.00"
    }
  ]
}
```

**Field reference — `PositionTableDataUiDto`:**

| Field                       | Type             | Description                                                                 |
|-----------------------------|------------------|-----------------------------------------------------------------------------|
| `key`                       | `string`         | Position account pubkey (base58)                                            |
| `positionAccountData`       | `string`         | Raw Anchor-encoded position account data (base64). Decode with Anchor IDL.  |
| `sideUi`                    | `string?`        | `"Long"` or `"Short"`                                                       |
| `marketSymbol`              | `string?`        | Target market token symbol (e.g. `"SOL"`, `"BTC"`, `"ETH"`)                |
| `collateralSymbol`          | `string?`        | Collateral token symbol (e.g. `"USDC"`, `"SOL"`)                           |
| `entryOraclePrice`          | `OraclePriceDto?`| Oracle price at entry (see sub-table below)                                 |
| `entryPriceUi`              | `string?`        | Entry price, human-readable                                                 |
| `sizeAmountUi`              | `string?`        | Position size in target token (UI decimals)                                 |
| `sizeAmountUiKmb`           | `string?`        | Size formatted with K/M/B abbreviations                                     |
| `sizeUsdUi`                 | `string?`        | Position size in USD                                                        |
| `collateralAmountUi`        | `string?`        | Collateral amount in collateral token                                       |
| `collateralAmountUiKmb`     | `string?`        | Collateral formatted with K/M/B abbreviations                               |
| `collateralUsdUi`           | `string?`        | Collateral amount in USD                                                    |
| `isDegen`                   | `bool?`          | Whether position uses degen (high-leverage) mode                            |
| `pnl`                       | `PnlDto?`        | Breakdown of profit, loss, and fees (see sub-table below)                   |
| `pnlWithFeeUsdUi`           | `string?`        | PnL after fees in USD                                                       |
| `pnlPercentageWithFee`      | `string?`        | PnL percentage after fees                                                   |
| `pnlWithoutFeeUsdUi`        | `string?`        | PnL before fees in USD                                                      |
| `pnlPercentageWithoutFee`   | `string?`        | PnL percentage before fees                                                  |
| `liquidationPriceUi`        | `string?`        | Estimated liquidation price                                                 |
| `leverageUi`                | `string?`        | Current effective leverage                                                  |

**`OraclePriceDto` fields:**

| Field        | Type     | Description                                          |
|--------------|----------|------------------------------------------------------|
| `price`      | `string` | Raw integer price (e.g. `"14852000000"`)             |
| `exponent`   | `string` | Power-of-10 exponent (e.g. `"-8"`)                   |
| `confidence` | `string` | Confidence interval (always `"0"` for Lazer prices)  |
| `timestamp`  | `string` | Unix timestamp in seconds                            |

To compute the human-readable price: `price * 10^exponent` (e.g. `14852000000 * 10^-8 = 148.52`).

**`PnlDto` fields:**

| Field             | Type     | Description                                    |
|-------------------|----------|------------------------------------------------|
| `profitUsd`       | `string` | Unrealized profit in USD (0 if losing)         |
| `lossUsd`         | `string` | Unrealized loss in USD (0 if profiting)        |
| `exitFeeUsd`      | `string` | Estimated exit (close) fee in USD              |
| `borrowFeeUsd`    | `string` | Accrued borrow fee in USD                      |
| `exitFeeAmount`   | `string` | Exit fee in position's target token            |
| `borrowFeeAmount` | `string` | Borrow fee in position's target token          |
| `priceImpactUsd`  | `string` | Price impact fee in USD                        |
| `priceImpactSet`  | `bool`   | Whether price impact has been applied          |

**Note:** Optional fields (marked `?`) are omitted from the JSON when `null` (via `skip_serializing_if`). Always check for their presence before accessing.

#### Orders Message

```json
{
  "type": "orders",
  "data": [
    {
      "key": "9bGqYz4YXMF1dW2TLpJe5gR3vUqAc7GnhQWcJ4TkVd8K",
      "orderAccountData": "Ag4OAAAAAAA...",
      "limitOrders": [
        {
          "market": "3Xm4rcMEqGANX2PixhGqFdEcEn8xSMRN1G8SAaLnBkwP",
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
          "market": "3Xm4rcMEqGANX2PixhGqFdEcEn8xSMRN1G8SAaLnBkwP",
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
          "market": "3Xm4rcMEqGANX2PixhGqFdEcEn8xSMRN1G8SAaLnBkwP",
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
}
```

**Field reference — `OrderDataUiDto`:**

| Field              | Type                       | Description                                                   |
|--------------------|----------------------------|---------------------------------------------------------------|
| `key`              | `string`                   | Order account pubkey (base58)                                 |
| `orderAccountData` | `string`                   | Raw Anchor-encoded order account data (base64)                |
| `limitOrders`      | `LimitOrderUiDto[]`        | Active limit orders (see below)                               |
| `takeProfitOrders` | `TakeProfitOrderUiDto[]`   | Active take-profit trigger orders                             |
| `stopLossOrders`   | `StopLossOrderUiDto[]`     | Active stop-loss trigger orders                               |

**`LimitOrderUiDto` fields:**

| Field                     | Type             | Description                                        |
|---------------------------|------------------|----------------------------------------------------|
| `market`                  | `string`         | Market account pubkey                              |
| `orderId`                 | `number`         | Index within the order account                     |
| `sideUi`                  | `string`         | `"Long"` or `"Short"`                              |
| `symbol`                  | `string`         | Target market symbol                               |
| `reserveSymbol`           | `string`         | Reserve token symbol                               |
| `reserveAmountUi`         | `string`         | Reserve amount (UI format)                         |
| `reserveAmountUsdUi`      | `string`         | Reserve amount in USD                              |
| `sizeAmountUi`            | `string`         | Size in target token                               |
| `sizeAmountUiKmb`         | `string`         | Size with K/M/B abbreviation                       |
| `sizeUsdUi`               | `string`         | Size in USD                                        |
| `collateralAmountUi`      | `string`         | Collateral in reserve token                        |
| `collateralAmountUiKmb`   | `string`         | Collateral with K/M/B abbreviation                 |
| `collateralAmountUsdUi`   | `string`         | Collateral in USD                                  |
| `entryOraclePrice`        | `OraclePriceDto` | Limit trigger price                                |
| `entryPriceUi`            | `string`         | Entry price (UI format)                            |
| `leverageUi`              | `string`         | Target leverage                                    |
| `liquidationPriceUi`      | `string`         | Estimated liquidation price                        |
| `limitTakeProfitPriceUi`  | `string`         | Attached TP price (`"-"` if none)                  |
| `limitStopLossPriceUi`    | `string`         | Attached SL price (`"-"` if none)                  |
| `receiveTokenSymbol`      | `string`         | Token received on close                            |
| `reserveTokenSymbol`      | `string`         | Token used as reserve (same as `reserveSymbol`)    |

**`TakeProfitOrderUiDto` / `StopLossOrderUiDto` fields:**

| Field                | Type     | Description                                        |
|----------------------|----------|----------------------------------------------------|
| `market`             | `string` | Market account pubkey                              |
| `orderId`            | `number` | Index within the order account                     |
| `sideUi`             | `string` | `"Long"` or `"Short"`                              |
| `symbol`             | `string` | Target market symbol                               |
| `receiveTokenSymbol` | `string` | Token received when triggered                      |
| `sizeAmountUi`       | `string` | Size in target token                               |
| `sizeAmountUiKmb`    | `string` | Size with K/M/B abbreviation                       |
| `sizeUsdUi`          | `string` | Size in USD                                        |
| `type`               | `string` | `"TP"` for take-profit, `"SL"` for stop-loss       |
| `triggerPriceUi`     | `string` | Trigger price (UI format)                          |
| `leverage`           | `string` | Leverage (may be empty string)                     |

### HTTP Error Responses

| Status | Condition                              | Body                                          |
|--------|----------------------------------------|-----------------------------------------------|
| `429`  | Per-owner connection limit reached (5) | `"per-owner connection limit reached"`         |
| `503`  | Global connection limit reached (10k)  | `"global connection limit reached"`            |

---

## 2. Prices — REST Only

Prices are served via REST endpoints, not a streaming connection:

```
GET /prices              -- All prices, keyed by token symbol
GET /prices/{symbol}     -- Single token price
```

**Response shape (`PriceResponse`):**

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
    "price": 6543200000000,
    "exponent": -8,
    "confidence": 0,
    "priceUi": 65432.00,
    "timestampUs": 1707900000000000,
    "marketSession": "regular"
  }
}
```

| Field           | Type     | Description                                                    |
|-----------------|----------|----------------------------------------------------------------|
| `price`         | `i64`    | Raw integer price                                              |
| `exponent`      | `i16`    | Power-of-10 exponent                                           |
| `confidence`    | `i64`    | Confidence band (always `0` for Pyth Lazer)                    |
| `priceUi`       | `f64`    | Human-readable price (`price * 10^exponent`)                   |
| `timestampUs`   | `u64`    | Microsecond Unix timestamp of last price update                |
| `marketSession` | `string` | `"regular"`, `"preMarket"`, `"postMarket"`, `"overNight"`, or `"closed"` |

The frontend uses Pyth Network WebSocket (via a Web Worker) for real-time price streaming directly from oracle infrastructure, not from the Builder API.

---

## 3. Connection Management

### Connection Limits

| Limit       | Value    | Error on exceed |
|-------------|----------|-----------------|
| Per-owner   | **5**    | HTTP 429        |
| Global      | **10,000** | HTTP 503      |

Limits are checked **before** the WebSocket upgrade. The server uses RAII guards (`ConnectionGuard`) that automatically decrement counters when the connection drops, so slots are reclaimed immediately on disconnect.

### Server Keepalive

- **Ping interval:** Every **30 seconds**, the server sends a WebSocket `Ping` frame.
- **Pong timeout:** If the client does not respond with a `Pong` within **10 seconds**, the server sends a `Close` frame and terminates the connection.
- Standard WebSocket clients (browsers, `tokio-tungstenite`, `websockets` for Python) respond to Ping automatically. No client-side code needed for Pong unless you are using a low-level library.

### Cache Lifecycle

The server maintains a per-owner enrichment cache with a refresh loop:

- **First connection for an owner** spawns a background task that recomputes positions and orders.
- **Subsequent connections** share the same cache (refcounted). The fastest `updateIntervalMs` among active connections wins.
- **Last connection disconnects** starts a **5-second grace period**. If no reconnection occurs, the cache entry and refresh task are evicted.
- **Throttle:** The refresh loop never recomputes more than once per **100ms**, even with event-driven triggers.

### Owner Event Channel

Position and order changes from Yellowstone gRPC are broadcast to per-owner channels (`OwnerChannels`). The refresh loop listens for these events:

- `PositionChanged` -- triggers a position recomputation on the next interval tick.
- `OrderChanged` -- triggers both position and order recomputation (orders are only re-serialized when this event fires).

The broadcast channel has a buffer of **64 events**. If a slow consumer lags, skipped events are logged and orders are force-recomputed.

---

## 4. Reconnection Strategy

The production frontend (`usePositionsAndOrdersSub.ts`) implements a three-tier resilience strategy:

### Tier 1: Exponential Backoff Reconnection

```
Attempt 1: 1000ms delay
Attempt 2: 2000ms delay
Attempt 3: 4000ms delay
```

- Max reconnect attempts: **3**
- Base delay: **1000ms**, multiplied by `2^attempt`
- Connection timeout: **3000ms** -- if the WebSocket does not reach `OPEN` state within 3 seconds, the connection is closed.

### Tier 2: RPC Polling Fallback

After 3 failed reconnect attempts, the client falls back to direct Solana RPC polling (every 5 seconds) to maintain data availability. The WebSocket is considered down but not abandoned.

### Tier 3: Periodic Recovery

While in fallback mode, the client attempts to re-establish the WebSocket connection every **30 seconds**. On success, fallback polling stops and the WebSocket resumes.

---

## 5. Client Examples

### TypeScript (Browser / Node.js)

```typescript
const owner = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const wsUrl = `wss://flashapi.trade/owner/${owner}/ws?includePnlInLeverageDisplay=true&updateIntervalMs=1000`;

let ws: WebSocket;
let reconnectAttempts = 0;
const MAX_RECONNECTS = 3;

function connect() {
  ws = new WebSocket(wsUrl);

  // Timeout: close if not open within 3s
  const timeout = setTimeout(() => {
    if (ws.readyState !== WebSocket.OPEN) ws.close();
  }, 3000);

  ws.onopen = () => {
    clearTimeout(timeout);
    reconnectAttempts = 0;
    console.log("Connected to Flash Trade WS");
  };

  ws.onmessage = (event: MessageEvent) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "positions") {
      // msg.data is PositionTableDataUiDto[]
      console.log(`Received ${msg.data.length} positions`);
      for (const pos of msg.data) {
        console.log(
          `${pos.sideUi} ${pos.marketSymbol}: size=${pos.sizeUsdUi} USD, ` +
          `PnL=${pos.pnlWithFeeUsdUi} USD, lev=${pos.leverageUi}x, ` +
          `liq=${pos.liquidationPriceUi}`
        );
      }
    } else if (msg.type === "orders") {
      // msg.data is OrderDataUiDto[]
      for (const orderAccount of msg.data) {
        console.log(`Order account ${orderAccount.key}:`);
        console.log(`  Limits: ${orderAccount.limitOrders.length}`);
        console.log(`  TPs: ${orderAccount.takeProfitOrders.length}`);
        console.log(`  SLs: ${orderAccount.stopLossOrders.length}`);
      }
    }
  };

  ws.onclose = (event) => {
    clearTimeout(timeout);
    if (reconnectAttempts < MAX_RECONNECTS) {
      const delay = 1000 * Math.pow(2, reconnectAttempts);
      reconnectAttempts++;
      console.warn(`WS closed (code=${event.code}), reconnecting in ${delay}ms`);
      setTimeout(connect, delay);
    } else {
      console.error("WS max reconnects reached");
    }
  };

  ws.onerror = (err) => {
    console.error("WS error:", err);
    // onclose fires after onerror, reconnection handled there
  };
}

connect();
```

### Python (websockets library)

```python
import asyncio
import json
import websockets

OWNER = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
WS_URL = (
    f"wss://flashapi.trade/owner/{OWNER}/ws"
    f"?includePnlInLeverageDisplay=true&updateIntervalMs=1000"
)

MAX_RECONNECTS = 3
BASE_DELAY = 1.0


async def listen():
    attempt = 0
    while attempt <= MAX_RECONNECTS:
        try:
            async with websockets.connect(
                WS_URL,
                open_timeout=3,
                ping_interval=None,  # server handles ping/pong
            ) as ws:
                attempt = 0  # reset on successful connect
                print("Connected to Flash Trade WS")

                async for raw in ws:
                    msg = json.loads(raw)

                    if msg["type"] == "positions":
                        for pos in msg["data"]:
                            print(
                                f"{pos.get('sideUi')} {pos.get('marketSymbol')}: "
                                f"size={pos.get('sizeUsdUi')} USD, "
                                f"PnL={pos.get('pnlWithFeeUsdUi')} USD"
                            )

                    elif msg["type"] == "orders":
                        for oa in msg["data"]:
                            n_limit = len(oa.get("limitOrders", []))
                            n_tp = len(oa.get("takeProfitOrders", []))
                            n_sl = len(oa.get("stopLossOrders", []))
                            print(
                                f"Orders {oa['key']}: "
                                f"{n_limit} limit, {n_tp} TP, {n_sl} SL"
                            )

        except (
            websockets.ConnectionClosedError,
            websockets.InvalidURI,
            OSError,
        ) as e:
            delay = BASE_DELAY * (2 ** attempt)
            attempt += 1
            print(f"WS error ({e}), reconnecting in {delay}s (attempt {attempt})")
            await asyncio.sleep(delay)

    print("Max reconnects reached")


asyncio.run(listen())
```

### Browser JavaScript (Minimal)

```javascript
const owner = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const ws = new WebSocket(
  `wss://flashapi.trade/owner/${owner}/ws?includePnlInLeverageDisplay=true&updateIntervalMs=1000`
);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "positions") {
    // Full array of all open positions for this wallet
    console.table(msg.data.map(p => ({
      side: p.sideUi,
      market: p.marketSymbol,
      size: p.sizeUsdUi,
      pnl: p.pnlWithFeeUsdUi,
      leverage: p.leverageUi,
      liquidation: p.liquidationPriceUi,
    })));
  }
  if (msg.type === "orders") {
    // Full array of all order accounts for this wallet
    for (const oa of msg.data) {
      console.log("Limit orders:", oa.limitOrders);
      console.log("TP orders:", oa.takeProfitOrders);
      console.log("SL orders:", oa.stopLossOrders);
    }
  }
};
```

---

## 6. Best Practices

### Handle Reconnection Gracefully

- Implement exponential backoff (start at 1s, cap at ~4-5s).
- Set a connection timeout (3s recommended) to detect hung upgrades.
- Fall back to REST polling (`GET /positions/owner/{owner}`) if WebSocket is persistently unavailable.
- Periodically attempt WebSocket recovery (every 30s) while in fallback mode.
- On wallet disconnect, close the WebSocket intentionally and clear local state.

### Understand the Data Model

- **Every message is a full snapshot.** Replace your local state entirely with each incoming `data` array. Do not attempt to merge or diff against previous messages.
- **Positions update frequently** (every `updateIntervalMs`) because PnL, leverage, and liquidation price change with oracle prices.
- **Orders update infrequently** -- only on actual on-chain order events. The server internally tracks `orders_generation` and only sends an `"orders"` message when the generation bumps.
- **Optional fields may be absent.** The server uses `skip_serializing_if` for null optional fields. Always use safe access patterns (`?.` in TypeScript, `.get()` in Python).

### Decode Raw Account Data When Needed

- `positionAccountData` and `orderAccountData` are base64-encoded raw Anchor account data.
- The enriched fields (all the `*Ui` fields) are sufficient for display purposes.
- Only decode the raw data if you need access to on-chain BN fields (e.g. exact `sizeAmount` for full-close transactions).
- Use the Flash Trade Anchor IDL (`perpetuals.json`) with `BorshAccountsCoder` for decoding.

### Rate Limit Considerations

- The minimum `updateIntervalMs` the server accepts is **100ms**. Values below this are clamped.
- For most UI use cases, **1000ms** (the default) provides a good balance of responsiveness and bandwidth.
- The server throttles internal recomputation to at most once per **100ms** regardless of `updateIntervalMs`.
- Each wallet can hold at most **5 concurrent WebSocket connections**. Close stale connections before opening new ones.

### Connection Hygiene

- Close WebSocket connections when they are no longer needed (e.g., wallet disconnect, page navigation).
- The server has a **5-second grace period** after the last connection drops before evicting the cache. Quick reconnects (e.g., during page transitions) reuse the existing cache without recomputation.
- Do not rely on Ping/Pong for application-level health checks. The server sends Ping frames automatically. If you need to detect staleness, track the timestamp of the last received message.
