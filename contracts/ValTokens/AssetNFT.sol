// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AssetNFT is ERC721URIStorage, Ownable {
    using SafeERC20 for IERC20;

    struct Asset {
        uint256 id;
        string assetType;
    }

    mapping(uint256 => mapping(bytes32 => bytes32)) public assetParams;

    Asset[] public assets;
    uint256 public nextAssetId = 0;

    IERC20 public token;

    constructor(IERC20 _token) ERC721("AssetNFT", "ASSETNFT") {
        token = _token;
    }

    function mintAsset(
        string memory _assetType,
        bytes32[] memory _params
    ) public onlyOwner {
        require(_params.length % 2 == 0, "Params must be key-value pairs.");
        uint256 assetId = nextAssetId;
        assets.push(Asset(assetId, _assetType));
        _safeMint(msg.sender, assetId);
        _setTokenURI(assetId, string(abi.encodePacked("https://example.com/asset/", _uint2str(assetId))));
        for (uint256 i = 0; i < _params.length; i += 2) {
            assetParams[assetId][_params[i]] = _params[i + 1];
        }
        nextAssetId++;
    }

    function createAsset(
        string memory _assetType,
        bytes32[] memory _params
    ) public onlyOwner {
        require(_params.length % 2 == 0, "Params must be key-value pairs.");
        uint256 assetId = nextAssetId;
        assets.push(Asset(assetId, _assetType));
        _safeMint(msg.sender, assetId);
        _setTokenURI(assetId, string(abi.encodePacked("https://example.com/asset/", _uint2str(assetId))));
        for (uint256 i = 0; i < _params.length; i += 2) {
            assetParams[assetId][_params[i]] = _params[i + 1];
        }
        nextAssetId++;
    }

    function getAsset(uint256 _id) public view returns (Asset memory) {
        require(_id < nextAssetId, "Asset does not exist.");
        return assets[_id];
    }

    function getAssetParam(uint256 _id, bytes32 _key) public view returns (bytes32) {
        require(_id < nextAssetId, "Asset does not exist.");
        return assetParams[_id][_key];
    }

    function transferAsset(address _to, uint256 _id) public {
        safeTransferFrom(msg.sender, _to, _id);
    }

    function burnAsset(uint256 _tokenId) public {
        require(_isApprovedOrOwner(msg.sender, _tokenId), "Caller is not owner nor approved.");
        _burn(_tokenId);
    }

    function _uint2str(uint256 _i) internal pure returns (string memory str) {
        if (_i == 0) {
            return "0";
        }
        uint256 j = _i;
        uint256 length;
        while (j != 0) {
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint256 k = length;
        while (_i != 0) {
            bstr[--k] = bytes1(uint8(48 + _i % 10));
            _i /= 10;
        }
        str = string(bstr);
    }
}
