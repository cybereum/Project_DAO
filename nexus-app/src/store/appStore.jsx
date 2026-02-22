import { useState, createContext, useContext, useCallback } from 'react';

const AppContext = createContext(null);

const MOCK_PROJECTS = [
  {
    id: 1, name: 'Orbital Station Alpha', status: 'Active', type: 'Infrastructure',
    members: 12, milestones: 8, completedMilestones: 5, budget: '2,500,000',
    description: 'Deep space orbital construction platform for resource extraction and habitat modules.',
    proposals: 3, tasks: 24, completedTasks: 18, progress: 62,
  },
  {
    id: 2, name: 'Quantum Network Bridge', status: 'Active', type: 'Technology',
    members: 8, milestones: 6, completedMilestones: 2, budget: '1,800,000',
    description: 'Cross-chain quantum-secured communication protocol for enterprise DAOs.',
    proposals: 5, tasks: 16, completedTasks: 7, progress: 33,
  },
  {
    id: 3, name: 'Terra Reforestation DAO', status: 'Active', type: 'Environmental',
    members: 24, milestones: 12, completedMilestones: 9, budget: '4,200,000',
    description: 'Global reforestation initiative using satellite monitoring and smart contract payouts.',
    proposals: 2, tasks: 42, completedTasks: 36, progress: 75,
  },
  {
    id: 4, name: 'MedChain Protocol', status: 'Pending', type: 'Healthcare',
    members: 6, milestones: 10, completedMilestones: 0, budget: '3,100,000',
    description: 'Decentralized medical records and clinical trial management platform.',
    proposals: 1, tasks: 8, completedTasks: 0, progress: 0,
  },
];

const MOCK_MILESTONES = [
  { id: 1, projectId: 1, name: 'Foundation Module Deploy', deadline: '2026-03-15', status: 'Completed', amount: '300,000', progress: 100, contractors: 3 },
  { id: 2, projectId: 1, name: 'Solar Array Installation', deadline: '2026-04-20', status: 'Completed', amount: '450,000', progress: 100, contractors: 2 },
  { id: 3, projectId: 1, name: 'Habitat Ring Assembly', deadline: '2026-06-01', status: 'In Progress', amount: '600,000', progress: 68, contractors: 5 },
  { id: 4, projectId: 1, name: 'Life Support Integration', deadline: '2026-07-15', status: 'Pending', amount: '500,000', progress: 12, contractors: 4 },
  { id: 5, projectId: 1, name: 'Communication Array', deadline: '2026-08-30', status: 'Pending', amount: '200,000', progress: 0, contractors: 2 },
  { id: 6, projectId: 2, name: 'Quantum Key Distribution', deadline: '2026-04-10', status: 'Completed', amount: '400,000', progress: 100, contractors: 3 },
  { id: 7, projectId: 2, name: 'Cross-Chain Bridge Protocol', deadline: '2026-05-20', status: 'In Progress', amount: '350,000', progress: 45, contractors: 4 },
  { id: 8, projectId: 3, name: 'Satellite Monitoring Setup', deadline: '2026-02-28', status: 'Completed', amount: '280,000', progress: 100, contractors: 2 },
  { id: 9, projectId: 3, name: 'Smart Contract Payout System', deadline: '2026-03-15', status: 'Completed', amount: '320,000', progress: 100, contractors: 3 },
  { id: 10, projectId: 3, name: 'Regional Planting Phase 3', deadline: '2026-05-01', status: 'In Progress', amount: '500,000', progress: 55, contractors: 8 },
];

const MOCK_PROPOSALS = [
  { id: 1, projectId: 1, title: 'Upgrade radiation shielding to Grade-7', status: 'Active', yesVotes: 8, noVotes: 2, deadline: '2026-03-01', author: '0x7a23...f4d1', description: 'Current Grade-5 shielding insufficient for prolonged habitation. Upgrade to Grade-7 composite with 99.7% particle deflection.' },
  { id: 2, projectId: 1, title: 'Add emergency escape pod bay', status: 'Active', yesVotes: 11, noVotes: 0, deadline: '2026-03-05', author: '0x3b91...c2e8', description: 'Safety regulation compliance requires minimum 4 escape pods for crew capacity of 50.' },
  { id: 3, projectId: 2, title: 'Integrate post-quantum cryptography', status: 'Passed', yesVotes: 7, noVotes: 1, deadline: '2026-02-20', author: '0x9f12...a7b3', description: 'Transition from ECDSA to lattice-based signatures for quantum resistance.' },
  { id: 4, projectId: 1, title: 'Extend solar array by 40%', status: 'Disputed', yesVotes: 5, noVotes: 5, deadline: '2026-02-25', author: '0x1c45...d9e0', description: 'Power requirements exceed initial projections. Additional solar capacity needed for research modules.' },
  { id: 5, projectId: 3, title: 'Expand to South American regions', status: 'Active', yesVotes: 18, noVotes: 3, deadline: '2026-03-10', author: '0x5d78...b1c4', description: 'Phase 4 expansion targeting Amazon basin and Cerrado regions for maximum carbon offset.' },
];

const MOCK_MEMBERS = [
  { address: '0x7a23...f4d1', name: 'Elena Voss', role: 'Project Lead', reputation: 98, tasks: 12, completed: 11, votingPower: 100 },
  { address: '0x3b91...c2e8', name: 'Marcus Chen', role: 'Lead Engineer', reputation: 95, tasks: 8, completed: 8, votingPower: 85 },
  { address: '0x9f12...a7b3', name: 'Aria Nakamura', role: 'Architect', reputation: 92, tasks: 15, completed: 13, votingPower: 78 },
  { address: '0x1c45...d9e0', name: 'James Wright', role: 'Builder', reputation: 88, tasks: 20, completed: 16, votingPower: 65 },
  { address: '0x5d78...b1c4', name: 'Sarah Okonjo', role: 'Verifier', reputation: 96, tasks: 10, completed: 10, votingPower: 90 },
  { address: '0x2e67...f8a2', name: 'David Park', role: 'Builder', reputation: 82, tasks: 14, completed: 10, votingPower: 55 },
  { address: '0x8c34...e5b7', name: 'Luna Rivera', role: 'Analyst', reputation: 90, tasks: 9, completed: 8, votingPower: 72 },
  { address: '0x4f89...c3d6', name: 'Kai Andersen', role: 'Builder', reputation: 85, tasks: 18, completed: 14, votingPower: 60 },
];

const MOCK_COMPANIES = [
  { address: '0xABCD...1234', name: 'NovaTech Industries', status: 'Verified', reliability: 94, members: true, audited: true, credentials: 5 },
  { address: '0xEFGH...5678', name: 'Stellar Dynamics Corp', status: 'Verified', reliability: 91, members: true, audited: true, credentials: 3 },
  { address: '0xIJKL...9012', name: 'Quantum Forge Labs', status: 'Verified', reliability: 87, members: true, audited: false, credentials: 2 },
  { address: '0xMNOP...3456', name: 'BioSphere Systems', status: 'Pending', reliability: 0, members: false, audited: false, credentials: 0 },
  { address: '0xQRST...7890', name: 'DeepCore Mining', status: 'Verified', reliability: 78, members: true, audited: true, credentials: 4 },
  { address: '0xUVWX...2345', name: 'Helios Energy', status: 'Verified', reliability: 96, members: true, audited: true, credentials: 6 },
];

const MOCK_NFTS = [
  { id: 1, name: 'Foundation Module Blueprint', type: 'Infrastructure', project: 'Orbital Station Alpha', value: '50,000', owner: '0x7a23...f4d1', image: 'gradient-1' },
  { id: 2, name: 'Solar Array Schematics', type: 'Energy', project: 'Orbital Station Alpha', value: '75,000', owner: '0x3b91...c2e8', image: 'gradient-2' },
  { id: 3, name: 'Quantum Key Patent', type: 'IP', project: 'Quantum Network Bridge', value: '120,000', owner: '0x9f12...a7b3', image: 'gradient-3' },
  { id: 4, name: 'Carbon Credit Bundle #47', type: 'Environmental', project: 'Terra Reforestation DAO', value: '30,000', owner: '0x5d78...b1c4', image: 'gradient-4' },
  { id: 5, name: 'Habitat Ring Design', type: 'Architecture', project: 'Orbital Station Alpha', value: '95,000', owner: '0x7a23...f4d1', image: 'gradient-5' },
  { id: 6, name: 'Reforestation Zone Map', type: 'Environmental', project: 'Terra Reforestation DAO', value: '25,000', owner: '0x2e67...f8a2', image: 'gradient-6' },
];

const MOCK_TASKS = [
  { id: 1, milestoneId: 3, name: 'Structural integrity analysis', assignee: 'Marcus Chen', status: 'Completed', priority: 'High', progress: 100 },
  { id: 2, milestoneId: 3, name: 'Pressure seal testing', assignee: 'James Wright', status: 'In Progress', priority: 'Critical', progress: 75 },
  { id: 3, milestoneId: 3, name: 'Module docking alignment', assignee: 'Aria Nakamura', status: 'In Progress', priority: 'High', progress: 40 },
  { id: 4, milestoneId: 3, name: 'Internal wiring harness', assignee: 'David Park', status: 'Pending', priority: 'Medium', progress: 0 },
  { id: 5, milestoneId: 4, name: 'Air recycling unit install', assignee: 'Luna Rivera', status: 'Pending', priority: 'Critical', progress: 0 },
  { id: 6, milestoneId: 7, name: 'Protocol handshake testing', assignee: 'Kai Andersen', status: 'In Progress', priority: 'High', progress: 60 },
];

export function useAppState() {
  const [projects] = useState(MOCK_PROJECTS);
  const [milestones] = useState(MOCK_MILESTONES);
  const [proposals, setProposals] = useState(MOCK_PROPOSALS);
  const [members] = useState(MOCK_MEMBERS);
  const [companies] = useState(MOCK_COMPANIES);
  const [nfts] = useState(MOCK_NFTS);
  const [tasks] = useState(MOCK_TASKS);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');

  const connectWallet = useCallback(async () => {
    setWalletAddress('0x7a23...f4d1');
    setWalletConnected(true);
  }, []);

  const castVote = useCallback((proposalId, vote) => {
    setProposals(prev => prev.map(p => {
      if (p.id === proposalId) {
        return vote
          ? { ...p, yesVotes: p.yesVotes + 1 }
          : { ...p, noVotes: p.noVotes + 1 };
      }
      return p;
    }));
  }, []);

  return {
    projects, milestones, proposals, members, companies, nfts, tasks,
    walletConnected, walletAddress, connectWallet, castVote,
  };
}

export { AppContext };

export function AppProvider({ children }) {
  const state = useAppState();
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
