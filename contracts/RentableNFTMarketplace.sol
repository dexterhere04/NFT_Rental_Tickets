// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC4907.sol";

contract RentableNFTMarketplace is Ownable, ReentrancyGuard {
    struct Rental {
        address renter;
        uint256 expires;
        uint256 pricePerDay;
    }

    mapping(address => mapping(uint256 => Rental)) public rentals;

    uint256 public feeBps;
    address public feeRecipient;

    event Listed(address indexed nft, uint256 indexed tokenId, uint256 pricePerDay);
    event Rented(address indexed nft, uint256 indexed tokenId, address indexed renter, uint256 expires);
    event Cancelled(address indexed nft, uint256 indexed tokenId);

    constructor(address _feeRecipient, uint256 _feeBps) Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    function listForRent(address nft, uint256 tokenId, uint256 pricePerDay) external {
        IERC721 token = IERC721(nft);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        rentals[nft][tokenId] = Rental(address(0), 0, pricePerDay);
        emit Listed(nft, tokenId, pricePerDay);
    }

    function cancelListing(address nft, uint256 tokenId) external {
        IERC721 token = IERC721(nft);
        require(token.ownerOf(tokenId) == msg.sender, "Not owner");
        delete rentals[nft][tokenId];
        emit Cancelled(nft, tokenId);
    }

    function rent(address nft, uint256 tokenId, uint256 daysToRent) external payable nonReentrant {
        Rental storage r = rentals[nft][tokenId];
        require(r.pricePerDay > 0, "Not listed");
        require(r.renter == address(0) || block.timestamp > r.expires, "Already rented");

        uint256 totalPrice = r.pricePerDay * daysToRent;
        require(msg.value >= totalPrice, "Insufficient payment");

        uint256 fee = (totalPrice * feeBps) / 10000;
        uint256 ownerAmount = totalPrice - fee;

        address owner = IERC721(nft).ownerOf(tokenId);

        // Payouts
        (bool success, ) = owner.call{value: ownerAmount}("");
        require(success, "Owner payment failed");

        (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
        require(feeSuccess, "Fee payment failed");

        // Refund if overpaid
        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }

        // Update rental state
        r.renter = msg.sender;
        r.expires = block.timestamp + (daysToRent * 1 days);

        // ERC-4907 support
        if (IERC165(nft).supportsInterface(type(IERC4907).interfaceId)) {
            IERC4907(nft).setUser(tokenId, msg.sender, uint64(r.expires));
        }

        emit Rented(nft, tokenId, msg.sender, r.expires);
    }

    function withdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
