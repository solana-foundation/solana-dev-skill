# Token Standards on BNB Chain (BEP-20 / BEP-721 / BEP-1155)

## Standard Mapping

| BNB Chain | Ethereum Equivalent | Purpose |
|-----------|-------------------|---------|
| BEP-20 | ERC-20 | Fungible tokens |
| BEP-721 | ERC-721 | Non-fungible tokens |
| BEP-1155 | ERC-1155 | Multi-token (fungible + NFT) |
| BEP-2 | — | Deprecated (Beacon Chain) |

BNB Smart Chain is fully EVM-compatible. All ERC token standards work natively. The "BEP" prefix is a naming convention, not a technical difference.

---

## BEP-20 (Fungible Tokens)

### Basic token
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, ERC20Permit, ERC20Burnable, Ownable {
    constructor()
        ERC20("My Token", "MTK")
        ERC20Permit("My Token")
        Ownable(msg.sender)
    {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    // Optional: capped minting
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

### Token with transfer fee (tax token)
Common on BSC — many meme tokens and protocol tokens take a fee on transfers.

```solidity
contract TaxToken is ERC20, Ownable {
    uint256 public buyFee = 300;    // 3%
    uint256 public sellFee = 500;   // 5%
    uint256 constant FEE_DENOMINATOR = 10000;

    address public treasury;
    mapping(address => bool) public isExcludedFromFee;
    mapping(address => bool) public isPair; // AMM pairs

    constructor(address _treasury)
        ERC20("Tax Token", "TAXT")
        Ownable(msg.sender)
    {
        treasury = _treasury;
        isExcludedFromFee[msg.sender] = true;
        isExcludedFromFee[_treasury] = true;
        _mint(msg.sender, 1_000_000e18);
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (isExcludedFromFee[from] || isExcludedFromFee[to]) {
            super._update(from, to, amount);
            return;
        }

        uint256 fee;
        if (isPair[from]) {
            // Buy
            fee = (amount * buyFee) / FEE_DENOMINATOR;
        } else if (isPair[to]) {
            // Sell
            fee = (amount * sellFee) / FEE_DENOMINATOR;
        }

        if (fee > 0) {
            super._update(from, treasury, fee);
            amount -= fee;
        }
        super._update(from, to, amount);
    }
}
```

### Handling fee-on-transfer tokens safely
```solidity
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SafeTokenHandler {
    using SafeERC20 for IERC20;

    // Measure actual received amount (handles tax tokens)
    function safeDeposit(IERC20 token, uint256 amount) internal returns (uint256 received) {
        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        received = token.balanceOf(address(this)) - balBefore;
    }
}
```

### ERC-2612 Permit (gasless approvals)
```solidity
// Already included via ERC20Permit
// Users sign off-chain, relayer submits permit + action in one tx

// Frontend usage:
// 1. User signs EIP-712 permit message
// 2. Relayer calls permit() then transferFrom() in same tx
// 3. No separate approve transaction needed
```

---

## BEP-721 (NFTs)

### Basic NFT
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;
    uint256 public maxSupply = 10000;
    uint256 public mintPrice = 0.1 ether; // 0.1 BNB

    constructor() ERC721("My NFT", "MNFT") Ownable(msg.sender) {}

    function mint(string calldata uri) external payable {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_nextTokenId < maxSupply, "Sold out");

        uint256 tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function withdraw() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        require(ok);
    }

    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable) returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

### NFT with on-chain metadata
```solidity
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract OnChainNFT is ERC721 {
    using Strings for uint256;

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory json = Base64.encode(bytes(string.concat(
            '{"name":"NFT #', tokenId.toString(),
            '","description":"On-chain NFT on BNB Chain",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(_generateSVG(tokenId))),
            '"}'
        )));

        return string.concat("data:application/json;base64,", json);
    }

    function _generateSVG(uint256 tokenId) internal pure returns (string memory) {
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">',
            '<rect width="350" height="350" fill="#F0B90B"/>',
            '<text x="175" y="175" text-anchor="middle" font-size="48" fill="white">',
            '#', tokenId.toString(),
            '</text></svg>'
        );
    }
}
```

### ERC-2981 Royalties
```solidity
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract RoyaltyNFT is ERC721, ERC2981 {
    constructor() ERC721("Royalty NFT", "RNFT") {
        // 5% royalty to deployer
        _setDefaultRoyalty(msg.sender, 500); // 500 basis points = 5%
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC2981) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

---

## BEP-1155 (Multi-Token)

### Game items / semi-fungible tokens
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ERC1155Supply} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract GameItems is ERC1155, ERC1155Supply, Ownable {
    uint256 public constant GOLD = 0;
    uint256 public constant SILVER = 1;
    uint256 public constant SWORD = 2;
    uint256 public constant SHIELD = 3;

    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => uint256) public mintPrice;

    constructor() ERC1155("https://api.mygame.com/items/{id}.json") Ownable(msg.sender) {
        maxSupply[GOLD] = type(uint256).max;   // Unlimited fungible
        maxSupply[SILVER] = type(uint256).max;
        maxSupply[SWORD] = 1000;                // Limited NFT-like
        maxSupply[SHIELD] = 500;

        // Mint initial supply
        _mint(msg.sender, GOLD, 1_000_000e18, "");
        _mint(msg.sender, SILVER, 5_000_000e18, "");
    }

    function mint(address to, uint256 id, uint256 amount) external payable {
        require(totalSupply(id) + amount <= maxSupply[id], "Exceeds max");
        if (mintPrice[id] > 0) {
            require(msg.value >= mintPrice[id] * amount, "Insufficient payment");
        }
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] calldata ids, uint256[] calldata amounts)
        external onlyOwner
    {
        _mintBatch(to, ids, amounts, "");
    }

    function _update(
        address from, address to, uint256[] memory ids, uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
```

---

## NFT Marketplace Integration

### Listing and buying pattern
```solidity
contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public nextListingId;
    uint256 public platformFee = 250; // 2.5%

    function list(address nft, uint256 tokenId, uint256 price) external {
        IERC721(nft).transferFrom(msg.sender, address(this), tokenId);
        listings[nextListingId++] = Listing(msg.sender, nft, tokenId, price, true);
    }

    function buy(uint256 listingId) external payable nonReentrant {
        Listing storage l = listings[listingId];
        require(l.active, "Not active");
        require(msg.value >= l.price, "Insufficient");

        l.active = false;

        // Platform fee
        uint256 fee = (l.price * platformFee) / 10000;
        // Royalty (ERC-2981)
        (address royaltyRecipient, uint256 royalty) =
            IERC2981(l.nftContract).royaltyInfo(l.tokenId, l.price);

        // Transfer NFT
        IERC721(l.nftContract).transferFrom(address(this), msg.sender, l.tokenId);

        // Distribute payments
        if (royalty > 0 && royaltyRecipient != address(0)) {
            payable(royaltyRecipient).transfer(royalty);
        }
        payable(owner()).transfer(fee);
        payable(l.seller).transfer(l.price - fee - royalty);
    }
}
```

## Token Launch Checklist (BSC)

1. **Choose standard**: BEP-20 for fungible, BEP-721 for unique NFTs, BEP-1155 for game items
2. **Decide tokenomics**: Fixed supply, mintable, burnable, fee-on-transfer
3. **Add permit (ERC-2612)** for BEP-20 — better UX with gasless approvals
4. **Add royalties (ERC-2981)** for BEP-721/1155 — enforced by marketplaces
5. **Test thoroughly**: Unit tests + fork tests against PancakeSwap if adding liquidity
6. **Deploy**: Testnet first, verify on BscScan, then mainnet
7. **Add liquidity**: PancakeSwap v3 concentrated liquidity for best capital efficiency
8. **Lock liquidity**: Use a locker contract or service (trust signal)
9. **Renounce ownership** if applicable (irreversible — only for fully decentralized tokens)
