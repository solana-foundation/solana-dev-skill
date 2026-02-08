# Security on BNB Chain

## Core Principle
Assume the attacker controls every input, every external call return value, every transaction ordering, and every flash-loaned amount. Design contracts to be safe even under adversarial conditions.

## Top Vulnerability Categories

### 1. Reentrancy
The most critical EVM vulnerability. An external call hands control to untrusted code, which re-enters your contract before state updates complete.

**Vulnerable pattern:**
```solidity
// BAD: State update after external call
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool ok,) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] -= amount; // Too late — attacker already re-entered
}
```

**Prevention:**
```solidity
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    // Option A: Checks-Effects-Interactions pattern
    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount);   // Check
        balances[msg.sender] -= amount;             // Effect
        (bool ok,) = msg.sender.call{value: amount}(""); // Interaction
        require(ok);
    }

    // Option B: ReentrancyGuard (belt + suspenders)
    function withdrawSafe(uint256 amount) external nonReentrant {
        require(balances[msg.sender] >= amount);
        balances[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok);
    }

    // Option C: Transient storage lock (Solidity 0.8.24+, Cancun)
    // Uses EIP-1153 tstore/tload for gas-efficient reentrancy guard
}
```

**Cross-contract reentrancy** — also guard against reentry through a different function or contract that shares state (read-only reentrancy).

### 2. Flash Loan Attacks
Attacker borrows massive funds in a single tx to manipulate prices, governance, or collateral.

**Prevention:**
```solidity
// Use time-weighted average prices (TWAP), not spot prices
// Chainlink oracles for price feeds
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

function getPrice(address feed) internal view returns (uint256) {
    AggregatorV3Interface oracle = AggregatorV3Interface(feed);
    (, int256 price,, uint256 updatedAt,) = oracle.latestRoundData();
    require(price > 0, "Invalid price");
    require(block.timestamp - updatedAt < 3600, "Stale price");
    return uint256(price);
}

// Never use AMM spot prices for collateral valuation
// Never use single-block balanceOf snapshots for governance weight
```

### 3. Access Control Failures
Missing or incorrect access control on privileged functions.

**Prevention:**
```solidity
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract Protocol is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function emergencyPause() external onlyRole(ADMIN_ROLE) { ... }
    function updateFee(uint256 fee) external onlyRole(OPERATOR_ROLE) { ... }
}
```

**Common mistakes:**
- Using `tx.origin` instead of `msg.sender` for auth
- Missing `onlyOwner` on sensitive functions
- Initializer not protected in upgradeable contracts
- Default visibility is `internal` for state vars but `public` for functions in older Solidity

### 4. Integer Overflow/Underflow
Solidity ^0.8.0 has built-in overflow checks, but `unchecked` blocks bypass them.

```solidity
// Safe by default in Solidity >=0.8.0
uint256 result = a + b; // Reverts on overflow

// Dangerous: unchecked arithmetic
unchecked {
    uint256 result = a - b; // Wraps on underflow!
}
// Only use unchecked when you can mathematically prove safety
```

**Watch for:**
- Division truncation: `7 / 2 = 3` (not 3.5)
- Multiplication before division to preserve precision
- Phantom overflow in intermediate calculations

### 5. Approval and Permit Exploits

**Infinite approval risk:**
```solidity
// BAD: User approves MAX_UINT — if contract is exploited, all tokens at risk
token.approve(spender, type(uint256).max);

// BETTER: Approve only what's needed
token.approve(spender, exactAmount);

// BEST: Use permit (EIP-2612) for single-tx approve + action
// No standing approval on-chain
```

**Front-running approval changes:**
```solidity
// BAD: Changing approval from 100 to 50 allows front-run to spend 150
token.approve(spender, 50);

// SAFE: Reset to 0 first, or use increaseAllowance/decreaseAllowance
token.approve(spender, 0);
token.approve(spender, 50);
```

### 6. Oracle Manipulation
Attackers manipulate price oracles to exploit lending, liquidation, or swap logic.

**Prevention checklist:**
- Use Chainlink price feeds as primary oracle (BSC has extensive coverage)
- Use TWAP from PancakeSwap v3 as secondary/fallback
- Set staleness thresholds on oracle data
- Add circuit breakers for extreme price movements
- Never rely on `balanceOf` or AMM reserves as price feeds

### 7. Frontrunning and MEV
On BSC, validators and searchers can reorder, insert, or censor transactions.

**Prevention:**
```solidity
// Commit-reveal for sensitive operations
function commitAction(bytes32 hash) external {
    commits[msg.sender] = Commit(hash, block.number);
}

function revealAction(uint256 value, bytes32 salt) external {
    Commit memory c = commits[msg.sender];
    require(block.number > c.blockNumber, "Same block");
    require(keccak256(abi.encodePacked(value, salt)) == c.hash, "Bad reveal");
    // Execute action
}

// Slippage protection for swaps
function swap(uint256 amountIn, uint256 minAmountOut, uint256 deadline) external {
    require(block.timestamp <= deadline, "Expired");
    uint256 amountOut = _doSwap(amountIn);
    require(amountOut >= minAmountOut, "Slippage");
}
```

### 8. Proxy and Upgrade Vulnerabilities

**Storage collision:**
```solidity
// BAD: New variable between existing ones
contract V2 is V1 {
    uint256 newVar; // COLLISION — overwrites V1 storage
}

// GOOD: Only append new storage at the end
contract V2 is V1 {
    // All V1 storage preserved
    uint256 newVar; // Appended after V1 storage
}

// BEST: Use ERC-7201 namespaced storage (OpenZeppelin v5)
```

**Uninitialized proxy:**
```solidity
// ALWAYS disable initializers in implementation constructor
constructor() {
    _disableInitializers();
}
```

**Function selector clashing:**
- UUPS: Implementation upgrade logic lives in implementation (preferred)
- Transparent: Admin proxy handles upgrades, no selector clash risk
- Diamond/EIP-2535: For complex multi-facet systems

### 9. Denial of Service (DoS)

**Unbounded loops:**
```solidity
// BAD: Iterating over unbounded array
function distributeAll() external {
    for (uint i = 0; i < recipients.length; i++) {
        token.transfer(recipients[i], amounts[i]);
    }
}

// GOOD: Batch with limits or pull pattern
function distribute(uint256 start, uint256 end) external {
    require(end <= recipients.length && end - start <= 100);
    for (uint i = start; i < end; i++) {
        token.transfer(recipients[i], amounts[i]);
    }
}

// BEST: Pull pattern
function claim() external {
    uint256 amount = claimable[msg.sender];
    require(amount > 0);
    claimable[msg.sender] = 0;
    token.transfer(msg.sender, amount);
}
```

**External call failure DoS:**
```solidity
// BAD: One failed transfer blocks all
for (uint i = 0; i < users.length; i++) {
    (bool ok,) = users[i].call{value: amounts[i]}("");
    require(ok); // One revert blocks everything
}

// GOOD: Track failures, allow retry
for (uint i = 0; i < users.length; i++) {
    (bool ok,) = users[i].call{value: amounts[i]}("");
    if (!ok) {
        pendingWithdrawals[users[i]] += amounts[i];
    }
}
```

### 10. Signature Replay
Reusing signed messages across chains, contracts, or time.

```solidity
// Include domain separator (EIP-712)
bytes32 public constant DOMAIN_TYPEHASH = keccak256(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
);

// Include nonce to prevent replay
mapping(address => uint256) public nonces;

function executeWithSig(
    address user,
    uint256 amount,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
) external {
    require(block.timestamp <= deadline, "Expired");
    require(nonce == nonces[user]++, "Invalid nonce");
    bytes32 hash = _hashTypedDataV4(keccak256(abi.encode(
        ACTION_TYPEHASH, user, amount, nonce, deadline
    )));
    require(SignatureChecker.isValidSignatureNow(user, hash, signature));
    // Execute
}
```

## BSC-Specific Security Considerations

### Validator-related risks
- BSC has 21 active validators — smaller set than Ethereum
- Block proposers can reorder transactions within a block
- Use private RPCs (Blocker, MEV Blocker) for sensitive transactions

### Token-specific risks on BSC
- Many BSC tokens have hidden fees (transfer tax), owner minting, or blacklisting
- Always check token contract before integration: `transferFrom` may not transfer exact amounts
- Watch for tokens with `_beforeTokenTransfer` hooks that can block transfers
- BUSD is deprecated — use USDT or USDC on BSC

### Bridge-related risks
- Verify bridge message authenticity (check source chain, sender, nonce)
- Implement rate limits on bridged assets
- Use timelocks for large bridge withdrawals
- Never trust bridge messages without on-chain proof verification

## Security Checklists

### Smart contract checklist
- [ ] Reentrancy guards on all external-call functions
- [ ] Access control on all privileged functions
- [ ] Input validation (zero address, zero amount, bounds)
- [ ] Safe math where `unchecked` is used (prove correctness)
- [ ] Oracle staleness checks and fallback logic
- [ ] Slippage and deadline protection on swaps
- [ ] EIP-712 + nonce for signed messages
- [ ] Events emitted for all state changes
- [ ] Upgradeable storage layout is append-only
- [ ] Initialize functions protected and called once
- [ ] No `selfdestruct` (deprecated) or `delegatecall` to untrusted targets
- [ ] Token transfer return values checked (use SafeERC20)

### Deployment checklist
- [ ] Deploy to testnet first, test all flows
- [ ] Verify source code on BscScan / opBNBScan
- [ ] Multisig or timelock as contract owner (not EOA)
- [ ] Emergency pause functionality
- [ ] Monitor with alerts (Tenderly, OpenZeppelin Defender, Forta)
- [ ] Run Slither and Aderyn static analysis before deployment
- [ ] Consider professional audit for contracts holding user funds

### Client-side checklist
- [ ] Validate chain ID before submitting transactions
- [ ] Show token approvals explicitly to user
- [ ] Simulate transactions before broadcasting (eth_call)
- [ ] Handle RPC failures gracefully (retry with backoff)
- [ ] Use EIP-1559 gas pricing (BSC supports it)
- [ ] Set reasonable gas limits (don't use block gas limit)
- [ ] Display transaction details before wallet signature prompt

## Static Analysis Tools
```bash
# Slither (comprehensive)
pip install slither-analyzer
slither . --config-file slither.config.json

# Aderyn (Rust-based, fast)
aderyn .

# Mythril (symbolic execution)
myth analyze src/Contract.sol

# Foundry built-in
forge inspect MyContract storage-layout  # Check storage layout
```
