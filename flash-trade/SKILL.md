---
name: FlashTrade
description: Flash Trade perpetual futures DEX developer integration on Solana. REST API, TypeScript SDK, MCP server, WebSocket streaming, transaction building, position management, trigger orders, liquidity provision. USE WHEN building on Flash Trade, integrating Flash Trade API, trading bot development, Flash Trade positions, Flash Trade liquidity, flash-sdk, flash perpetuals, flash perps.
---

# Flash Trade Developer Integration

Flash Trade is a pool-to-peer perpetual futures DEX on Solana. Up to 100x leverage (500x Degen Mode), Pyth oracle pricing, virtual asset support (forex, commodities, equities).

**Program ID (Mainnet):** `FLASH6Lo6h3iasJKWDs2F8TkW2UKf3s15C8PMGuVfgBn`
**Program ID (Devnet):** `FTPP4jEWW1n8s2FEccwVfS9KCPjpndaswg7Nkkuz4ER4`

## Integration Surfaces (Choose Your Path)

| Surface | Best For | Language | Complexity |
|---------|----------|----------|------------|
| **REST API** | Apps, bots, dashboards, any language | Any (HTTP) | Low |
| **WebSocket** | Real-time position/order/price feeds | Any (WS) | Low |
| **MCP Server** | AI agent integrations | MCP clients | Low |
| **TypeScript SDK** | Direct on-chain control, custom programs | TypeScript | High |

## Quick Start (REST API)

```bash
# Set your API base URL
export FLASH_API_URL="https://flashapi.trade"

# Get all markets
curl $FLASH_API_URL/raw/markets

# Get current prices
curl $FLASH_API_URL/prices

# Get wallet positions (enriched with PnL)
curl $FLASH_API_URL/positions/owner/<WALLET_PUBKEY>

# Open position (returns preview + unsigned transaction)
curl -X POST $FLASH_API_URL/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG",
    "owner": "<WALLET_PUBKEY>"
  }'
```

## Intent Router

| Intent | REST API Path | SDK Method | Reference |
|--------|--------------|------------|-----------|
| List markets/pools/custodies | `GET /raw/markets` | `PoolConfig.fromIdsByName()` | [ApiReference](ApiReference.md) |
| Get oracle prices | `GET /prices` | `ViewHelper.getOraclePrice()` | [ApiReference](ApiReference.md) |
| Get wallet positions + PnL | `GET /positions/owner/{owner}` | `ViewHelper.getPositionData()` | [ApiReference](ApiReference.md) |
| Get wallet orders | `GET /orders/owner/{owner}` | — | [ApiReference](ApiReference.md) |
| Open position | `POST /transaction-builder/open-position` | `client.openPosition()` | [TransactionFlow](TransactionFlow.md) |
| Close position | `POST /transaction-builder/close-position` | `client.closePosition()` | [TransactionFlow](TransactionFlow.md) |
| Reverse position | `POST /transaction-builder/reverse-position` | — | [TransactionFlow](TransactionFlow.md) |
| Add/remove collateral | `POST /transaction-builder/add-collateral` | `client.addCollateral()` | [TransactionFlow](TransactionFlow.md) |
| Place TP/SL | `POST /transaction-builder/place-trigger-order` | `client.placeTriggerOrder()` | [ApiReference](ApiReference.md) |
| Place limit order | `POST /transaction-builder/open-position` (orderType=LIMIT) | `client.placeLimitOrder()` | [ApiReference](ApiReference.md) |
| Preview fees/PnL | `POST /preview/*` | `ViewHelper.*` | [ApiReference](ApiReference.md) |
| Stream positions live | `WS /owner/{owner}/ws` | — | [WebSocketStreaming](WebSocketStreaming.md) |
| Pool stats (AUM, utilization) | `GET /pool-data` | `ViewHelper.getAssetsUnderManagement()` | [ApiReference](ApiReference.md) |
| AI agent integration | MCP tools | — | [McpIntegration](McpIntegration.md) |

## Critical Rules

- **Minimum collateral >$10 after fees** for limit orders, TP, and SL. Use $11-12+ when TP/SL is needed.
- **Blockhash expiry ~60s** — sign and submit transactions promptly after building.
- **SOL positions use JitoSOL** as underlying collateral on-chain.
- **Pyth prices are mainnet only** — devnet returns stale/zero.
- **Max 5 trigger orders** (TP or SL) per market position.
- **All amounts are UI format** (human-readable, e.g., "100.0") in API requests.
- **No authentication required** — API is public. WebSocket has per-owner connection limits (5).
- **One position per market per side per wallet.** Multiple orders for the same market+side merge into one position — you cannot hold independent positions at different entry prices.
- **Wallet balances not available via Flash Trade API** — use Solana RPC `getTokenAccountsByOwner` to check balances before building transactions.

## REST API Scope

The REST API covers **trading operations only**:
- Positions: open, close, reverse
- Collateral: add, remove
- Trigger orders: place, edit, cancel TP/SL
- Previews: fees, margin, TP/SL projections
- Data: markets, pools, prices, positions, orders, pool stats

**Not available via REST API (requires [TypeScript SDK](SdkReference.md)):**
- LP operations (add/remove liquidity, compounding)
- FLP staking (deposit, unstake, collect rewards)
- FLASH token staking
- Limit order edit/cancel (SDK uses `editLimitOrder` with `sizeAmount=0` to cancel)

**Implicit operations via REST (no dedicated endpoint):**
- **Increase size:** Call `open-position` on a market where you already have a position — the API detects the existing position and calls `increaseSize` internally.
- **Decrease size:** Call `close-position` with a partial `inputUsdUi` amount — the API calls `decreaseSize` internally.
- **Place limit order:** Call `open-position` with `orderType: "LIMIT"` and `limitPrice` — the API builds a `placeLimitOrder` instruction.

## Workflow Routing

| Workflow | Trigger | File |
|----------|---------|------|
| **SetupIntegration** | Getting started, setup, connect, configure | `Workflows/SetupIntegration.md` |
| **QueryData** | Read markets, positions, prices, orders, pool data | `Workflows/QueryData.md` |
| **BuildTransaction** | Open, close, reverse position, add/remove collateral, trigger orders | `Workflows/BuildTransaction.md` |
| **ManagePositions** | Position lifecycle, monitoring, TP/SL management, risk | `Workflows/ManagePositions.md` |

## Documentation Map

| File | Content |
|------|---------|
| [ApiReference.md](ApiReference.md) | Complete REST API — all endpoints, request/response DTOs |
| [TransactionFlow.md](TransactionFlow.md) | Build → sign → submit lifecycle with multi-language examples |
| [WebSocketStreaming.md](WebSocketStreaming.md) | Real-time WebSocket streaming |
| [McpIntegration.md](McpIntegration.md) | AI agent integration via MCP server |
| [SdkReference.md](SdkReference.md) | TypeScript SDK (advanced, direct on-chain) |
| [ProtocolConcepts.md](ProtocolConcepts.md) | Domain knowledge — pools, markets, fees, leverage, degen mode |
| [ErrorReference.md](ErrorReference.md) | All 69 error codes with solutions |

**Templates & Examples:**
- [templates/api-trading-bot.py](templates/api-trading-bot.py) — Production Python trading bot (REST API)
- [examples/api-quickstart/](examples/api-quickstart/README.md) — Quick start in cURL, TypeScript, Python
- [examples/websocket-bot/](examples/websocket-bot/README.md) — Real-time position monitor (TypeScript + Python)

## Examples

**Example 1: Build a trading bot (REST API)**
```
User: "Build a Python bot that monitors SOL price and opens a long when it dips below $140"
→ Invokes SetupIntegration workflow (API setup)
→ Invokes QueryData workflow (price polling)
→ Invokes BuildTransaction workflow (open position)
→ References: ApiReference.md, TransactionFlow.md
```

**Example 2: Real-time position dashboard**
```
User: "Create a dashboard showing all my positions with live PnL"
→ Invokes QueryData workflow (get positions)
→ References: WebSocketStreaming.md (live updates), ApiReference.md (enriched positions)
```

**Example 3: AI agent that trades**
```
User: "Give my Claude agent the ability to trade on Flash Trade"
→ Invokes SetupIntegration workflow (MCP server setup)
→ References: McpIntegration.md
```
