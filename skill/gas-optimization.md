# Gas Optimization for BSC and opBNB

## Why It Matters
- BSC: ~3 gwei gas price, 30M block gas limit. Low fees but optimization reduces costs at scale.
- opBNB: Near-zero execution fees, but **L1 data fees** (calldata posted to BSC) are the dominant cost. Optimize calldata size.

## Solidity-Level Optimizations

### Storage optimization

```solidity
// BAD: Each variable takes a full 32-byte slot
contract Wasteful {
    uint256 amount;     // Slot 0
    bool isActive;      // Slot 1 (wastes 31 bytes)
    address owner;      // Slot 2 (wastes 12 bytes)
    uint256 timestamp;  // Slot 3
}

// GOOD: Pack variables into fewer slots
contract Efficient {
    uint256 amount;      // Slot 0 (32 bytes)
    uint256 timestamp;   // Slot 1 (32 bytes)
    address owner;       // Slot 2: 20 bytes
    bool isActive;       // Slot 2: 1 byte  (packed with owner!)
    // Total: 3 slots instead of 4
}

// Storage slot packing rules:
// - Variables are packed left-to-right into 32-byte slots
// - A variable won't span two slots
// - Order variables by size: largest first, then fill remaining space
// - Structs pack independently
```

### SSTORE/SLOAD reduction
```solidity
// BAD: Multiple SLOADs for same variable
function process() external {
    require(balances[msg.sender] > 0);           // SLOAD 1
    uint256 half = balances[msg.sender] / 2;     // SLOAD 2
    balances[msg.sender] -= half;                 // SLOAD 3 + SSTORE
}

// GOOD: Cache in memory
function process() external {
    uint256 bal = balances[msg.sender];           // SLOAD 1 (only)
    require(bal > 0);
    uint256 half = bal / 2;
    balances[msg.sender] = bal - half;            // SSTORE 1
}
```

### Use transient storage (EIP-1153, Cancun)
```solidity
// Transient storage costs 100 gas vs 20,000 for SSTORE
// Perfect for reentrancy guards, single-tx scratch space

// OpenZeppelin ReentrancyGuardTransient (cheaper on BSC Cancun)
import {ReentrancyGuardTransient} from
    "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

contract MyContract is ReentrancyGuardTransient {
    function withdraw() external nonReentrant {
        // Reentrancy guard using tstore/tload — much cheaper
    }
}
```

### Mappings vs arrays
```solidity
// Prefer mappings for lookups — O(1) storage access
mapping(address => uint256) public balances;    // Direct slot access

// Avoid iterating arrays on-chain — O(n) gas cost
// If you must iterate, bound the loop
function processAll(uint256 start, uint256 end) external {
    require(end - start <= 100, "Batch too large");
    for (uint256 i = start; i < end;) {
        // process
        unchecked { ++i; }
    }
}
```

### Unchecked arithmetic
```solidity
// When overflow is impossible, skip checks to save ~60 gas per operation
function sum(uint256[] calldata values) external pure returns (uint256 total) {
    for (uint256 i; i < values.length;) {
        unchecked {
            total += values[i]; // Only safe if you know total can't overflow
            ++i;                // Loop counter can't overflow
        }
    }
}

// Common safe uses of unchecked:
// - Loop counters (++i where i < array.length)
// - Subtraction after require(a >= b)
// - Incrementing nonces/counters that won't reach uint256.max
```

### Calldata vs memory
```solidity
// BAD: memory copies entire array
function process(uint256[] memory data) external { ... }

// GOOD: calldata is read-only reference (cheaper for external functions)
function process(uint256[] calldata data) external { ... }

// Rule: Use calldata for external function parameters you don't modify
// Use memory only when you need to modify the array
```

### Custom errors vs require strings
```solidity
// BAD: String costs ~50 gas per character in deployment + runtime
require(balance >= amount, "Insufficient balance for withdrawal");

// GOOD: Custom errors — cheaper deployment and runtime
error InsufficientBalance(uint256 available, uint256 required);

if (balance < amount) revert InsufficientBalance(balance, amount);
```

### Constants and immutables
```solidity
// constant: Inlined at compile time (zero storage cost)
uint256 public constant MAX_SUPPLY = 1_000_000e18;

// immutable: Set once in constructor, stored in bytecode (not storage)
address public immutable owner;
uint256 public immutable deployTime;

constructor() {
    owner = msg.sender;
    deployTime = block.timestamp;
}
```

### Short-circuit evaluation
```solidity
// Cheaper checks first
// BAD:
if (expensiveCheck() && simpleCheck) { ... }

// GOOD:
if (simpleCheck && expensiveCheck()) { ... }
// If simpleCheck fails, expensiveCheck is never called
```

### Batch operations
```solidity
// BAD: N separate transactions (N × 21000 base gas)
for (uint i = 0; i < recipients.length; i++) {
    token.transfer(recipients[i], amounts[i]);
}

// GOOD: Single transaction with batch
function batchTransfer(
    address[] calldata recipients,
    uint256[] calldata amounts
) external {
    for (uint i; i < recipients.length;) {
        token.transfer(recipients[i], amounts[i]);
        unchecked { ++i; }
    }
}
```

## Compiler Optimizations

### foundry.toml settings
```toml
[profile.default]
optimizer = true
optimizer_runs = 200      # Balance deploy cost vs runtime cost
via_ir = true             # Yul IR pipeline — better optimization

# For frequently called contracts (DEX routers):
# optimizer_runs = 1000000

# For rarely called contracts (one-time deploy):
# optimizer_runs = 1
```

### optimizer_runs tradeoff
| Runs | Deploy gas | Runtime gas | Best for |
|------|-----------|-------------|----------|
| 1 | Lowest | Highest | Factory-deployed, one-time use |
| 200 | Balanced | Balanced | Most contracts (default) |
| 10000+ | Highest | Lowest | Hot-path contracts (routers, vaults) |

## opBNB-Specific: Calldata Optimization

On opBNB, L1 data fees dominate. The fee is proportional to the calldata posted to BSC.

### Reduce calldata size
```solidity
// BAD: 32 bytes per address + 32 bytes per amount = 64 bytes per entry
function distribute(address[] calldata users, uint256[] calldata amounts) external { ... }

// BETTER: Pack address (20 bytes) + uint96 (12 bytes) = 32 bytes per entry
function distribute(bytes calldata packed) external {
    for (uint256 i; i < packed.length; i += 32) {
        address user = address(uint160(bytes20(packed[i:i+20])));
        uint96 amount = uint96(bytes12(packed[i+20:i+32]));
        _transfer(user, amount);
    }
}

// BEST: Use Merkle proofs for airdrops
// Only root stored on-chain, users claim with proof
function claim(uint256 amount, bytes32[] calldata proof) external {
    bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
    require(MerkleProof.verify(proof, merkleRoot, leaf));
    _transfer(msg.sender, amount);
}
```

### Use events for data availability
```solidity
// If data doesn't need to be in calldata or storage:
emit DataStored(key, value);
// Events are in logs (much cheaper than calldata on L2)
```

### Minimize function signatures
```solidity
// The 4-byte function selector is part of calldata
// A function called via fallback with raw calldata avoids this overhead
// Only worth it for extremely hot paths
```

## Measuring Gas

### Foundry gas reports
```bash
# Per-test gas report
forge test --gas-report

# Snapshot for regression tracking
forge snapshot
forge snapshot --check    # Compare against committed snapshot
forge snapshot --diff     # Show delta
```

### In-test gas measurement
```solidity
function test_gasUsage() public {
    uint256 gasBefore = gasleft();
    myContract.doSomething();
    uint256 gasUsed = gasBefore - gasleft();
    console.log("Gas used:", gasUsed);

    // Or use forge-std cheatcode
    vm.startSnapshotGas("doSomething");
    myContract.doSomething();
    uint256 gasUsed = vm.stopSnapshotGas();
}
```

### Gas comparison pattern
```solidity
contract GasCompare is Test {
    function test_approachA() public {
        uint256 snap = vm.snapshot();
        // Approach A
        uint256 gasA = gasleft();
        contractA.method();
        gasA = gasA - gasleft();

        vm.revertTo(snap);

        // Approach B
        uint256 gasB = gasleft();
        contractB.method();
        gasB = gasB - gasleft();

        console.log("A:", gasA, "B:", gasB, "Delta:", int256(gasA) - int256(gasB));
    }
}
```

## Gas Optimization Checklist

### Storage
- [ ] Variables packed into minimal slots (order by size)
- [ ] Hot variables cached in memory before loops
- [ ] Use `constant` for compile-time values
- [ ] Use `immutable` for constructor-set values
- [ ] Transient storage for single-tx state (Cancun)

### Execution
- [ ] `unchecked` math where overflow is impossible
- [ ] `calldata` instead of `memory` for read-only external params
- [ ] Custom errors instead of require strings
- [ ] Short-circuit evaluation (cheap checks first)
- [ ] Batch operations to amortize base gas cost

### Compiler
- [ ] Optimizer enabled with appropriate `runs` setting
- [ ] `via-ir` enabled for production builds
- [ ] Consider different optimizer settings per contract

### opBNB-specific
- [ ] Minimize calldata size (tight packing, Merkle proofs)
- [ ] Use events for data that doesn't need contract storage
- [ ] Batch L2 operations to amortize L1 data overhead
