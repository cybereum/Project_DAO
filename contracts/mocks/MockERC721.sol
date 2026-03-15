// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    uint256 public nextId;

    constructor() ERC721("MockAsset", "MASS") {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = nextId;
        nextId += 1;
        _mint(to, tokenId);
    }
}
