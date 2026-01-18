# Programs with Pinocchio

Pinocchio is a minimalist Rust library for crafting Solana programs without the heavyweight `solana-program` crate. It delivers significant performance gains through zero-copy techniques and minimal dependencies.

## When to Use Pinocchio

Use Pinocchio when you need:
- **Maximum compute efficiency**: 84% CU savings compared to Anchor
- **Minimal binary size**: Leaner code paths and smaller deployments
- **Zero external dependencies**: Only Solana SDK types required
- **Fine-grained control**: Direct memory access and byte-level operations
- **no_std environments**: Embedded or constrained contexts

## Core Architecture

### Program Structure Validation Checklist

Before building/deploying, verify lib.rs contains all required components:

- [ ] `entrypoint!(process_instruction)` macro
- [ ] `pub const ID: Address = Address::new_from_array([...])` with correct program ID
- [ ] `fn process_instruction(program_id: &Address, accounts: &[AccountView], data: &[u8]) -> ProgramResult`
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
    accounts: &[AccountView],
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
// Remove nostd_panic_handler!() - std provides panic handling
```

**For no_std environments:**
```rust
#![no_std]
entrypoint!(process_instruction);
nostd_panic_handler!();
```

**Critical**: Never include both - causes duplicate lang item error in SBF builds.

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

### Instruction Structure

Separate validation from business logic using the `TryFrom` trait:

```rust
pub struct Deposit<'a> {
    pub accounts: DepositAccounts<'a>,
    pub data: DepositData,
}

impl<'a> TryFrom<(&'a [u8], &'a [AccountView])> for Deposit<'a> {
    type Error = ProgramError;

    fn try_from((data, accounts): (&'a [u8], &'a [AccountView])) -> Result<Self, Self::Error> {
        let accounts = DepositAccounts::try_from(accounts)?;
        let data = DepositData::try_from(data)?;
        Ok(Self { accounts, data })
    }
}

impl<'a> Deposit<'a> {
    pub const DISCRIMINATOR: &'a u8 = &0;

    pub fn process(&self) -> ProgramResult {
        // Business logic only - validation already complete
        Ok(())
    }
}
```

## Account Validation

Pinocchio requires manual validation. Wrap all checks in `TryFrom` implementations:

### Account Struct Validation

```rust
pub struct DepositAccounts<'a> {
    pub owner: &'a AccountView,
    pub vault: &'a AccountView,
    pub system_program: &'a AccountView,
}

impl<'a> TryFrom<&'a [AccountView]> for DepositAccounts<'a> {
    type Error = ProgramError;

    fn try_from(accounts: &'a [AccountView]) -> Result<Self, Self::Error> {
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



        // Owner check
        if !vault.is_owned_by(&pinocchio_system::ID) {
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
        if data.len() != core::mem::size_of::<u64>() {
            return Err(ProgramError::InvalidInstructionData);
        }

        let amount = u64::from_le_bytes(data.try_into().unwrap());

        if amount == 0 {
            return Err(ProgramError::InvalidInstructionData);
        }

        Ok(Self { amount })
    }
}
```

## Token Account Helpers

### SPL Token Validation

```rust
pub struct Mint;

impl Mint {
    pub fn check(account: &AccountView) -> Result<(), ProgramError> {
        if !account.owned_by(&pinocchio_token::ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }
        if account.data_len() != pinocchio_token::state::Mint::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(())
    }

    pub fn init(
        account: &AccountView,
        payer: &AccountView,
        decimals: u8,
        mint_authority: &[u8; 32],
        freeze_authority: Option<&[u8; 32]>,
    ) -> ProgramResult {
        let lamports = Rent::get()?.minimum_balance(pinocchio_token::state::Mint::LEN);

        CreateAccount {
            from: payer,
            to: account,
            lamports,
            space: pinocchio_token::state::Mint::LEN as u64,
            owner: &pinocchio_token::ID,
        }.invoke()?;

        InitializeMint2 {
            mint: account,
            decimals,
            mint_authority,
            freeze_authority,
        }.invoke()
    }
}
```

### Token2022 Support

Token2022 requires discriminator-based validation due to variable account sizes with extensions:

```rust
pub const TOKEN_2022_PROGRAM_ID: [u8; 32] = [...];
const TOKEN_2022_ACCOUNT_DISCRIMINATOR_OFFSET: usize = 165;
pub const TOKEN_2022_MINT_DISCRIMINATOR: u8 = 0x01;
pub const TOKEN_2022_TOKEN_ACCOUNT_DISCRIMINATOR: u8 = 0x02;

pub struct Mint2022;

impl Mint2022 {
    pub fn check(account: &AccountView) -> Result<(), ProgramError> {
        if !account.is_owned_by(&TOKEN_2022_PROGRAM_ID) {
            return Err(ProgramError::InvalidAccountOwner);
        }

        let data = account.try_borrow_data()?;

        if data.len() != pinocchio_token::state::Mint::LEN {
            if data.len() <= TOKEN_2022_ACCOUNT_DISCRIMINATOR_OFFSET {
                return Err(ProgramError::InvalidAccountData);
            }
            if data[TOKEN_2022_ACCOUNT_DISCRIMINATOR_OFFSET] != TOKEN_2022_MINT_DISCRIMINATOR {
                return Err(ProgramError::InvalidAccountData);
            }
        }
        Ok(())
    }
}
```

### Token Interface (Both Programs)

```rust
pub struct MintInterface;

impl MintInterface {
    pub fn check(account: &AccountView) -> Result<(), ProgramError> {
        if account.is_owned_by(&pinocchio_token::ID) {
            if account.data_len() != pinocchio_token::state::Mint::LEN {
                return Err(ProgramError::InvalidAccountData);
            }
        } else if account.is_owned_by(&TOKEN_2022_PROGRAM_ID) {
            Mint2022::check(account)?;
        } else {
            return Err(ProgramError::InvalidAccountOwner);
        }
        Ok(())
    }
}
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
use pinocchio::{seeds::Seed, signer::Signer};

let seeds = [
    Seed::from(b"vault"),
    Seed::from(self.accounts.owner.address().as_ref()),
    Seed::from(&[bump]),
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

### Zero-Copy Reading (Safe Pattern)

Use byte arrays with accessor methods to avoid alignment issues:

```rust
#[repr(C)]
pub struct Config {
    pub authority: Pubkey,
    pub mint: Pubkey,
    seed: [u8; 8],   // Store as bytes
    fee: [u8; 2],    // Store as bytes
    pub state: u8,
    pub bump: u8,
}

impl Config {
    pub const LEN: usize = core::mem::size_of::<Self>();

    pub fn from_bytes(data: &[u8]) -> Result<&Self, ProgramError> {
        if data.len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }
        // Safe: all fields are byte-aligned
        Ok(unsafe { &*(data.as_ptr() as *const Self) })
    }

    pub fn seed(&self) -> u64 {
        u64::from_le_bytes(self.seed)
    }

    pub fn fee(&self) -> u16 {
        u16::from_le_bytes(self.fee)
    }

    pub fn set_seed(&mut self, seed: u64) {
        self.seed = seed.to_le_bytes();
    }

    pub fn set_fee(&mut self, fee: u16) {
        self.fee = fee.to_le_bytes();
    }
}
```

### Field-by-Field Serialization (Safest)

```rust
impl Config {
    pub fn write_to_buffer(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() != Self::LEN {
            return Err(ProgramError::InvalidAccountData);
        }

        let mut offset = 0;

        data[offset..offset + 32].copy_from_slice(self.authority.as_ref());
        offset += 32;

        data[offset..offset + 32].copy_from_slice(self.mint.as_ref());
        offset += 32;

        data[offset..offset + 8].copy_from_slice(&self.seed);
        offset += 8;

        data[offset..offset + 2].copy_from_slice(&self.fee);
        offset += 2;

        data[offset] = self.state;
        data[offset + 1] = self.bump;

        Ok(())
    }
}
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
use pinocchio::program_error::ProgramError;

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

Prevent revival attacks by marking closed accounts:

```rust
pub fn close(account: &AccountView, destination: &AccountView) -> ProgramResult {
    // Mark as closed (prevents reinitialization)
    {
        let mut data = account.try_borrow_mut_data()?;
        data[0] = 0xff;
    }

    // Transfer lamports
    *destination.try_borrow_mut_lamports()? += *account.try_borrow_lamports()?;

    // Shrink and close
    account.realloc(1, true)?;
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
pinocchio::msg!("Instruction: Deposit");
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
    pub accounts: &'a [AccountView],
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
let expected_ata = find_program_address(
    &[owner.address(), token_program.address(), mint.address()],
    &pinocchio_associated_token_account::ID,
).0;

if account.address() != &expected_ata {
    return Err(ProgramError::InvalidAccountData);
}
```

## Batch Instructions

Process multiple operations in a single CPI (saves ~1000 CU per batched operation):

```rust
const IX_HEADER_SIZE: usize = 2; // account_count + data_length

pub fn process_batch(mut accounts: &[AccountView], mut data: &[u8]) -> ProgramResult {
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

        let (ix_accounts, ix_data) = (&accounts[..account_count], &data[IX_HEADER_SIZE..data_offset]);

        process_inner_instruction(ix_accounts, ix_data)?;

        if data_offset == data.len() {
            break;
        }

        accounts = &accounts[account_count..];
        data = &data[data_offset..];
    }

    Ok(())
}
```

## Testing

Use Mollusk or LiteSVM for fast Rust-based testing:

```rust
#[cfg(test)]
pub mod tests;

// Run with: cargo test-sbf
```

See [testing.md](testing.md) for detailed testing patterns with Mollusk and LiteSVM.

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

- [ ] Validate all account owners in `TryFrom` implementations
- [ ] Check signer status for authority accounts
- [ ] Verify PDA derivation matches expected seeds
- [ ] Validate program IDs before CPIs (prevent arbitrary CPI)
- [ ] Use checked math (`checked_add`, `checked_sub`, etc.)
- [ ] Mark closed accounts to prevent revival attacks
- [ ] Validate instruction data length before parsing
- [ ] Check for duplicate mutable accounts when accepting multiple of same type
