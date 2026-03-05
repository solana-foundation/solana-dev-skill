# Surfpool Reference

## What is Surfpool

Surfpool is a drop-in replacement for `solana-test-validator` built on [LiteSVM](https://github.com/LiteSVM/litesvm). It provides a local Solana network (called a "surfnet") with sub-second startup, automatic mainnet state cloning, transaction profiling, and a built-in web UI (Studio).

Key differences from `solana-test-validator`:
- **Instant startup** — no genesis ledger to bootstrap; the SVM runs in-process.
- **Mainnet state on demand** — accounts are lazily fetched from a remote RPC and cached locally. No need to pre-clone accounts.
- **Cheatcodes** — 22 `surfnet_*` RPC methods to manipulate time, accounts, programs, and scenarios without restarting.
- **Transaction profiling** — compute-unit estimation with before/after account snapshots.
- **Scenario system** — override protocol state (Pyth, Jupiter, Raydium, etc.) to simulate market conditions.
- **Infrastructure as Code** — define deployment runbooks in `txtx.yml` and auto-execute on start.
- **MCP server** — expose surfnet operations as tool calls for AI agents.

## Installation

```bash
curl -sL https://run.surfpool.run/ | bash
```

Or install from source with Cargo:

```bash
cargo surfpool-install
```

Verify installation:

```bash
surfpool --version
```

## Quick Start

### Anchor Project

Start surfpool in the root of an Anchor workspace. It detects `txtx.yml` (or generates one) and deploys programs automatically:

```bash
cd my-anchor-project
surfpool start
```

Use `--watch` to auto-redeploy when `.so` files change in `target/deploy/`:

```bash
surfpool start --watch
```

For Anchor test suites, enable compatibility mode:

```bash
surfpool start --legacy-anchor-compatibility
```

### Mainnet State Cloning

Fork mainnet state with zero config — accounts are fetched lazily when accessed:

```bash
surfpool start --network mainnet
```

Use a custom RPC for better rate limits:

```bash
surfpool start --rpc-url https://my-rpc-provider.com
```

Run fully offline (no remote fetching):

```bash
surfpool start --offline
```

### CI Mode

Start with CI-optimized defaults (no TUI, no Studio, no profiling, no logs):

```bash
surfpool start --ci
```

Run as a background daemon (Linux only):

```bash
surfpool start --ci --daemon
```

## When to Use Surfpool

| Criterion | surfpool | solana-test-validator | litesvm / bankrun |
|---|---|---|---|
| Startup time | Sub-second | 10-30 seconds | Sub-second |
| Architecture | In-process SVM (LiteSVM) | Full validator runtime | In-process SVM |
| RPC server | Full JSON-RPC on port 8899 | Full JSON-RPC on port 8899 | No RPC server (bankrun has limited BanksClient) |
| WebSocket support | Yes (port 8900) | Yes | No |
| Mainnet state | Lazy clone on first access | Manual `--clone` per account | Manual account setup |
| Account manipulation | 22 cheatcode RPC methods | None (restart + `--account` files) | Direct `set_account()` in-process |
| Time control | `surfnet_timeTravel`, `pauseClock`, `resumeClock` | `--slots-per-epoch`, warp via CLI | `warp_to_slot()` in-process |
| Transaction profiling | Built-in CU profiling with snapshots | None | None |
| Program hot-reload | `--watch` flag | Restart required | Restart required |
| Web UI | Studio (port 18488) | None | None |
| Protocol scenarios | 8 built-in protocols | None | None |
| MCP server | Built-in (`surfpool mcp`) | None | None |
| Geyser plugins | Supported | Supported | Not supported |
| CI mode | `--ci` flag | Manual config | Native (no server needed) |
| Infrastructure as Code | txtx.yml runbooks | None | None |
| Offline mode | `--offline` flag | Always offline | Always offline |
| Persistent state | `--db` flag (SQLite) | Ledger directory | None |

**Use surfpool** for local development, integration testing, mainnet forking, and CI pipelines that need an RPC endpoint.

**Use litesvm/bankrun** for unit-level program tests that run in-process without an RPC server.

**Use solana-test-validator** only when specific validator runtime behavior is required that surfpool does not yet replicate (vote processing, leader schedule, etc.).

### Decision Tree

- **Unit test exercising a single instruction in isolation?** Use litesvm (Rust) or bankrun (JS/Python).
- **Need a full JSON-RPC endpoint?** Use surfpool.
- **Need mainnet account state (tokens, programs, oracles)?** Use surfpool (lazy cloning).
- **Need to manipulate time, accounts, or protocol state at runtime?** Use surfpool (cheatcodes).
- **Local dev environment with hot-reload?** Use surfpool (`--watch`).
- **CI pipeline needing RPC?** Use `surfpool start --ci`.
- **DeFi scenario simulation?** Use surfpool (scenario system).
- **Full validator fidelity?** Use solana-test-validator.

### Summary Table

| Use Case | Recommended Tool |
|---|---|
| Unit testing a single instruction | litesvm / bankrun |
| Integration testing with RPC | surfpool |
| Local development with hot-reload | surfpool |
| Mainnet fork testing | surfpool |
| CI pipeline (needs RPC) | surfpool (`--ci`) |
| CI pipeline (in-process only) | litesvm / bankrun |
| DeFi scenario simulation | surfpool |
| AI agent-assisted development | surfpool (MCP server) |
| Full validator fidelity testing | solana-test-validator |

## Migration from solana-test-validator

Replace:

```bash
solana-test-validator \
  --clone TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA \
  --clone <account-1> \
  --clone <account-2> \
  --url https://api.mainnet-beta.solana.com \
  --reset
```

With:

```bash
surfpool start
```

Accounts are cloned lazily — no need to specify them upfront.

Replace account file loading:

```bash
solana-test-validator --account <pubkey> ./account.json
```

With snapshot loading:

```bash
surfpool start --snapshot ./accounts.json
```

Or use cheatcodes at runtime:

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_setAccount","params":["<pubkey>",{"lamports":1000000000}]}'
```

### From litesvm/bankrun (adding RPC layer)

If in-process tests need to be promoted to integration tests with an RPC endpoint, start surfpool alongside:

```bash
surfpool start --ci
```

Then point the test client to `http://127.0.0.1:8899` instead of using the in-process bank.

## CLI Reference

### `surfpool start`

Start a local Solana network (surfnet). Alias: `surfpool simnet`.

#### Network Configuration

| Flag | Short | Default | Env Var | Description |
|---|---|---|---|---|
| `--port` | `-p` | `8899` | — | RPC port |
| `--ws-port` | `-w` | `8900` | — | WebSocket port |
| `--host` | `-o` | `127.0.0.1` | `SURFPOOL_NETWORK_HOST` | Bind address |
| `--rpc-url` | `-u` | — | `SURFPOOL_DATASOURCE_RPC_URL` | Custom datasource RPC URL (conflicts with `--network`) |
| `--network` | `-n` | — | — | Predefined network: `mainnet`, `devnet`, `testnet` (conflicts with `--rpc-url`) |
| `--offline` | — | `false` | — | Start without a remote RPC client |

#### Block Production

| Flag | Short | Default | Description |
|---|---|---|---|
| `--slot-time` | `-t` | `400` | Slot time in milliseconds |
| `--block-production-mode` | `-b` | `clock` | Block production mode: `clock`, `transaction`, `manual` |

Modes:
- `clock` — advance slots at a fixed interval (default, `400ms`)
- `transaction` — advance a slot only when a transaction is received
- `manual` — slots only advance via explicit RPC calls

#### Airdrops

| Flag | Short | Default | Description |
|---|---|---|---|
| `--airdrop` | `-a` | — | Pubkey(s) to airdrop SOL to on start. Repeatable. |
| `--airdrop-amount` | `-q` | `10000000000000` | Amount of lamports to airdrop (default ~10,000 SOL) |
| `--airdrop-keypair-path` | `-k` | `~/.config/solana/id.json` | Keypair file(s) to airdrop to. Repeatable. |

#### Deployment & Runbooks

| Flag | Short | Default | Description |
|---|---|---|---|
| `--manifest-file-path` | `-m` | `./txtx.yml` | Path to the runbook manifest |
| `--runbook` | `-r` | `deployment` | Runbook ID(s) to execute. Repeatable. |
| `--runbook-input` | `-i` | — | JSON input file(s) for runbooks. Repeatable. |
| `--no-deploy` | — | `false` | Disable auto deployment |
| `--yes` | `-y` | `false` | Skip runbook generation prompts |
| `--watch` | — | `false` | Auto re-execute deployment on `.so` file changes in `target/deploy/` |

#### Anchor Compatibility

| Flag | Short | Default | Description |
|---|---|---|---|
| `--legacy-anchor-compatibility` | — | `false` | Apply Anchor test suite defaults |
| `--anchor-test-config-path` | — | — | Path(s) to `Test.toml` files. Repeatable. |

#### Studio

| Flag | Short | Default | Description |
|---|---|---|---|
| `--studio-port` | `-s` | `18488` | Studio web UI port |
| `--no-studio` | — | `false` | Disable Studio |

#### Profiling & Logging

| Flag | Short | Default | Description |
|---|---|---|---|
| `--disable-instruction-profiling` | — | `false` | Disable instruction profiling |
| `--max-profiles` | `-c` | `200` | Max transaction profiles to hold in memory |
| `--log-level` | `-l` | `info` | Log level: `trace`, `debug`, `info`, `warn`, `error`, `none` |
| `--log-path` | — | `.surfpool/logs` | Log file directory |
| `--log-bytes-limit` | — | `10000` | Max bytes in transaction logs (0 = unlimited) |

#### SVM Features

| Flag | Short | Default | Description |
|---|---|---|---|
| `--feature` | `-f` | — | Enable specific SVM features. Repeatable. |
| `--disable-feature` | — | — | Disable specific SVM features. Repeatable. |
| `--features-all` | — | `false` | Enable all SVM features (override mainnet defaults) |

By default, surfpool uses mainnet feature flags.

#### Plugins & Subgraphs

| Flag | Short | Default | Description |
|---|---|---|---|
| `--geyser-plugin-config` | `-g` | — | Geyser plugin config file(s). Repeatable. |
| `--subgraph-db` | `-d` | `:memory:` | Subgraph database URL (SQLite or Postgres) |

#### Persistence & Snapshots

| Flag | Short | Default | Description |
|---|---|---|---|
| `--db` | — | — | Surfnet database URL for persistent state (`:memory:` or `*.sqlite`) |
| `--surfnet-id` | — | `default` | Unique ID to isolate database storage across instances |
| `--snapshot` | — | — | JSON snapshot file(s) to preload accounts from. Repeatable. |

#### Telemetry

| Flag | Short | Default | Env Var | Description |
|---|---|---|---|---|
| `--metrics-enabled` | — | `false` | `SURFPOOL_METRICS_ENABLED` | Enable Prometheus metrics |
| `--metrics-addr` | — | `0.0.0.0:9000` | `SURFPOOL_METRICS_ADDR` | Prometheus endpoint address |

#### Process Control

| Flag | Short | Default | Description |
|---|---|---|---|
| `--no-tui` | — | `false` | Stream logs instead of terminal UI |
| `--daemon` | — | `false` | Run as background process (Linux only) |
| `--ci` | — | `false` | CI mode (sets `--no-tui`, `--no-studio`, `--disable-instruction-profiling`, `--log-level none`) |
| `--skip-signature-verification` | — | `false` | Skip signature verification for all transactions |

### `surfpool run`

Execute a runbook from the manifest.

| Flag | Short | Default | Description |
|---|---|---|---|
| `--manifest-file-path` | `-m` | `./txtx.yml` | Path to the manifest |
| `--unsupervised` | `-u` | `false` | Execute without interactive supervision |
| `--browser` | `-b` | `false` | Supervise via browser UI |
| `--terminal` | `-t` | `false` | Supervise via terminal (coming soon) |
| `--output-json` | — | — | Output results as JSON. Optional directory path. |
| `--output` | — | — | Pick a specific output to stdout |
| `--explain` | — | `false` | Explain execution plan without running |
| `--env` | — | — | Environment from txtx.yml |
| `--input` | — | — | Input file(s) for batch processing. Repeatable. |
| `--force` | `-f` | `false` | Execute even if cached state shows already executed |
| `--log-level` | `-l` | `info` | Log level |
| `--log-path` | — | `.surfpool/logs` | Log directory |

Positional argument: `<runbook>` — runbook name or `.tx` file path.

```bash
# Execute interactively in browser
surfpool run deployment

# Execute without supervision, output JSON
surfpool run deployment --unsupervised --output-json ./outputs/

# Force re-execution
surfpool run deployment --unsupervised --force
```

### `surfpool ls`

List runbooks in the current directory.

| Flag | Short | Default | Description |
|---|---|---|---|
| `--manifest-file-path` | `-m` | `./txtx.yml` | Path to the manifest |

### `surfpool mcp`

Start the MCP (Model Context Protocol) server for AI agent integrations. No additional flags.

```bash
surfpool mcp
```

### `surfpool completions`

Generate shell completion scripts. Alias: `surfpool completion`.

Positional argument: `<shell>` — `bash`, `zsh`, `fish`, `elvish`, `powershell`.

```bash
surfpool completions zsh
```

### Environment Variables

| Variable | Description | Used By |
|---|---|---|
| `SURFPOOL_DATASOURCE_RPC_URL` | Default datasource RPC URL | `--rpc-url` |
| `SURFPOOL_NETWORK_HOST` | Override bind host | `--host` |
| `SURFPOOL_METRICS_ENABLED` | Enable Prometheus metrics | `--metrics-enabled` |
| `SURFPOOL_METRICS_ADDR` | Prometheus endpoint address | `--metrics-addr` |

## Infrastructure as Code

Surfpool uses `txtx.yml` manifests and runbooks to define deployment workflows.

### Manifest Structure

Place a `txtx.yml` at the project root:

```yaml
name: my-project
runbooks:
  - name: deployment
    description: Deploy programs to localnet
    file: ./runbooks/deployment.tx
```

### Auto-Deploy with Watch

Combine `--watch` with runbooks to auto-redeploy on `.so` file changes:

```bash
surfpool start --watch --runbook deployment
```

### Runbook Inputs

Pass inputs to runbooks for parameterized deployments:

```bash
surfpool start --runbook-input params.json
```

## MCP Integration

Surfpool includes a built-in MCP (Model Context Protocol) server for AI agent integrations. The server communicates over stdio using the MCP protocol.

### Configuration

#### Claude Code

Add to `.claude/settings.json` or project-level `CLAUDE.md`:

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

#### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

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

### Available MCP Tools

| Tool | Description |
|---|---|
| `start_surfnet` | Start a local Solana network. Default returns a shell command; `run_as_subprocess: true` starts in background. |
| `set_token_accounts` | Set SOL/SPL token balances for accounts on a running surfnet |
| `start_surfnet_with_token_accounts` | Start network + fund accounts in one call (background process) |
| `call_surfnet_rpc` | Call any RPC method (standard Solana or `surfnet_*` cheatcodes) on a running surfnet |
| `create_scenario` | Create a protocol state scenario. Read `override_templates` resource first. |
| `get_override_templates` | List available override templates |

### MCP Resources

| Resource URI | Description |
|---|---|
| `str:///rpc_endpoints` | List of all available RPC endpoints |
| `str:///override_templates` | All available scenario override templates |

### Agent Workflow via MCP

1. **Start surfnet:** Call `start_surfnet` or `start_surfnet_with_token_accounts`
2. **Set up state:** Use `set_token_accounts` to fund accounts, or `call_surfnet_rpc` with cheatcodes
3. **Create scenarios:** Read `override_templates`, then call `create_scenario`
4. **Execute transactions:** Use `call_surfnet_rpc` with `sendTransaction` or `simulateTransaction`
5. **Inspect results:** Use `call_surfnet_rpc` with `surfnet_getTransactionProfile` or `surfnet_exportSnapshot`

## Cheatcodes Overview

Surfpool exposes 22 `surfnet_*` JSON-RPC methods on the same port as the standard Solana RPC:

### Account Manipulation
- `surfnet_setAccount` — set lamports, data, owner, executable flag on any account
- `surfnet_setTokenAccount` — set SPL token account balances, delegates, state
- `surfnet_resetAccount` — restore an account to its initial state
- `surfnet_streamAccount` — mark an account for automatic remote fetching and caching
- `surfnet_getStreamedAccounts` — list all streamed accounts

### Program Management
- `surfnet_cloneProgramAccount` — copy a program from one address to another
- `surfnet_setProgramAuthority` — change a program's upgrade authority
- `surfnet_writeProgram` — deploy program data in chunks (bypasses TX size limits)
- `surfnet_registerIdl` — register an IDL for a program in memory
- `surfnet_getActiveIdl` — retrieve the registered IDL for a program

### Time Control
- `surfnet_timeTravel` — jump to an absolute timestamp, slot, or epoch
- `surfnet_pauseClock` — freeze slot advancement
- `surfnet_resumeClock` — resume slot advancement

### Transaction Profiling
- `surfnet_profileTransaction` — simulate a transaction and return CU estimates with account snapshots
- `surfnet_getTransactionProfile` — retrieve a stored profile by signature or UUID
- `surfnet_getProfileResultsByTag` — retrieve all profiles for a given tag

### Network State
- `surfnet_setSupply` — configure what `getSupply` returns
- `surfnet_resetNetwork` — reset the entire network to initial state
- `surfnet_getLocalSignatures` — get recent transaction signatures with logs
- `surfnet_getSurfnetInfo` — get network info including runbook execution history
- `surfnet_exportSnapshot` — export all account state as a JSON snapshot

### Scenarios
- `surfnet_registerScenario` — register a set of account overrides on a timeline

See [surfpool-cheatcodes.md](surfpool-cheatcodes.md) for full parameter schemas and JSON-RPC examples.

## Scenarios Overview

The scenario system allows overriding protocol account state to simulate market conditions, liquidation events, and oracle price movements without deploying mock contracts.

### Supported Protocols

| Protocol | Version | Account Types | Templates |
|---|---|---|---|
| Pyth | v2 | PriceUpdateV2 | SOL/USD, BTC/USD, ETH/USD, ETH/BTC |
| Jupiter | v6 | TokenLedger | Token ledger override |
| Raydium | CLMM v3 | PoolState | SOL/USDC, BTC/USDC, ETH/USDC |
| Switchboard | on-demand | SwitchboardQuote | Quote override |
| Meteora | DLMM v1 | LbPair | SOL/USDC, USDT/SOL |
| Kamino | v1 | Reserve, Obligation | Reserve state, reserve config, obligation health |
| Drift | v2 | PerpMarket, SpotMarket, User, State | Perp market, spot market, user state, global state |
| Whirlpool | v0.7.0 | Whirlpool | SOL/USDC, SOL/USDT, mSOL/SOL, ORCA/USDC |

See [surfpool-scenarios.md](surfpool-scenarios.md) for full template schemas and protocol details.

## Common Agent Workflows

### 1. Start a Local Network and Deploy a Program

```bash
surfpool start --watch
```

Surfpool detects `txtx.yml`, generates a deployment runbook if needed, deploys programs, and airdrops SOL to the default keypair. The RPC is available at `http://127.0.0.1:8899`.

### 2. Set Up Token Accounts for Testing

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_setTokenAccount","params":["<OWNER>","<MINT>",{"amount":"1000000000"}]}'
```

### 3. Test Time-Sensitive Logic

```bash
# Pause
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_pauseClock","params":[]}'

# Time travel to a future epoch
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_timeTravel","params":[{"absoluteEpoch":100}]}'

# Resume
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_resumeClock","params":[]}'
```

### 4. Profile Transaction Compute Units

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_profileTransaction","params":["<BASE64_TX>"]}'
```

### 5. Export and Restore State

```bash
# Export snapshot
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_exportSnapshot","params":[]}'

# Load on next start
surfpool start --snapshot ./snapshot.json
```
