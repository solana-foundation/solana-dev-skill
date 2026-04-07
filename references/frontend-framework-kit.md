---
title: Frontend with framework-kit
description: Build React and Next.js Solana apps with a single client instance, Wallet Standard-first connection, and minimal client-side footprint.
---

# Frontend with framework-kit (Next.js / React)

## Goals
- One Solana client instance for the app (RPC + WS + wallet connectors)
- Wallet Standard-first discovery/connect
- Minimal "use client" footprint in Next.js (hooks only in leaf components)
- Transaction sending that is observable, cancelable, and UX-friendly

## Recommended dependencies
- @solana/client
- @solana/react-hooks
- @solana/kit
- @solana-program/system, @solana-program/token, etc. (only what you need)

## Bootstrap recommendation
Prefer `create-solana-dapp` and pick a kit/framework-kit compatible template for new projects.

## Provider setup (Next.js App Router)
Create a single client and provide it via SolanaProvider.

Example `app/providers.tsx`:

```tsx
'use client';

import React from 'react';
import { SolanaProvider } from '@solana/react-hooks';
import { autoDiscover, createClient } from '@solana/client';

const endpoint =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

// Some environments prefer an explicit WS endpoint; default to wss derived from https.
const websocketEndpoint =
  process.env.NEXT_PUBLIC_SOLANA_WS_URL ??
  endpoint.replace('https://', 'wss://').replace('http://', 'ws://');

export const solanaClient = createClient({
  endpoint,
  websocketEndpoint,
  walletConnectors: autoDiscover(),
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <SolanaProvider client={solanaClient}>{children}</SolanaProvider>;
}
```

Then wrap `app/layout.tsx` with `<Providers>`.

## Hook usage patterns (high-level)

Prefer framework-kit hooks before writing your own store/subscription logic:

* `useWalletConnection()` for connect/disconnect and wallet discovery
* `useBalance(...)` for lamports balance
* `useSolTransfer(...)` for SOL transfers
* `useSplToken(...)` / token helpers for token balances/transfers
* `useTransactionPool(...)` for managing send + status + retry flows

When you need custom instructions, build them using `@solana-program/*` and send them via the framework-kit transaction helpers.

## Data fetching and subscriptions

* Prefer watchers/subscriptions rather than manual polling.
* Clean up subscriptions with abort handles returned by watchers.
* For Next.js: keep server components server-side; only leaf components that call hooks should be client components.

## Transaction UX checklist

* Disable inputs while a transaction is pending
* Provide a signature immediately after send
* Track confirmation states (processed/confirmed/finalized) based on UX need
* Show actionable errors:

  * user rejected signing
  * insufficient SOL for fees / rent
  * blockhash expired / dropped
  * account already in use / already initialized
  * program error (custom error code)

## When to use ConnectorKit (optional)

If you need a headless connector with composable UI elements and explicit state control, use ConnectorKit.
Typical reasons:

* You want a headless wallet connection core (useful across frameworks)
* You want more control over wallet/account state than a single provider gives
* You need production diagnostics/health checks for wallet sessions
