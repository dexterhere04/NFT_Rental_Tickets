// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IERC4907.sol";


contract RentableTicketNFT is ERC721, Ownable, ReentrancyGuard {
    // ====== RENTAL PART ======
    struct Rental {
        address renter;
        uint256 expires;
        uint256 pricePerDay;
    }

    mapping(uint256 => Rental) public rentals; // rental info for each ticket NFT
    uint256 public feeBps;
    address public feeRecipient;

    // ====== TICKET PART ======
    uint256 public totalOccasions;
    uint256 public totalSupply;

    struct Occasion {
        uint256 id;
        string name;
        uint256 cost;
        uint256 tickets;
        uint256 maxTickets;
        string date;
        string time;
        string location;
    }

    mapping(uint256 => Occasion) public occasions;
    mapping(uint256 => mapping(address => bool)) public hasBought;
    mapping(uint256 => mapping(uint256 => address)) public seatTaken;
    mapping(uint256 => uint256[]) public seatsTaken;

    // ====== EVENTS ======
    event OccasionListed(uint256 id, string name, uint256 cost, uint256 maxTickets, string date, string time, string location);
    event TicketMinted(uint256 occasionId, uint256 seat, address buyer, uint256 tokenId);
    event Rented(uint256 tokenId, address indexed renter, uint256 expires);
    event RentalListed(uint256 tokenId, uint256 pricePerDay);

    constructor(
        string memory _name,
        string memory _symbol,
        address _feeRecipient,
        uint256 _feeBps
    ) ERC721(_name, _symbol) {
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;
    }

    // ====== TICKET FUNCTIONS ======
    function listOccasion(
        string memory _name,
        uint256 _cost,
        uint256 _maxTickets,
        string memory _date,
        string memory _time,
        string memory _location
    ) public onlyOwner {
        totalOccasions++;
        occasions[totalOccasions] = Occasion(
            totalOccasions,
            _name,
            _cost,
            _maxTickets,
            _maxTickets,
            _date,
            _time,
            _location
        );
        emit OccasionListed(totalOccasions, _name, _cost, _maxTickets, _date, _time, _location);
    }

    function mintTicket(uint256 _id, uint256 _seat, uint256 pricePerDay) public payable {
        require(_id != 0 && _id <= totalOccasions, "Invalid occasion");
        require(msg.value >= occasions[_id].cost, "Insufficient payment");
        require(seatTaken[_id][_seat] == address(0), "Seat taken");
        require(_seat <= occasions[_id].maxTickets, "Invalid seat");

        occasions[_id].tickets -= 1;
        hasBought[_id][msg.sender] = true;
        seatTaken[_id][_seat] = msg.sender;
        seatsTaken[_id].push(_seat);

        totalSupply++;
        _safeMint(msg.sender, totalSupply);

        // Automatically list the ticket NFT for rent if pricePerDay > 0
        if (pricePerDay > 0) {
            rentals[totalSupply] = Rental(address(0), 0, pricePerDay);
            emit RentalListed(totalSupply, pricePerDay);
        }

        emit TicketMinted(_id, _seat, msg.sender, totalSupply);
    }

    function getOccasion(uint256 _id) public view returns (Occasion memory) {
        return occasions[_id];
    }

    function getSeatsTaken(uint256 _id) public view returns (uint256[] memory) {
        return seatsTaken[_id];
    }

    // ====== RENTAL FUNCTIONS ======
    function listForRent(uint256 tokenId, uint256 pricePerDay) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        rentals[tokenId] = Rental(address(0), 0, pricePerDay);
        emit RentalListed(tokenId, pricePerDay);
    }

    function rent(uint256 tokenId, uint256 daysToRent) external payable nonReentrant {
        Rental storage r = rentals[tokenId];
        require(r.pricePerDay > 0, "Not listed");
        require(r.renter == address(0) || block.timestamp > r.expires, "Already rented");

        uint256 totalPrice = r.pricePerDay * daysToRent;
        require(msg.value >= totalPrice, "Insufficient payment");

        uint256 fee = (totalPrice * feeBps) / 10000;
        uint256 ownerAmount = totalPrice - fee;

        address ownerAddr = ownerOf(tokenId);

        (bool success, ) = ownerAddr.call{value: ownerAmount}("");
        require(success, "Owner payment failed");

        (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
        require(feeSuccess, "Fee payment failed");

        if (msg.value > totalPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalPrice}("");
            require(refundSuccess, "Refund failed");
        }

        r.renter = msg.sender;
        r.expires = block.timestamp + (daysToRent * 1 days);

        if (IERC165(address(this)).supportsInterface(type(IERC4907).interfaceId)) {
            IERC4907(address(this)).setUser(tokenId, msg.sender, uint64(r.expires));
        }

        emit Rented(tokenId, msg.sender, r.expires);
    }

    // ====== WITHDRAW ======
    function withdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}
