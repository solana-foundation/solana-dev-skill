---
title: SolHunt — Wallet Recovery Intelligence
description: Find and recover SOL trapped in zero-balance token accounts. Audit token approvals for security risks. Built for AI agents and developer workflows on Solana.
---

# SolHunt — Solana Wallet Recovery Intelligence

## Overview

SolHunt finds recoverable SOL in wallets and provides a trustless recovery mechanism. It is architecturally incapable of draining funds — all transactions are unsigned and built client-side.

**MCP endpoint**: `https://solhunt.dev/.netlify/functions/mcp`

## Trust Model

SolHunt uses unsigned-transaction architecture:

1. **Client-side tx building** — Transaction construction happens in the agent's runtime or browser, not on SolHunt servers.
2. **Unsigned transactions only** — The server returns raw transaction bytes. The agent signs locally. SolHunt never sees a signed transaction.
3. **Instruction-level isolation** — Recovery transactions contain ONLY `CloseAccount` instructions + one 15% fee transfer to SolHunt. No generic transfer instructions.
4. **Atomic transactions** — CloseAccount and fee transfer execute atomically. Fee is baked into the transaction, not a separate step.

## Recovery Flow

```
1. get_wallet_report(wallet_address)
   → health_score, recoverable_sol, fee_sol, grade, next_step

2. build_recovery_transaction(wallet_address, destination_wallet)
   → unsigned_transaction (base64), expires_at

3. Agent signs locally → submits to Solana RPC
```

## Tools (MCP)

### get_wallet_report

Full wallet analysis in one call.

```typescript
// Request
{ "wallet_address": "7nxJ..." }

// Response
{
  "address": "7nxJ...",
  "health_score": 62,
  "grade": "C",
  "closeable_accounts": 14,
  "recoverable_sol": 0.028546,
  "fee_sol": 0.004282,
  "fee_percent": 15,
  "net_recoverable_sol": 0.024264,
  "worth_recovering": true,
  "estimated_batches": 1,
  "next_step": "Call build_recovery_transaction to get unsigned transaction bytes"
}
```

### scan_token_approvals

Audit dApp spending approvals for security risk.

```typescript
// Request
{ "wallet_address": "7nxJ..." }

// Response
{
  "total_approvals": 8,
  "risk_breakdown": { "high": 2, "medium": 1, "low": 5 },
  "high_risk": [
    { "address": "...", "mint": "...", "dapp": "Unknown Protocol", "risk": "HIGH" }
  ],
  "total_exposed_value_sol": 142.5
}
```

### build_recovery_transaction

Build unsigned transaction to recover SOL from zero-balance accounts.

```typescript
// Request
{
  "wallet_address": "7nxJ...",
  "destination_wallet": "7nxJ...",
  "batch_number": 1
}

// Response
{
  "success": true,
  "unsigned_transaction": "AQAAAA...",  // base64
  "instructions_count": 15,
  "close_accounts": ["...", "..."],
  "recoverable_sol": 0.028546,
  "fee_sol": 0.004282,
  "expires_at": "2026-04-04T00:45:00Z"
}
```

### build_revoke_transactions

Revoke token approvals to stop dApps from spending tokens.

```typescript
// Request
{
  "wallet_address": "7nxJ...",
  "token_accounts": [
    { "address": "...", "mint": "...", "programId": "..." }
  ],
  "batch_number": 1
}
```

## Fees

- **Recovery**: 15% of recovered SOL (only on success)
- **Revocation**: 0.001 SOL per transaction (first tx only)
- **Wallet report**: Free (10 calls/day on free tier)
- **Token approval scan**: Free

## Key Addresses

| Purpose | Address |
|---------|---------|
| SolHunt fee receiver | Configured per-recovery in the unsigned tx |
| MCP server | `https://solhunt.dev/.netlify/functions/mcp` |
| Web app | `https://solhunt.dev` |

## Links

- [SolHunt Web](https://solhunt.dev)
- [GitHub](https://github.com/shieldspprt/solhunt-recovery)
- [MCP Server Card](https://solhunt.dev/.well-known/mcp/server-card.json)
