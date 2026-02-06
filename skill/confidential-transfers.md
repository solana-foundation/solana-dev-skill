# Confidential Transfers (Token-2022 Extension)

## When to use this guidance

Use this guidance when the user asks about:

- Private/encrypted token balances
- Confidential transfers or balances on Solana
- Zero-knowledge proofs for token transfers
- Token-2022 confidential transfer extension(s)
- ElGamal encryption for tokens

## Current Network Availability

**Important:** Confidential transfers are currently only available on a TXTX cluster.

- RPC endpoint: `https://zk-edge.surfnet.dev/`
- Mainnet availability expected in a few months

When building for confidential transfers, always use the ZK-Edge RPC for testing. Plan for mainnet migration by abstracting the RPC endpoint configuration. Ensure the user is aware of this.

## Key Concepts

### What are Confidential Transfers?

Confidential transfers encrypt token balances and transfer amounts using zero-knowledge cryptography. onchain observers cannot see actual amounts, but the system still verifies:

- Sender has sufficient balance
- Transfer amounts are non-negative
- No tokens are created or destroyed

### Balance Types

Each confidential-enabled account has three balance types:

- **Public**: Standard visible SPL balance
- **Pending**: Encrypted incoming transfers awaiting application
- **Available**: Encrypted balance ready for outgoing transfers

### Encryption Keys

Two keys are derived deterministically from the account owner's keypair:

- **ElGamal keypair**: Used for transfer encryption (asymmetric)
- **AES key**: Used for balance decryption by owner (symmetric)

### Privacy Levels

Mints can configure four privacy modes:

- `Disabled`: No confidential transfers
- `Whitelisted`: Only approved accounts
- `OptIn`: Accounts choose to enable
- `Required`: All transfers must be confidential

## Dependencies

```toml
[dependencies]
# Solana core
solana-sdk = "3.0.0"
solana-client = "3.1.6"
solana-zk-sdk = "5.0.0"
solana-commitment-config = "3.1.0"

# Token-2022
spl-token-2022 = { version = "10.0.0", features = ["zk-ops"] }
spl-token-client = "0.18.0"
spl-associated-token-account = "8.0.0"

# Confidential transfer proofs
spl-token-confidential-transfer-proof-generation = "0.5.1"
spl-token-confidential-transfer-proof-extraction = "0.5.1"

# Async runtime
tokio = { version = "1", features = ["full"] }
```

## Common Types

```rust
use solana_sdk::signature::Signature;
use std::error::Error;

pub type CtResult<T> = Result<T, Box<dyn Error>>;
pub type SigResult = CtResult<Signature>;
pub type MultiSigResult = CtResult<Vec<Signature>>;
```

## Operation Flow

The typical flow for confidential transfers:

1. **Configure** - Enable confidential transfers on a token account
2. **Deposit** - Move tokens from public to pending balance
3. **Apply Pending** - Move pending to available balance
4. **Transfer** - Send from available balance (encrypted)
5. **Withdraw** - Move from available back to public balance

## Key Operations

### 1. Configure Account for Confidential Transfers

Before using confidential transfers, accounts must be configured with encryption keys:

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::{signature::Signer, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022::{
    extension::{
        confidential_transfer::instruction::{configure_account, PubkeyValidityProofData},
        ExtensionType,
    },
    instruction::reallocate,
    solana_zk_sdk::encryption::{auth_encryption::AeKey, elgamal::ElGamalKeypair},
};
use spl_token_confidential_transfer_proof_extraction::instruction::ProofLocation;

pub async fn configure_account_for_confidential_transfers(
    client: &RpcClient,
    payer: &dyn Signer,
    authority: &dyn Signer,
    mint: &solana_sdk::pubkey::Pubkey,
) -> SigResult {
    let token_account = get_associated_token_address_with_program_id(
        &authority.pubkey(),
        mint,
        &spl_token_2022::id(),
    );

    // Derive encryption keys deterministically from authority
    let elgamal_keypair = ElGamalKeypair::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;
    let aes_key = AeKey::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;

    // Maximum pending deposits before apply_pending_balance must be called
    let max_pending_balance_credit_counter = 65536u64;

    // Initial decryptable balance (encrypted with AES)
    let decryptable_balance = aes_key.encrypt(0);

    // Generate proof that we control the ElGamal public key
    let proof_data = PubkeyValidityProofData::new(&elgamal_keypair)
        .map_err(|_| "Failed to generate pubkey validity proof")?;

    // Proof will be in the next instruction (offset 1)
    let proof_location = ProofLocation::InstructionOffset(
        1.try_into().unwrap(),
        &proof_data,
    );

    let mut instructions = vec![];

    // 1. Reallocate to add ConfidentialTransferAccount extension
    instructions.push(reallocate(
        &spl_token_2022::id(),
        &token_account,
        &payer.pubkey(),
        &authority.pubkey(),
        &[&authority.pubkey()],
        &[ExtensionType::ConfidentialTransferAccount],
    )?);

    // 2. Configure account (includes proof instruction)
    instructions.extend(configure_account(
        &spl_token_2022::id(),
        &token_account,
        mint,
        &decryptable_balance.into(),
        max_pending_balance_credit_counter,
        &authority.pubkey(),
        &[],
        proof_location,
    )?);

    let recent_blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &instructions,
        Some(&payer.pubkey()),
        &[authority, payer],
        recent_blockhash,
    );

    let signature = client.send_and_confirm_transaction(&transaction)?;
    Ok(signature)
}
```

### 2. Deposit to Confidential Balance

Move tokens from public balance to pending confidential balance:

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::{signature::Signer, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022::extension::confidential_transfer::instruction::deposit;

pub async fn deposit_to_confidential(
    client: &RpcClient,
    payer: &dyn Signer,
    authority: &dyn Signer,
    mint: &solana_sdk::pubkey::Pubkey,
    amount: u64,
    decimals: u8,
) -> SigResult {
    let token_account = get_associated_token_address_with_program_id(
        &authority.pubkey(),
        mint,
        &spl_token_2022::id(),
    );

    let deposit_ix = deposit(
        &spl_token_2022::id(),
        &token_account,
        mint,
        amount,
        decimals,
        &authority.pubkey(),
        &[&authority.pubkey()],
    )?;

    let recent_blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[deposit_ix],
        Some(&payer.pubkey()),
        &[payer, authority],
        recent_blockhash,
    );

    let signature = client.send_and_confirm_transaction(&transaction)?;
    Ok(signature)
}
```

### 3. Apply Pending Balance

Move tokens from pending to available (spendable) balance:

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::{signature::Signer, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022::{
    extension::{
        confidential_transfer::{
            instruction::apply_pending_balance as apply_pending_balance_instruction,
            ConfidentialTransferAccount,
        },
        BaseStateWithExtensions, StateWithExtensions,
    },
    solana_zk_sdk::encryption::{auth_encryption::AeKey, elgamal::ElGamalKeypair},
    state::Account as TokenAccount,
};

pub async fn apply_pending_balance(
    client: &RpcClient,
    payer: &dyn Signer,
    authority: &dyn Signer,
    mint: &solana_sdk::pubkey::Pubkey,
) -> SigResult {
    let token_account = get_associated_token_address_with_program_id(
        &authority.pubkey(),
        mint,
        &spl_token_2022::id(),
    );

    // Derive encryption keys
    let elgamal_keypair = ElGamalKeypair::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;
    let aes_key = AeKey::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;

    // Fetch account state
    let account_data = client.get_account(&token_account)?;
    let account = StateWithExtensions::<TokenAccount>::unpack(&account_data.data)?;
    let ct_extension = account.get_extension::<ConfidentialTransferAccount>()?;

    // Decrypt current balances - note: decrypt_u32 is called ON the ciphertext
    let pending_balance_lo: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        ct_extension.pending_balance_lo.try_into()
            .map_err(|_| "Failed to convert pending_balance_lo")?;
    let pending_balance_hi: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        ct_extension.pending_balance_hi.try_into()
            .map_err(|_| "Failed to convert pending_balance_hi")?;
    let available_balance: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        ct_extension.available_balance.try_into()
            .map_err(|_| "Failed to convert available_balance")?;

    // Decrypt using ciphertext.decrypt_u32(secret)
    let pending_lo = pending_balance_lo.decrypt_u32(elgamal_keypair.secret())
        .ok_or("Failed to decrypt pending_balance_lo")?;
    let pending_hi = pending_balance_hi.decrypt_u32(elgamal_keypair.secret())
        .ok_or("Failed to decrypt pending_balance_hi")?;
    let current_available = available_balance.decrypt_u32(elgamal_keypair.secret())
        .ok_or("Failed to decrypt available_balance")?;

    // Calculate new available balance
    let pending_total = pending_lo + (pending_hi << 16);
    let new_available = current_available + pending_total;

    // Encrypt new available balance with AES for owner
    let new_decryptable_balance = aes_key.encrypt(new_available);

    // Get expected pending balance credit counter
    let expected_counter: u64 = ct_extension.pending_balance_credit_counter.into();

    let apply_ix = apply_pending_balance_instruction(
        &spl_token_2022::id(),
        &token_account,
        expected_counter,
        &new_decryptable_balance.into(),
        &authority.pubkey(),
        &[&authority.pubkey()],
    )?;

    let recent_blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &[apply_ix],
        Some(&payer.pubkey()),
        &[payer, authority],
        recent_blockhash,
    );

    let signature = client.send_and_confirm_transaction(&transaction)?;
    Ok(signature)
}
```

### 4. Confidential Transfer

Transfer tokens between accounts using zero-knowledge proofs. This is the most complex operation requiring multiple transactions and proof context state accounts:

```rust
use solana_client::rpc_client::RpcClient;
use solana_client::nonblocking::rpc_client::RpcClient as AsyncRpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::signature::{Keypair, Signer};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022::{
    extension::{
        confidential_transfer::{
            account_info::TransferAccountInfo,
            ConfidentialTransferAccount, ConfidentialTransferMint,
        },
        BaseStateWithExtensions, StateWithExtensions,
    },
    solana_zk_sdk::encryption::{
        auth_encryption::AeKey,
        elgamal::ElGamalKeypair,
        pod::elgamal::PodElGamalPubkey,
    },
    state::{Account as TokenAccount, Mint},
};
use spl_token_client::{
    client::{ProgramRpcClient, ProgramRpcClientSendTransaction, RpcClientResponse},
    token::{ProofAccountWithCiphertext, Token},
};
use std::sync::Arc;

fn extract_signature(response: RpcClientResponse) -> Result<solana_sdk::signature::Signature, Box<dyn std::error::Error>> {
    match response {
        RpcClientResponse::Signature(sig) => Ok(sig),
        _ => Err("Expected Signature response".into()),
    }
}

pub async fn transfer_confidential(
    client: &RpcClient,
    _payer: &dyn Signer,
    sender: &Keypair,  // Must be Keypair for token client
    mint: &solana_sdk::pubkey::Pubkey,
    recipient: &solana_sdk::pubkey::Pubkey,
    amount: u64,
) -> MultiSigResult {
    let sender_token_account = get_associated_token_address_with_program_id(
        &sender.pubkey(),
        mint,
        &spl_token_2022::id(),
    );
    let recipient_token_account = get_associated_token_address_with_program_id(
        recipient,
        mint,
        &spl_token_2022::id(),
    );

    // Get recipient's ElGamal public key
    let recipient_account_data = client.get_account(&recipient_token_account)?;
    let recipient_account = StateWithExtensions::<TokenAccount>::unpack(&recipient_account_data.data)?;
    let recipient_ct_extension = recipient_account.get_extension::<ConfidentialTransferAccount>()?;
    let recipient_elgamal_pubkey: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalPubkey =
        recipient_ct_extension.elgamal_pubkey.try_into()
            .map_err(|_| "Failed to convert recipient ElGamal pubkey")?;

    // Get auditor ElGamal public key from mint (if configured)
    let mint_account_data = client.get_account(mint)?;
    let mint_account = StateWithExtensions::<Mint>::unpack(&mint_account_data.data)?;
    let mint_ct_extension = mint_account.get_extension::<ConfidentialTransferMint>()?;
    let auditor_elgamal_pubkey: Option<spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalPubkey> =
        Option::<PodElGamalPubkey>::from(mint_ct_extension.auditor_elgamal_pubkey)
            .map(|pk| pk.try_into())
            .transpose()
            .map_err(|_| "Failed to convert auditor ElGamal pubkey")?;

    // Derive sender's encryption keys
    let sender_elgamal = ElGamalKeypair::new_from_signer(
        sender,
        &sender_token_account.to_bytes(),
    )?;
    let sender_aes = AeKey::new_from_signer(
        sender,
        &sender_token_account.to_bytes(),
    )?;

    // Fetch sender account and create transfer info
    let account_data = client.get_account(&sender_token_account)?;
    let account = StateWithExtensions::<TokenAccount>::unpack(&account_data.data)?;
    let ct_extension = account.get_extension::<ConfidentialTransferAccount>()?;
    let transfer_info = TransferAccountInfo::new(ct_extension);

    // Verify sufficient balance
    let available_balance: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        transfer_info.available_balance.try_into()
            .map_err(|_| "Failed to convert available_balance")?;
    let current_available = available_balance.decrypt_u32(sender_elgamal.secret())
        .ok_or("Failed to decrypt available balance")?;

    if current_available < amount {
        return Err(format!(
            "Insufficient balance: have {}, need {}",
            current_available, amount
        ).into());
    }

    // Generate split transfer proofs (equality, ciphertext validity, range)
    let proof_data = transfer_info.generate_split_transfer_proof_data(
        amount,
        &sender_elgamal,
        &sender_aes,
        &recipient_elgamal_pubkey,
        auditor_elgamal_pubkey.as_ref(),
    )?;

    // Create async client for Token operations
    let rpc_url = client.url();
    let async_client = Arc::new(AsyncRpcClient::new_with_commitment(
        rpc_url,
        CommitmentConfig::confirmed(),
    ));
    let program_client = Arc::new(ProgramRpcClient::new(
        async_client,
        ProgramRpcClientSendTransaction,
    ));

    // Clone sender for Arc (Token client requires ownership)
    let sender_clone = Keypair::new_from_array(*sender.secret_bytes());
    let sender_arc: Arc<dyn Signer> = Arc::new(sender_clone);

    let token = Token::new(
        program_client,
        &spl_token_2022::id(),
        mint,
        None,
        sender_arc,
    );

    // Create proof context state accounts
    let equality_proof_account = Keypair::new();
    let ciphertext_validity_proof_account = Keypair::new();
    let range_proof_account = Keypair::new();

    let mut signatures = Vec::new();

    // 1. Create equality proof context account
    let response = token.confidential_transfer_create_context_state_account(
        &equality_proof_account.pubkey(),
        &sender.pubkey(),
        &proof_data.equality_proof_data,
        false,
        &[&equality_proof_account],
    ).await?;
    signatures.push(extract_signature(response)?);

    // 2. Create ciphertext validity proof context account
    let response = token.confidential_transfer_create_context_state_account(
        &ciphertext_validity_proof_account.pubkey(),
        &sender.pubkey(),
        &proof_data.ciphertext_validity_proof_data_with_ciphertext.proof_data,
        false,
        &[&ciphertext_validity_proof_account],
    ).await?;
    signatures.push(extract_signature(response)?);

    // 3. Create range proof context account
    let response = token.confidential_transfer_create_context_state_account(
        &range_proof_account.pubkey(),
        &sender.pubkey(),
        &proof_data.range_proof_data,
        true,  // Range proof uses batched verification
        &[&range_proof_account],
    ).await?;
    signatures.push(extract_signature(response)?);

    // 4. Execute the confidential transfer
    let ciphertext_validity_proof = ProofAccountWithCiphertext {
        context_state_account: ciphertext_validity_proof_account.pubkey(),
        ciphertext_lo: proof_data.ciphertext_validity_proof_data_with_ciphertext.ciphertext_lo,
        ciphertext_hi: proof_data.ciphertext_validity_proof_data_with_ciphertext.ciphertext_hi,
    };

    let response = token.confidential_transfer_transfer(
        &sender_token_account,
        &recipient_token_account,
        &sender.pubkey(),
        Some(&equality_proof_account.pubkey()),
        Some(&ciphertext_validity_proof),
        Some(&range_proof_account.pubkey()),
        amount,
        None,
        &sender_elgamal,
        &sender_aes,
        &recipient_elgamal_pubkey,
        auditor_elgamal_pubkey.as_ref(),
        &[sender],
    ).await?;
    signatures.push(extract_signature(response)?);

    // 5. Close proof context accounts to reclaim rent
    let response = token.confidential_transfer_close_context_state_account(
        &equality_proof_account.pubkey(),
        &sender_token_account,
        &sender.pubkey(),
        &[sender],
    ).await?;
    signatures.push(extract_signature(response)?);

    let response = token.confidential_transfer_close_context_state_account(
        &ciphertext_validity_proof_account.pubkey(),
        &sender_token_account,
        &sender.pubkey(),
        &[sender],
    ).await?;
    signatures.push(extract_signature(response)?);

    let response = token.confidential_transfer_close_context_state_account(
        &range_proof_account.pubkey(),
        &sender_token_account,
        &sender.pubkey(),
        &[sender],
    ).await?;
    signatures.push(extract_signature(response)?);

    Ok(signatures)
}
```

### 5. Withdraw from Confidential Balance

Move tokens from available confidential balance back to public balance:

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::{signature::Signer, transaction::Transaction};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token_2022::{
    extension::{
        confidential_transfer::{
            account_info::WithdrawAccountInfo,
            instruction::withdraw,
            ConfidentialTransferAccount,
        },
        BaseStateWithExtensions, StateWithExtensions,
    },
    solana_zk_sdk::encryption::{auth_encryption::AeKey, elgamal::ElGamalKeypair},
    state::Account as TokenAccount,
};
use spl_token_confidential_transfer_proof_extraction::instruction::ProofLocation;

pub async fn withdraw_from_confidential(
    client: &RpcClient,
    payer: &dyn Signer,
    authority: &dyn Signer,
    mint: &solana_sdk::pubkey::Pubkey,
    amount: u64,
    decimals: u8,
) -> SigResult {
    let token_account = get_associated_token_address_with_program_id(
        &authority.pubkey(),
        mint,
        &spl_token_2022::id(),
    );

    // Derive encryption keys
    let elgamal_keypair = ElGamalKeypair::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;
    let aes_key = AeKey::new_from_signer(
        authority,
        &token_account.to_bytes(),
    )?;

    // Fetch account state
    let account_data = client.get_account(&token_account)?;
    let account = StateWithExtensions::<TokenAccount>::unpack(&account_data.data)?;
    let ct_extension = account.get_extension::<ConfidentialTransferAccount>()?;

    // Create withdraw account info helper
    let withdraw_info = WithdrawAccountInfo::new(ct_extension);

    // Decrypt available balance to verify sufficiency
    let available_balance: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        withdraw_info.available_balance.try_into()
            .map_err(|_| "Failed to convert available_balance")?;
    let current_available = available_balance.decrypt_u32(elgamal_keypair.secret())
        .ok_or("Failed to decrypt available balance")?;

    if current_available < amount {
        return Err(format!(
            "Insufficient confidential balance: have {}, need {}",
            current_available, amount
        ).into());
    }

    // Generate withdrawal proofs using the helper
    let proof_data = withdraw_info.generate_proof_data(
        amount,
        &elgamal_keypair,
        &aes_key,
    )?;

    // Calculate new decryptable available balance after withdrawal
    let new_available = current_available - amount;
    let new_decryptable_balance = aes_key.encrypt(new_available);

    // Build withdraw instruction with two proof locations (equality + range)
    let withdraw_instructions = withdraw(
        &spl_token_2022::id(),
        &token_account,
        mint,
        amount,
        decimals,
        &new_decryptable_balance.into(),
        &authority.pubkey(),
        &[&authority.pubkey()],
        ProofLocation::InstructionOffset(1.try_into().unwrap(), &proof_data.equality_proof_data),
        ProofLocation::InstructionOffset(2.try_into().unwrap(), &proof_data.range_proof_data),
    )?;

    let recent_blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        &withdraw_instructions,
        Some(&payer.pubkey()),
        &[payer, authority],
        recent_blockhash,
    );

    let signature = client.send_and_confirm_transaction(&transaction)?;
    Ok(signature)
}
```

## Reading Balances

To read and decrypt all balance types:

```rust
pub fn get_confidential_balances(
    client: &RpcClient,
    authority: &dyn Signer,
    mint: &solana_sdk::pubkey::Pubkey,
) -> Result<(u64, u64, u64), Box<dyn std::error::Error>> {
    let token_account = get_associated_token_address_with_program_id(
        &authority.pubkey(),
        mint,
        &spl_token_2022::id(),
    );

    let elgamal_keypair = ElGamalKeypair::new_from_signer(authority, &token_account.to_bytes())?;
    let aes_key = AeKey::new_from_signer(authority, &token_account.to_bytes())?;

    let account_data = client.get_account(&token_account)?;
    let account = StateWithExtensions::<TokenAccount>::unpack(&account_data.data)?;
    let ct_extension = account.get_extension::<ConfidentialTransferAccount>()?;

    // Public balance (visible to all)
    let public_balance = account.base.amount;

    // Pending balance (decrypt with ElGamal) - note method is on ciphertext
    let pending_lo_ct: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        ct_extension.pending_balance_lo.try_into()?;
    let pending_hi_ct: spl_token_2022::solana_zk_sdk::encryption::elgamal::ElGamalCiphertext =
        ct_extension.pending_balance_hi.try_into()?;

    let pending_lo = pending_lo_ct.decrypt_u32(elgamal_keypair.secret()).unwrap_or(0) as u64;
    let pending_hi = pending_hi_ct.decrypt_u32(elgamal_keypair.secret()).unwrap_or(0) as u64;
    let pending_balance = pending_lo + (pending_hi << 16);

    // Available balance (decrypt with AES - only owner can see)
    let available_balance = aes_key.decrypt(&ct_extension.decryptable_available_balance.try_into()?)?;

    Ok((public_balance, pending_balance, available_balance))
}
```

## Security Considerations

- **Key derivation is deterministic**: The same keypair always produces the same encryption keys for a given token account. This enables recovery but means keypair compromise exposes all confidential balances.
- **Auditor keys**: Mints can configure an auditor ElGamal public key that can decrypt all transfer amounts (but not balances).
- **Pending balance limits**: The `max_pending_balance_credit_counter` limits how many incoming transfers can accumulate before `apply_pending` must be called.
- **Proof verification**: All proofs are verified by the ZK ElGamal Proof Program onchain (`ZkE1Gama1Proof11111111111111111111111111111`).

## Reference Implementation

For complete working examples including mint creation, see:
https://github.com/gitteri/confidential-balances-exploration (Rust) and
https://github.com/catmcgee/confidential-transfers-explorer (TypeScript)

## Limitations

- Currently only works on ZK-Edge testnet (`https://zk-edge.surfnet.dev/`)
- Transfer operations require multiple transactions (7 total) due to proof size. This will be lower when larger transactions are merged into mainnet
- Proof generation can be computationally intensive (client-side)
- Sender must be a `Keypair` (not generic `Signer`) for transfers due to token client requirements
