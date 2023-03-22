pragma solidity ^0.8.0;

// Import the VCDAO contract
//import "./VCDAO.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20CappedUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract Project_DAO {
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
        //mapping(address => bool) hasVoted;
        //mapping(address => bool) membersWhoCanVote;
        //Milestone[] previousMilestones;
        uint256[] previousMilestoneIds;
        uint256 milestoneId;
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
    // Add mappings to store the voting data for each proposal
    mapping(uint256 => mapping(address => bool)) public proposalHasVoted;
    mapping(uint256 => mapping(address => bool)) public proposalMembersWhoCanVote;
    mapping(uint256 => Progress) public progressData;
    uint256 public currentProgressId = 1;
    

    //stores the address of the VCDAO.sol contract for when we populate our project with members using VC from that DAO
    //address vcdaoContractAddress;

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
    Role[] roles;
    mapping(address => uint256) public memberRoles;
    address[] public memberAddresses;


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
  
      // Create an "Owner" role and add it to the roles array
      createRole("Owner");
  }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function.");
        _;
    }

    modifier onlyMember() {
        require(members[msg.sender].isMember, "Only members can call this function.");
        _;
    }

    //  getter function to access role information
    function getRole(uint256 _roleId) public view returns (bytes32, uint256) {
        require(_roleId < roles.length, "Invalid role ID.");
        Role storage role = roles[_roleId];
        return (role.name, role.members.length);
    }

    modifier onlyRole(string memory _permission) {
        uint256 roleId = memberRoles[msg.sender];
        require(roleId > 0, "You don't have a role.");
        Role storage role = roles[roleId - 1];
        // Access the permissions mapping correctly
        require(role.permissions.permissions[_permission], "You don't have permission to perform this action.");
        _;
    }

  //whenNotPaused modifier is to ensure that the contract is not paused when a function is called. The pauseContract function allows the owner to pause the contract in case of unexpected errors, breaches or hacks. The resumeContract function allows the owner to resume normal contract operation after the issue has been resolved.
    bool private _paused;

    modifier whenNotPaused() {
        require(!_paused, "Contract is paused.");
        _;
    }

    function findMemberInRole(Role storage role, address member) private view returns (bool) {
        for (uint256 i = 0; i < role.members.length; i++) {
            if (role.members[i] == member) {
                return true;
            }
        }
        return false;
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
        // Remove the member from the milestoneMembersWhoCanVote mapping for all milestones
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][_member]) {
                milestoneMembersWhoCanVote[i][_member] = false;
                milestones[i].membersWhoCanVoteCount--;
            }
        }
        emit MemberRemoved(_member);
    }
    
    // function to add permissions to a role
    function _addPermissionToRole(uint256 _roleId, string memory _permission) internal {
        roles[_roleId].permissions.permissions[_permission] = true;
    }

    function createRole(bytes32 _name) public onlyOwner {
        uint256 newRoleId = roles.length;
        roles.push();
        Role storage newRole = roles[newRoleId];
        newRole.name = _name;
        newRole.members = new address[](0);
        
        // Add permissions to the newly created role using the new function
        _addPermissionToRole(newRoleId, "somePermission");

        emit RoleCreated(newRoleId, string(abi.encodePacked(_name)));
    }

    function assignRoleToMilestone(address _member, uint256 _milestoneId, bytes32 _role) public onlyOwner whenNotPaused {
        require(_milestoneId <= milestones.length, "Invalid milestone ID.");
        require(_role == keccak256(abi.encodePacked("milestone_owner")) || _role == keccak256(abi.encodePacked("builder")) || _role == keccak256(abi.encodePacked("verifier")), "Invalid role.");
        uint256 roleIndex;
        if (_role == keccak256(abi.encodePacked("milestone_owner"))) {
            roleIndex = 0;
        } else if (_role == keccak256(abi.encodePacked("builder"))) {
            roleIndex = 1;
        } else if (_role == keccak256(abi.encodePacked("verifier"))) {
            roleIndex = 2;
        }
        int256 memberIndex = findMemberIndex(roles[roleIndex].members, msg.sender);
        require(members[_member].isMember, "Invalid member address.");
        Proposal storage latestProposal = proposals[proposals.length - 1];
        require(latestProposal.milestoneId == _milestoneId, "Only members assigned to this milestone can be assigned a role for it.");
        proposalMembersWhoCanVote[latestProposal.id][_member] = true;
        emit RoleAssigned(_member, roleIndex + 1);
    }

    function addPermission(uint256 _roleId, string memory _permission) public onlyOwner {
        Role storage role = roles[_roleId - 1];
        role.permissions.permissions[_permission] = true; // update permissions field
        emit PermissionAdded(_roleId, _permission);
    }
    //assign a role to a member
    function assignRole(address _member, uint256 _roleId) public onlyOwner whenNotPaused {
        Role storage role = roles[_roleId - 1];
        require(!findMemberInRole(role, _member), "Only members with the role can assign roles");
        require(members[_member].isMember, "Invalid member address."); // make sure member is valid
        role.members.push(_member);
        memberRoles[_member] = _roleId;
        emit RoleAssigned(_member, _roleId);
    }

    function grantPrivilege(address _member, uint256 _privilege) public onlyOwner {
        require(members[_member].isMember, "Invalid member address.");
        members[_member].privileges.push(_privilege);
    }

    function findMemberIndex(address[] storage memberArray, address member) private view returns (int256) {
        for (uint256 i = 0; i < memberArray.length; i++) {
            if (memberArray[i] == member) {
                return int256(i);
            }
        }
        return -1;
    }
    
    // remove a permission from a role
    function removePermission(uint256 _roleId, string memory _permission)  public onlyOwner whenNotPaused {
        Role storage role = roles[_roleId - 1];
        require(findMemberInRole(role, msg.sender), "Only members with the role can remove a permission");
        role.permissions.permissions[_permission] = false;
        emit PermissionRemoved(_roleId, _permission);
    }

    function createProposal(string memory _description, uint256[] memory _previousMilestoneIds) public {
        require(members[msg.sender].isMember, "Only members can create proposals.");
        require(members[msg.sender].votingPower >= minimumVotingPower, "Voting power not sufficient.");
        require(_previousMilestoneIds.length > 0, "At least one previous milestone is required.");
        for (uint256 i = 1; i < _previousMilestoneIds.length; i++) {
            require(milestones[_previousMilestoneIds[i]].date > milestones[_previousMilestoneIds[i-1]].date, "Milestones must be in chronological order.");
        }
        bool isMilestoneAssignedToMember = false;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestoneMembersWhoCanVote[i][msg.sender]) {
                isMilestoneAssignedToMember = true;
                break;
            }
        }
        require(isMilestoneAssignedToMember, "Member must be assigned as milestone owner, builder or verifier to create proposal.");

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
                milestoneId: currentMilestoneId
            })
        );

        // Update the mapping for the proposal members who can vote
        proposalMembersWhoCanVote[proposalId][msg.sender] = true;
        currentProposalId++;
    }

  // add a new function for disputing a proposal
    function disputeProposal(uint256 _proposalId, string memory _description) public onlyMember {
        require(!proposals[_proposalId].executed, "Proposal has already been executed.");
        require(!proposalDisputes[_proposalId].resolved, "Proposal dispute has already been resolved.");
        uint256 milestoneId = proposals[_proposalId].milestoneId;
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only members specific to the milestone can initiate a dispute.");
        ProposalDispute storage dispute = proposalDisputes[currentProposalDisputeId];
        dispute.id = currentProposalDisputeId;
        dispute.proposalId = _proposalId;
        dispute.disputeDeadline = block.timestamp + (votingPeriod / 2);
        dispute.description = _description;
        dispute.votesFor = 0;
        dispute.votesAgainst = 0;
        ProposalDispute storage newDispute = proposalDisputes[currentProposalDisputeId];
        newDispute.id = dispute.id;
        newDispute.proposalId = dispute.proposalId;
        newDispute.disputeDeadline = dispute.disputeDeadline;
        newDispute.resolved = dispute.resolved;
        newDispute.description = dispute.description;
        newDispute.votesFor = dispute.votesFor;
        newDispute.votesAgainst = dispute.votesAgainst;

        Proposal storage proposal = proposals[_proposalId];
        proposalMembersWhoCanVote[proposal.id][msg.sender] = true;
        currentProposalDisputeId++;
    }

    function createMilestone(string memory _description, uint256 _date) public onlyOwner {
        require(_date > milestones[currentMilestoneId - 1].date, "New milestone date must be after previous milestone date.");

        uint256 membersCount = 0;
        for (uint256 i = 0; i < memberAddresses.length; i++) {
            if (members[memberAddresses[i]].isMember) {
                milestoneMembersWhoCanVote[currentMilestoneId][memberAddresses[i]] = true;
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

    function createTask(string memory _description, uint256 _deadline, uint256 _milestoneId, address _assignedMember, string memory _status)  public onlyOwner {
        require(_milestoneId <= milestones.length, "Invalid milestone ID.");
        tasks.push(
            Task({
                id: currentTaskId,
                description: _description,
                deadline: _deadline,
                completed: false,
                milestoneId: _milestoneId,
                assignedMember: _assignedMember,
                status: _status,
                progressIds: new uint256[](0) // Initialize the progress field with an empty array
            })
        );
        currentTaskId++;
    }

        // Add a new function to add progress data to a task
    function addTaskProgress(uint256 _taskId, string memory _description, bool _completed, uint256 _percentageCompleted)  public onlyRole("reporter") {
        require(_taskId <= tasks.length, "Invalid task ID.");
        require(_percentageCompleted >= 0 && _percentageCompleted <= 100, "Percentage completed must be between 0 and 100.");

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

    function updateTask(uint256 _taskId, string memory _description, uint256 _deadline, address _assignedMember, string memory _status)  public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        Task storage t = tasks[_taskId - 1];
        require(t.milestoneId <= milestones.length, "Invalid milestone ID.");
        t.description = _description;
        t.deadline = _deadline;
        t.assignedMember = _assignedMember;
        t.status = _status;
    }

    function deleteTask(uint256 _taskId) public onlyOwner {
        require(_taskId <= tasks.length, "Invalid task ID.");
        delete tasks[_taskId - 1];
    }

    function getTasksForMilestone(uint256 _milestoneId)  public view returns (Task[] memory) {
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
        require(!proposalHasVoted[_proposalId][msg.sender], "Member has already voted."); // Use proposalHasVoted mapping
        require(!proposals[_proposalId].executed, "Proposal has already been executed.");
        require(block.timestamp <= proposals[_proposalId].votingDeadline, "Voting period has ended.");
        proposalHasVoted[_proposalId][msg.sender] = true; // Update proposalHasVoted mapping
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

    // function to vote on a proposal dispute
    function voteOnProposalDispute(uint256 _proposalDisputeId, bool _vote) public onlyMember {
        ProposalDispute storage dispute = proposalDisputes[_proposalDisputeId];
        require(!dispute.voted[msg.sender], "Already voted on this dispute.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        uint256 milestoneId = dispute.milestoneId;
        Milestone storage milestone = milestones[milestoneId - 1];
        require(milestoneMembersWhoCanVote[milestoneId][msg.sender], "Only milestone-specific members can vote on this dispute.");

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

    function resolveProposalDispute(uint256 _disputeId, bool _resolved) public onlyRole("owner") {
        ProposalDispute storage dispute = proposalDisputes[_disputeId];
        require(block.timestamp > dispute.disputeDeadline, "The voting period has not yet ended.");
        require(!dispute.resolved, "Dispute has already been resolved.");
        dispute.resolved = true;
        if (_resolved) {
            Proposal storage proposal = proposals[dispute.proposalId];
            proposal.proposalPassed = true;
            // execute proposal here
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

    function getProposalCount() public  view returns (uint256)  {
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

  //The Code below is for interfacing with the VCDAO contract if we are using it
/*
    // Function to set the address of the VCDAO contract
    function setVCDAOAddress(address _vcdaoContractAddress) public {
        vcdaoContractAddress = _vcdaoContractAddress;
    }

    // Function to get the address of the VCDAO contract
    function getVCDAOAddress() public view returns (address) {
        return vcdaoContractAddress;
    }

    //This function is meant to work with VCDAO. It queries VCDAO.sol for a list of all member companies:
    function getMemberCompanies() public view returns (address[] memory) {
      require(vcdaoContractAddress != address(0), "VCDAO contract address has not been set");
      VCDAO vcdaoContract = VCDAO(vcdaoContractAddress);
      uint totalMembers = vcdaoContract.totalMembers();
      address[] memory memberAddresses = new address[](totalMembers);
      for (uint i = 0; i < totalMembers; i++) {
          memberAddresses[i] = vcdaoContract.getMemberAddress(i);
      }
      return memberAddresses;
  }
  */
}
