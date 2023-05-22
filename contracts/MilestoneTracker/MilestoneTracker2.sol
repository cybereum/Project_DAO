// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./DateSync.sol";
import "./IKleros.sol";
import "./IAragonCourt.sol";

contract MilestoneTracker is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    struct Milestone {
        address client;
        address[] contractors;
        address verifier;
        uint deadline;
        uint amount;
        uint256 projectValue;
        string documentCID; // IPFS Content Identifier
        bool completed;
        bool paid;
        bool disputeStatus;
        uint256 penalty;
        bool completedByContractor;
        uint klerosDisputeID;
        uint aragonCourtDisputeID;
    }

    struct Reputation {
        uint256 score;
        uint256 numRatings;
    }

    uint256 private minVerifierReputation = 1;

    mapping (uint => Milestone) public milestones;
    mapping (address => Reputation) public contractorReputations;
    mapping (address => Reputation) public verifierReputations;

    Counters.Counter private _milestoneIdTracker;

    mapping(address => bool) public authorizedAddresses;

    IERC20 public paymentToken;
    IKleros public kleros;
    IAragonCourt public aragonCourt;

    address payable public cybereumHost;

    event MilestoneCreated(uint milestoneId);
    event MilestoneCompleted(uint milestoneId, string documentCID, address completedBy);
    event MilestonePaid(uint milestoneId);
    event ContractorPaid(uint milestoneId, address contractor, uint amount);
    event ContractorRated(address contractor, uint256 score);
    event VerifierRated(address verifier, uint256 score);
    event DisputeResolved(uint milestoneId, uint klerosDisputeID, uint aragonCourtDisputeID);

    constructor(IERC20 _paymentToken, IKleros _kleros, IAragonCourt _aragonCourt, address payable _cybereumHost) Ownable() {
        paymentToken = _paymentToken;
        kleros = _kleros;
        aragonCourt = _aragonCourt;
        cybereumHost = _cybereumHost;
    }

    modifier isAuthorized() {
        require(msg.sender == owner() || authorizedAddresses[msg.sender], "Not authorized to perform this action.");
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

    function updateMinVerifierReputation(uint _newThreshold) public onlyOwner {
        require(_newThreshold > 0, "New threshold must be greater than zero");
        minVerifierReputation = _newThreshold;
    }

    function fundCybereum() public payable {
        require(msg.value > 0, "Must send non-zero amount of ether");

        uint256 gasCost = tx.gasprice * gasleft();
        uint256 reward = gasCost * 3 / 2; // 1.5 times the gas fee

        address payable cybereumHost = payable(0x41Eb4491306817eC607e9fb12E96C1B8e4aE4E72); // Cybereum.eth address
        cybereumHost.transfer(reward);

        // Send the remaining ether back to the sender
        uint256 remaining = msg.value - reward;
        if (remaining > 0) {
            address payable sender = payable(msg.sender);
            sender.transfer(remaining);
        }
    }

    function createMilestone(
        address _client,
        address[] memory _contractors,
        address _verifier,
        uint _deadline,
        uint _amount,
        string memory _documentCID
    )
        public
        isValidVerifier(_verifier)
        isAuthorized
    {
        uint milestoneId = _milestoneIdTracker.current();
        _milestoneIdTracker.increment();
        Milestone storage milestone = milestones[milestoneId];
    
        milestone.client = _client;
        milestone.contractors = _contractors;
        milestone.verifier = _verifier;
        milestone.deadline = _deadline;
        milestone.amount = _amount;
        milestone.documentCID = _documentCID;
    
        emit MilestoneCreated(milestoneId);
    }
    
    function completeMilestone(uint _milestoneId, string memory _documentCID) public {
        Milestone storage milestone = milestones[_milestoneId];
        require(!milestone.completed, "Milestone already completed.");
        require(msg.sender == milestone.verifier || isContractor(msg.sender, _milestoneId), "Not authorized to complete this milestone.");
        require(block.timestamp <= milestone.deadline, "Milestone deadline has passed.");
    
        milestone.completed = true;
        milestone.documentCID = _documentCID;
        milestone.completedByContractor = isContractor(msg.sender, _milestoneId);
    
        emit MilestoneCompleted(_milestoneId, _documentCID, msg.sender);
    }
    
    function payMilestone(uint _milestoneId) public nonReentrant {
        Milestone storage milestone = milestones[_milestoneId];
        require(milestone.completed, "Milestone not completed.");
        require(!milestone.paid, "Milestone already paid.");
    
        uint amount = milestone.amount;
        milestone.paid = true;
    
        for (uint i = 0; i < milestone.contractors.length; i++) {
            address contractor = milestone.contractors[i];
            uint contractorAmount = amount / milestone.contractors.length;
            paymentToken.transfer(contractor, contractorAmount);
            emit ContractorPaid(_milestoneId, contractor, contractorAmount);
        }
    
        emit MilestonePaid(_milestoneId);
    }
    
    function rateContractor(address _contractor, uint256 _score) public isValidContractor(_contractor) {
        require(_score >= 1 && _score <= 5, "Score must be between 1 and 5.");
        Reputation storage reputation = contractorReputations[_contractor];
        reputation.score = (reputation.score * reputation.numRatings + _score) / (reputation.numRatings + 1);
        reputation.numRatings++;
    
        emit ContractorRated(_contractor, _score);
    }
    
    function rateVerifier(address _verifier, uint256 _score) public isValidVerifier(_verifier) {
        require(_score >= 1 && _score <= 5, "Score must be between 1 and 5.");
        Reputation storage reputation = verifierReputations[_verifier];
        reputation.score = (reputation.score * reputation.numRatings + _score) / (reputation.numRatings + 1);
        reputation.numRatings++;
    
        emit VerifierRated(_verifier, _score);
    }
    
    function resolveDispute(uint _milestoneId, bool _useKleros) public {
        Milestone storage milestone = milestones[_milestoneId];
        require(!milestone.disputeStatus, "Dispute already resolved.");
        require(!milestone.completed, "Milestone already completed.");
        require(block.timestamp > milestone.deadline, "Milestone deadline has not passed yet.");
          if (_useKleros) {
            milestone.klerosDisputeID = kleros.createDispute(_milestoneId);
        } else {
            milestone.aragonCourtDisputeID = aragonCourt.createDispute(_milestoneId);
        }
    
        milestone.disputeStatus = true;
    
        if (milestone.completedByContractor) {
            milestone.penalty = milestone.amount * 10 / 100; // 10% penalty
            milestone.amount -= milestone.penalty;
        } else {
            milestone.penalty = 0;
        }
    
        emit DisputeResolved(_milestoneId, milestone.klerosDisputeID, milestone.aragonCourtDisputeID);
    }
    
    function isContractor(address _contractor, uint _milestoneId) private view returns (bool) {
        address[] storage contractors = milestones[_milestoneId].contractors;
        for (uint i = 0; i < contractors.length; i++) {
            if (contractors[i] == _contractor) {
                return true;
            }
        }
    
        return false;
    }
}
  
