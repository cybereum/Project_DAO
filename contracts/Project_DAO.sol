pragma solidity ^0.8.0;

contract Project_DAO {
    struct Member {
        bool isMember;
        uint256 votingPower;
    }

    struct Milestone {
        string description;
        uint256 date;
    }

    struct Proposal {
        uint256 id;
        string description;
        uint256 votingDeadline;
        bool executed;
        bool proposalPassed;
        uint256 yesVotes;
        uint256 noVotes;
        mapping(address => bool) hasVoted;
        mapping(address => bool) membersWhoCanVote;
        Milestone[] previousMilestones;
    }

      // struct to represent a proposal dispute
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
    }

    struct Task {
        uint256 id;
        string description;
        uint256 deadline;
        bool completed;
        uint256 milestoneId;
        address assignedMember;
        string status;
        Progress[] progress;
    }

    struct Progress {
        uint256 date;
        string description;
        bool completed;
        uint256 percentageCompleted;
    }

    struct Role {
        string name;
        mapping(address => bool) members;
        mapping(string => bool) permissions;
    }

    address public owner;
    mapping(address => Member) public members;
    Proposal[] public proposals;
    uint256 public currentProposalId = 1;
    uint256 public votingPeriod = 7 days;
    uint256 public minimumVotingPower = 10;
    Milestone[] public milestones;
    uint256 public currentMilestoneId = 1;
    Task[] public tasks;
    uint256 public currentTaskId = 1;
    Role[] public roles;
    mapping(address => uint256) public memberRoles;

    event TaskCreated(uint256 id, string description, uint256 deadline, uint256 milestoneId, address assignedMember, string status);
    event TaskUpdated(uint256 id, string description, uint256 deadline, address assignedMember, string status);
    event TaskDeleted(uint256 id);
    event MemberAdded(address member, uint256 votingPower);
    event MemberRemoved(address member);
    event RoleCreated(uint256 id, string name);
    event PermissionAdded(uint256 roleId, string permission);
    event PermissionRemoved(uint256 roleId, string permission);
    event RoleAssigned(address member, uint256 roleId);

    constructor() {
        owner = msg.sender;
        members[owner].isMember = true;
        members[owner].votingPower = 100;
        roles.push(Role({name: "Owner"}));
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function.");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only members can call this function.");
        _;
    }

    modifier onlyRole(string memory _permission) {
        uint256 roleId = memberRoles[msg.sender];
        require(roleId > 0, "You don't have a role.");
        Role storage role = roles[roleId - 1];
        require(role.permissions[_permission], "You don't have permission to perform this action.");
        _;
    }

  //whenNotPaused modifier is to ensure that the contract is not paused when a function is called. The pauseContract function allows the owner to pause the contract in case of unexpected errors, breaches or hacks. The resumeContract function allows the owner to resume normal contract operation after the issue has been resolved.
    bool private _paused;

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused.");
        _;
    }

    function pauseContract() public onlyOwner {
        _paused = true;
    }

    function resumeContract() public onlyOwner {
        _paused = false;
    }

    function addMember(address _newMember, uint256 _votingPower) public onlyOwner whenNotPaused {
        require(!members[_newMember].isMember, "Member already exists.");
        members[_newMember].isMember = true;
        members[_newMember].votingPower = _votingPower;
        emit MemberAdded(_newMember, _votingPower);
    }

    function removeMember(address _member) public onlyOwner whenNotPaused {
        require(_member != owner, "Cannot remove the owner from the DAO.");
        require(members[_member].isMember, "Member does not exist.");
        delete members[_member];
        emit MemberRemoved(_member);
    }

    function createRole(string memory _name) public onlyOwner whenNotPaused {
        // Create a new Role struct with the given name
        Role memory newRole = Role({
            name: _name
        });

        // Add the new Role to the roles array and emit an event
        roles.push(newRole);
        uint256 roleId = roles.length;
        emit RoleCreated(roleId, _name);
    }

        function assignRoleToMilestone(address _member, uint256 _milestoneId, string memory _role) public onlyOwner whenNotPaused {
        require(_milestoneId <= milestones.length, "Invalid milestone ID.");
        require(_role == "milestone_owner" || _role == "builder" || _role == "verifier", "Invalid role.");
        Role storage role = roles[0]; // the role with ID 1 is always the "Owner" role
        if (_role == "builder") {
            role = roles[1];
        } else if (_role == "verifier") {
            role = roles[2];
        }
        require(role.members[msg.sender], "Only members with the '" + role.name + "' role can assign roles to others.");
        require(members[_member].isMember, "Invalid member address.");
        Proposal storage latestProposal = proposals[proposals.length - 1];
        require(latestProposal.milestoneId == _milestoneId, "Only members assigned to this milestone can be assigned a role for it.");
        latestProposal.membersWhoCanVote[_member] = true;
        emit RoleAssigned(_member, role.id);
    }

    //add a permission to a role
    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId <= roles.length, "Invalid role ID.");
        Role storage r = roles[_roleId - 1];
        r.permissions[_permission] = true;
        emit PermissionAdded(_roleId, _permission);
    }

    //remove a permission from a role
    function removePermission(uint256 _roleId, string memory _permission) public onlyOwner {
        require(_roleId <= roles.length, "Invalid role ID.");
        Role storage r = roles[_roleId - 1];
        r.permissions[_permission] = false;
        emit PermissionRemoved(_roleId, _permission);
    }

    //assign a role to a member
   function assignRole(address _member, uint256 _roleId) public onlyOwner {
        require(_roleId <= roles.length, "Invalid role ID.");
        Role storage r = roles[_roleId - 1];
        r.members[_member] = true;
        memberRoles[_member] = _roleId;
        emit RoleAssigned(_member, _roleId);
    }

    // add a permission to a role:
    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId <= roles.length, "Invalid role ID.");
        Role storage r = roles[_roleId - 1];
        r.permissions[_permission] = true;
        emit PermissionAdded(_roleId, _permission);
    }

    // remove a permission from a role
    function removePermission(uint256 _roleId, string memory _permission) public onlyOwner whenNotPaused {
        require(_roleId <= roles.length, "Invalid role ID.");
        Role storage r = roles[_roleId - 1];
        r.permissions[_permission] = false;
        emit PermissionRemoved(_roleId, _permission);
    }

    function createProposal(string memory _description, Milestone[] memory _previousMilestones) public {
        require(members[msg.sender].isMember, "Only members can create proposals.");
        require(members[msg.sender].votingPower >= minimumVotingPower, "Voting power not sufficient.");
        require(_previousMilestones.length > 0, "At least one previous milestone is required.");
        for (uint256 i = 1; i < _previousMilestones.length; i++) {
            require(_previousMilestones[i].date > _previousMilestones[i-1].date, "Milestones must be in chronological order.");
        }
        bool isMilestoneAssignedToMember = false;
        for (uint256 i = 0; i < _previousMilestones.length; i++) {
            Milestone memory milestone = _previousMilestones[i];
            if (milestone.milestone_owner == msg.sender || milestone.builder == msg.sender || milestone.verifier == msg.sender) {
                isMilestoneAssignedToMember = true;
                break;
            }
        }
        require(isMilestoneAssignedToMember, "Member must be assigned as milestone owner, builder or verifier to create proposal.");
        proposals.push(
            Proposal({
                id: currentProposalId,
                description: _description,
                votingDeadline: block.timestamp + votingPeriod,
                executed: false,
                proposalPassed: false,
                yesVotes: 0,
                noVotes: 0,
                previousMilestones: _previousMilestones
            })
        );
        currentProposalId++;
    }

  // add a new function for disputing a proposal
    function disputeProposal(uint256 _proposalId, string memory _description) public onlyMember {
        require(!proposals[_proposalId].executed, "Proposal has already been executed.");
        require(!proposalDisputes[_proposalId].resolved, "Proposal dispute has already been resolved.");
        uint256 milestoneId = proposals[_proposalId].milestoneId;
        require(milestones[milestoneId - 1].membersWhoCanVote[msg.sender], "Only members specific to the milestone can initiate a dispute.");
        ProposalDispute storage dispute = proposalDisputes[currentProposalDisputeId];
        dispute.id = currentProposalDisputeId;
        dispute.proposalId = _proposalId;
        dispute.milestoneId = milestoneId;
        dispute.disputeDeadline = block.timestamp + (votingPeriod / 2);
        dispute.description = _description;
        dispute.votesFor = 0;
        dispute.votesAgainst = 0;
        proposalDisputes[currentProposalDisputeId] = dispute;
        Proposal storage proposal = proposals[_proposalId];
        proposal.membersWhoCanVote[msg.sender] = true;
        currentProposalDisputeId++;
    }

    function createMilestone(string memory _description, uint256 _date) public onlyOwner {
        require(_date > milestones[currentMilestoneId - 1].date, "New milestone date must be after previous milestone date.");
        milestones.push(
            Milestone({
                description: _description,
                date: _date
            })
        );
        currentMilestoneId++;
    }

    function createTask(string memory _description, uint256 _deadline, uint256 _milestoneId, address _assignedMember, string memory _status) public onlyOwner {
        require(_milestoneId <= milestones.length, "Invalid milestone ID.");
        tasks.push(
            Task({
                id: currentTaskId,
                description: _description,
                deadline: _deadline,
                completed: false,
                milestoneId: _milestoneId,
                assignedMember: _assignedMember,
                status: _status
            })
        );
        currentTaskId++;
    }

    function updateTask(uint256 _taskId, string memory _description, uint256 _deadline, address _assignedMember, string memory _status) public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId <= milestones.length, "Invalid milestone ID.");
        t.description = _description;
        t.deadline = _deadline;
        t.assignedMember = _assignedMember;
        t.status = _status;
    }

    //add progress to a task
    function addTaskProgress(uint256 _taskId, string memory _description, bool _completed, uint256 _percentageCompleted) public onlyRole("reporter") {
        require(_taskId <= tasks.length, "Invalid task ID.");
        require(_percentageCompleted >= 0 && _percentageCompleted <= 100, "Percentage completed must be between 0 and 100.");
        Task storage t = tasks[_taskId - 1];
        t.progress.push(Progress({
            date: block.timestamp,
            description: _description,
            completed: _completed,
            percentageCompleted: _percentageCompleted
        }));
    }

    function deleteTask(uint256 _taskId) public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        delete tasks[_taskId - 1];
    }

    function getTasksForMilestone(uint256 _milestoneId) public view returns (Task[] memory) {
        require(_milestoneId <= milestones.length, "Invalid milestone ID.");
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
        require(_taskId <= tasks.length, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId <= milestones.length, "Invalid milestone ID.");
        t.assignedMember = _member;
    }

    function updateTaskStatus(uint256 _taskId, string memory _status) public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId <= milestones.length, "Invalid milestone ID.");
        t.status = _status;
    }

    function completeTask(uint256 _taskId) public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        tasks[_taskId - 1].completed = true;
    }

    function vote(uint256 _proposalId, bool _vote) public {
        require(members[msg.sender].isMember, "Only members can vote.");
        require(!proposals[_proposalId].hasVoted[msg.sender], "Member has already voted.");
        require(block.timestamp <= proposals[_proposalId].votingDeadline, "Voting period has ended.");
        proposals[_proposalId].hasVoted[msg.sender] = true;
        if (_vote) {
            proposals[_proposalId].yesVotes += members[msg.sender].votingPower;
        } else {
            proposals[_proposalId].noVotes += members[msg.sender].votingPower;
        }
    }

    function executeProposal(uint256 _proposalId) public onlyOwner {
        require(block.timestamp > proposals[_proposalId].votingDeadline, "Voting period has not ended.");
        require(!proposals[_proposalId].executed, "Proposal has already been executed.");
        require(proposals[_proposalId].proposalPassed, "Proposal has not passed.");
        uint256 totalVotes = proposals[_proposalId].yesVotes + proposals[_proposalId].noVotes;
        require(totalVotes > 0, "No votes have been cast.");
        uint256 votePercentage = (proposals[_proposalId].yesVotes * 100) / totalVotes;
        if (votePercentage > 50) {
            proposals[_proposalId].proposalPassed = true;
            // execute proposal here
            proposals[_proposalId].executed = true;
        } else {
            proposals[_proposalId].proposalPassed = false;
        }
    }

    // add a new function to vote on a proposal dispute
  function voteOnProposalDispute(uint256 _proposalDisputeId, bool _vote) public onlyMember {
      ProposalDispute storage dispute = proposalDisputes[_proposalDisputeId];
      require(!dispute.voted[msg.sender], "Already voted on this dispute.");
      require(!dispute.resolved, "Dispute has already been resolved.");
      uint256 milestoneId = dispute.milestoneId;
      Milestone storage milestone = milestones[milestoneId - 1];
      require(milestone.membersWhoCanVote[msg.sender], "Only milestone-specific members can vote on this dispute.");
      if (_vote) {
          dispute.votesFor++;
          dispute.hasVotedFor[msg.sender] = true;
      } else {
          dispute.votesAgainst++;
          dispute.hasVotedAgainst[msg.sender] = true;
      }
      dispute.voted[msg.sender] = true;
      if (dispute.votesFor > dispute.votesAgainst && dispute.votesFor >= (milestone.membersWhoCanVoteCount / 2) + 1) {
          resolveProposalDispute(dispute.id, true);
      } else if (dispute.votesAgainst > dispute.votesFor && dispute.votesAgainst >= (milestone.membersWhoCanVoteCount / 2) + 1) {
          resolveProposalDispute(dispute.id, false);
      }
  }

    function changeVotingPeriod(uint256 _newVotingPeriod) public onlyOwner {
        require(_newVotingPeriod > 0, "New voting period should be greater than zero.");
        votingPeriod = _newVotingPeriod;
    }

    function changeMinimumVotingPower(uint256 _newMinimumVotingPower) public onlyOwner {
        require(_newMinimumVotingPower > 0, "New minimum voting power should be greater than zero.");
        minimumVotingPower = _newMinimumVotingPower;
    }

    function getProposalCount() public view returns (uint256) {
        return proposals.length;
    }

    function getProposal(uint256 _proposalId) public view returns (ProposalDetails memory) {
        require(_proposalId < currentProposalId, "Invalid proposal ID.");
        Proposal storage p = proposals[_proposalId];
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

    function getMilestoneCount() public view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 _milestoneId) public view returns (MilestoneDetails memory) {
        require(_milestoneId < currentMilestoneId, "Invalid milestone ID.");
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

    function changeOwner(address _newOwner) public onlyOwner {
        members[_newOwner].isMember = true;
        members[_newOwner].votingPower = members[owner].votingPower;
        members[owner].isMember = false;
        owner = _newOwner;
    }

    function getMemberCount() public view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < proposals.length; i++) {
            if (members[proposals[i].hasVoted[msg.sender]].isMember) {
                count++;
            }
        }
        return count;
    }

    function getMember(address _member) public view returns (Member memory) {
        return members[_member];
    }
}
