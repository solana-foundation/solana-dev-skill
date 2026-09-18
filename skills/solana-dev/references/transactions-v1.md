---
title: Transaction v1 (SIMD-0385 / SIMD-0296)
description: The v1 transaction format that raises the size limit to 4096 bytes — the default for new code. Send it through @solana/kit plugin clients (transactionConfig version 1), read and index it without breaking, and fall back to manual pipe() or the Rust 4.x crates when needed.
---

# Transaction v1 — Larger Transactions

The `v1` transaction format ([SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md)) raises the per-transaction size limit from 1232 to 4096 bytes ([SIMD-0296](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md)). It unlocks ZK proofs, large multisigs, and signature schemes like BLS in a single atomic transaction.

**v1 is the default for new code in this skill.** It activated on mainnet on 2026-09-15 (Agave 4.2.2). Emit v1 unless a wallet or downstream consumer cannot accept it. Readers must still handle legacy and v0 transactions.

**Sending v1 is a config choice. Reading it is not optional** — any RPC or gRPC consumer that hasn't opted in breaks or silently misreports on the v1 transactions now landing in every block.

## Contents

- [Sending v1 through plugin clients (default)](#sending-v1-through-plugin-clients-default)
- [Wallets](#wallets)
- [What v1 changes](#what-v1-changes)
- [Reading transactions and blocks (breaking)](#reading-transactions-and-blocks-breaking)
- [Indexing (silently breaking)](#indexing-silently-breaking)
- [Sending v1 manually with `pipe()`](#sending-v1-manually-with-pipe)
- [Sizing the resource limits](#sizing-the-resource-limits)
- [Kit setter routing by version](#kit-setter-routing-by-version)
- [Library support](#library-support)
- [Checking activation status](#checking-activation-status)
- [Local testing](#local-testing)
- [Cheat sheet](#cheat-sheet)
- [Migration checklist](#migration-checklist)

## Sending v1 through plugin clients (default)

The skill's default client — `createClient().use(signer(…)).use(solanaRpc(…))` — builds v1 when its `transactionConfig` says so. `@solana/kit-plugin-rpc` 0.19+ and `@solana/kit-plugin-litesvm` 0.19+ plan v1 natively; the transaction version is a property of the client assembly, not of each call site.

```ts
import { systemProgram } from '@solana-program/system';
import { createClient, lamports } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';

const client = createClient()
  .use(signer(mySigner))
  .use(solanaRpc({
    rpcUrl,
    transactionConfig: { version: 1, priorityFeeLamports: lamports(5_000n) },
  }))
  .use(systemProgram());

// Every planned transaction is v1: the budget lives in message.config, not in
// ComputeBudget instructions, and the size limit is 4096 bytes.
const { context } = await client.system.instructions
  .transferSol({ amount: lamports(10_000_000n), destination, source: client.payer })
  .sendTransaction();
```

> **Do not add ComputeBudget instructions to a v1 transaction.** They are no-ops on v1: they do not set resource limits or priority fees, but still consume 150 CU and an instruction slot. Use `transactionConfig` with a plugin client, or the version-aware Kit setters and resource estimators on a manual pipeline.

`transactionConfig` is a discriminated union on `version`:

| Field | `version: 'legacy' \| 0` (default when omitted) | `version: 1` |
|---|---|---|
| Priority fee | `microLamportsPerComputeUnit` — a per-CU **price**, paid via a `SetComputeUnitPrice` instruction | `priorityFeeLamports` — a **total** in lamports, written to `message.config` |
| Compute unit limit | provisory `SetComputeUnitLimit` instruction, estimated by the executor | provisory `config.computeUnitLimit`, estimated by the executor |
| Loaded accounts data size | runtime default (64 MiB) | provisory `config.loadedAccountsDataSizeLimit`, estimated by the executor |
| `estimateResourceLimits` | `true` by default | `true` by default — **keep it on**; an unset v1 limit is zero, not a default |

The planner reserves both limits; the executor estimates them with one simulation. A planned v1 message therefore contains provisory zeroes, while the sent transaction contains measured values. Keep `estimateResourceLimits` enabled unless you deliberately set both limits yourself. Disabling it without setting them causes `MaxLoadedAccountsDataSizeExceeded`.

`heapSize` has no planner option. A transaction that needs a larger heap goes through `setTransactionMessageConfig` on a message you plan yourself — see [Sending v1 manually with `pipe()`](#sending-v1-manually-with-pipe).

**LiteSVM**'s planner writes the *maximum* limits (1.4M CU, 64 MiB) by default instead of estimating, and lets you override them:

```ts
import { litesvm } from '@solana/kit-plugin-litesvm';

const client = await createClient()
  .use(generatedSigner())
  .use(litesvm({ transactionConfig: { version: 1, computeUnitLimit: 200_000 } }))
  .use(airdropSigner(lamports(1_000_000_000n)));
```

**Surfpool**'s `surfpool()` plugin forwards `transactionConfig` to the `solanaLocalRpc` it wraps, so `surfpool({ transactionConfig: { version: 1 } })` plans v1 when the resolved `@solana/kit-plugin-rpc` is 0.19+. `@solana/surfpool` 1.5.0 still declares `@solana/kit ^7` and `@solana/kit-plugin-rpc ^0.15` as optional peers, so expect a peer-range warning until it re-pins — see [surfpool/kit-plugin.md](surfpool/kit-plugin.md).

`client.rpc` is an ordinary kit RPC, so reading the transaction back still needs `maxSupportedTransactionVersion: 1` and, over 1232 bytes, `encoding: 'base64'`.

The full send-and-read-back and confidential-transfer examples on a plugin client live in [`transaction-v1-examples/ts/kit-plugins`](https://github.com/solana-foundation/transaction-v1-examples/tree/main/ts/kit-plugins).

## Wallets

A wallet-backed client (`walletSigner()` from `@solana/kit-plugin-wallet` 0.20+) reports what the connected wallet can sign. `SolanaTransactionVersion` in `@solana/wallet-standard-features` 1.5+ includes `1`, so the check is typed:

```ts
const { connected } = client.wallet.getState();
const canSendV1 = connected?.supportedTransactionVersions.has(1) ?? false;
```

In React, the same set is on the value returned by `useConnectedWallet(client)`. The set is the **intersection** of the versions the wallet accepts across every signing feature it exposes (`signTransaction` and `signAndSendTransaction`), so a version is reported only if every path the signer might take accepts it. A wallet that predates versioned transactions reports `Set(['legacy'])` — test for membership, not emptiness.

If `has(1)` is `false`, the wallet rejects a v1 signing request. Keep a `version: 0` client (or a version-0 `transactionConfig` on a second `solanaRpc` plugin) for those users rather than failing the send; the transaction has to fit in 1232 bytes on that path. See [frontend.md](frontend.md#wallet-connection) for the gating pattern, and [`transaction-v1-examples/ts/wallet-table`](https://github.com/solana-foundation/transaction-v1-examples/tree/main/ts/wallet-table) for a live table of which installed wallets advertise `1`.

## What v1 changes

v1 reorders the envelope: signatures move to the **tail**, so the version byte lands at offset zero of the serialized transaction. A v1 transaction therefore starts with byte `129` (`0x81`), and infrastructure can identify the format without deserializing.

This is new to v1. In legacy and v0 the signature vector comes first, so a serialized transaction starts with its signature *count* (`0x01` for the common single-signer case) — `0x80` is the v0 prefix on the **message**, which sits after the signatures. Do not sniff `0x80` at offset zero to detect v0; it isn't there.

The four compute-budget values also move out of `ComputeBudgetProgram` instructions and into a **message config**: a `u32` bitmask at a fixed offset, plus a positional value list carrying only the fields the mask marks present. Per kit's v1 message codec the layout is:

```
version | header(3) | configMask(u32) | lifetimeToken(32) | numInstructions(u8)
        | numStaticAccounts(u8) | staticAccounts[N×32] | configValues | instructions…
```

So the mask is at a fixed offset, but the **values are not** — they sit after the address array, at an offset computed from `numStaticAccounts` plus a popcount of the mask. That is still dramatically cheaper than the v0 path, which requires deserializing the instruction list and scanning it for ComputeBudget instructions: the network can price a transaction from the header alone, without touching instruction data.

| Limit | legacy | v0 | v1 |
|---|---|---|---|
| Transaction size | 1232 bytes | 1232 bytes | **4096 bytes** |
| Account addresses | ~32, size-bound | 64, via lookup tables | **64, inline** |
| Address lookup tables | not supported | supported | **not supported** |
| Duplicate addresses | allowed | allowed | **rejected** |

Dropping lookup tables costs nothing in practice: 64 inline addresses at 32 bytes is 2048 bytes, which fits comfortably inside 4096. (Draft SIMD-0596 would raise the account limit to 96.)

| Budget field | legacy / v0 | v1 |
|---|---|---|
| Compute unit limit | `SetComputeUnitLimit` instruction | `config.computeUnitLimit` |
| Priority fee | `SetComputeUnitPrice` instruction — micro-lamports **per CU** | `config.priorityFeeLamports` — **total lamports** |
| Loaded accounts cap | `SetLoadedAccountsDataSizeLimit` instruction | `config.loadedAccountsDataSizeLimit` |
| Heap size | `RequestHeapFrame` instruction | `config.heapSize` |

`heapSize` keeps the `RequestHeapFrame` bounds: a multiple of 1024, between 32 KiB and 256 KiB. Out-of-range is a **sanitization failure** — the transaction is rejected before execution, so it never lands and never shows a program error. Kit does not validate this client-side, so porting a `RequestHeapFrame` value straight across without checking it is a silent way to build an unlandable transaction.

## Reading transactions and blocks (breaking)

Pass `maxSupportedTransactionVersion: 1` — the JSON **integer** `1` — on `getTransaction`, `getBlock`, and `blockSubscribe`. Passing `0` fails on a v1 transaction exactly like omitting the parameter. Passing a **string** (`"1"`, `"legacy"`) is worse: the field is numeric, so it fails request validation with `-32602` on *every* call, v1 or not.

```ts
const tx = await rpc.getTransaction(signature, { maxSupportedTransactionVersion: 1 }).send();
```

```rust
let tx = rpc_client.get_transaction_with_config(
    &signature,
    RpcTransactionConfig { max_supported_transaction_version: Some(1), ..Default::default() },
)?;
```

Kit 8 exports `MAX_SUPPORTED_TRANSACTION_VERSION` (currently `1`) if you'd rather not hard-code the literal.

Without the opt-in:

| Method | Behavior on a v1 transaction |
|---|---|
| `getTransaction` | Fails with error `-32015` |
| `getBlock` | **One v1 transaction fails the whole block** — no partial result |
| `blockSubscribe` | Emits `block: null` and stops advancing — wedges on the first v1 slot |
| `getSignaturesForAddress` | Unaffected |

Opted-in responses carry a `transactionConfig` object inside `message` for v1 transactions, and omit it entirely for legacy and v0. Note the RPC projection spells the fee `priorityFee` (not `priorityFeeLamports`) and spells absent fields as `null`:

```json
"message": {
  "instructions": ["… no ComputeBudget instruction here …"],
  "recentBlockhash": "GsdgFbNBoZmAB5uPHfk2xUFYyM4Wg2hYZBfBrxrqjxfF",
  "transactionConfig": {
    "computeUnitLimit": 30000,
    "heapSize": null,
    "loadedAccountsDataSizeLimit": 200000,
    "priorityFee": null
  }
}
```

## Indexing (silently breaking)

Four ways an indexer goes quietly wrong rather than loudly failing.

**1. ComputeBudget instruction scanning returns nothing.** Any pipeline deriving priority fees or CU limits by scanning instructions reports **zero for every v1 transaction, without erroring**. Read `transactionConfig` instead, and persist it — it has no v0 equivalent.

**2. Geyser/gRPC has no version gate at all.** There is no `maxSupportedTransactionVersion` equivalent and no version field in the protobuf. A stale consumer misreads v1 as v0 with an empty compute budget. Discriminate structurally on `Message.config` (field `7`), **in this order**:

| Check, in this order | Version |
|---|---|
| `config` field present | **v1** |
| `config` absent, `versioned` true | v0 |
| neither | legacy |

Order matters: `versioned` is `true` for both v0 *and* v1, so testing it first classifies every v1 transaction as v0.

```ts
function messageVersion(message: Message): 'legacy' | 'v0' | 'v1' {
  if (message.config !== undefined) return 'v1';
  return message.versioned ? 'v0' : 'legacy';
}
```

```rust
match (&message.config, message.versioned) {
    (Some(_), _)  => MessageVersion::V1,
    (None, true)  => MessageVersion::V0,
    (None, false) => MessageVersion::Legacy,
}
```

`config` is a submessage, and submessage fields always carry explicit presence in proto3, so this holds however your decoder handles defaults.

**3. Stale generated protobuf stubs drop the config.** Protobuf clients silently discard fields their generated schema doesn't know. Regenerating means bumping the **schema**, not just the client:

| Dependency | Minimum | Why |
|---|---|---|
| `yellowstone-grpc-proto` (Rust) | 12.6.0 | first release whose generated code has `Message.config` |
| `yellowstone-grpc-client` (Rust) | 13.3.0 | 12.x connects, but pair it with a 12.6.0 proto pin (see below) |
| yellowstone-grpc geyser plugin | 15.1.1 | earlier builds downgrade v1 to v0 before it reaches the wire — no client-side fix recovers the config |
| `@triton-one/yellowstone-grpc` (TS) | 6.0.0 | 5.x drops field 7, so a `^5.0.9` pin loses every v1 budget |
| Go client | none | yellowstone ships pre-generated Go code that predates field 7 — generate your own from the tag's `.proto` |

⚠️ `yellowstone-grpc-client` 13.3.0 only *requires* `yellowstone-grpc-proto = "12.5.0"`, which has no field 7. **Pin `yellowstone-grpc-proto = "12.6.0"` directly** and build `--locked`.

**4. Comparing fees across versions needs normalizing.** v0 states a *price* in micro-lamports per CU; v1 states a *total* in lamports. To put both on one dashboard, multiply the v0 price by the CU limit the transaction actually requested (including the implicit `min(200_000 × instructions, 1_400_000)` when it set none) and divide by 1,000,000, rounding up:

```
20,000 CU × 250,000 micro-lamports/CU = 5,000 lamports   // v0
                                        5,000 lamports   // the v1 equivalent
```

## Sending v1 manually with `pipe()`

Use the manual path for durable nonces, offline or multi-party signing, `heapSize`, hand-tuned budgets, or a custom `TransactionPlanner`. It requires `@solana/kit` 8.0.0+; earlier versions do not type `createTransactionMessage({ version: 1 })`.

Everything the plugin client did for you is now your job: set both resource limits (or estimate them — see [Sizing the resource limits](#sizing-the-resource-limits)), keep ComputeBudget instructions out, and simulate and send over base64.

```ts
import { getTransferSolInstruction } from '@solana-program/system';
import {
  appendTransactionMessageInstruction,
  assertIsTransactionWithBlockhashLifetime,
  assertIsTransactionWithinSizeLimit,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageConfig,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from '@solana/kit';

const message = pipe(
  createTransactionMessage({ version: 1 }),
  m => setTransactionMessageFeePayerSigner(payer, m),
  m => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
  m => appendTransactionMessageInstruction(
    getTransferSolInstruction({ amount: lamports(10_000_000n), destination: recipient, source: payer }),
    m,
  ),
  // The whole budget lands in `message.config`, so the instruction list still
  // holds only the transfer. Merges into any existing config.
  m => setTransactionMessageConfig({
    computeUnitLimit: 20_000,
    heapSize: 64 * 1024,
    loadedAccountsDataSizeLimit: 64 * 1024,
    priorityFeeLamports: 5_000n,
  }, m),
);

const transaction = await signTransactionMessageWithSigners(message);
assertIsTransactionWithBlockhashLifetime(transaction); // signing widens the lifetime union
// Version-aware: allows 4096 bytes for v1, 1232 for legacy and v0.
assertIsTransactionWithinSizeLimit(transaction);

// Simulate and surface the result before sending. base64 is mandatory —
// base58 stays capped at 1232 bytes whatever the transaction version.
const simulation = await rpc
  .simulateTransaction(getBase64EncodedWireTransaction(transaction), { encoding: 'base64' })
  .send();
if (simulation.value.err) throw new Error(`Simulation failed: ${simulation.value.logs?.join('\n')}`);

// Send only after the user has reviewed the simulation and approved.
await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(transaction, {
  commitment: 'confirmed',
});
const signature = getSignatureFromTransaction(transaction);
```

In Rust (`solana-message` 4.x), the config is a const-buildable value passed straight into compilation:

```rust
use solana_message::{v1, VersionedMessage};
use solana_transaction::versioned::VersionedTransaction;

const CONFIG: v1::TransactionConfig = v1::TransactionConfig::empty()
    .with_compute_unit_limit(20_000)
    .with_loaded_accounts_data_size_limit(64 * 1024)
    .with_heap_size(64 * 1024)
    .with_priority_fee(5_000);

let message = v1::Message::try_compile_with_config(&payer.pubkey(), &[instruction], blockhash, CONFIG)?;
let transaction = VersionedTransaction::try_new(VersionedMessage::V1(message), &[payer])?;
```

### ⚠️ Unset limits are zero, not defaults

In legacy and v0, omitting a resource limit gets you a runtime default. In v1, omitting it budgets **zero**:

| Unset field | legacy / v0 | v1 |
|---|---|---|
| Compute unit limit | 200k per ix, max 1.4M | **0 CU** |
| Loaded accounts data size | 64 MiB | **0 bytes** |
| Heap size | 32 KiB | 32 KiB (the one field that does default) |

A v1 transaction with an empty config fails at account loading with `MaxLoadedAccountsDataSizeExceeded`. **Estimate both limits with Kit by default.** Set them manually only when you have a measured, application-specific reason.

### Three more sending changes

- **Priority fee is a total, not a price.** Do not carry the per-CU multiplication across from v0.
- **ComputeBudget instructions become no-ops.** Neither parsed nor rejected — they execute successfully doing nothing, burning 150 CU and an instruction slot. Strip them. (Kit's type system rejects the mismatched setters; `solana-go` rejects them at runtime.)
- **Use `encoding: 'base64'`.** Submitting over 1232 bytes requires it. base58 stays capped at 1232 bytes regardless of version — deliberately not raised, on deprecation grounds — so the 4096-byte ceiling is only reachable over base64.

## Sizing the resource limits

Use Kit's resource estimator instead of guessing limits. It simulates once with both limits maxed, then writes the measurements back:

```ts
import {
  estimateAndSetResourceLimitsFactory,
  estimateResourceLimitsFactory,
  fillTransactionMessageProvisoryResourceLimits,
} from '@solana/kit';

// 1. Reserve space for the limits so the message simulates at its final size.
const draft = fillTransactionMessageProvisoryResourceLimits(messageWithoutLimits);

// 2. Simulate with CU at 1,400,000 and data size at 64 MiB, so simulation
//    cannot fail for want of the resources it is measuring.
const estimateResourceLimits = estimateResourceLimitsFactory({ rpc });

// 3. Write the measured values back. Overwrites a provisory placeholder but
//    leaves an explicitly chosen value alone.
const message = await estimateAndSetResourceLimitsFactory(estimateResourceLimits)(draft);
```

- On a v1 message, `estimateResourceLimits` returns both `computeUnitLimit` and `loadedAccountsDataSizeLimit`, and **throws if the RPC withholds `loadedAccountsDataSize`** — v1 requires it. On legacy/v0 the data size is optional.
- The estimate is the exact cost of one simulated run, with nothing to spare. **Adding margin is the caller's job** — wrap the estimator (`estimateAndSetResourceLimitsFactory` accepts any function of that shape) if you want a buffer.
- Round the data size **up to the next 32 KiB page**: the block cost model charges in 32 KiB pages, so headroom below the next boundary is free.
- **Size the data budget for accounts that don't exist yet.** Loading an account costs 64 bytes of base metadata plus its data length; a *nonexistent* account costs nothing. Creating one is a step change from 0 to at least 64 bytes, so a limit measured exactly against simulation can tip into `MaxLoadedAccountsDataSizeExceeded` if the account is created between your simulation and your send.
- The priority fee is a pricing decision, not something simulation can measure. Set it yourself.

## Kit setter routing by version

Three of the four budget fields route by version on their own, so existing code that sets them keeps working when the message becomes v1:

| Setter | legacy / v0 | v1 |
|---|---|---|
| `setTransactionMessageComputeUnitLimit` | appends a ComputeBudget instruction | writes `config.computeUnitLimit` |
| `setTransactionMessageHeapSize` | appends a ComputeBudget instruction | writes `config.heapSize` |
| `setTransactionMessageLoadedAccountsDataSizeLimit` | appends a ComputeBudget instruction | writes `config.loadedAccountsDataSizeLimit` |
| `setTransactionMessagePriorityFeeLamports` | **compile error** | writes `config.priorityFeeLamports` |
| `setTransactionMessageComputeUnitPrice` | appends a ComputeBudget instruction | **compile error** |
| `setTransactionMessageConfig` | **compile error** | writes every field it is given, merging |

The priority fee is the exception because micro-lamports-per-CU and a total in lamports are different quantities. **Only the type system enforces this** — bypass it and the runtime attaches a `config` to a v0 message or a ComputeBudget instruction to a v1 one.

Matching readers: `getTransactionMessageComputeUnitLimit`, `getTransactionMessageHeapSize`, `getTransactionMessageLoadedAccountsDataSizeLimit` work on any version; `getTransactionMessagePriorityFeeLamports` is v1-only and `getTransactionMessageComputeUnitPrice` is legacy/v0-only.

`setTransactionMessageConfig({ computeUnitLimit: undefined }, m)` unsets a field; unsetting the last one removes `config` from the message. `areV1ConfigsEqual` and `isV1ConfigEmpty` treat an absent field and an explicit zero as distinct.

## Library support

| Library | Status |
|---|---|
| `@solana/kit` | **8.0.0+** (current 8.3.0) — full support. 7.1.1 has the codecs, setters, and `maxSupportedTransactionVersion: 1`, but not the types for `createTransactionMessage({ version: 1 })` |
| `@solana/kit-plugin-rpc` | **0.19.0+** — `solanaRpc({ transactionConfig: { version: 1 } })` plans, estimates, and sends v1. 0.18 and earlier throw `Version 1 transactions are not yet supported by rpcTransactionPlanner` |
| `@solana/kit-plugin-litesvm` | **0.19.0+** — `litesvm({ transactionConfig: { version: 1 } })`; writes maximum limits instead of estimating |
| `@solana/kit-plugin-wallet` | **0.20.0+** — `connected.supportedTransactionVersions` typed to include `1` (via `@solana/wallet-standard-features` 1.5) |
| `@solana/web3.js@rc` (v3) | **`3.0.0-rc.3`** — `compileToV1Message`, send and read |
| `@solana/web3.js` 1.x | **`1.99.0`** — **read only**. 1.x never builds, signs, serializes, or sends v1; migrate to kit 8 for that |
| Rust `solana-*` | **4.x** (`solana-message` 4.1.0 added `v1::Message`; 4.2.x adds the inherent `Message::serialize()`). Anchor 1.1.x still pins the 3.x crate line for *programs*; the 4.x requirement is client-side |
| Python `solders` | 0.29.0+ — read and send. Earlier releases have neither |
| Go `solana-go` | Unreleased — [PR #481](https://github.com/solana-foundation/solana-go/pull/481) adds `solana.TransactionConfig`, `solana.MessageVersionV1`, and `solana.TransactionV1Config` |
| Anza CLI / Agave | **4.2.2** is the mainnet activation release; 4.2.0+ for v1 and `maxSupportedTransactionVersion: 1` |

Runnable examples in all four languages — sending, decoding, reading blocks, indexing over gRPC, plus offline and live tests: [`solana-foundation/transaction-v1-examples`](https://github.com/solana-foundation/transaction-v1-examples).

## Checking activation status

v1 is live on mainnet, devnet, testnet, and every local network that ships with Agave 4.2+. The feature gate is `txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL` (`enable_tx_v1`); check it only when targeting a private cluster or an older snapshot:

```bash
solana -u m feature status txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL   # -u d / -u t / -u l
```

Over JSON-RPC, the account is a bincode `Option<u64>` holding the activation slot — `None` (and an absent account) both mean v1 would be rejected:

```ts
import { address, getBase64Encoder, getOptionDecoder, getU64Decoder, isSome } from '@solana/kit';

const ENABLE_TX_V1_FEATURE = address('txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL');
const featureDecoder = getOptionDecoder(getU64Decoder());

async function isV1Active(rpc): Promise<boolean> {
  const { value: account } = await rpc.getAccountInfo(ENABLE_TX_V1_FEATURE, { encoding: 'base64' }).send();
  if (account === null) return false;
  return isSome(featureDecoder.decode(getBase64Encoder().encode(account.data[0])));
}
```

## Local testing

Both local networks enable the feature at genesis:

- `solana-test-validator` (Anza CLI **4.2+**) — activates every feature at genesis
- **Surfpool 1.5+** — see [surfpool/overview.md](surfpool/overview.md)

Verify on either:

```bash
solana -u l feature status txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL
```

## Cheat sheet

| Task | `@solana/kit` 8 | Rust (`solana-*` 4.x) |
|---|---|---|
| Send v1 from a plugin client | `solanaRpc({ transactionConfig: { version: 1, priorityFeeLamports } })` then `client.sendTransaction(…)` | — |
| Build a v1 message by hand | `createTransactionMessage({ version: 1 })` | `v1::Message::try_compile_with_config` |
| Set the whole budget | `setTransactionMessageConfig` | `v1::TransactionConfig::empty().with_*(…)` |
| Set one field | `setTransactionMessage{ComputeUnitLimit,LoadedAccountsDataSizeLimit,HeapSize,PriorityFeeLamports}` | `.with_{compute_unit_limit,loaded_accounts_data_size_limit,heap_size,priority_fee}(…)` |
| Reserve limit space before simulating | `fillTransactionMessageProvisoryResourceLimits` | — |
| Measure limits by simulation | `estimateResourceLimitsFactory` | read `unitsConsumed` / `loadedAccountsDataSize` off `simulateTransaction` yourself |
| Write measured limits back | `estimateAndSetResourceLimitsFactory` | — |
| Decode a transaction off the wire | `getTransactionDecoder` → `getCompiledTransactionMessageDecoder` → `decompileTransactionMessage` | `VersionedTransaction` deserialization, or `EncodedTransaction::decode` |
| Read the config back | `message.config` on the v1 arm of `TransactionMessage` | `VersionedMessage::V1(m) => m.config` |
| Opt in to reading v1 | `maxSupportedTransactionVersion: 1` | `max_supported_transaction_version: Some(1)` |
| Check a wallet can sign v1 | `connected.supportedTransactionVersions.has(1)` | — |
| Compare two configs | `areV1ConfigsEqual`, `isV1ConfigEmpty` | — |

Kit keeps `V1TransactionMessage` internal; pull the v1 arm out of the exported union:

```ts
type V1TransactionMessage = Extract<TransactionMessage, { version: 1 }>;
```

Decompiling a v1 compiled message fetches no accounts, since v1 cannot use address lookup tables.

## Migration checklist

**If you read transactions:**

- Set `maxSupportedTransactionVersion` to the integer `1` on `getTransaction`, `getBlock`, and `blockSubscribe`. Grep for the literal `0` too — it is just as broken as omitting it.
- Audit for ComputeBudget instruction scanning; read `transactionConfig` instead, and persist it — it has no v0 equivalent.
- Treat `blockSubscribe`'s `block: null` with an error as a failure, not an empty block.
- Regenerate protobuf stubs and discriminate on `config` presence, never on the `versioned` boolean.
- Move to Agave 4.2.x-generation client dependencies (`solana-*` 4.x crates). On web3.js 1.x, upgrade to 1.99.0 — it reads v1 but cannot send it, so anything that *sends* needs `@solana/kit` 8 or web3.js v3 (rc.3+).

**If you send transactions:**

- On kit, upgrade to `@solana/kit` 8.3+ and `@solana/kit-plugin-rpc` 0.19+, then add `transactionConfig: { version: 1 }` to the RPC plugin. Swap `microLamportsPerComputeUnit` for `priorityFeeLamports` (a total, not a price). Leave `estimateResourceLimits` on.
- In wallet apps, gate on `connected.supportedTransactionVersions.has(1)` and keep a v0 client for wallets that have not shipped v1.
- On the manual `pipe()` path, use Kit's resource estimator for the compute and loaded-accounts-data limits. Set values manually only when you have stable measurements or need a deliberate cap. The defaults are zero.
- Strip ComputeBudget instructions. Confirm no address lookup table dependency and no duplicate account addresses.
- Pass `encoding: 'base64'` when simulating and sending by hand.
- Check the feature gate only when targeting a private cluster or an older snapshot.

**If you operate infrastructure:**

- Raise QUIC stream windows to 4096 bytes — a relayer that misses this rejects oversized v1 transactions after activation.
- Verify long-term storage read paths round-trip v1 without downgrading it to v0.

## References

- [SIMD-0385 — transaction v1 format](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md)
- [SIMD-0296 — larger transactions](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0296-larger-transactions.md)
- [Larger Transaction Sizes upgrade guide](https://solana.com/upgrades/larger-transaction-sizes)
- [`transaction-v1-examples`](https://github.com/solana-foundation/transaction-v1-examples) — runnable Rust, TypeScript, Python, and Go
- [`transaction-v1-examples/ts/kit-plugins`](https://github.com/solana-foundation/transaction-v1-examples/tree/main/ts/kit-plugins) — v1 through a plugin client
- [Agave releases](https://github.com/anza-xyz/agave/releases)
