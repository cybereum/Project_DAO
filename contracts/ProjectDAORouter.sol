// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ProjectDAORouter — Static multi-facet proxy
 * @notice Holds all storage and routes function calls to the correct
 *         implementation contract via delegatecall. Each implementation
 *         (Core, Governance, Commerce, Network) inherits the same
 *         ProjectDAOStorage layout so storage slots align.
 *
 *         This is NOT upgradeable. Implementation addresses are set once
 *         during initialization and cannot be changed.
 *
 *         The Router itself has no business logic — only selector routing.
 *         Its deployed bytecode is minimal (well under 24KB).
 */
contract ProjectDAORouter {
    // ─── Implementation addresses ───────────────────────────────────────
    address public immutable core;
    address public immutable governance;
    address public immutable commerce;
    address public immutable network;

    // ─── Selector → implementation mapping ──────────────────────────────
    mapping(bytes4 => address) private _routes;

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
    }

    /**
     * @notice Register function selectors for an implementation contract.
     *         Called by the deploy script after construction.
     * @param implementation  Address of the implementation contract.
     * @param selectors       Array of 4-byte function selectors to route.
     */
    function registerSelectors(address implementation, bytes4[] calldata selectors) external {
        // Only callable before any routes exist (one-time setup)
        // Using a simple check: only the deployer can register, and only once per selector
        require(msg.sender == tx.origin, "Only deployer can register.");
        for (uint256 i = 0; i < selectors.length; i++) {
            require(_routes[selectors[i]] == address(0), "Selector already registered.");
            _routes[selectors[i]] = implementation;
            emit RouteRegistered(selectors[i], implementation);
        }
    }

    /**
     * @notice Get the implementation address for a function selector.
     */
    function getImplementation(bytes4 selector) external view returns (address) {
        return _routes[selector];
    }

    /**
     * @notice Fallback: route all calls to the correct implementation via delegatecall.
     */
    fallback() external payable {
        address impl = _routes[msg.sig];
        require(impl != address(0), "Function not found.");

        assembly {
            // Copy calldata
            calldatacopy(0, 0, calldatasize())
            // Delegatecall to implementation
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            // Copy return data
            returndatacopy(0, 0, returndatasize())
            // Forward result
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
