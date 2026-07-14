---
title: Frontend with Solana Kit
description: Build React and Next.js Solana apps with a Kit plugin client, Wallet Standard connection via @solana/kit-plugin-wallet (+ its React hooks), and @solana/react client bindings.
---

# Frontend with Solana Kit (Next.js / React)

## Goals
- One Kit client instance for the app (RPC + wallet + transaction sending)
- Wallet Standard-first discovery/connect (no wallet-specific adapters)
- Minimal "use client" footprint in Next.js (hooks only in leaf components)
- Transaction sending that is observable, cancelable, and UX-friendly

## Recommended dependencies
- `@solana/kit` (v7+)
- `@solana/kit-plugin-rpc`, `@solana/kit-plugin-wallet` (wallet React hooks ship in `@solana/kit-plugin-wallet/react`)
- `@solana/react` (v7+ — Kit client bindings: `ClientProvider`, `useClient`, data hooks)
- `@solana-program/system`, `@solana-program/token`, `@your-program/codama-client` etc. (only what you need)

`solanaRpc` already bundles transaction planning/sending — you do not need `@solana/kit-plugin-instruction-plan` in apps.

Do **not** use `@solana/client` / `@solana/react-hooks` (framework-kit) for new work — that stack is stale; the maintained path is Kit plugins + `@solana/react`. Do not use `@solana/wallet-adapter-*` for new apps either; Wallet Standard discovery covers modern wallets.

## Bootstrap recommendation
Prefer `create-solana-dapp` and pick a Kit template for new projects.

## Client setup (Next.js App Router)

Create a single wallet-backed client, export its type, and provide it via `ClientProvider` from `@solana/react`.

Example `app/providers.tsx`:

```tsx
'use client';

import React from 'react';
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { ClientProvider } from '@solana/react';

const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

// One client for the whole app. The connected wallet fills payer + identity.
export const client = createClient()
  .use(walletSigner({ chain: 'solana:devnet' }))
  .use(solanaRpc({ rpcUrl }));

// Export the client type so every useClient<AppClient>() call in the app
// is fully typed (rpc, wallet, sendTransaction, ...).
export type AppClient = Awaited<typeof client>;

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
```

Then wrap `app/layout.tsx` with `<Providers>`.

## Wallet connection

Use the React hooks from `@solana/kit-plugin-wallet/react` — state hooks (`useWallets`, `useConnectedWallet`, `useWalletStatus`, `useIsWalletReady`) and action hooks (`useConnect`, `useDisconnect`, `useSignIn`, `useSignMessage`, `useSelectAccount`), plus a `WalletReadyGate` component for the discovery warm-up:

```tsx
'use client';

import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  WalletReadyGate,
} from '@solana/kit-plugin-wallet/react';

function WalletButton() {
  const wallets = useWallets();
  const connected = useConnectedWallet();
  const { dispatch: connect } = useConnect();
  const { dispatch: disconnect } = useDisconnect();

  if (!connected) {
    return wallets.map((wallet) => (
      <button key={wallet.name} onClick={() => connect(wallet)}>
        Connect {wallet.name}
      </button>
    ));
  }
  return (
    <div>
      <p>Connected: {connected.account.address}</p>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}

// Hide wallet UI until Wallet Standard discovery settles
export const Wallet = () => (
  <WalletReadyGate fallback={<p>Loading wallets…</p>}>
    <WalletButton />
  </WalletReadyGate>
);
```

> **API heads-up:** these hooks are moving to take the client as their first parameter — `useConnect(client)`, `useWalletStatus(client)`, `<WalletReadyGate client={client}>` ([kit-plugins#326](https://github.com/anza-xyz/kit-plugins/pull/326)) — for end-to-end typed clients. Check the [kit-plugin-wallet README](https://github.com/anza-xyz/kit-plugins/tree/main/packages/kit-plugin-wallet#react-hooks) for the current signatures.

Outside React (or for imperative flows), the same state is on the client: `client.wallet.getState()` returns `{ wallets, connected, status }` and `client.wallet.connect(wallet)` / `disconnect()` / `selectAccount(account)` drive the connection.

## Sending transactions

With the wallet plugin installed, `client.sendTransaction` plans, asks the wallet to sign, and sends:

```tsx
import { useClient } from '@solana/react';
import { getTransferSolInstruction } from '@solana-program/system';
import { address, sol } from '@solana/kit';
import type { AppClient } from '@/app/providers';

function useSendTip() {
  const client = useClient<AppClient>();
  return async (to: string) => {
    const ix = getTransferSolInstruction({
      source: client.payer,
      destination: address(to),
      amount: sol('0.01'),
    });
    return await client.sendTransaction([ix]);
  };
}
```

Kit will ship dedicated hooks for this shortly (e.g. `useSendTransaction(client, input)` wrapping `useAction` + `client.sendTransaction`) — prefer those once released.

## Data fetching and subscriptions

- `@solana/react` ships data hooks (`useAction`, `useRequest`, `useSubscription`, `useTrackedData`) plus adapters for SWR (`@solana/react/swr`) and TanStack Query (`@solana/react/query`) — prefer these over hand-rolled polling. Always call `useClient<AppClient>()` with your exported client type.
- Prefer subscriptions/watchers over manual polling; clean up with the returned abort handles.
- For Next.js: keep server components server-side; only leaf components that call hooks should be client components. Server-side reads can use a plain Kit RPC client (no wallet plugin).

## Transaction UX checklist

- Disable inputs while a transaction is pending
- Provide a signature immediately after send
- Track confirmation states (processed/confirmed/finalized) based on UX need
- Show actionable errors:
  - user rejected signing
  - insufficient SOL for fees / rent
  - blockhash expired / dropped
  - account already in use / already initialized
  - program error (custom error code)

## Legacy apps

- App built on web3.js v1 + wallet-adapter? Migrate to web3.js v3 (Kit internals, same classes; currently RC) first — see [kit-web3-interop.md](kit-web3-interop.md) for routing to the official migration skill — then adopt Kit plugins incrementally.
- Found `@solana/client` / `@solana/react-hooks` (framework-kit)? Migrate to the Kit plugin client + `@solana/react`: `createClient({ endpoint, walletConnectors })` becomes `createClient().use(walletSigner(...)).use(solanaRpc(...))`, and framework-kit hooks map to the `@solana/kit-plugin-wallet/react` hooks or `client.wallet` state.
