# MCP Integration

## What is the MCP Server

`flash-trade-mcp` is a Model Context Protocol server that wraps the Flash Trade REST API as typed MCP tools for AI agents. It is published on NPM as [`flash-trade-mcp`](https://www.npmjs.com/package/flash-trade-mcp) (v0.4.1).

The server is a thin wrapper that adds:
- **Zod input validation** on every tool call
- **Formatted, AI-readable output** (structured JSON with computed fields)
- **Error normalization** (HTTP errors mapped to MCP error codes)
- **Transaction signing** via local Solana keypair (`sign_and_send` tool)

It does NOT contain trading logic itself -- all execution flows through the Flash Trade REST API.

---

## Setup

### Install and Run

```bash
# One-liner (no install required)
npx flash-trade-mcp
# or
bunx flash-trade-mcp
```

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FLASH_API_URL` | Yes | -- | Flash Trade API base URL (e.g. `https://flashapi.trade`) |
| `FLASH_API_TIMEOUT` | No | `30000` | HTTP timeout in milliseconds |
| `WALLET_PUBKEY` | No | -- | Default wallet pubkey for transaction building |
| `KEYPAIR_PATH` | No | `~/.config/solana/id.json` | Local keypair file for `sign_and_send` |
| `SOLANA_RPC_URL` | No | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint for `sign_and_send` |

### Claude Code Configuration

Add to your MCP settings (`.mcp.json` or Claude Code settings):

```json
{
  "mcpServers": {
    "flash-trade": {
      "command": "npx",
      "args": ["flash-trade-mcp"],
      "env": {
        "FLASH_API_URL": "https://flashapi.trade",
        "WALLET_PUBKEY": "<your-solana-pubkey>"
      }
    }
  }
}
```

---

## Tool Catalog (30 tools)

### Read Tools (no transactions, no side effects)

| Tool | Purpose |
|------|---------|
| `health_check` | Verify API connectivity |
| `get_markets` / `get_market` | List all perp markets or get one by pubkey |
| `get_pools` / `get_pool` | List liquidity pools or get one by pubkey |
| `get_custodies` / `get_custody` | List custody accounts or get one by pubkey |
| `get_prices` / `get_price` | All oracle prices or one by symbol |
| `get_positions` / `get_position` | List positions (optionally by owner) or get one by pubkey |
| `get_orders` / `get_order` | List orders (optionally by owner) or get one by pubkey |
| `get_pool_data` | Pool AUM, LP stats, utilization |
| `get_account_summary` | Complete wallet overview: positions + orders + prices |
| `get_trading_overview` | Trading-ready snapshot: markets + prices + pool utilization |

### Preview Tools (calculations only, no transactions)

| Tool | Purpose |
|------|---------|
| `preview_limit_order_fees` | Estimate fees before placing a limit order |
| `preview_exit_fee` | Estimate close cost for a position |
| `preview_tp_sl` | Calculate TP/SL prices and projected PnL (forward, reverse_pnl, reverse_roi modes) |
| `preview_margin` | Preview effect of adding/removing collateral |

### Transaction Tools (return unsigned base64 transactions)

| Tool | Purpose |
|------|---------|
| `open_position` | Open a new perpetual position |
| `close_position` | Close or partially close a position |
| `reverse_position` | Close current + open opposite direction |
| `add_collateral` | Add collateral to reduce leverage |
| `remove_collateral` | Remove collateral to increase leverage |

### Trigger Order Tools (TP/SL management, return unsigned base64 transactions)

| Tool | Purpose |
|------|---------|
| `place_trigger_order` | Place TP or SL on an existing position |
| `edit_trigger_order` | Edit price/size on an existing TP/SL |
| `cancel_trigger_order` | Cancel a single TP or SL order |
| `cancel_all_trigger_orders` | Cancel all TP/SL for a market + side |

### Signing Tool

| Tool | Purpose |
|------|---------|
| `sign_and_send` | Sign a base64 transaction with local keypair and submit to Solana |

For full parameter details on each tool, see the MCP server's own documentation at `flash-trade-MCP/mcp/CLAUDE.md`.

---

## Typical AI Agent Workflow

```
1. health_check                          --> Verify API is reachable
2. get_trading_overview                  --> Markets, prices, pool utilization
3. get_account_summary(owner=<wallet>)   --> Check existing positions and orders
4. open_position(input_amount="12.0")    --> Build trade ($12+ for TP/SL support)
   --> Show preview (fees, leverage, liquidation) to user
   --> User approves
5. sign_and_send(transaction_base64)     --> Sign and submit IMMEDIATELY
6. get_account_summary(owner=<wallet>)   --> Verify position opened
7. preview_tp_sl                         --> Calculate TP/SL levels
8. place_trigger_order                   --> Add TP/SL
   --> sign_and_send(transaction_base64)
9. close_position                        --> When ready to exit
   --> sign_and_send(transaction_base64)
```

**Critical timing**: Solana blockhashes expire in ~60 seconds. Call `sign_and_send` immediately after user approval. If you get "Blockhash not found", re-call the transaction tool and sign again.

---

## When to Use MCP vs REST API

| Use Case | MCP Server | REST API |
|----------|-----------|----------|
| AI agent integration | Yes | -- |
| Pre-validated inputs (Zod schemas) | Yes | -- |
| Formatted, AI-readable outputs | Yes | -- |
| Transaction signing built-in | Yes | -- |
| Custom applications | -- | Yes |
| Non-AI programmatic access | -- | Yes |
| Maximum flexibility / raw responses | -- | Yes |
| Browser-based apps | -- | Yes |

The MCP server calls the same REST API underneath. Choose MCP when building AI agent workflows; choose the REST API for custom apps or when you need raw control over requests.

---

## MCP Resources

The server exposes three MCP resources for bulk data reads:

| URI | Type | Description |
|-----|------|-------------|
| `flash://accounts` | Static | Snapshot of all pools, custodies, markets, and global config |
| `flash://positions/{owner}` | Template | Enriched positions for a wallet (PnL, leverage, liquidation) |
| `flash://orders/{owner}` | Template | Limit orders, TP, and SL orders for a wallet |

Resources return JSON and can be polled periodically for updates. Data is cached ~15 seconds on the API side.
