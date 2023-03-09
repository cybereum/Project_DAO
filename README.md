# Project_DAO
## 1	INTRODUCTION
Project_DAO.sol is a smart contract written in Solidity, a programming language used to write smart contracts on the Ethereum blockchain. The contract defines a DAO (decentralized autonomous organization) that includes several data structures used to manage members, proposals, milestones, tasks, and roles.
The contract includes several modifier functions with onlyOwner, onlyMember, and onlyRole access control checks to ensure that only authorized parties can execute specific functions.
The paused state variable is used to control whether the contract is active or not via functions pauseContract() and resumeContract() called by the owner of the contract in case an unexpected issue or breach occurs.
Several events are emitted when tasks are created, updated, deleted or when members, roles or permissions are added or removed.
•	The contract provides functionality for a Decentralized Autonomous Organization (DAO).
•	Some important data structures used in the contract include:
o	Member represents a member of the DAO with their voting power.
o	Milestone represents a milestone that the DAO aims to achieve.
o	Proposal represents a proposal made by a member of the DAO with details such as description, deadline, and voting results.
o	Task represents a task that needs be completed for a milestone.
o	Progress represents the progress made on completing a task.
o	Role represents a role in the DAO (e.g., owner, builder, verifier) with corresponding permissions and members.
•	The contract includes functions for members to join the DAO, create proposals, vote on proposals, view milestones and tasks, assign roles for a milestone, and more.
•	There is also a pause feature built in for when the contract is "paused" due to errors, breaches, hacks, or other unexpected issues.
•	The contract includes a new disputeProposal function which allows members to dispute local milestone proposals by creating proposal dispute objects. It also includes updates to the voteOnProposalDispute function to include checks for milestone specific members.
•	Project_DAO.sol contract provides a comprehensive framework for DAO management with efficient and secure allocation of tasks, roles, and permission determination.

### 1.1	FUNCTIONS


## 2	USER STORIES
### 2.1	CONSTRUCTION PROJECT
Use Case:
A construction company is managing a project to build a new office building in the city. They want to use a decentralized way to organize the construction process, manage milestones, and allocate the necessary project roles among their team. They decide to use Project_DAO.sol as their framework for managing the project.
User Story:
Michael is the project manager for the construction team and wants to propose a new task for the project's current milestone. He logs into the DAO using his account address and navigates to the "Create Proposal" section. He enters the description of the task, sets a deadline, and selects the milestone the task relates to. He also sets the necessary project roles to be assigned to the members in charge of the task. He submits the proposal and waits for other members to vote on it.
After a few days, the voting period is over and Michael checks the results. His proposal has received enough votes to pass and is now an active task. The task includes a list of necessary construction activities such as excavation, framing, rough-ins and finish work, which will be accomplished on specified dates.
As the team completes the tasks and milestones of the project, they log their progress in the DAO's task tracking system. They can also assign roles to each member of the construction team and grant them project permissions. In this way, the proper members are granted the necessary access to project-specific tasks and documentations.
As they complete the tasks and log the progress, they realize that they have an issue with the planning of the office plumbing. They set up a proposal dispute by using the "disputeProposal" function alongside with the details of the issue, the proposal id and necessary details. After the members vote on the proposals suggested to solve the issue, the proposal with the highest number of yes votes becomes the solution to implement.
Overall, the Project_DAO.sol contract allows Michael and his team to efficiently manage their construction project in a transparent, decentralized and secure way. This framework helps them to manage their tasks, collaborate remotely and keep track of their project's progress with ease.
### 2.2	EPC (ENGINEERING, PROCUREMENT, AND CONSTRUCTION) PROJECT:
#### Use Case:
An engineering company is managing an EPC project to design, procure, and construct a power plant. They want to use a decentralized way to organize the project, manage milestones, and allocate the necessary project roles among their team. They decide to use Project_DAO.sol as their framework for managing the project.
User Story:
David is the project manager for the engineering company and wants to propose a new task for the project's current milestone. He logs into the DAO using his account address and navigates to the "Create Proposal" section. He enters the description of the task and set a deadline for the delivery. He also sets the necessary project roles to be assigned to the members in charge of the task. David submits the proposal and waits for other members of the project to vote on it.
After a few days, the voting period is over, and David checks the results. His proposal has received enough votes to pass and is now an active task. The task is related to the procurement of a new gas turbine and includes a list of necessary procurement activities, such as vendor identification, vendor evaluation, and material inspection.
As the team completes the tasks and milestones of the project, they log their progress in the DAO's task tracking system. They can also assign roles to each member of the project team and grant them project permissions. In this way, the proper members are granted the necessary access to project-specific tasks, documents, and materials.
As they complete the tasks and log the progress, they realize that there is ambiguity in the project's requirements for safety equipment. They set up a proposal dispute by using the "disputeProposal" function and adding the details, the proposal ID, and the necessary information. After the members vote on the proposals suggested to resolve the issue, the proposal with the highest number of yes votes becomes the solution that will be implemented.
Overall, the Project_DAO.sol contract allows David and his team to efficiently manage their EPC project in a transparent, decentralized, and secure way. This framework helps them to manage their tasks, collaborate remotely, and keep track
### 2.3	OFFSHORE WIND PROJECT
#### Use Case:
A renewable energy company is managing an offshore wind project to design, install and maintain a wind farm. They want to use a decentralized way to organize the project, manage milestones, and allocate the necessary project roles among their team. They decide to use Project_DAO.sol as their framework for managing the project.

#### User Story:
Sarah is the project manager for the renewable energy company and wants to propose a new task for the project's current milestone. She logs into the DAO using her account address and navigates to the "Create Proposal" section. She enters the description of the task, sets a deadline, and selects the milestone the task relates to. She also sets the necessary project roles to be assigned to the members in charge of the task. She submits the proposal and waits for other members of the project to vote on it.
After a few days, the voting period is over, and Sarah checks the results. Her proposal has received enough votes to pass and is now an active task. The task is related to the fabrication and installation of a floating wind turbine platform and includes a list of necessary activities, such as platform design, fabrication, transport, and installation.
As the team completes the tasks and milestones of the project, they log their progress in the DAO's task tracking system. They can also assign roles to each member of the project team and grant them project permissions. In this way, the proper members are granted the necessary access to project-specific tasks, documents, and materials.
As they complete the tasks and log the progress, they realize that the project's foundation design may not be feasible for the offshore site conditions. They set up a proposal dispute by using the "disputeProposal" function and adding the details, the proposal ID, and the necessary information. After the members vote on the proposals suggested to resolve the issue, the proposal with the highest number of yes votes becomes the solution to implement.
Overall, the Project_DAO.sol contract allows Sarah and her team to efficiently manage their offshore wind project in a transparent, decentralized, and secure way. This framework helps them to manage their tasks, collaborate remotely, and
### 2.4	GENERAL 
#### Use Case:
A group of developers are working on a project together and want to use a decentralized way of organization to manage milestones, tasks, and decision-making. They decide to use Project_DAO.sol as their framework for managing the project.
User Story:
Samantha is a developer in the group and wants to propose a new task for their project's current milestone. She logs into the DAO using her account address and navigates to the "Create Proposal" section. She enters the description of the task, sets a deadline, and selects the milestone the task relates to. She submits the proposal and waits for other members to vote on it.
After a few days, the voting period is over and Samantha checks the results. Her proposal has received enough votes to pass and is now an active task. She is assigned the task to complete and works hard to complete it before the deadline. As she progresses on the task, she logs her progress in the DAO's task tracking system.
As she completes the task and logs the final progress, she realizes that there is a dispute about the local milestone for task acceptance. Samantha decides to initiate a proposal dispute by using the new 'disputeProposal' function alongside with her dispute reason, the proposal id and necessary details. She waits for other members to weigh in on this proposal and help solve the dispute.
After a few days, as disputes are resolved, the voting results shows that the proposal should be placed for another voting procedure. Members eligible for voting are shown the solution options and proceeds to vote for their preferred option. Once the voting period is over, the solution voted with the highest number of yes votes is implemented.
Overall, the Project_DAO.sol contract allows Samantha and the group to effectively manage their project tasks and workflows in a transparent, decentralized and secure way.
## 3	SUPPORTING CONTRACTS
### 3.1	ASSETNFT.SOL 
AssetNFT.sol is a smart contract written in Solidity, a programming language used to write smart contracts on the Ethereum blockchain. The contract defines an ERC-721 non-fungible token (NFT) standard used to create, manage and transfer asset tokens.
The Asset struct contains information about the asset including its name, description, image, and related metadata.
The AssetNFT contract inherits from IERC721, ERC721 and ERC721URIStorage, which provide functionality required to create and manage NFTs, as well as for linking external metadata.
The assetIdToOwner mapping is used to keep track of which address owns each NFT. ownerAssetCount is used to keep track of the number of tokens held by each address.
The contract includes several modifier functions to ensure that only authorized parties are able to execute specific functions.
The paused state variable is used to control whether the contract is active or not via functions pauseContract() and resumeContract() called by the owner of the contract in case an unexpected issue or breach occurs.
Several events are emitted when tokens are created or transferred.
