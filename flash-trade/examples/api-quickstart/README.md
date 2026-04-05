# API Quick Start Examples

Getting started with the Flash Trade REST API in multiple languages.

## cURL

```bash
export FLASH_API_URL="https://flashapi.trade"

# 1. Check health
curl $FLASH_API_URL/health

# 2. Get all prices
curl $FLASH_API_URL/prices

# 3. Get SOL price
curl $FLASH_API_URL/prices/SOL

# 4. Get markets
curl $FLASH_API_URL/raw/markets

# 5. Get positions for a wallet
curl "$FLASH_API_URL/positions/owner/YOUR_WALLET_PUBKEY?includePnlInLeverageDisplay=true"

# 6. Preview a trade (no transaction built — omit owner)
curl -X POST $FLASH_API_URL/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG"
  }'

# 7. Build a real transaction (include owner)
curl -X POST $FLASH_API_URL/transaction-builder/open-position \
  -H "Content-Type: application/json" \
  -d '{
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG",
    "owner": "YOUR_WALLET_PUBKEY",
    "slippagePercentage": "0.5"
  }'
# Response includes transactionBase64 — decode, sign, and submit to Solana
```

## TypeScript

```typescript
const FLASH_API_URL = "https://flashapi.trade";

// Read prices
const prices = await fetch(`${FLASH_API_URL}/prices`).then(r => r.json());
console.log("SOL:", prices.SOL.priceUi);

// Read positions
const wallet = "YOUR_WALLET_PUBKEY";
const positions = await fetch(
  `${FLASH_API_URL}/positions/owner/${wallet}?includePnlInLeverageDisplay=true`
).then(r => r.json());

for (const pos of positions) {
  console.log(`${pos.marketSymbol} ${pos.sideUi}: $${pos.sizeUsdUi} @ ${pos.entryPriceUi}`);
  console.log(`  PnL: $${pos.pnlWithFeeUsdUi} (${pos.pnlPercentageWithFee}%)`);
  console.log(`  Liq: $${pos.liquidationPriceUi} | Leverage: ${pos.leverageUi}x`);
}

// Preview a trade (no owner = preview only)
const preview = await fetch(`${FLASH_API_URL}/transaction-builder/open-position`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    inputTokenSymbol: "USDC",
    outputTokenSymbol: "SOL",
    inputAmountUi: "100.0",
    leverage: 5.0,
    tradeType: "LONG",
  }),
}).then(r => r.json());

console.log("Entry price:", preview.newEntryPrice);
console.log("Entry fee:", preview.entryFee);
console.log("Liquidation:", preview.newLiquidationPrice);
console.log("Borrow rate/hr:", preview.marginFeePercentage, "%");
```

## Python

```python
import requests

FLASH_API_URL = "https://flashapi.trade"

# Read prices
prices = requests.get(f"{FLASH_API_URL}/prices").json()
print(f"SOL: ${prices['SOL']['priceUi']}")

# Read positions
wallet = "YOUR_WALLET_PUBKEY"
positions = requests.get(
    f"{FLASH_API_URL}/positions/owner/{wallet}",
    params={"includePnlInLeverageDisplay": "true"}
).json()

for pos in positions:
    print(f"{pos['marketSymbol']} {pos['sideUi']}: ${pos['sizeUsdUi']} @ {pos['entryPriceUi']}")
    print(f"  PnL: ${pos['pnlWithFeeUsdUi']} ({pos['pnlPercentageWithFee']}%)")
    print(f"  Liq: ${pos['liquidationPriceUi']} | Leverage: {pos['leverageUi']}x")

# Preview a trade
preview = requests.post(f"{FLASH_API_URL}/transaction-builder/open-position", json={
    "inputTokenSymbol": "USDC",
    "outputTokenSymbol": "SOL",
    "inputAmountUi": "100.0",
    "leverage": 5.0,
    "tradeType": "LONG",
}).json()

print(f"Entry: {preview['newEntryPrice']}, Fee: {preview['entryFee']}")
print(f"Liquidation: {preview['newLiquidationPrice']}")
```
