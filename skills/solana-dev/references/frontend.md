---
title: Frontend with Solana Kit
description: Build React and Next.js Solana apps with a Kit plugin client, Wallet Standard connection via @solana/kit-plugin-wallet, and @solana/react hooks.
---

# Frontend with Solana Kit (Next.js / React)

## Goals
- One Kit client instance for the app (RPC + wallet + transaction sending)
- Wallet Standard-first discovery/connect (no wallet-specific adapters)
- Minimal "use client" footprint in Next.js (hooks only in leaf components)
- Transaction sending that is observable, cancelable, and UX-friendly

## Recommended dependencies
- `@solana/kit` (v7+)
- `@solana/kit-plugin-rpc`, `@solana/kit-plugin-wallet`, `@solana/kit-plugin-instruction-plan`
- `@solana/react` (v7+ — Kit-native React bindings + Wallet Standard hooks)
- `@solana-program/system`, `@solana-program/token`, etc. (only what you need)

Do **not** use `@solana/client` / `@solana/react-hooks` (framework-kit) for new work — that stack is stale; the maintained path is Kit plugins + `@solana/react`. Do not use `@solana/wallet-adapter-*` for new apps either; Wallet Standard discovery covers modern wallets.

## Bootstrap recommendation
Prefer `create-solana-dapp` and pick a Kit template for new projects.

## Client setup (Next.js App Router)

Create a single wallet-backed client and provide it via `ClientProvider` from `@solana/react`.

Example `app/providers.tsx`:

```tsx
'use client';

import React from 'react';
import { createClient } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { walletSigner } from '@solana/kit-plugin-wallet';
import { planAndSendTransactions } from '@solana/kit-plugin-instruction-plan';
import { ClientProvider } from '@solana/react';

const rpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

// One client for the whole app. The connected wallet fills payer + identity.
export const client = createClient()
  .use(walletSigner({ chain: 'solana:devnet' }))
  .use(solanaRpc({ rpcUrl }))
  .use(planAndSendTransactions());

export function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}
```

Then wrap `app/layout.tsx` with `<Providers>`.

## Wallet connection

`client.wallet` exposes Wallet Standard discovery and connection state:

```tsx
'use client';

import { useClient } from '@solana/react';

function WalletButton() {
  const client = useClient();
  const { wallets, connectedWallet } = client.wallet.getState();

  if (!connectedWallet) {
    return wallets.map((w) => (
      <button key={w.name} onClick={() => client.wallet.connect(w)}>
        Connect {w.name}
      </button>
    ));
  }
  return <p>Connected</p>;
}
```

For lower-level control (sign-in-with-Solana, message signing, per-account signers), use the Wallet Standard hooks from `@solana/react` — see [kit/react.md](kit/react.md).

## Sending transactions

With the wallet plugin installed, `client.sendTransaction` plans, asks the wallet to sign, and sends:

```tsx
import { getTransferSolInstruction } from '@solana-program/system';
import { address, lamports } from '@solana/kit';

async function sendTip(to: string) {
  const ix = getTransferSolInstruction({
    source: client.payer,
    destination: address(to),
    amount: lamports(10_000_000n), // 0.01 SOL
  });
  return await client.sendTransaction([ix]);
}
```

## Data fetching and subscriptions

- `@solana/react` ships data hooks (`useAction`, `useRequest`, `useSubscription`, `useTrackedData`) plus adapters for SWR (`@solana/react/swr`) and TanStack Query (`@solana/react/query`) — prefer these over hand-rolled polling.
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

- App built on web3.js v1 + wallet-adapter? Migrate to web3.js v3 (Kit internals, same classes) first — see [kit-web3-interop.md](kit-web3-interop.md) — then adopt Kit plugins incrementally.
- Found `@solana/client` / `@solana/react-hooks` (framework-kit)? Migrate to the Kit plugin client + `@solana/react`: `createClient({ endpoint, walletConnectors })` becomes `createClient().use(walletSigner(...)).use(solanaRpc(...))`, and framework-kit hooks map to `@solana/react` hooks or `client.wallet` state.
