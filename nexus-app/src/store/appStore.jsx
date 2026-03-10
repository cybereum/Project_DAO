/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { BrowserProvider, Contract, isAddress } from 'ethers';
import { PROJECT_DAO_ABI, PROJECT_DAO_ADDRESS, hasContractConfig } from '../config/contract';

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
  const [projects, setProjects] = useState(MOCK_PROJECTS);
  const [milestones] = useState(MOCK_MILESTONES);
  const [proposals, setProposals] = useState(MOCK_PROPOSALS);
  const [members] = useState(MOCK_MEMBERS);
  const [companies, setCompanies] = useState(MOCK_COMPANIES);
  const [nfts, setNfts] = useState(MOCK_NFTS);
  const [tasks] = useState(MOCK_TASKS);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [syncingProposals, setSyncingProposals] = useState(false);

  const getBrowserProvider = useCallback(() => {
    if (!window?.ethereum) return null;
    return new BrowserProvider(window.ethereum);
  }, []);

  const getDaoReadContract = useCallback(() => {
    if (!hasContractConfig() || !isAddress(PROJECT_DAO_ADDRESS)) return null;
    const provider = getBrowserProvider();
    if (!provider) return null;
    return new Contract(PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, provider);
  }, [getBrowserProvider]);

  const getDaoWriteContract = useCallback(async () => {
    if (!hasContractConfig() || !isAddress(PROJECT_DAO_ADDRESS)) return null;
    const provider = getBrowserProvider();
    if (!provider) return null;
    const signer = await provider.getSigner();
    return new Contract(PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, signer);
  }, [getBrowserProvider]);

  const connectWallet = useCallback(async () => {
    setWalletError('');
    const provider = getBrowserProvider();
    if (!provider) {
      setWalletError('No injected wallet found. Install MetaMask to enable on-chain actions.');
      return;
    }

    try {
      const accounts = await provider.send('eth_requestAccounts', []);
      const address = accounts?.[0] || '';
      if (!address) throw new Error('No account returned from wallet provider.');
      setWalletAddress(address);
      setWalletConnected(true);
    } catch (error) {
      setWalletError(error?.message || 'Wallet connection failed.');
      setWalletConnected(false);
    }
  }, [getBrowserProvider]);

  const castVote = useCallback(async (proposalId, vote) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    let voteCommittedOnChain = false;
    let txHash = null;

    if (contract) {
      try {
        setTxPending(true);
        const tx = await contract.vote(proposalId, vote);
        txHash = tx.hash;
        await tx.wait();
        voteCommittedOnChain = true;
      } catch (error) {
        setWalletError(error?.shortMessage || error?.message || 'On-chain vote failed.');
      } finally {
        setTxPending(false);
      }
    }

    if (!contract || voteCommittedOnChain) {
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return vote
            ? { ...p, yesVotes: p.yesVotes + 1 }
            : { ...p, noVotes: p.noVotes + 1 };
        }
        return p;
      }));

      return {
        ok: true,
        onChain: Boolean(contract),
        txHash,
      };
    }

    return {
      ok: false,
      onChain: true,
      txHash: null,
    };
  }, [getDaoWriteContract]);

  const syncProposalsFromChain = useCallback(async () => {
    setWalletError('');
    const contract = getDaoReadContract();
    if (!contract) {
      setWalletError('Contract not configured or browser provider unavailable. Add VITE_PROJECT_DAO_ADDRESS and ensure MetaMask or another Web3 provider is installed.');
      return;
    }

    try {
      setSyncingProposals(true);
      const count = await contract.getProposalCount();
      const countNumber = Number(count);
      if (!Number.isFinite(countNumber) || countNumber <= 0) return;

      const chainProposals = await Promise.all(
        Array.from({ length: countNumber }, (_, i) => contract.getProposal(i + 1))
      );

      setProposals((prev) => {
        const merged = [...prev];

        chainProposals.forEach((proposalTuple, i) => {
          const proposalId = Number(proposalTuple.id ?? i + 1);
          const votingDeadline = Number(proposalTuple.votingDeadline ?? 0);
          const yesVotes = Number(proposalTuple.yesVotes ?? 0);
          const noVotes = Number(proposalTuple.noVotes ?? 0);
          const existingIndex = merged.findIndex((p) => p.id === proposalId);
          const title = (proposalTuple.description || `On-chain Proposal #${proposalId}`).slice(0, 64);
          const status = proposalTuple.executed
            ? (proposalTuple.proposalPassed ? 'Passed' : 'Rejected')
            : 'Active';

          const hydrated = {
            id: proposalId,
            title,
            description: proposalTuple.description || 'On-chain governance proposal.',
            status,
            yesVotes,
            noVotes,
            projectId: merged[existingIndex]?.projectId || 1,
            author: merged[existingIndex]?.author || 'On-chain',
            deadline: votingDeadline
              ? new Date(votingDeadline * 1000).toISOString().split('T')[0]
              : merged[existingIndex]?.deadline || 'N/A',
          };

          if (existingIndex >= 0) {
            merged[existingIndex] = { ...merged[existingIndex], ...hydrated };
          } else {
            merged.push(hydrated);
          }
        });

        return merged.sort((a, b) => a.id - b.id);
      });
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Failed to sync proposals from chain.');
    } finally {
      setSyncingProposals(false);
    }
  }, [getDaoReadContract]);

  const addProject = useCallback((project) => {
    setProjects(prev => [...prev, { ...project, id: prev.length + 1, status: 'Pending', members: 1, milestones: 0, completedMilestones: 0, proposals: 0, tasks: 0, completedTasks: 0, progress: 0 }]);
  }, []);

  const addProposal = useCallback((proposal) => {
    setProposals(prev => [...prev, { ...proposal, id: prev.length + 1, status: 'Active', yesVotes: 0, noVotes: 0, author: walletAddress || '0x0000...0000' }]);
  }, [walletAddress]);

  const addCompany = useCallback((company) => {
    setCompanies(prev => [...prev, { ...company, status: 'Pending', reliability: 0, members: false, audited: false, credentials: 0 }]);
  }, []);

  const addNft = useCallback((nft) => {
    setNfts(prev => [...prev, { ...nft, id: prev.length + 1, owner: walletAddress || '0x0000...0000', image: `gradient-${(prev.length % 6) + 1}` }]);
  }, [walletAddress]);

  // ─── Agent economy state ───────────────────────────────────────────────────
  const [agentProfile, setAgentProfile] = useState(null);
  const [agentPaymentRequests, setAgentPaymentRequests] = useState([]);
  const [agentFeeBps, setAgentFeeBps] = useState(5);
  const [agentFlatFeeWei, setAgentFlatFeeWei] = useState('1000000000000');
  // token address → escrow balance (BigInt string)
  const [agentTokenBalances, setAgentTokenBalances] = useState({});
  const [agentActivity, setAgentActivity] = useState([]);
  const [agentActivityLoading, setAgentActivityLoading] = useState(false);
  const lastAgentActivityBlockRef = useRef(0);
  const lastAgentActivityWalletRef = useRef('');

  const loadAgentConfig = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) return;
    try {
      const [feeBps, flatFee] = await Promise.all([
        contract.cybereumFeeBps(),
        contract.assetTransferFlatFeeWei(),
      ]);
      setAgentFeeBps(Number(feeBps));
      setAgentFlatFeeWei(flatFee.toString());
    } catch { /* no-op if contract not configured */ }
  }, [getDaoReadContract]);

  const loadAgentProfile = useCallback(async () => {
    if (!walletAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    try {
      const profile = await contract.getAgentProfile(walletAddress);
      setAgentProfile({
        registered: profile.registered,
        metadataURI: profile.metadataURI,
        nativeEscrowBalance: profile.nativeEscrowBalance.toString(),
      });
    } catch { /* no-op */ }
  }, [walletAddress, getDaoReadContract]);

  const agentRegister = useCallback(async (metadataURI) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return; }
    try {
      setTxPending(true);
      const tx = await contract.registerAgent(metadataURI);
      await tx.wait();
      await loadAgentProfile();
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Agent registration failed.');
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  const agentDepositNative = useCallback(async (amountWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.depositNativeToEscrow({ value: amountWei });
      const receipt = await tx.wait();
      await loadAgentProfile();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Deposit failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  const agentWithdrawNative = useCallback(async (amountWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.withdrawNativeFromEscrow(amountWei);
      const receipt = await tx.wait();
      await loadAgentProfile();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Withdrawal failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  const agentTransferNative = useCallback(async (toAddress, amountWei, memo) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.transferNativeBetweenAgents(toAddress, amountWei, memo || '');
      const receipt = await tx.wait();
      await loadAgentProfile();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Transfer failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  const agentCreatePaymentRequest = useCallback(async (payer, token, amount, isNative, description) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.createAgentPaymentRequest(payer, token, amount, isNative, description);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Payment request creation failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const agentSettlePaymentRequest = useCallback(async (requestId, valueWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = valueWei
        ? await contract.settleAgentPaymentRequest(requestId, { value: valueWei })
        : await contract.settleAgentPaymentRequest(requestId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Settlement failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const agentLoadTokenBalance = useCallback(async (tokenAddress) => {
    if (!walletAddress || !tokenAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    try {
      const bal = await contract.agentTokenEscrowBalances(walletAddress, tokenAddress);
      setAgentTokenBalances(prev => ({ ...prev, [tokenAddress.toLowerCase()]: bal.toString() }));
    } catch { /* no-op */ }
  }, [walletAddress, getDaoReadContract]);

  const loadAgentActivity = useCallback(async ({ forceFull = false } = {}) => {
    if (!walletAddress) return;
    const contract = getDaoReadContract();
    if (!contract?.runner?.provider) return;

    setAgentActivityLoading(true);
    try {
      const provider = contract.runner.provider;
      const latestBlock = await provider.getBlockNumber();
      const walletChanged = lastAgentActivityWalletRef.current !== walletAddress;
      const shouldFullSync = forceFull || walletChanged || lastAgentActivityBlockRef.current === 0;
      const baseFromBlock = shouldFullSync
        ? (latestBlock > 8000 ? latestBlock - 8000 : 0)
        : Math.max(lastAgentActivityBlockRef.current - 2, 0);

      const activityResults = await Promise.allSettled([
        contract.queryFilter(contract.filters.AgentNativeEscrowDeposited(walletAddress), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentNativeEscrowWithdrawn(walletAddress), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentToAgentNativeTransfer(walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentToAgentNativeTransfer(null, walletAddress), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentToAgentTokenTransfer(walletAddress, null, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentToAgentTokenTransfer(null, walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentAssetTransfer(walletAddress, null, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentAssetTransfer(null, walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestCreated(null, walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestCreated(null, null, walletAddress), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestSettled(null, walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestSettled(null, null, walletAddress), baseFromBlock, latestBlock),
      ]);

      const activityChunks = activityResults
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

      const previous = shouldFullSync ? [] : agentActivity;

      const parsed = activityChunks
        .flat()
        .map((ev) => {
          const args = ev.args || [];
          return {
            key: `${ev.transactionHash}-${ev.index}`,
            name: ev.fragment?.name || 'UnknownEvent',
            blockNumber: ev.blockNumber,
            txHash: ev.transactionHash,
            from: args.from || args.agent || args.requester || args.payer || null,
            to: args.to || args.payer || args.requester || null,
            token: args.token || null,
            amount: args.amount?.toString?.() || null,
            requestId: args.requestId?.toString?.() || null,
            assetId: args.assetId?.toString?.() || null,
            memo: args.memo || args.description || null,
            logIndex: ev.index || 0,
          };
        })
        .sort((a, b) => (b.blockNumber - a.blockNumber) || (b.logIndex - a.logIndex));

      const seen = new Set();
      const deduped = [...parsed, ...previous].filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      });

      setAgentActivity(deduped.slice(0, 40));
      lastAgentActivityBlockRef.current = latestBlock;
      lastAgentActivityWalletRef.current = walletAddress;
    } catch {
      setAgentActivity([]);
    } finally {
      setAgentActivityLoading(false);
    }
  }, [walletAddress, getDaoReadContract, agentActivity]);

  const agentDepositToken = useCallback(async (tokenAddress, amountWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.depositTokenToEscrow(tokenAddress, amountWei);
      const receipt = await tx.wait();
      await agentLoadTokenBalance(tokenAddress);
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Token deposit failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, agentLoadTokenBalance]);

  const agentWithdrawToken = useCallback(async (tokenAddress, amountWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.withdrawTokenFromEscrow(tokenAddress, amountWei);
      const receipt = await tx.wait();
      await agentLoadTokenBalance(tokenAddress);
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Token withdrawal failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, agentLoadTokenBalance]);

  const agentTransferToken = useCallback(async (tokenAddress, toAddress, amountWei, memo) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.transferTokenBetweenAgents(tokenAddress, toAddress, amountWei, memo || '');
      const receipt = await tx.wait();
      await agentLoadTokenBalance(tokenAddress);
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Token transfer failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, agentLoadTokenBalance]);

  const agentTransferAsset = useCallback(async (assetContract, toAddress, tokenId, memo, flatFeeWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.transferAssetBetweenAgents(assetContract, toAddress, tokenId, memo || '', { value: flatFeeWei });
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Asset transfer failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const agentCancelPaymentRequest = useCallback(async (requestId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.cancelAgentPaymentRequest(requestId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Cancel failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  // ─── Open onboarding ──────────────────────────────────────────────────────
  const stakeAndJoin = useCallback(async (metadataURI, stakeWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.stakeAndJoin(metadataURI, { value: stakeWei });
      const receipt = await tx.wait();
      await loadAgentProfile();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Stake and join failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  const leaveDAO = useCallback(async () => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.leaveDAO();
      const receipt = await tx.wait();
      await loadAgentProfile();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Leave DAO failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile]);

  // ─── Economic Project state ───────────────────────────────────────────────
  const [economicProjects, setEconomicProjects] = useState([]);
  const [economicProjectsLoading, setEconomicProjectsLoading] = useState(false);

  const loadEconomicProjects = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) return;
    setEconomicProjectsLoading(true);
    try {
      const [page, total] = await contract.getEconomicProjects(0, 50);
      setEconomicProjects(
        page.map(p => ({
          id:               Number(p.id),
          proposer:         p.proposer,
          metadataURI:      p.metadataURI,
          targetBudget:     p.targetBudget.toString(),
          totalFunded:      p.totalFunded.toString(),
          deadline:         Number(p.deadline),
          status:           Number(p.status), // 0=Open,1=Active,2=Completed,3=Cancelled
          createdAt:        Number(p.createdAt),
          contributorCount: Number(p.contributorCount),
          funderCount:      Number(p.funderCount),
        }))
      );
      return Number(total);
    } catch { /* no-op if contract not configured */ }
    finally { setEconomicProjectsLoading(false); }
  }, [getDaoReadContract]);

  const createEconomicProject = useCallback(async (metadataURI, targetBudgetWei, deadlineTs) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.createEconomicProject(metadataURI, targetBudgetWei, deadlineTs);
      const receipt = await tx.wait();
      await loadEconomicProjects();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Project creation failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadEconomicProjects]);

  const fundEconomicProject = useCallback(async (projectId, amountWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.fundProject(projectId, { value: amountWei });
      const receipt = await tx.wait();
      await loadEconomicProjects();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Funding failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadEconomicProjects]);

  const applyToEconomicProject = useCallback(async (projectId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.applyToProject(projectId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Application failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const approveProjectContributor = useCallback(async (projectId, contributor, sharesBps) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.approveContributor(projectId, contributor, sharesBps);
      const receipt = await tx.wait();
      await loadEconomicProjects();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Approval failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadEconomicProjects]);

  const completeEconomicProject = useCallback(async (projectId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.completeProject(projectId);
      const receipt = await tx.wait();
      await loadEconomicProjects();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Completion failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadEconomicProjects]);

  const claimEconomicProjectShare = useCallback(async (projectId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.claimProjectShare(projectId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Claim failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const cancelEconomicProject = useCallback(async (projectId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.cancelProject(projectId);
      const receipt = await tx.wait();
      await loadEconomicProjects();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Cancellation failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadEconomicProjects]);

  const refundFromEconomicProject = useCallback(async (projectId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.refundProjectFunder(projectId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Refund failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  // ─── Feature Kit state ────────────────────────────────────────────────────
  const [featureKits, setFeatureKits] = useState([]);
  const [featureKitsLoading, setFeatureKitsLoading] = useState(false);

  const loadFeatureKits = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) return;
    setFeatureKitsLoading(true);
    try {
      const [page, total] = await contract.getFeatureKits(0, 100);
      setFeatureKits(
        page.map(k => ({
          id:          Number(k.id),
          submitter:   k.submitter,
          priority:    Number(k.priority),
          status:      Number(k.status),
          metadataURI: k.metadataURI,
          voteCount:   Number(k.voteCount),
          submittedAt: Number(k.submittedAt),
        }))
      );
      return Number(total);
    } catch { /* no-op if contract not configured */ }
    finally { setFeatureKitsLoading(false); }
  }, [getDaoReadContract]);

  const submitFeatureKit = useCallback(async (metadataURI, priority) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.submitFeatureKit(metadataURI, priority);
      const receipt = await tx.wait();
      await loadFeatureKits();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Feature kit submission failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadFeatureKits]);

  const upvoteFeatureKit = useCallback(async (kitId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.upvoteFeatureKit(kitId);
      const receipt = await tx.wait();
      await loadFeatureKits();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Upvote failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadFeatureKits]);

  const appState = useMemo(() => ({
    projects, milestones, proposals, members, companies, nfts, tasks,
    walletConnected, walletAddress, walletError, txPending, syncingProposals,
    connectWallet, castVote, syncProposalsFromChain,
    addProject, addProposal, addCompany, addNft,
    // agent economy
    agentProfile, agentPaymentRequests, agentFeeBps, agentFlatFeeWei,
    agentTokenBalances, agentActivity, agentActivityLoading,
    loadAgentConfig, loadAgentProfile, setAgentPaymentRequests,
    agentRegister, agentDepositNative, agentWithdrawNative, agentTransferNative,
    agentDepositToken, agentWithdrawToken, agentTransferToken, agentTransferAsset,
    agentLoadTokenBalance, loadAgentActivity,
    agentCreatePaymentRequest, agentSettlePaymentRequest, agentCancelPaymentRequest,
    // feature kits
    featureKits, featureKitsLoading,
    loadFeatureKits, submitFeatureKit, upvoteFeatureKit,
    // open onboarding
    stakeAndJoin, leaveDAO,
    // economic projects
    economicProjects, economicProjectsLoading,
    loadEconomicProjects, createEconomicProject, fundEconomicProject,
    applyToEconomicProject, approveProjectContributor,
    completeEconomicProject, claimEconomicProjectShare,
    cancelEconomicProject, refundFromEconomicProject,
  }), [
    projects, milestones, proposals, members, companies, nfts, tasks,
    walletConnected, walletAddress, walletError, txPending, syncingProposals,
    connectWallet, castVote, syncProposalsFromChain,
    addProject, addProposal, addCompany, addNft,
    agentProfile, agentPaymentRequests, agentFeeBps, agentFlatFeeWei,
    agentTokenBalances, agentActivity, agentActivityLoading,
    loadAgentConfig, loadAgentProfile, setAgentPaymentRequests,
    agentRegister, agentDepositNative, agentWithdrawNative, agentTransferNative,
    agentDepositToken, agentWithdrawToken, agentTransferToken, agentTransferAsset,
    agentLoadTokenBalance, loadAgentActivity,
    agentCreatePaymentRequest, agentSettlePaymentRequest, agentCancelPaymentRequest,
    featureKits, featureKitsLoading,
    loadFeatureKits, submitFeatureKit, upvoteFeatureKit,
    stakeAndJoin, leaveDAO,
    economicProjects, economicProjectsLoading,
    loadEconomicProjects, createEconomicProject, fundEconomicProject,
    applyToEconomicProject, approveProjectContributor,
    completeEconomicProject, claimEconomicProjectShare,
    cancelEconomicProject, refundFromEconomicProject,
  ]);

  return appState;
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
