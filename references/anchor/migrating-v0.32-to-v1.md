---
title: Anchor v0.32 → v1 Migration Guide
description: Step-by-step checklist for upgrading an Anchor program workspace from v0.32.x to v1. Covers dependency bumps, CPI context changes, duplicate mutable account errors, legacy IDL account closure, declare_program! renames, interface-instructions removal, CLI commands, and new v1 features.
---

# Anchor v0.32 → v1 Migration

Full upgrade checklist for an Anchor workspace from v0.32.x to v1. Triage which items apply, then work through them in order.

Items marked **[COMPILE]** will prevent the program from building if not addressed. Items marked **[TS]** affect TypeScript clients. Items marked **[CLI]** affect developer workflow. Items marked **[DEPLOY]** must happen in the right order relative to deployment. Items marked **[CLIENT]** affect the Rust `anchor-client` crate.

---

## Applying the Migration (order matters)

IDL housekeeping and the program code upgrade are **independent tracks** that can be done in parallel, but have one hard constraint: legacy IDL accounts must be closed with the **v0.32 CLI before deploying v1**.

### Before deploying v1 (old program still live)

A1. **Re-publish IDL to the new v1 location** *(v1 CLI)* — `anchor idl init` / `anchor idl upgrade`, or use `program-metadata` CLI directly (see §5).
A2. **Update and publish clients** — update any clients that fetch the on-chain IDL to read from the new v1 location, then deploy them.
A3. **Close legacy IDL accounts** *(v0.32 CLI)* on every cluster (see §5). Deploying the v1 binary or upgrading the CLI first makes this impossible.
> **Client notice:** for minimal downtime, follow this order — new IDL first, then clients, then close legacy accounts. Clients depending on the old location will continue to work until A3.

### Program code upgrade (requires v1 CLI)

0. **Update toolchain** — bring Anchor CLI, AVM, and Solana CLI to the required versions first (see §0).
1. **Audit** — run `cargo check` with bumped deps and collect all errors before fixing anything.
2. **Fix compile errors in order** — deps → CPI context → duplicate accounts → `declare_program!` renames → multiple `#[error_code]` blocks → `Context` lifetime annotations.
3. **`anchor build`** — confirms Rust is clean.
4. **Update TS** — rename package imports, rerun `yarn install` / `npm install`.
5. **Run tests** — `anchor test` (surfpool) or `anchor test -- --features some-feature`.
6. **Deploy** — `anchor deploy`.

---

## 0. Check and update toolchain [CLI]

Verify your current versions before touching any code:

```bash
anchor --version   # target: 1.0.0
avm --version
solana --version   # recommended: 3.1.10
rustc --version    # must support edition 2021; 1.75+ recommended
```

**Update AVM and Anchor CLI:**

If your current `avm` supports `self-update`:
```bash
avm self-update
avm install 1.0.0
avm use 1.0.0
```

Otherwise bootstrap via `cargo`:
```bash
cargo install avm --git https://github.com/solana-foundation/anchor --tag v1.0.0 --locked
avm install 1.0.0
avm use 1.0.0
```

**Without AVM** — install `anchor-cli` directly:
```bash
cargo install --git https://github.com/solana-foundation/anchor --tag v1.0.0 anchor-cli --locked
```

**Update Solana CLI** (if below 3.x):
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v3.1.10/install)"
solana --version   # confirm 3.1.10
```

---

## 1. Update dependencies [COMPILE]

**`Cargo.toml` (workspace root and program crate):**

```toml
# Before
anchor-lang = "0.32.1"
anchor-spl  = "0.32.1"
solana-program = "2"

# After
anchor-lang = "1.0.0"
anchor-spl  = "1.0.0"
solana-program = "^3"   # and any other solana-* crate that appears directly
```

- All `solana-*` crates that appear in `[dependencies]` must be `^3` or higher.

**Add `resolver = "2"` to the workspace root `Cargo.toml`:**

```toml
[workspace]
members = ["programs/*"]
resolver = "2"          # required for edition 2021 members
```

Without `resolver = "2"`, Cargo uses the v1 feature resolver, which unifies features across all targets. This causes spurious dependency conflicts and unexpected feature activation when mixing Solana/Anchor crates — manifesting as duplicate type errors or missing trait implementations that disappear once the resolver is set correctly. Any workspace containing at least one `edition = "2021"` crate should have this set.
- The `cargo update` workarounds for 0.32 (`base64ct --precise 1.6.0`, `constant_time_eq --precise 0.4.1`, `blake3 --precise 1.5.5`) are no longer needed — remove them.
- If you transitively depended on `solana-sdk` for signing, use `solana-signer` directly.

See [compatibility-matrix.md](../compatibility-matrix.md) for the full Anchor v1 ↔ Solana CLI version table.

**Dev dependencies — `litesvm` / `anchor-litesvm`:**

When you bump `solana-*` crates to `^3`, also bump `litesvm` in `[dev-dependencies]`. The correct version depends on which minor series of the granular `solana-*` crates your workspace resolves to:

| litesvm | Solana granular crates era | Key markers |
|---------|---------------------------|-------------|
| `0.8.2` | `~3.0` | `solana-hash ~3.0`, `solana-vote-interface 4.0`, `solana-system-interface 2.0` |
| `0.9.1` | `~3.1`–`~3.3` | `solana-hash 4.0`, `solana-vote-interface 5.0`, `solana-system-interface 3.0` |
| `>0.10.0` | `3.3+` | follow latest releases when on cutting-edge solana-* deps |

```toml
# [dev-dependencies] — pick the row that matches your solana-* versions
litesvm = "0.8.2"   # solana-* ~3.0
# litesvm = "0.9.1"  # solana-* ~3.1–3.3 (solana-hash 4.0, solana-vote-interface 5.0)

# If using the Anchor wrapper:
anchor-litesvm = "0.3"   # requires anchor-lang ^1.0.0 and litesvm ^0.8.2
```

> **Tip:** run `cargo tree -d` after bumping — a duplicate `solana-*` in the dependency tree at two incompatible minor versions is the most common sign you've picked the wrong `litesvm` version.

**`package.json` [TS] — full package rename table:**

| Before (`@coral-xyz/…`) | After (`@anchor-lang/…`) |
|-------------------------|--------------------------|
| `@coral-xyz/anchor` | `@anchor-lang/core` |
| `@coral-xyz/spl-token` | `@anchor-lang/spl-token` |
| `@coral-xyz/anchor-errors` | `@anchor-lang/errors` |
| `@coral-xyz/borsh` | `@anchor-lang/borsh` |
| `@coral-xyz/anchor-cli` | `@anchor-lang/cli` |

```json
// Before
{
  "@coral-xyz/anchor": "^0.32.1",
  "@coral-xyz/spl-token": "^0.32.1"
}

// After
{
  "@anchor-lang/core": "^1.0.0",
  "@anchor-lang/spl-token": "^1.0.0"
}
```

```typescript
// Before
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Idl } from "@coral-xyz/anchor/dist/cjs/idl";  // deep import

// After
import * as anchor from "@anchor-lang/core";
import { Program, AnchorProvider, BN } from "@anchor-lang/core";
import { Idl } from "@anchor-lang/core";  // IDL types live at root now
```

Find all occurrences:
```bash
grep -r "@coral-xyz" --include="*.ts" --include="*.js" --include="package.json" .
grep -r "dist/cjs/idl" --include="*.ts" --include="*.js" .
```

---

## 2. Fix CPI context construction [COMPILE]

`CpiContext::new` and `CpiContext::new_with_signer` no longer accept a program `AccountInfo` as the first argument. Pass the program's **`Pubkey`** (program ID) directly instead. Remove the program account from the accounts struct.

```rust
// Before (v0.32)
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,  // <-- needed to pass AccountInfo
}

pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)
}

// After (v1) — program ID as first argument; program field removed from struct
#[derive(Accounts)]
pub struct TransferTokens<'info> {
    #[account(mut)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub authority: Signer<'info>,
    // token_program no longer needed for CPI
}

pub fn transfer_tokens(ctx: Context<TransferTokens>, amount: u64) -> Result<()> {
    let cpi_accounts = Transfer {
        from: ctx.accounts.from.to_account_info(),
        to: ctx.accounts.to.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(Token::id(), cpi_accounts);
    token::transfer(cpi_ctx, amount)
}

// PDA-signed CPI
// Before
let cpi_ctx = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds);
// After
let cpi_ctx = CpiContext::new_with_signer(Token::id(), cpi_accounts, signer_seeds);
```

Well-known IDs: `Token::id()`, `System::id()`, `system_program::ID`. For external programs declared with `declare_program!`, use `my_program::ID`.

---

## 3. Resolve duplicate mutable account errors [COMPILE]

Anchor now rejects instructions where the same account appears more than once as mutable.

```
error: duplicate mutable account `vault` — use `dup` constraint if intentional
```

**Option A — prevent aliasing with a constraint (accidental duplication):**
```rust
#[account(
    mut,
    constraint = token_b.key() != token_a.key() @ MyError::SameAccount
)]
pub token_b: Account<'info, TokenAccount>,
```

**Option B — allow intentional duplication:**
```rust
#[account(mut, dup)]
pub destination: Account<'info, TokenAccount>,
```

Checked types: `Account`, `LazyAccount`, `InterfaceAccount`, `Migration`. Read-only types and `UncheckedAccount` are not checked. Accounts under `init_if_needed` are now included in the check.

---

## 4. Update `declare_program!` usages [COMPILE]

**Rename `utils` module to `parsers`:**
```rust
// Before
use my_external_program::utils::*;
use my_external_program::utils::parse_instruction;

// After
use my_external_program::parsers::*;
use my_external_program::parsers::parse_instruction;
```

```bash
grep -r "::utils::" --include="*.rs" .
```

**Remove `interface-instructions` feature and `#[interface]` attribute:**

The feature and attribute are gone. Use `#[instruction(discriminator = <const>)]` instead.

```toml
# Before (Cargo.toml)
anchor-lang = { version = "0.32.1", features = ["interface-instructions"] }

# After — feature removed entirely
anchor-lang = "1.0.0"
```

```rust
// Before
#[interface(spl_transfer_hook_interface::execute)]
pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> { Ok(()) }

// After — use the interface crate's discriminator constant directly
#[instruction(discriminator = spl_transfer_hook_interface::instruction::ExecuteInstruction::SPL_DISCRIMINATOR)]
pub fn transfer_hook(ctx: Context<TransferHook>, amount: u64) -> Result<()> { Ok(()) }
```

---

## 5. Close legacy IDL accounts and re-publish [DEPLOY]

> **⚠️ Do this just before deploying the v1 binary.** Once a v1 binary is live, the legacy IDL instructions are gone — rent in those accounts becomes permanently inaccessible.

**Step 1 — close the legacy IDL account on every cluster:**

> This must be run with the **Anchor CLI v0.32** while the **v0.32 binary is still deployed**. The v1 CLI's `idl` commands target the Program Metadata program and cannot interact with legacy IDL accounts. Upgrading the CLI before closing means you lose the ability to recover that rent.

```bash
# with anchor-cli 0.32.x still installed
anchor idl close --provider.cluster devnet <PROGRAM_ID>
anchor idl close --provider.cluster mainnet-beta <PROGRAM_ID>
```

**Step 2** — deploy the v1 binary: `anchor deploy`.

**Step 3 — re-publish the IDL via Program Metadata.**

Two options — pick one:

**Option A: Anchor CLI** (resolved from workspace, no program ID needed):
```bash
anchor idl init --filepath target/idl/my_program.json      # first publish
anchor idl upgrade --filepath target/idl/my_program.json   # subsequent updates
```

**Option B: `program-metadata` CLI** (usable immediately after closing, independent of the Anchor CLI and deploy cycle):
```bash
npm install -g @solana-program/program-metadata
program-metadata upload idl target/idl/my_program.json --program-id <PROGRAM_ID>
```

Option B is useful when you want to push an updated IDL without going through a full `anchor deploy`, or when working outside an Anchor workspace. See the [program-metadata README](https://github.com/solana-program/program-metadata) for the full command reference and options.

**What changes in v1:** programs have no `idl_create_buffer`, `idl_write`, `idl_set_buffer` entrypoints. IDL lives in a Program Metadata account managed by a separate on-chain program. Already-deployed v0.32 programs that were not closed retain their legacy IDL account; v1 tooling can read them but cannot manage them.

---

## 6. Update `AccountInfo` usage [WARNING]

Using raw `AccountInfo<'info>` in `#[derive(Accounts)]` now emits a compile-time warning. These are warnings, not errors — migration can be incremental.

| Old | New |
|-----|-----|
| `AccountInfo<'info>` (unknown data) | `UncheckedAccount<'info>` + `/// CHECK:` comment |
| `AccountInfo<'info>` (token account) | `InterfaceAccount<'info, TokenAccount>` |
| `AccountInfo<'info>` (executable program) | `Program<'info, MyProgram>` or `Interface<'info, T>` |

### `UncheckedAccount::clone()` vs `.to_account_info()`

In anchor v1, `.clone()` on `UncheckedAccount<'info>` returns `UncheckedAccount<'info>`, not `AccountInfo<'info>`. Any function or CPI account struct that expects `AccountInfo<'info>` will now fail:

```rust
// Error: mismatched types — expected AccountInfo<'_>, found UncheckedAccount<'_>
let ctx_accounts = MyCpiAccounts {
    some_account: ctx.accounts.some_unchecked.clone(),
    ..
};

// Fix: use .to_account_info() explicitly
let ctx_accounts = MyCpiAccounts {
    some_account: ctx.accounts.some_unchecked.to_account_info(),
    ..
};
```

This commonly surfaces when constructing CPI account structs or calling helper functions that accept `AccountInfo<'info>` directly. Find occurrences:

```bash
grep -rn "\.clone()" --include="*.rs" . | grep "UncheckedAccount\|merkle_tree\|tree_authority"
```

---

## 7. Suppress `unexpected_cfgs` warnings from macros [WARNING]

Anchor and Solana derive macros emit code gated on cfg flags (`anchor-debug`, `custom-heap`, `custom-panic`) that Rust's `unexpected_cfgs` lint doesn't know about. This produces a wall of warnings after a clean build.

**Option A — declare them as features in each program's `[features]`** (more targeted, recommended):

```toml
# programs/my_program/Cargo.toml
[features]
anchor-debug = []
custom-heap = []
custom-panic = []
# keep your existing features — add these alongside them
```

Declaring them as features tells Cargo they are valid cfg values, so the compiler stops warning about them without blanket-suppressing the entire `unexpected_cfgs` lint.

**Option B — suppress workspace-wide via lints** (blunter, but simpler for large workspaces):

```toml
# Cargo.toml (workspace root)
[workspace.lints.rust]
unexpected_cfgs = { level = "allow" }
```

Then opt every program crate into the workspace lints:

```toml
# programs/my_program/Cargo.toml
[lints]
workspace = true
```

> **Note on Option B:** Do not use the `check-cfg` list form (`check-cfg = ['cfg(anchor-debug)', ...]`) — cfg names containing hyphens are rejected by the compiler with `invalid '--check-cfg' argument`. Use `level = "allow"` without the list.

```bash
# find all program Cargo.toml files that still need updating
grep -rL "workspace = true" programs/*/Cargo.toml
```

---

## 8. Handle IDL external account exclusion [IDL]

External account types (e.g. SPL Token `Mint`, `TokenAccount`) are no longer inlined in the generated IDL. Clients that relied on your IDL to deserialize third-party accounts must now use those programs' own clients.

```typescript
// Before — type came from your program's IDL automatically
const mintAccount = await program.account.mint.fetch(mintAddress);

// After — use the token program's own client
import { getMint } from "@solana/spl-token";
const mintAccount = await getMint(connection, mintAddress);
```

---

## 9. Switch the test runner [CLI]

`anchor test` and `anchor localnet` now use **surfpool** by default.

```toml
# Anchor.toml — opt out to standard validator
[tooling]
validator = "solana"

# Or configure surfpool
[surfpool]
startup_wait = 5000
log_level = "info" # default is "none"
block_production_mode = "clock"        # or "transaction"
datasource_rpc_url = "https://api.mainnet-beta.solana.com"  # optional fork
```

Add to `.gitignore`:
```
.surfpool/
```

CI — surfpool must be installed explicitly:
```yaml
- name: Install surfpool
  run: curl -sL https://run.surfpool.run/ | bash
```

---

## 10. Remove external `solana` CLI dependency [CLI]

Anchor no longer shells out to `solana`. Update CI pipelines and scripts.

| Before | After |
|--------|-------|
| `solana address` | `anchor address` |
| `solana balance` | `anchor balance` |
| `solana airdrop` | `anchor airdrop` |
| `solana program deploy` | `anchor deploy` |
| `solana logs` | `anchor logs` |

Keep the `solana` CLI install step only if you use it directly (keypair generation, cluster switching, etc.).

---

## 11. Clean up `Anchor.toml` and removed CLI commands [CLI]

**Remove `[registry]` from `Anchor.toml`:**
```toml
# Before — remove this entire section
[registry]
url = "https://anchor.projectserum.com"
```

**Remove `arch` build options from `Anchor.toml`** (if present — `arch = "sbf"` etc. are no longer recognised):
```bash
grep -n "arch" Anchor.toml
```

**`anchor login` is removed.** Remove it from CI scripts and `Makefile` targets; the `[registry]` section it served is gone.

---

## 12. Disallow multiple `#[error_code]` blocks [COMPILE]

Having more than one `#[error_code]` block in a single program is now a compile-time error. Merge all error enums into one.

```rust
// Before — two separate blocks compiled fine
#[error_code]
pub enum InitError {
    AlreadyInitialized,
}

#[error_code]
pub enum UpdateError {
    InvalidAmount,
}

// After — single merged enum
#[error_code]
pub enum MyProgramError {
    AlreadyInitialized,
    InvalidAmount,
}
```

If you used `offset = N` to avoid code collisions between separate enums, that attribute continues to work on the merged single enum.

```bash
grep -r "#\[error_code\]" --include="*.rs" .
```

---

## 13. Update `Context` lifetime annotations [COMPILE]

`Context` was simplified from four lifetime parameters (`'a, 'b, 'c, 'info`) to one (`'info`). Most programs use `Context<MyAccounts>` without explicit lifetimes and are unaffected. If you annotated the lifetimes explicitly, remove the extra three.

```rust
// Before (v0.32)
pub fn my_handler<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, MyAccounts<'info>>,
) -> Result<()> { ... }

// After (v1)
pub fn my_handler<'info>(ctx: Context<'info, MyAccounts<'info>>) -> Result<()> { ... }
// or simply (when the lifetime is inferred)
pub fn my_handler(ctx: Context<MyAccounts<'_>>) -> Result<()> { ... }
```

```bash
grep -rn "Context<'" --include="*.rs" .
```

---

## 14. Update Borsh 1.x serialization usage [COMPILE]

Anchor v1 depends on **borsh 1.x**, which removed several APIs present in borsh 0.10.

### `try_to_vec()` removed

`BorshSerialize::try_to_vec()` no longer exists. Replace every call with `borsh::to_vec(&value)?`.

```rust
// Before
let data = my_struct.try_to_vec()?;
let hash = hashv(&[metadata.try_to_vec()?.as_slice()]);

// After
let data = borsh::to_vec(&my_struct)?;
let hash = hashv(&[borsh::to_vec(metadata)?.as_slice()]);
```

```bash
grep -rn "try_to_vec" --include="*.rs" .
```

### Enum explicit discriminants conflict with anchor derive macros

In borsh 1.x, enums with explicit integer discriminants require `#[borsh(use_discriminant=true)]`. However, this attribute conflicts with `#[derive(AnchorSerialize, AnchorDeserialize)]`, producing:

```
error: multiple `borsh` attributes not allowed on a single item
error: cannot find attribute `borsh` in this scope
```

**Fix**: If the explicit discriminants match the default ordinal values (0, 1, 2, …), simply remove them. The serialized layout is identical.

```rust
// Before — conflicts with anchor derive macros
#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum MyType {
    Variant1 = 0,
    Variant2 = 1,
}

// After — remove explicit discriminants; borsh ordinal encoding is the same
#[derive(AnchorSerialize, AnchorDeserialize)]
pub enum MyType {
    Variant1,
    Variant2,
}
```

If discriminant values *don't* match ordinal order (e.g., `Foo = 5, Bar = 10`) you must implement borsh serialization manually instead of relying on the derive macro.

```bash
grep -rn " = [0-9]" --include="*.rs" programs/   # find enums with explicit discriminants
```

---

## 15. Update Solana SDK 3.x API changes [COMPILE]

Anchor v1 uses **Solana SDK 3.x**, which has breaking API changes beyond just the version bump.

### `anchor_lang::solana_program` re-export gaps

In anchor v0.31, `anchor_lang::solana_program` re-exported the full `solana-program` crate. In v1 several sub-modules are no longer re-exported:

| Module | Old import | New import |
|--------|-----------|------------|
| `keccak` | `anchor_lang::solana_program::keccak` | `solana_program::keccak` |
| `hash` | `anchor_lang::solana_program::hash` | `solana_program::hash` |
| `ed25519_program` | `anchor_lang::solana_program::ed25519_program` | `solana_program::ed25519_program` |
| `sysvar::instructions` | `anchor_lang::solana_program::sysvar::instructions` | `solana_program::sysvar::instructions` |
| `instruction::Instruction` | `anchor_lang::solana_program::instruction::Instruction` | `solana_program::instruction::Instruction` |
| `program::invoke_signed` | `anchor_lang::solana_program::program::invoke_signed` | `solana_program::program::invoke_signed` |

**`system_instruction` quirk:** `system_instruction` is *not* accessible as `solana_program::system_instruction` in SDK 3.x when you depend on `solana-program` directly — that sub-module was removed from the crate root. However, it is still re-exported by Anchor: `anchor_lang::solana_program::system_instruction` continues to work. Use that path rather than importing from `solana_program` directly.

```rust
// Fails in SDK 3.x with direct solana-program dep
use solana_program::system_instruction;

// Works — Anchor still re-exports it
use anchor_lang::solana_program::system_instruction;
```

**Fix**: Add `solana-program = { workspace = true }` to the program's `Cargo.toml` and import directly from `solana_program`.

```toml
# program/Cargo.toml
[dependencies]
anchor-lang = { workspace = true }
solana-program = { workspace = true }   # add this
```

```rust
// Before
use anchor_lang::{prelude::*, solana_program::keccak};
use anchor_lang::{prelude::*, solana_program::sysvar::instructions::ID as IX_ID};

// After
use anchor_lang::prelude::*;
use solana_program::keccak;
use solana_program::sysvar::instructions::ID as IX_ID;
```

```bash
grep -rn "anchor_lang::solana_program" --include="*.rs" programs/
```

### `AccountInfo::realloc` renamed to `resize`

The `realloc(new_len, zero_init)` method was renamed to `resize(new_len)` in Solana SDK 3.x. The `zero_init` parameter is gone (new space is always zeroed).

```rust
// Before
account_info.realloc(new_len, false)?;
account_info.realloc(0, false).map_err(Into::into)

// After
account_info.resize(new_len)?;
account_info.resize(0).map_err(Into::into)
```

```bash
grep -rn "\.realloc(" --include="*.rs" .
```

### `MAX_PERMITTED_DATA_INCREASE` path change

```rust
// Before
use solana_program::entrypoint::MAX_PERMITTED_DATA_INCREASE;
// or
use anchor_lang::solana_program::entrypoint::MAX_PERMITTED_DATA_INCREASE;

// After
use solana_program::account_info::MAX_PERMITTED_DATA_INCREASE;
```

### `CpiContext::new` takes `Pubkey`, not `AccountInfo`

In anchor v1, the first argument to `CpiContext::new` / `CpiContext::new_with_signer` changed from `AccountInfo` to `Pubkey`.

```rust
// Before
CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts)
CpiContext::new_with_signer(ctx.accounts.system_program.to_account_info(), cpi_accounts, signer_seeds)

// After — pass the program's Pubkey directly
CpiContext::new(System::id(), cpi_accounts)
CpiContext::new_with_signer(System::id(), cpi_accounts, signer_seeds)
// or use the constant
CpiContext::new(system_program::ID, cpi_accounts)
CpiContext::new_with_signer(solana_program::system_program::ID, cpi_accounts, signer_seeds)
```

---

## 16. Audit external program CPI crates [COMPILE]

Any external CPI crate compiled against **anchor 0.31** will produce dozens of trait-bound errors in your workspace because the `AccountDeserialize`, `AccountSerialize`, `Owner`, and `Id` traits changed in anchor v1. Common culprits: `bubblegum-cpi`, `account-compression-cpi`, `tuktuk-program`.

**Symptoms:**
```
error[E0277]: the trait bound `Noop: anchor_lang::Id` is not satisfied
error[E0277]: the trait bound `SplAccountCompression: anchor_lang::Id` is not satisfied
error[E0277]: `Program<'info, T>: anchor_lang::Id` not satisfied
```

### Step 1 — identify affected crates

```bash
cargo tree 2>&1 | grep -E "anchor-lang|anchor-spl" | sort -u
```

Look for any dependency still pulling in `anchor-lang 0.x`. Each such crate needs to be updated before your workspace will compile.

### Step 2 — check for an updated release

For each affected crate, check whether the upstream maintainer has already published an anchor v1-compatible version:

```bash
cargo search <crate-name>
```

Or check the crate's repository for a release or branch targeting anchor v1. If a compatible version exists, bump the version specifier in `Cargo.toml` and you're done.

### Step 3 — update the crate yourself (if you own the repo)

If you control the affected crate in a separate repository, apply the same migration steps from this guide to that crate first (deps, CPI context, borsh, SDK API changes), publish or reference it via a git dep, then return here.

```toml
# Temporary git dep while waiting for a crates.io release
my-cpi-crate = { git = "https://github.com/my-org/my-cpi-crate", branch = "anchor-v1" }
```

### Step 4 (last resort) — vendor the crate locally

If no update is available and you don't control the upstream repo, vendor a minimal local copy. Create a `vendor/` crate that uses `declare_program!` against the program's IDL JSON, add it as a workspace member, and point your workspace dependency to the path.

> **Do not use `[patch]`** for workspace members — cargo will see two versions of the same crate and report `multiple 'crate-name' packages in this workspace`. Use `path = ...` in `[workspace.dependencies]` instead.

Apply the standard anchor v1 fixes to any vendored source (realloc → resize, try_to_vec → borsh::to_vec, CpiContext::new, etc.) as you go.

---

## 17. Migrate `spl-token` / `spl-token-2022` / `spl-associated-token-account` direct dependencies [COMPILE]

`spl-token 7.x`, `spl-token-2022 7.x`, and `spl-associated-token-account 6.x` depend on `solana-program 2.x`. If your program has a direct `[dependencies]` entry for any of these crates, you'll see type mismatches because your workspace uses `solana-program 3.x`:

```
error[E0308]: mismatched types
  expected `Pubkey` (solana-program 3.x)
     found `__Pubkey` (solana-program 2.x, re-exported via spl-token)
```

This also affects any import path through these crates:
```rust
use spl_token::solana_program::instruction::Instruction;   // wrong Instruction type
use spl_token::ID;                                         // wrong Pubkey type
```

### Preferred fix — migrate to the interface crates

The interface crates (`spl-token-interface`, `spl-token-2022-interface`, `spl-associated-token-account-interface`) are slim, solana-program-3.x-compatible crates that expose the IDs, instruction builders, and account types you need without dragging in the old SDK version.

**If you depend on `spl-token`** → migrate to `spl-token-interface 2.0`:

```toml
# Cargo.toml
spl-token-interface = "2.0"   # replaces spl-token = "7.x"
```

```rust
// Before
use spl_token::ID as TOKEN_PROGRAM_ID;
use spl_token::instruction::transfer;

// After
use spl_token_interface::ID as TOKEN_PROGRAM_ID;
use spl_token_interface::instruction::transfer;
```

**If you depend on `spl-token-2022`** → migrate to `spl-token-2022-interface 2.1`:

```toml
# Cargo.toml
spl-token-2022-interface = "2.1"   # replaces spl-token-2022 = "7.x"
```

```rust
// Before
use spl_token_2022::ID as TOKEN_2022_PROGRAM_ID;

// After
use spl_token_2022_interface::ID as TOKEN_2022_PROGRAM_ID;
```

**If you depend on `spl-associated-token-account`** → migrate to `spl-associated-token-account-interface 2.0`:

```toml
# Cargo.toml
spl-associated-token-account-interface = "2.0"   # replaces spl-associated-token-account = "6.x"
```

```rust
// Before
use spl_associated_token_account::ID as ATA_PROGRAM_ID;
use spl_associated_token_account::get_associated_token_address;

// After
use spl_associated_token_account_interface::ID as ATA_PROGRAM_ID;
use spl_associated_token_account_interface::get_associated_token_address;
```

### Fallback — use `anchor_spl` re-exports

If you only need program IDs, ATAs, or account structs and don't call instruction builders directly, `anchor_spl` re-exports compatible versions and requires no extra dependency entry:

```rust
use anchor_spl::token::ID as TOKEN_PROGRAM_ID;
use anchor_spl::token_2022::ID as TOKEN_2022_PROGRAM_ID;
use anchor_spl::associated_token::ID as ATA_PROGRAM_ID;
use anchor_spl::associated_token::get_associated_token_address;
use solana_program::instruction::Instruction;  // not via spl_token
```

```bash
grep -rn "spl_token::\|spl_token_2022::\|spl_associated_token_account::" --include="*.rs" programs/
grep -rn "spl-token\|spl-token-2022\|spl-associated-token-account" --include="Cargo.toml" programs/
```

---

## What's New in v1

Worth adopting during migration:

- **`Migration<'info, From, To>`** — safe account schema migrations between layouts.
- **`LazyAccount`** — heap-allocated read-only access, auto-optimized for unit-variant enums and empty arrays.
- **Relaxed seeds syntax** — PDA seeds accept richer Rust expressions beyond literals and `.as_ref()`.
- **`FnMut` event closures** — event listeners now accept `FnMut`, allowing mutable captures.
- **Generic `Program<'info>`** — usable without a type parameter for executable-only validation when the concrete program type is not statically known: `pub program: Program<'info>`.
- **`declare_program!` without `anchor_lang`** — `anchor_client` alone is now sufficient for client-side `declare_program!` usage; no need to pull in `anchor_lang` as a dependency.
- **Owner re-checked on `.reload()`** — `account.reload()` now re-validates the account owner the same as initial load. Programs that previously reloaded accounts owned by a different program will now error.
- **`common::close` accepts references** — no need to call `.to_account_info()` at every `common::close(...)` call site.
- **`Owners` in prelude** — `anchor_lang::prelude::Owners` is re-exported; remove any manual `use` statement for it.
- **Borsh 1.5.7** — both Rust and TypeScript Borsh implementations upgraded. Ensure your `borsh` entry in `Cargo.toml` is compatible.
- **Lifecycle hooks** — add a `[hooks]` section to `Anchor.toml` to run shell commands at `pre_build`, `post_build`, `pre_test`, `post_test`, `pre_deploy`, `post_deploy`.
