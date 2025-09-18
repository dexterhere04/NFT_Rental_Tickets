// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IERC4907.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RentableNFTMarketplace is Ownable {
    struct Rental {
        address renter;
        uint256 expires;
        uint256 pricePerDay;
    }

    // nft contract => tokenId => rental info
    mapping(address => mapping(uint256 => Rental)) public rentals;

    // marketplace fee in basis points (e.g., 250 = 2.5%)
    uint256 public feeBps;

    event Listed(address indexed nft, uint256 indexed tokenId, uint256 pricePerDay);
    event Rented(address indexed nft, uint256 indexed tokenId, address indexed renter, uint256 expires);

    constructor(address _feeRecipient, uint256 _feeBps) Ownable(msg.sender) {
        feeBps = _feeBps;
    }
    
    // List NFT for rent
    function listForRent(address nft, uint256 tokenId, uint256 pricePerDay) external {
        IERC721 token = IERC721(nft);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        rentals[nft][tokenId] = Rental(address(0), 0, pricePerDay);

        emit Listed(nft, tokenId, pricePerDay);
    }

    // Rent NFT
    function rent(address nft, uint256 tokenId, uint256 daysToRent) external payable {
        Rental storage r = rentals[nft][tokenId];
        require(r.pricePerDay > 0, "Not listed");
        require(r.renter == address(0) || block.timestamp > r.expires, "Already rented");

        uint256 totalPrice = r.pricePerDay * daysToRent;
        uint256 fee = (totalPrice * feeBps) / 10000;
        uint256 ownerAmount = totalPrice - fee;

        IERC721 token = IERC721(nft);
        address owner = token.ownerOf(tokenId);

        require(msg.value >= totalPrice, "Insufficient payment");

        // Pay owner
        payable(owner).transfer(ownerAmount);

        // Set renter
        r.renter = msg.sender;
        r.expires = block.timestamp + (daysToRent * 1 days);

        // If NFT supports ERC-4907, set user
        if (IERC165(nft).supportsInterface(type(IERC4907).interfaceId)) {
            IERC4907(nft).setUser(tokenId, msg.sender, r.expires);
        }

        emit Rented(nft, tokenId, msg.sender, r.expires);
    }

    // Withdraw marketplace fees (owner only)
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
