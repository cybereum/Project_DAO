// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title EconomicProjectLib — Economic project lifecycle
 * @notice External library holding the project creation, funding, contributor
 *         management, and payout logic for Project_DAO. The main contract
 *         enforces authorization and fee collection, then forwards into this
 *         library for validation, mutation, and event emission.
 */
library EconomicProjectLib {
    enum ProjectStatus { Open, Active, Completed, Cancelled }

    struct EconomicProject {
        uint256 id;
        address proposer;
        string  metadataURI;
        uint256 targetBudget;
        uint256 totalFunded;
        uint256 deadline;
        ProjectStatus status;
        uint256 createdAt;
        uint256 contributorCount;
        uint256 funderCount;
    }

    struct Store {
        uint256 currentProjectId;
        mapping(uint256 => EconomicProject)             projects;
        mapping(uint256 => address[])                   projectContributors;
        mapping(uint256 => mapping(address => uint256))  contributorShares; // bps
        mapping(uint256 => mapping(address => bool))     applications;
        mapping(uint256 => mapping(address => bool))     applicationApproved;
        mapping(uint256 => address[])                   projectFunders;
        mapping(uint256 => mapping(address => uint256))  funderContributions;
        mapping(uint256 => mapping(address => bool))     shareClaimed;
        mapping(address => uint256)                     activeProjectCount;
        // Reserved for future fields — storage-gap pattern.
        uint256[50] __gap;
    }

    event EconomicProjectCreated(uint256 indexed projectId, address indexed proposer, string metadataURI, uint256 targetBudget, uint256 deadline);
    event EconomicProjectFunded(uint256 indexed projectId, address indexed funder, uint256 netAmount);
    event EconomicProjectContributorApplied(uint256 indexed projectId, address indexed contributor);
    event EconomicProjectContributorApproved(uint256 indexed projectId, address indexed contributor, uint256 sharesBps);
    event EconomicProjectCompleted(uint256 indexed projectId);
    event EconomicProjectCancelled(uint256 indexed projectId);
    event EconomicProjectShareClaimed(uint256 indexed projectId, address indexed contributor, uint256 amount);
    event EconomicProjectFunderRefunded(uint256 indexed projectId, address indexed funder, uint256 amount);

    /// @notice Create a new economic project.
    function create(
        Store storage self,
        address proposer,
        string calldata metadataURI,
        uint256 targetBudget,
        uint256 deadline
    ) external returns (uint256) {
        require(bytes(metadataURI).length > 0, "metadataURI required.");
        require(targetBudget > 0, "Target budget must be > 0.");
        require(deadline > block.timestamp, "Deadline must be in the future.");

        uint256 id = self.currentProjectId++;
        self.projects[id] = EconomicProject({
            id:               id,
            proposer:         proposer,
            metadataURI:      metadataURI,
            targetBudget:     targetBudget,
            totalFunded:      0,
            deadline:         deadline,
            status:           ProjectStatus.Open,
            createdAt:        block.timestamp,
            contributorCount: 0,
            funderCount:      0
        });

        self.activeProjectCount[proposer]++;
        emit EconomicProjectCreated(id, proposer, metadataURI, targetBudget, deadline);
        return id;
    }

    /// @notice Record funding into a project. Returns net amount added to pool.
    /// @dev Caller must collect fees first and pass the net amount.
    function fund(
        Store storage self,
        uint256 projectId,
        address funder,
        uint256 netAmount
    ) external {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(
            proj.status == ProjectStatus.Open || proj.status == ProjectStatus.Active,
            "Project not accepting funds."
        );
        require(netAmount > 0, "Must send ETH.");

        if (self.funderContributions[projectId][funder] == 0) {
            self.projectFunders[projectId].push(funder);
            proj.funderCount++;
        }
        self.funderContributions[projectId][funder] += netAmount;
        proj.totalFunded += netAmount;

        emit EconomicProjectFunded(projectId, funder, netAmount);
    }

    /// @notice Apply to contribute to a project.
    function applyToProject(
        Store storage self,
        uint256 projectId,
        address applicant
    ) external {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(
            proj.status == ProjectStatus.Open || proj.status == ProjectStatus.Active,
            "Project not accepting applications."
        );
        require(applicant != proj.proposer, "Proposer is already lead contributor.");
        require(!self.applications[projectId][applicant], "Already applied.");

        self.applications[projectId][applicant] = true;
        emit EconomicProjectContributorApplied(projectId, applicant);
    }

    /// @notice Approve a contributor and assign their revenue share.
    function approveContributor(
        Store storage self,
        uint256 projectId,
        address caller,
        address contributor,
        uint256 sharesBps
    ) external {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(contributor != address(0), "Invalid contributor address.");
        require(caller == proj.proposer, "Only the proposer can approve contributors.");
        require(self.applications[projectId][contributor], "Contributor has not applied.");
        require(!self.applicationApproved[projectId][contributor], "Already approved.");
        require(sharesBps > 0 && sharesBps <= 10000, "sharesBps must be 1-10000.");

        // Ensure total shares don't exceed 100%
        uint256 totalShares = 0;
        address[] storage contribs = self.projectContributors[projectId];
        for (uint256 i = 0; i < contribs.length; i++) {
            totalShares += self.contributorShares[projectId][contribs[i]];
        }
        require(totalShares + sharesBps <= 10000, "Total shares would exceed 100%.");

        self.applicationApproved[projectId][contributor] = true;
        self.contributorShares[projectId][contributor] = sharesBps;
        self.projectContributors[projectId].push(contributor);
        proj.contributorCount++;

        if (proj.status == ProjectStatus.Open) {
            proj.status = ProjectStatus.Active;
        }

        emit EconomicProjectContributorApproved(projectId, contributor, sharesBps);
    }

    /// @notice Mark a project complete. Unlock contributor claims.
    function complete(Store storage self, uint256 projectId, address caller) external {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(caller == proj.proposer, "Only the proposer can complete a project.");
        require(
            proj.status == ProjectStatus.Open || proj.status == ProjectStatus.Active,
            "Project already completed or cancelled."
        );

        proj.status = ProjectStatus.Completed;
        require(self.activeProjectCount[proj.proposer] > 0, "Active project count underflow.");
        self.activeProjectCount[proj.proposer]--;
        emit EconomicProjectCompleted(projectId);
    }

    /// @notice Calculate payout for a contributor claim. Returns (payout, shares).
    /// @dev Caller must handle exit fee and ETH transfer.
    function claimShare(
        Store storage self,
        uint256 projectId,
        address claimant
    ) external returns (uint256 payout) {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(proj.status == ProjectStatus.Completed, "Project not completed.");
        require(self.applicationApproved[projectId][claimant], "Not an approved contributor.");
        require(!self.shareClaimed[projectId][claimant], "Share already claimed.");

        uint256 shares = self.contributorShares[projectId][claimant];
        require(shares > 0, "No shares assigned.");

        payout = (proj.totalFunded * shares) / 10000;
        require(payout > 0, "Nothing to claim.");

        self.shareClaimed[projectId][claimant] = true;
    }

    /// @notice Cancel a project.
    function cancel(
        Store storage self,
        uint256 projectId,
        address caller,
        address owner
    ) external {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(
            caller == proj.proposer || caller == owner,
            "Only proposer or owner can cancel."
        );
        require(
            proj.status == ProjectStatus.Open || proj.status == ProjectStatus.Active,
            "Project cannot be cancelled in current status."
        );

        proj.status = ProjectStatus.Cancelled;
        require(self.activeProjectCount[proj.proposer] > 0, "Active project count underflow.");
        self.activeProjectCount[proj.proposer]--;
        emit EconomicProjectCancelled(projectId);
    }

    /// @notice Process a funder refund on a cancelled project. Returns refund amount.
    /// @dev Caller must handle exit fee and ETH transfer.
    function refundFunder(
        Store storage self,
        uint256 projectId,
        address funder
    ) external returns (uint256 amount) {
        EconomicProject storage proj = self.projects[projectId];
        require(proj.id != 0, "Project not found.");
        require(proj.status == ProjectStatus.Cancelled, "Project is not cancelled.");

        amount = self.funderContributions[projectId][funder];
        require(amount > 0, "No contribution to refund.");

        self.funderContributions[projectId][funder] = 0;
        proj.totalFunded -= amount;
    }

    // ─── View Functions ───────────────��─────────────────────���───────────────

    function getProject(Store storage self, uint256 projectId) external view returns (
        uint256 id, address proposer, string memory metadataURI,
        uint256 targetBudget, uint256 totalFunded, uint256 deadline,
        ProjectStatus status, uint256 createdAt,
        uint256 contributorCount, uint256 funderCount
    ) {
        EconomicProject storage p = self.projects[projectId];
        return (p.id, p.proposer, p.metadataURI, p.targetBudget,
                p.totalFunded, p.deadline, p.status, p.createdAt,
                p.contributorCount, p.funderCount);
    }

    function getContributors(Store storage self, uint256 projectId) external view returns (address[] memory) {
        return self.projectContributors[projectId];
    }

    function getFunders(Store storage self, uint256 projectId) external view returns (address[] memory) {
        return self.projectFunders[projectId];
    }

    function getProjects(Store storage self, uint256 offset, uint256 limit)
        external view returns (EconomicProject[] memory page, uint256 total)
    {
        total = self.currentProjectId - 1;
        if (total == 0 || offset >= total) return (new EconomicProject[](0), total);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new EconomicProject[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = self.projects[total - offset - i];
        }
    }
}
