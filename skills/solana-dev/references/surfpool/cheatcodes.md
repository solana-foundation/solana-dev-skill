---
title: Surfpool Cheatcodes
description: Full reference for all surfnet_* RPC methods to manipulate time, accounts, and programs in a local Surfpool network during testing.
---

# Surfpool Cheatcodes Reference

All 26 `surfnet_*` JSON-RPC methods available on the surfnet RPC endpoint (default `http://127.0.0.1:8899`), as of Surfpool v1.5.0.

## Account Manipulation

| Method | Description |
|---|---|
| `surfnet_setAccount` | Set or update an account's lamports, data, owner, and executable status directly without transactions. |
| `surfnet_setTokenAccount` | Set or update an SPL token account's balance, delegate, state, and close authority for any mint. |
| `surfnet_resetAccount` | Reset an account to its original state from the remote datasource. Optionally cascades to owned accounts. |
| `surfnet_streamAccount` | Register an account for live streaming — re-fetches from remote datasource on every access instead of caching. |
| `surfnet_streamAccounts` | Register multiple accounts for live streaming in a single call. |
| `surfnet_getStreamedAccounts` | List all accounts currently registered for streaming. |
| `surfnet_offlineAccount` | Pin an account as local-only — it is never re-fetched from the remote datasource. |

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

## Meta / Control

| Method | Description |
|---|---|
| `surfnet_enableCheatcode` | Re-enable previously disabled cheatcodes. Takes a list of method entries, e.g. `[["surfnet_setAccount", ...]]`. |
| `surfnet_disableCheatcode` | Disable specific cheatcodes at runtime. Same parameter shape. A lockout mechanism prevents re-enabling once locked. |

---

## Parameter Examples

Verified JSON-RPC shapes for the most common cheatcodes.

### surfnet_setAccount

`["<pubkey>", {"lamports"?, "data"? (base58 string or byte array), "owner"?, "executable"?, "rent_epoch"?}]`

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_setAccount","params":["<PUBKEY>",{"lamports":10000000000,"owner":"11111111111111111111111111111111"}]}'
```

### surfnet_setTokenAccount

`["<owner>", "<mint>", {"amount"?, "delegate"?, "state"?, "delegated_amount"?, "close_authority"?}, token_program?]`

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_setTokenAccount","params":["<OWNER>","<MINT>",{"amount":1000000000,"state":"initialized"}]}'
```

### surfnet_timeTravel

`[{"absoluteTimestamp": u64} | {"absoluteSlot": u64} | {"absoluteEpoch": u64}]` — returns the resulting `EpochInfo`.

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_timeTravel","params":[{"absoluteSlot":250000000}]}'
```

### surfnet_profileTransaction

`[base64 VersionedTransaction, tag?, config?]` — simulates without committing; returns CU consumption plus pre/post account snapshots.

```bash
curl -X POST http://127.0.0.1:8899 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"surfnet_profileTransaction","params":["<BASE64_TX>","my-benchmark-tag"]}'
```

Other shapes at a glance:

- `surfnet_cloneProgramAccount`: `[source_program_id, destination_program_id]`
- `surfnet_writeProgram`: `[program_id, data_chunk, offset, authority?]`
- `surfnet_streamAccount`: `["<pubkey>", {"includeOwnedAccounts": true}?]`
- `surfnet_pauseClock` / `surfnet_resumeClock`: `[]`
- `surfnet_exportSnapshot`: `[config?]` — v1.4.0 added sysvar and feature-gate filters; output feeds `surfpool start --snapshot`
- `surfnet_registerScenario`: `[Scenario{id, name, description, overrides: [{id, templateId, values, scenarioRelativeSlot, label, enabled, fetchBeforeUse, account: {pubkey|pda}}], tags}, baseSlot?]` — e.g. `templateId: "pyth_btcusd"`, `values: {"price_message.price_value": 67500}`; use `scenarioRelativeSlot` to schedule oracle overrides on a slot timeline and `fetchBeforeUse` to refresh live oracle data before applying overrides

---

## Surfpool MCP Server

For MCP server setup, available tools, resources, and agent workflows, see the [MCP Integration section in overview.md](overview.md#mcp-integration).
