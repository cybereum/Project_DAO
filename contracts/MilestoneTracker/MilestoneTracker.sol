// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./SafeMath.sol";
import "./DateSync.sol";
//import "./ProjectOrganization.sol";
import "./Project_DAO.sol";
import "./AssetNFT.sol";

contract MilestoneTracker {
    using SafeMath for uint256;

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
      uint id;
      string description;
      address client;
      address[] contractors;
      address verifier;
      uint deadline;
      uint amount;
      uint256 projectValue; // Amount of project value accumulated at this milestone
      bytes32 documentHash;
      bool completed;
      bool paid;
      bool disputeStatus;
      uint256 penalty; // Optional penalty for late completion
      PaymentMilestone[] paymentMilestones;
      bool completedByContractor; // Flag to track whether the milestone was completed by a contractor
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

    mapping (uint => Milestone) public milestones;
    mapping (address => Reputation) public contractorReputations;
    mapping (address => Reputation) public verifierReputations;
    uint public numMilestones;

    address public owner;
    mapping(address => bool) public authorizedAddresses;

    event MilestoneCreated(uint milestoneId);
    event MilestoneCompleted(uint milestoneId, bytes32 documentHash);
    event MilestonePaid(uint milestoneId);
    event ContractorPaid(uint milestoneId, address contractor, uint amount);
    event ContractorRated(address contractor, uint256 score);
    event VerifierRated(address verifier, uint256 score);
    event DisputeResolved(uint milestoneId);

  constructor() payable {
      owner = msg.sender;
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
    function addAuthorizedAddress(address _address) public {
      require(msg.sender == owner, "Only the owner can add authorized addresses");
      authorizedAddresses[_address] = true;
    }

    function removeAuthorizedAddress(address _address) public {
        require(msg.sender == owner, "Only the owner can remove authorized addresses");
        authorizedAddresses[_address] = false;
    }

    function updateMinVerifierReputation(uint _newThreshold) public {
      require(msg.sender == owner, "Only the owner can update minVerifierReputation");
      //require(msg.sender == owner || authorizedAddresses[msg.sender], "Not authorized to update minVerifierReputation");
      require(_newThreshold > 0, "New threshold must be greater than zero");
      minVerifierReputation = _newThreshold;
  }

  
  function fundCybereum() public payable {
      require(msg.value > 0, "Must send non-zero amount of ether");
      address payable cybereum = payable(0xcybereum); // Replace with the actual address of cybereum.eth
      cybereum.transfer(msg.value * 2);
  }

  function createMilestone(
      address[] memory _contractors,
      address _verifier,
      uint _deadline,
      uint _amount,
      bytes32 _documentHash,
      uint256 _penalty,
      MilestoneType _type) public returns (uint) 
  {
      require(_contractors.length >= 1 && _contractors.length < 10, "At least one contractor and less than 10 required");
      require(_verifier != address(0x0), "Invalid verifier address");
      require(_amount > 0, "Amount must be positive");
      require(_deadline > block.timestamp, "Deadline must be in the future");
      require(_documentHash != 0x0, "Invalid document hash");
  
      uint milestoneId = numMilestones++;
      Milestone storage milestone = milestones[milestoneId];
      milestone.client = msg.sender;
      milestone.contractors = _contractors;
      milestone.verifier = _verifier;
      milestone.deadline = _deadline;
      milestone.amount = _amount;
      milestone.documentHash = _documentHash;
      milestone.completed = false;
      milestone.paid = false;
      milestone.penalty = _penalty;
      milestone.completedByContractor = false; // Initialize completedByContractor to false
      milestone.milestoneType = _type;
  
      // Add a new PaymentMilestone for the entire milestone amount
      uint256 milestoneValue = 0;
      for (uint i = 0; i < _contractors.length; i++) {
          milestoneValue = milestoneValue.add(_amount.div(_contractors.length));
      }
      milestone.paymentMilestones.push(PaymentMilestone({amount: milestone.amount, percentage: 100, paid: false, status: OrderStatus.Open, token: Token({tokenId: 0, owner: address(0)}), milestoneType: _type}));
  
      emit MilestoneCreated(milestoneId);
      return milestoneId;
  }

  function getMilestoneValue(uint _milestoneId) public view returns (uint256) {
    require(_milestoneId < numMilestones, "Invalid milestone ID");
    return milestones[_milestoneId].projectValue;
}
  
  function getMilestone(uint _milestoneId) public view returns (uint id, string memory description, uint amount, MilestoneType milestoneType) {
    require(_milestoneId < numMilestones, "Invalid milestone ID");
    Milestone storage milestone = milestones[_milestoneId];
    return (milestone.id, milestone.description, milestone.amount, milestone.milestoneType);
}
  
function setMilestoneValue(uint _milestoneId, uint256 _projectValue) public isAuthorized {
    require(_milestoneId < numMilestones, "Invalid milestone ID");
    require(_projectValue >= 0, "Project value cannot be negative");
    milestones[_milestoneId].projectValue = _projectValue;
}
  
  function completeMilestone(uint _milestoneId, bytes memory _verifierSignature, bytes memory _contractorSignature) public {
      require(_milestoneId < numMilestones, "Invalid milestone ID");  
      Milestone storage milestone = milestones[_milestoneId];
      require(milestone.client == msg.sender || milestone.verifier == msg.sender, "Only client or verifier can complete milestone");
      require(milestone.deadline >= block.timestamp, "Milestone is past deadline");
      require(!milestone.completed, "Milestone is already completed");
      require(ecrecover(milestone.documentHash, 27, _verifierSignature, bytes4(0)) == milestone.verifier, "Verifier signature not valid");
      for (uint i = 0; i < milestone.contractors.length; i++) {
          address contractor = milestone.contractors[i];
          require(ecrecover(milestone.documentHash, 27, _contractorSignature, bytes4(0)) == contractor, "Contractor signature not valid");
      }
  
      uint256 amountToPay = milestone.amount;
      if (block.timestamp > milestone.deadline) {
          amountToPay = amountToPay.sub(milestone.penalty);
          _updateReputation(milestone.verifier, 1); // Increase verifier reputation score if
      }
  
      if (milestone.projectValue > 0) {
          uint256 totalPayment = 0;
          uint256 remainingPayment = amountToPay;
  
          for (uint i = 0; i < milestone.contractors.length; i++) {
              address contractor = milestone.contractors[i];
              uint256 contractorPayment = 0;
  
              for (uint j = 0; j < ProjectOrganizationInterface(milestone.client).getNumPaymentMilestones(); j++) {
                  uint256 paymentPercentage = ProjectOrganizationInterface(milestone.client).getPaymentMilestonePercentage(j);
  
                  if (j == milestone.projectValue - 1) {
                      contractorPayment = remainingPayment.mul(paymentPercentage).div(100);
                      remainingPayment = remainingPayment.sub(contractorPayment);
                      break;
                  }
              }
  
              totalPayment = totalPayment.add(contractorPayment);
              payable(contractor).transfer(contractorPayment);
              emit ContractorPaid(_milestoneId, contractor, contractorPayment);
          }
  
          uint256 verifierPayment = amountToPay.sub(totalPayment);
          if (verifierPayment > 0) {
              payable(milestone.verifier).transfer(verifierPayment);
              emit ContractorPaid(_milestoneId, milestone.verifier, verifierPayment);
          }
      } else {
          _payContractors(_milestoneId, amountToPay);
          _payVerifiers();
      }
  
      milestone.completed = true;
      milestone.completedByContractor = (msg.sender != milestone.verifier); // Update completedByContractor flag
      emit MilestoneCompleted(_milestoneId, milestone.documentHash);
  
      _updateReputation(milestone.contractors, 1); // Increase contractors' reputation score for completing a milestone
      _updateReputation(milestone.client, 1); // Increase client reputation score for completing a milestone
      _updateReputation(milestone.verifier, 1); // Increase verifier reputation score for completing a milestone
  
      if (ProjectOrganizationInterface(milestone.client).getNumMilestones() == numMilestones) {
          DateSyncInterface(ProjectOrganizationInterface(milestone.client).getDateSync()).submitDate(milestone.deadline);
      }
  
      if (ProjectOrganizationInterface(milestone.client).isProjectCompleted()) {
          _payVerifiers();
      }
  }

  function _payContractors(uint256 _milestoneId, uint256 _amountToPay) private {
      Milestone storage milestone = milestones[_milestoneId];
      uint256 contractorPayment = _amountToPay.div(milestone.contractors.length);
      for (uint i = 0; i < milestone.contractors.length; i++) {
          address contractor = milestone.contractors[i];
          payable(contractor).transfer(contractorPayment);
          emit ContractorPaid(_milestoneId, contractor, contractorPayment);
      }
  }
  
  function _payVerifiers() internal {
      for (uint i = 0; i < numMilestones; i++) {
          Milestone storage milestone = milestones[i];
          if (milestone.completed && !milestone.paid && verifierReputations[milestone.verifier].score >= minVerifierReputation) {
              for (uint j = 0; j < milestone.paymentMilestones.length; j++) {
                  PaymentMilestone storage paymentMilestone = milestone.paymentMilestones[j];
                  if (!paymentMilestone.paid) {
                      uint256 verifierPayment = paymentMilestone.amount.div(10); // 10% goes to verifier
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

    function updatePaymentMilestone(uint _milestoneId, uint256 _amountPaid, address _sender) public {
    require(_milestoneId < numMilestones, "Invalid milestone ID");
    Milestone storage milestone = milestones[_milestoneId];
    require(milestone.client == _sender || milestone.contractors.contains(_sender), "Only client or contractor can update payment milestone");
    require(!milestone.completed, "Milestone is already completed");
  
      for (uint i = 0; i < milestone.paymentMilestones.length; i++) {
        PaymentMilestone storage milestonePayment = milestone.paymentMilestones[i];
        if (!milestonePayment.paid && milestonePayment.amount == _amountPaid) {
          milestonePayment.paid = true;
          milestonePayment.status = OrderStatus.Closed;
          uint256 milestoneValue = milestone.projectValue.div(milestone.paymentMilestones.length);
          uint256 tokenId = AssetNFT.mintNFTToken(milestone.contractors[i], milestoneValue);
          milestonePayment.token = Token({tokenId: tokenId, owner: milestone.contractors[i]});
          transferOwnership(_milestoneId, i, milestone.contractors[i]);
          break;
        }
      }
    }

    function payMilestone(uint _milestoneId, uint _paymentMilestoneIndex) public {
      require(_milestoneId < numMilestones, "Invalid milestone ID");
      Milestone storage milestone = milestones[_milestoneId];
      PaymentMilestone storage paymentMilestone = milestone.paymentMilestones[_paymentMilestoneIndex];
      require(paymentMilestone.status == OrderStatus.Open, "Payment milestone is already paid");
  
      if (paymentMilestone.milestoneType == MilestoneType.Payment) {
          uint256 amountToPay = paymentMilestone.amount.mul(paymentMilestone.percentage).div(100);
          uint256 remainingPayment = amountToPay;
  
          for (uint i = 0; i < milestone.contractors.length; i++) {
              address contractor = milestone.contractors[i];
              uint256 contractorPayment = 0;
    
              for (uint j = 0; j < ProjectOrganizationInterface(milestone.client).getNumPaymentMilestones(); j++) {
                  uint256 paymentPercentage = ProjectOrganizationInterface(milestone.client).getPaymentMilestonePercentage(j);
    
                  if (j == _paymentMilestoneIndex) {
                      contractorPayment = remainingPayment.mul(paymentPercentage).div(100);
                      remainingPayment = remainingPayment.sub(contractorPayment);
                      break;
                  }
              }
    
              if (contractorPayment > 0) {
                  paymentMilestone.token.owner = contractor;
                  // AssetNFT.mintNFTToken() is called to generate an NFT token for the contractor with the corresponding value 
                  uint256 tokenId = AssetNFT.mintNFTToken(contractor, contractorPayment);
                  paymentMilestone.token.tokenId = tokenId;
                  emit ContractorPaid(_milestoneId, contractor, contractorPayment);
              }
          }
      } else if (paymentMilestone.milestoneType == MilestoneType.Regular) {
          // Transfer the milestone amount to the contractor
          uint256 amountToPay = paymentMilestone.amount;
          for (uint i = 0; i < milestone.contractors.length; i++) {
              address contractor = milestone.contractors[i];
              paymentMilestone.token.owner = contractor;
              // AssetNFT.mintNFTToken() is called to generate an NFT token for the contractor with the corresponding value 
              uint256 tokenId = AssetNFT.mintNFTToken(contractor, amountToPay.div(milestone.contractors.length));
              paymentMilestone.token.tokenId = tokenId;
              emit ContractorPaid(_milestoneId, contractor, amountToPay.div(milestone.contractors.length));
          }
      }
  
      // Mark the payment milestone as paid and closed
      paymentMilestone.paid = true;
      paymentMilestone.status = OrderStatus.Closed;
      emit MilestonePaid(_milestoneId);
  
      // If all payment milestones are completed, transfer the ownership of NFT tokens to the client
      if (_areAllPaymentMilestonesPaid(milestone)) {
          for (uint i = 0; i < milestone.paymentMilestones.length; i++) {
              PaymentMilestone storage pm = milestone.paymentMilestones[i];
              if (pm.token.owner != address(0)) {
                  // AssetNFT.transferFrom() is called to transfer ownership of the NFT token to the client
                  AssetNFT.transferFrom(pm.token.owner, milestone.client, pm.token.tokenId);
              }
  // Add this code to the end of the function
  // Mark the milestone as completed if all payment milestones are paid
  if (_areAllMilestonesPaid()) {
  milestone.completed = true;
  emit MilestoneCompleted(_milestoneId);
  }
  }
  // Helper function to check if all payment milestones are paid
  function _areAllPaymentMilestonesPaid(Milestone storage milestone) private view returns (bool) {
      for (uint i = 0; i < milestone.paymentMilestones.length; i++) {
          if (!milestone.paymentMilestones[i].paid) {
              return false;
          }
      }
      return true;
  }
  
  // Helper function to check if all milestones are paid
  function _areAllMilestonesPaid() private view returns (bool) {
      for (uint i = 0; i < milestones.length; i++) {
          if (!milestones[i].completed) {
              return false;
          }
      }
      return true;
  }
  }

  function mintNFTToken(uint _milestoneId, uint256 _paymentMilestoneIndex, address _to) internal {
      Milestone storage milestone = milestones[_milestoneId];
      PaymentMilestone storage milestonePayment = milestone.paymentMilestones[_paymentMilestoneIndex];
      require(milestonePayment.paid, "Payment has not been made yet");
      require(milestonePayment.token.tokenId == 0, "NFT token for this milestone has already been minted");
  
      uint256 milestoneValue = milestone.projectValue.div(milestone.paymentMilestones.length);
      uint256 tokenId = AssetNFT.mintNFTToken(milestone.contractors[_paymentMilestoneIndex], milestoneValue, milestone.milestoneType);
      milestonePayment.token = Token({tokenId: tokenId, owner: _to});
      transferOwnership(_milestoneId, _paymentMilestoneIndex, _to);
  }

  function transferOwnership(uint _milestoneId, uint256 _paymentMilestoneIndex, address _newOwner) internal {
      Milestone storage milestone = milestones[_milestoneId];
      PaymentMilestone storage milestonePayment = milestone.paymentMilestones[_paymentMilestoneIndex];
      require(milestonePayment.paid, "Payment has not been made yet");
  
      uint256 tokenId = milestonePayment.token.tokenId;
      address oldOwner = milestonePayment.token.owner;
      AssetNFT.transferFrom(oldOwner, _newOwner, tokenId);
  
      if (_newOwner == milestone.client) {
          milestone.completedByContractor = true;
      } else {
          milestone.completedByContractor = false;
      }
  }

    function getNFTTokenIds(uint _milestoneId, uint256 _paymentMilestoneIndex) public view returns (uint256[] memory) {
    Milestone storage milestone = milestones[_milestoneId];
    PaymentMilestone storage milestonePayment = milestone.paymentMilestones[_paymentMilestoneIndex];
    require(milestonePayment.paid, "Payment has not been made yet");
    
    uint256[] memory tokenIds = new uint[](milestone.contractors.length);
    
    for (uint i = 0; i < milestone.contractors.length; i++) {
      tokenIds[i] = milestone.paymentMilestones[_paymentMilestoneIndex].token.tokenId;
    }
    
    return tokenIds;
  }

    function getTokenBalance(uint _tokenId) public view returns (address[] memory owners, uint256[] memory balances) {
    AssetNFT.Token storage token = AssetNFT.tokens[_tokenId];
    owners = new address[](token.owners.length);
    balances = new uint256[](token.owners.length);

    for (uint i = 0; i < token.owners.length; i++) {
        owners[i] = token.owners[i];
        balances[i] = token.balances[token.owners[i]];
    }

    return (owners, balances);
}

  function _updateReputation(address _user, int _amount) internal {
      Reputation storage reputation;
      if (milestones[numMilestones - 1].verifier == _user) {
          reputation = verifierReputations[_user];
      } else {
          reputation = contractorReputations[_user];
      }
      reputation.score += _amount;
      reputation.numRatings++;
      uint256 rating = reputation.score / reputation.numRatings;
      if (milestones[numMilestones - 1].verifier == _user) {
          emit VerifierRated(_user, rating);
      } else {
          emit ContractorRated(_user, rating);
      }
  }

  
  function updateVerifierReputationThreshold(uint _newThreshold) public {
      require(_newThreshold > 0, "New threshold must be greater than zero");
      minVerifierReputation  = _newThreshold;
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
      if (reputation.numRatings > 0) {
          reputation.numRatings--;
      }
      emit ContractorRated(_contractor, reputation.score / reputation.numRatings);
  }
  
  function increaseVerifierReputation(address _verifier, uint256 _amount) public isAuthorized isValidVerifier(_verifier) {
      Reputation storage reputation = verifierReputations[_verifier];
      reputation.score += _amount;
      reputation.numRatings++;
      emit VerifierRated(_verifier, reputation.score / reputation.numRatings);
  }
  function decreaseVerifierReputation(address _verifier, uint256 _amount) public {
    Reputation storage reputation = verifierReputations[_verifier];
    require(reputation.score >= _amount, "Score cannot be below zero");
    reputation.score -= _amount;
    if (reputation.numRatings > 0) {
        reputation.numRatings--;
    }
    emit VerifierRated(_verifier, reputation.score / reputation.numRatings);
}

  function resolveDispute(uint _milestoneId) public {
      Milestone storage milestone = milestones[_milestoneId];
      require(milestone.client == msg.sender, "Only the client can resolve disputes");
      require(!milestone.completed, "Milestone has already been completed");
      milestone.disputeStatus = true;
      milestone.completed = false;
      emit DisputeResolved(_milestoneId);
  }

}
