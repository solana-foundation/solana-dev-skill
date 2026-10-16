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

- Store the signature before submitting. On timeout, rebroadcast the same signed tx or reconcile it before re-signing; missing RPC history isn't proof of non-payment.
- Make fulfillment idempotent (atomically claim the order in your DB). A reference match alone isn't enough: also require a successful tx at the required commitment.

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

## References

- [Solana Pay](https://solana.com/docs/tools/solana-pay)
- [Memo program](https://www.solana-program.com/docs/memo)
- [Transaction structure](https://solana.com/docs/core/transactions)
