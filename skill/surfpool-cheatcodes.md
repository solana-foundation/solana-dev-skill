# Surfpool Cheatcodes Reference

All 22 `surfnet_*` JSON-RPC methods available on the surfnet RPC endpoint (default `http://127.0.0.1:8899`).

Every request uses standard JSON-RPC 2.0 format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "surfnet_<method>",
  "params": [...]
}
```

---

## Account Manipulation

### `surfnet_setAccount`

Set or update an account's state directly.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `pubkey` | `string` | Base-58 encoded public key |
| 2 | `update` | `object` | Fields to update |

**`update` fields** (all optional):

| Field | Type | Description |
|---|---|---|
| `lamports` | `u64` | Account balance in lamports |
| `data` | `string` | Base-64 encoded account data |
| `owner` | `string` | Base-58 program owner |
| `executable` | `bool` | Whether the account is executable |
| `rent_epoch` | `u64` | Rent epoch |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_setAccount",
  "params": [
    "5cQvx...",
    { "lamports": 1000000000, "owner": "11111111111111111111111111111111" }
  ]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_setTokenAccount`

Set or update an SPL token account.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `owner` | `string` | Token account owner (base-58) |
| 2 | `mint` | `string` | Token mint (base-58) |
| 3 | `update` | `object` | Token account fields to update |
| 4 | `token_program` | `string?` | Token program address (optional, defaults to Token Program) |

**`update` fields** (all optional):

| Field | Type | Description |
|---|---|---|
| `amount` | `string` | Token amount |
| `delegate` | `string?` | Delegate pubkey |
| `state` | `string` | Account state |
| `delegated_amount` | `string` | Delegated amount |
| `close_authority` | `string?` | Close authority pubkey |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_setTokenAccount",
  "params": [
    "5cQvx...",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    { "amount": "1000000000" }
  ]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_resetAccount`

Reset an account to its initial state (re-fetches from remote RPC if available).

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `pubkey` | `string` | Base-58 encoded public key |
| 2 | `config` | `object?` | Optional configuration |

**`config` fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `include_owned_accounts` | `bool` | `false` | Cascade reset to accounts owned by this account |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_resetAccount",
  "params": ["5cQvx..."]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_streamAccount`

Mark an account for automatic remote fetching and caching.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `pubkey` | `string` | Base-58 encoded public key |
| 2 | `config` | `object?` | Optional configuration |

**`config` fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `include_owned_accounts` | `bool` | `false` | Also stream accounts owned by this account |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_streamAccount",
  "params": ["5cQvx..."]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_getStreamedAccounts`

List all accounts currently marked for streaming.

**Parameters:** None.

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getStreamedAccounts",
  "params": []
}
```

**Returns:** `RpcResponse<GetStreamedAccountsResponse>` — object containing streamed account addresses.

---

## Program Management

### `surfnet_cloneProgramAccount`

Copy a program (and its program data account) from one address to another.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `source_program_id` | `string` | Source program address (base-58) |
| 2 | `destination_program_id` | `string` | Destination program address (base-58) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_cloneProgramAccount",
  "params": ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "MyCustomToken..."]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_setProgramAuthority`

Change a program's upgrade authority.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `program_id` | `string` | Program address (base-58) |
| 2 | `new_authority` | `string?` | New authority pubkey (omit to remove upgrade authority) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_setProgramAuthority",
  "params": ["MyProgram...", "NewAuthority..."]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_writeProgram`

Deploy program data in chunks, bypassing transaction size limits (5MB RPC limit).

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `program_id` | `string` | Program address (base-58) |
| 2 | `data` | `string` | Hex-encoded program data chunk |
| 3 | `offset` | `number` | Byte offset to write at |
| 4 | `authority` | `string?` | Write authority (optional, defaults to system program) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_writeProgram",
  "params": ["MyProgram...", "deadbeef...", 0]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_registerIdl`

Register an IDL for a program in memory.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `idl` | `object` | Full Anchor IDL object (address should match program pubkey) |
| 2 | `slot` | `number?` | Slot at which to register (defaults to latest) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_registerIdl",
  "params": [{ "address": "MyProgram...", "metadata": {}, "instructions": [], "accounts": [] }]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_getActiveIdl`

Retrieve the registered IDL for a program.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `program_id` | `string` | Program address (base-58) |
| 2 | `slot` | `number?` | Slot to query at (defaults to latest) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getActiveIdl",
  "params": ["MyProgram..."]
}
```

**Returns:** `RpcResponse<Option<Idl>>` — the IDL object, or `null` if none registered.

---

## Time Control

### `surfnet_timeTravel`

Jump forward or backward in time on the local network.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `config` | `object?` | Time travel configuration (provide one field) |

**`config` fields** (mutually exclusive):

| Field | Type | Description |
|---|---|---|
| `absoluteTimestamp` | `u64` | Jump to a specific UNIX timestamp |
| `absoluteSlot` | `u64` | Jump to a specific slot |
| `absoluteEpoch` | `u64` | Jump to a specific epoch (1 epoch = 432,000 slots) |

**Example — jump to epoch 100:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_timeTravel",
  "params": [{ "absoluteEpoch": 100 }]
}
```

**Returns:** `EpochInfo` — the updated clock state.

---

### `surfnet_pauseClock`

Freeze slot advancement. No new slots are produced until resumed.

**Parameters:** None.

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_pauseClock",
  "params": []
}
```

**Returns:** `EpochInfo` — clock state at the moment of pause.

---

### `surfnet_resumeClock`

Resume slot advancement after a pause.

**Parameters:** None.

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_resumeClock",
  "params": []
}
```

**Returns:** `EpochInfo` — resumed clock state.

---

## Transaction Profiling

### `surfnet_profileTransaction`

Simulate a transaction without committing state and return compute-unit estimates with before/after account snapshots.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `transaction_data` | `string` | Base-64 encoded `VersionedTransaction` |
| 2 | `tag` | `string?` | Optional tag for grouping profiles |
| 3 | `config` | `object?` | Optional profile result configuration |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_profileTransaction",
  "params": ["AQAAAA..."]
}
```

**Returns:** `RpcResponse<UiKeyedProfileResult>` — CU estimates, logs, errors, and account snapshots.

---

### `surfnet_getTransactionProfile`

Retrieve a stored transaction profile by signature or UUID.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `signature_or_uuid` | `string` | Transaction signature (base-58) or UUID |
| 2 | `config` | `object?` | Optional profile result configuration |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getTransactionProfile",
  "params": ["5wHu1qwD..."]
}
```

**Returns:** `RpcResponse<Option<UiKeyedProfileResult>>` — the profile, or `null` if not found.

---

### `surfnet_getProfileResultsByTag`

Retrieve all profiles associated with a tag.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `tag` | `string` | Tag to query |
| 2 | `config` | `object?` | Optional profile result configuration |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getProfileResultsByTag",
  "params": ["my-test-suite"]
}
```

**Returns:** `RpcResponse<Option<Vec<UiKeyedProfileResult>>>` — array of profiles, or `null`.

---

## Network State

### `surfnet_setSupply`

Configure what `getSupply` returns.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `update` | `object` | Supply fields to override |

**`update` fields** (all optional):

| Field | Type | Description |
|---|---|---|
| `total` | `u64` | Total supply in lamports |
| `circulating` | `u64` | Circulating supply |
| `non_circulating` | `u64` | Non-circulating supply |
| `non_circulating_accounts` | `string[]` | Non-circulating account addresses |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_setSupply",
  "params": [{ "total": 500000000000000000, "circulating": 400000000000000000 }]
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_resetNetwork`

Reset the entire network to its initial state.

**Parameters:** None.

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_resetNetwork",
  "params": []
}
```

**Returns:** `RpcResponse<()>`

---

### `surfnet_getLocalSignatures`

Get recent transaction signatures with logs and errors.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `limit` | `number?` | Max signatures to return (default 50) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getLocalSignatures",
  "params": [10]
}
```

**Returns:** `RpcResponse<Vec<RpcLogsResponse>>` — array of signatures with logs.

---

### `surfnet_getSurfnetInfo`

Get network information including runbook execution history.

**Parameters:** None.

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_getSurfnetInfo",
  "params": []
}
```

**Returns:** `RpcResponse<GetSurfnetInfoResponse>`

---

### `surfnet_exportSnapshot`

Export all account state as a JSON snapshot.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `config` | `object?` | Optional export configuration |

**`config` fields:**

| Field | Type | Description |
|---|---|---|
| `includeParsedAccounts` | `bool` | Include parsed account data |
| `filter` | `object?` | Filter: `includeProgramAccounts`, `includeAccounts`, `excludeAccounts` |
| `scope` | `object?` | Scope: `"network"` (default) or `{"preTransaction": "<base64_tx>"}` |

**Example — export full network state:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_exportSnapshot",
  "params": []
}
```

**Example — export with filters:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_exportSnapshot",
  "params": [{
    "includeParsedAccounts": true,
    "filter": { "includeAccounts": ["5cQvx...", "8bRz..."] }
  }]
}
```

**Returns:** `RpcResponse<BTreeMap<String, AccountSnapshot>>` — map of pubkeys to account snapshots. Load snapshots on start with `surfpool start --snapshot ./export.json`.

---

## Scenarios

### `surfnet_registerScenario`

Register a set of account overrides on a timeline.

**Parameters:**

| # | Name | Type | Description |
|---|---|---|---|
| 1 | `scenario` | `object` | Scenario definition |
| 2 | `slot` | `number?` | Base slot for relative slot calculations (defaults to current) |

**`scenario` fields:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier (UUID v4) |
| `name` | `string` | Human-readable name |
| `description` | `string` | Description |
| `tags` | `string[]` | Tags for categorization |
| `overrides` | `object[]` | Array of override instances |

**`overrides[]` fields:**

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique override identifier |
| `templateId` | `string` | Reference to an override template |
| `values` | `object` | Map of field paths to override values |
| `scenarioRelativeSlot` | `u64` | Slot offset from base when override applies |
| `label` | `string?` | Optional label |
| `enabled` | `bool` | Whether this override is active |
| `fetchBeforeUse` | `bool` | Fetch fresh data before applying (for price feeds) |
| `account` | `object` | Account specifier (pubkey or PDA) |

**Example:**

```json
{
  "jsonrpc": "2.0", "id": 1,
  "method": "surfnet_registerScenario",
  "params": [{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "SOL price drop",
    "description": "Simulate SOL dropping to $50",
    "tags": ["oracle", "testing"],
    "overrides": [{
      "id": "override-1",
      "templateId": "pyth-sol-usd-v2",
      "scenarioRelativeSlot": 0,
      "label": "Set SOL price to $50",
      "enabled": true,
      "fetchBeforeUse": false,
      "account": { "type": "pubkey", "value": "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE" },
      "values": {
        "price_message.price": 5000000000,
        "price_message.publish_time": 1700000000
      }
    }]
  }]
}
```

**Returns:** `RpcResponse<()>`

See [surfpool-scenarios.md](surfpool-scenarios.md) for all available templates and protocol details.
