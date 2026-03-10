const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function buildWorldModel({ projects, milestones, tasks, proposals, members, companies, agentActivity, agentProfile }) {
  return {
    generatedAt: new Date().toISOString(),
    entities: {
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        budget: project.budget,
      })),
      milestones: milestones.map((milestone) => ({
        id: milestone.id,
        projectId: milestone.projectId,
        status: milestone.status,
        amount: milestone.amount,
        progress: milestone.progress,
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        milestoneId: task.milestoneId,
        status: task.status,
        assignee: task.assignee,
        progress: task.progress,
      })),
      proposals: proposals.map((proposal) => ({
        id: proposal.id,
        projectId: proposal.projectId,
        status: proposal.status,
        yesVotes: proposal.yesVotes,
        noVotes: proposal.noVotes,
        deadline: proposal.deadline,
      })),
      members: members.map((member) => ({
        address: member.address,
        role: member.role,
        votingPower: member.votingPower,
        reputation: member.reputation,
      })),
      companies: companies.map((company) => ({
        address: company.address,
        status: company.status,
        reliability: company.reliability,
        audited: company.audited,
      })),
      agent: {
        registered: Boolean(agentProfile?.registered),
        escrowBalanceWei: agentProfile?.nativeEscrowBalance || '0',
      },
    },
    links: {
      projectToMilestones: milestones.map((milestone) => ({ projectId: milestone.projectId, milestoneId: milestone.id })),
      milestoneToTasks: tasks.map((task) => ({ milestoneId: task.milestoneId, taskId: task.id })),
      projectToProposals: proposals.map((proposal) => ({ projectId: proposal.projectId, proposalId: proposal.id })),
    },
    traces: agentActivity.map((event) => ({
      name: event.name,
      txHash: event.txHash,
      blockNumber: event.blockNumber,
      timestamp: event.timestamp,
    })),
  };
}

export function scoreAgentReadiness(input) {
  const {
    projects,
    milestones,
    tasks,
    proposals,
    members,
    companies,
    walletConnected,
    agentProfile,
    agentActivity,
  } = input;

  const verifiedCompanies = companies.filter((c) => c.status === 'Verified').length;
  const auditedCompanies = companies.filter((c) => c.audited).length;
  const activeProposals = proposals.filter((p) => p.status === 'Active').length;
  const taskCoverage = tasks.length ? tasks.filter((t) => t.progress > 0).length / tasks.length : 0;

  const dimensions = [
    {
      key: 'worldModel',
      title: 'Shared, machine-readable world model',
      score: clamp(Math.round(35 + projects.length * 4 + milestones.length * 2 + taskCoverage * 20)),
      gap: 'Need a canonical API/indexer so every company and agent can query the same graph in real-time.',
      closure: 'World model JSON graph now generated from app state and exportable for agent tooling.',
    },
    {
      key: 'truth',
      title: 'Verifiable truth across organizations',
      score: clamp(Math.round(25 + activeProposals * 8 + (walletConnected ? 18 : 0))),
      gap: 'Not all project events are anchored on-chain yet.',
      closure: 'Voting and agent transactions already produce signed receipts and transaction hashes.',
    },
    {
      key: 'interop',
      title: 'Native interoperability',
      score: 66,
      gap: 'Requires standardized MCP/API tool surfaces across partner stacks.',
      closure: 'Contract-backed actions and structured state provide stable integration primitives.',
    },
    {
      key: 'permissions',
      title: 'Embedded identity, authority, and permissions',
      score: clamp(Math.round(40 + members.length * 3 + verifiedCompanies * 2)),
      gap: 'Fine-grained delegation policies are not fully surfaced in UI.',
      closure: 'Role, member voting power, and verification states are captured and presented to operators.',
    },
    {
      key: 'payments',
      title: 'Low-friction payments and settlement',
      score: clamp(agentProfile?.registered ? 82 : 58),
      gap: 'Needs broader stablecoin/fiat rails and treasury automation.',
      closure: 'Native/token escrow, transfer, and payment-request settlement rails are live in app flows.',
    },
    {
      key: 'execution',
      title: 'Deterministic execution rails',
      score: 61,
      gap: 'Policy rules are still mostly implicit for milestone settlement.',
      closure: 'Added deterministic release policy simulator for milestone settlement conditions.',
    },
    {
      key: 'traceability',
      title: 'Traceability and replayability',
      score: clamp(Math.round(32 + Math.min(agentActivity.length, 10) * 6)),
      gap: 'Need long-horizon indexed traces tied to every decision surface.',
      closure: 'Agent activity feed is now normalized into replayable trace records in world model export.',
    },
    {
      key: 'reputation',
      title: 'Economic incentives and reputation',
      score: clamp(Math.round(45 + verifiedCompanies * 4 + auditedCompanies * 4)),
      gap: 'Portable cross-network reputation is still early.',
      closure: 'Leaderboard and reliability metrics are present and can be tied to contract outcomes.',
    },
    {
      key: 'neutrality',
      title: 'Neutral territory for cross-company coordination',
      score: 73,
      gap: 'Adoption breadth across counterparties is not yet complete.',
      closure: 'Shared on-chain governance + verification already provides neutral coordination substrate.',
    },
    {
      key: 'composability',
      title: 'Composable services and monetizable skills',
      score: 68,
      gap: 'Marketplace packaging for reusable agent skills is missing.',
      closure: 'Feature kits and specialized pages create a base layer for composable service modules.',
    },
  ];

  const overall = Math.round(dimensions.reduce((sum, item) => sum + item.score, 0) / dimensions.length);
  return { overall, dimensions };
}

export function evaluateSettlementPolicy({ inspectionAccepted, lienWaiversReceived, evidenceUploaded }) {
  const allPassed = inspectionAccepted && lienWaiversReceived && evidenceUploaded;
  return {
    ready: allPassed,
    reason: allPassed
      ? 'All deterministic guards passed. Release payment tranche B.'
      : 'One or more policy guards failed. Hold tranche B until all conditions are met.',
  };
}
