// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ServiceAgreementLib — Conditional escrow service agreements
 * @notice External library holding the service agreement lifecycle:
 *         creation, delivery submission, approval, dispute, and
 *         cancellation. The main contract enforces authorization and
 *         fee collection; this library handles validation, mutation,
 *         and event emission.
 */
library ServiceAgreementLib {
    enum AgreementStatus { Active, Delivered, Completed, Disputed, Cancelled }

    struct ServiceAgreement {
        uint256 id;
        address client;
        address provider;
        address arbiter;
        uint256 amount;
        string  description;
        AgreementStatus status;
        uint256 createdAt;
        uint256 deadline;
        bytes32 deliveryHash;
    }

    struct Store {
        uint256 currentId;
        mapping(uint256 => ServiceAgreement) agreements;
        mapping(address => uint256) activeCount;
        // Reserved for future fields — storage-gap pattern.
        uint256[50] __gap;
    }

    event ServiceAgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address arbiter, uint256 amount, uint256 deadline, string description);
    event ServiceDeliverySubmitted(uint256 indexed agreementId, address indexed provider, bytes32 deliveryHash);
    event ServiceAgreementCompleted(uint256 indexed agreementId, address indexed client, address indexed provider, uint256 paidAmount);
    event ServiceAgreementDisputed(uint256 indexed agreementId, address indexed disputant);
    event ServiceDisputeResolved(uint256 indexed agreementId, bool inFavorOfProvider, address indexed resolver);
    event ServiceAgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy);

    /// @notice Create a service agreement. Returns the agreement ID.
    /// @dev Caller must validate agent registration, check escrow balance, and debit escrow.
    function create(
        Store storage self,
        address client,
        address provider,
        address arbiter,
        uint256 amount,
        uint256 deadline,
        string calldata description
    ) external returns (uint256) {
        require(provider != client, "Cannot create agreement with yourself.");
        require(amount > 0, "Amount must be greater than zero.");
        require(deadline > block.timestamp, "Deadline must be in the future.");
        if (arbiter != address(0)) {
            require(arbiter != client && arbiter != provider, "Arbiter must be a third party.");
        }

        self.activeCount[client]++;
        self.activeCount[provider]++;

        uint256 id = self.currentId++;
        self.agreements[id] = ServiceAgreement({
            id: id,
            client: client,
            provider: provider,
            arbiter: arbiter,
            amount: amount,
            description: description,
            status: AgreementStatus.Active,
            createdAt: block.timestamp,
            deadline: deadline,
            deliveryHash: bytes32(0)
        });

        emit ServiceAgreementCreated(id, client, provider, arbiter, amount, deadline, description);
        return id;
    }

    /// @notice Provider submits proof of delivery.
    function submitDelivery(Store storage self, uint256 agreementId, address caller, bytes32 deliveryHash) external {
        ServiceAgreement storage a = self.agreements[agreementId];
        require(a.id > 0, "Agreement not found.");
        require(a.provider == caller, "Only the provider can submit delivery.");
        require(a.status == AgreementStatus.Active, "Agreement is not active.");
        require(block.timestamp <= a.deadline, "Delivery deadline has passed.");
        require(deliveryHash != bytes32(0), "Delivery hash cannot be empty.");

        a.deliveryHash = deliveryHash;
        a.status = AgreementStatus.Delivered;

        emit ServiceDeliverySubmitted(agreementId, caller, deliveryHash);
    }

    /// @notice Client approves delivery. Returns (provider, amount) for fee collection and escrow credit.
    function approveDelivery(Store storage self, uint256 agreementId, address caller)
        external returns (address provider, uint256 amount)
    {
        ServiceAgreement storage a = self.agreements[agreementId];
        require(a.id > 0, "Agreement not found.");
        require(a.client == caller, "Only the client can approve delivery.");
        require(a.status == AgreementStatus.Delivered, "Delivery not yet submitted.");

        a.status = AgreementStatus.Completed;
        self.activeCount[a.client]--;
        self.activeCount[a.provider]--;

        return (a.provider, a.amount);
    }

    /// @notice Dispute a service agreement.
    function dispute(Store storage self, uint256 agreementId, address caller) external {
        ServiceAgreement storage a = self.agreements[agreementId];
        require(a.id > 0, "Agreement not found.");
        require(caller == a.client || caller == a.provider, "Not a party to this agreement.");
        require(a.status == AgreementStatus.Active || a.status == AgreementStatus.Delivered, "Cannot dispute in current status.");
        require(a.arbiter != address(0), "No arbiter assigned - use cancelServiceAgreement instead.");

        a.status = AgreementStatus.Disputed;
        emit ServiceAgreementDisputed(agreementId, caller);
    }

    /// @notice Arbiter resolves a dispute. Returns (client, provider, amount, inFavorOfProvider).
    function resolveDispute(Store storage self, uint256 agreementId, address caller, bool inFavorOfProvider)
        external returns (address client, address provider, uint256 amount)
    {
        ServiceAgreement storage a = self.agreements[agreementId];
        require(a.id > 0, "Agreement not found.");
        require(a.arbiter == caller, "Only the arbiter can resolve disputes.");
        require(a.status == AgreementStatus.Disputed, "Agreement is not disputed.");

        a.status = AgreementStatus.Completed;
        self.activeCount[a.client]--;
        self.activeCount[a.provider]--;

        emit ServiceDisputeResolved(agreementId, inFavorOfProvider, caller);
        return (a.client, a.provider, a.amount);
    }

    /// @notice Cancel an active agreement. Returns (client, amount) for refund.
    function cancel(Store storage self, uint256 agreementId, address caller)
        external returns (address client, uint256 amount)
    {
        ServiceAgreement storage a = self.agreements[agreementId];
        require(a.id > 0, "Agreement not found.");
        require(a.status == AgreementStatus.Active, "Can only cancel active agreements.");
        require(caller == a.client || caller == a.provider, "Not a party to this agreement.");
        require(
            caller == a.client || block.timestamp > a.deadline,
            "Provider can only cancel after deadline."
        );

        a.status = AgreementStatus.Cancelled;
        self.activeCount[a.client]--;
        self.activeCount[a.provider]--;

        emit ServiceAgreementCancelled(agreementId, caller);
        return (a.client, a.amount);
    }

    // ─── View Functions ──────────────────────���──────────────────────────────

    function getAgreement(Store storage self, uint256 agreementId) external view returns (
        uint256 id, address client, address provider, address arbiter,
        uint256 amount, string memory description, AgreementStatus status,
        uint256 createdAt, uint256 deadline, bytes32 deliveryHash
    ) {
        ServiceAgreement storage a = self.agreements[agreementId];
        return (a.id, a.client, a.provider, a.arbiter, a.amount, a.description, a.status, a.createdAt, a.deadline, a.deliveryHash);
    }
}
