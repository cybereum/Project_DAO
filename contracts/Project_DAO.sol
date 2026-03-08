// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

interface IERC721Lite {
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract Project_DAO {
    enum PaymentStatus {
        Requested,
        Settled,
        Cancelled
    }

    struct AgentProfile {
        bool registered;
        string metadataURI;
        uint256 nativeEscrowBalance;
    }

    struct AgentPaymentRequest {
        uint256 id;
        address requester;
        address payer;
        address token;
        uint256 amount;
        bool isNative;
        string description;
        PaymentStatus status;
        uint256 createdAt;
        uint256 settledAt;
    }

    struct Member {
        address memberAddress;
        uint256 votingPower;
        uint256[] privileges;
        bool isMember;
    }

    struct Milestone {
        string description;
        uint256 date;
        uint256 membersWhoCanVoteCount;
    }
    mapping(uint256 => mapping(address => bool)) private milestoneMembersWhoCanVote;

    struct Proposal {
        uint256 id;
        string description;
        uint256 votingDeadline;
        bool executed;
        bool proposalPassed;
        uint256 yesVotes;
        uint256 noVotes;
        uint256[] previousMilestoneIds;
        uint256 milestoneId;
    }

    struct ProposalDispute {
        uint256 id;
        uint256 proposalId;
        uint256 disputeDeadline;
        bool resolved;
        mapping(address => bool) voted;
        mapping(address => bool) hasVotedFor;
        mapping(address => bool) hasVotedAgainst;
        uint256 votesFor;
        uint256 votesAgainst;
        string description;
        uint256 milestoneId;
    }

    struct Task {
        uint256 id;
        string description;
        uint256 deadline;
        bool completed;
        uint256 milestoneId;
        address assignedMember;
        string status;
        uint256[] progressIds;
    }

    struct Progress {
        uint256 date;
        string description;
        bool completed;
        uint256 percentageCompleted;
    }

    struct RolePermissions {
        mapping(string => bool) permissions;
    }

    struct Role {
        bytes32 name;
        address[] members;
        RolePermissions permissions;
    }

    mapping(uint256 => ProposalDispute) public proposalDisputes;
    uint256 public currentProposalDisputeId = 1;
    mapping(uint256 => mapping(address => bool)) public proposalHasVoted;
    mapping(uint256 => mapping(address => bool)) public proposalMembersWhoCanVote;
    mapping(uint256 => Progress) public progressData;
    uint256 public currentProgressId = 1;

    address public owner;
    mapping(address => Member) public members;
    mapping(address => AgentProfile) public agents;
    mapping(address => mapping(address => uint256)) public agentTokenEscrowBalances;
    mapping(uint256 => AgentPaymentRequest) public agentPaymentRequests;
    uint256 public currentAgentPaymentRequestId = 1;
    Proposal[] public proposals;
    uint256 public currentProposalId = 1;
    uint256 public votingPeriod = 7 days;
    uint256 public minimumVotingPower = 10;
    Milestone[] public milestones;
    uint256 public currentMilestoneId = 1;
    Task[] public tasks;
    uint256 public currentTaskId = 1;
    Role[] roles;
    mapping(address => uint256) public memberRoles;
    address[] public memberAddresses;

    bool private _paused;

    uint256 public constant FEE_BPS_DENOMINATOR = 10_000;
    /// @dev Minimum fee floor: 1 bps (0.01%). Fee can never be set to zero.
    uint256 public constant MIN_FEE_BPS = 1;
    uint256 public cybereumFeeBps = 5;
    uint256 public assetTransferFlatFeeWei = 1e12;
    address public cybereumTreasury;

    event TaskCreated(uint256 id, string description, uint256 deadline, uint256 milestoneId, address assignedMember, string status);
    event TaskUpdated(uint256 id, string description, uint256 deadline, address assignedMember, string status);
    event TaskDeleted(uint256 id);
    event MemberAdded(address member, uint256 votingPower);
    event MemberRemoved(address member);
    event RoleCreated(uint256 id, string name);
    event PermissionAdded(uint256 roleId, string permission);
    event PermissionRemoved(uint256 roleId, string permission);
    event RoleAssigned(address member, uint256 roleId);
    event AgentRegistered(address indexed agent, string metadataURI);
    event AgentMetadataUpdated(address indexed agent, string metadataURI);
    event AgentNativeEscrowDeposited(address indexed agent, uint256 amount);
    event AgentNativeEscrowWithdrawn(address indexed agent, uint256 amount);
    event AgentTokenEscrowDeposited(address indexed agent, address indexed token, uint256 amount);
    event AgentTokenEscrowWithdrawn(address indexed agent, address indexed token, uint256 amount);
    event AgentToAgentNativeTransfer(address indexed from, address indexed to, uint256 amount, string memo);
    event AgentToAgentTokenTransfer(address indexed from, address indexed to, address indexed token, uint256 amount, string memo);
    event AgentAssetTransfer(address indexed from, address indexed to, address indexed assetContract, uint256 assetId, string memo);
    event AgentPaymentRequestCreated(uint256 indexed requestId, address indexed requester, address indexed payer, bool isNative, address token, uint256 amount, string description);
    event AgentPaymentRequestSettled(uint256 indexed requestId, address indexed payer, address indexed requester, uint256 settledAt);
    event AgentPaymentRequestCancelled(uint256 indexed requestId, address indexed requester);
    event CybereumTreasuryUpdated(address indexed treasury);
    event CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei);
    event CybereumFeePaid(address indexed payer, address indexed token, uint256 amount, string context);

    constructor() {
        owner = msg.sender;
        members[owner].isMember = true;
        members[owner].votingPower = 100;
        memberAddresses.push(owner);
        cybereumTreasury = owner;

        // Create an "Owner" role and add it to the roles array
        _createRole(bytes32("Owner"));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function.");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only members can call this function.");
        _;
    }

    modifier onlyRegisteredAgent() {
        require(agents[msg.sender].registered, "Only registered agents can call this function.");
        _;
    }

    modifier onlyRole(string memory _permission) {
        uint256 roleId = memberRoles[msg.sender];
        require(roleId > 0, "You don't have a role.");
        Role storage role = roles[roleId - 1];
        require(role.permissions.permissions[_permission], "You don't have permission to perform this action.");
        _;
    }

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused.");
        _;
    }

    // --- Role Management ---

    function getRole(uint256 _roleId) public view returns (bytes32, uint256) {
        require(_roleId < roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId];
        return (role.name, role.members.length);
    }

    function findMemberInRole(Role storage role, address member) private view returns (bool) {
        for (uint256 i = 0; i < role.members.length; i++) {
            if (role.members[i] == member) {
                return true;
            }
        }
        return false;
    }

    function findMemberIndex(address[] storage memberArray, address member) private view returns (int256) {
        for (uint256 i = 0; i < memberArray.length; i++) {
            if (memberArray[i] == member) {
                return int256(i);
            }
        }
        return -1;
    }

    function _addPermissionToRole(uint256 _roleId, string memory _permission) internal {
        roles[_roleId].permissions.permissions[_permission] = true;
    }

    /// @dev Internal role creation used by constructor and public createRole
    function _createRole(bytes32 _name) internal {
        uint256 newRoleId = roles.length;
        roles.push();
        Role storage newRole = roles[newRoleId];
        newRole.name = _name;

        emit RoleCreated(newRoleId, string(abi.encodePacked(_name)));
    }

    function createRole(bytes32 _name) public onlyOwner {
        _createRole(_name);
    }

    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        role.permissions.permissions[_permission] = true;
        emit PermissionAdded(_roleId, _permission);
    }

    function removePermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        role.permissions.permissions[_permission] = false;
        emit PermissionRemoved(_roleId, _permission);
    }

    function assignRole(address _member, uint256 _roleId) public onlyOwner whenNotPaused {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        require(!findMemberInRole(role, _member), "Member already has this role.");
        require(members[_member].isMember, "Invalid member address.");
        role.members.push(_member);
        memberRoles[_member] = _roleId;
        emit RoleAssigned(_member, _roleId);
    }

    function assignRoleToMilestone(address _member, uint256 _milestoneId, bytes32 _role) public onlyOwner whenNotPaused {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        require(
            _role == keccak256(abi.encodePacked("milestone_owner")) ||
            _role == keccak256(abi.encodePacked("builder")) ||
            _role == keccak256(abi.encodePacked("verifier")),
            "Invalid role."
        );
        require(members[_member].isMember, "Invalid member address.");

        uint256 roleIndex;
        if (_role == keccak256(abi.encodePacked("milestone_owner"))) {
            roleIndex = 0;
        } else if (_role == keccak256(abi.encodePacked("builder"))) {
            roleIndex = 1;
        } else {
            roleIndex = 2;
        }

        require(proposals.length > 0, "No proposals exist.");
        Proposal storage latestProposal = proposals[proposals.length - 1];
        require(latestProposal.milestoneId == _milestoneId, "Only members assigned to this milestone can be assigned a role for it.");

        milestoneMembersWhoCanVote[_milestoneId][_member] = true;
        proposalMembersWhoCanVote[latestProposal.id][_member] = true;
        emit RoleAssigned(_member, roleIndex + 1);
    }

    // --- Pause ---

    function pauseContract() public onlyOwner {
        _paused = true;
    }

    function resumeContract() public onlyOwner {
        _paused = false;
    }

    // --- Agent, Payments, and Asset Value Transfer ---


    function setCybereumTreasury(address _treasury) public onlyOwner {
        require(_treasury != address(0), "Invalid treasury address.");
        cybereumTreasury = _treasury;
        emit CybereumTreasuryUpdated(_treasury);
    }

    function setCybereumFeeConfig(uint256 _feeBps, uint256 _assetTransferFlatFeeWei) public onlyOwner {
        require(_feeBps >= MIN_FEE_BPS, "Fee cannot be zero: mandatory Cybereum fee floor enforced.");
        require(_feeBps <= 100, "Fee cannot exceed 1%.");
        require(_assetTransferFlatFeeWei > 0, "Asset transfer fee must be non-zero.");
        cybereumFeeBps = _feeBps;
        assetTransferFlatFeeWei = _assetTransferFlatFeeWei;
        emit CybereumFeeConfigUpdated(_feeBps, _assetTransferFlatFeeWei);
    }

    /// @notice Preview the fee that will be charged for a given amount.
    function previewFee(uint256 _amount) public view returns (uint256 fee, uint256 net) {
        fee = _amount == 0 ? 0 : (_amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR;
        if (_amount > 0 && fee == 0) fee = 1;
        net = _amount > fee ? _amount - fee : 0;
    }

    /// @notice Returns full agent profile including balances.
    function getAgentProfile(address _agent) public view returns (
        bool registered,
        string memory metadataURI,
        uint256 nativeEscrowBalance
    ) {
        AgentProfile storage p = agents[_agent];
        return (p.registered, p.metadataURI, p.nativeEscrowBalance);
    }

    /// @notice Returns an agent's escrowed token balance.
    function getAgentTokenBalance(address _agent, address _token) public view returns (uint256) {
        return agentTokenEscrowBalances[_agent][_token];
    }

    /// @notice Returns a payment request by ID.
    function getAgentPaymentRequest(uint256 _requestId) public view returns (
        uint256 id,
        address requester,
        address payer,
        address token,
        uint256 amount,
        bool isNative,
        string memory description,
        PaymentStatus status,
        uint256 createdAt,
        uint256 settledAt
    ) {
        AgentPaymentRequest storage r = agentPaymentRequests[_requestId];
        return (r.id, r.requester, r.payer, r.token, r.amount, r.isNative, r.description, r.status, r.createdAt, r.settledAt);
    }

    function _calculateFee(uint256 _amount) internal view returns (uint256) {
        if (_amount == 0 || cybereumFeeBps == 0) {
            return 0;
        }
        uint256 fee = (_amount * cybereumFeeBps) / FEE_BPS_DENOMINATOR;
        if (fee == 0) {
            fee = 1;
        }
        return fee;
    }

    function _collectNativeFee(uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        if (fee > 0) {
            payable(cybereumTreasury).transfer(fee);
            emit CybereumFeePaid(msg.sender, address(0), fee, _context);
        }
        return fee;
    }

    function _collectTokenFee(address _token, uint256 _amount, string memory _context) internal returns (uint256) {
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        if (fee > 0) {
            bool feeTransferSuccess = IERC20(_token).transfer(cybereumTreasury, fee);
            require(feeTransferSuccess, "Token fee transfer failed.");
            emit CybereumFeePaid(msg.sender, _token, fee, _context);
        }
        return fee;
    }

    function registerAgent(string memory _metadataURI) public onlyMember whenNotPaused {
        AgentProfile storage profile = agents[msg.sender];
        require(!profile.registered, "Agent already registered.");
        profile.registered = true;
        profile.metadataURI = _metadataURI;
        emit AgentRegistered(msg.sender, _metadataURI);
    }

    function updateAgentMetadata(string memory _metadataURI) public onlyRegisteredAgent whenNotPaused {
        agents[msg.sender].metadataURI = _metadataURI;
        emit AgentMetadataUpdated(msg.sender, _metadataURI);
    }

    function depositNativeToEscrow() public payable onlyRegisteredAgent whenNotPaused {
        require(msg.value > 0, "Deposit amount must be greater than zero.");
        uint256 fee = _collectNativeFee(msg.value, "deposit_native_escrow");
        uint256 netAmount = msg.value - fee;
        require(netAmount > 0, "Amount too small after fee.");
        agents[msg.sender].nativeEscrowBalance += netAmount;
        emit AgentNativeEscrowDeposited(msg.sender, netAmount);
    }

    function withdrawNativeFromEscrow(uint256 _amount) public onlyRegisteredAgent whenNotPaused {
        require(_amount > 0, "Amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient native escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");
        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agents[msg.sender].nativeEscrowBalance -= _amount;
        if (fee > 0) {
            payable(cybereumTreasury).transfer(fee);
            emit CybereumFeePaid(msg.sender, address(0), fee, "withdraw_native_escrow");
        }
        payable(msg.sender).transfer(netAmount);
        emit AgentNativeEscrowWithdrawn(msg.sender, netAmount);
    }

    function transferNativeBetweenAgents(address _to, uint256 _amount, string memory _memo) public onlyRegisteredAgent whenNotPaused {
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agents[msg.sender].nativeEscrowBalance >= _amount, "Insufficient native escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agents[msg.sender].nativeEscrowBalance -= _amount;
        agents[_to].nativeEscrowBalance += netAmount;
        if (fee > 0) {
            payable(cybereumTreasury).transfer(fee);
            emit CybereumFeePaid(msg.sender, address(0), fee, "agent_native_transfer");
        }

        emit AgentToAgentNativeTransfer(msg.sender, _to, netAmount, _memo);
    }

    function depositTokenToEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        bool success = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Token transfer failed.");

        uint256 fee = _collectTokenFee(_token, _amount, "deposit_token_escrow");
        uint256 netAmount = _amount - fee;
        require(netAmount > 0, "Amount too small after fee.");

        agentTokenEscrowBalances[msg.sender][_token] += netAmount;
        emit AgentTokenEscrowDeposited(msg.sender, _token, netAmount);
    }

    function withdrawTokenFromEscrow(address _token, uint256 _amount) public onlyRegisteredAgent whenNotPaused {
        require(_token != address(0), "Invalid token address.");
        require(_amount > 0, "Amount must be greater than zero.");
        require(agentTokenEscrowBalances[msg.sender][_token] >= _amount, "Insufficient token escrow balance.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        uint256 fee = _calculateFee(_amount);
        require(_amount > fee, "Amount too small after fee.");
        uint256 netAmount = _amount - fee;

        agentTokenEscrowBalances[msg.sender][_token] -= _amount;
        bool feeSuccess = IERC20(_token).transfer(cybereumTreasury, fee);
        require(feeSuccess, "Token fee transfer failed.");
        emit CybereumFeePaid(msg.sender, _token, fee, "withdraw_token_escrow");

        bool success = IERC20(_token).transfer(msg.sender, netAmount);
        require(success, "Token transfer failed.");
        emit AgentTokenEscrowWithdrawn(msg.sender, _token, netAmount);
    }

    function transferTokenBetweenAgents(address _token, address _to, uint256 _amount, string memory _memo) public onlyRegisteredAgent whenNotPaused {
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
            bool feeTransferSuccess = IERC20(_token).transfer(cybereumTreasury, fee);
            require(feeTransferSuccess, "Token fee transfer failed.");
            emit CybereumFeePaid(msg.sender, _token, fee, "agent_token_transfer");
        }

        emit AgentToAgentTokenTransfer(msg.sender, _to, _token, netAmount, _memo);
    }

    function transferAssetBetweenAgents(address _assetContract, address _to, uint256 _assetId, string memory _memo)
        public
        payable
        onlyRegisteredAgent
        whenNotPaused
    {
        require(_assetContract != address(0), "Invalid asset contract address.");
        require(agents[_to].registered, "Recipient must be a registered agent.");
        require(_to != msg.sender, "Cannot transfer to self.");
        require(msg.value == assetTransferFlatFeeWei, "Incorrect asset transfer fee.");
        require(cybereumTreasury != address(0), "Cybereum treasury not configured.");

        payable(cybereumTreasury).transfer(msg.value);
        emit CybereumFeePaid(msg.sender, address(0), msg.value, "agent_asset_transfer");

        IERC721Lite(_assetContract).transferFrom(msg.sender, _to, _assetId);
        emit AgentAssetTransfer(msg.sender, _to, _assetContract, _assetId, _memo);
    }

    function createAgentPaymentRequest(
        address _payer,
        address _token,
        uint256 _amount,
        bool _isNative,
        string memory _description
    ) public onlyRegisteredAgent whenNotPaused returns (uint256) {
        require(agents[_payer].registered, "Payer must be a registered agent.");
        require(_payer != msg.sender, "Cannot request payment from self.");
        require(_amount > 0, "Amount must be greater than zero.");
        if (_isNative) {
            require(_token == address(0), "Native request must use zero token address.");
        } else {
            require(_token != address(0), "Token request requires token address.");
        }

        uint256 requestId = currentAgentPaymentRequestId;
        agentPaymentRequests[requestId] = AgentPaymentRequest({
            id: requestId,
            requester: msg.sender,
            payer: _payer,
            token: _token,
            amount: _amount,
            isNative: _isNative,
            description: _description,
            status: PaymentStatus.Requested,
            createdAt: block.timestamp,
            settledAt: 0
        });

        currentAgentPaymentRequestId++;
        emit AgentPaymentRequestCreated(requestId, msg.sender, _payer, _isNative, _token, _amount, _description);
        return requestId;
    }

    function settleAgentPaymentRequest(uint256 _requestId) public payable onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.payer == msg.sender, "Only designated payer can settle this request.");

        if (request.isNative) {
            require(msg.value == request.amount, "Incorrect native payment amount.");
            uint256 fee = _collectNativeFee(request.amount, "settle_payment_request_native");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            payable(request.requester).transfer(netAmount);
        } else {
            require(msg.value == 0, "Do not send native value for token settlement.");
            bool success = IERC20(request.token).transferFrom(msg.sender, address(this), request.amount);
            require(success, "Token transfer failed.");
            uint256 fee = _collectTokenFee(request.token, request.amount, "settle_payment_request_token");
            uint256 netAmount = request.amount - fee;
            require(netAmount > 0, "Amount too small after fee.");
            bool payoutSuccess = IERC20(request.token).transfer(request.requester, netAmount);
            require(payoutSuccess, "Token payout transfer failed.");
        }

        request.status = PaymentStatus.Settled;
        request.settledAt = block.timestamp;
        emit AgentPaymentRequestSettled(_requestId, msg.sender, request.requester, request.settledAt);
    }

    function cancelAgentPaymentRequest(uint256 _requestId) public onlyRegisteredAgent whenNotPaused {
        AgentPaymentRequest storage request = agentPaymentRequests[_requestId];
        require(request.id != 0, "Payment request does not exist.");
        require(request.status == PaymentStatus.Requested, "Payment request is not open.");
        require(request.requester == msg.sender, "Only requester can cancel this payment request.");

        request.status = PaymentStatus.Cancelled;
        emit AgentPaymentRequestCancelled(_requestId, msg.sender);
    }

    // --- Member Management ---

    function addMember(address _newMember, uint256 _votingPower) public onlyOwner whenNotPaused {
        require(!members[_newMember].isMember, "Member already exists.");
        members[_newMember].isMember = true;
        members[_newMember].votingPower = _votingPower;
        for (uint256 i = 0; i < milestones.length; i++) {
            milestoneMembersWhoCanVote[i][_newMember] = true;
            milestones[i].membersWhoCanVoteCount++;
        }
        memberAddresses.push(_newMember);
        emit MemberAdded(_newMember, _votingPower);
    }

    function removeMember(address _member) public onlyOwner whenNotPaused {
        require(_member != owner, "Cannot remove the owner from the DAO.");
        require(members[_member].isMember, "Member does not exist.");
        delete members[_member];
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][_member]) {
                milestoneMembersWhoCanVote[i][_member] = false;
                milestones[i].membersWhoCanVoteCount--;
            }
        }
        // Remove from memberAddresses array
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == _member) {
                memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
                memberAddresses.pop();
                break;
            }
        }
        emit MemberRemoved(_member);
    }

    function grantPrivilege(address _member, uint256 _privilege) public onlyOwner {
        require(members[_member].isMember, "Invalid member address.");
        members[_member].privileges.push(_privilege);
    }

    function changeOwner(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "Invalid new owner address.");
        members[_newOwner].isMember = true;
        members[_newOwner].votingPower = members[owner].votingPower;
        members[owner].isMember = false;
        // Add new owner to memberAddresses if not already present
        bool found = false;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (memberAddresses[i] == _newOwner) {
                found = true;
                break;
            }
        }
        if (!found) {
            memberAddresses.push(_newOwner);
        }
        owner = _newOwner;
    }

    function getMemberCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isMember) {
                count++;
            }
        }
        return count;
    }

    function getMember(address _member) public view returns (Member memory) {
        return members[_member];
    }

    // --- Milestones ---

    function createMilestone(string memory _description, uint256 _date) public onlyOwner {
        // For the first milestone, only require a future date; for subsequent ones, enforce ordering
        if (milestones.length > 0) {
            require(_date > milestones[milestones.length - 1].date, "New milestone date must be after previous milestone date.");
        }

        uint256 membersCount = 0;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isMember) {
                milestoneMembersWhoCanVote[milestones.length][memberAddresses[i]] = true;
                membersCount++;
            }
        }

        milestones.push(
            Milestone({
                description: _description,
                date: _date,
                membersWhoCanVoteCount: membersCount
            })
        );

        currentMilestoneId++;
    }

    function getMilestoneCount() public view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 _milestoneId) public view returns (MilestoneDetails memory) {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        Milestone storage m = milestones[_milestoneId];
        return MilestoneDetails({
            index: _milestoneId,
            description: m.description,
            date: m.date
        });
    }

    struct MilestoneDetails {
        uint256 index;
        string description;
        uint256 date;
    }

    // --- Proposals ---

    function createProposal(string memory _description, uint256[] memory _previousMilestoneIds) public {
        require(members[msg.sender].isMember, "Only members can create proposals.");
        require(members[msg.sender].votingPower >= minimumVotingPower, "Voting power not sufficient.");
        require(_previousMilestoneIds.length > 0, "At least one previous milestone is required.");

        // Validate milestone IDs are in bounds
        for (uint256 i = 0; i < _previousMilestoneIds.length; i++) {
            require(_previousMilestoneIds[i] < milestones.length, "Invalid milestone ID in previous milestones.");
        }
        // Validate chronological ordering
        for (uint256 i = 1; i < _previousMilestoneIds.length; i++) {
            require(
                milestones[_previousMilestoneIds[i]].date > milestones[_previousMilestoneIds[i - 1]].date,
                "Milestones must be in chronological order."
            );
        }

        bool isMilestoneAssignedToMember = false;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][msg.sender]) {
                isMilestoneAssignedToMember = true;
                break;
            }
        }
        require(isMilestoneAssignedToMember, "Member must be assigned to a milestone to create proposal.");

        uint256 proposalId = currentProposalId;
        proposals.push(
            Proposal({
                id: proposalId,
                description: _description,
                votingDeadline: block.timestamp + votingPeriod,
                executed: false,
                proposalPassed: false,
                yesVotes: 0,
                noVotes: 0,
                previousMilestoneIds: _previousMilestoneIds,
                milestoneId: milestones.length - 1
            })
        );

        proposalMembersWhoCanVote[proposalId][msg.sender] = true;
        currentProposalId++;
    }

    function vote(uint256 _proposalId, bool _vote) public {
        require(members[msg.sender].isMember, "Only members can vote.");
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(!proposalHasVoted[_proposalId][msg.sender], "Member has already voted.");
        require(!proposals[index].executed, "Proposal has already been executed.");
        require(block.timestamp <= proposals[index].votingDeadline, "Voting period has ended.");

        proposalHasVoted[_proposalId][msg.sender] = true;
        if (_vote) {
            proposals[index].yesVotes += members[msg.sender].votingPower;
        } else {
            proposals[index].noVotes += members[msg.sender].votingPower;
        }
    }

    function executeProposal(uint256 _proposalId) public onlyOwner {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(block.timestamp > proposals[index].votingDeadline, "Voting period has not ended.");
        require(!proposals[index].executed, "Proposal has already been executed.");

        uint256 totalVotes = proposals[index].yesVotes + proposals[index].noVotes;
        require(totalVotes > 0, "No votes have been cast.");

        uint256 votePercentage = (proposals[index].yesVotes * 100) / totalVotes;
        if (votePercentage > 50) {
            proposals[index].proposalPassed = true;
            proposals[index].executed = true;
        } else {
            proposals[index].proposalPassed = false;
            proposals[index].executed = true;
        }
    }

    function getProposalCount() public view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 _proposalId) public view returns (ProposalDetails memory) {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        Proposal storage p = proposals[index];
        uint256 totalVotes = p.yesVotes + p.noVotes;
        uint256 votePercentage = totalVotes > 0 ? (p.yesVotes * 100) / totalVotes : 0;
        return ProposalDetails({
            id: p.id,
            description: p.description,
            votingDeadline: p.votingDeadline,
            executed: p.executed,
            proposalPassed: p.proposalPassed,
            yesVotes: p.yesVotes,
            noVotes: p.noVotes,
            votePercentage: votePercentage
        });
    }

    struct ProposalDetails {
        uint256 id;
        string description;
        uint256 votingDeadline;
        bool executed;
        bool proposalPassed;
        uint256 yesVotes;
        uint256 noVotes;
        uint256 votePercentage;
    }

    // --- Proposal Disputes ---

    function disputeProposal(uint256 _proposalId, string memory _description) public onlyMember {
        require(_proposalId > 0 && _proposalId < currentProposalId, "Invalid proposal ID.");
        uint256 index = _proposalId - 1;
        require(!proposals[index].executed, "Proposal has already been executed.");

        uint256 milestoneId = proposals[index].milestoneId;
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only members specific to the milestone can initiate a dispute.");

        uint256 disputeId = currentProposalDisputeId;
        ProposalDispute storage dispute = proposalDisputes[disputeId];
        dispute.id = disputeId;
        dispute.proposalId = _proposalId;
        dispute.disputeDeadline = block.timestamp + (votingPeriod / 2);
        dispute.description = _description;
        dispute.milestoneId = milestoneId;
        dispute.votesFor = 0;
        dispute.votesAgainst = 0;
        dispute.resolved = false;

        currentProposalDisputeId++;
    }

    function voteOnProposalDispute(uint256 _proposalDisputeId, bool _vote) public onlyMember {
        ProposalDispute storage dispute = proposalDisputes[_proposalDisputeId];
        require(dispute.id != 0, "Dispute does not exist.");
        require(!dispute.voted[msg.sender], "Already voted on this dispute.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        require(block.timestamp <= dispute.disputeDeadline, "Dispute voting period has ended.");

        uint256 milestoneId = dispute.milestoneId;
        require(milestoneId < milestones.length, "Invalid milestone on dispute.");
        Milestone storage milestone = milestones[milestoneId];
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only milestone-specific members can vote on this dispute.");

        if (_vote) {
            dispute.votesFor++;
            dispute.hasVotedFor[msg.sender] = true;
        } else {
            dispute.votesAgainst++;
            dispute.hasVotedAgainst[msg.sender] = true;
        }
        dispute.voted[msg.sender] = true;

        // Auto-resolve if majority reached
        uint256 majority = (milestone.membersWhoCanVoteCount / 2) + 1;
        if (dispute.votesFor >= majority) {
            _resolveProposalDispute(dispute.id, true);
        } else if (dispute.votesAgainst >= majority) {
            _resolveProposalDispute(dispute.id, false);
        }
    }

    /// @dev Internal dispute resolution called automatically when majority is reached
    function _resolveProposalDispute(uint256 _disputeId, bool _inFavor) internal {
        ProposalDispute storage dispute = proposalDisputes[_disputeId];
        require(!dispute.resolved, "Dispute has already been resolved.");
        dispute.resolved = true;
        if (_inFavor) {
            uint256 proposalIndex = dispute.proposalId - 1;
            Proposal storage proposal = proposals[proposalIndex];
            proposal.proposalPassed = true;
        }
    }

    /// @notice Owner can manually resolve a dispute after the deadline passes
    function resolveProposalDispute(uint256 _disputeId, bool _inFavor) public onlyOwner {
        ProposalDispute storage dispute = proposalDisputes[_disputeId];
        require(dispute.id != 0, "Dispute does not exist.");
        require(block.timestamp > dispute.disputeDeadline, "The voting period has not yet ended.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        dispute.resolved = true;
        if (_inFavor) {
            uint256 proposalIndex = dispute.proposalId - 1;
            Proposal storage proposal = proposals[proposalIndex];
            proposal.proposalPassed = true;
        }
    }

    // --- Tasks ---

    function createTask(
        string memory _description,
        uint256 _deadline,
        uint256 _milestoneId,
        address _assignedMember,
        string memory _status
    ) public onlyOwner {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        tasks.push(
            Task({
                id: currentTaskId,
                description: _description,
                deadline: _deadline,
                completed: false,
                milestoneId: _milestoneId,
                assignedMember: _assignedMember,
                status: _status,
                progressIds: new uint256[](0)
            })
        );
        emit TaskCreated(currentTaskId, _description, _deadline, _milestoneId, _assignedMember, _status);
        currentTaskId++;
    }

    function addTaskProgress(
        uint256 _taskId,
        string memory _description,
        bool _completed,
        uint256 _percentageCompleted
    ) public onlyRole("reporter") {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        require(_percentageCompleted <= 100, "Percentage completed must be between 0 and 100.");

        Task storage task = tasks[_taskId - 1];
        uint256 newProgressId = currentProgressId++;

        progressData[newProgressId] = Progress({
            date: block.timestamp,
            description: _description,
            completed: _completed,
            percentageCompleted: _percentageCompleted
        });

        task.progressIds.push(newProgressId);
    }

    function updateTask(
        uint256 _taskId,
        string memory _description,
        uint256 _deadline,
        address _assignedMember,
        string memory _status
    ) public onlyOwner {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.description = _description;
        t.deadline = _deadline;
        t.assignedMember = _assignedMember;
        t.status = _status;
        emit TaskUpdated(_taskId, _description, _deadline, _assignedMember, _status);
    }

    function deleteTask(uint256 _taskId) public onlyOwner {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        delete tasks[_taskId - 1];
        emit TaskDeleted(_taskId);
    }

    function getTasksForMilestone(uint256 _milestoneId) public view returns (Task[] memory) {
        require(_milestoneId < milestones.length, "Invalid milestone ID.");
        uint256 count = 0;
        for (uint256 i = 0; i < tasks.length; i++) {
            if (tasks[i].milestoneId == _milestoneId) {
                count++;
            }
        }
        Task[] memory milestoneTasks = new Task[](count);
        count = 0;
        for (uint256 i = 0; i < tasks.length; i++) {
            if (tasks[i].milestoneId == _milestoneId) {
                milestoneTasks[count] = tasks[i];
                count++;
            }
        }
        return milestoneTasks;
    }

    function assignTask(uint256 _taskId, address _member) public onlyOwner {
        require(members[_member].isMember, "Invalid member address.");
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.assignedMember = _member;
    }

    function updateTaskStatus(uint256 _taskId, string memory _status) public onlyOwner {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.status = _status;
    }

    function completeTask(uint256 _taskId) public onlyOwner {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        tasks[_taskId - 1].completed = true;
    }

    // --- Config ---

    function changeVotingPeriod(uint256 _newVotingPeriod) public onlyOwner {
        require(_newVotingPeriod > 0, "New voting period should be greater than zero.");
        votingPeriod = _newVotingPeriod;
    }

    function changeMinimumVotingPower(uint256 _newMinimumVotingPower) public onlyOwner {
        require(_newMinimumVotingPower > 0, "New minimum voting power should be greater than zero.");
        minimumVotingPower = _newMinimumVotingPower;
    }
}
