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
    // 1. Add lamports
    destination.set_lamports(destination.lamports() + account.lamports())?;

    // 2. Close
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

## Token-2022 Extension Security

> Source: [@0xcastle_chain Token-2022 Security Checklist thread](https://x.com/0xcastle_chain/status/2031497044775366770)

Token-2022 is not an upgrade to SPL Token. It's a different program with different rules. Transfer fees taken in-flight. Permanent delegates with unlimited authority. Mint accounts that can be closed and reopened. Memo requirements that revert silent transfers. Every extension rewrites assumptions the old SPL model never had to make. Most teams copy old SPL patterns into new Token-2022 code — that's where the criticals live.

---

### 10. Transfer Fee Accounting

**Risk**: Token-2022 lets a mint charge fees on every transfer. The fee is deducted from the receiver's end, not the sender's.

**Attack**: You send 100. The receiver gets 80. Your protocol logs 100 received. Now the user withdraws 100. The vault sends 100 and pays another 20 in fees. Vault balance: down 20. Protocol didn't lose a trade — it lost money on bookkeeping.

**Prevention**: Every instruction that moves a fee-bearing token needs delta-aware accounting. Pre-calculate the fee. Or measure balance before and after. Never assume 1:1.

---

### 11. calculate_fee vs calculate_inverse_fee Rounding

**Risk**: `calculate_fee` and `calculate_inverse_fee` are not inverses of each other. `calculate_fee(amount)` can return a different value than `calculate_inverse_fee(post_amount)`.

**Attack**: The difference is often just 1 token unit. But in high-volume protocols, a 1-unit rounding difference per transaction across millions of transfers becomes a real accounting drain.

**Prevention**: If your contract uses both methods interchangeably — you have a bug. Use `transfer_checked_with_fee` and specify the exact expected fee. `calculate_fee` computes fee based on the sent amount; `calculate_inverse_fee` computes fee based on the received amount.

---

### 12. Permanent Delegate Authority

**Risk**: If a mint has the Permanent Delegate extension, that delegate can transfer or burn ANY amount from ANY token account. No approval needed. No signature from the account owner.

**Attack**:
1. Mint has Permanent Delegate extension set — one address controls ALL accounts holding this mint.
2. Protocol accepts token deposits — vault holds user funds in token accounts for this mint.
3. Protocol never validates delegate authority — no check whether the delegate is trusted.
4. Delegate burns all user balances silently — entire TVL gone, no transaction from users needed.

This is not an exploit. It is a feature being misused.

**Prevention**: Your protocol's vault holds user funds in a token account for that mint. The permanent delegate can drain it to zero. Legally. On-chain. This isn't theoretical — it's a feature. If your protocol accepts deposits of a token with a permanent delegate and doesn't validate trust in that authority — the entire TVL is at risk.

---

### 13. Mint Close and Reinitialization Attacks

**Risk**: Token-2022 lets mints be closed via the MintCloseAuthority extension. A closed mint can be recreated at the same address with different extensions.

**Attack**: An attacker creates token accounts while the mint has no extensions. Mint gets closed and reinitialized with NonTransferable or TransferFee. Those old token accounts still work — with the old rules. Soulbound tokens that aren't soulbound. Transfer fees that don't apply to pre-existing accounts. KYC-frozen mints bypassed by accounts created before the freeze was set.

**Prevention**: Checking if a mint currently has no close authority is not enough. You need to verify it was never reinitialized.

---

### 14. Token Account Closure Conditions

**Risk**: In old SPL, `amount == 0` means closable. In Token-2022, that's not sufficient.

**Requirements for closure**: You also need:
- `TransferFeeAmount.withheld_amount == 0`
- `ConfidentialTransferAccount` balances cleared
- `ConfidentialTransferFeeAmount.withheld_amount == 0`
- CPI Guard destination must be the account owner if called via CPI

Miss any one of these and your close instruction reverts. If that close is part of a larger flow — the entire operation fails.

**Prevention**: Use the `.closable()` method on each extension. Don't hand-roll the check.

---

### 15. Stop Using `transfer` — Use `transfer_checked`

**Risk**: The old `transfer` instruction is deprecated in Token-2022. If the token account has a Transfer Hook or Transfer Fee extension, calling `transfer` instead of `transfer_checked` returns `MintRequiredForTransfer` and your instruction fails silently.

**Prevention**:

```rust
// BAD: anchor_spl::token::transfer — breaks with Token-2022 extensions
// GOOD: anchor_spl::token_interface — handles all Token-2022 extensions
```

`transfer_checked` requires the mint account and decimals. `transfer_checked_with_fee` adds the expected fee amount. If your Anchor program still imports `anchor_spl::token::transfer` for Token-2022 mints — it's broken. Use `anchor_spl::token_interface` for anything that might touch Token-2022.

---

### 16. Transfer Hook Security Surface

**Risk**: Transfer hooks run custom program logic on every transfer. Powerful — and dangerous.

**Prevention**: If you're writing a transfer hook, validate all three:
- The mint calling your hook is one you actually support. Otherwise any mint can invoke your program and access your PDAs.
- The token accounts are in transferring state. Without this check, attackers call your hook outside of a real transfer.
- The token accounts actually belong to the mint passed in. An attacker can create their own hook that calls yours, passing fake accounts with a legitimate mint.

One missing check = one critical.

---

### 17. Metadata Spoofing and Memo Requirements

**Risk**: Anyone can create a Metadata account and point it at a legitimate mint. Only the metadata that the mint's own pointer references back to is authoritative.

**Prevention**: Always verify the bidirectional reference: `mint.metadata_pointer` → metadata address AND `metadata.mint` → mint address. If the pointer is one-directional, the metadata is spoofed.

**Memo Transfer Risk**: If your protocol transfers to user-owned accounts — check if Memo Transfer is enabled on the destination. If it is and you don't prepend a Memo instruction, the transfer reverts. Silent DoS if you're not checking for it.

---

### 18. Don't Hardcode Token Account Rent

**Risk**: SPL Token accounts are always 165 bytes. Token-2022 accounts vary based on extensions.

**Attack**: Hardcoding 0.00203928 SOL for rent will fail the moment the account needs extension space. If a backend keeper creates token accounts for users and the user controls the space parameter — the keeper overpays rent. Financial loss vector.

**Prevention**: Use `getMinimumBalanceForRentExemptAccountWithExtensions`. Calculate dynamically. Every time. Don't have keepers create token accounts for users if avoidable.

---

## Token-2022 Audit Checklist

- [ ] Transfer fee active? Audit every balance delta
- [ ] Permanent delegate? Validate full authority trust model
- [ ] MintCloseAuthority? Check for reinitialization history
- [ ] Using `transfer` instead of `transfer_checked`? Replace it
- [ ] Transfer hook? Validate mint, transferring state, and account ownership
- [ ] Metadata pointer? Verify bidirectional reference
- [ ] Memo transfer on destination? Handle the revert case
- [ ] Closing token accounts? Check every extension's `.closable()`
- [ ] Hardcoded rent? Replace with dynamic calculation

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
9. Does the protocol correctly handle Token-2022 transfer fees in all accounting paths?
10. Can an attacker exploit permanent delegate authority to drain token accounts?
11. Can an attacker close and reinitialize a mint to bypass extension rules?
12. Is the protocol using `transfer_checked` for all Token-2022 token movements?
