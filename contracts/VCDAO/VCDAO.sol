pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VCDAO is Initializable, OwnableUpgradeable, PausableUpgradeable {
    
    struct Company {
        string name;
        string registeredOffice;
        uint verificationDate;
        uint revocationDate;
        bool isMember;
        bool isVerified;
        bool hasPassedAudit;
        uint reliabilityScore;
        bytes32 reliabilityScoreEncrypted; // field for encrypted reliability score
        address memberAddress;
        string email;
        string website;
        bool isEmailVerified;
        bool isWebsiteVerified;
        uint verificationCode;
        string companyName; // field for the company's name
        uint registrationNumber; // field for the company's registration number
        uint validityPeriod; // field for the validity period of the verified credentials
        string[] credentials; // field for storing the verified credentials
        bytes32 nameEncrypted; // field for encrypted company name
        bytes32 registeredOfficeEncrypted; // field for encrypted registered office
    }
    
    mapping(address => Company) public companies;
    mapping(address => mapping(address => bool)) public votes;
    mapping(address => bytes32) public encryptionKeys;

    address public anchorOfTrust;
    uint public verificationTimeLimit;
    uint public quorumPercentage;
    uint public minimumAuditInterval;
    
    uint public totalCompanies;
    uint public totalVerifiedCompanies;
    uint public totalMembers;
    
    event CompanyVerified(address indexed companyAddress, string name);
    event CompanyRevoked(address indexed companyAddress);
    event MemberAdded(address indexed memberAddress);
    event MemberRemoved(address indexed memberAddress);
    event VoteCasted(address indexed voter, address indexed memberAddress);
    event FeedbackProvided(address indexed reportingCompany, address indexed reportedCompany, string feedback);
    event DisputeRaised(address indexed reportingCompany, address indexed reportedCompany, string complaint);
    event DisputeResolved(address indexed reportingCompany, address indexed reportedCompany, bool resolved);
    event EmailVerificationSent(address indexed companyAddress, string email);
    event EmailVerified(address indexed companyAddress);
    event WebsiteVerificationSent(address indexed companyAddress, string website);
    event WebsiteVerified(address indexed companyAddress);
    
    constructor(address _anchorOfTrust, uint _verificationTimeLimit, uint _quorumPercentage, uint _minimumAuditInterval) {
        anchorOfTrust = _anchorOfTrust;
        verificationTimeLimit = _verificationTimeLimit;
        quorumPercentage = _quorumPercentage;
        minimumAuditInterval = _minimumAuditInterval;
    }
    
    modifier onlyAnchorOfTrust() {
        require(msg.sender == anchorOfTrust, "Only the anchor of trust can perform this action");
        _;
    }
    
    function verifyCompany(address _companyAddress, string memory _name, string memory _registeredOffice, string memory _email, string memory _website) public onlyAnchorOfTrust {
        Company storage company = companies[_companyAddress];
        require(!company.isVerified, "Company is already verified");
    
        company.name = _name;
        company.registeredOffice = _registeredOffice;
        company.email = _email;
        company.website = _website;
        company.verificationDate = block.timestamp;
        company.isVerified = true;
        totalCompanies++;
        totalVerifiedCompanies++;
        emit CompanyVerified(_companyAddress, _name);
    
        // Send email verification
        emit EmailVerificationSent(_companyAddress, _email);
        uint verificationCode = generateVerificationCode();
        company.verificationCode = verificationCode;
        sendEmailVerification(_email, verificationCode);
    
        // Send website verification
        emit WebsiteVerificationSent(_companyAddress, _website);
        sendWebsiteVerification(_website, verificationCode);
    }
    
    function generateVerificationCode() internal returns (uint) {
        // Generate a unique verification code
        return uint(keccak256(abi.encodePacked(block.timestamp, msg.sender, totalVerifiedCompanies)));
    }
    
    function sendEmailVerification(string memory _email, uint _verificationCode) internal {
        // Implementation of sending email verification is not included in this contract.
    }
    
    function sendWebsiteVerification(string memory _website, uint _verificationCode) internal {
        // Implementation of sending website verification is not included in this contract.
    }
    
    function verifyEmail(uint _verificationCode) public {
        Company storage company = companies[msg.sender];
        require(!company.isEmailVerified, "Email is already verified");
        require(company.verificationCode == _verificationCode, "Invalid verification code");
        company.isEmailVerified = true;
        emit EmailVerified(msg.sender);
    }
    
    function verifyWebsite(uint _verificationCode) public {
        Company storage company = companies[msg.sender];
        require(!company.isWebsiteVerified, "Website is already verified");
        require(company.verificationCode == _verificationCode, "Invalid verification code");
        company.isWebsiteVerified = true;
        emit WebsiteVerified(msg.sender);
    }
    
    function revokeCompany(address _companyAddress) public onlyAnchorOfTrust {
        Company storage company = companies[_companyAddress];
        require(company.isVerified, "Company is not verified");
    
        company.isVerified = false;
        company.revocationDate = block.timestamp;
        totalVerifiedCompanies--;
        emit CompanyRevoked(_companyAddress);
    }
    
    function addMember(address _memberAddress) public onlyAnchorOfTrust {
        Company storage company = companies[_memberAddress];
        require(company.isVerified, "Company is not verified");
        require(company.isMember == false, "Company is already a member");
        company.isMember = true;
        company.memberAddress = _memberAddress;
        totalMembers++;
        emit MemberAdded(_memberAddress);
    }

    function addVerifiedCredential(address _companyAddress, string memory _name, uint _registrationNumber, uint _verificationDate, uint _validityPeriod) public {
      require(msg.sender == cybereamAddress, "Only Cybeream can add verified credentials");
  
      Company storage company = companies[_companyAddress];
      require(company.isVerified == true, "Company must be verified to add verified credentials");
  
      // Add the new verified credential to the credentials array
      company.credentials.push(abi.encode(_name, _registrationNumber, _verificationDate, _validityPeriod));
  }
  
  function updateVerifiedCredential(address _companyAddress, uint _credentialIndex, string memory _name, uint _registrationNumber, uint _verificationDate, uint _validityPeriod) public {
      require(msg.sender == cybereamAddress, "Only Cybeream can update verified credentials");
  
      Company storage company = companies[_companyAddress];
      require(company.isVerified == true, "Company must be verified to update verified credentials");
  
      // Update the specified credential in the credentials array
      bytes memory encoded = abi.encode(_name, _registrationNumber, _verificationDate, _validityPeriod);
      require(_credentialIndex < company.credentials.length, "Invalid credential index");
      company.credentials[_credentialIndex] = encoded;
  }
  
  function removeVerifiedCredential(address _companyAddress, uint _credentialIndex) public {
      require(msg.sender == cybereamAddress, "Only Cybeream can remove verified credentials");
  
      Company storage company = companies[_companyAddress];
      require(company.isVerified == true, "Company must be verified to remove verified credentials");
  
      // Remove the specified credential from the credentials array
      require(_credentialIndex < company.credentials.length, "Invalid credential index");
      delete company.credentials[_credentialIndex];
  }

  function castVote(address _memberAddress, uint _reliabilityScore) public {
      require(companies[msg.sender].isMember == true, "Only members can cast votes");
      require(companies[_memberAddress].isVerified == true, "Company is not verified");
      require(votes[msg.sender][_memberAddress] == false, "You have already casted your vote");
      votes[msg.sender][_memberAddress] = true;
      
      uint currentReliabilityScore = companies[_memberAddress].reliabilityScore;
      uint newReliabilityScore = (currentReliabilityScore + _reliabilityScore) / 2;
      companies[_memberAddress].reliabilityScore = newReliabilityScore;
      
      emit VoteCasted(msg.sender, _memberAddress);
  }
  
  
  function castVote(address _memberAddress) public {
      require(companies[msg.sender].isMember == true, "Only members can cast votes");
      require(companies[_memberAddress].isVerified == true, "Company is not verified");
      require(votes[msg.sender][_memberAddress] == false, "You have already casted your vote");
      votes[msg.sender][_memberAddress] = true;
      emit VoteCasted(msg.sender, _memberAddress);
  }
  
  function calculateQuorum() internal view returns (uint) {
      return (totalMembers * quorumPercentage) / 100;
  }
  
  function hasQuorum(uint _voteCount) internal view returns (bool) {
      return (_voteCount * 100) >= (totalMembers * quorumPercentage);
  }
  
  
  function isAuditDue(address _memberAddress) public view returns (bool) {
      Company storage company = companies[_memberAddress];
      if (!company.hasPassedAudit) {
          return true;
      }
      uint timeSinceAudit = block.timestamp - company.verificationDate;
      return timeSinceAudit >= minimumAuditInterval;
  }
  
  function verifyMember(address _memberAddress) public onlyAnchorOfTrust {
      Company storage company = companies[_memberAddress];
      require(company.isVerified == true, "Company is not verified");
      require(company.isMember == true, "Company is not a member");
      require(isAuditDue(_memberAddress), "Audit is not due yet");
      
      uint voteCount = 0;
      for (uint i = 0; i < totalMembers; i++) {
          address voter = companies[i].memberAddress;
          if (voter != _memberAddress && votes[voter][_memberAddress]) {
              voteCount++;
          }
      }
      
      if (hasQuorum(voteCount)) {
          company.hasPassedAudit = true;
      }
      
      uint newReliabilityScore = calculateReliabilityScore(_memberAddress);
      company.reliabilityScore = newReliabilityScore;
  }
  
  
    function calculateReliabilityScore(address _memberAddress) internal view returns (uint) {
        // calculate reliability score based on member's performance over time
        // TODO: implement this function
        return 0;
    }
  
    // The key is a bytes32, which will be used for XOR "encryption"
    bytes32 secretKey;

    function updateReliabilityScore(string memory _companyName, uint _reliabilityScore) public {
        Company storage company = companies[_companyName];

        // The XOR operation is done in a loop, byte by byte
        bytes32 encryptedScore;
        for (uint i = 0; i < 32; i++) {
            encryptedScore[i] = bytes32(_reliabilityScore)[i] ^ secretKey[i];
        }

        company.reliabilityScore = _reliabilityScore;
        company.reliabilityScoreEncrypted = encryptedScore;
    }
  
    function getReliabilityScore(address _memberAddress) public view returns (uint) {
      Company memory company = companies[_memberAddress];
      require(company.isMember == true, "Company is not a member");
      return company.reliabilityScore;
    }
    
    function getCompanyDetails(address _companyAddress) public view returns (bytes32, bytes32, uint, uint, bool, bool, bool, bytes32, address) {
        Company storage company = companies[_companyAddress];
        
        // Decrypt the encryption key for this company
        bytes32 encryptionKey = encryptionKeys[_companyAddress];

        // Decrypt the name, registeredOffice, and reliabilityScore fields using the encryption key
        bytes32 nameEncrypted = company.nameEncrypted;
        bytes32 registeredOfficeEncrypted = company.registeredOfficeEncrypted;
        bytes32 reliabilityScoreEncrypted = company.reliabilityScoreEncrypted;
        bytes32 name = AES.decrypt(nameEncrypted, encryptionKey);
        bytes32 registeredOffice = AES.decrypt(registeredOfficeEncrypted, encryptionKey);
        uint reliabilityScore = uint(AES.decrypt(reliabilityScoreEncrypted, encryptionKey));
        
        return (nameEncrypted, registeredOfficeEncrypted, company.verificationDate, company.revocationDate, company.isMember, company.isVerified, company.hasPassedAudit, reliabilityScoreEncrypted, company.memberAddress);
    }
    
    function provideFeedback(address _reportedCompany, string memory _feedback) public {
        require(companies[msg.sender].isMember == true, "Only members can provide feedback");
        require(companies[_reportedCompany].isMember == true, "Reported company is not a member");
        emit FeedbackProvided(msg.sender, _reportedCompany, _feedback);
      }
  
  function raiseDispute(address _reportedCompany, string memory _complaint) public {
      require(companies[msg.sender].isMember == true, "Only members can raise disputes");
      require(companies[_reportedCompany].isMember == true, "Reported company is not a member");
      emit DisputeRaised(msg.sender, _reportedCompany, _complaint);
    }
  
    function resolveDispute(address _reportingCompany, address _reportedCompany, bool _resolved) public onlyAnchorOfTrust {
      require(companies[_reportingCompany].isMember == true, "Reporting company is not a member");
      require(companies[_reportedCompany].isMember == true, "Reported company is not a member");
      emit DisputeResolved(_reportingCompany, _reportedCompany, _resolved);
    }
    
    function trackImpact(address _companyAddress, string memory _impactType, uint _impactValue) public onlyAnchorOfTrust {
      require(companies[_companyAddress].isVerified == true, "Company is not verified");
      // TODO: implement tracking of environmental and social impact of member companies
    }

  function gettotalMembers() public view returns (uint) {
    uint count = 0;
    for (uint i = 0; i < totalCompanies; i++) {
        if (companies[getMemberAddress(i)].isMember) {
            count++;
        }
    }
    return count;
}
}
