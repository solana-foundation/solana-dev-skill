---
title: Plugins & Client Composition
description: Solana Kit plugin architecture, all-in-one RPC/LiteSVM plugins, signer plugins, custom client composition, and plugin ordering rules.
---

# Solana Kit Plugins & Client Composition

Kit clients are built by chaining `.use(plugin)` calls onto `createClient()`. Each plugin extends the client with new properties or methods. Plugins that depend on others (e.g., RPC needs a payer) must come after their dependencies — TypeScript enforces this.

## All-in-One Clients

### Production Client (mainnet/devnet/custom)

```bash
npm install @solana/kit @solana/kit-plugin-rpc @solana/kit-plugin-signer
```

```ts
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { signer } from '@solana/kit-plugin-signer';

const client = createClient()
  .use(signer(mySigner)) // sets payer + identity to the same keypair
  .use(solanaRpc({ rpcUrl: 'https://api.mainnet-beta.solana.com' }));

await client.sendTransaction([myInstruction]);
```

`solanaRpc` installs an RPC connection, RPC subscriptions, minimum-balance computation, transaction planner, and transaction executor in one call. It requires a `payer` to be set first — `signer()` covers that and the identity role at the same time. Reach for the role-specific `payer()` + `identity()` only when fees and authority must come from different keypairs.

**`solanaRpc` options:**

| Option | Type | Description |
|--------|------|-------------|
| `rpcUrl` | `string` | RPC endpoint (required) |
| `rpcSubscriptionsUrl` | `string` | WS endpoint (defaults to `rpcUrl` with `http`→`ws`) |
| `rpcConfig` | `object` | Forwarded to `createSolanaRpc` |
| `rpcSubscriptionsConfig` | `object` | Forwarded to `createSolanaRpcSubscriptions` |
| `transactionConfig` | `object` | Tx planner options (priority fees, etc.) |
| `maxConcurrency` | `number` | Concurrent tx limit (default: 10) |
| `skipPreflight` | `boolean` | Always skip preflight (default: false) |

### Cluster-Specialized Variants

```ts
import { createClient } from '@solana/kit';
import { solanaMainnetRpc, solanaDevnetRpc, solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { signer, signerFromFile } from '@solana/kit-plugin-signer';

// Mainnet — type-narrowed; airdrop is NOT exposed
const main = createClient().use(signer(s)).use(solanaMainnetRpc({ rpcUrl: '...' }));

// Devnet — defaults to https://api.devnet.solana.com, includes airdrop
const dev = createClient().use(signer(s)).use(solanaDevnetRpc());

// Local — defaults to http://127.0.0.1:8899, includes airdrop
const local = await createClient()
  .use(signerFromFile('~/.config/solana/id.json'))
  .use(solanaLocalRpc());
```

### LiteSVM Test Client

```bash
npm install @solana/kit @solana/kit-plugin-litesvm @solana/kit-plugin-signer
```

```ts
import { createClient } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { signer } from '@solana/kit-plugin-signer';

const client = createClient().use(signer(mySigner)).use(litesvm());

client.svm.setAccount(myTestAccount);
client.svm.addProgramFromFile(myProgramAddress, 'program.so');

await client.sendTransaction([myInstruction]);
```

`litesvm()` is Node.js only. Browser/React Native builds throw.

---

## Client API Surface

After applying an all-in-one RPC/LiteSVM plugin and a payer:

```ts
client.rpc                  // RPC methods (getBalance, getAccountInfo, etc.)
client.rpcSubscriptions     // WebSocket subscriptions (RPC plugins only)
client.payer                // TransactionSigner fee payer
client.identity             // Authority signer (if signer()/identity() used)
client.transactionPlanner   // Converts instructions → transaction messages
client.transactionPlanExecutor // Sends planned transactions
client.planTransaction(s)   // Plan without executing
client.sendTransaction(s)   // Plan + sign + send in one call
client.getMinimumBalance(dataSize) // Rent-exempt minimum
```

`solanaDevnetRpc`, `solanaLocalRpc`, and `litesvm` additionally expose:
```ts
client.airdrop(address, lamports) // Faucet (devnet/local/svm only)
```

LiteSVM additionally exposes `client.svm` for direct LiteSVM access.

---

## Signer Plugins (`@solana/kit-plugin-signer`)

Kit clients hold two signer roles:
- **`payer`** — pays fees and rent
- **`identity`** — wallet/authority for application accounts

In most apps both roles are the same keypair, so **default to the `signer*` variants** — they install one keypair into both slots in one call. Use the role-specific `payer*` / `identity*` variants only when fees and authority come from different keypairs (e.g., gasless flows, treasury accounts, multisig).

| Variant | Sets |
|---|---|
| `signer*` (recommended default) | both `payer` and `identity` (same keypair) |
| `payer*` | only `payer` |
| `identity*` | only `identity` |

| Plugin | Behavior |
|---|---|
| `signer(s)` / `payer(s)` / `identity(s)` | Install an existing `TransactionSigner` |
| `generatedSigner()` / `generatedPayer()` / `generatedIdentity()` | Async; generate a new keypair |
| `generatedSignerWithSol(amount)` / `generatedPayerWithSol(amount)` / `generatedIdentityWithSol(amount)` | Async; generate + airdrop. Requires an airdrop function already on the client (use after `solanaLocalRpc`/`solanaDevnetRpc`/`rpcAirdrop`) |
| `signerFromFile(path)` / `payerFromFile(path)` / `identityFromFile(path)` | Async; load keypair from a JSON file |
| `airdropSigner(amount)` / `airdropPayer(amount)` / `airdropIdentity(amount)` | Airdrop SOL to an already-installed signer |

```ts
import { createClient, lamports } from '@solana/kit';
import { rpcAirdrop, solanaRpcConnection } from '@solana/kit-plugin-rpc';
import { generatedSignerWithSol } from '@solana/kit-plugin-signer';

// Airdrop function must exist before generatedSignerWithSol
const client = await createClient()
  .use(solanaRpcConnection({ rpcUrl: 'http://127.0.0.1:8899' }))
  .use(rpcAirdrop())
  .use(generatedSignerWithSol(lamports(10_000_000_000n)));
```

**Role-split example** (different keypairs for fees vs. authority):

```ts
import { createClient } from '@solana/kit';
import { solanaDevnetRpc } from '@solana/kit-plugin-rpc';
import { payer, identity } from '@solana/kit-plugin-signer';

const client = createClient()
  .use(payer(feePayerSigner))      // pays fees
  .use(identity(walletSigner))     // owns/authorizes accounts
  .use(solanaDevnetRpc());
```

---

## Custom Client Composition

When the all-in-one bundles don't fit (custom transaction planner, partial capabilities, third-party services), build the client out of low-level plugins:

```ts
import { createClient } from '@solana/kit';
import {
  rpc,
  rpcAirdrop,
  rpcGetMinimumBalance,
  rpcTransactionPlanner,
  rpcTransactionPlanExecutor,
} from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { planAndSendTransactions } from '@solana/kit-plugin-instruction-plan';

const client = await createClient()
  .use(rpc('https://api.devnet.solana.com'))    // adds client.rpc + client.rpcSubscriptions
  .use(signerFromFile('path/to/keypair.json'))  // adds client.payer + client.identity
  .use(rpcAirdrop())                             // adds client.airdrop
  .use(rpcGetMinimumBalance())                   // adds client.getMinimumBalance
  .use(rpcTransactionPlanner())                  // adds client.transactionPlanner
  .use(rpcTransactionPlanExecutor())             // adds client.transactionPlanExecutor
  .use(planAndSendTransactions());               // adds client.sendTransaction(s)
```

### Plugin Ordering

Plugins that depend on others must come after their dependencies. TypeScript enforces this:

```ts
// ✅ Correct — signer + rpc before planner/executor
createClient()
  .use(signer(mySigner))
  .use(rpc(url))
  .use(rpcTransactionPlanner())
  .use(planAndSendTransactions());

// ❌ Type error — solanaRpc requires payer
createClient()
  .use(solanaRpc({ rpcUrl: url }))
  .use(signer(mySigner));
```

### Async Plugins

Some plugins are async (e.g., `signerFromFile`, `generatedSigner`, `generatedSignerWithSol`). The `.use()` method handles awaiting automatically — `await` the final client:

```ts
const client = await createClient()
  .use(signerFromFile('./keypair.json'))        // async
  .use(solanaLocalRpc());
```

---

## Plugin Catalog

### Official Plugins

| Package | Plugins | Purpose |
|---------|---------|---------|
| `@solana/kit-plugin-rpc` | `solanaRpc`, `solanaMainnetRpc`, `solanaDevnetRpc`, `solanaLocalRpc`, `rpc`, `solanaRpcConnection`, `rpcAirdrop`, `rpcGetMinimumBalance`, `rpcTransactionPlanner`, `rpcTransactionPlanExecutor` | RPC connectivity + tx planning/execution |
| `@solana/kit-plugin-signer` | `signer*` (default — sets both roles), `payer*`, `identity*` (role-specific); each comes in plain, `generated*`, `*WithSol`, `*FromFile`, and `airdrop*` forms | Signer management |
| `@solana/kit-plugin-litesvm` | `litesvm`, `litesvmConnection`, `litesvmAirdrop`, `litesvmTransactionPlanner`, `litesvmTransactionPlanExecutor` | In-memory test environment |
| `@solana/kit-plugin-airdrop` | `airdrop`, `rpcAirdrop` | SOL faucet (typically pulled in transitively) |
| `@solana/kit-plugin-instruction-plan` | `planAndSendTransactions` | Instruction batching + sending sugar |

### Program Plugins

Codama-generated `@solana-program/*` packages also export program plugins that attach fluent APIs to the client:

```ts
import { createClient } from '@solana/kit';
import { solanaLocalRpc } from '@solana/kit-plugin-rpc';
import { signerFromFile } from '@solana/kit-plugin-signer';
import { tokenProgram } from '@solana-program/token';

const client = await createClient()
  .use(signerFromFile('~/.config/solana/id.json'))
  .use(solanaLocalRpc())
  .use(tokenProgram());

// Fluent API — auto-derives ATAs, defaults payer from client
await client.token.instructions
  .transferToATA({ mint, authority: ownerSigner, recipient, amount: 50n, decimals: 2 })
  .sendTransaction();
```

| Package | Plugin | Adds |
|---------|--------|------|
| `@solana-program/token` | `tokenProgram()` | `client.token.instructions` (createMint, mintToATA, transferToATA, etc.) |

### Example Implementations

| Package | Exports | Purpose | Code Example |
|---------|---------|---------|--------------|
| `@solana/kora` | `createKitKoraClient`, `koraPlugin` | Gasless transactions | https://github.com/solana-foundation/kora/blob/main/sdks/ts/src/kit/index.ts |

---

## Building Custom Plugins

See [advanced.md](advanced.md) for the full guide on authoring plugins and assembling domain-specific clients.

A plugin is a function that takes a client and returns a new one:

```ts
type ClientPlugin<TInput extends object, TOutput extends Promise<object> | object> =
  (input: TInput) => TOutput;
```

Quick example:

```ts
function myCustomPlugin() {
  return <T extends object>(client: T) => ({
    ...client,
    myMethod: () => console.log('hello'),
  });
}

const client = createClient().use(myCustomPlugin());
client.myMethod(); // 'hello'
```

Plugins can require capabilities from previous plugins:

```ts
function myRpcPlugin() {
  return <T extends { rpc: SolanaRpc }>(client: T) => ({
    ...client,
    fetchBalance: (addr: Address) => client.rpc.getBalance(addr).send(),
  });
}

// ✅ Works — rpc installed first
createClient().use(rpc(url)).use(myRpcPlugin());

// ❌ Type error — rpc not present
createClient().use(myRpcPlugin());
```
