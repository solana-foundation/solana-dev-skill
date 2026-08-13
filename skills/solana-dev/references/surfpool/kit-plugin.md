---
title: Surfpool Kit Plugin
description: The @solana/surfpool/kit plugin — one .use(surfpool()) gives a Kit client backed by an embedded Surfnet, with a pre-funded payer, the full RPC stack, and typed cheatcodes.
---

# Surfpool Kit Plugin (`@solana/surfpool/kit`)

`@solana/surfpool/kit` boots a surfnet inside the test process and hands back a `@solana/kit` client already pointed at it. A single `.use(surfpool())` replaces the RPC plugin you would otherwise reach for (`solanaLocalRpc()`, `litesvm()`) and adds a pre-funded payer plus a typed cheatcodes RPC.

```ts
import { createClient } from '@solana/kit';
import { surfpool } from '@solana/surfpool/kit';

const client = await createClient().use(surfpool());

const slot = await client.rpc.getSlot().send();
await client.cheatcodes.timeTravel({ absoluteSlot: 1_000_000n }).send();
```

No port to pick, no payer to generate and fund, no separate `surfpool start` process. **This is the default for TypeScript integration tests** — prefer it over driving `Surfnet` directly and hand-rolling a `fetch` cheatcode helper.

## Choosing an Entry Point

| Entry point | Reach for it when |
|---|---|
| `surfpool()` | **Default for tests.** An isolated surfnet per test file, Kit client already wired up. |
| `surfpool({ rpcUrl })` | A long-lived `surfpool start` instance is shared across processes, or the platform has no native binary. |
| `surfnetCheatcodes()` | You already have a client and only want `client.cheatcodes` on it. |
| `createSurfnetCheatcodesRpc(url)` | Standalone typed cheatcodes RPC, no Kit client involved. |
| `Surfnet` from `@solana/surfpool` | Not using Kit — see [overview.md](overview.md#embedded-sdk-solanasurfpool). |

## Install

```bash
npm install --save-dev @solana/kit @solana/kit-plugin-rpc @solana/kit-plugin-signer @solana/surfpool
```

The three Kit packages are optional peer dependencies of `@solana/surfpool` (`@solana/kit` ^7, `@solana/kit-plugin-rpc` ^0.15, `@solana/kit-plugin-signer` ^0.13). Skip them if you only use the `Surfnet` class; importing `@solana/surfpool/kit` requires at least `@solana/kit` and `@solana/kit-plugin-rpc`.

Requirements:
- **Node.js 20.18+** — the floor `@solana/kit` v7 declares. `@solana/surfpool` itself runs on 18+, but the Kit packages do not, and some program plugins want more (`@solana-program/token` declares 24+).
- **macOS x64/arm64, or Linux x64 GNU** for embedded mode, which loads a native (napi-rs) binary. Everything else — Linux arm64, musl/Alpine, Windows — has no prebuilt binary; use attach mode there.

Two footguns follow from that list. Docker on Apple Silicon defaults to arm64 Linux containers, which have no binary even though the macOS host does. And a platform package with no artifact is an *optional* dependency, so install succeeds silently and only fails at `require` time with a module-not-found rather than a clear "unsupported platform" message.

## Embedded Mode

Calling `surfpool()` with no `rpcUrl` boots an in-process surfnet on dynamic ports. **The plugin is async in this mode — `await` the `.use()` chain.** Every call binds its own ports, so test files can each own a surfnet and still run in parallel.

```ts title="transfer.test.ts"
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { getTransferSolInstruction } from '@solana-program/system';
import { createClient, generateKeyPairSigner, lamports } from '@solana/kit';
import { surfpool } from '@solana/surfpool/kit';

const client = await createClient().use(surfpool());

after(() => {
    client.surfnet.stop();
});

test('transfers SOL on an embedded surfnet', async () => {
    const recipient = await generateKeyPairSigner();
    const amount = lamports(5_000_000n);

    await client.sendTransaction(
        getTransferSolInstruction({
            amount,
            destination: recipient.address,
            source: client.payer,
        }),
    );

    const { value: balance } = await client.rpc.getBalance(recipient.address).send();
    assert.equal(balance, amount);
});
```

Vitest and Jest work identically with their own `afterAll` hooks.

### Teardown Is Not Automatic

As of `@solana/surfpool` 1.5.0, call `client.surfnet.stop()` in teardown so ports and servers are released. The client implements no disposal protocol, so a client held at module scope — the usual test-file pattern — is never cleaned up; without a teardown hook the process can hang or log `connection reset` warnings as the OS tears down sockets at exit. The plugin does stop the surfnet if setup itself throws.

`stop()` is idempotent and synchronous — it returns once the runtime has actually closed. Stopping is final: creating another client boots a fresh instance.

## What The Plugin Installs

| On the client | Comes from | What it is |
|---|---|---|
| `client.payer` | `@solana/kit-plugin-signer` | A `KeyPairSigner` for the surfnet's pre-funded payer |
| `client.rpc` / `client.rpcSubscriptions` | `@solana/kit-plugin-rpc` | Standard Solana RPC and subscriptions clients, pointed at the surfnet |
| `client.airdrop` | `@solana/kit-plugin-rpc` | `requestAirdrop` against the surfnet |
| `client.getMinimumBalance` | `@solana/kit-plugin-rpc` | Rent-exemption lookups |
| `client.transactionPlanner` / `client.transactionPlanExecutor` | `@solana/kit-plugin-rpc` | Transaction planning and execution |
| `client.sendTransaction` / `client.sendTransactions` | `@solana/kit-plugin-rpc` (via `kit-plugin-instruction-plan`) | Plan and send instructions in one call |
| `client.rpcUrl` / `client.wsUrl` | `@solana/surfpool/kit` | The surfnet's HTTP and WebSocket URLs |
| `client.surfnet` | `@solana/surfpool/kit` | The native `Surfnet` handle (`fundSol`, `deploy`, `drainEvents`, …) |
| `client.cheatcodes` | `@solana/surfpool/kit` | Typed RPC covering every `surfnet_*` cheatcode |

The plugin does **not** install an `identity`. Add one with `.use(identity(...))` when a test needs an authority separate from `client.payer`.

## Typed Cheatcodes

Cheatcodes bypass the normal transaction flow — they apply instantly, consume no blockhash, and pay no fees, which is exactly what test setup wants. `client.cheatcodes` exposes all 26 as a typed RPC.

Method names drop the `surfnet_` prefix (`surfnet_pauseClock` → `client.cheatcodes.pauseClock()`), and responses arrive already unwrapped from their `{ context, value }` envelope.

```ts
import { address, generateKeyPairSigner } from '@solana/kit';

// Deterministic clock
const paused = await client.cheatcodes.pauseClock().send();
await client.cheatcodes.timeTravel({ absoluteSlot: paused.absoluteSlot + 1_000n }).send();
await client.cheatcodes.resumeClock().send();

// Arbitrary account state — `data` is hex-encoded
const account = (await generateKeyPairSigner()).address;
const owner = (await generateKeyPairSigner()).address;
await client.cheatcodes
    .setAccount(account, { data: 'aabbcc', lamports: 777_777, owner })
    .send();

// Token balances without minting. The mint must already exist —
// create it, or clone it from mainnet with cloneProgramAccount.
const mint = address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
await client.cheatcodes.setTokenAccount(owner, mint, { amount: 1_000_000n }).send();
```

The transport parses every JSON integer as a `bigint`, so `u64` values such as `rentEpoch` survive past 2^53. Request payloads accept `number | bigint`.

Full method list and JSON-RPC parameter schemas: [cheatcodes.md](cheatcodes.md).

### Seeding Structured Accounts With A Codec

`setAccount` takes raw bytes as hex, which pairs well with the account encoders Kit's program clients ship. Rather than sending transactions to build up state, encode the account you want and write it directly — here, a fully initialized SPL mint with supply already on it:

```ts
import { fetchMint, getMintEncoder, TOKEN_PROGRAM_ADDRESS } from '@solana-program/token';
import { generateKeyPairSigner, getBase16Decoder, none, some } from '@solana/kit';

const mint = (await generateKeyPairSigner()).address;

const data = getMintEncoder().encode({
    decimals: 6,
    freezeAuthority: none(),
    isInitialized: true,
    mintAuthority: some(client.payer.address),
    supply: 1_000_000_000n,
});

await client.cheatcodes
    .setAccount(mint, {
        // getBase16Decoder() turns the encoded bytes into the hex `data` expects
        data: getBase16Decoder().decode(data),
        lamports: 1_461_600, // rent-exempt minimum for an 82-byte mint
        owner: TOKEN_PROGRAM_ADDRESS,
    })
    .send();

// Reads back as a normal mint through the program client
const account = await fetchMint(client.rpc, mint);
account.data.decimals; // 6
account.data.supply;   // 1_000_000_000n
```

The same pattern works for any Codama-generated client: encode with the account's encoder, hex it, hand it to `setAccount`. Pair it with `setTokenAccount` to stand up a mint and funded holders without a single transaction.

### Cheatcodes Without The Full Plugin

Two smaller entry points cover cases where the full plugin is unwanted. Both are synchronous — they only attach a transport, so neither needs `await`.

```ts
import { createSurfnetCheatcodesRpc, surfnetCheatcodes } from '@solana/surfpool/kit';

// Standalone RPC, no Kit client involved
const cheatcodes = createSurfnetCheatcodesRpc('http://127.0.0.1:8899');
await cheatcodes.pauseClock().send();

// Add `client.cheatcodes` to a client you already composed
const client = createClient().use(surfnetCheatcodes());
```

`surfnetCheatcodes()` resolves its endpoint from `url` if given, then from an existing `client.rpcUrl` (so it composes with any client carrying one), and finally from `DEFAULT_SURFNET_ENDPOINT` (`http://127.0.0.1:8899`). Both accept a `headers` option for authenticating against a remote Surfpool.

## Configuration

Surfnet startup options go under the `surfnet` key and are forwarded to `Surfnet.startWithConfig()`. Everything else is forwarded to the local Solana RPC plugin:

```ts
const client = await createClient().use(
    surfpool({
        surfnet: { offline: true }, // surfnet startup config
        skipPreflight: true,        // forwarded to solanaLocalRpc()
    }),
);
```

Omit `surfnet` entirely and the plugin calls `Surfnet.start()` with its defaults (mainnet fork, `clock` block production, dynamic ports).

## Composing With Program Plugins

`surfpool()` satisfies the same contracts as `solanaLocalRpc()`, so Kit program plugins layer on top and their instructions execute against the embedded surfnet. Only the final result needs awaiting — `use()` on an async client returns another async client, so sync and async plugins chain freely.

```ts
import { createClient, generateKeyPairSigner } from '@solana/kit';
import { tokenProgram } from '@solana-program/token';
import { surfpool } from '@solana/surfpool/kit';

const client = await createClient().use(surfpool()).use(tokenProgram());

const newMint = await generateKeyPairSigner();
await client.token.instructions
    .createMint({ decimals: 6, mintAuthority: client.payer.address, newMint })
    .sendTransaction();

await client.token.instructions
    .mintToATA({
        amount: 1_000_000n,
        decimals: 6,
        mint: newMint.address,
        mintAuthority: client.payer,
        owner: client.payer.address,
    })
    .sendTransaction();
```

## Attach Mode

Passing `rpcUrl` switches to attach mode: the plugin connects to an already-running Surfpool (started with `surfpool start`) instead of booting one. No native module is loaded, so this works on platforms without a prebuilt binary. **It is synchronous — nothing needs awaiting.**

```ts
import { createClient, createKeyPairSignerFromBytes } from '@solana/kit';
import { payer } from '@solana/kit-plugin-signer';
import { surfpool } from '@solana/surfpool/kit';
import { readFile } from 'node:fs/promises';

// Any funded signer works; this loads the local CLI keypair
const keypairPath = `${process.env.HOME}/.config/solana/id.json`;
const myPayer = await createKeyPairSignerFromBytes(
    new Uint8Array(JSON.parse(await readFile(keypairPath, 'utf8'))),
);

const client = createClient()
    .use(payer(myPayer))
    .use(surfpool({ rpcUrl: 'http://127.0.0.1:8899' }));
```

Three differences from embedded mode:

- **The client must already have a `payer`.** Attach mode has no access to the running instance's payer secret key, so it installs none. Fund whichever signer you supply via `client.cheatcodes.setAccount(...)` or the instance's own faucet.
- **There is no `client.surfnet` handle.** In-process helpers are unavailable; use `client.cheatcodes` for state manipulation.
- **`surfnet` startup config is rejected.** The instance is already running, so `rpcUrl` and `surfnet` are mutually exclusive in the types.

**WebSocket port:** Surfpool serves subscriptions on its own port (default `8900`, `--ws-port`), independent of the HTTP port. When `rpcUrl` has an explicit port, the plugin derives the subscriptions URL as port `8900` on the same host. When it has no port — behind a proxy, say — only the protocol is swapped to `ws`/`wss`. Set `rpcSubscriptionsUrl` yourself when neither rule fits.

## Gotchas

- **Forgetting `await` in embedded mode.** `surfpool()` with no `rpcUrl` is async; `createClient().use(surfpool())` without `await` yields a promise, not a client. Attach mode is sync — mixing the two up is the most common error.
- **No teardown hook.** Always wire `client.surfnet.stop()` into `after` / `afterAll`, or the process hangs at exit.
- **Reaching for `client.surfnet` in attach mode.** It is not installed; use `client.cheatcodes`.
- **`setTokenAccount` against a nonexistent mint.** The mint must exist first — clone it from mainnet with `cloneProgramAccount`, create it through the token program, or write it with `setAccount` + `getMintEncoder()`.
- **`data` is hex, not base64.** Use `getBase16Decoder().decode(bytes)` from `@solana/kit`.

## See Also

- [overview.md](overview.md) — Surfpool CLI, cheatcode catalog, MCP server, IaC runbooks
- [cheatcodes.md](cheatcodes.md) — full parameter schemas for every `surfnet_*` method
- [../testing.md](../testing.md) — where this plugin fits in the testing pyramid
- [../kit/plugins.md](../kit/plugins.md) — Kit plugin composition and ordering rules
