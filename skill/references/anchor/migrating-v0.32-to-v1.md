---
title: Anchor v0.32 → v1 Migration Guide
description: Step-by-step checklist for upgrading an Anchor program workspace from v0.32.x to v1. Covers dependency bumps, CPI context changes, duplicate mutable account errors, legacy IDL account closure, declare_program! renames, interface-instructions removal, CLI commands, and new v1 features.
---

# Anchor v0.32 → v1 Migration

Full upgrade checklist for an Anchor workspace from v0.32.x to v1. Triage which items apply, then work through them in order.

Items marked **[COMPILE]** will prevent the program from building if not addressed. Items marked **[TS]** affect TypeScript clients. Items marked **[CLI]** affect developer workflow. Items marked **[DEPLOY]** must happen in the right order relative to deployment.

---

## Applying the Migration (order matters)

1. **Audit** — run `cargo check` with bumped deps and collect all errors before fixing anything.
2. **Fix compile errors in order** — deps → CPI context → duplicate accounts → `declare_program!` renames.
3. **`anchor build`** — confirms Rust is clean.
4. **Update TS** — rename package imports, rerun `yarn install` / `npm install`.
5. **Run tests** — `anchor test` (surfpool) or `anchor test -- --features some-feature`.
6. **Just before deploying** — with the v0.32 CLI still installed, close legacy IDL accounts on every cluster (see §5). Upgrading the CLI or deploying the v1 binary first makes this impossible.
7. **Upgrade Anchor CLI to v1**, then **deploy** — `anchor deploy`.
8. **Re-publish IDL** — `anchor idl init` / `anchor idl upgrade`, or use `program-metadata` CLI directly (see §5).

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
- The `cargo update` workarounds for 0.32 (`base64ct --precise 1.6.0`, `constant_time_eq --precise 0.4.1`, `blake3 --precise 1.5.5`) are no longer needed — remove them.
- If you transitively depended on `solana-sdk` for signing, use `solana-signer` directly.

See [compatibility-matrix.md](../compatibility-matrix.md) for the full Anchor v1 ↔ Solana CLI version table.

**`package.json` [TS]:**

```json
// Before
{ "@coral-xyz/anchor": "^0.32.1" }

// After
{ "@anchor-lang/anchor": "^1.0.0" }
```

```typescript
// Before
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { Idl } from "@coral-xyz/anchor/dist/cjs/idl";  // deep import

// After
import * as anchor from "@anchor-lang/anchor";
import { Program, AnchorProvider, BN } from "@anchor-lang/anchor";
import { Idl } from "@anchor-lang/core";  // IDL types from root now
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

---

## 7. Handle IDL external account exclusion [IDL]

External account types (e.g. SPL Token `Mint`, `TokenAccount`) are no longer inlined in the generated IDL. Clients that relied on your IDL to deserialize third-party accounts must now use those programs' own clients.

```typescript
// Before — type came from your program's IDL automatically
const mintAccount = await program.account.mint.fetch(mintAddress);

// After — use the token program's own client
import { getMint } from "@solana/spl-token";
const mintAccount = await getMint(connection, mintAddress);
```

---

## 8. Switch the test runner [CLI]

`anchor test` and `anchor localnet` now use **surfpool** by default.

```toml
# Anchor.toml — opt out to standard validator
[tooling]
validator = "solana"

# Or configure surfpool
[tooling.surfpool]
logs = false
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
  run: cargo install surfpool --version <pinned-version>
```

---

## 9. Remove external `solana` CLI dependency [CLI]

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

## What's New in v1

Worth adopting during migration:

- **`Migration<'info, From, To>`** — safe account schema migrations between layouts.
- **`LazyAccount`** — heap-allocated read-only access, auto-optimized for unit-variant enums and empty arrays.
- **Relaxed seeds syntax** — PDA seeds accept richer Rust expressions beyond literals and `.as_ref()`.
- **`FnMut` event closures** — event listeners now accept `FnMut`, allowing mutable captures.
- **`anchor init` defaults to `multiple` template** — new projects get the multi-program workspace layout by default.
