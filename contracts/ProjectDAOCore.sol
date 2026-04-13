// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProjectDAOStorage} from "./ProjectDAOStorage.sol";
import {TimelockLib} from "./TimelockLib.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC721Lite {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

/**
 * @title ProjectDAOCore — Core sub-contract: agents, escrow, fees, members, admin
 * @notice In the split architecture this is the first implementation contract.
 *         All sub-contracts share the same storage layout via ProjectDAOStorage.
 *         A Router proxy delegatecalls into each sub-contract.
 */
contract ProjectDAOCore is ProjectDAOStorage {
    using TimelockLib for TimelockLib.Store;
    using SafeERC20 for IERC20;

    // ─── Core-only state (appended after Storage) ───────────────────────
    TimelockLib.Store private _timelock;

    // ─── Events ─────────────────────────────────────────────────────────
    event ContractPausedEvent(address indexed by);
    event ContractResumedEvent(address indexed by);
    event AgentRegistered(address indexed agent, string metadataURI);
    event AgentMetadataUpdated(address indexed agent, string metadataURI);
    event AgentNativeEscrowDeposited(address indexed agent, uint256 amount);
    event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount);
    event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo);
    event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo);
    event AgentTokenEscrowDeposited(address indexed agent, address indexed token, uint256 amount);
    event AgentTokenEscrowWithdrawn(address indexed agent, address indexed token, uint256 amount);
    event AgentAssetTransfer(address indexed from, address indexed to, address indexed assetContract, uint256 assetId, string memo);
    event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, address token, uint256 amount, bool isNative, string description);
    event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt);
    event AgentPaymentRequestCancelled(uint256 indexed requestId, address indexed requester);
    event MemberAdded(address indexed member, uint256 votingPower);
    event MemberRemoved(address indexed member);
    event PrivilegeGranted(address indexed member, uint256 privilege);
    event OwnerChanged(address indexed oldOwner, address indexed newOwner);
    event AIServiceFeeUpdated(uint256 feeWei);
    event TimelockQueued(bytes32 indexed opId, uint256 readyTime, uint256 expiresAt);
    event TimelockExecuted(bytes32 indexed opId);
    event TimelockCancelled(bytes32 indexed opId);
    event TimelockDelayUpdated(uint256 newDelay);

    // ─── Initialization ─────────────────────────────────────────────────

    /// @notice One-time bootstrap. The Router constructor pre-sets owner
    ///         in proxy storage via assembly, so only the deployer can call this.
    ///         For direct deployment (tests), the constructor sets owner.
    function initializeCore(address _cybereumTreasury) external {
        require(!initialized, "Already initialized.");
        require(msg.sender == owner, "Only the owner can initialize.");
        require(_cybereumTreasury != address(0), "Invalid treasury address.");
        initialized = true;
        _reentrancyStatus = 1;

        members[owner].isMember = true;
        members[owner].votingPower = 100;
        memberAddresses.push(owner);
        memberCount = 1;
        cybereumTreasury = _cybereumTreasury;

        currentAgentPaymentRequestId = 1;

        _timelock.delay = 24 hours;
        _timelock.gracePeriod = 48 hours;

        cybereumFeeBps = 5;
        assetTransferFlatFeeWei = 1e12;
        aiServiceFeeWei = 0.0003 ether;
        messagingFeeWei = 0.0001 ether;
        exitFeeBps = 3;

        reputationDecayPerDay = 2;
        reputationDecayGracePeriod = 7 days;
        referralRewardBps = 1000;
        referralTier2Bps = 300;
        minStakeToJoin = 0.001 ether;
    }

    // ─── Pause / Resume ─────────────────────────────────────────────────

    function pauseContract() public onlyOwner { _paused = true; emit ContractPausedEvent(msg.sender); }
    function resumeContract() public onlyOwner { _paused = false; emit ContractResumedEvent(msg.sender); }

    // ─── Fee Config ─────────────────────────────────────────────────────
    //
    // Treasury and fee configuration can ONLY be changed through the
    // timelock (queueSetTreasury/executeSetTreasury). No instant setter.

    function setAIServiceFee(uint256 _feeWei) public onlyOwner whenNotPaused {
        aiServiceFeeWei = _feeWei;
        emit AIServiceFeeUpdated(_feeWei);
    }

    function previewFee(uint256 _amount) external view returns (uint256 fee, uint256 net) {
        fee = _calculateFee(_amount);
        net = _amount - fee;
    }

    // ─── Timelock ───────────────────────────────────────────────────────

    function queueSetTreasury(address _treasury) external onlyOwner whenNotPaused returns (bytes32) {
        require(_treasury != address(0), "Invalid treasury address.");
        bytes32 opId = keccak256(abi.encode("setTreasury", _treasury));
        _timelock.queue(opId);
        return opId;
    }

    function executeSetTreasury(address _treasury) external onlyOwner whenNotPaused {
        bytes32 opId = keccak256(abi.encode("setTreasury", _treasury));
        _timelock.assertReady(opId);
        _timelock.markExecuted(opId);
        require(_treasury != address(0), "Invalid treasury address.");
        cybereumTreasury = _treasury;
        emit CybereumTreasuryUpdated(_treasury);
    }

    function queueSetFeeConfig(uint256 _feeBps, uint256 _assetFlatFeeWei) external onlyOwner whenNotPaused returns (bytes32) {
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        bytes32 opId = keccak256(abi.encode("setFeeConfig", _feeBps, _assetFlatFeeWei));
        _timelock.queue(opId);
        return opId;
    }

    function executeSetFeeConfig(uint256 _feeBps, uint256 _assetFlatFeeWei) external onlyOwner whenNotPaused {
        bytes32 opId = keccak256(abi.encode("setFeeConfig", _feeBps, _assetFlatFeeWei));
        _timelock.assertReady(opId);
        _timelock.markExecuted(opId);
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        cybereumFeeBps = _feeBps;
        assetTransferFlatFeeWei = _assetFlatFeeWei;
        emit CybereumFeeConfigUpdated(_feeBps, _assetFlatFeeWei);
    }

    function cancelTimelockOperation(bytes32 _opId) external onlyOwner whenNotPaused { _timelock.cancel(_opId); }
    function setTimelockDelay(uint256 _delay) external onlyOwner whenNotPaused { _timelock.setDelay(_delay); }
    function timelockDelay() external view returns (uint256) { return _timelock.delay; }
    function getTimelockOperation(bytes32 _opId) external view returns (bytes32 id, uint256 readyTime, uint256 expiresAt, bool executed, bool cancelled) {
        return _timelock.getOperation(_opId);
    }

    // ─── Agent Registration & Discovery ─────────────────────────────────

    function registerAgent(string calldata _metadataURI) external onlyMember whenNotPaused {
        require(!agents[msg.sender].registered, "Agent already registered.");
        require(bytes(_metadataURI).length > 0, "Metadata URI required.");
        require(bytes(_metadataURI).length <= 512, "Metadata URI too long.");
        agents[msg.sender] = AgentProfile({ registered: true, metadataURI: _metadataURI, nativeEscrowBalance: 0 });
        agentAddresses.push(msg.sender);
        agentRegisteredAt[msg.sender] = block.timestamp;
        agentLastActiveAt[msg.sender] = block.timestamp;
        emit AgentRegistered(msg.sender, _metadataURI);
    }

    function updateAgentMetadata(string calldata _metadataURI) external onlyRegisteredAgent whenNotPaused {
        require(bytes(_metadataURI).length > 0, "Metadata URI required.");
        require(bytes(_metadataURI).length <= 512, "Metadata URI too long.");
        agents[msg.sender].metadataURI = _metadataURI;
        emit AgentMetadataUpdated(msg.sender, _metadataURI);
    }

    function getAgentProfile(address _agent) external view returns (bool registered, string memory metadataURI, uint256 nativeEscrowBalance) {
        AgentProfile storage a = agents[_agent];
        return (a.registered, a.metadataURI, a.nativeEscrowBalance);
    }

    function getAgentTokenBalance(address _agent, address _token) external view returns (uint256) {
        return agentTokenEscrowBalances[_agent][_token];
    }

    function getAgentCount() external view returns (uint256) { return agentAddresses.length; }

    function getRegisteredAgents(uint256 _offset, uint256 _limit) external view returns (address[] memory addrs, string[] memory uris, uint256 total) {
        total = agentAddresses.length;
        if (_offset >= total) return (new address[](0), new string[](0), total);
        uint256 end = _offset + _limit;
        if (end > total) end = total;
        uint256 count = end - _offset;
        addrs = new address[](count);
        uris = new string[](count);
        for (uint256 i = 0; i < count; i++) {
            address a = agentAddresses[_offset + i];
            addrs[i] = a;
            uris[i] = agents[a].metadataURI;
        }
    }

    // ─── Native Escrow ──────────────────────────────────────────────────

    function depositNativeToEscrow() external payable onlyRegisteredAgent whenNotPaused nonReentrant {
        require(msg.value > 0, "Deposit amount must be greater than zero.");
        uint256 fee = _collectNativeFee(msg.value, "deposit_native_escrow");
        uint256 netDeposit = msg.value - fee;
        require(netDeposit > 0, "Deposit too small after fee.");
        agents[msg.sender].nativeEscrowBalance += netDeposit;
        emit AgentNativeEscrowDeposited(msg.sender, netDeposit);
    }

    function withdrawNativeFromEscrow(uint256 _amount) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_amount > 0, "Withdrawal amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;
        agents[msg.sender].nativeEscrowBalance -= _amount;
        if (fee > 0) {
            (bool feeOk,) = payable(cybereumTreasury).call{value: fee}("");
            require(feeOk, "Native fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), fee, "withdraw_native_escrow");
        }
        (bool ok,) = payable(msg.sender).call{value: netAmount}("");
        require(ok, "Native withdrawal transfer failed.");
        _recordVolume(msg.sender, _amount, fee, "withdraw_native_escrow");
        emit AgentNativeEscrowWithdrawn(msg.sender, netAmount);
    }

    function transferNativeBetweenAgents(address _to, uint256 _amount, string calldata _memo) external onlyRegisteredAgent whenNotPaused nonReentrant {
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;
        agents[msg.sender].nativeEscrowBalance -= _amount;
        agents[_to].nativeEscrowBalance += netAmount;
        if (fee > 0) {
            (bool feeOk,) = payable(cybereumTreasury).call{value: fee}("");
            require(feeOk, "Native fee transfer failed.");
            emit CybereumFeePaid(msg.sender, address(0), fee, "agent_native_transfer");
        }
        _recordVolume(msg.sender, _amount, fee, "agent_native_transfer");
        emit AgentToAgentNativeTransfer(msg.sender, _to, netAmount, _memo);
    }

    // ─── Token Escrow ───────────────────────────────────────────────────

    function depositTokenToEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        uint256 fee = _collectTokenFee(_token, _amount, "deposit_token_escrow");
        uint256 netAmount = _amount - fee;
        require(netAmount > 0, "Amount too small after fee.");
        agentTokenEscrowBalances[msg.sender][_token] += netAmount;
        emit AgentTokenEscrowDeposited(msg.sender, _token, netAmount);
    }

    function withdrawTokenFromEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agentTokenEscrowBalances[msg.sender][_token] >= _amount, "Insufficient token escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;
        agentTokenEscrowBalances[msg.sender][_token] -= _amount;
        IERC20(_token).safeTransfer(cybereumTreasury, fee);
        emit CybereumFeePaid(msg.sender, _token, fee, "withdraw_token_escrow");
        IERC20(_token).safeTransfer(msg.sender, netAmount);
        _recordVolume(msg.sender, _amount, fee, "withdraw_token_escrow");
        emit AgentTokenEscrowWithdrawn(msg.sender, _token, netAmount);
    }

    function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string memory _memo) public onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_token != address(0), "Invalid token address.");
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agentTokenEscrowBalances[msg.sender][_token] >= _amount, "Insufficient token escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;
        agentTokenEscrowBalances[msg.sender][_token] -= _amount;
        agentTokenEscrowBalances[_to][_token] += netAmount;
        if (fee > 0) {
            IERC20(_token).safeTransfer(cybereumTreasury, fee);
            emit CybereumFeePaid(msg.sender, _token, fee, "agent_token_transfer");
        }
        _recordVolume(msg.sender, _amount, fee, "agent_token_transfer");
        emit AgentToAgentTokenTransfer(msg.sender, _to, _token, netAmount, _memo);
    }

    // ─── Asset Transfer ─────────────────────────────────────────────────

    function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string memory _memo) public payable onlyRegisteredAgent whenNotPaused nonReentrant {
        require(_assetContract != address(0), "Invalid asset contract address.");
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(msg.value == assetTransferFlatFeeWei, "Incorrect asset transfer fee.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        (bool feeOk,) = payable(cybereumTreasury).call{value: msg.value}("");
        require(feeOk, "Native fee transfer failed.");
        emit CybereumFeePaid(msg.sender, address(0), msg.value, "agent_asset_transfer");
        _recordVolume(msg.sender, msg.value, msg.value, "agent_asset_transfer");
        IERC721Lite(_assetContract).transferFrom(msg.sender, _to, _assetId);
        emit AgentAssetTransfer(msg.sender, _to, _assetContract, _assetId, _memo);
    }

    // ─── Payment Requests ───────────────────────────────────────────────

    function createAgentPaymentRequest(address _payer, address _token, uint256 _amount, bool _isNative, string calldata _description) external onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(_payer != address(0), "Invalid payer address.");
        require(_amount > 0, "Amount must be greater than zero.");
        uint256 id = currentAgentPaymentRequestId++;
        agentPaymentRequests[id] = AgentPaymentRequest({ id: id, requester: msg.sender, payer: _payer, token: _token, amount: _amount, isNative: _isNative, description: _description, status: PaymentStatus.Requested, createdAt: block.timestamp, settledAt: 0 });
        emit AgentPaymentRequestCreated(id, msg.sender, _payer, _token, _amount, _isNative, _description);
        return id;
    }

    function settleAgentPaymentRequest(uint256 _requestId) external payable onlyRegisteredAgent whenNotPaused nonReentrant {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.payer == msg.sender, "Only designated payer can settle this request.");
        if (request.isNative) {
            require(msg.value == request.amount, "Incorrect native payment amount.");
            uint256 fee = _collectNativeFee(request.amount, "settle_payment_request_native");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            (bool payoutOk,) = payable(request.requester).call{value: netAmount}("");
            require(payoutOk, "Native payout transfer failed.");
        } else {
            require(msg.value == 0, "Do not send native value for token settlement.");
            IERC20(request.token).safeTransferFrom(msg.sender, address(this), request.amount);
            uint256 fee = _collectTokenFee(request.token, request.amount, "settle_payment_request_token");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            IERC20(request.token).safeTransfer(request.requester, netAmount);
        }
        request.status = PaymentStatus.Settled;
        request.settledAt = block.timestamp;
        emit AgentPaymentRequestSettled(_requestId, msg.sender, request.requester, request.settledAt);
    }

    function cancelAgentPaymentRequest(uint256 _requestId) public onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.requester == msg.sender, "Only the requester can cancel.");
        request.status = PaymentStatus.Cancelled;
        emit AgentPaymentRequestCancelled(_requestId, msg.sender);
    }

    function getAgentPaymentRequest(uint256 _requestId) external view returns (uint256 id, address requester, address payer, address token, uint256 amount, bool isNative, string memory description, PaymentStatus status, uint256 createdAt, uint256 settledAt) {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        return (r.id, r.requester, r.payer, r.token, r.amount, r.isNative, r.description, r.status, r.createdAt, r.settledAt);
    }

    // ─── Member Management ──────────────────────────────────────────────

    function addMember(address _newMember, uint256 _votingPower) public onlyOwner whenNotPaused {
        require(!members[_newMember].isMember, "Member already exists.");
        members[_newMember].isMember = true;
        members[_newMember].votingPower = _votingPower;
        memberAddresses.push(_newMember);
        memberCount++;
        emit MemberAdded(_newMember, _votingPower);
    }

    function removeMember(address _member) public onlyOwner whenNotPaused {
        require(_member != owner, "Cannot remove the owner from the DAO.");
        require(members[_member].isMember, "Member does not exist.");
        delete members[_member];
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == _member) {
                memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
                memberAddresses.pop();
                break;
            }
        }
        memberCount--;
        emit MemberRemoved(_member);
    }

    function grantPrivilege(address _member, uint256 _privilege) public onlyOwner whenNotPaused {
        require(members[_member].isMember, "Invalid member address.");
        members[_member].privileges.push(_privilege);
        emit PrivilegeGranted(_member, _privilege);
    }

    /// @notice Queue an ownership transfer. Must wait timelock delay before executing.
    function queueChangeOwner(address _newOwner) external onlyOwner whenNotPaused returns (bytes32) {
        require(_newOwner != address(0), "Invalid new owner address.");
        require(_newOwner != owner, "Already the owner.");
        bytes32 opId = keccak256(abi.encode("changeOwner", _newOwner));
        _timelock.queue(opId);
        return opId;
    }

    /// @notice Execute a previously queued ownership transfer after the delay.
    function executeChangeOwner(address _newOwner) external onlyOwner whenNotPaused {
        bytes32 opId = keccak256(abi.encode("changeOwner", _newOwner));
        _timelock.assertReady(opId);
        _timelock.markExecuted(opId);
        require(_newOwner != address(0), "Invalid new owner address.");
        require(_newOwner != owner, "Already the owner.");
        address old = owner;
        owner = _newOwner;
        emit OwnerChanged(old, _newOwner);
    }

    function getMemberCount() external view returns (uint256) { return memberCount; }

    function getMember(address _member) external view returns (address memberAddress, uint256 votingPower, bool isMember) {
        Member storage m = members[_member];
        return (m.memberAddress, m.votingPower, m.isMember);
    }

    // ─── AI Service Fee ─────────────────────────────────────────────────

    function deductAIServiceFee(string memory _serviceType) external onlyRegisteredAgent whenNotPaused nonReentrant {
        uint256 fee = aiServiceFeeWei;
        require(fee > 0, "AI service fee not configured.");
        require(agents[msg.sender].nativeEscrowBalance >= fee, "Insufficient escrow balance for AI service fee.");
        agents[msg.sender].nativeEscrowBalance -= fee;
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        (bool ok,) = payable(cybereumTreasury).call{value: fee}("");
        require(ok, "AI service fee transfer failed.");
        _recordVolume(msg.sender, fee, fee, _serviceType);
    }
}
