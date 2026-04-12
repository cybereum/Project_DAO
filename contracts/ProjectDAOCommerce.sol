// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProjectDAOStorage} from "./ProjectDAOStorage.sol";
import {EconomicProjectLib} from "./EconomicProjectLib.sol";
import {ServiceAgreementLib} from "./ServiceAgreementLib.sol";
import {PaymentStreamLib} from "./PaymentStreamLib.sol";

/**
 * @title ProjectDAOCommerce — Commerce sub-contract: projects, agreements, streams, onboarding
 * @notice Delegated via the Router proxy. Shares storage layout with Core and Governance
 *         by inheriting ProjectDAOStorage, then appending its own library stores.
 */
contract ProjectDAOCommerce is ProjectDAOStorage {
    using EconomicProjectLib for EconomicProjectLib.Store;
    using ServiceAgreementLib for ServiceAgreementLib.Store;
    using PaymentStreamLib for PaymentStreamLib.Store;

    // ─── Storage slot placeholder for Core's TimelockLib.Store ───────────
    // Must match the exact slot count Core appends after ProjectDAOStorage.
    uint256[52] private __corePlaceholder;

    // ─── Commerce-only state ────────────────────────────────────────────
    EconomicProjectLib.Store private _projectStore;
    ServiceAgreementLib.Store private _serviceStore;
    PaymentStreamLib.Store private _streamStore;

    uint256 public lastNetworkMilestone;

    bool private _commerceInitialized;

    // ─── Events ─────────────────────────────────────────────────────────
    event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline);
    event EconomicProjectFunded(uint256 indexed projectId, address indexed funder, uint256 netAmount);
    event EconomicProjectContributorApplied(uint256 indexed projectId, address indexed contributor);
    event EconomicProjectContributorApproved(uint256 indexed projectId, address indexed contributor, uint256 sharesBps);
    event EconomicProjectCompleted(uint256 indexed projectId);
    event EconomicProjectCancelled(uint256 indexed projectId);
    event EconomicProjectShareClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount);
    event EconomicProjectFunderRefunded(uint256 indexed projectId, address indexed funder, uint256 amount);
    event ServiceAgreementCreated(uint256 indexed agreementId, address indexed client, address indexed provider, address arbiter, uint256 amount, uint256 deadline, string description);
    event ServiceDeliverySubmitted(uint256 indexed agreementId, address indexed provider, bytes32 deliveryHash);
    event ServiceAgreementCompleted(uint256 indexed agreementId, address indexed client, address indexed provider, uint256 paidAmount);
    event ServiceAgreementDisputed(uint256 indexed agreementId, address indexed disputant);
    event ServiceDisputeResolved(uint256 indexed agreementId, bool inFavorOfProvider, address indexed resolver);
    event ServiceAgreementCancelled(uint256 indexed agreementId, address indexed cancelledBy);
    event PaymentStreamCreated(uint256 indexed streamId, address indexed payer, address indexed recipient, uint256 ratePerSecond, uint256 totalDeposit, uint256 startTime, uint256 stopTime);
    event PaymentStreamWithdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event PaymentStreamCancelled(uint256 indexed streamId, address indexed cancelledBy, uint256 recipientAmount, uint256 payerRefund);
    event MemberJoinedByStake(address indexed member, uint256 netStake);
    event MemberLeftDAO(address indexed member, uint256 refundedStake);
    event AgentRegistered(address indexed agent, string metadataURI);
    event ReferralRecorded(address indexed agent, address indexed referrer);
    event ReferralRewardPaid(address indexed referrer, address indexed source, uint256 amount, uint8 tier);
    event ReferralConfigUpdated(uint256 tier1Bps, uint256 tier2Bps);
    event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount);
    event CommerceBlackholeConfigUpdated(uint256 messagingFeeWei, uint256 exitFeeBps);
    event NetworkMilestoneReached(uint256 agentCount, uint256 milestone, string benefit);

    // ─── Initialization ─────────────────────────────────────────────────

    function initializeCommerce() external onlyOwner {
        require(!_commerceInitialized, "Commerce already initialized.");
        _commerceInitialized = true;
        _projectStore.currentProjectId = 1;
        _serviceStore.currentId = 1;
        _streamStore.currentId = 1;
    }

    // ─── Economic Projects ──────────────────────────────────────────────

    function currentProjectId() external view returns (uint256) { uint256 v = _projectStore.currentProjectId; return v == 0 ? 1 : v; }
    function economicProjects(uint256 projectId) external view returns (uint256 id, address proposer, string memory metadataURI, uint256 targetBudget, uint256 totalFunded, uint256 deadline, EconomicProjectLib.ProjectStatus status, uint256 createdAt, uint256 contributorCount, uint256 funderCount) { return _projectStore.getProject(projectId); }
    function projectContributorShares(uint256 pid, address c) external view returns (uint256) { return _projectStore.contributorShares[pid][c]; }
    function projectApplications(uint256 pid, address a) external view returns (bool) { return _projectStore.applications[pid][a]; }
    function projectApplicationApproved(uint256 pid, address c) external view returns (bool) { return _projectStore.applicationApproved[pid][c]; }
    function projectFunderContributions(uint256 pid, address f) external view returns (uint256) { return _projectStore.funderContributions[pid][f]; }
    function projectShareClaimed(uint256 pid, address c) external view returns (bool) { return _projectStore.shareClaimed[pid][c]; }
    function activeProjectCount(address p) external view returns (uint256) { return _projectStore.activeProjectCount[p]; }

    function createEconomicProject(string calldata metadataURI, uint256 targetBudget, uint256 deadline) external whenNotPaused onlyRegisteredAgent returns (uint256) { return _projectStore.create(msg.sender, metadataURI, targetBudget, deadline); }
    function fundProject(uint256 projectId) external payable whenNotPaused { require(msg.value > 0, "Must send ETH."); uint256 fee = _collectNativeFee(msg.value, "fundProject"); _projectStore.fund(projectId, msg.sender, msg.value - fee); }
    function applyToProject(uint256 projectId) external whenNotPaused onlyRegisteredAgent { _projectStore.applyToProject(projectId, msg.sender); }
    function approveContributor(uint256 projectId, address contributor, uint256 sharesBps) external whenNotPaused { _projectStore.approveContributor(projectId, msg.sender, contributor, sharesBps); }
    function completeProject(uint256 projectId) external whenNotPaused { _projectStore.complete(projectId, msg.sender); }
    function cancelProject(uint256 projectId) external whenNotPaused { _projectStore.cancel(projectId, msg.sender, owner); }

    function claimProjectShare(uint256 projectId) external whenNotPaused nonReentrant {
        uint256 payout = _projectStore.claimShare(projectId, msg.sender);
        uint256 exitFee = _collectExitFee(payout, "claim_project_share");
        uint256 netPayout = payout - exitFee;
        require(netPayout > 0, "Payout too small after exit fee.");
        (bool ok,) = payable(msg.sender).call{value: netPayout}("");
        require(ok, "Payout transfer failed.");
        emit EconomicProjectShareClaimed(projectId, msg.sender, netPayout);
    }

    function refundProjectFunder(uint256 projectId) external whenNotPaused nonReentrant {
        uint256 amount = _projectStore.refundFunder(projectId, msg.sender);
        uint256 exitFee = _collectExitFee(amount, "refund_project_funder");
        uint256 netRefund = amount - exitFee;
        require(netRefund > 0, "Refund too small after exit fee.");
        (bool ok,) = payable(msg.sender).call{value: netRefund}("");
        require(ok, "Refund transfer failed.");
        emit EconomicProjectFunderRefunded(projectId, msg.sender, netRefund);
    }

    function getEconomicProject(uint256 projectId) external view returns (uint256 id, address proposer, string memory metadataURI, uint256 targetBudget, uint256 totalFunded, uint256 deadline, EconomicProjectLib.ProjectStatus status, uint256 createdAt, uint256 contributorCount, uint256 funderCount) { return _projectStore.getProject(projectId); }
    function getProjectContributors(uint256 projectId) external view returns (address[] memory) { return _projectStore.getContributors(projectId); }
    function getProjectFunders(uint256 projectId) external view returns (address[] memory) { return _projectStore.getFunders(projectId); }
    function getEconomicProjects(uint256 offset, uint256 limit) external view returns (EconomicProjectLib.EconomicProject[] memory page, uint256 total) { return _projectStore.getProjects(offset, limit); }

    // ─── Service Agreements ─────────────────────────────────────────────

    function serviceAgreements(uint256 agreementId) external view returns (uint256 id, address client, address provider, address arbiter, uint256 amount, string memory description, ServiceAgreementLib.AgreementStatus status, uint256 createdAt, uint256 deadline, bytes32 deliveryHash) { return _serviceStore.getAgreement(agreementId); }
    function currentServiceAgreementId() external view returns (uint256) { uint256 v = _serviceStore.currentId; return v == 0 ? 1 : v; }
    function activeAgreementCount(address agent) external view returns (uint256) { return _serviceStore.activeCount[agent]; }

    function createServiceAgreement(address _provider, address _arbiter, uint256 _amount, uint256 _deadline, string calldata _description) external onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_provider].registered, "Provider must be a registered agent.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient escrow balance.");
        if (_arbiter != address(0)) require(agents[_arbiter].registered, "Arbiter must be a registered agent.");
        agents[msg.sender].nativeEscrowBalance -= _amount;
        return _serviceStore.create(msg.sender, _provider, _arbiter, _amount, _deadline, _description);
    }

    function submitDelivery(uint256 _id, bytes32 _hash) external onlyRegisteredAgent whenNotPaused { _serviceStore.submitDelivery(_id, msg.sender, _hash); }
    function disputeServiceAgreement(uint256 _id) external onlyRegisteredAgent whenNotPaused { _serviceStore.dispute(_id, msg.sender); }

    function approveDelivery(uint256 _id) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address provider, uint256 amount) = _serviceStore.approveDelivery(_id, msg.sender);
        uint256 fee = _collectNativeFee(amount, "service_agreement_complete");
        agents[provider].nativeEscrowBalance += amount - fee;
        emit ServiceAgreementCompleted(_id, msg.sender, provider, amount - fee);
    }

    function resolveServiceDispute(uint256 _id, bool _inFavorOfProvider) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address client, address provider, uint256 amount) = _serviceStore.resolveDispute(_id, msg.sender, _inFavorOfProvider);
        uint256 fee = _collectNativeFee(amount, "service_dispute_resolution");
        uint256 net = amount - fee;
        if (_inFavorOfProvider) agents[provider].nativeEscrowBalance += net;
        else agents[client].nativeEscrowBalance += net;
    }

    function cancelServiceAgreement(uint256 _id) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (address client, uint256 amount) = _serviceStore.cancel(_id, msg.sender);
        agents[client].nativeEscrowBalance += amount;
    }

    function getServiceAgreement(uint256 _id) external view returns (uint256 id, address client, address provider, address arbiter, uint256 amount, string memory description, ServiceAgreementLib.AgreementStatus status, uint256 createdAt, uint256 deadline, bytes32 deliveryHash) { return _serviceStore.getAgreement(_id); }

    // ─── Payment Streams ────────────────────────────────────────────────

    function paymentStreams(uint256 streamId) external view returns (uint256 id, address payer, address recipient, uint256 ratePerSecond, uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime, uint256 stopTime, PaymentStreamLib.StreamStatus status, uint256 withdrawable) { return _streamStore.getStream(streamId); }
    function currentPaymentStreamId() external view returns (uint256) { uint256 v = _streamStore.currentId; return v == 0 ? 1 : v; }
    function activeStreamCount(address agent) external view returns (uint256) { return _streamStore.activeCount[agent]; }
    function streamBalanceOf(uint256 _streamId) public view returns (uint256) { return _streamStore.balanceOf(_streamId); }

    function createPaymentStream(address _recipient, uint256 _totalDeposit, uint256 _startTime, uint256 _stopTime) external onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_recipient].registered, "Recipient must be a registered agent.");
        require(agents[msg.sender].nativeEscrowBalance >= _totalDeposit, "Insufficient escrow balance.");
        (uint256 streamId, uint256 adjustedDeposit) = _streamStore.create(msg.sender, _recipient, _totalDeposit, _startTime, _stopTime);
        agents[msg.sender].nativeEscrowBalance -= adjustedDeposit;
        return streamId;
    }

    function withdrawFromStream(uint256 _streamId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (uint256 available, , , ) = _streamStore.withdraw(_streamId, msg.sender);
        uint256 fee = _collectNativeFee(available, "stream_withdraw");
        agents[msg.sender].nativeEscrowBalance += available - fee;
        emit PaymentStreamWithdrawn(_streamId, msg.sender, available - fee);
    }

    function cancelPaymentStream(uint256 _streamId) external onlyRegisteredAgent whenNotPaused nonReentrant {
        (uint256 recipientAmount, uint256 payerRefund, address payer, address recipient) = _streamStore.cancel(_streamId, msg.sender);
        uint256 recipientNet = 0;
        if (recipientAmount > 0) { uint256 fee = _collectNativeFee(recipientAmount, "stream_cancel_recipient"); recipientNet = recipientAmount - fee; agents[recipient].nativeEscrowBalance += recipientNet; }
        if (payerRefund > 0) agents[payer].nativeEscrowBalance += payerRefund;
        emit PaymentStreamCancelled(_streamId, msg.sender, recipientNet, payerRefund);
    }

    function getPaymentStream(uint256 _streamId) external view returns (uint256 id, address payer, address recipient, uint256 ratePerSecond, uint256 totalDeposited, uint256 totalWithdrawn, uint256 startTime, uint256 stopTime, PaymentStreamLib.StreamStatus status, uint256 withdrawable) { return _streamStore.getStream(_streamId); }

    // ─── Open Onboarding ────────────────────────────────────────────────

    function setMinStakeToJoin(uint256 _minStake) external onlyOwner { minStakeToJoin = _minStake; }

    function stakeAndJoin(string calldata metadataURI) external payable whenNotPaused {
        require(!members[msg.sender].isMember, "Already a member.");
        require(msg.value >= minStakeToJoin, "Insufficient stake.");
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 512, "Invalid metadataURI.");
        uint256 fee = _collectNativeFee(msg.value, "stakeAndJoin");
        uint256 netStake = msg.value - fee;
        memberStakes[msg.sender] = netStake;
        members[msg.sender] = Member({ memberAddress: msg.sender, votingPower: 1, privileges: new uint256[](0), isMember: true });
        memberAddresses.push(msg.sender);
        memberCount++;
        agents[msg.sender] = AgentProfile({ registered: true, metadataURI: metadataURI, nativeEscrowBalance: 0 });
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;
        _checkNetworkMilestone();
        emit MemberJoinedByStake(msg.sender, netStake);
        emit AgentRegistered(msg.sender, metadataURI);
    }

    function stakeAndJoinWithReferral(string calldata metadataURI, address _referrer) external payable whenNotPaused {
        require(!members[msg.sender].isMember, "Already a member.");
        require(msg.value >= minStakeToJoin, "Insufficient stake.");
        require(bytes(metadataURI).length > 0 && bytes(metadataURI).length <= 512, "Invalid metadataURI.");
        if (_referrer != address(0)) {
            require(agents[_referrer].registered, "Referrer must be a registered agent.");
            require(_referrer != msg.sender, "Cannot refer yourself.");
            address existing = agentReferrer[msg.sender];
            require(existing == address(0) || existing == _referrer, "Referral is permanent.");
            if (existing == address(0)) { agentReferrer[msg.sender] = _referrer; agentReferralCount[_referrer]++; emit ReferralRecorded(msg.sender, _referrer); }
        }
        uint256 fee = _collectNativeFee(msg.value, "stakeAndJoinWithReferral");
        uint256 netStake = msg.value - fee;
        memberStakes[msg.sender] = netStake;
        members[msg.sender] = Member({ memberAddress: msg.sender, votingPower: 1, privileges: new uint256[](0), isMember: true });
        memberAddresses.push(msg.sender);
        memberCount++;
        uint256 existingBalance = agents[msg.sender].nativeEscrowBalance;
        agents[msg.sender] = AgentProfile({ registered: true, metadataURI: metadataURI, nativeEscrowBalance: existingBalance });
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;
        _checkNetworkMilestone();
        emit MemberJoinedByStake(msg.sender, netStake);
        emit AgentRegistered(msg.sender, metadataURI);
    }

    function leaveDAO() external whenNotPaused nonReentrant {
        require(members[msg.sender].isMember, "Not a member.");
        require(memberStakes[msg.sender] > 0 || msg.sender != owner, "Owner cannot leave.");
        require(_projectStore.activeProjectCount[msg.sender] == 0, "Cancel active projects before leaving.");
        require(_serviceStore.activeCount[msg.sender] == 0, "Resolve active service agreements before leaving.");
        require(_streamStore.activeCount[msg.sender] == 0, "Cancel active payment streams before leaving.");
        uint256 stake = memberStakes[msg.sender];
        memberStakes[msg.sender] = 0;
        members[msg.sender].isMember = false;
        agents[msg.sender].registered = false;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == msg.sender) { memberAddresses[i] = memberAddresses[memberAddresses.length - 1]; memberAddresses.pop(); break; }
        }
        memberCount--;
        if (stake > 0) {
            uint256 exitFee = _collectExitFee(stake, "leave_dao");
            uint256 netStake = stake - exitFee;
            (bool ok,) = payable(msg.sender).call{value: netStake}("");
            require(ok, "Stake refund failed.");
            stake = netStake;
        }
        emit MemberLeftDAO(msg.sender, stake);
    }

    // ─── Referral Config ────────────────────────────────────────────────

    function setReferralConfig(uint256 _tier1Bps, uint256 _tier2Bps) external onlyOwner whenNotPaused {
        require(_tier1Bps <= 2500 && _tier2Bps <= 1000 && _tier1Bps + _tier2Bps <= 3000, "Invalid referral config.");
        referralRewardBps = _tier1Bps;
        referralTier2Bps = _tier2Bps;
        emit ReferralConfigUpdated(_tier1Bps, _tier2Bps);
    }

    function withdrawReferralEarnings() external whenNotPaused nonReentrant {
        uint256 earnings = agentReferralEarnings[msg.sender];
        require(earnings > 0, "No referral earnings to withdraw.");
        uint256 available = agents[msg.sender].nativeEscrowBalance;
        uint256 amount = earnings < available ? earnings : available;
        require(amount > 0, "No escrow balance available.");
        agentReferralEarnings[msg.sender] -= amount;
        agents[msg.sender].nativeEscrowBalance -= amount;
        uint256 exitFee = _collectExitFee(amount, "withdraw_referral_earnings");
        uint256 net = amount - exitFee;
        require(net > 0, "Amount too small after exit fee.");
        (bool ok,) = payable(msg.sender).call{value: net}("");
        require(ok, "Referral earnings withdrawal failed.");
        emit AgentNativeEscrowWithdrawn(msg.sender, net);
    }

    function getAgentReferralStats(address _agent) external view returns (address referrer, uint256 referralCount, uint256 referralEarnings) {
        return (agentReferrer[_agent], agentReferralCount[_agent], agentReferralEarnings[_agent]);
    }

    // ─── Commerce Config ────────────────────────────────────────────────

    function setCommerceBlackholeConfig(uint256 _messagingFeeWei, uint256 _exitFeeBps) external onlyOwner {
        require(_exitFeeBps >= MIN_FEE_BPS && _exitFeeBps <= 100, "Invalid exit fee.");
        messagingFeeWei = _messagingFeeWei;
        exitFeeBps = _exitFeeBps;
        emit CommerceBlackholeConfigUpdated(_messagingFeeWei, _exitFeeBps);
    }

    // ─── Network Milestones ─────────────────────────────────────────────

    function _checkNetworkMilestone() internal {
        uint256 count = agentAddresses.length;
        uint256 milestone = 0;
        string memory benefit = "";

        // Check top-down: largest milestone first so we don't skip levels.
        if (count >= 5000 && lastNetworkMilestone < 5000) {
            milestone = 5000; benefit = "5000 agents - governance may reduce fees to minimum";
        } else if (count >= 1000 && lastNetworkMilestone < 1000) {
            milestone = 1000; benefit = "1000 agents - governance may reduce protocol fee";
        } else if (count >= 500 && lastNetworkMilestone < 500) {
            milestone = 500; benefit = "500 agents - governance may reduce messaging fee";
        } else if (count >= 100 && lastNetworkMilestone < 100) {
            milestone = 100; benefit = "100 agents - governance may adjust fee structure";
        } else if (count >= 50 && lastNetworkMilestone < 50) {
            milestone = 50; benefit = "50 agents - discovery network reaching critical mass";
        } else if (count >= 10 && lastNetworkMilestone < 10) {
            milestone = 10; benefit = "Network bootstrapped - discovery active";
        }

        if (milestone > 0) {
            lastNetworkMilestone = milestone;
            emit NetworkMilestoneReached(count, milestone, benefit);
        }
    }

    function getNetworkStats() external view returns (uint256 totalAgents, uint256 totalMembers, uint256 currentMilestone, uint256 nextMilestone, uint256 agentsUntilNextMilestone, uint256 totalVolume, uint256 totalFees) {
        totalAgents = agentAddresses.length;
        totalMembers = memberCount;
        currentMilestone = lastNetworkMilestone;
        if (totalAgents < 10) nextMilestone = 10;
        else if (totalAgents < 50) nextMilestone = 50;
        else if (totalAgents < 100) nextMilestone = 100;
        else if (totalAgents < 500) nextMilestone = 500;
        else if (totalAgents < 1000) nextMilestone = 1000;
        else nextMilestone = ((totalAgents / 1000) + 1) * 1000;
        agentsUntilNextMilestone = nextMilestone > totalAgents ? nextMilestone - totalAgents : 0;
        totalVolume = totalCommerceVolume;
        totalFees = totalFeesCollected;
    }
}
