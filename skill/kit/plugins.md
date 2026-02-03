# Solana Kit Plugins Reference

## Plugin Architecture

### @solana/plugin-core

Core plugin infrastructure for composable client building.

```ts
import { createEmptyClient } from '@solana/plugin-core';

// Create client via plugin chaining
const client = await createEmptyClient()
  .use(pluginA())
  .use(pluginB())
  .use(pluginC());
```

### Plugin Signature

```ts
type Plugin<TIn, TOut> = (client: TIn) => TOut | Promise<TOut>;
```

Plugins transform clients, adding capabilities. TypeScript enforces dependencies via generics.

### Type-Safe Dependencies

```ts
// Plugin that REQUIRES rpc capability
function myPlugin<T extends { rpc: SolanaRpc }>(client: T) {
  return {
    ...client,
    myMethod: () => client.rpc.getBalance(addr).send(),
  };
}

// ❌ Type error - rpc not present
createEmptyClient().use(myPlugin());

// ✅ Works - rpc added first
createEmptyClient().use(rpc(url)).use(myPlugin());
```

---

## @solana/kit-plugins

**Repo:** https://github.com/anza-xyz/kit-plugins
**Package:** `@solana/kit-plugins`

Ready-to-use plugins and preset clients.

### Core Plugins

| Plugin | Purpose |
|--------|---------|
| `rpc(url)` | Adds RPC client |
| `payer(signer)` | Sets transaction fee payer |
| `airdrop()` | Adds airdrop capability (devnet/testnet) |
| `litesvm()` | LiteSVM local testing |
| `instructionPlan()` | Multi-instruction batching |

### Preset Clients

```ts
import {
  createDefaultRpcClient,
  createDefaultLocalhostRpcClient,
  createDefaultLiteSVMClient,
} from '@solana/kit-plugins';

// Mainnet/devnet via URL
const client = await createDefaultRpcClient('https://api.mainnet-beta.solana.com');

// Local validator (localhost:8899)
const client = await createDefaultLocalhostRpcClient();

// LiteSVM (in-memory, fast tests)
const client = await createDefaultLiteSVMClient();
```

### Custom Composition

```ts
import { createEmptyClient } from '@solana/plugin-core';
import { rpc, payer, sendTransactions } from '@solana/kit-plugins';

const client = await createEmptyClient()
  .use(rpc('https://api.mainnet-beta.solana.com'))
  .use(payer(mySigner))
  .use(sendTransactions());

await client.sendTransaction(myInstruction);
```

### Plugin Ordering

Plugins that depend on others must come after:

```ts
// ✅ Correct order
createEmptyClient()
  .use(rpc(url))        // 1. RPC first
  .use(payer(signer))   // 2. Payer needs RPC
  .use(airdrop())       // 3. Airdrop needs RPC + payer

// ❌ Wrong order - airdrop needs rpc
createEmptyClient()
  .use(airdrop())
  .use(rpc(url))
```

---

## Quick Start

### Simple Transaction

```ts
import { createDefaultLocalhostRpcClient } from '@solana/kit-plugins';

const client = await createDefaultLocalhostRpcClient();
await client.sendTransaction(myInstruction);
```

### With Custom Payer

```ts
import { createEmptyClient } from '@solana/plugin-core';
import { rpc, payer, sendTransactions } from '@solana/kit-plugins';
import { generateKeyPairSigner } from '@solana/signers';

const signer = await generateKeyPairSigner();
const client = await createEmptyClient()
  .use(rpc('https://api.devnet.solana.com'))
  .use(payer(signer))
  .use(sendTransactions());
```

### Testing with LiteSVM

```ts
import { createDefaultLiteSVMClient } from '@solana/kit-plugins';

const client = await createDefaultLiteSVMClient();
// Fast, in-memory transactions - no network
await client.sendTransaction(myInstruction);
```
