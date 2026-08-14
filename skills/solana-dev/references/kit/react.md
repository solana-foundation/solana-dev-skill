---
title: React Reference
description: Kit-native React bindings from @solana/react (ClientProvider, typed useClient, data hooks, SWR/TanStack adapters) and wallet React hooks from @solana/kit-plugin-wallet/react.
---

# Solana Kit React Reference

Two packages cover React apps:

1. **`@solana/react` (v7+)** — Kit client bindings: `ClientProvider`, `useClient`, `useClientCapability`, data hooks (`useAction`, `useRequest`, `useSubscription`, `useTrackedData`), and adapters for SWR (`@solana/react/swr`) and TanStack Query (`@solana/react/query`).
2. **`@solana/kit-plugin-wallet/react`** — wallet connection hooks (see below).

> **Deprecation note:** the older Wallet Standard hooks that shipped in `@solana/react` (`SelectedWalletAccountContextProvider`, `useSelectedWalletAccount`, `useSignIn` / `useSignMessage` / `useSignTransaction` / `useSignAndSendTransaction`, `useWalletAccount*Signer`) are being superseded by the wallet-plugin hooks and will be deprecated. Do not use them in new code.

## Client Provider + Typed useClient

Create one client for the app, export its type, and provide it at the root:

```tsx
// app/providers.tsx
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { ClientProvider } from '@solana/react';

export const client = createClient()
  .use(walletSigner({ chain: 'solana:devnet' }))
  .use(solanaRpc({ rpcUrl }));

// Makes every useClient<AppClient>() call fully typed
export type AppClient = Awaited<typeof client>;

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
```

Always pass your client type to `useClient` — as of `@solana/react` 7.1+, the `TClient` type parameter is required, so a bare `useClient()` fails to compile:

```tsx
import { useClient } from '@solana/react';
import type { AppClient } from '@/app/providers';

function Balance({ address }: { address: Address }) {
  const client = useClient<AppClient>();
  // client.rpc, client.wallet, client.sendTransaction — all typed
  // data hooks: useRequest / useSubscription / useTrackedData / useAction
  // or use the SWR / TanStack Query adapters for caching + revalidation
}
```

## Data Hooks

| Hook | Purpose |
|------|---------|
| `useRequest` | One-shot async reads (RPC calls) |
| `useSubscription` | WebSocket subscriptions with cleanup |
| `useTrackedData` | One-shot read seeded into a subscription, slot-deduped |
| `useAction` | Wrap async actions (send, connect) with pending/error state |

For caching, revalidation, and request dedup, prefer the framework adapters: `@solana/react/swr` (`useRequestSWR`, `useSubscriptionSWR`, `useTrackedDataSWR`) and `@solana/react/query` (`useRequestQuery`, `useSubscriptionQuery`, `useTrackedDataQuery`). Both are optional peer deps — install `swr` or `@tanstack/react-query` yourself.

As of `@solana/react` 7.1+, `useSubscriptionQuery` / `useTrackedDataQuery` (the TanStack Query adapters) surface a new error, `SOLANA_ERROR__SUBSCRIBABLE__STREAM_CLOSED_WITHOUT_ERROR`, when the underlying stream store closes in an error state with a nullish payload. The SWR adapters are unaffected.

### useTrackedData / useTrackedDataSWR / useTrackedDataQuery

Use these for any live account value (balances, token accounts, program state). The hook fires the initial RPC read and the subscription together and slot-dedupes them, so the first paint is fast and out-of-order arrivals never regress the surfaced value. Do **not** hand-roll a `getBalance` + `accountNotifications` pair.

```tsx
import { useMemo } from 'react';
import { type Address, type Lamports } from '@solana/kit';
import { useClient } from '@solana/react';
import { useTrackedDataSWR } from '@solana/react/swr';

function useBalance(accountAddress: Address) {
  const { rpc, rpcSubscriptions } = useClient<AppClient>();
  const spec = useMemo(
    () => ({
      initialValueSource: rpc.getBalance(accountAddress, { commitment: 'confirmed' }),
      initialValueMapper: (lamports: Lamports) => lamports,
      streamSource: rpcSubscriptions.accountNotifications(accountAddress, {
        commitment: 'confirmed',
      }),
      streamValueMapper: ({ lamports }: { lamports: Lamports }) => lamports,
    }),
    [rpc, rpcSubscriptions, accountAddress],
  );
  const { data, error } = useTrackedDataSWR(['balance', accountAddress], spec);
  return { lamports: data?.value ?? null, error };
}
```

- `data` is the `SolanaRpcResponse` envelope: `data.value` and `data.context.slot`.
- The `spec` must be memoized — identity drives teardown/re-run. Pass `null` (for the spec, or the SWR key) to disable.
- `useTrackedDataSWR` returns SWR's `{ data, error }` only. If you need a `refresh()` button or per-attempt `getAbortSignal` timeouts, use plain `useTrackedData`, which returns `{ data, error, refresh, status }` (`'loading' | 'loaded' | 'error' | 'disabled'`).
- If the spec changes but the SWR key doesn't, the connection stays bound to the original spec — bump the key to swap specs.
- In a multi-cluster app, include the cluster in the key and derive it from the same source that built the client — see the note in [../frontend.md](../frontend.md).

### useAction

Wraps any async function with lifecycle state. Use it for sends, connects, and every other imperative flow instead of `useState` + `try/catch`. The wrapped function receives an `AbortSignal` as its first argument, followed by whatever `dispatch` is called with:

```tsx
const { dispatch, dispatchAsync, data, error, isRunning, reset } = useAction(
  async (signal: AbortSignal, to: Address) => {
    const ix = getTransferSolInstruction({ source: client.payer, destination: to, amount });
    const result = await client.sendTransaction([ix], { abortSignal: signal });
    return result.context.signature;
  },
);
```

- `dispatch` returns `void` and never throws — the variant for `onClick`. `dispatchAsync` resolves the value or rejects.
- Dispatching while a call is in flight aborts the first via its `AbortSignal`. Awaiters of the superseded `dispatchAsync` see an `AbortError`, filterable with `isAbortError`, importable directly from `@solana/kit` (7.1+ re-exports `@solana/promises`). Sticking to `dispatch` where you can avoids the question entirely.
- `data` and `error` persist through subsequent `running` states for stale-while-revalidate UX; only `reset()` clears `data`.
- `fn` is held in a ref pointing at the latest render's closure — no deps array.

Most of the wallet plugin's action hooks (`useConnect`, `useDisconnect`, `useSignIn`, `useSignMessage`) are built on this and expose the same shape.

## Client Capability Hooks (requires `@solana/react` 7.1+)

These read off whichever plugin capabilities the client advertises. Each takes the client as its only argument.

### usePayer / useIdentity

`usePayer(client)` reads `client.payer`; `useIdentity(client)` reads `client.identity`. Both return the current `TransactionSigner`, or `undefined` while none is available.

```tsx
const payer = usePayer(client);
const identity = useIdentity(client);
return <span>{payer ? `Paying with ${payer.address}` : 'No payer'}</span>;
```

- When the client advertises `subscribeToPayer` / `subscribeToIdentity`, the hook subscribes so the returned signer always reflects the latest value. Otherwise it falls back to a one-time read.
- **Gotcha:** if reading the underlying value throws — as the wallet plugin does for `payer`/`identity` when it owns those roles and no wallet is connected — the hook surfaces `undefined` rather than throwing.

### usePlanTransaction / usePlanTransactions / useSendTransaction / useSendTransactions

Wrap a client's transaction planning/sending capabilities as `useAction`-style reactive actions — same `dispatch` / `dispatchAsync` / `data` / `error` / `isRunning` shape as `useAction`.

| Hook | Wraps | `dispatch` args | Resolves with |
|------|-------|------------------|----------------|
| `usePlanTransaction(client)` | `client.planTransaction` | instruction input | the planned transaction message |
| `usePlanTransactions(client)` | `client.planTransactions` | instruction input | the full transaction plan (may span multiple transactions) |
| `useSendTransaction(client)` | `client.sendTransaction` | instructions, an instruction plan, a transaction message, or a transaction plan | the successful single-transaction-plan result |
| `useSendTransactions(client)` | `client.sendTransactions` | instructions, an instruction plan, or a transaction plan | the transaction plan result for all transactions |

```tsx
const { dispatch, data, isRunning } = useSendTransaction(client);
<button disabled={isRunning} onClick={() => dispatch(instructions)}>Send</button>
```

Use the singular hooks when you expect everything to fit in one transaction; reach for the plural hooks when instructions might need splitting across transactions.

### useAirdrop

Wraps a client's `airdrop` capability (`ClientWithAirdrop`) as a tracked `useAction`. `dispatch(address, amount)` requests an airdrop with an injected `AbortSignal` and resolves with the transaction `Signature`, or `undefined` when the airdrop was applied without a transaction (e.g. some local-validator implementations update balances directly, with no transaction to sign).

```tsx
import { useAirdrop } from '@solana/react';
import { lamports } from '@solana/kit';

const { dispatch, isRunning } = useAirdrop(client);
<button disabled={isRunning} onClick={() => dispatch(address, lamports(1_000_000_000n))}>
  Airdrop 1 SOL
</button>
```

## Wallet Hooks (`@solana/kit-plugin-wallet/react`)

Requires `@solana/kit-plugin-wallet` 0.14+ and the `walletSigner` (or `walletWithoutSigner`) plugin on the client. Every hook takes the wallet-enabled `client` as its first argument, keeping the app fully typed end-to-end.

**State hooks:**

| Hook | Returns |
|------|---------|
| `useWallets(client)` | Discovered Wallet Standard wallets for the configured chain |
| `useConnectedWallet(client)` | Active connection (`{ account, signer, wallet }`) or `null` |
| `useWalletStatus(client)` | `'pending' \| 'disconnected' \| 'connecting' \| 'connected' \| 'disconnecting' \| 'reconnecting'` |
| `useIsWalletReady(client)` | `false` during discovery warm-up, then `true` |

**Action hooks** (built on `useAction` — expose `dispatch` + pending/error state):

| Hook | Wraps |
|------|-------|
| `useConnect(client)` | `client.wallet.connect(wallet)` |
| `useDisconnect(client)` | `client.wallet.disconnect()` |
| `useSignIn(client)` | Sign-In-With-Solana (`client.wallet.signIn(wallet, input)`) |
| `useSignMessage(client)` | `client.wallet.signMessage(message)` |

`useSelectAccount(client)` is the exception: switching accounts is synchronous, so it returns the bound `selectAccount(account)` function directly rather than an `ActionResult` — there is no `dispatch` to destructure.

**Component:** `WalletReadyGate` — takes `client` as a prop, renders `fallback` until wallet discovery settles.

```tsx
import {
  useConnect,
  useConnectedWallet,
  useWallets,
  WalletReadyGate,
} from '@solana/kit-plugin-wallet/react';
import type { ClientWithWallet } from '@solana/kit-plugin-wallet';

function WalletPicker({ client }: { client: ClientWithWallet }) {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { dispatch: connect } = useConnect(client);

  if (connected) return <p>{connected.account.address}</p>;
  return wallets.map((w) => (
    <button key={w.name} onClick={() => connect(w)}>{w.name}</button>
  ));
}
```

## Chain Identifiers

```ts
'solana:mainnet'
'solana:devnet'
'solana:testnet'
'solana:localnet'
```

## Full App Pattern

See [../frontend.md](../frontend.md) for the complete Next.js App Router setup (providers, wallet button, transaction sending, data fetching).
