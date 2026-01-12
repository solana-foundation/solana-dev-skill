# Solana Security Checklist (Program + Client)

## Core Principle

Assume the attacker controls:
- Every account passed into an instruction
- Every instruction argument
- Transaction ordering (within reason)
- CPI call graphs (via composability)

---

## Vulnerability Categories

### 1. Missing Owner Checks

**Risk**: Attacker creates fake accounts with identical data structure and correct discriminator.

**Attack**: Without owner checks, deserialization succeeds for both legitimate and counterfeit accounts.

**Anchor Prevention**:
```rust
// Option 1: Use typed accounts (automatic)
pub account: Account<'info, ProgramAccount>,

// Option 2: Explicit constraint
#[account(owner = program_id)]
pub account: UncheckedAccount<'info>,
```

**Pinocchio Prevention**:
```rust
if !account.is_owned_by(&crate::ID) {
    return Err(ProgramError::InvalidAccountOwner);
}
```

---

### 2. Missing Signer Checks

**Risk**: Any account can perform operations that should be restricted to specific authorities.

**Attack**: Attacker locates target account, extracts owner pubkey, constructs transaction using real owner's address without their signature.

**Anchor Prevention**:
```rust
// Option 1: Use Signer type
pub authority: Signer<'info>,

// Option 2: Explicit constraint
#[account(signer)]
pub authority: UncheckedAccount<'info>,

// Option 3: Manual check
if !ctx.accounts.authority.is_signer {
    return Err(ProgramError::MissingRequiredSignature);
}
```

**Pinocchio Prevention**:
```rust
if !self.accounts.authority.is_signer() {
    return Err(ProgramError::MissingRequiredSignature);
}
```

---

### 3. Arbitrary CPI Attacks

**Risk**: Program blindly calls whatever program is passed as parameter, becoming a proxy for malicious code.

**Attack**: Attacker substitutes malicious program mimicking expected interface (e.g., fake SPL Token that reverses transfers).

**Anchor Prevention**:
```rust
// Use typed Program accounts
pub token_program: Program<'info, Token>,

// Or explicit validation
if ctx.accounts.token_program.key() != &spl_token::ID {
    return Err(ProgramError::IncorrectProgramId);
}
```

**Pinocchio Prevention**:
```rust
if self.accounts.token_program.key() != &pinocchio_token::ID {
    return Err(ProgramError::IncorrectProgramId);
}
```

---

### 4. Reinitialization Attacks

**Risk**: Calling initialization functions on already-initialized accounts overwrites existing data.

**Attack**: Attacker reinitializes account to become new owner, then drains controlled assets.

**Anchor Prevention**:
```rust
// Use init constraint (automatic protection)
#[account(init, payer = payer, space = 8 + Data::LEN)]
pub account: Account<'info, Data>,

// Manual check if needed
if ctx.accounts.account.is_initialized {
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

**Critical**: Avoid `init_if_needed` - it permits reinitialization.

**Pinocchio Prevention**:
```rust
// Check discriminator before initialization
let data = account.try_borrow_data()?;
if data[0] == ACCOUNT_DISCRIMINATOR {
    return Err(ProgramError::AccountAlreadyInitialized);
}
```

---

### 5. PDA Sharing Vulnerabilities

**Risk**: Same PDA used across multiple users enables unauthorized access.

**Attack**: Shared PDA authority becomes "master key" unlocking multiple users' assets.

**Vulnerable Pattern**:
```rust
// BAD: Only mint in seeds - all vaults for same token share authority
seeds = [b"pool", pool.mint.as_ref()]
```

**Secure Pattern**:
```rust
// GOOD: Include user-specific identifiers
seeds = [b"pool", vault.key().as_ref(), owner.key().as_ref()]
```

---

### 6. Type Cosplay Attacks

**Risk**: Accounts with identical data structures but different purposes can be substituted.

**Attack**: Attacker passes controlled account type as different type parameter, bypassing authorization.

**Prevention**: Use discriminators to distinguish account types.

**Anchor**: Automatic 8-byte discriminator with `#[account]` macro.

**Pinocchio**:
```rust
// Validate discriminator before processing
let data = account.try_borrow_data()?;
if data[0] != EXPECTED_DISCRIMINATOR {
    return Err(ProgramError::InvalidAccountData);
}
```

---

### 7. Duplicate Mutable Accounts

**Risk**: Passing same account twice causes program to overwrite its own changes.

**Attack**: Sequential mutations on identical accounts cancel earlier changes.

**Prevention**:
```rust
// Anchor
if ctx.accounts.account_1.key() == ctx.accounts.account_2.key() {
    return Err(ProgramError::InvalidArgument);
}

// Pinocchio
if self.accounts.account_1.key() == self.accounts.account_2.key() {
    return Err(ProgramError::InvalidArgument);
}
```

---

### 8. Revival Attacks

**Risk**: Closed accounts can be restored within same transaction by refunding lamports.

**Attack**: Multi-instruction transaction drains account, refunds rent, exploits "closed" account.

**Secure Closure Pattern**:
```rust
// Anchor: Use close constraint
#[account(mut, close = destination)]
pub account: Account<'info, Data>,

// Pinocchio: Full secure closure
pub fn close(account: &AccountInfo, destination: &AccountInfo) -> ProgramResult {
    // 1. Mark as closed
    {
        let mut data = account.try_borrow_mut_data()?;
        data[0] = 0xff; // Closed discriminator
    }

    // 2. Transfer lamports
    *destination.try_borrow_mut_lamports()? += *account.try_borrow_lamports()?;

    // 3. Shrink and close
    account.realloc(1, true)?;
    account.close()
}
```

---

### 9. Data Matching Vulnerabilities

**Risk**: Correct type/ownership validation but incorrect assumptions about data relationships.

**Attack**: Signer matches transaction but not stored owner field.

**Prevention**:
```rust
// Anchor: has_one constraint
#[account(has_one = authority)]
pub account: Account<'info, Data>,

// Pinocchio: Manual validation
let data = Config::from_bytes(&account.try_borrow_data()?)?;
if data.authority != *authority.key() {
    return Err(ProgramError::InvalidAccountData);
}
```

---

## Program-Side Checklist

### Account Validation
- [ ] Validate account owners match expected program
- [ ] Validate signer requirements explicitly
- [ ] Validate writable requirements explicitly
- [ ] Validate PDAs match expected seeds + bump
- [ ] Validate token mint ↔ token account relationships
- [ ] Validate rent exemption / initialization status
- [ ] Check for duplicate mutable accounts

### CPI Safety
- [ ] Validate program IDs before CPIs (no arbitrary CPI)
- [ ] Do not pass extra writable or signer privileges to callees
- [ ] Ensure invoke_signed seeds are correct and canonical

### Arithmetic and Invariants
- [ ] Use checked math (`checked_add`, `checked_sub`, `checked_mul`, `checked_div`)
- [ ] Avoid unchecked casts
- [ ] Re-validate state after CPIs when required

### State Lifecycle
- [ ] Close accounts securely (mark discriminator, drain lamports)
- [ ] Avoid leaving "zombie" accounts with lamports
- [ ] Gate upgrades and ownership transfers
- [ ] Prevent reinitialization of existing accounts

---

## Client-Side Checklist

- [ ] Cluster awareness: never hardcode mainnet endpoints in dev flows
- [ ] Simulate transactions for UX where feasible
- [ ] Handle blockhash expiry and retry with fresh blockhash
- [ ] Treat "signature received" as not-final; track confirmation
- [ ] Never assume token program variant; detect Token-2022 vs classic
- [ ] Validate transaction simulation results before signing
- [ ] Show clear error messages for common failure modes

---

## Security Review Questions

1. Can an attacker pass a fake account that passes validation?
2. Can an attacker call this instruction without proper authorization?
3. Can an attacker substitute a malicious program for CPI targets?
4. Can an attacker reinitialize an existing account?
5. Can an attacker exploit shared PDAs across users?
6. Can an attacker pass the same account for multiple parameters?
7. Can an attacker revive a closed account in the same transaction?
8. Can an attacker exploit mismatches between stored and provided data?
