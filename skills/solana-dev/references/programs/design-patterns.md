---
title: Program Design Patterns
description: Field-tested Solana program design and code-organization patterns covering state layout, PDA seeds, parallelization, account lifecycle, events, cranks, and Rust/Anchor ergonomics.
---

# Program Design Patterns

Architecture and code-organization guidance for on-chain programs. For vulnerability categories and their preventions, see [../security.md](../security.md); for runtime mechanics (rent, PDAs, wire format), see [../concepts.md](../concepts.md).

## Project & code structure

- **Split the program across files.** Organize into `lib.rs`, `instructions/`, and `state/` instead of one file. Scaffold with `anchor init <NAME> --template multiple`.
- **Prefer simple `has_one` for direct comparisons;** push complex checks into separate validation functions with custom error codes rather than cramming everything into constraints.
- **Write many custom error codes** — one per distinct failure point in constraints/validations/logic — and a test per error path. Coverage of failure modes matters as much as happy-path coverage.
- **Docstrings pull their weight.** `//` for regular comments, `///` for docstrings (markdown-aware). Docstrings surface in the IDL and in editor hovers.
- **Lint regularly:** `cargo clippy --all -- -W clippy::all -W clippy::pedantic`.

### Naming

Bad naming is invisible to the author and painful to every reviewer/auditor. Conventions that pay off:

- **State accounts:** capitalized noun for the object — `User`, `Global`, `Pool`. Avoid bare `Config` (unclear what it configures) — prefer `FeeConfig` / `GlobalConfig`.
- **Instructions: `subject_verb_object`.** Subject = authorized party, verb = action, object = target: `user_withdraw_lp`, `admin_collect_fees`, `public_crank_market` (drop the `public_` prefix if you prefer). Beats bare `withdraw` / `crank`, which hide who can call and on what.
- **Input account vars:** descriptive — `authority`, `payer` (only when they pay rent/fees), `mint` (not `token`). **Never `owner`** — it's ambiguous every time.
- **Fields:** encode type/unit in the name — `fee_bps`, `fee_lamports`, `locked_fee_amount` (not `locked`). Consider newtypes over bare `u64` (see ergonomics).
- **Enum variants:** each variant should convey its full meaning — `State::Voting` (implies proposed + voting ongoing) beats `State::Live` (ambiguous: live-voting or live-approved?).

## State design & account layout

- **Global state account with an operating-level enum** (normal / halted / withdraws-only / limited). This is your kill switch and your graceful-degradation path — design it in from day one.
- **Add reserved padding to account structs** (`_reserved: [u8; N]`) so you can add fields later without breaking layout. Backwards-compatible upgrades depend on it.
- **Fixed-size fields first, variable-size last.** Keeps static offsets stable for `getProgramAccounts` / `memcmp` filters and partial reads.
- **Invariant functions on state**, called at instruction end, that assert the new state is valid before the tx commits (e.g. "vault solvency holds").
- **Dynamic (before/after) assertions.** Snapshot key values at instruction start and end and assert the delta is within expectations (e.g. "user deposits never decrease").
- **Custom traits on account structs** to share authorization/validation logic across instructions and cut duplication.
- **Nested account sub-structs** inside your `Accounts` struct (e.g. group `global + admin_signer`) so shared constraints are written once, not copy-pasted.

```rust
#[account]
pub struct Pool {
    // Fixed-size fields first so `memcmp` offsets stay stable across upgrades.
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
    // Space claimed up front so later fields can be added without a layout break.
    pub _reserved: [u8; 64],
    // Variable-size fields last.
    pub participants: Vec<Pubkey>,
}
```

### Explicit state machines

Whenever a program has phases (launch: `Initialized → Collecting → Launched | Failed`; proposal: `Draft → Voting → Executed`), model them as an **enum**, not as ad-hoc checks over timestamps and balances (that path is where state bugs breed).

- Define **state-transition methods as `impl`s on the enum** — each performs the transition only if all conditions hold, then returns the next state.
- Rust enum variants can **carry data**: `Launched { committed: u64 }` encodes a value that only exists in that state.
- Drive instruction logic with `match` on the state so unhandled transitions are compile-time visible. Pedantic use of this pattern closes most "unclear state" bug classes.

```rust
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum LaunchState {
    Initialized,
    Collecting { deadline: i64 },
    Launched { committed: u64 },
    Failed,
}

impl LaunchState {
    pub fn finish_collecting(self, now: i64, raised: u64, target: u64) -> Result<Self> {
        match self {
            LaunchState::Collecting { deadline } => {
                require!(now >= deadline, LaunchError::TooEarly);
                Ok(if raised >= target {
                    LaunchState::Launched { committed: raised }
                } else {
                    LaunchState::Failed
                })
            }
            // Every other state is a rejected transition, visible at compile time.
            _ => err!(LaunchError::InvalidTransition),
        }
    }
}
```

## PDA seed conventions

- **Seed pattern:** static string + separator + pubkeys + numeric IDs, e.g. `["pool:", mint.key()]`. Avoid variable-length strings anywhere but the very end.
- **`Option` gotcha (Anchor):** Anchor encodes `Option<Account>` using the *program's own ID* as `None`. Consequence: you cannot register the currently-executing program as a `Some` optional account.
- **Validation of PDAs:** always validate the PDA's owning program's ID against the expected program's ID (e.g., your program's ID).

## Performance, compute & transaction size

- **Parallelization is a design constraint, not an afterthought.** Solana runs txns that only *read* a shared account in parallel but *serializes* any that *write* it. Hot write-locked accounts (fee treasuries, shared pools, global counters) are throughput chokepoints — **shard them** using an identifier derived from pubkey bytes, and reconcile shards out-of-band.
- **Reach for zero-copy when an account is large or hot** (deserialization cost dominates) and for **`LazyAccount`** when an instruction needs one field out of a big struct. Syntax and code for both: [anchor.md](anchor.md).
- **Benchmark CU** with `sol_log_compute_units()` or the `compute_fn!` macro to find expensive instructions, then set the limit from simulation. Client-side instructions: [../kit/programs/compute-budget.md](../kit/programs/compute-budget.md).
- **Address Lookup Tables (ALTs):** the ~1,232-byte tx limit caps a legacy transaction near ~30 addresses; an ALT stores up to 256 addresses on-chain and a v0 transaction references each by a 1-byte index instead of a 32-byte pubkey. This buys transaction *size*, not more accounts — the 64 account-locks-per-transaction cap still applies. Note that `v1` transactions ([SIMD-0385](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0385-transaction-v1.md)) **cannot use ALTs at all**, and do not need to: 4096 bytes fits all 64 addresses inline at 32 bytes each. If you are reaching for an ALT purely to fit under 1232 bytes, v1 is the better answer once it activates — see [transactions-v1.md](../transactions-v1.md).
- **Stack (4KB) / heap (32KB) discipline:** `Box<>` accounts onto the heap, split functions to get fresh stack frames, lean on `remaining_accounts`, or go zero-copy. The default bump allocator never frees; for larger programs implement a `#[global_allocator]`.
- **Budget CU as a transaction-wide resource, not a per-instruction one** — see the table below for the exact model. The design consequence: batching instructions into one transaction spends from a shared, capped pool, so a "just add another instruction" refactor can push an already-tight transaction over the ceiling.
- **CU fluctuates for the same instruction**, usually due to PDA bump search: `find_program_address` retries bumps until it finds an off-curve one, so cost varies. Store the canonical bump and validate with `create_program_address` to avoid the search on the hot path.
- **Drop to C or assembly for hot paths.** Anchor is bloated in size and CU; native/Pinocchio, hand-written C (official `solana_sdk.h` examples exist), or sBPF assembly (deanmlittle's `sbpf`) produce tiny, fast programs. You can also keep Rust and optimize critical functions with inline asm.

### CPI limits (reference)

Design around these when composing programs:

| Limit | Value |
|-------|-------|
| CPI call depth | 4 (A→B→C→D, no further) |
| Instruction trace length per transaction | 64 (top-level instructions + every CPI) |
| Account locks per transaction | 64 |
| Account size growth per instruction | +10,240 bytes (`MAX_PERMITTED_DATA_INCREASE`) |
| Signer seeds per PDA | 16 seeds, ≤32 bytes each |
| Transaction CU limit | 200k × non-ComputeBudget instruction count, capped at 1.4M; `SetComputeUnitLimit` overrides with one tx-wide value |

Also: the callee program and every account it touches must appear at the top level of the transaction (ALTs help pack them). Self-reentrancy (A→A) is allowed; A→B→A is blocked by the runtime. When doing direct lamport changes before a CPI, include **all** changed-lamport accounts in the CPI (or none) or the runtime's balance check fails.

## Account lifecycle & size

- **10MB account max.** A single instruction can grow any account by at most 10,240 bytes (`MAX_PERMITTED_DATA_INCREASE`) — this is per instruction, top-level and CPI alike, so repeated CPIs within one instruction do not each get a fresh allowance. Realloc across successive instructions or transactions to reach larger sizes, or use keypair accounts with `#[account(zero)]`.
- **Close accounts properly** (Anchor `close` constraint): zero data, assign to system program, realloc to 0. Don't just zero lamports (see revival attacks in [../security.md](../security.md)).
- **Manual account creation** to dodge the `create_account` griefing footgun: `allocate` + `transfer` rent + `assign`, rather than `create_account` (which anyone can block by pre-funding 1 lamport).

## Events, logging & monitoring

- **Emit events, don't rely on string logs.** Use `emit_cpi!` (noop-program CPI) rather than syscall logging — call-data isn't truncated and is cheap. Never parse logs for critical data (they can be injected/spoofed — see [../security.md](../security.md)).
- **Event sequence numbers:** increment a counter on an account per event so indexers can detect skipped/reordered events beyond timestamp sorting.
- **Monitoring:** poll accounts on an interval using the program's IDL; watch instruction calls, account state, TVL, fees, and events.

## Access control & multi-program design

- **Separate payer and authority.** Let the fee-paying signer differ from the authorizing signer — improves composability when a PDA can't fund itself.
- **Whitelisting options:** NFT gating (check `amount == 1`), whitelist PDAs seeded by user address, merkle proofs, or a `Vec<Pubkey>`. Pick per scale.
- **Multi-program architecture** for privilege separation and independent upgrades — mind the 4-level CPI depth limit and the 64-instruction trace length.
- **Counterparty risk on external programs:** prefer non-upgradeable dependencies; when calling upgradeable programs, pass the minimum privileges (read-only accounts where possible).

## Operational patterns

- **Permissionless cranks** to advance state (price updates, settlement, liquidations). Always red-team them: what can a malicious cranker do? Can they sandwich? Do the incentives to crank actually align?
- **Multisig authorities** using `floor(m/2)+1 / m` (2/3, 3/4, 4/6). Avoid `1/m` (single point) and `m/m` (liveness risk).
- **Incident plan on file:** key contacts, predefined responsibilities, pause mechanisms wired to the state enum above, and pre-written community messages.

## Rust / Anchor ergonomics

- **Block scopes `{}`** to bound borrow lifetimes and release borrows early — resolves mutable/immutable borrow conflicts without cloning.
- **Don't modify lamports directly before a CPI** — it trips the "sum of account balances before and after do not match" runtime check. Move lamport changes after CPIs, or include the changed accounts in every CPI.
- **Redundant checks cost CU:** double-checking a relationship via both seeds and `has_one` on immutable fields wastes CU — pick one (though deliberate redundancy can be a safety choice).
- **`fallback` function** to handle unmatched instruction discriminators:
  `pub fn fallback(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {}`
- **Newtypes for type safety on `u64`.** A bare `u64` is used for lamports, token amounts, slots — easy to cross wires. `type Lamports = u64;` does *not* enforce anything; use a wrapper struct and hang domain methods on it so amounts can't be intermixed by accident:

  ```rust
  #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
  pub struct Lamports(pub u64);

  #[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
  pub struct TokenAmount(pub u64);

  impl Lamports {
      pub fn apply_fee(self, fee_bps: u16) -> Result<Self> {
          let fee = (self.0 as u128)
              .checked_mul(fee_bps as u128)
              .and_then(|v| v.checked_div(10_000))
              .ok_or(ErrorCode::MathOverflow)?;
          Ok(Lamports(self.0.checked_sub(fee as u64).ok_or(ErrorCode::MathOverflow)?))
      }
  }

  // Passing a TokenAmount where Lamports is expected is now a compile error.
  ```
- **Understand the Context lifetimes (`'a, 'b, 'c, 'info`).** They're relative lifetimes on `Context`'s reference fields (`program_id`, `accounts`, `remaining_accounts`). A bound like `'c: 'info` means "`'c` lives at least as long as `'info`" — the `remaining_accounts` reference can't outlive the `AccountInfo` data it points into. `'info` is the same lifetime used across your `#[derive(Accounts)]` struct.
- **Write your own macros to kill copy-paste bugs.** Repeated fee math / token transfers / safe-math copied 10× is where copy-paste bugs live. A single macro (declarative, derive, or attribute — e.g. an `admin_only` constraint, a CU-logging wrapper, an account-size derive) gives you one sound implementation to reuse. Auditors: `cargo expand` rolls macros out to real code for review.

## Vault topology

- **Unified vault** (one global PDA for all deposits): simple TVL, but concentrates risk and creates a write-lock chokepoint.
- **Multi-vault** (per-pool or per-user): isolates risk and parallelizes writes, at the cost of more complex TVL aggregation and higher rent costs. The right choice depends on your parallelism and risk-isolation needs.

## In-transaction credit (flashloan pattern)

Flashloans — and any "extend value now, guarantee repayment within the same transaction" primitive — are enforced with **transaction introspection** via the Instructions sysvar, not CPIs.

- Implement two separately-called instructions (`borrow` / `repay`), not a CPI wrapper. (CPI flashloans exist but hit the depth-4 limit and programs that forbid being CPI'd.)
- In `borrow`, pass the **Instructions sysvar** and introspect the transaction: assert `borrow` itself is **not** invoked via CPI, then scan forward to the **next** call to your program and assert it's `repay` for the **same** loan account (check the discriminator).
- `repay` must also forbid being called via CPI.
- This enforces strict `borrow → use → repay` and blocks `borrow-borrow-repay`, `borrow-…-change-settings-…-repay`, and similar interleavings. The next interaction with your program after `borrow` must be the matching `repay`.

The same introspection technique generalizes to any mechanism that must guarantee a settlement/repayment instruction lands later in the same transaction.
