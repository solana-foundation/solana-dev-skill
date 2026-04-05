# SetupIntegration Workflow

Guide for setting up a Flash Trade integration from scratch.

## Choose Your Integration Path

### Path 1: REST API (Recommended — Any Language)

**Requirements:** HTTP client, Solana keypair for signing

```bash
# 1. Verify API connectivity
curl $FLASH_API_URL/health

# 2. Test data access
curl $FLASH_API_URL/prices
curl $FLASH_API_URL/raw/markets
```

**Environment setup:**
```bash
export FLASH_API_URL="https://flashapi.trade"  # Production API
export SOLANA_RPC_URL="https://api.mainnet-beta.solana.com"
```

**Dependencies (by language):**

| Language | HTTP Client | Solana Signing | Example |
|----------|-------------|----------------|---------|
| TypeScript | `fetch` (built-in) | `@solana/web3.js` | See [TransactionFlow.md](../TransactionFlow.md) |
| Python | `requests` or `httpx` | `solders` | See [TransactionFlow.md](../TransactionFlow.md) |
| Rust | `reqwest` | `solana-sdk` | Standard Solana patterns |
| Go | `net/http` | `gagliardetto/solana-go` | Standard Solana patterns |
| Any | Any HTTP client | Base64 decode + sign | See [TransactionFlow.md](../TransactionFlow.md) |

**Next steps:** [QueryData.md](QueryData.md) → [BuildTransaction.md](BuildTransaction.md)

---

### Path 2: MCP Server (AI Agent Integration)

```bash
# Install and configure
npx flash-trade-mcp

# Or with Bun
bunx flash-trade-mcp
```

**Claude Code settings.json:**
```json
{
  "mcpServers": {
    "flash-trade": {
      "command": "npx",
      "args": ["flash-trade-mcp"],
      "env": {
        "FLASH_API_URL": "https://flashapi.trade",
        "WALLET_PUBKEY": "<your-wallet-pubkey>",
        "KEYPAIR_PATH": "~/.config/solana/id.json",
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

**Next steps:** [McpIntegration.md](../McpIntegration.md)

---

### Path 3: TypeScript SDK (Advanced — Direct On-Chain)

```bash
# Install
npm install flash-sdk @coral-xyz/anchor @solana/web3.js
# or
yarn add flash-sdk @coral-xyz/anchor @solana/web3.js
```

```typescript
import { PerpetualsClient, PoolConfig } from "flash-sdk";
import { AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
const provider = new AnchorProvider(connection, wallet, { commitment: "processed" });
const poolConfig = PoolConfig.fromIdsByName("Crypto.1", "mainnet-beta");

const client = new PerpetualsClient(
  provider,
  new PublicKey(poolConfig.programId),
  new PublicKey(poolConfig.perpComposibilityProgramId),
  new PublicKey(poolConfig.fbNftRewardProgramId),
  new PublicKey(poolConfig.rewardDistributionProgram.programId),
  { prioritizationFee: 10_000 },
);

// CRITICAL: Load ALTs before any transaction
await client.loadAddressLookupTable(poolConfig);
```

**Next steps:** [SdkReference.md](../SdkReference.md)

## Verify Setup

Regardless of path, verify your integration works:

1. **Can you read market data?** Get prices and markets.
2. **Can you read wallet data?** Get positions for a known wallet.
3. **Can you build a transaction?** Use preview-only mode (omit `owner`) to get fee estimates.
4. **Can you sign and submit?** Try a small test trade on devnet first (note: Pyth prices are stale on devnet).
