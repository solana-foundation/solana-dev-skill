# Frontend Development for BNB Chain

## Stack Overview
- **wagmi v2**: React hooks for wallet connection, contract reads/writes, tx lifecycle
- **viem**: Low-level TypeScript client for chain interaction (wagmi's foundation)
- **@tanstack/react-query**: Caching layer (wagmi v2 dependency)
- **RainbowKit** or **Web3Modal (AppKit)**: Wallet connection UI
- **Next.js 14+** or **Vite + React**: App framework

## Project Setup

### Installation
```bash
npm install wagmi viem @tanstack/react-query
# Pick ONE wallet UI:
npm install @rainbow-me/rainbowkit    # RainbowKit
# OR
npm install @web3modal/wagmi           # Web3Modal (WalletConnect AppKit)
```

### Chain Configuration (viem)
```typescript
// src/config/chains.ts
import { defineChain } from "viem";
import { bsc, bscTestnet } from "viem/chains";

// BSC mainnet and testnet are built into viem
export { bsc, bscTestnet };

// opBNB mainnet
export const opBNB = defineChain({
  id: 204,
  name: "opBNB",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://opbnb-mainnet-rpc.bnbchain.org"] },
  },
  blockExplorers: {
    default: { name: "opBNBScan", url: "https://opbnb.bscscan.com" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

// opBNB testnet
export const opBNBTestnet = defineChain({
  id: 5611,
  name: "opBNB Testnet",
  nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://opbnb-testnet-rpc.bnbchain.org"] },
  },
  blockExplorers: {
    default: {
      name: "opBNBScan Testnet",
      url: "https://opbnb-testnet.bscscan.com",
    },
  },
  testnet: true,
});
```

### wagmi Config
```typescript
// src/config/wagmi.ts
import { http, createConfig } from "wagmi";
import { bsc, bscTestnet } from "viem/chains";
import { opBNB, opBNBTestnet } from "./chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;

export const config = createConfig({
  chains: [bsc, opBNB, bscTestnet, opBNBTestnet],
  connectors: [
    injected(),
    walletConnect({ projectId }),
  ],
  transports: {
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC),
    [opBNB.id]: http("https://opbnb-mainnet-rpc.bnbchain.org"),
    [bscTestnet.id]: http(),
    [opBNBTestnet.id]: http(),
  },
});
```

### Provider Setup (RainbowKit)
```tsx
// src/providers/Web3Provider.tsx
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { config } from "@/config/wagmi";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Provider Setup (Web3Modal / AppKit)
```tsx
"use client";

import { createWeb3Modal } from "@web3modal/wagmi/react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/wagmi";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID!;
const queryClient = new QueryClient();

createWeb3Modal({ wagmiConfig: config, projectId });

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## Core Hook Patterns

### Wallet connection
```tsx
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

function WalletStatus() {
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected) return <w3m-button />; // Web3Modal button
  // OR: <ConnectButton /> for RainbowKit

  return (
    <div>
      <p>Connected: {address}</p>
      <p>Chain: {chain?.name} (ID: {chain?.id})</p>
      <button onClick={() => switchChain({ chainId: 56 })}>
        Switch to BSC
      </button>
      <button onClick={() => switchChain({ chainId: 204 })}>
        Switch to opBNB
      </button>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}
```

### Read contract data
```tsx
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

function TokenBalance({ token, user }: { token: `0x${string}`; user: `0x${string}` }) {
  // Single read
  const { data: balance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [user],
  });

  // Batch reads (multicall)
  const { data: results } = useReadContracts({
    contracts: [
      { address: token, abi: erc20Abi, functionName: "balanceOf", args: [user] },
      { address: token, abi: erc20Abi, functionName: "decimals" },
    ],
  });

  if (!results) return <p>Loading...</p>;

  const [balResult, decResult] = results;
  if (balResult.status === "success" && decResult.status === "success") {
    return <p>{formatUnits(balResult.result, decResult.result)}</p>;
  }
  return <p>Error reading token</p>;
}
```

### Write contract (send transaction)
```tsx
import {
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits } from "viem";

function TransferToken({ token }: { token: `0x${string}` }) {
  const { data: hash, writeContract, isPending, error } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  function handleTransfer(to: string, amount: string) {
    writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to as `0x${string}`, parseUnits(amount, 18)],
    });
  }

  return (
    <div>
      <button
        onClick={() => handleTransfer("0x...", "100")}
        disabled={isPending || isConfirming}
      >
        {isPending ? "Confirm in wallet..." : isConfirming ? "Confirming..." : "Transfer"}
      </button>
      {isSuccess && <p>Confirmed! Tx: {hash}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  );
}
```

### Watch events (real-time)
```tsx
import { useWatchContractEvent } from "wagmi";

function TransferWatcher({ token }: { token: `0x${string}` }) {
  useWatchContractEvent({
    address: token,
    abi: erc20Abi,
    eventName: "Transfer",
    onLogs(logs) {
      for (const log of logs) {
        console.log("Transfer:", log.args.from, "→", log.args.to, log.args.value);
      }
    },
  });

  return <p>Watching transfers...</p>;
}
```

## viem Direct Usage (Server-Side / Scripts)

```typescript
import { createPublicClient, createWalletClient, http } from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Read-only client
const publicClient = createPublicClient({
  chain: bsc,
  transport: http("https://bsc-dataseed1.binance.org"),
});

// Read data
const balance = await publicClient.getBalance({
  address: "0x...",
});

const blockNumber = await publicClient.getBlockNumber();

// Write client (with private key)
const account = privateKeyToAccount("0x...");
const walletClient = createWalletClient({
  account,
  chain: bsc,
  transport: http("https://bsc-dataseed1.binance.org"),
});

// Send transaction
const hash = await walletClient.sendTransaction({
  to: "0x...",
  value: parseEther("0.1"),
});

// Wait for receipt
const receipt = await publicClient.waitForTransactionReceipt({ hash });
```

## Transaction UX Checklist
1. **Disable inputs** while tx is pending/confirming.
2. **Show wallet prompt** — "Confirm in wallet..." immediately after `writeContract`.
3. **Show tx hash** as soon as returned (link to BscScan).
4. **Track confirmation** — use `useWaitForTransactionReceipt` for finality.
5. **Handle rejection** — detect user rejection vs. RPC errors.
6. **Chain mismatch** — prompt user to switch chain before sending.
7. **Gas estimation** — show estimated fees when possible (BSC fees are low but still relevant).
8. **Token approvals** — check allowance first, prompt approve if needed, then execute action.

## BscScan Link Helpers
```typescript
export function bscScanTx(hash: string, chainId: number = 56): string {
  const base = chainId === 56
    ? "https://bscscan.com"
    : chainId === 97
    ? "https://testnet.bscscan.com"
    : chainId === 204
    ? "https://opbnb.bscscan.com"
    : "https://testnet.opbnbscan.com";
  return `${base}/tx/${hash}`;
}

export function bscScanAddress(addr: string, chainId: number = 56): string {
  const base = chainId === 56
    ? "https://bscscan.com"
    : chainId === 97
    ? "https://testnet.bscscan.com"
    : chainId === 204
    ? "https://opbnb.bscscan.com"
    : "https://testnet.opbnbscan.com";
  return `${base}/address/${addr}`;
}
```

## Multi-Chain Awareness
When building for the BNB ecosystem, always:
- Display the current chain name prominently
- Provide chain switching UI (BSC ↔ opBNB at minimum)
- Use different contract addresses per chain (stored in config, not hardcoded in components)
- Handle chain-specific gas pricing: BSC uses EIP-1559, opBNB has near-zero fees
- Test on both BSC testnet and opBNB testnet before mainnet deployment
