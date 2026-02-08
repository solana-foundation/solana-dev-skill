# Account Abstraction on BNB Chain (ERC-4337)

## Overview
Account Abstraction (AA) replaces EOAs with **smart contract wallets** as the primary account type. On BSC, ERC-4337 is fully supported, enabling:
- Gasless transactions (paymaster sponsors gas)
- Batch transactions (multiple actions in one UserOp)
- Social recovery (guardians can recover wallet)
- Session keys (limited-permission signers)
- Multi-sig and custom auth (passkeys, biometrics)

## ERC-4337 Architecture

```
┌────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│   dApp     │────►│   Bundler    │────►│  EntryPoint   │────►│ Smart   │
│            │     │  (off-chain) │     │  (on-chain)   │     │ Account │
│  Creates   │     │  Batches     │     │  Validates +  │     │         │
│  UserOps   │     │  UserOps     │     │  Executes     │     │         │
└────────────┘     └──────────────┘     └───────────────┘     └─────────┘
                                              │
                                        ┌─────▼─────┐
                                        │ Paymaster  │
                                        │ (optional) │
                                        │ Sponsors   │
                                        │ gas fees   │
                                        └───────────┘
```

### Key Contracts
| Contract | Address (BSC) | Purpose |
|----------|---------------|---------|
| EntryPoint v0.7 | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | Core protocol contract |
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` | Legacy (still used) |

## Smart Account Implementation

### Minimal smart account (ERC-4337 compatible)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IAccount} from "@account-abstraction/contracts/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/contracts/interfaces/PackedUserOperation.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SimpleSmartAccount is IAccount {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IEntryPoint public immutable entryPoint;
    address public owner;

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Not EntryPoint");
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        require(
            msg.sender == owner || msg.sender == address(entryPoint),
            "Unauthorized"
        );
        _;
    }

    constructor(IEntryPoint _entryPoint, address _owner) {
        entryPoint = _entryPoint;
        owner = _owner;
    }

    /// @notice ERC-4337 validation
    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        // Verify signature
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);

        if (signer != owner) {
            return 1; // SIG_VALIDATION_FAILED
        }

        // Pay prefund if needed
        if (missingAccountFunds > 0) {
            (bool ok,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(ok);
        }

        return 0; // SIG_VALIDATION_SUCCESS
    }

    /// @notice Execute a call (from EntryPoint or owner)
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwnerOrEntryPoint {
        (bool ok, bytes memory result) = target.call{value: value}(data);
        if (!ok) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    /// @notice Execute batch calls
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external onlyOwnerOrEntryPoint {
        require(targets.length == values.length && values.length == datas.length);
        for (uint256 i; i < targets.length;) {
            (bool ok, bytes memory result) = targets[i].call{value: values[i]}(datas[i]);
            if (!ok) {
                assembly { revert(add(result, 32), mload(result)) }
            }
            unchecked { ++i; }
        }
    }

    receive() external payable {}
}
```

### Account Factory
```solidity
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

contract SmartAccountFactory {
    IEntryPoint public immutable entryPoint;

    constructor(IEntryPoint _entryPoint) {
        entryPoint = _entryPoint;
    }

    function createAccount(
        address owner,
        uint256 salt
    ) external returns (SimpleSmartAccount) {
        // Deterministic deployment
        bytes32 saltHash = keccak256(abi.encodePacked(owner, salt));
        address predicted = getAddress(owner, salt);

        if (predicted.code.length > 0) {
            return SimpleSmartAccount(payable(predicted));
        }

        return new SimpleSmartAccount{salt: saltHash}(entryPoint, owner);
    }

    function getAddress(
        address owner,
        uint256 salt
    ) public view returns (address) {
        bytes32 saltHash = keccak256(abi.encodePacked(owner, salt));
        return Create2.computeAddress(
            saltHash,
            keccak256(abi.encodePacked(
                type(SimpleSmartAccount).creationCode,
                abi.encode(entryPoint, owner)
            ))
        );
    }
}
```

## Paymaster (Gasless Transactions)

### Verifying Paymaster
```solidity
import {IPaymaster} from "@account-abstraction/contracts/interfaces/IPaymaster.sol";

contract VerifyingPaymaster is IPaymaster {
    IEntryPoint public immutable entryPoint;
    address public verifier;

    constructor(IEntryPoint _entryPoint, address _verifier) {
        entryPoint = _entryPoint;
        verifier = _verifier;
    }

    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData) {
        require(msg.sender == address(entryPoint), "Not EntryPoint");

        // Extract signature from paymasterAndData
        // paymasterAndData = [paymaster_address (20)] [validUntil (6)] [validAfter (6)] [signature (65)]
        bytes calldata paymasterData = userOp.paymasterAndData[20:];
        uint48 validUntil = uint48(bytes6(paymasterData[:6]));
        uint48 validAfter = uint48(bytes6(paymasterData[6:12]));
        bytes calldata signature = paymasterData[12:];

        // Verify off-chain signature from verifier
        bytes32 hash = keccak256(abi.encode(
            userOpHash, address(this), block.chainid, validUntil, validAfter
        ));
        address signer = ECDSA.recover(hash.toEthSignedMessageHash(), signature);

        if (signer != verifier) {
            return ("", 1); // SIG_VALIDATION_FAILED
        }

        // Pack validation data: [validAfter (6)] [validUntil (6)] [authorizer (20)]
        validationData = uint256(validUntil) << 160 | uint256(validAfter) << 208;
        return (abi.encode(userOp.sender), validationData);
    }

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 actualUserOpFeePerGas
    ) external {
        require(msg.sender == address(entryPoint), "Not EntryPoint");
        // Optional: charge user in ERC-20 tokens, log usage, etc.
    }

    // Deposit ETH to EntryPoint for gas sponsorship
    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }
}
```

## Session Keys

### Time-limited sub-keys for dApps
```solidity
struct SessionKey {
    address key;
    uint48 validUntil;
    uint48 validAfter;
    address[] allowedTargets;  // Contracts this key can call
    bytes4[] allowedSelectors; // Functions this key can call
    uint256 spendLimit;        // Max ETH/token spend
}

contract SessionKeyAccount is SimpleSmartAccount {
    mapping(address => SessionKey) public sessionKeys;

    function addSessionKey(SessionKey calldata session) external onlyOwnerOrEntryPoint {
        sessionKeys[session.key] = session;
    }

    function removeSessionKey(address key) external onlyOwnerOrEntryPoint {
        delete sessionKeys[key];
    }

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override onlyEntryPoint returns (uint256) {
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);

        // Check if signer is owner
        if (signer == owner) {
            _payPrefund(missingAccountFunds);
            return 0;
        }

        // Check if signer is valid session key
        SessionKey memory session = sessionKeys[signer];
        if (session.key == signer) {
            require(block.timestamp >= session.validAfter, "Session not started");
            require(block.timestamp <= session.validUntil, "Session expired");
            // Validate target and selector from calldata
            _payPrefund(missingAccountFunds);
            return 0;
        }

        return 1; // SIG_VALIDATION_FAILED
    }
}
```

## Popular AA SDKs for BSC

### Biconomy Smart Accounts
```typescript
import { createSmartAccountClient } from "@biconomy/account";
import { createWalletClient, http } from "viem";
import { bsc } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const signer = privateKeyToAccount("0x...");

const smartAccount = await createSmartAccountClient({
  signer,
  bundlerUrl: "https://bundler.biconomy.io/api/v2/56/...",
  biconomyPaymasterApiKey: "YOUR_API_KEY",
  chainId: 56,
});

// Get smart account address
const address = await smartAccount.getAccountAddress();

// Send gasless transaction
const tx = await smartAccount.sendTransaction({
  to: "0x...",
  data: "0x...",
  value: 0n,
}, {
  paymasterServiceData: { mode: "SPONSORED" }, // Paymaster sponsors gas
});
```

### ZeroDev Kernel
```typescript
import { createKernelAccount, createKernelAccountClient } from "@zerodev/sdk";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { ENTRYPOINT_ADDRESS_V07 } from "permissionless";

const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
  signer,
  entryPoint: ENTRYPOINT_ADDRESS_V07,
});

const account = await createKernelAccount(publicClient, {
  plugins: { sudo: ecdsaValidator },
  entryPoint: ENTRYPOINT_ADDRESS_V07,
});

const kernelClient = createKernelAccountClient({
  account,
  chain: bsc,
  entryPoint: ENTRYPOINT_ADDRESS_V07,
  bundlerTransport: http("https://rpc.zerodev.app/api/v2/bundler/..."),
  middleware: {
    sponsorUserOperation: async ({ userOperation }) => {
      // Paymaster logic
    },
  },
});
```

### permissionless.js (framework-agnostic)
```typescript
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";

const pimlicoClient = createPimlicoClient({
  transport: http("https://api.pimlico.io/v2/56/rpc?apikey=..."),
  entryPoint: { address: ENTRYPOINT_ADDRESS_V07, version: "0.7" },
});

const account = await toSimpleSmartAccount({
  client: publicClient,
  owner: signer,
  entryPoint: { address: ENTRYPOINT_ADDRESS_V07, version: "0.7" },
});

const smartAccountClient = createSmartAccountClient({
  account,
  chain: bsc,
  bundlerTransport: http("https://api.pimlico.io/v2/56/rpc?apikey=..."),
  paymaster: pimlicoClient,
  userOperation: {
    estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
  },
});

// Send UserOperation
const hash = await smartAccountClient.sendTransaction({
  to: "0x...",
  value: parseEther("0.01"),
  data: "0x",
});
```

## Bundlers on BSC

| Provider | v0.6 | v0.7 | URL Pattern |
|----------|------|------|-------------|
| Pimlico | Yes | Yes | `api.pimlico.io/v2/56/rpc` |
| Biconomy | Yes | Yes | `bundler.biconomy.io/api/v2/56/` |
| Stackup | Yes | Yes | `api.stackup.sh/v1/node/` |
| Alchemy | Yes | Yes | `bnb-mainnet.g.alchemy.com/v2/` |
| Particle Network | Yes | Yes | `bundler.particle.network/` |

## Use Cases on BSC/opBNB

### Gaming
- Session keys: Player approves game for 1 hour, no more popups
- Batch: Craft + equip + attack in one UserOp
- Gasless: Game sponsors gas for new players

### DeFi
- Batch: Approve + swap + stake in one UserOp
- Paymaster: Pay gas in stablecoins (USDT/USDC)
- Auto-compound: Scheduled UserOps via automation

### Social
- Gasless onboarding: New users don't need BNB
- Social recovery: Friends as guardians
- Passkey auth: WebAuthn instead of private keys

## AA Security Considerations
1. **Factory replayability**: Use CREATE2 with user-specific salt
2. **Signature validation**: Must revert or return SIG_VALIDATION_FAILED (not just skip)
3. **Paymaster griefing**: Implement rate limits and off-chain verification
4. **Session key scope**: Minimize permissions (specific targets + selectors + spend limits)
5. **Upgrade safety**: If account is upgradeable, protect upgrade function
6. **EntryPoint trust**: Only trust the canonical EntryPoint contract
