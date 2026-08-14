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
- `swr` (peer dep of `@solana/react/swr`) or `@tanstack/react-query` (peer dep of `@solana/react/query`) — pick whichever your app already uses
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

Use the React hooks from `@solana/kit-plugin-wallet/react` — state hooks (`useWallets`, `useConnectedWallet`, `useWalletStatus`, `useIsWalletReady`), action hooks (`useConnect`, `useDisconnect`, `useSignIn`, `useSignMessage`), `useSelectAccount` (synchronous — returns the bound function, not an action), plus a `WalletReadyGate` component for the discovery warm-up. Every hook takes the wallet-enabled `client` as its first argument:

```tsx
'use client';

import {
  useConnect,
  useConnectedWallet,
  useDisconnect,
  useWallets,
  WalletReadyGate,
} from '@solana/kit-plugin-wallet/react';
import type { AppClient } from './providers';

function WalletButton({ client }: { client: AppClient }) {
  const wallets = useWallets(client);
  const connected = useConnectedWallet(client);
  const { dispatch: connect } = useConnect(client);
  const { dispatch: disconnect } = useDisconnect(client);

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
export const Wallet = ({ client }: { client: AppClient }) => (
  <WalletReadyGate client={client} fallback={<p>Loading wallets…</p>}>
    <WalletButton client={client} />
  </WalletReadyGate>
);
```

Outside React (or for imperative flows), the same state is on the client: `client.wallet.getState()` returns `{ wallets, connected, status }` and `client.wallet.connect(wallet)` / `disconnect()` / `selectAccount(account)` drive the connection.

## Sending transactions

With the wallet plugin installed, `client.sendTransaction` plans, asks the wallet to sign, and sends. Wrap it in `useAction` from `@solana/react` so pending/error state, abort-on-resend, and stale-while-revalidate come for free instead of hand-rolled `useState`:

```tsx
'use client';

import { address, sol, solToLamports } from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';
import { useAction, useClient } from '@solana/react';
import type { AppClient } from '@/app/providers';

function TipButton({ to }: { to: string }) {
  const client = useClient<AppClient>();

  const { dispatch, isRunning, error, data: signature } = useAction(
    async (signal: AbortSignal, recipient: string) => {
      const ix = getTransferSolInstruction({
        source: client.payer,
        destination: address(recipient),
        // `sol()` returns a fixed-point value; instructions take Lamports
        amount: solToLamports(sol('0.01')),
      });
      // Forward the signal so a superseded send is actually cancelled
      const result = await client.sendTransaction([ix], { abortSignal: signal });
      return result.context.signature;
    },
  );

  return (
    <>
      <button disabled={isRunning} onClick={() => dispatch(to)}>
        {isRunning ? 'Sending…' : error ? 'Retry' : 'Tip 0.01 SOL'}
      </button>
      {signature ? <a href={`https://explorer.solana.com/tx/${signature}`}>View</a> : null}
    </>
  );
}
```

Use `dispatch` in event handlers — it returns `void` and never throws, so it can't produce an unhandled rejection. Full hook semantics are in [kit/react.md](kit/react.md#useaction).

## Data fetching and subscriptions

`@solana/react` ships data hooks — `useRequest` (one-shot reads), `useSubscription` (websocket streams), `useTrackedData` (a one-shot read seeded into a subscription, slot-deduped), and `useAction` — plus adapters for SWR (`@solana/react/swr`) and TanStack Query (`@solana/react/query`). Prefer these over hand-rolled polling, and always call `useClient<AppClient>()` with your exported client type. See [kit/react.md](kit/react.md#data-hooks) for the per-hook return shapes and gotchas.

**Balance and other live account data: use `useTrackedDataSWR`.** It fires the initial RPC fetch and the account subscription together, slot-dedupes them so an out-of-order arrival never regresses the displayed value, and routes the result through SWR's cache so every component on the same key shares one connection. A Next.js-shaped hook:

```tsx
'use client';

import { useMemo } from 'react';
import { type Address, type Lamports } from '@solana/kit';
import { useClient } from '@solana/react';
import { useTrackedDataSWR } from '@solana/react/swr';
import type { AppClient } from '@/app/providers';

export function useBalance(accountAddress?: Address) {
  const { rpc, rpcSubscriptions } = useClient<AppClient>();

  // Passing `null` when there is no address is what gates the hook off —
  // it must be memoized, since spec identity drives teardown and re-run.
  const spec = useMemo(
    () =>
      accountAddress
        ? {
            initialValueSource: rpc.getBalance(accountAddress, { commitment: 'confirmed' }),
            initialValueMapper: (lamports: Lamports) => lamports,
            streamSource: rpcSubscriptions.accountNotifications(accountAddress, {
              commitment: 'confirmed',
            }),
            streamValueMapper: ({ lamports }: { lamports: Lamports }) => lamports,
          }
        : null,
    [rpc, rpcSubscriptions, accountAddress],
  );

  const { data, error } = useTrackedDataSWR(
    accountAddress ? ['balance', accountAddress] : null,
    spec,
  );

  return {
    lamports: data?.value ?? null,
    isLoading: accountAddress != null && data == null && error == null,
    error,
  };
}
```

**Multi-cluster apps:** include the cluster in the cache key, and derive it from the same source that built the client — the client is typically rebuilt one render *after* the selection flips, so a key read from selection state binds the new network's fetch to the previous network's `rpc`. The [Kit example app](https://github.com/anza-xyz/kit/blob/main/examples/react-app/src/components/Balance.tsx) stamps `chain` onto the client with `extendClient` and reads it back off `useClient<AppClient>()` to keep the two in lockstep.

Render lamports with the Kit helpers rather than dividing by `1e9`:

```tsx
import { formatDecimalFixedPoint, lamportsToSol } from '@solana/kit';

const solFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 5 });

function BalanceDisplay({ accountAddress }: { accountAddress: Address }) {
  const { lamports } = useBalance(accountAddress);
  if (lamports == null) return <span>&ndash;</span>;
  return <span>{formatDecimalFixedPoint(solFormatter, lamportsToSol(lamports))} ◎</span>;
}
```

For Next.js: keep server components server-side; only leaf components that call hooks should be client components. Server-side reads can use a plain Kit RPC client (no wallet plugin).

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
