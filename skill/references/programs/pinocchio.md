---
title: Programs with Pinocchio
description: Build high-performance Solana programs with zero-copy techniques and minimal dependencies, without the solana-program overhead.
---

# Programs with Pinocchio

Pinocchio is a minimalist Rust crate for crafting Solana programs without the heavyweight `solana-program` crate. It delivers significant performance gains through zero-copy techniques and minimal dependencies.

## When to Use Pinocchio

Use Pinocchio when you need:

- **Compute efficiency potential**: Can reduce compute units and binary size versus higher-level frameworks, depending on instruction complexity and validation strategy
- **Minimal binary size**: Leaner code paths and smaller deployments
- **Zero external dependencies**: Only Solana SDK types required
- **Fine-grained control**: Direct memory access and byte-level operations
- **no_std environments**: Embedded or constrained contexts

## Core Architecture

### Program Structure Validation Checklist

Before building/deploying, verify lib.rs contains all required components:

- [ ] `entrypoint!(process_instruction)` macro
- [ ] `pub const ID: Address = Address::new_from_array([...])` with correct program ID
- [ ] `fn process_instruction(program_id: &Address, accounts: &mut [AccountView], data: &[u8]) -> ProgramResult`
- [ ] Instruction routing logic with proper discriminators
- [ ] `pub mod instructions; pub use instructions::*;`

### Entrypoint Pattern

```rust
use pinocchio::{
    account::AccountView,
    address::Address,
    entrypoint,
    error::ProgramError,
    ProgramResult,
};

entrypoint!(process_instruction);

fn process_instruction(
    _program_id: &Address,
    accounts: &mut [AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    match instruction_data.split_first() {
        Some((0, data)) => Deposit::try_from((data, accounts))?.process(),
        Some((1, _)) => Withdraw::try_from(accounts)?.process(),
        _ => Err(ProgramError::InvalidInstructionData)
    }
}
```

Single-byte discriminators support 255 instructions; use two bytes for up to 65,535 variants.

### Panic Handler Configuration

**For std environments (SBF builds):**

```rust
entrypoint!(process_instruction);
// entrypoint! already declares default_panic_handler! and default_allocator!
```

**For no_std environments:**

```rust
#![no_std]
program_entrypoint!(process_instruction);
nostd_panic_handler!();
```

**Critical**: Never declare two panic handlers (or two allocators) in the same program — causes a duplicate lang item error. Because `entrypoint!` already declares them, `program_entrypoint!` is the right choice when you need a custom panic handler or allocator.

### Program ID Declaration

```rust
pub const ID: Address = Address::new_from_array([
    // Your 32-byte program ID as bytes
    0xXX, 0xXX, ..., 0xXX,
]);
```

// Note: Use `Address::new_from_array()` not `Address::new()`

### Recommended Import Structure

```rust
use pinocchio::{
    account::AccountView,
    address::Address,
    entrypoint,
    error::ProgramError,
    ProgramResult,
};
// Add CPI imports only when needed:
// cpi::{invoke_signed, Seed, Signer},
// Add system program imports only when needed:
// pinocchio_system::instructions::Transfer,
```


## Utility Macros

Define in `src/utils/macros.rs`:

```rust
// Runtime length check — returns InvalidInstructionData
macro_rules! require_len {
    ($data:expr, $len:expr) => {
        if $data.len() < $len {
            return Err(ProgramError::InvalidInstructionData);
        }
    };
}

// Runtime length check — returns InvalidAccountData
macro_rules! require_account_len {
    ($data:expr, $len:expr) => {
        if $data.len() < $len {
            return Err(ProgramError::InvalidAccountData);
        }
    };
}

// Validates byte 0 matches expected discriminator
macro_rules! validate_discriminator {
    ($data:expr, $disc:expr) => {
        if $data.is_empty() || $data[0] != $disc {
            return Err(ProgramError::InvalidAccountData);
        }
    };
}

// Compile-time: asserts struct size matches expected (catches padding bugs)
macro_rules! assert_no_padding {
    ($t:ty, $expected:expr) => {
        const _: () = assert!(
            core::mem::size_of::<$t>() == $expected,
            "struct size mismatch — check for unexpected padding"
        );
    };
}

assert_no_padding!(Config, 65); // usage example
```

## Traits System

Define these traits once in a shared module (e.g. `src/traits/`) and implement them on all state/instruction types.

### Account byte layout

All PDA accounts follow: `[discriminator: u8 | version: u8 | data...]`

**Important**: Pinocchio uses a 1-byte discriminator. Anchor uses 8 bytes. Don't conflate them.

```rust
pub trait Discriminator {
    const DISCRIMINATOR: u8; // 1 byte, not 8
}

pub trait Versioned {
    const VERSION: u8;
}

// DATA_LEN = size of data payload only (excludes disc + version prefix)
// LEN      = 1 + 1 + DATA_LEN  (total account size)
pub trait AccountSize {
    const DATA_LEN: usize;
    const LEN: usize = 1 + 1 + Self::DATA_LEN;
}

// Zero-copy read: validates byte 0 (disc), skips byte 1 (version), casts &data[2..] to &Self
pub trait AccountDeserialize: Sized + Discriminator + AccountSize {
    fn from_bytes(data: &[u8]) -> Result<&Self, ProgramError> {
        validate_discriminator!(data, Self::DISCRIMINATOR);
        require_account_len!(data, Self::LEN);
        Ok(unsafe { &*(data[2..].as_ptr() as *const Self) })
    }
    fn from_bytes_mut(data: &mut [u8]) -> Result<&mut Self, ProgramError> {
        validate_discriminator!(data, Self::DISCRIMINATOR);
        require_account_len!(data, Self::LEN);
        Ok(unsafe { &mut *(data[2..].as_mut_ptr() as *mut Self) })
    }
}

pub trait AccountSerialize: Discriminator + Versioned {
    fn to_bytes_inner(&self) -> Vec<u8>;
    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = vec![Self::DISCRIMINATOR, Self::VERSION];
        bytes.extend(self.to_bytes_inner());
        bytes
    }
}

// Marker traits — no methods
pub trait InstructionAccounts<'a> {}

// Marker trait for data structs; LEN is the expected byte length of instruction data
pub trait InstructionData<'a>: Sized {
    const LEN: usize;
    // Data structs implement TryFrom<&'a [u8]> separately
}

pub trait PdaSeeds {
    const PREFIX: &'static [u8];
    // Use at initialization to get canonical bump (find loops internally).
    // Implementers build their own fixed-size seed array; the new
    // `Address::derive_*` API takes `&[&[u8]; N]`, not `&[&[u8]]`.
    fn derive_address(&self, program_id: &Address) -> Result<(Address, u8), ProgramError>;
    // Use after initialization when bump is already stored (no bump search loop).
    // Pass the bump only via the `Option<u8>` argument of `Address::derive_address` —
    // do not also include it in the seeds array, or it gets hashed twice.
    fn derive_address_with_bump(&self, program_id: &Address, bump: u8) -> Address;
    fn validate_pda(&self, account: &AccountView, program_id: &Address, bump: u8) -> ProgramResult {
        let expected = self.derive_address_with_bump(program_id, bump);
        if account.address() != &expected {
            return Err(ProgramError::InvalidSeeds);
        }
        Ok(())
    }
    fn validate_pda_address(&self, account: &AccountView, program_id: &Address) -> Result<u8, ProgramError> {
        let (expected, canonical_bump) = self.derive_address(program_id)?;
        if account.address() != &expected {
            return Err(ProgramError::InvalidSeeds);
        }
        Ok(canonical_bump)
    }
}

// For state structs that store their own bump
pub trait PdaAccount: PdaSeeds {
    fn bump(&self) -> u8;
    fn validate_self(&self, account: &AccountView, program_id: &Address) -> ProgramResult {
        self.validate_pda(account, program_id, self.bump())
    }
}
```

## Instruction Directory Structure

Organize each instruction as its own module:

```
src/instructions/
├── mod.rs              ← re-exports + discriminator enum
├── impl_instructions.rs ← define_instruction! expansions
├── deposit/
│   ├── mod.rs
│   ├── accounts.rs     ← DepositAccounts, TryFrom<&'a [AccountView]>
│   ├── data.rs         ← DepositData, TryFrom<&'a [u8]>
│   └── processor.rs    ← process() business logic
└── withdraw/
    └── ...
```

Use `define_instruction!` to wire accounts + data into an instruction struct without boilerplate:

```rust
macro_rules! define_instruction {
    ($name:ident, $accounts:ty, $data:ty) => {
        pub struct $name<'a> {
            pub accounts: $accounts,
            pub data: $data,
        }

        impl<'a> From<($accounts, $data)> for $name<'a> {
            fn from((accounts, data): ($accounts, $data)) -> Self {
                Self { accounts, data }
            }
        }

        impl<'a> TryFrom<(&'a [u8], &'a mut [AccountView])> for $name<'a> {
            type Error = ProgramError;
            fn try_from((data, accounts): (&'a [u8], &'a mut [AccountView])) -> Result<Self, Self::Error> {
                Ok(Self {
                    accounts: <$accounts>::try_from(accounts)?,
                    data: <$data>::try_from(data)?,
                })
            }
        }
    };
}

define_instruction!(Deposit, DepositAccounts<'a>, DepositData);
```

## Account Validation

Pinocchio requires manual validation. Wrap all checks in `TryFrom` implementations:

### Account Struct Validation

```rust
pub struct DepositAccounts<'a> {
    pub owner: &'a mut AccountView,
    pub vault: &'a mut AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a mut [AccountView]> for DepositAccounts<'a> {
    type Error = ProgramError;

    fn try_from(accounts: &'a mut [AccountView]) -> Result<Self, Self::Error> {
        let [owner, vault, system_program, _remaining @ ..] = accounts else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };

        // Signer check
        if !owner.is_signer() {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // Owner check
        if !vault.owned_by(&pinocchio_system::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        // Program ID check (prevents arbitrary CPI)
        if system_program.address() != &pinocchio_system::ID {
            return Err(ProgramError::IncorrectProgramId);
        }

        Ok(Self { owner, vault, system_program })
    }
}
```

### Instruction Data Validation

```rust
pub struct DepositData {
    pub amount: u64,
}

impl<'a> TryFrom<&'a [u8]> for DepositData {
    type Error = ProgramError;

    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        require_len!(data, core::mem::size_of::<u64>());

        let amount = u64::from_le_bytes(data[..8].try_into().map_err(|_| ProgramError::InvalidInstructionData)?);

        if amount == 0 {
            return Err(ProgramError::InvalidInstructionData);
        }

        Ok(Self { amount })
    }
}
```

## Token programs

Use the crates pinocchio-token and pinocchio-token2022

### SPL Token

```rust
use pinocchio_token::{instructions::InitializeMint2, state::Mint};

...
InitializeMint2 {
    mint: account,
    decimals,
    mint_authority,
    freeze_authority,
}.invoke()?;

let mint = Mint::from_account_view(account)?;
```

### Token2022

Token2022 provides a similar state struct

```rust
let mint = Mint::from_account_view(account)?;
```

## Cross-Program Invocations (CPIs)

### Basic CPI

```rust
use pinocchio_system::instructions::Transfer;

Transfer {
    from: self.accounts.owner,
    to: self.accounts.vault,
    lamports: self.data.amount,
}.invoke()?;
```

### PDA-Signed CPI

```rust
use pinocchio::cpi::{Seed, Signer};

let bump_byte = &[bump];
let seeds = [
    Seed::from(b"vault"),
    Seed::from(self.accounts.owner.address().as_ref()),
    Seed::from(&bump_byte),
];
let signers = [Signer::from(&seeds)];

Transfer {
    from: self.accounts.vault,
    to: self.accounts.owner,
    lamports: self.accounts.vault.lamports(),
}.invoke_signed(&signers)?;
```

## Reading and Writing Data

### Struct Field Ordering

Order fields from largest to smallest alignment to minimize padding:

```rust
// Good: 16 bytes total
#[repr(C)]
struct GoodOrder {
    big: u64,     // 8 bytes, 8-byte aligned
    medium: u16,  // 2 bytes, 2-byte aligned
    small: u8,    // 1 byte, 1-byte aligned
    // 5 bytes padding
}

// Bad: 24 bytes due to padding
#[repr(C)]
struct BadOrder {
    small: u8,    // 1 byte
    // 7 bytes padding
    big: u64,     // 8 bytes
    medium: u16,  // 2 bytes
    // 6 bytes padding
}
```

### Compile-Time Layout Assertions

Use `assert_no_padding!(Type, expected_size)` to catch unintended struct padding at compile time. Pass the expected `DATA_LEN` (the payload, excluding the 2-byte disc+version prefix):

```rust
assert_no_padding!(Config, Config::DATA_LEN);
```

### Explicit Padding and Versioning

Reserve bytes for future fields to avoid breaking account layout changes. Remember: the `discriminator` and `version` bytes live in the 2-byte prefix managed by `AccountSerialize`/`AccountDeserialize` — the struct itself contains only the data payload:

```rust
#[repr(C)]
pub struct Config {
    pub bump: u8,
    pub authority: [u8; 32],
    pub _reserved: [u8; 6], // explicit padding for future fields
}

impl Discriminator for Config { const DISCRIMINATOR: u8 = 0; }
impl Versioned for Config     { const VERSION: u8 = 1; }
impl AccountSize for Config   { const DATA_LEN: usize = 39; }

assert_no_padding!(Config, 39);
```

### Dangerous Patterns to Avoid

```rust
// ❌ transmute with unaligned data
let value: u64 = unsafe { core::mem::transmute(bytes_slice) };

// ❌ Pointer casting to packed structs
#[repr(C, packed)]
pub struct Packed { pub a: u8, pub b: u64 }
let config = unsafe { &*(data.as_ptr() as *const Packed) };

// ❌ Direct field access on packed structs creates unaligned references
let b_ref = &packed.b;

// ❌ Assuming alignment without verification
let config = unsafe { &*(data.as_ptr() as *const Config) };
```

## Error Handling

Use `thiserror` for descriptive errors (supports `no_std`):

```rust
use thiserror::Error;
use num_derive::FromPrimitive;
use pinocchio::error::ProgramError;

#[derive(Clone, Debug, Eq, Error, FromPrimitive, PartialEq)]
pub enum VaultError {
    #[error("Lamport balance below rent-exempt threshold")]
    NotRentExempt,
    #[error("Invalid account owner")]
    InvalidOwner,
    #[error("Account not initialized")]
    NotInitialized,
}

impl From<VaultError> for ProgramError {
    fn from(e: VaultError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

## Closing Accounts Securely

Prevent revival attacks by marking closed accounts. `set_lamports` returns `()`, not `Result` — the caller must drain lamports first because `close()` zeroes the data-length / lamports / owner fields but does not move lamports.

```rust
pub fn close(account: &mut AccountView, destination: &mut AccountView) -> ProgramResult {
    // Drain lamports
    destination.set_lamports(destination.lamports() + account.lamports());
    account.set_lamports(0);

    // Close
    account.close()
}
```

## Performance Optimization

### Feature Flags

```toml
[features]
default = ["perf"]
perf = []
```

```rust
#[cfg(not(feature = "perf"))]
solana_program_log::log!("Instruction: Deposit");
```

### Bitwise Flags for Storage

Pack up to 8 booleans in one byte:

```rust
const FLAG_ACTIVE: u8 = 1 << 0;
const FLAG_FROZEN: u8 = 1 << 1;
const FLAG_ADMIN: u8 = 1 << 2;

// Set flag
flags |= FLAG_ACTIVE;

// Check flag
if flags & FLAG_ACTIVE != 0 { /* active */ }

// Clear flag
flags &= !FLAG_ACTIVE;
```

### Zero-Allocation Architecture

Use references instead of heap allocations:

```rust
// Good: references with borrowed lifetimes
pub struct Instruction<'a> {
    pub accounts: &'a mut [AccountView],
    pub data: &'a [u8],
}

// Enforce no heap usage
no_allocator!();
```

Respect Solana's memory limits: 4KB stack per function, 32KB total heap.

### Skip Redundant Checks

If a CPI will fail on incorrect accounts anyway, skip pre-validation:

```rust
// Instead of validating ATA derivation, compute expected address
let seeds: [&[u8]; 3] = [
    owner.address().as_array(),
    token_program.address().as_array(),
    mint.address().as_array(),
];
let (expected_ata, _bump) = Address::derive_program_address(
    &seeds,
    &pinocchio_associated_token_account::ID,
).ok_or(ProgramError::InvalidSeeds)?;

if account.address() != &expected_ata {
    return Err(ProgramError::InvalidAccountData);
}
```

## Batch Instructions

Process multiple operations in a single CPI (saves ~1000 CU per batched operation):

```rust
const IX_HEADER_SIZE: usize = 2; // account_count + data_length

pub fn process_batch(mut accounts: &mut [AccountView], mut data: &[u8]) -> ProgramResult {
    loop {
        if data.len() < IX_HEADER_SIZE {
            return Err(ProgramError::InvalidInstructionData);
        }

        let account_count = data[0] as usize;
        let data_len = data[1] as usize;
        let data_offset = IX_HEADER_SIZE + data_len;

        if accounts.len() < account_count || data.len() < data_offset {
            return Err(ProgramError::InvalidInstructionData);
        }

        // split_at_mut keeps mutable access to both halves
        let (ix_accounts, rest) = accounts.split_at_mut(account_count);
        let ix_data = &data[IX_HEADER_SIZE..data_offset];

        process_inner_instruction(ix_accounts, ix_data)?;

        if data_offset == data.len() {
            break;
        }

        accounts = rest;
        data = &data[data_offset..];
    }

    Ok(())
}
```

## Events

### Simple logging

For debug output or non-critical events where truncation is acceptable, use `solana-program-log` (pinocchio's own log module is being removed in favour of this crate — see [anza-xyz/pinocchio#261](https://github.com/anza-xyz/pinocchio/pull/261)):

```rust
use solana_program_log::log;

log!("deposited {}", amount);
```

Solana truncates logs beyond ~10KB per transaction. If your event data exceeds this or indexers need to reliably parse it, use the CPI pattern below instead.

### Event emission via CPI (truncation-safe)

For production events that indexers must reliably read, emit via CPI into a no-op `EmitEvent` instruction on the program itself. The event data lives in the instruction data field (not logs), which is never truncated.

Events are validated by an `event_authority` PDA that must sign the CPI:

```rust
pub const EVENT_AUTHORITY_SEED: &[u8] = b"event_authority";
pub const EVENT_IX_TAG: u64 = 0x1d9acb512ea545e4; // Anchor-compatible event tag
pub const EVENT_IX_TAG_LE: [u8; 8] = EVENT_IX_TAG.to_le_bytes();

// Event authority PDA (derived at compile time if possible)
pub fn find_event_authority() -> Result<(Address, u8), ProgramError> {
    let seeds: [&[u8]; 1] = [EVENT_AUTHORITY_SEED];
    Address::derive_program_address(&seeds, &crate::ID)
        .ok_or(ProgramError::InvalidSeeds)
}
```

### Event Struct Pattern

```rust
pub trait EventDiscriminator {
    const DISCRIMINATOR: [u8; 9]; // 8-byte tag + 1-byte event id
}

pub trait EventSerialize {
    fn serialize(&self) -> Vec<u8>;
}

pub struct DepositEvent {
    pub owner: [u8; 32],
    pub amount: u64,
}

impl EventDiscriminator for DepositEvent {
    const DISCRIMINATOR: [u8; 9] =
        [/* EVENT_IX_TAG_LE bytes */ 0xe4, 0x45, 0xa5, 0x2e, 0x51, 0xcb, 0x9a, 0x1d, /* event id */ 0];
}
```

### Emitting an Event

```rust
use pinocchio::cpi::invoke;
use pinocchio::instruction::{InstructionAccount, InstructionView};

pub fn emit_event<E: EventDiscriminator + EventSerialize>(
    event: &E,
    event_authority: &AccountView,
    program: &AccountView,
) -> ProgramResult {
    let mut data = E::DISCRIMINATOR.to_vec();
    data.extend(event.serialize());

    let metas = [InstructionAccount::readonly_signer(event_authority.address())];
    let ix = InstructionView {
        program_id: &crate::ID,
        data: &data,
        accounts: &metas,
    };

    // CPI to self with event_authority as signer
    invoke(&ix, &[event_authority])
}
```

### EmitEvent Processor

Add a dedicated discriminator (conventionally `228`) that validates the event authority and does nothing else:

```rust
// In entrypoint routing:
Some((228, _)) => {
    if !accounts.iter().any(|a| a.address() == &event_authority && a.is_signer()) {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(()) // no-op, data is read off-chain from instruction data
}
```

## Testing

Use Mollusk or LiteSVM for fast Rust-based testing:

```rust
#[cfg(test)]
pub mod tests;

// Run with: cargo test-sbf
```

See [testing.md](../testing.md) for detailed testing patterns with Mollusk and LiteSVM.

## Build & Deployment

### Build Validation

After `cargo build-sbf`:

- [ ] Check .so file size (>1KB, typically 5-15KB for Pinocchio programs)
- [ ] Verify file type: `file target/deploy/program.so` should show "ELF 64-bit LSB shared object"
- [ ] Test regular compilation: `cargo build` should succeed
- [ ] Run tests: `cargo test` should pass

### Dependency Compatibility Issues

**If SBF build fails with "edition2024" errors:**

```bash
# Downgrade problematic dependencies to compatible versions
cargo update base64ct --precise 1.6.0
cargo update constant_time_eq --precise 0.4.1
cargo update blake3 --precise 1.5.5
```

**When to apply**: Only when encountering Cargo "edition2024" errors during `cargo build-sbf`. These downgrades resolve toolchain compatibility issues while maintaining functionality.

**Note**: These specific versions were tested and verified to work with current Solana toolchain. Regular `cargo update` may pull incompatible versions.

## Security Checklist

### Account Validation
- [ ] Validate account owners with `verify_owned_by` in `TryFrom`
- [ ] Check signer status with `verify_signer`
- [ ] Enforce writable/read-only with `verify_writable` / `verify_readonly`
- [ ] Validate program IDs before CPIs (prevent arbitrary CPI)
- [ ] Check for duplicate mutable accounts

### PDA Safety
- [ ] Derive canonical bump with `Address::derive_program_address` at init — never trust user-supplied bumps
- [ ] Store canonical bump in account data and validate on every use via `PdaAccount::validate_self`
- [ ] Only transfer the lamport deficit on init — not the full rent amount (lamport griefing)

### Sysvars (Pinocchio has no implicit validation)
- [ ] Use `Clock::get()?` and `Rent::get()?` — never accept sysvars as passed-in accounts

### Data & Arithmetic
- [ ] Use `require_len!` before parsing instruction data
- [ ] Use checked math (`checked_add`, `checked_sub`, etc.)

### Account Lifecycle
- [ ] Drain lamports first, then call `account.close()` — `close()` zeroes the data-length / lamports / owner fields but does not move lamports
- [ ] Discriminator check on every read prevents type cosplay attacks
