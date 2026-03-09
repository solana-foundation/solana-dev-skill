# Surfpool Cheatcodes Reference

All `surfnet_*` JSON-RPC methods available on the surfnet RPC endpoint (default `http://127.0.0.1:8899`).

## Account Manipulation

| Method | Description |
|---|---|
| `surfnet_setAccount` | Set or update an account's lamports, data, owner, and executable status directly without transactions. |
| `surfnet_setTokenAccount` | Set or update an SPL token account's balance, delegate, state, and close authority for any mint. |
| `surfnet_resetAccount` | Reset an account to its original state from the remote datasource. Optionally cascades to owned accounts. |
| `surfnet_streamAccount` | Register an account for live streaming — re-fetches from remote datasource on every access instead of caching. |
| `surfnet_getStreamedAccounts` | List all accounts currently registered for streaming. |

## Program Management

| Method | Description |
|---|---|
| `surfnet_cloneProgramAccount` | Clone a program and its program data account from one address to another. Useful for forking programs. |
| `surfnet_setProgramAuthority` | Change or remove the upgrade authority on a program's ProgramData account. |
| `surfnet_writeProgram` | Deploy program data in chunks at a byte offset, bypassing transaction size limits (up to 5MB RPC limit). |
| `surfnet_registerIdl` | Register an Anchor IDL for a program in memory, enabling parsed account data in responses. |
| `surfnet_getActiveIdl` | Retrieve the registered IDL for a program at a given slot. Returns null if none registered. |

## Time Control

| Method | Description |
|---|---|
| `surfnet_timeTravel` | Jump the network clock to a specific UNIX timestamp, slot, or epoch. Useful for testing time-dependent logic. |
| `surfnet_pauseClock` | Freeze slot advancement and block production. Network stays at current slot until resumed. |
| `surfnet_resumeClock` | Resume slot advancement and block production after a pause. |

## Transaction Profiling

| Method | Description |
|---|---|
| `surfnet_profileTransaction` | Dry-run a transaction and return CU estimates, logs, errors, and before/after account state snapshots. |
| `surfnet_getTransactionProfile` | Retrieve a stored transaction profile by signature or UUID. |
| `surfnet_getProfileResultsByTag` | Retrieve all profiling results grouped under a tag. Useful for benchmarking test suites. |

## Network State

| Method | Description |
|---|---|
| `surfnet_setSupply` | Override what `getSupply` returns — total, circulating, and non-circulating amounts. |
| `surfnet_resetNetwork` | Reset the entire network to its initial state. All accounts revert to their original remote state. |
| `surfnet_getLocalSignatures` | Get recent transaction signatures with logs and errors. Defaults to last 50. |
| `surfnet_getSurfnetInfo` | Get network info including runbook execution status and configuration. |
| `surfnet_exportSnapshot` | Export all account state as JSON. Reload with `surfpool start --snapshot ./export.json`. |

## Scenarios

| Method | Description |
|---|---|
| `surfnet_registerScenario` | Register a scenario with timed account overrides using templates (e.g. Pyth price feeds, Raydium pools). |

---

## Surfpool Embedded MCP Server

Surfpool ships with a built-in MCP (Model Context Protocol) server. This lets AI coding agents start local Solana networks, fund accounts, call any RPC method (including all cheatcodes above), and create test scenarios — all without the user needing to run commands manually.

### How it works

The MCP server communicates over **stdio** (standard input/output). The agent's host process spawns `surfpool mcp` as a subprocess, then sends JSON-RPC messages over stdin and reads responses from stdout. This is the standard MCP stdio transport.

When surfpool's HTTP server is running (e.g. via `surfpool start`), the MCP is also available over HTTP at `http://127.0.0.1:<port>/mcp` using the Streamable HTTP transport.

### Setup

Run the MCP server directly:

```bash
surfpool mcp
```

#### Claude Code / Claude Desktop

Add to your MCP settings (`.claude/settings.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "surfpool": {
      "command": "surfpool",
      "args": ["mcp"]
    }
  }
}
```

#### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "surfpool": {
      "command": "surfpool",
      "args": ["mcp"]
    }
  }
}
```

#### VS Code / Copilot

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "surfpool": {
      "command": "surfpool",
      "args": ["mcp"]
    }
  }
}
```

### Available MCP tools

| Tool | Description |
|---|---|
| `start_surfnet` | Start a new local Solana network. By default returns a shell command for the agent to execute. Set `run_as_subprocess: true` to start headless in the background. Returns RPC URL, surfnet ID, and port. |
| `set_token_accounts` | Fund wallets with SOL and SPL tokens on a running surfnet. Accepts a list of owners (or generates new wallets) with token mint/symbol and amount. Defaults to 100,000 tokens if amount omitted. |
| `start_surfnet_with_token_accounts` | Convenience combo: starts a surfnet headless and immediately funds accounts. Returns RPC URL, surfnet ID, and all created account details in one response. |
| `call_surfnet_rpc` | Call any Solana or surfnet RPC method by name and port. Supports all standard Solana RPC methods (`getBalance`, `sendTransaction`, etc.) plus all `surfnet_*` cheatcodes listed above. |
| `get_override_templates` | Fetch all available scenario override templates (Pyth, Raydium, Switchboard, Kamino, etc.). Must be called before `create_scenario` to get valid template IDs and property names. |
| `create_scenario` | Create test scenarios with timed account state overrides. Each override references a template, sets property values, and fires at a relative slot (1 slot = 400ms). Returns a Surfpool Studio URL. |
| `get_token_address` | Translate a token symbol ("USDC", "SOL", "JUP") into its mint address, name, and decimals using the verified tokens list. |

### Available MCP resources

| Resource URI | Description |
|---|---|
| `str:///rpc_endpoints` | JSON documentation of all available RPC methods with parameters, organized by category (transactions, accounts, tokens, system, surfnet cheatcodes). Used by agents to discover what `call_surfnet_rpc` can do. |
| `str:///override_templates` | All account override templates with their IDs, properties, PDA derivation config, and constants. Same data as `get_override_templates` tool. |

### Typical agent workflow

```
1. start_surfnet()                        → get RPC URL (e.g. http://127.0.0.1:8899)
2. set_token_accounts(url, accounts)      → fund wallets with SOL / USDC / etc.
3. call_surfnet_rpc(port, method, params) → send transactions, query balances, use cheatcodes
4. get_override_templates()               → discover available protocol templates
5. create_scenario(scenario)              → set up oracle prices, pool states on a timeline
6. call_surfnet_rpc(port, "surfnet_profileTransaction", [tx]) → profile CU usage
```

The agent can also use `call_surfnet_rpc` to invoke any cheatcode directly — for example, `surfnet_setAccount` to override account state, `surfnet_timeTravel` to advance the clock, or `surfnet_exportSnapshot` to save network state for later.
