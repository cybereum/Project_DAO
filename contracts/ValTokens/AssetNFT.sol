// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./SafeMath.sol";

contract AssetNFT is ERC721URIStorage, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
uint256 private _totalSupply;
mapping (address => uint256) public balanceOf;
mapping (address => mapping (address => bool)) public allowed;

struct Asset {
    uint256 id;
    string assetType;
}

mapping(uint256 => mapping(bytes32 => bytes32)) public assetParams;

Asset[] public assets;
uint256 public nextAssetId = 0;

IERC20 public token;

constructor(IERC20 _token, uint256 _supply) ERC721("AssetNFT", "ASSETNFT") {
    token = _token;
    _totalSupply = _supply;
    balanceOf[msg.sender] = _totalSupply;
}

// Function for allowing approved addresses to transfer token ownership
function approve(address _to) public {
    allowed[msg.sender][_to] = true;
}

// Function to burn tokens and update the total supply accordingly
function burn(address _owner, uint256 _tokenId) public {
    require(_tokenId > 0 && _tokenId <= balanceOf[_owner], "Token does not exist or amount is greater than balance");
    balanceOf[_owner] -= _tokenId;
    _totalSupply -= _tokenId;
}

function mintAsset(
    string memory _assetType, 
    bytes32[] memory _params
) public onlyOwner {
    assets.push(Asset(
        nextAssetId, 
        _assetType
    ));
    _safeMint(msg.sender, nextAssetId);
    _setTokenURI(nextAssetId, string(abi.encodePacked("https://example.com/asset/", uint2str(nextAssetId))));
    for (uint i = 0; i < _params.length; i += 2) {
        assetParams[nextAssetId][_params[i]] = _params[i+1];
    }
    nextAssetId++;
}

function createAsset(
    string memory _assetType, 
    bytes32[] memory _params
) public {
    assets.push(Asset(
        nextAssetId, 
        _assetType
    ));
    _safeMint(msg.sender, nextAssetId);
    _setTokenURI(nextAssetId, string(abi.encodePacked("https://example.com/asset/", uint2str(nextAssetId))));
for (uint i = 0; i < _params.length; i += 2) {
assetParams[nextAssetId][_params[i]] = _params[i+1];
}
nextAssetId++;
}

function getAsset(uint256 _id) public view returns (Asset memory, mapping(bytes32 => bytes32) memory) {
return (assets[_id], assetParams[_id]);
}

function transferAsset(address _to, uint256 _id) public {
  safeTransferFrom(msg.sender, _to, _id);
}

function buyTokens(uint256 _id, uint256 _amount) public {
  Asset storage asset = assets[_id];
  uint256 cost = _amount * 1 ether;
  require(token.allowance(msg.sender, address(this)) >= cost, "Not enough token allowance");
  token.safeTransferFrom(msg.sender, address(this), cost);
  bytes32 sender = bytes32(msg.sender);
  assetParams[_id][bytes32("balanceOf")][sender] += bytes32(_amount);
}

function sellTokens(uint256 _id, uint256 _amount) public {
  require(_id < nextAssetId, "Asset does not exist");
  Asset storage asset = assets[_id];
  bytes32 sender = bytes32(msg.sender);
  bytes32 balance = assetParams[_id][bytes32("balanceOf")][sender];
  require(balance >= bytes32(_amount), "Not enough tokens");
  assetParams[_id][bytes32("balanceOf")][sender] = balance - bytes32(_amount);
  token.safeTransfer(msg.sender, _amount * 1 ether);
}


function uint2str(int256 _i) internal pure returns (string memory str) {
    bool negative = false;
    if (_i < 0) {
        negative = true;
        _i = -_i;
    }
    if (_i == 0) {
        return "0";
    }
    uint256 j = uint256(_i);
    uint256 length;
    while (j != 0) {
        length++;
        j /= 10;
    }
    bytes memory bstr = new bytes(negative ? length + 1 : length);
    uint256 k = length;
    while (_i != 0) {
        bstr[--k] = bytes1(uint8(48 + _i % 10));
        _i /= 10;
    }
    if (negative) {
        bstr[0] = '-';
    }
    str = string(bstr);
}
}
