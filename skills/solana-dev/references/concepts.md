---
title: Solana Runtime Concepts
description: How Solana's runtime actually works — rent as a deposit, Ed25519 keys and off-curve PDAs, entrypoint dispatch, on-chain cryptography, and the transaction wire format.
---

# Solana Runtime Concepts

Load-bearing mechanics to reach for when explaining *why* Solana behaves the way it does. For applying these in program architecture, see [programs/design-patterns.md](programs/design-patterns.md).

## Rent

Rent is a **fully-redeemable deposit**, not a recurring charge. The "rent" on an account is the rent-exempt minimum (≈2 years of storage at the historical rate); since the *Disable rent fees collection* feature, no ongoing rent is charged and any transaction creating a non-exempt account fails outright. The full deposit comes back when the account is closed.

```bash
solana rent 165   # lamports needed to make a 165-byte account rent-exempt
```

## Keys and off-curve PDAs

Solana uses Ed25519. A private key is a secret scalar `k`; the public key is `k·P`, a point on the curve — cheap to compute forward, infeasible to invert.

**PDAs are addresses deliberately placed *off* the curve.** No scalar maps to them, so they have no private key and can never be signed for by a keypair. Only the owning program can authorize them, by supplying the seeds. That is the whole basis of program-controlled accounts.

`find_program_address` hashes the seeds plus a bump byte and retries decreasing bumps until the result lands off-curve — which is why its compute cost varies. Store the canonical bump and use `create_program_address` on the hot path.

Visual primer on the underlying math: https://curves.xargs.org

## Entrypoint dispatch

The runtime does **not** use the ELF entrypoint. It calls the function registered under key `0x71E3CF81` — the murmur3 hash of `"entrypoint"`. Pull dependency programs in with the `no-entrypoint` feature so your binary doesn't define two:

```toml
[dependencies]
some-program = { version = "1.0", features = ["no-entrypoint"] }
```

## On-chain cryptography

Available and reasonably cheap, which is what makes bridges, hardware-key auth, and on-chain proof verification practical:

| Surface | What it covers |
|---------|----------------|
| `Ed25519SigVerify…` native program | Ed25519 signature verification |
| `KeccakSecp256k…` native program | ECDSA over secp256k1 — Ethereum/Bitcoin interop |
| `Secp256r1SigVerify…` native program | secp256r1 (P-256) — passkeys and hardware keys |
| Syscalls | sha256, keccak256, blake3, poseidon, `secp256k1_recover`, alt_bn128 ops (ZK), big-mod-exp |

## Transaction wire format

A transaction is a short-vec of 64-byte signatures followed by a message. A legacy message packs:

1. A 3-byte header whose offsets quarter the account list into writable/read-only × signer/non-signer
2. The account-address short-vec
3. A recent blockhash
4. An instruction short-vec — each instruction stores a program-id **index**, account **indexes**, and its data

Two consequences that drive design:

- **Writability and signer status are properties of an account across the entire transaction**, not per instruction. An account writable for one instruction is write-locked for the whole transaction.
- **Reusing an account already present in the message costs ~1 byte** in a later instruction, since only its index is stored. Packing more instructions over the same account set is nearly free on size.

### v1 reorders the envelope

`v1` ([SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md)) moves the signature vector to the **tail** so the version byte sits at offset zero of the serialized transaction — infrastructure identifies the format with a single byte read, no deserialization. A v1 transaction starts with `129` (`0x81`).

Legacy and v0 put signatures first, so they start with a signature *count* instead; `0x80` is the v0 prefix on the **message**, not on the transaction.

The four compute-budget values also move out of `ComputeBudgetProgram` instructions and into a message-level config: a `u32` bitmask at a fixed offset plus a positional value list holding only the fields the mask marks present. The values sit after the address array, so reaching them costs a length read and a popcount — but not a deserialization and scan of the instruction list, which is what pricing a v0 transaction requires. That is what makes the 4096-byte size limit affordable. See [transactions-v1.md](transactions-v1.md).
