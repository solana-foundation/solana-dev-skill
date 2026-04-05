# WebSocket Position Monitor

Real-time position monitoring using the Flash Trade WebSocket endpoint.

## TypeScript (Node.js)

```typescript
import WebSocket from "ws";

const FLASH_WS_URL = "wss://flashapi.trade";
const WALLET = "YOUR_WALLET_PUBKEY";

function connect() {
  const ws = new WebSocket(
    `${FLASH_WS_URL}/owner/${WALLET}/ws?includePnlInLeverageDisplay=true&updateIntervalMs=2000`
  );

  ws.on("open", () => {
    console.log("Connected to Flash Trade WebSocket");
  });

  ws.on("message", (data: Buffer) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "positions") {
      console.clear();
      console.log(`\n--- Positions (${new Date().toISOString()}) ---`);
      for (const pos of msg.data) {
        const pnlColor = parseFloat(pos.pnlWithFeeUsdUi) >= 0 ? "\x1b[32m" : "\x1b[31m";
        console.log(
          `${pos.marketSymbol} ${pos.sideUi.padEnd(5)} | ` +
          `Size: $${pos.sizeUsdUi.padStart(10)} | ` +
          `Entry: $${pos.entryPriceUi.padStart(10)} | ` +
          `${pnlColor}PnL: $${pos.pnlWithFeeUsdUi.padStart(10)} (${pos.pnlPercentageWithFee}%)\x1b[0m | ` +
          `Liq: $${pos.liquidationPriceUi}`
        );
      }
    }

    if (msg.type === "orders") {
      for (const order of msg.data) {
        if (order.takeProfitOrders.length > 0) {
          console.log(`\nTP Orders:`);
          for (const tp of order.takeProfitOrders) {
            console.log(`  ${tp.symbol} ${tp.sideUi}: trigger @ $${tp.triggerPriceUi} (${tp.sizeAmountUi} tokens)`);
          }
        }
        if (order.stopLossOrders.length > 0) {
          console.log(`SL Orders:`);
          for (const sl of order.stopLossOrders) {
            console.log(`  ${sl.symbol} ${sl.sideUi}: trigger @ $${sl.triggerPriceUi} (${sl.sizeAmountUi} tokens)`);
          }
        }
      }
    }
  });

  ws.on("close", () => {
    console.log("Disconnected. Reconnecting in 5s...");
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err.message);
  });

  // Respond to server pings (keepalive)
  ws.on("ping", () => ws.pong());
}

connect();
```

## Python

```python
import asyncio
import json
import websockets

FLASH_WS_URL = "wss://flashapi.trade"
WALLET = "YOUR_WALLET_PUBKEY"

async def monitor():
    url = f"{FLASH_WS_URL}/owner/{WALLET}/ws?includePnlInLeverageDisplay=true&updateIntervalMs=2000"

    while True:
        try:
            async with websockets.connect(url) as ws:
                print("Connected to Flash Trade WebSocket")

                async for message in ws:
                    msg = json.loads(message)

                    if msg["type"] == "positions":
                        print(f"\n--- Positions ---")
                        for pos in msg["data"]:
                            pnl = float(pos["pnlWithFeeUsdUi"])
                            marker = "+" if pnl >= 0 else ""
                            print(
                                f"  {pos['marketSymbol']} {pos['sideUi']:5s} | "
                                f"Size: ${pos['sizeUsdUi']:>10s} | "
                                f"PnL: {marker}${pos['pnlWithFeeUsdUi']:>10s} ({pos['pnlPercentageWithFee']}%) | "
                                f"Liq: ${pos['liquidationPriceUi']}"
                            )

                    elif msg["type"] == "orders":
                        for order in msg["data"]:
                            for tp in order.get("takeProfitOrders", []):
                                print(f"  TP: {tp['symbol']} @ ${tp['triggerPriceUi']}")
                            for sl in order.get("stopLossOrders", []):
                                print(f"  SL: {sl['symbol']} @ ${sl['triggerPriceUi']}")

        except websockets.ConnectionClosed:
            print("Disconnected. Reconnecting in 5s...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Error: {e}. Reconnecting in 10s...")
            await asyncio.sleep(10)

asyncio.run(monitor())
```

## Connection Notes

- **Update interval:** `updateIntervalMs` controls how often position updates arrive (100ms to 10s, default 1000ms)
- **Per-owner limit:** Max 5 concurrent WebSocket connections per wallet
- **Keepalive:** Server sends Ping every 30s, expects Pong within 10s
- **Reconnection:** Always implement automatic reconnection with backoff
- **Message types:** `"positions"` (sent periodically) and `"orders"` (sent on change)
