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

Always pass your client type to `useClient` — a bare `useClient()` gives you an untyped `Client<object>` (and the type parameter is expected to become required):

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
| `useTrackedData` | Data that updates from a subscription stream |
| `useAction` | Wrap async actions (send, connect) with pending/error state |

For caching, revalidation, and request dedup, prefer the framework adapters: `@solana/react/swr` (SWR) and `@solana/react/query` (TanStack Query).

## Wallet Hooks (`@solana/kit-plugin-wallet/react`)

Requires the `walletSigner` (or `walletWithoutSigner`) plugin on the client.

**State hooks:**

| Hook | Returns |
|------|---------|
| `useWallets()` | Discovered Wallet Standard wallets for the configured chain |
| `useConnectedWallet()` | Active connection (`{ account, signer, wallet }`) or `null` |
| `useWalletStatus()` | `'pending' \| 'disconnected' \| 'connecting' \| 'connected' \| 'disconnecting' \| 'reconnecting'` |
| `useIsWalletReady()` | `false` during discovery warm-up, then `true` |

**Action hooks** (built on `useAction` — expose `dispatch` + pending/error state):

| Hook | Wraps |
|------|-------|
| `useConnect()` | `client.wallet.connect(wallet)` |
| `useDisconnect()` | `client.wallet.disconnect()` |
| `useSignIn()` | Sign-In-With-Solana (`client.wallet.signIn(wallet, input)`) |
| `useSignMessage()` | `client.wallet.signMessage(message)` |
| `useSelectAccount()` | Switch account within the authorized wallet |

**Component:** `WalletReadyGate` — renders `fallback` until wallet discovery settles.

```tsx
import {
  useConnect,
  useConnectedWallet,
  useWallets,
  WalletReadyGate,
} from '@solana/kit-plugin-wallet/react';

function WalletPicker() {
  const wallets = useWallets();
  const connected = useConnectedWallet();
  const { dispatch: connect } = useConnect();

  if (connected) return <p>{connected.account.address}</p>;
  return wallets.map((w) => (
    <button key={w.name} onClick={() => connect(w)}>{w.name}</button>
  ));
}
```

> **API heads-up:** these hooks are moving to take the client as their first parameter — `useConnect(client)`, `useWalletStatus(client)`, `<WalletReadyGate client={client}>` ([kit-plugins#326](https://github.com/anza-xyz/kit-plugins/pull/326)). New Kit hooks will follow the same `(client, input)` pattern (e.g. an upcoming `useSendTransaction(client, input)`), keeping the app fully typed end-to-end. Check the [kit-plugin-wallet README](https://github.com/anza-xyz/kit-plugins/tree/main/packages/kit-plugin-wallet#react-hooks) for current signatures.

## Chain Identifiers

```ts
'solana:mainnet'
'solana:devnet'
'solana:testnet'
'solana:localnet'
```

## Full App Pattern

See [../frontend.md](../frontend.md) for the complete Next.js App Router setup (providers, wallet button, transaction sending, data fetching).
