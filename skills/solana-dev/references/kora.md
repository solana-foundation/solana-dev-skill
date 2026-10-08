---
title: Kora (Gasless Transactions / Fee Sponsorship)
description: Kora paymaster — when to use it, operator quick start, security controls, and links to the full docs.
---

# Kora

Kora is the Solana Foundation paymaster: a Rust JSON-RPC 2.0 server that validates a user-signed transaction against operator policy, co-signs it as fee payer, and optionally broadcasts it. Users pay fees in an SPL token (USDC, the app's own token) or nothing at all.

Two audiences:
- **App developers** call a Kora endpoint from `@solana/kora` (TypeScript SDK).
- **Operators** run `kora-cli` (or use a hosted provider) and keep the fee payer funded with SOL.

## Contents
- [When to use Kora](#when-to-use-kora)
- [Operator quick start](#operator-quick-start)
- [Security checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)
- [Full documentation](#full-documentation)

## When to use Kora

Reach for Kora when:
- users should transact without holding SOL (gasless, sponsored fees)
- users pay fees in an SPL token instead of SOL
- a fee payer has to co-sign transactions built by untrusted clients, so it needs policy checks (allowed programs, spend limits, auth, rate limits)


## Operator quick start

```bash
cargo install kora-cli                                    # stable; kora-cli@2.2.0-beta.8 for beta
kora --config kora.toml config validate                   # prints warnings for risky policies
kora --config kora.toml --rpc-url "$RPC_URL" rpc initialize-atas --signers-config signers.toml
kora --config kora.toml --rpc-url "$RPC_URL" rpc start --signers-config signers.toml
```

- `--config` and `--rpc-url` are global flags, so they go before the subcommand. `rpc start` takes `--port` (default 8080), `--api-key` / `KORA_API_KEY` and `--hmac-secret` / `KORA_HMAC_SECRET`.
- Run `initialize-atas` before accepting token payments. The payment address needs an ATA for every mint in `allowed_spl_paid_tokens`.
- `kora.toml` needs `[kora]` and `[validation]`. Unknown keys fail startup. Fields under `[validation]` with no default: `max_allowed_lamports`, `max_signatures`, `allowed_programs`, `allowed_tokens`, `allowed_spl_paid_tokens`, `disallowed_accounts`, `price_source`.
- `price_source = "Jupiter"` requires `JUPITER_API_KEY`. `"Mock"` is for local development only.
- Pricing (`[validation.price]`): `margin` (the default), `fixed`, or `free`.
- `signers.toml` defines a signer pool (`round_robin`, `random`, `weighted`). Kora's signers are built on [Solana Keychain](keychain.md). Use a memory key from an env var in development, and a KMS or managed-wallet backend in production.
- Docker image: `ghcr.io/solana-foundation/kora` (`:latest`, `:beta`, `:v<version>`).
- Hosted providers: [providers](https://solana.com/docs/tools/kora/providers.md).

Full configuration reference: [operators/configuration](https://solana.com/docs/tools/kora/operators/configuration.md).

## Security checklist

- **Require auth.** An unauthenticated node lets anyone spend its SOL. Use API key (`x-api-key`) or HMAC authentication. `apiKey` and `hmacSecret` passed to the SDK in a browser bundle are public. Proxy those calls through your backend, or pair public clients with reCAPTCHA and usage limits (beta).
- **Lock the fee payer policy with `fixed` or `free` pricing.** Those modes don't charge for fee-payer outflow. Set `allow_transfer`, `allow_create_account` and `allow_allocate` to `false` under `[validation.fee_payer_policy.system]`. Set `allow_withdraw = false` under `.system.nonce`. Set `allow_transfer`, `allow_burn`, `allow_close_account`, `allow_mint_to` and `allow_initialize_account` to `false` under `.spl_token` and `.token_2022`. `margin` pricing includes outflow in the fee.
- **Never copy the repo-root `kora.toml` to production.** It is an example config that enables almost every fee-payer permission.
- **Narrow the allowlists.** `allowed_programs = "All"` and `allowed_spl_paid_tokens = "All"` are accepted but widen the attack surface. Keep `max_allowed_lamports` low.
- **Leave `allow_durable_transactions` off.** It defaults to `false`. Combined with dynamic pricing, durable nonces let users sign at one price and land at another.
- **Monitor the node.** Prometheus metrics come from `[metrics]`. Alert on fee-payer balance and unusual outflow.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Transaction validation fails | Program or token not in `allowed_programs` / `allowed_tokens` / `allowed_spl_paid_tokens`, or limits exceeded | Check the node's `getConfig()` and adjust the transaction or the config |
| Version rejected | v1 transaction sent to a released server | Build v0 |
| Payment instruction fails | Missing ATA on the payment address, or stale blockhash | Operator runs `rpc initialize-atas`; client rebuilds with a fresh blockhash |
| Signature verification fails | User did not sign the final transaction, or the transaction changed after signing | Sign the exact transaction you submit. If the node appends a Lighthouse assertion (beta, `signTransaction`), re-sign the returned transaction |
| HTTP 401 | Missing or wrong `x-api-key` / HMAC headers | See [authentication](https://solana.com/docs/tools/kora/operators/authentication.md) |

## Full documentation

Every page is served as Markdown. Fetch the `.md` URL for details beyond this file.

| Topic | URL |
|---|---|
| Overview | https://solana.com/docs/tools/kora.md |
| Fee abstraction (concepts, when to sponsor) | https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction.md |
| Quick start | https://solana.com/docs/tools/kora/getting-started/quick-start.md |
| Kit client guide | https://solana.com/docs/tools/kora/guides/kit-client.md |
| Full demo (manual flow) | https://solana.com/docs/tools/kora/guides/full-demo.md |
| JSON-RPC API | https://solana.com/docs/tools/kora/json-rpc-api.md |
| Operator configuration | https://solana.com/docs/tools/kora/operators/configuration.md |
| Fees and pricing | https://solana.com/docs/tools/kora/operators/fees.md |
| Signers | https://solana.com/docs/tools/kora/operators/signers.md |
| Authentication | https://solana.com/docs/tools/kora/operators/authentication.md |
| CLI | https://solana.com/docs/tools/kora/operators/cli.md |
| Beta (bundles, Jito, usage limits) | https://solana.com/docs/tools/kora/beta.md |
| x402 facilitator with Kora | https://solana.com/docs/tools/kora/guides/x402.md |
| Source | https://github.com/solana-foundation/kora |
