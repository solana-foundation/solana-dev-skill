---
title: Payments & Commerce
description: Build checkout flows, payment buttons, and QR-based payment requests using Commerce Kit and Solana Pay.
---

# Payments and commerce (optional)

## When payments are in scope
Use this guidance when the user asks about:
- checkout flows, tips, payment buttons
- payment request URLs / QR codes
- fee abstraction / gasless transactions

## Commerce Kit (preferred)
Use Commerce Kit as the default for payment experiences:
- drop-in payment UI components (buttons, modals, checkout flows)
- headless primitives for building custom checkout experiences
- React hooks for merchant/payment workflows
- built-in payment verification and confirmation handling
- support for SOL and SPL token payments

### When to use Commerce Kit
- You want a production-ready payment flow with minimal setup
- You need both UI components and headless APIs
- You want built-in best practices for payment verification
- You're building merchant experiences (tipping, checkout, subscriptions)

### Commerce Kit patterns
- Use the provided hooks for payment state management
- Leverage the built-in confirmation tracking (don't roll your own)
- Use the headless APIs when you need custom UI but want the payment logic handled

## Kora (gasless / fee abstraction)
Consider Kora when you need:
- sponsored transactions (user doesn't pay gas)
- users paying fees in tokens other than SOL
- a trusted signing / paymaster component

## UX and security checklist for payments
- Always show recipient + amount + token clearly before signing.
- Protect against replay (use unique references / memoing where appropriate).
- Confirm settlement by querying chain state, not by trusting client-side callbacks.
- Handle partial failures gracefully (transaction sent but not confirmed).
- Provide clear error messages for common failure modes (insufficient balance, rejected signature).
