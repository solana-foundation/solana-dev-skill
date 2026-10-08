---
title: Solana Keychain (Server-Side Signing)
description: Solana Keychain — one signing interface over KMS, Vault, MPC custody, and managed-wallet backends; Kit 8 plugin client setup, production rules, and links to the full docs.
---

# Solana Keychain

Solana Keychain is a Solana Foundation library that gives you one signing interface across key-management backends: AWS KMS, GCP KMS, HashiCorp Vault, Privy, Turnkey, Fireblocks and others. It ships for TypeScript, Rust, Python and Go, at parity. The backend is chosen by config, so you can develop with an in-memory key and switch to a KMS or MPC custodian without rewriting call sites. All four SDKs are audited by OtterSec; the audit covers specific commits, listed in [AUDIT_STATUS.md](https://github.com/solana-foundation/solana-keychain/blob/main/audits/AUDIT_STATUS.md).

## Contents
- [When to use Keychain](#when-to-use-keychain)
- [Packages](#packages)
- [Kit plugin client (TypeScript)](#kit-plugin-client-typescript)
- [Rust, Python, Go](#rust-python-go)
- [Gotchas](#gotchas)
- [Production rules](#production-rules)
- [Full documentation](#full-documentation)

## When to use Keychain

Use Keychain for **server-side** signing: backend services, bots, AI agents with managed wallets, treasury and custodial apps, fee payers (including [Kora](kora.md) nodes), and apps provisioning wallets for their users. It keeps raw keypair files off servers.

Keychain checks the signing hop, not the transaction. It does no simulation, content check or policy enforcement. Validate in your app (and simulate before signing, per the skill's guardrails), or use the provider's policy engine.

## Packages

| Package | Version | Purpose |
|---|---|---|
| `solana-keychain` (crates.io, PyPI) | 2.0.0 | Rust crate with one feature per backend; Python package with extras |
| `@solana/keychain` | 2.0.0 | Umbrella: `createKeychainSigner(config)` plus all backend factories (`createPrivySigner`, …) |
| `@solana/keychain-core` | 2.0.0 | Interfaces, `SignerErrorCode`, capability guards, `signAndSendTransaction` |
| `@solana/keychain-<backend>` | 2.0.0 | One package per backend (`-aws-kms`, `-vault`, `-turnkey`, …). Install only the one you use |
| `@solana/keychain-kit-plugin` | 2.0.0 | `keychainSigner`, `keychainPayer`, `keychainIdentity` Kit client plugins. Peer `@solana/kit >=8.1.0` |

Every TypeScript signer except Crossmint and Fordefi native mode is a Kit `TransactionPartialSigner`. It signs transaction v1 (Fireblocks `useProgramCall: true` is the exception: legacy and v0 only).

## Kit plugin client (TypeScript)

```bash
pnpm add @solana/keychain-kit-plugin @solana/kit @solana/kit-plugin-rpc
```

```ts
import { createClient, lamports } from '@solana/kit';
import { solanaRpc } from '@solana/kit-plugin-rpc';
import { keychainSigner } from '@solana/keychain-kit-plugin';

const rpcUrl = 'https://api.devnet.solana.com';
const client = await createClient()
  .use(keychainSigner({
    backend: 'aws-kms',
    keyId: process.env.KMS_KEY_ID!,
    publicKey: process.env.KMS_PUBLIC_KEY!,  // base58 address of the KMS key
    region: 'us-east-1',
  }))
  .use(solanaRpc({ rpcUrl, transactionConfig: { version: 1, priorityFeeLamports: lamports(5_000n) } }));

await client.sendTransaction([instruction]);
```

- The signer plugin is async and must come before the RPC plugin, the same as every Kit signer plugin. `await` the final client.
- `keychainSigner` sets `payer` and `identity` to the same signer. `keychainPayer` and `keychainIdentity` set one role each and can use different backends, e.g. a KMS fee payer with a Turnkey authority.
- Each plugin creates a new signer when it is applied. To share one signer across clients, create it once and install it with the standard signer plugin: `createClient().use(signer(await createKeychainSigner(config)))`.
- Call `await client.payer.isAvailable()` as a health check before relying on a remote backend.
- Config is a tagged union on `backend`: `memory`, `vault`, `aws-kms`, `gcp-kms`, `privy`, `turnkey`, `fireblocks`, `cdp`, `crossmint`, `dfns`, `openfort`, `para`, `utila`, `fordefi`. The fields for each backend are listed in the [TypeScript guide](https://solana.com/docs/tools/keychain/getting-started/typescript.md).

## Rust, Python, Go

- **Rust:** `cargo add solana-keychain`, with `default-features = false` plus the backend features you need. Pick exactly one of `sdk-v2` (default), `sdk-v3` or `sdk-v4`. Transaction v1 needs `sdk-v4`. Construct with `Signer::from_*` (e.g. `Signer::from_aws_kms(...)`) and reach the capability via `as_transaction_signer()`.
- **Python:** `pip install "solana-keychain[aws-kms]"` (extras for backends that need a provider SDK; `memory`, `vault` and `para` need none). Built on `solders`; unified factory `create_keychain_signer(backend, config)`.
- **Go:** per-backend modules under `github.com/solana-foundation/solana-keychain/go/signers/<backend>/v2`, built on `solana-go` v2.


## Gotchas

- **Crossmint and Fordefi native mode can't be a client `payer` or `identity`.** They rewrite or broadcast server-side, and the Kit plugins reject them at compile time and at runtime (`SIGNER_CONFIG_ERROR`). Create them with `createKeychainSigner()` instead:
  - Crossmint and Fordefi native auto (`chain` set, `pushMode` omitted or `'auto'`) are sending signers. Send with `signAndSendTransactionMessageWithSigners()` from `@solana/signers`.
  - Fordefi native manual (`pushMode: 'manual'`) is a modifying signer. `modifyAndSignTransactions()` returns a rewritten transaction; broadcast that one yourself, never the one you passed in.
- **`SIGNER_BROADCAST_UNCONFIRMED` means the transaction may have landed.** Reconcile with the provider before retrying (`providerMayHaveAccepted(error)` from `@solana/keychain-core`). Resending the byte-identical transaction is safe. A rebuilt transaction with a new blockhash is a second transfer.
- **Not every backend signs messages.** Utila and Crossmint have no `signMessages`, and CDP signs UTF-8 messages only. Narrow with `isSolanaMessageSigner` before calling it.
- **Swapping backends changes call sites only when the shape changes.** Moving to or from Crossmint or Fordefi native mode changes the capability (sending or modifying signer instead of partial signer). Every other swap is config-only.
- **Key rotation means a new address.** The key is the address, so plan rotation as a migration of authorities and funds.

## Production rules

- Separate hot signers (automated, low balance) from cold signers (treasury, MPC or HSM with approvals), and use distinct keys per environment.
- Grant least privilege. AWS KMS needs only `kms:Sign`, `kms:DescribeKey` and `kms:GetPublicKey` on the specific key. Prefer IAM roles over static credentials.
- Load provider secrets from a secret manager or env vars. Never hard-code or commit them, and never log key material.
- Retry sign-only failures with backoff. Don't blindly retry backends that broadcast (see `SIGNER_BROADCAST_UNCONFIRMED`).
- Monitor signing latency and failures, and turn on provider-side audit logs.
- Python and Go cannot zeroize key buffers, so treat process memory as sensitive with the `memory` backend. In Rust, never enable the `unsafe-debug` feature in production.

Full list: [production best practices](https://solana.com/docs/tools/keychain/production-best-practices.md).

## Full documentation

Every page is served as Markdown. Fetch the `.md` URL for details beyond this file.

| Topic | URL |
|---|---|
| Overview | https://solana.com/docs/tools/keychain.md |
| TypeScript (per-backend config, Kit client, capabilities) | https://solana.com/docs/tools/keychain/getting-started/typescript.md |
| Rust | https://solana.com/docs/tools/keychain/getting-started/rust.md |
| Python | https://solana.com/docs/tools/keychain/getting-started/python.md |
| Go | https://solana.com/docs/tools/keychain/getting-started/go.md |
| Choosing a backend | https://solana.com/docs/tools/keychain/choosing-a-backend.md |
| Production best practices | https://solana.com/docs/tools/keychain/production-best-practices.md |
| Signing in production (concepts) | https://solana.com/docs/core/transactions/signing-in-production.md |
| Adding a backend | https://solana.com/docs/tools/keychain/adding-signers.md |
| Source | https://github.com/solana-foundation/solana-keychain |
