// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC4907 {
    // Logged when the user of an NFT is changed or expires
    event UpdateUser(uint256 indexed tokenId, address indexed user, uint64 expires);

    /// @notice set the user and expires of an NFT
    function setUser(uint256 tokenId, address user, uint64 expires) external;

    /// @notice get the user address of an NFT
    function userOf(uint256 tokenId) external view returns (address);

    /// @notice get the user expires of an NFT
    function userExpires(uint256 tokenId) external view returns (uint256);
}
