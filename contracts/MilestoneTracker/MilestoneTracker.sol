// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract MilestoneTracker {

    struct Token {
        uint256 tokenId;
        address owner;
    }

    struct PaymentMilestone {
        uint256 amount;
        uint256 percentage;
        bool paid;
        OrderStatus status;
        Token token;
        MilestoneType milestoneType;
    }

    struct Milestone {
        uint256 id;
        string description;
        address client;
        address[] contractors;
        address verifier;
        uint256 deadline;
        uint256 amount;
        uint256 projectValue;
        bytes32 documentHash;
        bool completed;
        bool paid;
        bool disputeStatus;
        uint256 penalty;
        PaymentMilestone[] paymentMilestones;
        bool completedByContractor;
        uint256 paymentPercentage;
        Token token;
        MilestoneType milestoneType;
    }

    enum MilestoneType {
        REGULAR,
        PAYMENT
    }

    enum OrderStatus {
        Open,
        Closed
    }

    struct Reputation {
        uint256 score;
        uint256 numRatings;
    }

    uint256 private minVerifierReputation = 1;

    mapping(uint256 => Milestone) public milestones;
    mapping(address => Reputation) public contractorReputations;
    mapping(address => Reputation) public verifierReputations;
    uint256 public numMilestones;

    address public owner;
    mapping(address => bool) public authorizedAddresses;

    event MilestoneCreated(uint256 milestoneId);
    event MilestoneCompleted(uint256 milestoneId, bytes32 documentHash);
    event MilestonePaid(uint256 milestoneId);
    event ContractorPaid(uint256 milestoneId, address contractor, uint256 amount);
    event ContractorRated(address contractor, uint256 score);
    event VerifierRated(address verifier, uint256 score);
    event VerifierPaid(uint256 milestoneId, address verifier, uint256 amount);
    event DisputeResolved(uint256 milestoneId);

    constructor() payable {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    modifier isAuthorized() {
        require(msg.sender == owner || authorizedAddresses[msg.sender], "Not authorized to perform this action.");
        _;
    }

    modifier isValidContractor(address _contractor) {
        require(_contractor != address(0), "Invalid contractor address.");
        require(contractorReputations[_contractor].score > 0, "Contractor has no reputation.");
        _;
    }

    modifier isValidVerifier(address _verifier) {
        require(_verifier != address(0), "Invalid verifier address.");
        require(verifierReputations[_verifier].score > 0, "Verifier has no reputation.");
        _;
    }

    function addAuthorizedAddress(address _address) public onlyOwner {
        authorizedAddresses[_address] = true;
    }

    function removeAuthorizedAddress(address _address) public onlyOwner {
        authorizedAddresses[_address] = false;
    }

    function updateMinVerifierReputation(uint256 _newThreshold) public onlyOwner {
        require(_newThreshold > 0, "New threshold must be greater than zero");
        minVerifierReputation = _newThreshold;
    }

    function fundCybereum(address payable _cybereumAddress) public payable {
        require(msg.value > 0, "Must send non-zero amount of ether");
        require(_cybereumAddress != address(0), "Invalid cybereum address");
        _cybereumAddress.transfer(msg.value);
    }

    function createMilestone(
        address[] memory _contractors,
        address _verifier,
        uint256 _deadline,
        uint256 _amount,
        bytes32 _documentHash,
        uint256 _penalty,
        MilestoneType _type
    ) public returns (uint256) {
        require(_contractors.length >= 1 && _contractors.length < 10, "At least one contractor and less than 10 required");
        require(_verifier != address(0), "Invalid verifier address");
        require(_amount > 0, "Amount must be positive");
        require(_deadline > block.timestamp, "Deadline must be in the future");
        require(_documentHash != bytes32(0), "Invalid document hash");

        uint256 milestoneId = numMilestones++;
        Milestone storage milestone = milestones[milestoneId];
        milestone.id = milestoneId;
        milestone.client = msg.sender;
        milestone.contractors = _contractors;
        milestone.verifier = _verifier;
        milestone.deadline = _deadline;
        milestone.amount = _amount;
        milestone.documentHash = _documentHash;
        milestone.completed = false;
        milestone.paid = false;
        milestone.penalty = _penalty;
        milestone.completedByContractor = false;
        milestone.milestoneType = _type;

        milestone.paymentMilestones.push(PaymentMilestone({
            amount: _amount,
            percentage: 100,
            paid: false,
            status: OrderStatus.Open,
            token: Token({tokenId: 0, owner: address(0)}),
            milestoneType: _type
        }));

        emit MilestoneCreated(milestoneId);
        return milestoneId;
    }

    function getMilestoneValue(uint256 _milestoneId) public view returns (uint256) {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        return milestones[_milestoneId].projectValue;
    }

    function getMilestone(uint256 _milestoneId) public view returns (
        uint256 id,
        string memory description,
        uint256 amount,
        MilestoneType milestoneType
    ) {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        Milestone storage milestone = milestones[_milestoneId];
        return (milestone.id, milestone.description, milestone.amount, milestone.milestoneType);
    }

    function setMilestoneValue(uint256 _milestoneId, uint256 _projectValue) public isAuthorized {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        milestones[_milestoneId].projectValue = _projectValue;
    }

    function completeMilestone(uint256 _milestoneId) public {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        Milestone storage milestone = milestones[_milestoneId];
        require(
            milestone.client == msg.sender || milestone.verifier == msg.sender || _isContractor(msg.sender, _milestoneId),
            "Only client, verifier, or contractor can complete milestone"
        );
        require(milestone.deadline >= block.timestamp, "Milestone is past deadline");
        require(!milestone.completed, "Milestone is already completed");

        uint256 amountToPay = milestone.amount;

        // Apply penalty if past deadline
        if (block.timestamp > milestone.deadline && milestone.penalty > 0) {
            require(amountToPay > milestone.penalty, "Penalty exceeds milestone amount");
            amountToPay = amountToPay - milestone.penalty;
        }

        _payContractors(_milestoneId, amountToPay);

        milestone.completed = true;
        milestone.completedByContractor = (msg.sender != milestone.verifier && msg.sender != milestone.client);
        emit MilestoneCompleted(_milestoneId, milestone.documentHash);

        // Update reputations
        for (uint256 i = 0; i < milestone.contractors.length; i++) {
            _updateReputation(milestone.contractors[i], 1);
        }
        _updateReputation(milestone.verifier, 1);
    }

    function _isContractor(address _addr, uint256 _milestoneId) private view returns (bool) {
        address[] storage contractors = milestones[_milestoneId].contractors;
        for (uint256 i = 0; i < contractors.length; i++) {
            if (contractors[i] == _addr) {
                return true;
            }
        }
        return false;
    }

    function _payContractors(uint256 _milestoneId, uint256 _amountToPay) private {
        Milestone storage milestone = milestones[_milestoneId];
        require(milestone.contractors.length > 0, "No contractors to pay");
        uint256 contractorPayment = _amountToPay / milestone.contractors.length;
        for (uint256 i = 0; i < milestone.contractors.length; i++) {
            address contractor = milestone.contractors[i];
            payable(contractor).transfer(contractorPayment);
            emit ContractorPaid(_milestoneId, contractor, contractorPayment);
        }
    }

    function _payVerifiers() internal {
        for (uint256 i = 0; i < numMilestones; i++) {
            Milestone storage milestone = milestones[i];
            if (milestone.completed && !milestone.paid && verifierReputations[milestone.verifier].score >= minVerifierReputation) {
                for (uint256 j = 0; j < milestone.paymentMilestones.length; j++) {
                    PaymentMilestone storage paymentMilestone = milestone.paymentMilestones[j];
                    if (!paymentMilestone.paid) {
                        uint256 verifierPayment = paymentMilestone.amount / 10; // 10% goes to verifier
                        payable(milestone.verifier).transfer(verifierPayment);
                        paymentMilestone.paid = true;
                        emit VerifierPaid(i, milestone.verifier, verifierPayment);
                    }
                }
                milestone.paid = true;
                emit MilestonePaid(i);
            }
        }
    }

    function payMilestone(uint256 _milestoneId, uint256 _paymentMilestoneIndex) public {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        Milestone storage milestone = milestones[_milestoneId];
        require(_paymentMilestoneIndex < milestone.paymentMilestones.length, "Invalid payment milestone index");
        PaymentMilestone storage paymentMilestone = milestone.paymentMilestones[_paymentMilestoneIndex];
        require(paymentMilestone.status == OrderStatus.Open, "Payment milestone is already paid");

        uint256 amountToPay;

        if (paymentMilestone.milestoneType == MilestoneType.PAYMENT) {
            amountToPay = (paymentMilestone.amount * paymentMilestone.percentage) / 100;
        } else {
            amountToPay = paymentMilestone.amount;
        }

        require(milestone.contractors.length > 0, "No contractors to pay");
        uint256 perContractor = amountToPay / milestone.contractors.length;
        for (uint256 i = 0; i < milestone.contractors.length; i++) {
            address contractor = milestone.contractors[i];
            payable(contractor).transfer(perContractor);
            emit ContractorPaid(_milestoneId, contractor, perContractor);
        }

        paymentMilestone.paid = true;
        paymentMilestone.status = OrderStatus.Closed;
        emit MilestonePaid(_milestoneId);

        // If all payment milestones are completed, mark the milestone as completed
        if (_areAllPaymentMilestonesPaid(milestone)) {
            milestone.completed = true;
            emit MilestoneCompleted(_milestoneId, milestone.documentHash);
        }
    }

    function _areAllPaymentMilestonesPaid(Milestone storage milestone) private view returns (bool) {
        for (uint256 i = 0; i < milestone.paymentMilestones.length; i++) {
            if (!milestone.paymentMilestones[i].paid) {
                return false;
            }
        }
        return true;
    }

    function getNFTTokenIds(uint256 _milestoneId, uint256 _paymentMilestoneIndex) public view returns (uint256) {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        Milestone storage milestone = milestones[_milestoneId];
        require(_paymentMilestoneIndex < milestone.paymentMilestones.length, "Invalid payment milestone index");
        PaymentMilestone storage milestonePayment = milestone.paymentMilestones[_paymentMilestoneIndex];
        require(milestonePayment.paid, "Payment has not been made yet");
        return milestonePayment.token.tokenId;
    }

    function _updateReputation(address _user, uint256 _amount) internal {
        Reputation storage reputation;
        bool isVerifier = false;
        // Check all milestones to determine if user is a verifier
        for (uint256 i = 0; i < numMilestones; i++) {
            if (milestones[i].verifier == _user) {
                isVerifier = true;
                break;
            }
        }

        if (isVerifier) {
            reputation = verifierReputations[_user];
        } else {
            reputation = contractorReputations[_user];
        }
        reputation.score += _amount;
        reputation.numRatings++;

        uint256 rating = reputation.numRatings > 0 ? reputation.score / reputation.numRatings : 0;
        if (isVerifier) {
            emit VerifierRated(_user, rating);
        } else {
            emit ContractorRated(_user, rating);
        }
    }

    function updateVerifierReputationThreshold(uint256 _newThreshold) public onlyOwner {
        require(_newThreshold > 0, "New threshold must be greater than zero");
        minVerifierReputation = _newThreshold;
    }

    function increaseContractorReputation(address _contractor, uint256 _amount) public isAuthorized isValidContractor(_contractor) {
        Reputation storage reputation = contractorReputations[_contractor];
        reputation.score += _amount;
        reputation.numRatings++;
        emit ContractorRated(_contractor, reputation.score / reputation.numRatings);
    }

    function decreaseContractorReputation(address _contractor, uint256 _amount) public isAuthorized isValidContractor(_contractor) {
        Reputation storage reputation = contractorReputations[_contractor];
        require(reputation.score >= _amount, "Score cannot be below zero");
        reputation.score -= _amount;
        // Only decrement numRatings if it's above zero to avoid division by zero
        if (reputation.numRatings > 1) {
            reputation.numRatings--;
        }
        uint256 rating = reputation.numRatings > 0 ? reputation.score / reputation.numRatings : 0;
        emit ContractorRated(_contractor, rating);
    }

    function increaseVerifierReputation(address _verifier, uint256 _amount) public isAuthorized isValidVerifier(_verifier) {
        Reputation storage reputation = verifierReputations[_verifier];
        reputation.score += _amount;
        reputation.numRatings++;
        emit VerifierRated(_verifier, reputation.score / reputation.numRatings);
    }

    function decreaseVerifierReputation(address _verifier, uint256 _amount) public isAuthorized isValidVerifier(_verifier) {
        Reputation storage reputation = verifierReputations[_verifier];
        require(reputation.score >= _amount, "Score cannot be below zero");
        reputation.score -= _amount;
        if (reputation.numRatings > 1) {
            reputation.numRatings--;
        }
        uint256 rating = reputation.numRatings > 0 ? reputation.score / reputation.numRatings : 0;
        emit VerifierRated(_verifier, rating);
    }

    function resolveDispute(uint256 _milestoneId) public {
        require(_milestoneId < numMilestones, "Invalid milestone ID");
        Milestone storage milestone = milestones[_milestoneId];
        require(milestone.client == msg.sender, "Only the client can resolve disputes");
        require(!milestone.completed, "Milestone has already been completed");
        milestone.disputeStatus = true;
        emit DisputeResolved(_milestoneId);
    }
}
