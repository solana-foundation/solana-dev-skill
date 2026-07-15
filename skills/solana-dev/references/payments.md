---
title: Payments & Commerce
description: Build checkout flows, payment buttons, and QR-based payment requests using Solana Pay conventions, Kit instruction builders, and Kora for gasless flows.
---

# Payments and commerce (optional)

## When payments are in scope
Use this guidance when the user asks about:
- checkout flows, tips, payment buttons
- payment request URLs / QR codes
- fee abstraction / gasless transactions

## Building payments with Kit (default)

Build payment flows directly on `@solana/kit` + `@solana-program/*`:

- SOL transfers: `getTransferSolInstruction` from `@solana-program/system`
- Token transfers: the `tokenProgram()` plugin from `@solana-program/token` (`client.token` — `transferToATA` auto-derives and creates the recipient ATA)
- Reference/idempotency: attach a memo (`@solana-program/memo`) or a unique reference account to correlate on-chain settlement with an order
- Confirmation: track signature status to the commitment level your UX needs (`confirmed` for UI feedback, `finalized` for irreversible fulfillment)

## Solana Pay (payment requests / QR)

Use the Solana Pay URL spec for request-based payments (point-of-sale, invoices, QR codes):
- `solana:<recipient>?amount=..&spl-token=..&reference=..&label=..&message=..`
- Verify settlement server-side by finding the transaction via the `reference` key and validating recipient, mint, and amount from chain state.

## Kora (gasless / fee abstraction)
Consider Kora when you need:
- sponsored transactions (user doesn't pay gas)
- users paying fees in tokens other than SOL
- a trusted signing / paymaster component

Kora ships a Kit plugin (`koraPlugin` / `createKitKoraClient` from `@solana/kora`).

## x402 (agent-to-agent micropayments)

Use x402 when your agent needs to pay another agent, API, or service for compute, data, or inference — all settled on Solana in USDC, gasless.

x402 is a payment protocol for the agent economy: an HTTP 402 flow where a client agent responds to a payment challenge by authorizing a USDC transfer to the server's wallet via the x402 facilitator.

**Solana x402 setup:**

```
npm install @x402/evm @x402/core @x402/fetch
```

Note: x402's EVM scheme covers Solana VM (SVM) via `solana:` address syntax. The receiver address is a Solana wallet.

**Server-side (accepting x402 payments):**

```typescript
import { paymentMiddleware } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const scheme = new ExactEvmScheme({
  receiverAddress: "SOLANA_WALLET_ADDRESS",
  facilitatorUrl: "https://x402.org/facilitator",
});

app.use(paymentMiddleware({
  schemes: [scheme],
  routes: {
    "POST /protected-route": {
      price: "$0.01",
      network: "eip155:792703813",     // Solana CAIP-2 chain ID
      config: { description: "My paid API" },
    },
  },
}));
```

**Client-side (paying via x402):**

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY!);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

const res = await fetchWithPayment("https://api.example.com/protected-route", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ /* payload */ }),
});
```

The `wrapFetchWithPayment` wrapper:
1. Sends the initial request without payment
2. Receives a 402 Payment Required challenge
3. Signs a USDC transfer authorization
4. Retries with the signed X-PAYMENT header
5. Returns the final response with an X-PAYMENT-RESPONSE settlement header

**Discovery endpoints (server advertises capabilities):**

```
GET /.well-known/x402 → { version, resources, resourceDetails, facilitator, instructions }
```

**Key references:**
- [x402.org](https://x402.org/) — protocol spec
- `@x402/core`, `@x402/evm`, `@x402/fetch`, `@x402/express` — npm packages
- [x402scan.com](https://www.x402scan.com/) — public x402 service registry

## UX and security checklist for payments
- Always show recipient + amount + token clearly before signing.
- Protect against replay (use unique references / memoing where appropriate).
- Confirm settlement by querying chain state, not by trusting client-side callbacks.
- Handle partial failures gracefully (transaction sent but not confirmed).
- Provide clear error messages for common failure modes (insufficient balance, rejected signature).
- Test settlement logic against Surfpool — set up buyer/merchant token accounts with `surfnet_setTokenAccount` and assert post-transaction balances (see [testing.md](testing.md)).
