# Testing on BNB Chain

## Testing Strategy Overview

| Test Type | Tool | Speed | When to Use |
|-----------|------|-------|-------------|
| Unit | Foundry `forge test` | Fastest | Pure logic, math, access control |
| Fuzz | Foundry fuzz | Fast | Edge cases, numeric boundaries |
| Invariant | Foundry invariant | Medium | Protocol invariants, state properties |
| Fork | Foundry fork | Medium | Real mainnet state, protocol interactions |
| Integration | Hardhat scripts | Slower | Complex deploy pipelines, TypeScript |
| E2E | Cypress/Playwright + wagmi | Slowest | Full dApp user flows |

## Foundry Testing (Preferred)

### Basic test structure
```solidity
// test/MyToken.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test, console} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        token = new MyToken();
        // Fund test accounts
        deal(address(token), alice, 1000e18);
        vm.deal(alice, 10 ether);
    }

    function test_transfer() public {
        vm.prank(alice);
        token.transfer(bob, 100e18);
        assertEq(token.balanceOf(bob), 100e18);
        assertEq(token.balanceOf(alice), 900e18);
    }

    function test_revert_transferInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert();
        token.transfer(bob, 2000e18);
    }
}
```

### Run tests
```bash
# Run all tests
forge test

# Verbose (show logs)
forge test -vvv

# Match specific test
forge test --match-test test_transfer

# Match specific contract
forge test --match-contract MyTokenTest

# Gas report
forge test --gas-report

# Watch mode
forge test --watch
```

### Cheat codes (most used for BSC development)

```solidity
// Impersonate an account
vm.prank(alice);                    // Next call only
vm.startPrank(alice);               // Until stopPrank

// Set block properties
vm.warp(block.timestamp + 1 days);  // Advance time
vm.roll(block.number + 100);        // Advance blocks

// Set ETH/BNB balance
vm.deal(alice, 100 ether);

// Set token balance (storage slot manipulation)
deal(address(token), alice, 1000e18);

// Expect revert
vm.expectRevert();
vm.expectRevert("Insufficient balance");
vm.expectRevert(abi.encodeWithSelector(InsufficientBalance.selector, 100, 200));

// Expect emit
vm.expectEmit(true, true, false, true);
emit Transfer(alice, bob, 100e18);

// Snapshot and revert state
uint256 snapshot = vm.snapshot();
// ... modify state ...
vm.revertTo(snapshot);

// Label addresses (for traces)
vm.label(alice, "Alice");
vm.label(address(token), "MyToken");

// Mock calls
vm.mockCall(
    address(oracle),
    abi.encodeWithSelector(oracle.getPrice.selector),
    abi.encode(3000e8)
);
```

### Fuzz testing
```solidity
function testFuzz_transfer(uint256 amount) public {
    // Bound inputs to valid range
    amount = bound(amount, 1, token.balanceOf(alice));

    vm.prank(alice);
    token.transfer(bob, amount);

    assertEq(token.balanceOf(bob), amount);
    assertEq(token.balanceOf(alice), 1000e18 - amount);
}
```

```bash
# Run with more fuzz runs
forge test --fuzz-runs 10000

# Set in foundry.toml
# [fuzz]
# runs = 1000
# max_test_rejects = 65536
# seed = "0x1234"
```

### Invariant testing
```solidity
// test/invariants/VaultInvariant.t.sol
contract VaultInvariantTest is Test {
    Vault vault;
    VaultHandler handler;

    function setUp() public {
        vault = new Vault();
        handler = new VaultHandler(vault);

        // Tell Foundry to only call handler functions
        targetContract(address(handler));
    }

    // This must ALWAYS hold
    function invariant_totalAssetsEqualBalance() public view {
        assertEq(
            vault.totalAssets(),
            address(vault).balance
        );
    }

    function invariant_noUserExceedsDeposit() public view {
        // Check per-user invariants
    }
}

// Handler defines valid actions
contract VaultHandler is Test {
    Vault vault;
    address[] users;

    constructor(Vault _vault) {
        vault = _vault;
        users.push(makeAddr("user1"));
        users.push(makeAddr("user2"));
    }

    function deposit(uint256 userIdx, uint256 amount) external {
        userIdx = bound(userIdx, 0, users.length - 1);
        amount = bound(amount, 0.01 ether, 100 ether);

        address user = users[userIdx];
        vm.deal(user, amount);
        vm.prank(user);
        vault.deposit{value: amount}();
    }

    function withdraw(uint256 userIdx, uint256 amount) external {
        userIdx = bound(userIdx, 0, users.length - 1);
        address user = users[userIdx];
        uint256 maxWithdraw = vault.balanceOf(user);
        if (maxWithdraw == 0) return;
        amount = bound(amount, 1, maxWithdraw);

        vm.prank(user);
        vault.withdraw(amount);
    }
}
```

```toml
# foundry.toml
[invariant]
runs = 256
depth = 128
fail_on_revert = false
```

## Fork Testing (BSC Mainnet)

### Fork against BSC mainnet
```solidity
contract ForkTest is Test {
    // Real BSC mainnet addresses
    address constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address constant PANCAKE_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address constant USDT = 0x55d398326f99059fF775485246999027B3197955;

    function setUp() public {
        // Fork is set via CLI or foundry.toml
        // Tests run against real BSC state
    }

    function test_swapOnPancakeSwap() public {
        address whale = 0x...; // Known BNB whale
        vm.prank(whale);
        // Test real swap on PancakeSwap
    }
}
```

```bash
# Run fork test
forge test --fork-url https://bsc-dataseed1.binance.org --match-contract ForkTest

# Pin to specific block for reproducibility
forge test --fork-url $BSC_RPC --fork-block-number 35000000

# Cache fork state for faster reruns
forge test --fork-url $BSC_RPC --fork-block-number 35000000
# Foundry auto-caches in ~/.foundry/cache/rpc/
```

### Fork testing for opBNB
```bash
# Fork opBNB mainnet
forge test --fork-url https://opbnb-mainnet-rpc.bnbchain.org --match-contract OpBNBForkTest
```

## Hardhat Testing (TypeScript)

### Test structure
```typescript
// test/MyToken.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("MyToken", function () {
  async function deployFixture() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MyToken");
    const token = await Token.deploy();
    return { token, owner, alice, bob };
  }

  it("should transfer tokens", async function () {
    const { token, owner, alice } = await loadFixture(deployFixture);
    await token.transfer(alice.address, ethers.parseEther("100"));
    expect(await token.balanceOf(alice.address)).to.equal(
      ethers.parseEther("100")
    );
  });

  it("should revert on insufficient balance", async function () {
    const { token, alice, bob } = await loadFixture(deployFixture);
    await expect(
      token.connect(alice).transfer(bob.address, ethers.parseEther("1"))
    ).to.be.reverted;
  });
});
```

```bash
npx hardhat test
npx hardhat test --grep "transfer"
```

### Hardhat fork testing
```typescript
// hardhat.config.ts
networks: {
  hardhat: {
    forking: {
      url: "https://bsc-dataseed1.binance.org",
      blockNumber: 35000000,
    },
  },
}
```

## Coverage

### Foundry coverage
```bash
# Generate coverage report
forge coverage

# Generate lcov report
forge coverage --report lcov

# View in browser (with genhtml)
genhtml lcov.info -o coverage --branch-coverage
open coverage/index.html
```

### Hardhat coverage
```bash
npx hardhat coverage
```

## Test Directory Structure
```
test/
├── unit/                    # Pure unit tests
│   ├── MyToken.t.sol
│   └── Vault.t.sol
├── integration/             # Multi-contract interactions
│   └── VaultWithOracle.t.sol
├── fork/                    # Fork tests against live state
│   ├── PancakeSwapFork.t.sol
│   └── VenusFork.t.sol
├── invariants/              # Invariant/stateful tests
│   ├── VaultInvariant.t.sol
│   └── handlers/
│       └── VaultHandler.sol
├── fuzz/                    # Dedicated fuzz campaigns
│   └── MathFuzz.t.sol
└── helpers/                 # Shared test utilities
    ├── Constants.sol
    └── Assertions.sol
```

## CI Configuration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]

jobs:
  foundry:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge build
      - run: forge test -vvv
      - run: forge coverage --report lcov
      - uses: codecov/codecov-action@v4
        with:
          files: lcov.info

  fork-tests:
    runs-on: ubuntu-latest
    needs: foundry
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test --fork-url ${{ secrets.BSC_RPC_URL }} --match-path "test/fork/*" -vvv
```

## Gas Snapshots
```bash
# Generate gas snapshot
forge snapshot

# Compare against previous snapshot
forge snapshot --check

# Diff format
forge snapshot --diff .gas-snapshot
```

Commit `.gas-snapshot` to track gas regression across PRs.
