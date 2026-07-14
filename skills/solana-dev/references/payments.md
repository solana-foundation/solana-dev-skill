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

## UX and security checklist for payments
- Always show recipient + amount + token clearly before signing.
- Protect against replay (use unique references / memoing where appropriate).
- Confirm settlement by querying chain state, not by trusting client-side callbacks.
- Handle partial failures gracefully (transaction sent but not confirmed).
- Provide clear error messages for common failure modes (insufficient balance, rejected signature).
- Test settlement logic against Surfpool — set up buyer/merchant token accounts with `surfnet_setTokenAccount` and assert post-transaction balances (see [testing.md](testing.md)).
