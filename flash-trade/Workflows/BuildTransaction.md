# BuildTransaction Workflow

How to build, sign, and submit Flash Trade transactions via the REST API.

## Transaction Flow

```
1. POST /transaction-builder/{action}  →  Preview + unsigned base64 transaction
2. Decode base64                       →  VersionedTransaction bytes
3. Sign with wallet keypair            →  Signed transaction
4. Send to Solana RPC                  →  Transaction signature
5. Confirm on-chain                    →  Done
```

**Critical:** Blockhashes expire in ~60 seconds. Sign and submit promptly after step 1.

## Open Position

```bash
curl -X POST $FLASH_API_URL/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG",
    "owner": "<WALLET_PUBKEY>",
    "slippagePercentage": "0.5",
    "takeProfit": "160.00",
    "stopLoss": "130.00"
  }'
```

**Response includes:** `newEntryPrice`, `newLeverage`, `newLiquidationPrice`, `entryFee`, `marginFeePercentage`, `transactionBase64`, `takeProfitQuote`, `stopLossQuote`

**Options:**
- Add `"orderType": "LIMIT", "limitPrice": "140.00"` for limit orders
- Add `"degenMode": true` for >100x leverage
- Omit `owner` for preview-only (no transaction built)
- Set `takeProfit` and/or `stopLoss` to include trigger orders in the same transaction
- Add `"tradingFeeDiscountPercent": 10.0` with `"tokenStakeFafAccount": "<pubkey>"` for fee discounts

## Close Position

```bash
curl -X POST $FLASH_API_URL/transaction-builder/close-position \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_PUBKEY>",
    "inputUsdUi": "500.00",
    "withdrawTokenSymbol": "USDC",
    "slippagePercentage": "0.5"
  }'
```

**Response includes:** `markPrice`, `entryPrice`, `settledPnl`, `fees`, `receiveTokenAmountUi`, `transactionBase64`

**Partial close:** Set `inputUsdUi` to less than the full position size. Add `"keepLeverageSame": true` to maintain leverage ratio.

## Reverse Position

```bash
curl -X POST $FLASH_API_URL/transaction-builder/reverse-position \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_PUBKEY>",
    "owner": "<WALLET_PUBKEY>",
    "slippagePercentage": "0.5"
  }'
```

Atomically closes the current position and opens an opposite-direction position with the same collateral.

## Add / Remove Collateral

```bash
# Add collateral (reduce leverage)
curl -X POST $FLASH_API_URL/transaction-builder/add-collateral \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_PUBKEY>",
    "depositAmountUi": "50.0",
    "depositTokenSymbol": "USDC",
    "owner": "<WALLET_PUBKEY>"
  }'

# Remove collateral (increase leverage)
curl -X POST $FLASH_API_URL/transaction-builder/remove-collateral \
  -H "Content-Type: application/json" \
  -d '{
    "positionKey": "<POSITION_PUBKEY>",
    "withdrawAmountUsdUi": "25.00",
    "withdrawTokenSymbol": "USDC",
    "owner": "<WALLET_PUBKEY>"
  }'
```

## Trigger Orders (TP/SL)

```bash
# Place take-profit
curl -X POST $FLASH_API_URL/transaction-builder/place-trigger-order \
  -H "Content-Type: application/json" \
  -d '{
    "marketSymbol": "SOL",
    "side": "LONG",
    "triggerPriceUi": "160.00",
    "sizeAmountUi": "0.5",
    "isStopLoss": false,
    "owner": "<WALLET_PUBKEY>"
  }'

# Edit trigger order
curl -X POST $FLASH_API_URL/transaction-builder/edit-trigger-order \
  -H "Content-Type: application/json" \
  -d '{
    "marketSymbol": "SOL",
    "side": "LONG",
    "orderId": 0,
    "triggerPriceUi": "165.00",
    "sizeAmountUi": "0.5",
    "isStopLoss": false,
    "owner": "<WALLET_PUBKEY>"
  }'

# Cancel trigger order
curl -X POST $FLASH_API_URL/transaction-builder/cancel-trigger-order \
  -H "Content-Type: application/json" \
  -d '{
    "marketSymbol": "SOL",
    "side": "LONG",
    "orderId": 0,
    "isStopLoss": false,
    "owner": "<WALLET_PUBKEY>"
  }'

# Cancel all trigger orders for a market+side
curl -X POST $FLASH_API_URL/transaction-builder/cancel-all-trigger-orders \
  -H "Content-Type: application/json" \
  -d '{
    "marketSymbol": "SOL",
    "side": "LONG",
    "owner": "<WALLET_PUBKEY>"
  }'
```

## Signing & Submitting

See [TransactionFlow.md](../TransactionFlow.md) for complete signing examples in TypeScript, Python, and shell.

**Quick reference (TypeScript):**

```typescript
import { Connection, VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// 1. Build transaction via API (POST to transaction-builder endpoint)
const response = await fetch(`${FLASH_API_URL}/transaction-builder/open-position`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(request),
});
const { transactionBase64 } = await response.json();

// 2. Decode and sign
const txBytes = Buffer.from(transactionBase64, "base64");
const tx = VersionedTransaction.deserialize(txBytes);
tx.sign([keypair]);

// 3. Submit
const connection = new Connection(SOLANA_RPC_URL);
const signature = await connection.sendRawTransaction(tx.serialize(), {
  skipPreflight: false,
  maxRetries: 3,
});

// 4. Confirm
await connection.confirmTransaction(signature, "confirmed");
```

## Error Recovery

- **"Blockhash not found"** — Re-call the transaction builder endpoint for a fresh transaction, then sign immediately.
- **Error 6020 (MaxPriceSlippage)** — Widen slippage tolerance or retry with fresh price.
- **Error 6034 (MinCollateral)** — Increase collateral amount (use $11-12+ for TP/SL).
- **Error 6033 (CloseOnlyMode)** — Market only allows close operations.

See [ErrorReference.md](../ErrorReference.md) for all 69 error codes.
