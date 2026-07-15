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
npm install @x402/core @x402/svm @x402/express @solana/kit
```

Note: `@x402/core` provides the transport-agnostic client and server components. `@x402/svm` provides the Solana VM (SVM) payment scheme implementation for USDC settlement on Solana mainnet.

**Server-side (accepting x402 payments):**

```typescript
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
import { ExactSvmScheme } from "@x402/svm/exact/server";

// Connect to the x402 facilitator for payment processing
const facilitatorClient = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator",
});

// Create resource server with SVM payment scheme registered
const server = new x402ResourceServer(facilitatorClient)
  .register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", new ExactSvmScheme());

await server.initialize();

// Define protected routes and their payment requirements
const routes = {
  "POST /protected-route": {
    accepts: {
      scheme: "exact",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",   // Solana mainnet CAIP-2
      payTo: "SOLANA_WALLET_ADDRESS",
      price: "$0.01",
    },
    description: "My paid API endpoint",
    mimeType: "application/json",
  },
};

// Attach x402 middleware to Express
app.use(paymentMiddleware(routes, server));
```

**Client-side (paying via x402):**

```typescript
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactSvmScheme } from "@x402/svm/exact/client";
import { createKeyPairSignerFromBytes } from "@solana/kit";

// Create SVM signer from private key bytes
const privateKeyBytes = hexToBytes(process.env.SOLANA_PRIVATE_KEY!);
const signer = await createKeyPairSignerFromBytes(privateKeyBytes);

// Create core client and register the SVM scheme
const coreClient = new x402Client()
  .register("solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", new ExactSvmScheme(signer));

// Wrap with HTTP client for header encoding/decoding
const client = new x402HTTPClient(coreClient);

// Make a request
const response = await fetch("https://api.example.com/protected-route", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ /* payload */ }),
});

// Handle 402 Payment Required — create and attach payment
if (response.status === 402) {
  const paymentRequired = client.getPaymentRequiredResponse(
    (name) => response.headers.get(name),
    await response.json()
  );

  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  const paidResponse = await fetch("https://api.example.com/protected-route", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...client.encodePaymentSignatureHeader(paymentPayload),
    },
    body: JSON.stringify({ /* payload */ }),
  });

  // Verify settlement
  const settlement = client.getPaymentSettleResponse(
    (name) => paidResponse.headers.get(name)
  );
  console.log("Transaction:", settlement.transaction);
}
```

**Discovery endpoints (server advertises capabilities):**

```
GET /.well-known/x402 → { version, resources, resourceDetails, facilitator, instructions }
```

**Key references:**
- [x402.org](https://x402.org/) — protocol spec
- `@x402/core`, `@x402/svm`, `@x402/express` — npm packages
- [x402scan.com](https://www.x402scan.com/) — public x402 service registry

## UX and security checklist for payments
- Always show recipient + amount + token clearly before signing.
- Protect against replay (use unique references / memoing where appropriate).
- Confirm settlement by querying chain state, not by trusting client-side callbacks.
- Handle partial failures gracefully (transaction sent but not confirmed).
- Provide clear error messages for common failure modes (insufficient balance, rejected signature).
- Test settlement logic against Surfpool — set up buyer/merchant token accounts with `surfnet_setTokenAccount` and assert post-transaction balances (see [testing.md](testing.md)).
