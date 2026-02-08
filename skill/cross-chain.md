# Cross-Chain Development on BNB Chain

## Overview
BNB Chain sits at a crossroads of major cross-chain infrastructure. The three most important patterns:
1. **BSC ↔ opBNB native bridge** (L1/L2, OP Stack built-in)
2. **LayerZero v2** (arbitrary message passing to 40+ chains)
3. **Stargate v2** (cross-chain liquidity transfers)

---

## LayerZero v2

### What it is
LayerZero is an omnichain messaging protocol. v2 introduces modular security (DVNs — Decentralized Verifier Networks), configurable executors, and a cleaner OApp interface.

### OApp (Omnichain Application)
The base contract for any cross-chain application.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";

contract MyOApp is OApp {
    event MessageReceived(uint32 srcEid, bytes32 sender, string message);

    constructor(
        address _endpoint,
        address _owner
    ) OApp(_endpoint, _owner) {}

    /// @notice Send a message to another chain
    function sendMessage(
        uint32 _dstEid,        // Destination endpoint ID
        string calldata _msg,
        bytes calldata _options // Execution options (gas, value)
    ) external payable {
        bytes memory payload = abi.encode(_msg);

        _lzSend(
            _dstEid,
            payload,
            _options,
            MessagingFee(msg.value, 0), // Native fee, no LZ token fee
            payable(msg.sender)          // Refund address
        );
    }

    /// @notice Estimate cross-chain fee
    function quote(
        uint32 _dstEid,
        string calldata _msg,
        bytes calldata _options
    ) external view returns (MessagingFee memory) {
        bytes memory payload = abi.encode(_msg);
        return _quote(_dstEid, payload, _options, false);
    }

    /// @notice Receive message from another chain
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        string memory msg_ = abi.decode(_message, (string));
        emit MessageReceived(_origin.srcEid, _origin.sender, msg_);
    }
}
```

### OFT (Omnichain Fungible Token)
Cross-chain token standard — burn on source, mint on destination.

```solidity
import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";

contract MyOFT is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _owner
    ) OFT(_name, _symbol, _lzEndpoint, _owner) {
        _mint(_owner, 1_000_000 * 10 ** decimals());
    }
}
```

### OFT Adapter (wrap existing BEP-20)
If you already have a BEP-20 token and want to make it cross-chain:

```solidity
import {OFTAdapter} from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

contract MyOFTAdapter is OFTAdapter {
    constructor(
        address _token,         // Existing BEP-20 address
        address _lzEndpoint,
        address _owner
    ) OFTAdapter(_token, _lzEndpoint, _owner) {}
}
// Locks tokens on BSC, mints OFT on destination chain
```

### LayerZero deployment setup
```bash
# Install
npm install @layerzerolabs/oapp-evm @layerzerolabs/oft-evm

# For Foundry
forge install LayerZero-Labs/LayerZero-v2 --no-commit
```

### LayerZero Endpoint IDs (relevant to BNB)
| Chain | Endpoint ID |
|-------|------------|
| BSC | 30102 |
| opBNB | 30202 |
| Ethereum | 30101 |
| Arbitrum | 30110 |
| Polygon | 30109 |
| Avalanche | 30106 |
| Base | 30184 |
| Optimism | 30111 |

### Peer configuration
After deploying OApp/OFT on multiple chains, connect them:

```solidity
// On BSC: Set peer for Ethereum
myOFT.setPeer(30101, bytes32(uint256(uint160(ethereumOFTAddress))));

// On Ethereum: Set peer for BSC
myOFT.setPeer(30102, bytes32(uint256(uint160(bscOFTAddress))));
```

### Frontend: Cross-chain transfer
```typescript
import { useWriteContract } from "wagmi";
import { parseEther, encodePacked } from "viem";

function useCrossChainTransfer(oftAddress: `0x${string}`) {
  const { writeContract } = useWriteContract();

  async function sendTokens(
    dstEid: number,
    to: `0x${string}`,
    amount: bigint,
    fee: bigint
  ) {
    const toBytes32 = encodePacked(
      ["uint256"],
      [BigInt(to)]
    );

    writeContract({
      address: oftAddress,
      abi: oftAbi,
      functionName: "send",
      args: [{
        dstEid,
        to: toBytes32,
        amountLD: amount,
        minAmountLD: amount * 99n / 100n, // 1% slippage
        extraOptions: "0x",
        composeMsg: "0x",
        oftCmd: "0x",
      }, { nativeFee: fee, lzTokenFee: 0n }, to],
      value: fee,
    });
  }

  return { sendTokens };
}
```

---

## Stargate v2

### What it is
Stargate is a cross-chain liquidity transfer protocol built on LayerZero. Users swap native assets across chains (not wrapped) using unified liquidity pools.

### Integration
```solidity
interface IStargateRouter {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }

    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory, OFTReceipt memory);

    function quoteOFT(
        SendParam calldata _sendParam
    ) external view returns (OFTLimit memory, OFTFeeDetail[] memory, OFTReceipt memory);

    function quoteSend(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory);
}
```

### Cross-chain USDT transfer (BSC → Ethereum)
```solidity
contract StargateBridge {
    IStargateRouter public router; // Stargate pool/router for USDT
    IERC20 public usdt;

    function bridgeUSDT(
        uint256 amount,
        address recipient,
        uint32 dstEid
    ) external {
        usdt.transferFrom(msg.sender, address(this), amount);
        usdt.approve(address(router), amount);

        IStargateRouter.SendParam memory sendParam = IStargateRouter.SendParam({
            dstEid: dstEid,
            to: bytes32(uint256(uint160(recipient))),
            amountLD: amount,
            minAmountLD: amount * 995 / 1000, // 0.5% slippage
            extraOptions: "",
            composeMsg: "",
            oftCmd: ""
        });

        MessagingFee memory fee = router.quoteSend(sendParam, false);

        router.send{value: fee.nativeFee}(
            sendParam,
            fee,
            msg.sender // refund excess
        );
    }
}
```

---

## BSC ↔ opBNB Native Bridge

See [opbnb.md](opbnb.md) for detailed L1/L2 bridge patterns.

### Quick reference
```solidity
// BSC → opBNB (deposit BNB)
IL1StandardBridge(bridge).depositETH{value: amount}(200000, "0x");

// opBNB → BSC (withdraw BNB) — 7 day challenge period
IL2StandardBridge(bridge).withdraw{value: amount}(
    0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000, // ETH token placeholder
    amount,
    200000,
    "0x"
);
```

---

## Wormhole

### Overview
Wormhole provides cross-chain messaging via Guardian network. Less commonly used on BSC than LayerZero but still supported.

```solidity
interface IWormholeRelayer {
    function sendPayloadToEvm(
        uint16 targetChain,
        address targetAddress,
        bytes memory payload,
        uint256 receiverValue,
        uint256 gasLimit
    ) external payable returns (uint64 sequence);

    function quoteEVMDeliveryPrice(
        uint16 targetChain,
        uint256 receiverValue,
        uint256 gasLimit
    ) external view returns (uint256 nativePriceQuote, uint256 targetChainRefundPerGasUnused);
}
```

### Wormhole Chain IDs
| Chain | Wormhole ID |
|-------|------------|
| BSC | 4 |
| Ethereum | 2 |
| Polygon | 5 |
| Avalanche | 6 |
| Arbitrum | 23 |

---

## Cross-Chain Security Checklist

1. **Verify message source**: Always check the source chain and sender address
2. **Idempotent receivers**: Handle duplicate messages gracefully (use nonces/GUIDs)
3. **Rate limiting**: Implement per-chain and global rate limits for bridged assets
4. **Circuit breakers**: Pause bridge if anomalous volume detected
5. **Timelock large transfers**: Delay execution for transfers above threshold
6. **Test thoroughly**: Test on testnets before mainnet (LayerZero testnet endpoints available)
7. **Monitor**: Set up alerts for cross-chain messages (Layerzero Scan, Wormhole Explorer)
8. **Slippage protection**: Always set `minAmountLD` for token transfers
9. **Refund handling**: Ensure excess native fees are refunded to user
10. **Gas estimation**: Quote fees before sending — cross-chain gas can vary significantly

## Choosing a Cross-Chain Solution

| Criteria | LayerZero v2 | Stargate v2 | Wormhole | Native Bridge |
|----------|-------------|-------------|----------|---------------|
| Message types | Arbitrary | Token transfers | Arbitrary | Token + messages |
| Speed | Minutes | Minutes | Minutes | Minutes (L1→L2), 7d (L2→L1) |
| Security model | DVN (configurable) | LayerZero + pool | Guardian set | Optimistic rollup |
| BSC support | Yes | Yes | Yes | opBNB only |
| Token standard | OFT | Pool-based | NTT | Native |
| Best for | Custom cross-chain logic | Stablecoin/asset bridging | Multi-ecosystem | BSC ↔ opBNB only |
