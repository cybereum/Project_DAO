// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ProjectDAOStorage} from "./ProjectDAOStorage.sol";

/**
 * @title ProjectDAOGovernance — Governance sub-contract for the split Project_DAO architecture
 * @notice Handles all governance, proposals, voting, milestones, tasks, roles, and disputes.
 *         Inherits shared state (members, agents, owner, fees) from ProjectDAOStorage.
 *
 *         This contract declares its own state variables for governance-specific data
 *         (milestones, proposals, tasks, roles, disputes, progress) since only this
 *         sub-contract uses them.
 */
contract ProjectDAOGovernance is ProjectDAOStorage {

    // ─── Storage slot placeholders (must match Core + Commerce layout) ──
    // Core appends TimelockLib.Store (53 slots: delay + gracePeriod + mapping + __gap[50])
    uint256[53] private __corePlaceholder;
    // Commerce appends 3 library stores + extras (~180 slots)
    uint256[180] private __commercePlaceholder;

    // ─── Governance-only Structs ────────────────────────────────────────────

    struct Milestone {
        string description;
        uint256 date;
        uint256 membersWhoCanVoteCount;
    }

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

    /// @dev Used as a return type from getMilestone() (cannot return storage structs with mappings).
    struct MilestoneDetails {
        uint256 index;
        string description;
        uint256 date;
    }

    /// @dev Used as a return type from getProposal().
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

    // ─── Governance-only State Variables ─────────────────────────────────────

    Milestone[] public milestones;
    uint256 public currentMilestoneId;

    Proposal[] public proposals;
    uint256 public currentProposalId;

    uint256 public votingPeriod;
    uint256 public minimumVotingPower;

    mapping(uint256 => mapping(address => bool)) private milestoneMembersWhoCanVote;
    mapping(uint256 => mapping(address => bool)) public proposalHasVoted;
    mapping(uint256 => mapping(address => bool)) public proposalMembersWhoCanVote;

    Task[] public tasks;
    uint256 public currentTaskId;

    mapping(uint256 => ProposalDispute) public proposalDisputes;
    uint256 public currentProposalDisputeId;

    mapping(uint256 => Progress) public progressData;
    uint256 public currentProgressId;

    Role[] roles;

    /// @dev True once initializeGovernance() has run.
    bool public governanceInitialized;

    // ─── Governance Events ──────────────────────────────────────────────────

    event RoleCreated(uint256 id, string name);
    event PermissionAdded(uint256 roleId, string permission);
    event PermissionRemoved(uint256 roleId, string permission);
    event RoleAssigned(address member, uint256 roleId);

    event TaskCreated(uint256 id, string description, uint256 deadline, uint256 milestoneId, address assignedMember, string status);
    event TaskUpdated(uint256 id, string description, uint256 deadline, address assignedMember, string status);
    event TaskDeleted(uint256 id);
    event TaskStatusUpdated(uint256 indexed taskId, string status);
    event TaskCompleted(uint256 indexed taskId);
    event TaskAssigned(uint256 indexed taskId, address indexed member);
    event TaskProgressAdded(uint256 indexed taskId, uint256 progressId, uint256 percentageCompleted);

    event VotingPeriodChanged(uint256 newPeriod);
    event MinimumVotingPowerChanged(uint256 newMinimum);

    event ProposalDisputeCreated(uint256 indexed disputeId, uint256 indexed proposalId, address indexed initiator, string description);
    event ProposalDisputeResolved(uint256 indexed disputeId, bool inFavor);

    // ─── Modifier ───────────────────────────────────────────────────────────

    modifier onlyRole(string memory _permission) {
        uint256 roleId = memberRoles[msg.sender];
        require(roleId > 0, "You don't have a role.");
        Role storage role = roles[roleId - 1];
        require(role.permissions.permissions[_permission], "You don't have permission to perform this action.");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Governance Initialization ──────────────────────────────────────────

    /**
     * @notice One-time initialization for governance-specific counters and defaults.
     *         Called by the owner after deploy. The Core contract initializes shared
     *         state (members, fees, treasury); this function initializes governance
     *         state (voting period, counters, roles).
     */
    function initializeGovernance() external onlyOwner {
        require(!governanceInitialized, "Governance already initialized.");
        governanceInitialized = true;

        // ── Counter starting points (1-based IDs) ────────────────────
        currentProposalId        = 1;
        currentMilestoneId       = 1;
        currentTaskId            = 1;
        currentProposalDisputeId = 1;
        currentProgressId        = 1;

        // ── Governance defaults ──────────────────────────────────────
        votingPeriod       = 7 days;
        minimumVotingPower = 10;

        // Create the "Owner" role (role ID 1) and hand it to the deployer.
        _createRole(bytes32("Owner"));
    }

    // ─── Role Management ────────────────────────────────────────────────────

    function getRole(uint256 _roleId) public view returns (bytes32, uint256) {
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
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

    /// @dev Internal role creation used by initializeGovernance and public createRole
    function _createRole(bytes32 _name) internal {
        roles.push();
        uint256 newRoleId = roles.length; // 1-based — matches getRole/assignRole/addPermission
        Role storage newRole = roles[newRoleId - 1];
        newRole.name = _name;

        emit RoleCreated(newRoleId, string(abi.encodePacked(_name)));
    }

    function createRole(bytes32 _name) public onlyOwner {
        _createRole(_name);
    }

    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
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
        require(_member != address(0), "Invalid member address.");
        require(_roleId > 0 && _roleId <= roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId - 1];
        require(!findMemberInRole(role, _member), "Member already has this role.");
        require(members[_member].isMember, "Invalid member address.");
        role.members.push(_member);
        memberRoles[_member] = _roleId;
        emit RoleAssigned(_member, _roleId);
    }

    function assignRoleToMilestone(address _member, uint256 _milestoneId, bytes32 _role) public onlyOwner whenNotPaused {
        require(_member != address(0), "Invalid member address.");
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

    // ─── Milestones ─────────────────────────────────────────────────────────

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

    // ─── Proposals ──────────────────────────────────────────────────────────

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

    // ─── Proposal Disputes ──────────────────────────────────────────────────

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
        emit ProposalDisputeCreated(disputeId, _proposalId, msg.sender, _description);
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
        emit ProposalDisputeResolved(_disputeId, _inFavor);
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
        emit ProposalDisputeResolved(_disputeId, _inFavor);
    }

    // ─── Tasks ──────────────────────────────────────────────────────────────

    function createTask(
        string memory _description,
        uint256 _deadline,
        uint256 _milestoneId,
        address _assignedMember,
        string memory _status
    ) public onlyOwner whenNotPaused {
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
    ) public onlyRole("reporter") whenNotPaused {
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
        emit TaskProgressAdded(_taskId, newProgressId, _percentageCompleted);
    }

    function updateTask(
        uint256 _taskId,
        string memory _description,
        uint256 _deadline,
        address _assignedMember,
        string memory _status
    ) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.description = _description;
        t.deadline = _deadline;
        t.assignedMember = _assignedMember;
        t.status = _status;
        emit TaskUpdated(_taskId, _description, _deadline, _assignedMember, _status);
    }

    function deleteTask(uint256 _taskId) public onlyOwner whenNotPaused {
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

    function assignTask(uint256 _taskId, address _member) public onlyOwner whenNotPaused {
        require(members[_member].isMember, "Invalid member address.");
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.assignedMember = _member;
        emit TaskAssigned(_taskId, _member);
    }

    function updateTaskStatus(uint256 _taskId, string memory _status) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId < milestones.length, "Invalid milestone ID.");
        t.status = _status;
        emit TaskStatusUpdated(_taskId, _status);
    }

    function completeTask(uint256 _taskId) public onlyOwner whenNotPaused {
        require(_taskId > 0 && _taskId < currentTaskId, "Invalid task ID.");
        tasks[_taskId - 1].completed = true;
        emit TaskCompleted(_taskId);
    }

    // ─── Config ─────────────────────────────────────────────────────────────

    function changeVotingPeriod(uint256 _newVotingPeriod) public onlyOwner whenNotPaused {
        require(_newVotingPeriod > 0, "New voting period should be greater than zero.");
        votingPeriod = _newVotingPeriod;
        emit VotingPeriodChanged(_newVotingPeriod);
    }

    function changeMinimumVotingPower(uint256 _newMinimumVotingPower) public onlyOwner whenNotPaused {
        require(_newMinimumVotingPower > 0, "New minimum voting power should be greater than zero.");
        minimumVotingPower = _newMinimumVotingPower;
        emit MinimumVotingPowerChanged(_newMinimumVotingPower);
    }
}
