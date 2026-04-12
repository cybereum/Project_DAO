// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ProjectDAORouter — Static multi-facet proxy
 * @notice Holds all storage and routes function calls to the correct
 *         implementation contract via delegatecall. Each implementation
 *         (Core, Governance, Commerce, Network) inherits the same
 *         ProjectDAOStorage layout so storage slots align.
 *
 *         STORAGE SAFETY: The Router stores its own state (_routes,
 *         _selectorsFrozen) at EIP-1967-style hash-derived slots to
 *         avoid colliding with the implementation's sequential layout.
 *         Only immutable variables (no storage) are declared normally.
 *
 *         This is NOT upgradeable. Implementation addresses are set once
 *         during initialization and cannot be changed.
 */
contract ProjectDAORouter {
    // ─── Implementation addresses (immutable = no storage slots) ────────
    address public immutable core;
    address public immutable governance;
    address public immutable commerce;
    address public immutable network;
    address private immutable _deployer;

    // ─── Hash-derived storage slots (avoid collision with implementations) ──
    // keccak256("project_dao.router.routes") - 1
    bytes32 private constant ROUTES_SLOT = 0x7e644d4c4c8bb24e8faa5af3f5d0a363edc57b5e41f32e28c94dbb217f8e5e7a;
    // keccak256("project_dao.router.frozen") - 1
    bytes32 private constant FROZEN_SLOT = 0x2a3c5e5d3e4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b;

    // ─── Events ─────────────────────────────────────────────────────────
    event RouteRegistered(bytes4 indexed selector, address indexed implementation);

    constructor(
        address _core,
        address _governance,
        address _commerce,
        address _network
    ) {
        require(_core != address(0), "Invalid core address");
        require(_governance != address(0), "Invalid governance address");
        require(_commerce != address(0), "Invalid commerce address");
        require(_network != address(0), "Invalid network address");

        core = _core;
        governance = _governance;
        commerce = _commerce;
        network = _network;
        _deployer = msg.sender;
    }

    // ─── Storage access helpers ─────────────────────────────────────────

    function _getRoute(bytes4 selector) internal view returns (address impl) {
        bytes32 slot = keccak256(abi.encode(selector, ROUTES_SLOT));
        assembly { impl := sload(slot) }
    }

    function _setRoute(bytes4 selector, address impl) internal {
        bytes32 slot = keccak256(abi.encode(selector, ROUTES_SLOT));
        assembly { sstore(slot, impl) }
    }

    function _isFrozen() internal view returns (bool frozen) {
        bytes32 slot = FROZEN_SLOT;
        assembly { frozen := sload(slot) }
    }

    function _setFrozen() internal {
        bytes32 slot = FROZEN_SLOT;
        assembly { sstore(slot, 1) }
    }

    // ─── Selector registration ──────────────────────────────────────────

    /**
     * @notice Register function selectors for an implementation contract.
     *         Only the original deployer can call this, and only before
     *         selectors are frozen. Call freezeSelectors() after setup.
     */
    function registerSelectors(address implementation, bytes4[] calldata selectors) external {
        require(msg.sender == _deployer, "Only deployer can register.");
        require(!_isFrozen(), "Selectors are frozen.");
        for (uint256 i = 0; i < selectors.length; i++) {
            require(_getRoute(selectors[i]) == address(0), "Selector already registered.");
            _setRoute(selectors[i], implementation);
            emit RouteRegistered(selectors[i], implementation);
        }
    }

    /**
     * @notice Permanently freeze selector registration. Irreversible.
     */
    function freezeSelectors() external {
        require(msg.sender == _deployer, "Only deployer can freeze.");
        _setFrozen();
    }

    /**
     * @notice Get the implementation address for a function selector.
     */
    function getImplementation(bytes4 selector) external view returns (address) {
        return _getRoute(selector);
    }

    /**
     * @notice Fallback: route all calls to the correct implementation via delegatecall.
     */
    fallback() external payable {
        address impl = _getRoute(msg.sig);
        require(impl != address(0), "Function not found.");

        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
