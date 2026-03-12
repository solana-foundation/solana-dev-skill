---
title: Plugins & Client Composition
description: Ready-to-use Solana Kit clients, plugin architecture, custom client composition, and available plugins from @solana/kit-client-rpc and the kit-plugins ecosystem.
---

# Solana Kit Plugins & Client Composition

## Ready-to-Use Clients

### Production Client

```bash
npm install @solana/kit @solana/kit-client-rpc
```

```ts
import { generateKeyPairSigner } from '@solana/kit';
import { createClient } from '@solana/kit-client-rpc';

const payer = await generateKeyPairSigner();
const client = createClient({
  url: 'https://api.devnet.solana.com',
  payer,
});

await client.sendTransaction([myInstruction]);
```

**Config options:**

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | RPC endpoint (required) |
| `payer` | `TransactionSigner` | Fee payer (required) |
| `rpcSubscriptionsConfig` | `object` | WebSocket endpoint config |
| `priorityFees` | `MicroLamports` | Per-compute-unit fee boost |
| `maxConcurrency` | `number` | Concurrent tx limit (default: 10) |
| `skipPreflight` | `boolean` | Bypass simulation (default: false) |

### Local Development Client

```ts
import { createLocalClient } from '@solana/kit-client-rpc';
import { lamports } from '@solana/kit';

const client = await createLocalClient();

// Payer auto-generated and funded
console.log('Payer:', client.payer.address);
await client.sendTransaction([myInstruction]);

// Request more SOL
await client.airdrop(client.payer.address, lamports(5_000_000_000n));
```

Defaults to `http://127.0.0.1:8899`. Accepts optional `payer`, `url`, and same config as `createClient`.

### LiteSVM Test Client

```bash
npm install @solana/kit @solana/kit-client-litesvm
```

```ts
import { createClient } from '@solana/kit-client-litesvm';

const client = await createClient();

// Set up test environment
client.svm.setAccount(myTestAccount);
client.svm.addProgramFromFile(myProgramAddress, 'program.so');

await client.sendTransaction([myInstruction]);
```

---

## Client API Surface

All plugin clients expose:

```ts
client.rpc                  // RPC methods (getBalance, getAccountInfo, etc.)
client.rpcSubscriptions     // WebSocket subscriptions
client.payer                // TransactionSigner fee payer
client.transactionPlanner   // Converts instructions → transaction messages
client.transactionPlanExecutor // Sends planned transactions
client.planTransaction(s)   // Plan without executing
client.sendTransaction(s)   // Plan + sign + send in one call
```

`createLocalClient` additionally provides:
```ts
client.airdrop(address, amount) // Request SOL from faucet
```

---

## Custom Client Composition

When the ready-to-use clients don't fit your needs, build your own with `createEmptyClient().use(...)`:

```ts
import { createEmptyClient } from '@solana/kit';
import { rpc } from '@solana/kit-plugin-rpc';
import { payerFromFile } from '@solana/kit-plugin-payer';
import { airdrop } from '@solana/kit-plugin-airdrop';
import { rpcTransactionPlanner, rpcTransactionPlanExecutor } from '@solana/kit-plugin-rpc';
import { planAndSendTransactions } from '@solana/kit-plugin-instruction-plan';

const client = await createEmptyClient()
  .use(rpc('https://api.devnet.solana.com'))       // Adds client.rpc + client.rpcSubscriptions
  .use(payerFromFile('path/to/keypair.json'))       // Adds client.payer from local file
  .use(airdrop())                                    // Adds client.airdrop
  .use(rpcTransactionPlanner())                      // Adds client.transactionPlanner
  .use(rpcTransactionPlanExecutor())                 // Adds client.transactionPlanExecutor
  .use(planAndSendTransactions());                   // Adds client.sendTransaction(s)
```

### Plugin Ordering

Plugins that depend on others must come after their dependencies. TypeScript enforces this:

```ts
// ✅ Correct — rpc before payer
createEmptyClient()
  .use(rpc(url))
  .use(payer(signer))
  .use(rpcTransactionPlanner())
  .use(planAndSendTransactions());

// ❌ Type error — planner requires rpc
createEmptyClient()
  .use(rpcTransactionPlanner())
  .use(rpc(url));
```

### Async Plugins

Some plugins are async (e.g., `payerFromFile`, `generatedPayer`). The `use` method handles awaiting automatically — just `await` the final client:

```ts
const client = await createEmptyClient()
  .use(rpc(url))
  .use(payerFromFile('./keypair.json'))  // async
  .use(rpcTransactionPlanner());
```

---

## Available Plugins

### Official Plugins

| Package | Plugins | Purpose |
|---------|---------|---------|
| `@solana/kit-plugin-rpc` | `rpc`, `localhostRpc`, `rpcTransactionPlanner`, `rpcTransactionPlanExecutor` | RPC connectivity + tx execution |
| `@solana/kit-plugin-payer` | `payer`, `payerFromFile`, `generatedPayer`, `generatedPayerWithSol`, `payerOrGeneratedPayer` | Fee payer management |
| `@solana/kit-plugin-airdrop` | `airdrop`, `rpcAirdrop` | SOL faucet requests |
| `@solana/kit-plugin-instruction-plan` | `transactionPlanner`, `transactionPlanExecutor`, `planAndSendTransactions` | Instruction batching + sending |
| `@solana/kit-plugin-litesvm` | `litesvm`, `litesvmTransactionPlanner`, `litesvmTransactionPlanExecutor` | In-memory test environment |

### Program Plugins

Codama-generated `@solana-program/*` packages also export program plugins that attach fluent APIs to the client:

```ts
import { createLocalClient } from '@solana/kit-client-rpc';
import { tokenProgram } from '@solana-program/token';

const client = await createLocalClient().use(tokenProgram());

// Fluent API — auto-derives ATAs, defaults payer from client
await client.token.instructions
  .transferToATA({ mint, authority: ownerSigner, recipient, amount: 50n, decimals: 2 })
  .sendTransaction();
```

| Package | Plugin | Adds |
|---------|--------|------|
| `@solana-program/token` | `tokenProgram()` | `client.token.instructions` (createMint, mintToATA, transferToATA, etc.) |

### Pre-Configured Client Packages

| Package | Exports | Purpose |
|---------|---------|---------|
| `@solana/kit-client-rpc` | `createClient`, `createLocalClient` | Production & local dev |
| `@solana/kit-client-litesvm` | `createClient` | LiteSVM testing |

### Example Implmentations

| Package | Exports | Purpose | Code Example | 
| `@solana/kora` | `createKitKoraClient`, `koraPlugin` | Gasless Transactions |  https://github.com/solana-foundation/kora/blob/main/sdks/ts/src/kit/index.ts |

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

// Use it
const client = createEmptyClient().use(myCustomPlugin());
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
createEmptyClient().use(rpc(url)).use(myRpcPlugin());

// ❌ Type error — rpc not present
createEmptyClient().use(myRpcPlugin());
```
