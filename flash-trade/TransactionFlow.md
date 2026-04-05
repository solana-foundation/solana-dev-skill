# Transaction Flow

How to build, sign, and submit transactions using the Flash Trade REST API.

## Overview

Every trade on Flash Trade follows a five-step flow. The API builds the transaction server-side; your client signs and submits it.

```
 1. BUILD          POST /transaction-builder/{action}
                   Send trade parameters, receive preview + unsigned tx
                              |
 2. DECODE         Base64 decode -> deserialize VersionedTransaction (v0)
                              |
 3. SIGN           Sign with wallet keypair (the tx is UNSIGNED)
                              |
 4. SUBMIT         sendRawTransaction to Solana RPC
                              |
 5. CONFIRM        Poll or subscribe for transaction confirmation
```

> **CRITICAL: Blockhash expiry.** The returned transaction contains a recent blockhash that expires in approximately 60 seconds. You must sign and submit promptly after receiving the transaction. If you delay, the blockhash will expire and the transaction will fail. See [Blockhash Expiry](#blockhash-expiry) for recovery strategies.

## Step 1: Build Transaction

POST to `/transaction-builder/{action}` with your trade parameters. The API returns preview data (fees, prices, leverage, liquidation levels) and a base64-encoded unsigned `VersionedTransaction`.

### Available Actions

| Endpoint | Purpose |
|----------|---------|
| `/transaction-builder/open-position` | Open a new position (market or limit) |
| `/transaction-builder/close-position` | Close or partially close a position |
| `/transaction-builder/reverse-position` | Close + open opposite direction |
| `/transaction-builder/add-collateral` | Add margin to reduce leverage |
| `/transaction-builder/remove-collateral` | Withdraw margin to increase leverage |
| `/transaction-builder/place-trigger-order` | Place a take-profit or stop-loss |
| `/transaction-builder/edit-trigger-order` | Modify an existing TP/SL |
| `/transaction-builder/cancel-trigger-order` | Cancel a single TP/SL |
| `/transaction-builder/cancel-all-trigger-orders` | Cancel all TP/SL for a market+side |

### Example Request: Open Position

```bash
curl -X POST https://flashapi.trade/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG",
    "owner": "YourWa11etPubkeyHere1111111111111111111111111",
    "slippagePercentage": "0.5"
  }'
```

### Open Position Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inputTokenSymbol` | string | Yes | Token to pay with: `"USDC"`, `"SOL"`, etc. |
| `outputTokenSymbol` | string | Yes | Market to trade: `"SOL"`, `"BTC"`, `"ETH"`, etc. |
| `inputAmountUi` | string | Yes | Amount of input token in UI format, e.g. `"100.0"` |
| `leverage` | number | Yes | Leverage multiplier, e.g. `5.0` |
| `tradeType` | string | Yes | `"LONG"` or `"SHORT"` |
| `owner` | string | No | Wallet pubkey. **Omit to get preview-only (no transaction built).** |
| `orderType` | string | No | `"MARKET"` (default) or `"LIMIT"` |
| `limitPrice` | string | No | Required for `LIMIT` orders. Trigger price in UI format. |
| `slippagePercentage` | string | No | Default `"0.5"` (0.5%). Increase for volatile markets. |
| `takeProfit` | string | No | TP trigger price in UI format. |
| `stopLoss` | string | No | SL trigger price in UI format. |
| `degenMode` | boolean | No | Enable higher leverage limits. |
| `tradingFeeDiscountPercent` | number | No | Fee discount percentage if applicable. |

### Open Position Response

```json
{
  "newEntryPrice": "148.52",
  "newLeverage": "4.95",
  "newLiquidationPrice": "119.82",
  "entryFee": "0.30",
  "entryFeeBeforeDiscount": "0.30",
  "openPositionFeePercent": "0.06",
  "availableLiquidity": "12485023.50",
  "youPayUsdUi": "100.00",
  "youRecieveUsdUi": "495.00",
  "marginFeePercentage": "0.0042",
  "outputAmount": "3333333",
  "outputAmountUi": "3.33",
  "transactionBase64": "AQAAAA...long base64 string...AAAA==",
  "takeProfitQuote": null,
  "stopLossQuote": null,
  "err": null
}
```

### Response Fields Explained

| Field | Description |
|-------|-------------|
| `newEntryPrice` | Entry price for the position in USD |
| `newLeverage` | Effective leverage after fees |
| `newLiquidationPrice` | Price at which the position gets liquidated |
| `entryFee` | Fee charged in USD |
| `openPositionFeePercent` | Fee as a percentage of position size |
| `youPayUsdUi` | Total USD value of collateral deposited |
| `youRecieveUsdUi` | Total position size in USD |
| `marginFeePercentage` | Hourly borrow rate for leveraged positions |
| `outputAmountUi` | Position size in the output token |
| `transactionBase64` | Base64-encoded unsigned `VersionedTransaction`. **Only present when `owner` is provided.** |
| `oldEntryPrice` / `oldLeverage` | Present when adding to an existing position |
| `takeProfitQuote` | TP preview if `takeProfit` was specified |
| `stopLossQuote` | SL preview if `stopLoss` was specified |
| `err` | Error or warning message from the API, if any |

### Close Position Response

```json
{
  "receiveTokenSymbol": "USDC",
  "receiveTokenAmountUi": "102.35",
  "receiveTokenAmountUsdUi": "102.35",
  "markPrice": "150.20",
  "entryPrice": "148.52",
  "existingSize": "495.00",
  "newSize": "0.00",
  "existingCollateral": "99.70",
  "newCollateral": "0.00",
  "existingLeverage": "4.95",
  "newLeverage": "0.00",
  "existingLiquidationPrice": "119.82",
  "newLiquidationPrice": "0.00",
  "settledPnl": "5.60",
  "fees": "0.30",
  "feesBeforeDiscount": "0.30",
  "transactionBase64": "AQAAAA...base64...AAAA=="
}
```

## Step 2: Decode and Sign

The `transactionBase64` field contains a base64-encoded `VersionedTransaction` (v0 format, NOT legacy). You must:
1. Base64-decode the string into raw bytes
2. Deserialize into a `VersionedTransaction` object
3. Sign with the wallet keypair

> **Do NOT replace the blockhash.** The API may include pre-signed additional signers (e.g., ephemeral WSOL keypairs). Replacing the blockhash would invalidate those signatures.

### TypeScript (@solana/web3.js)

```typescript
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";

// Decode the base64 transaction
const txBytes = Buffer.from(response.transactionBase64, "base64");
const transaction = VersionedTransaction.deserialize(txBytes);

// Sign with your keypair
const keypair = Keypair.fromSecretKey(/* your secret key bytes */);
transaction.sign([keypair]);
```

> **Browser note:** `Buffer` is a Node.js API. In the browser, use `Uint8Array.from(atob(base64), c => c.charCodeAt(0))` instead. See the [Browser Wallet](#browser-wallet-solanawallet-adapter) section below for browser-compatible signing.

### Browser Wallet (@solana/wallet-adapter)

For React/Next.js apps where the user signs with their browser wallet (Phantom, Solflare, etc.):

```typescript
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

const { signTransaction } = useWallet();
const { connection } = useConnection();

// Decode the base64 transaction (browser-compatible — no Buffer needed)
const txBytes = Uint8Array.from(atob(response.transactionBase64), c => c.charCodeAt(0));
const transaction = VersionedTransaction.deserialize(txBytes);

// Sign with the user's browser wallet (returns a new signed transaction)
const signedTx = await signTransaction!(transaction);

// Submit
const signature = await connection.sendRawTransaction(signedTx.serialize(), {
  skipPreflight: false,
  maxRetries: 3,
});

// Confirm
await connection.confirmTransaction(signature, "confirmed");
```

**Key differences from server-side signing:**
- Browser wallets use `wallet.signTransaction(tx)` which returns a new signed transaction — NOT `tx.sign([keypair])`
- You do NOT have access to the private key — the wallet extension handles signing
- Use `Uint8Array.from(atob(...))` instead of `Buffer.from(...)` for browser compatibility
- The `signTransaction` function may throw if the user rejects the signing prompt

### Python (solders)

```python
import base64
from solders.transaction import VersionedTransaction
from solders.keypair import Keypair

# Decode the base64 transaction
tx_bytes = base64.b64decode(response["transactionBase64"])
transaction = VersionedTransaction.from_bytes(tx_bytes)

# Sign with your keypair
keypair = Keypair.from_bytes(secret_key_bytes)
signed_tx = VersionedTransaction(transaction.message, [keypair])
```

> **Note:** The `solders` library is the modern, recommended way to handle Solana transactions in Python. It provides native Rust-backed types that are significantly faster than the older `solana-py` library. Install with `pip install solders`.

### cURL / Shell

For shell-based workflows, you can decode the base64 and use a signing tool:

```bash
# Save the base64 transaction to a file
echo "$TRANSACTION_BASE64" | base64 --decode > unsigned_tx.bin

# Sign using solana CLI (if your keypair is configured)
# Note: The Solana CLI does not natively sign pre-built VersionedTransactions.
# You will need a helper script or tool. See the Complete Examples section.
```

## Step 3: Submit to Solana

After signing, serialize the transaction and send it to a Solana RPC node.

### TypeScript

```typescript
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// Send the signed transaction
const signature = await connection.sendRawTransaction(transaction.serialize(), {
  skipPreflight: false,
  preflightCommitment: "confirmed",
});

console.log(`Transaction sent: ${signature}`);
console.log(`Explorer: https://solscan.io/tx/${signature}`);
```

### Python

```python
from solders.rpc.requests import SendRawTransaction
from solana.rpc.api import Client

client = Client("https://api.mainnet-beta.solana.com")

# Send the signed transaction
result = client.send_raw_transaction(
    bytes(signed_tx),
    opts={"skip_preflight": False, "preflight_commitment": "confirmed"},
)
signature = str(result.value)
print(f"Transaction sent: {signature}")
print(f"Explorer: https://solscan.io/tx/{signature}")
```

### Confirmation Strategies

After sending, confirm the transaction landed on-chain:

```typescript
// Strategy 1: confirmTransaction (recommended)
const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
const confirmation = await connection.confirmTransaction(
  {
    signature,
    blockhash,
    lastValidBlockHeight,
  },
  "confirmed"
);

if (confirmation.value.err) {
  console.error("Transaction failed on-chain:", confirmation.value.err);
} else {
  console.log("Transaction confirmed!");
}

// Strategy 2: Poll with getSignatureStatuses (for more control)
let status = null;
while (!status) {
  const response = await connection.getSignatureStatuses([signature]);
  status = response.value[0];
  if (!status) await new Promise((r) => setTimeout(r, 1000));
}
```

For production use, implement retry logic with a timeout based on `lastValidBlockHeight`. If the block height is exceeded without confirmation, the transaction has expired and you must rebuild it.

## Preview-Only Mode

To get just the preview data (fees, entry price, leverage, liquidation price) without building a transaction, **omit the `owner` field** from the request.

```bash
curl -X POST https://flashapi.trade/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG"
  }'
```

The response will contain all preview fields (`newEntryPrice`, `newLeverage`, `entryFee`, etc.) but `transactionBase64` will be `null`.

This is useful for:
- Displaying quotes to users before they commit
- Polling for real-time price/fee updates (the Flash Trade UI polls every 5 seconds)
- Calculating position parameters without wallet connection
- Building trading UIs where the user reviews before signing

## Blockhash Expiry

Solana transactions include a `recentBlockhash` that expires after approximately 60 seconds (~150 slots). If the blockhash expires before the transaction is confirmed, it will be rejected by the network.

### Symptoms

- Error: `"Blockhash not found"`
- Error: `"block height exceeded"`
- The transaction simply never confirms

### Prevention

1. **Sign and submit immediately** after receiving the transaction from the API. Do not insert delays, user prompts, or additional network calls between receiving the transaction and submitting it.
2. **Do not cache transactions.** Always request a fresh transaction right before you need to submit it.
3. **Show the preview first, then build the transaction.** Use preview-only mode (omit `owner`) to show the user fees and prices. When they approve, make a second request with `owner` included, and submit immediately.

### Recovery

If you encounter a blockhash expiry error:

```typescript
async function executeWithRetry(buildTransaction: () => Promise<Response>, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await buildTransaction();
    const data = await response.json();

    if (!data.transactionBase64) {
      throw new Error(data.err || "No transaction returned");
    }

    const txBytes = Buffer.from(data.transactionBase64, "base64");
    const transaction = VersionedTransaction.deserialize(txBytes);
    transaction.sign([keypair]);

    try {
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      if (confirmation.value.err) {
        throw new Error(`On-chain failure: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (error: any) {
      const isExpired =
        error.message?.includes("Blockhash not found") ||
        error.message?.includes("block height exceeded");

      if (isExpired && attempt < maxRetries) {
        console.warn(`Blockhash expired, rebuilding transaction (attempt ${attempt + 2}/${maxRetries + 1})`);
        continue; // Re-fetch a fresh transaction from the API
      }
      throw error;
    }
  }
}
```

## Error Handling

### Common Transaction Errors

| Error | Cause | Recovery |
|-------|-------|----------|
| `Blockhash not found` | Transaction took too long to submit (~60s) | Rebuild the transaction and submit immediately |
| `block height exceeded` | Same as above, caught during confirmation | Rebuild the transaction and submit immediately |
| `Cannot sign with non signer key` | Transaction was built for a different wallet than the signing keypair | Rebuild with the correct `owner` matching your keypair |
| `Insufficient funds` | Wallet does not have enough of the input token | Check balance, reduce amount |
| `Transaction simulation failed` | On-chain program rejected the transaction | Check the inner error logs for details (insufficient liquidity, invalid parameters, etc.) |
| `Custom program error: 0x...` | Flash Trade program error | Decode the hex error code against the Flash Trade IDL |

### API-Level Errors

The `err` field in the response may contain warnings even when a transaction is returned:

```json
{
  "transactionBase64": "AQAAAA...AAAA==",
  "err": "Position size exceeds available liquidity for this market"
}
```

Always check the `err` field before proceeding. Some warnings are informational (the transaction may still succeed), while others indicate the transaction will fail on-chain.

### Signer Mismatch

The most common integration error is a signer mismatch. The `owner` field in your request must exactly match the public key of the keypair you sign with. If they differ, the transaction will fail with `Cannot sign with non signer key`.

```typescript
// Ensure owner matches your signing keypair
const owner = keypair.publicKey.toBase58();
const response = await fetch(`${API_URL}/transaction-builder/open-position`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    inputTokenSymbol: "USDC",
    outputTokenSymbol: "SOL",
    inputAmountUi: "100.0",
    leverage: 5.0,
    tradeType: "LONG",
    owner, // Must match the signing keypair
  }),
});
```

## Complete Examples

### TypeScript (Full Working Example)

```typescript
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import fs from "fs";

// --- Configuration ---
const API_URL = "https://flashapi.trade";
const RPC_URL = "https://api.mainnet-beta.solana.com";

// Load keypair from file (standard Solana CLI format)
const keypairData = JSON.parse(fs.readFileSync("~/.config/solana/id.json", "utf-8"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
const owner = keypair.publicKey.toBase58();

const connection = new Connection(RPC_URL, "confirmed");

// --- Step 1: Build the transaction ---
async function openPosition() {
  const response = await fetch(`${API_URL}/transaction-builder/open-position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inputTokenSymbol: "USDC",
      outputTokenSymbol: "SOL",
      inputAmountUi: "50.0",
      leverage: 3.0,
      tradeType: "LONG",
      owner,
      slippagePercentage: "0.5",
    }),
  });

  const data = await response.json();

  // --- Check for errors ---
  if (data.err) {
    console.warn("API warning:", data.err);
  }
  if (!data.transactionBase64) {
    throw new Error("No transaction returned. Check the err field.");
  }

  // --- Display preview ---
  console.log("=== Trade Preview ===");
  console.log(`Entry Price:      $${data.newEntryPrice}`);
  console.log(`Position Size:    $${data.youRecieveUsdUi} (${data.outputAmountUi} SOL)`);
  console.log(`Collateral:       $${data.youPayUsdUi}`);
  console.log(`Leverage:         ${data.newLeverage}x`);
  console.log(`Liquidation:      $${data.newLiquidationPrice}`);
  console.log(`Entry Fee:        $${data.entryFee} (${data.openPositionFeePercent}%)`);
  console.log(`Hourly Borrow:    ${data.marginFeePercentage}%`);

  // --- Step 2: Decode and sign ---
  const txBytes = Buffer.from(data.transactionBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBytes);
  transaction.sign([keypair]);

  // --- Step 3: Submit ---
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  console.log(`\nTransaction sent: ${signature}`);
  console.log(`Explorer: https://solscan.io/tx/${signature}`);

  // --- Step 4: Confirm ---
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new Error(`Transaction failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
  }

  console.log("Transaction confirmed!");
  return signature;
}

openPosition().catch(console.error);
```

### Python (Full Working Example)

```python
"""
Flash Trade transaction flow using solders + httpx.

Install dependencies:
    pip install solders httpx
"""

import base64
import json
import httpx
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction
from solana.rpc.api import Client

# --- Configuration ---
API_URL = "https://flashapi.trade"
RPC_URL = "https://api.mainnet-beta.solana.com"

# Load keypair from file (standard Solana CLI JSON format)
with open("~/.config/solana/id.json") as f:
    secret_key_bytes = bytes(json.load(f))
keypair = Keypair.from_bytes(secret_key_bytes)
owner = str(keypair.pubkey())

client = Client(RPC_URL)


def open_position():
    # --- Step 1: Build the transaction ---
    response = httpx.post(
        f"{API_URL}/transaction-builder/open-position",
        json={
            "inputTokenSymbol": "USDC",
            "outputTokenSymbol": "SOL",
            "inputAmountUi": "50.0",
            "leverage": 3.0,
            "tradeType": "LONG",
            "owner": owner,
            "slippagePercentage": "0.5",
        },
    )
    response.raise_for_status()
    data = response.json()

    # --- Check for errors ---
    if data.get("err"):
        print(f"API warning: {data['err']}")
    if not data.get("transactionBase64"):
        raise RuntimeError("No transaction returned. Check the err field.")

    # --- Display preview ---
    print("=== Trade Preview ===")
    print(f"Entry Price:      ${data['newEntryPrice']}")
    print(f"Position Size:    ${data['youRecieveUsdUi']} ({data['outputAmountUi']} SOL)")
    print(f"Collateral:       ${data['youPayUsdUi']}")
    print(f"Leverage:         {data['newLeverage']}x")
    print(f"Liquidation:      ${data['newLiquidationPrice']}")
    print(f"Entry Fee:        ${data['entryFee']} ({data['openPositionFeePercent']}%)")
    print(f"Hourly Borrow:    {data['marginFeePercentage']}%")

    # --- Step 2: Decode and sign ---
    tx_bytes = base64.b64decode(data["transactionBase64"])
    unsigned_tx = VersionedTransaction.from_bytes(tx_bytes)

    # solders requires constructing a new VersionedTransaction with signers
    signed_tx = VersionedTransaction(unsigned_tx.message, [keypair])

    # --- Step 3: Submit ---
    result = client.send_raw_transaction(bytes(signed_tx))
    signature = str(result.value)

    print(f"\nTransaction sent: {signature}")
    print(f"Explorer: https://solscan.io/tx/{signature}")

    # --- Step 4: Confirm ---
    # solana-py's send_raw_transaction with default opts will preflight check.
    # For explicit confirmation:
    confirmation = client.confirm_transaction(
        result.value,
        commitment="confirmed",
    )

    if confirmation.value[0].err:
        raise RuntimeError(f"Transaction failed on-chain: {confirmation.value[0].err}")

    print("Transaction confirmed!")
    return signature


if __name__ == "__main__":
    open_position()
```

### cURL + Node.js Signing Script

For environments where you want to use cURL for the API call and a minimal script for signing:

```bash
#!/bin/bash
# flash-trade.sh — Build, sign, and submit a Flash Trade transaction

API_URL="https://flashapi.trade"
RPC_URL="https://api.mainnet-beta.solana.com"
KEYPAIR_PATH="$HOME/.config/solana/id.json"

# Step 1: Build the transaction via API
echo "Building transaction..."
RESPONSE=$(curl -s -X POST "$API_URL/transaction-builder/open-position" \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "50.0",
    "leverage": 3.0,
    "tradeType": "LONG",
    "owner": "'"$WALLET_PUBKEY"'",
    "slippagePercentage": "0.5"
  }')

# Extract preview data
echo "=== Trade Preview ==="
echo "$RESPONSE" | jq -r '"Entry Price:   $\(.newEntryPrice)
Position Size: $\(.youRecieveUsdUi)
Collateral:    $\(.youPayUsdUi)
Leverage:      \(.newLeverage)x
Liq Price:     $\(.newLiquidationPrice)
Entry Fee:     $\(.entryFee) (\(.openPositionFeePercent)%)"'

# Extract the base64 transaction
TX_BASE64=$(echo "$RESPONSE" | jq -r '.transactionBase64')
if [ "$TX_BASE64" = "null" ] || [ -z "$TX_BASE64" ]; then
  echo "ERROR: No transaction returned"
  echo "$RESPONSE" | jq -r '.err // "Unknown error"'
  exit 1
fi

# Step 2 & 3: Sign and submit using a Node.js one-liner
echo ""
echo "Signing and submitting..."
node -e "
const { Connection, Keypair, VersionedTransaction } = require('@solana/web3.js');
const fs = require('fs');

(async () => {
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync('$KEYPAIR_PATH', 'utf-8')))
  );
  const tx = VersionedTransaction.deserialize(
    Buffer.from('$TX_BASE64', 'base64')
  );
  tx.sign([keypair]);

  const connection = new Connection('$RPC_URL', 'confirmed');
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  });

  console.log('Signature:', sig);
  console.log('Explorer: https://solscan.io/tx/' + sig);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const conf = await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  );

  if (conf.value.err) {
    console.error('FAILED:', JSON.stringify(conf.value.err));
    process.exit(1);
  }
  console.log('Confirmed!');
})();
"
```

### Close Position Example (TypeScript)

```typescript
import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import fs from "fs";

const API_URL = "https://flashapi.trade";
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

const keypairData = JSON.parse(fs.readFileSync("~/.config/solana/id.json", "utf-8"));
const keypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

async function closePosition(positionKey: string, sizeUsd: string) {
  // Step 1: Build close transaction
  const response = await fetch(`${API_URL}/transaction-builder/close-position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      positionKey,
      inputUsdUi: sizeUsd,        // Full position size for full close
      withdrawTokenSymbol: "USDC", // Token to receive proceeds in
      slippagePercentage: "0.5",
    }),
  });

  const data = await response.json();

  console.log("=== Close Preview ===");
  console.log(`Mark Price:    $${data.markPrice}`);
  console.log(`Entry Price:   $${data.entryPrice}`);
  console.log(`PnL:           $${data.settledPnl}`);
  console.log(`Receive:       ${data.receiveTokenAmountUi} ${data.receiveTokenSymbol} ($${data.receiveTokenAmountUsdUi})`);
  console.log(`Fees:          $${data.fees}`);

  if (!data.transactionBase64) {
    throw new Error(data.err || "No transaction returned");
  }

  // Steps 2-4: Decode, sign, submit, confirm
  const tx = VersionedTransaction.deserialize(Buffer.from(data.transactionBase64, "base64"));
  tx.sign([keypair]);

  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");

  console.log(`\nPosition closed: https://solscan.io/tx/${signature}`);
}

// Usage: pass the position account pubkey and USD amount to close
closePosition("YourPositionPubkey111111111111111111111111111", "495.00");
```

## Key Notes

- **VersionedTransaction (v0), NOT legacy.** The API returns v0 transactions. Use `VersionedTransaction.deserialize()`, not `Transaction.from()`.
- **Transactions are unsigned.** The API builds the transaction but does not sign it. Your client must sign before submitting.
- **Do NOT modify the blockhash.** The transaction may contain pre-signed additional signers (e.g., ephemeral WSOL token accounts). Changing the blockhash would invalidate their signatures.
- **Amounts are in UI format.** Use human-readable strings like `"100.0"`, not native lamport/smallest-unit integers.
- **SOL positions use JitoSOL** as underlying collateral on-chain. This is handled automatically by the API.
- **Minimum $11 for TP/SL.** If you plan to set take-profit or stop-loss, use at least $11-12 input amount. Entry fees reduce collateral, and TP/SL orders require >$10 collateral after fees.
- **`youRecieveUsdUi` is intentionally misspelled** in the API response (matches the Rust backend field name). Do not attempt to correct it.
