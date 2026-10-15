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
- Payment correlation: attach a memo (`@solana-program/memo`) or a unique reference account to locate settlement for an order. Neither prevents a second transfer in a separately signed transaction.
- Confirmation: track signature status to the commitment level your UX needs (`confirmed` for UI feedback, `finalized` for irreversible fulfillment)

## Solana Pay (payment requests / QR)

Use the Solana Pay URL spec for request-based payments (point-of-sale, invoices, QR codes):
- `solana:<recipient>?amount=..&spl-token=..&reference=..&label=..&message=..`
- Verify settlement server-side by finding the transaction via the `reference` key and validating recipient, mint, and amount from chain state.

## Retry and fulfillment boundaries

- Persist the authorized order terms and retain each signed transaction's
  signature before submission. A timeout does not prove failure.
- Rebroadcasting the same signed transaction preserves its signature. Rebuilding
  with a different recent blockhash and signing again creates a different
  transaction; reusing the memo or reference does not make it the same payment.
- Before rebuilding after expiry, reconcile the original signature and matching
  settlement. Missing RPC history is inconclusive; do not automatically pay again.
- Atomically claim fulfillment in durable application state, and make fulfillment
  retries idempotent. For payment deduplication across independently signed attempts,
  one option is a payment program that atomically checks and consumes a stable
  intent ID or sequence with the transfer. Bind it to the authorized payer and immutable terms;
  a new ID or sequence is a new payment, not a retry.
- Verify recipient, asset, amount, transaction success and required commitment
  before fulfillment. A reference match alone is insufficient.

See the [Solana Pay reference specification](https://docs.solanapay.com/spec),
[Memo program semantics](https://www.solana-program.com/docs/memo), and
[transaction structure](https://solana.com/docs/core/transactions).

## Kora (gasless / fee abstraction)
Consider Kora when you need:
- sponsored transactions (user doesn't pay gas)
- users paying fees in tokens other than SOL
- a trusted signing / paymaster component

Kora ships a Kit plugin (`koraPlugin` / `createKitKoraClient` from `@solana/kora`).

## UX and security checklist for payments
- Always show recipient + amount + token clearly before signing.
- Keep retries tied to the same authorized payment intent; do not treat a memo or reference as an on-chain duplicate-payment guard.
- Confirm settlement by querying chain state, not by trusting client-side callbacks.
- Handle partial failures gracefully (transaction sent but not confirmed).
- Provide clear error messages for common failure modes (insufficient balance, rejected signature).
- Test settlement logic against Surfpool — set up buyer/merchant token accounts with `surfnet_setTokenAccount` and assert post-transaction balances (see [testing.md](testing.md)).
