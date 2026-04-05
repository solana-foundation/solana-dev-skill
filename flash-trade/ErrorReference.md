# Flash Trade Error Reference

69 error codes from the Flash Trade perpetuals program (6000-6068), plus REST API HTTP errors.

## HTTP Errors (REST API Layer)

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 400 | Bad Request | Invalid pubkey format, missing required field, invalid enum value |
| 404 | Not Found | Account/position/order doesn't exist; price symbol unavailable |
| 429 | Too Many Requests | Per-owner WebSocket connection limit (5) exceeded |
| 500 | Internal Server Error | Computation failure, unexpected blockchain state |
| 503 | Service Unavailable | Price data missing (market closed); global WebSocket limit reached |

**Error response formats:**
```json
// General HTTP errors (400, 404, 500, etc.)
{ "error": "descriptive error message" }

// Transaction builder and trigger order domain errors
{ "err": "descriptive error message" }
```

**Note:** The API uses two different error keys — `"error"` for HTTP-level errors and `"err"` for domain-specific computation errors (returned in transaction builder and trigger order responses). Always check for both.

## On-Chain Error Codes (6000-6068)

### Trading Errors (Most Common)

These are the errors you'll encounter most frequently when building integrations.

| Code | Name | Solution |
|------|------|----------|
| **6020** | **MaxPriceSlippage** | Price moved beyond `priceWithSlippage`. Widen slippage tolerance (1-3% from oracle) or retry with fresh price. |
| **6021** | **MaxLeverage** | Post-modification leverage exceeds `max_leverage`. Reduce size or add collateral first. |
| **6022** | **MaxInitLeverage** | New position leverage exceeds `max_init_leverage`. Reduce size or increase collateral. |
| **6023** | **MinLeverage** | Leverage below `min_init_leverage`. Increase size or reduce collateral. |
| **6024** | **CustodyAmountLimit** | Pool capacity reached (`max_total_locked_usd`). Try smaller position or wait. |
| **6025** | **PositionAmountLimit** | Single position exceeds `max_position_size_usd`. Split into smaller positions. |
| **6031** | **InstructionNotAllowed** | Trading paused by protocol (maintenance, circuit breaker). Wait and retry. |
| **6032** | **MaxUtilization** | Pool utilization at capacity. Try smaller position or wait. |
| **6033** | **CloseOnlyMode** | Market in close-only mode. Only close/decrease operations allowed. |
| **6034** | **MinCollateral** | Below `min_collateral_usd`. Increase collateral (use $11-12+ for TP/SL). |

### Order Errors

| Code | Name | Solution |
|------|------|----------|
| **6049** | **InvalidStopLossPrice** | SL price doesn't make sense for position direction (e.g., SL above entry for a long). |
| **6050** | **InvalidTakeProfitPrice** | TP price doesn't make sense (e.g., TP below entry for a long). |
| **6051** | **ExposureLimitExceeded** | Degen Mode exposure cap hit. Reduce size or wait. |
| **6052** | **MaxStopLossOrders** | Max 5 SL orders per market. Cancel an existing one first. |
| **6053** | **MaxTakeProfitOrders** | Max 5 TP orders per market. Cancel an existing one first. |
| **6054** | **MaxOpenOrder** | Max 5 limit orders per market. Cancel an existing one first. |
| 6055 | InvalidOrder | Order doesn't exist at the specified `orderId` index (0-4). |
| 6056 | InvalidLimitPrice | Limit price invalid for the position direction. |

### Oracle Errors

| Code | Name | Solution |
|------|------|----------|
| **6007** | **StaleOraclePrice** | Oracle price too old. Retry after a few slots. Check [Pyth status](https://status.pyth.network/). |
| 6004 | UnsupportedOracle | Internal: custody oracle misconfigured. |
| 6005 | InvalidOracleAccount | Wrong oracle account passed. Ensure PoolConfig is current. |
| 6006 | InvalidOracleState | Oracle feed offline or corrupted. Wait and retry. |
| 6008 | InvalidOraclePrice | Oracle returned 0 or negative confidence. Wait and retry. |

### State Validation Errors

| Code | Name | Solution |
|------|------|----------|
| 6009 | InvalidEnvironment | Test-only instruction called on mainnet. |
| 6010 | InvalidPoolState | Pool account corrupted or uninitialized. Verify pool address. |
| 6011 | InvalidCustodyState | Custody account issue. Re-fetch PoolConfig. |
| 6012 | InvalidMarketState | Market account issue. Verify market exists for this pool/side. |
| 6013 | InvalidCollateralCustody | Wrong collateral token for this market. |
| 6014 | InvalidPositionState | Position doesn't exist or is already closed. Verify position PDA. |
| 6015 | InvalidDispensingCustody | Internal custody routing error. |
| 6016 | InvalidPerpetualsConfig | Global config issue. |
| 6017 | InvalidPoolConfig | Pool parameters invalid. |
| 6018 | InvalidCustodyConfig | Custody parameters invalid. |

### Arithmetic

| Code | Name | Solution |
|------|------|----------|
| 6003 | MathOverflow | Reduce position size. Rare — caused by extreme sizes or prices. |

### Multisig (Admin Only)

| Code | Name | Notes |
|------|------|-------|
| 6000 | MultisigAccountNotAuthorized | Admin-only, not relevant to integrators |
| 6001 | MultisigAlreadySigned | Admin-only |
| 6002 | MultisigAlreadyExecuted | Admin-only |

### Swap & Token Errors

| Code | Name | Solution |
|------|------|----------|
| 6019 | InsufficientAmountReturned | Swap output below minimum. Increase slippage on swap portion. |
| 6026 | TokenRatioOutOfRange | LP operation pushes allocation outside min/max ratios. Deposit underweight token. |
| 6027 | UnsupportedToken | Token mint not recognized by pool. |
| 6028 | UnsupportedCustody | Custody not found in pool. |
| 6029 | UnsupportedPool | Pool address invalid. |
| 6030 | UnsupportedMarket | Market doesn't exist for this target/collateral/side. |

### Oracle Authority (Internal)

| Code | Name | Notes |
|------|------|-------|
| 6035 | PermissionlessOracleMissingSignature | Keeper/oracle authority error |
| 6036 | PermissionlessOracleMalformedEd25519Data | Internal oracle error |
| 6037 | PermissionlessOracleSignerMismatch | Internal oracle error |
| 6038 | PermissionlessOracleMessageMismatch | Internal oracle error |

### Protocol Errors

| Code | Name | Solution |
|------|------|----------|
| 6039 | ExponentMismatch | Internal price calculation error. |
| 6040 | CloseRatio | Position close amount invalid relative to current size. |
| 6041 | InsufficientStakeAmount | Trying to unstake more than staked balance. |
| 6042 | InvalidFeeDeltas | Internal fee calculation error. |
| 6043 | InvalidFeeDistributionCustody | Internal custody routing. |
| 6044 | InvalidCollection | NFT collection not recognized for gated trading. |
| 6045 | InvalidOwner | Wrong token account owner. Ensure ATA is derived correctly. |
| 6046 | InvalidAccess | Pool requires NFT or referral for access. Create referral first. |
| 6047 | TokenStakeAccountMismatch | Referral account linked to wrong stake account. |
| 6048 | MaxDepositsReached | Token vault deposit limit hit. |

### Reserve & Withdrawal

| Code | Name | Solution |
|------|------|----------|
| 6057 | MinReserve | Custody min_reserve_usd threshold. Pool must maintain reserves. |
| 6058 | MaxWithdrawTokenRequest | Max 5 pending withdraw requests per TokenStake account. |

### Reward & LP Errors

| Code | Name | Solution |
|------|------|----------|
| 6059 | InvalidRewardDistribution | Admin reward distribution error. |
| 6060 | LpPriceOutOfBounds | FLP price outside safety bounds. Pool safety mechanism. |
| 6061 | InsufficientRebateReserves | Rebate vault insufficient balance. |
| 6062 | OraclePenaltyAlreadySet | Position already has price impact penalty applied. |

### Pyth Lazer Errors

| Code | Name | Notes |
|------|------|-------|
| 6063 | InvalidLazerMessage | Pyth Lazer oracle message format error |
| 6064 | InvalidLazerPayload | Pyth Lazer payload parsing failure |
| 6065 | InvalidLazerChannel | Wrong Lazer channel for this custody |
| 6066 | InvalidLazerTimestamp | Lazer message too old or in the future |

### Withdrawal Errors

| Code | Name | Solution |
|------|------|----------|
| 6067 | InvalidWithdrawal | Withdrawal amount invalid (0 or exceeds balance). |
| 6068 | InvalidWithdrawRequestId | Withdraw request index doesn't exist (0-4). |

## Common Scenarios & Recovery

### "Transaction too large"
Flash Trade transactions with ALTs are near the size limit. Ensure address lookup tables are loaded and use VersionedTransaction (v0), not legacy.

### "Blockhash not found" / "Blockhash expired"
Solana blockhashes expire in ~60 seconds. Re-call the transaction builder endpoint to get a fresh transaction, then sign and submit immediately.

### Position not found after closing
The API caches data ~15 seconds. After closing a position, `get_positions` may briefly still show it. The transaction is confirmed on-chain — this is normal cache lag.

### Trigger orders not executing
Trigger orders are executed by off-chain keepers:
1. Verify oracle price has actually crossed the trigger level
2. Check that the position still exists (not liquidated)
3. Keepers may have latency during high-volatility periods

### "Account not found" on position operations
Position PDA doesn't exist — either never opened or already closed/liquidated. Verify position exists via `GET /positions/owner/{owner}` before operating on it.

## Error Handling Pattern (TypeScript)

```typescript
try {
  const response = await fetch(`${FLASH_API_URL}/transaction-builder/open-position`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const { error } = await response.json();
    // Handle HTTP-level errors
    if (response.status === 404) console.error('Market or account not found');
    if (response.status === 503) console.error('Price data unavailable');
    throw new Error(error);
  }

  const data = await response.json();
  if (data.err) {
    // Handle on-chain computation errors returned in the response body
    console.error('Transaction builder error:', data.err);
  }
} catch (err) {
  // Handle network/connection errors
  console.error('Request failed:', err.message);
}
```

## Error Handling Pattern (Python)

```python
import requests

try:
    response = requests.post(f"{FLASH_API_URL}/transaction-builder/open-position", json=request)
    response.raise_for_status()
    data = response.json()

    if data.get("err"):
        print(f"Transaction builder error: {data['err']}")
    elif data.get("transactionBase64"):
        print("Transaction ready to sign")

except requests.exceptions.HTTPError as e:
    error_body = e.response.json()
    print(f"API error ({e.response.status_code}): {error_body.get('error', 'Unknown')}")
except requests.exceptions.ConnectionError:
    print("Cannot reach Flash Trade API")
```
