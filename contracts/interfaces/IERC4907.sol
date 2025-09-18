// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title ERC-4907 Rental NFT Interface
/// @dev see https://eips.ethereum.org/EIPS/eip-4907
interface IERC4907 is IERC165 {
    /// @notice Set the user and expiry of an NFT
    /// @param tokenId The NFT to set user info on
    /// @param user The new user of the NFT
    /// @param expires UNIX timestamp when user expires
    function setUser(uint256 tokenId, address user, uint64 expires) external;

    /// @notice Get user address of an NFT
    /// @param tokenId The NFT to get user info for
    /// @return The user address
    function userOf(uint256 tokenId) external view returns (address);

    /// @notice Get user expiry of an NFT
    /// @param tokenId The NFT to get expiry for
    /// @return UNIX timestamp when user expires
    function userExpires(uint256 tokenId) external view returns (uint256);

    /// @dev Emitted when user or expiry is changed
    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);
}
