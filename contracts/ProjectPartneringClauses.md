#Scope of Work: The scope of work is defined in the agreement and encoded into the smart contract through the creation of milestones. Each milestone represents a piece of work that needs to be completed. The smart contract holds the details of these milestones, including the deliverables, deadlines, and the parties responsible for their completion.

#Parties: This agreement is made between the Project Owner and the Project Partner, who agree to work collaboratively on the project. The parties are identified by their public keys, related to their real identities by certificates issued by the platform Certificate Authority (CA).

#Roles and Responsibilities: The roles and responsibilities of each party are defined in the agreement and enforced by the smart contract. Each participant has a local client associated with their public key, which stores and manages their keys and tokens, and enables them to issue or review and approve transactions. The development of smart contracts is made into a collaborative process resulting in a non-repudiable record of consensus on the Project Networks.

#Project Schedule: The project schedule is represented by the deadlines of the individual milestones in the smart contract. If the project owner needs to update the project schedule, they can do so by calling the appropriate function in the smart contract.

#Payment: The payment terms are defined in the agreement and enforced by the smart contract. The smart contract can hold funds in escrow and automatically release them to the appropriate parties upon the completion of milestones.

#Dispute Resolution: If there's a dispute, the agreement outlines the process for resolution, and the smart contract enforces it. For example, if the agreement states that disputes will be resolved through arbitration on the Aragon Court or Kleros platform, the smart contract will automatically create a dispute on the appropriate platform when a dispute arises.

#Milestone Completion: The agreement outlines the process for verifying the completion of milestones, and the smart contract enforces this process. For example, the agreement might state that a specific party (like the project owner or an independent verifier) is responsible for confirming the completion of milestones. The smart contract would then only allow this party to call the function that marks a milestone as completed.

#Project Metadata: The project metadata like project name, location, etc. are stored in the smart contract and can be accessed by any party to the agreement at any time by calling the appropriate function in the smart contract.

#Signatures: The signing of the agreement is represented by each party calling the constructor function of the smart contract with their respective addresses. This action is equivalent to signing the agreement. The smart contract uses the EntraDIDRegistry to verify the identity of each party, and sets a boolean variable for each party to true to represent that they have signed the agreement. This ensures that only the parties to the agreement can perform actions on the smart contract that are within their roles and responsibilities as defined in the agreement.

#Smart Contracts: The smart contracts shall define the work, define project value accumulation at a milestone, the payment at payment milestones, encode the schedule, rewards and penalties for the work, and execute automatically when the work is performed. DAG vertices containing the smart contracts will be hash-linked, each vertex containing the hash of its immediately preceding vertices.

#Dispute Resolution: Any disputes arising from the project will be resolved through the consensus protocols specified in the smart contracts.

#Termination: The agreement will be terminated upon the completion of the project, as determined by the execution of the final smart contract in the RN.
