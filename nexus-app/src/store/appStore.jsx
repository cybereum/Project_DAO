/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { BrowserProvider, Contract, isAddress } from 'ethers';
import { PROJECT_DAO_ABI, PROJECT_DAO_ADDRESS, hasContractConfig } from '../config/contract';
import {
  MOCK_PROJECTS, MOCK_MILESTONES, MOCK_PROPOSALS, MOCK_MEMBERS,
  MOCK_COMPANIES, MOCK_NFTS, MOCK_TASKS,
} from './mockData';

const AppContext = createContext(null);

/** True when running without a configured contract (dev/demo mode). */
const USE_MOCK = !hasContractConfig();

/** Default timeout for on-chain transactions (ms). */
const TX_TIMEOUT_MS = 120_000;

/**
 * Wrap a tx.wait() promise with a timeout so the UI doesn't hang indefinitely.
 * Returns the receipt on success, or throws on timeout.
 */
function waitWithTimeout(txPromise, ms = TX_TIMEOUT_MS) {
  let timeoutId;
  let settled = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('Transaction timed out. It may still confirm — check your wallet.'));
    }, ms);
  });

  const wrappedTxPromise = txPromise.finally(() => {
    if (!settled) {
      settled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  });

  return Promise.race([wrappedTxPromise, timeoutPromise]);
}

export function useAppState() {
  const [projects, setProjects] = useState(USE_MOCK ? MOCK_PROJECTS : []);
  const [milestones] = useState(USE_MOCK ? MOCK_MILESTONES : []);
  const [proposals, setProposals] = useState(USE_MOCK ? MOCK_PROPOSALS : []);
  const [members] = useState(USE_MOCK ? MOCK_MEMBERS : []);
  const [companies, setCompanies] = useState(USE_MOCK ? MOCK_COMPANIES : []);
  const [nfts, setNfts] = useState(USE_MOCK ? MOCK_NFTS : []);
  const [tasks] = useState(USE_MOCK ? MOCK_TASKS : []);
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
    setDataLoadError('');
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

  const disconnectWallet = useCallback(() => {
    setWalletAddress('');
    setWalletConnected(false);
    setAgentProfile(null);
    setWalletError('');
    setDataLoadError('');
    setTxPending(false);
  }, []);

  // ─── Wallet event listeners (accountsChanged, chainChanged) ───────────────
  useEffect(() => {
    const ethereum = window?.ethereum;
    if (!ethereum || !walletConnected) return;

    const handleAccountsChanged = (accounts) => {
      if (!accounts || accounts.length === 0) {
        disconnectWallet();
      } else {
        const newAddress = accounts[0];
        setWalletAddress(newAddress);
      }
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [walletConnected, disconnectWallet]);

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
        await waitWithTimeout(tx.wait());
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

      const results = await Promise.allSettled(
        Array.from({ length: countNumber }, (_, i) => contract.getProposal(i + 1))
      );
      const chainProposals = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);

      setProposals(() => {
        // When chain data is available, replace all state (no mock merge).
        return chainProposals.map((proposalTuple, i) => {
          const proposalId = Number(proposalTuple.id ?? i + 1);
          const votingDeadline = Number(proposalTuple.votingDeadline ?? 0);
          const yesVotes = Number(proposalTuple.yesVotes ?? 0);
          const noVotes = Number(proposalTuple.noVotes ?? 0);
          const title = (proposalTuple.description || `On-chain Proposal #${proposalId}`).slice(0, 64);
          const status = proposalTuple.executed
            ? (proposalTuple.proposalPassed ? 'Passed' : 'Rejected')
            : 'Active';

          return {
            id: proposalId,
            title,
            description: proposalTuple.description || 'On-chain governance proposal.',
            status,
            yesVotes,
            noVotes,
            projectId: 1,
            author: 'On-chain',
            deadline: votingDeadline
              ? new Date(votingDeadline * 1000).toISOString().split('T')[0]
              : 'N/A',
          };
        }).sort((a, b) => a.id - b.id);
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

  const [dataLoadError, setDataLoadError] = useState('');
  const clearDataLoadError = useCallback(() => { setDataLoadError(''); }, []);
  const handleLoadError = useCallback((label, err) => {
    setDataLoadError(`Failed to load ${label}.`);
    console.error(`${label} failed:`, err);
  }, []);

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
    clearDataLoadError();
    try {
      const [feeBps, flatFee] = await Promise.all([
        contract.cybereumFeeBps(),
        contract.assetTransferFlatFeeWei(),
      ]);
      setAgentFeeBps(Number(feeBps));
      setAgentFlatFeeWei(flatFee.toString());
    } catch (err) { handleLoadError('fee config', err); }
  }, [getDaoReadContract, handleLoadError, clearDataLoadError]);

  const loadAgentProfile = useCallback(async () => {
    if (!walletAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    clearDataLoadError();
    try {
      const profile = await contract.getAgentProfile(walletAddress);
      setAgentProfile({
        registered: profile.registered,
        metadataURI: profile.metadataURI,
        nativeEscrowBalance: profile.nativeEscrowBalance.toString(),
      });
    } catch (err) { handleLoadError('agent profile', err); }
  }, [walletAddress, getDaoReadContract, handleLoadError, clearDataLoadError]);

  const agentRegister = useCallback(async (metadataURI) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return; }
    try {
      setTxPending(true);
      const tx = await contract.registerAgent(metadataURI);
      await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
    if (!isAddress(toAddress)) { setWalletError('Invalid recipient address.'); return null; }
    if (!amountWei || amountWei <= 0n) { setWalletError('Amount must be greater than zero.'); return null; }
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.transferNativeBetweenAgents(toAddress, amountWei, memo || '');
      const receipt = await waitWithTimeout(tx.wait());
      await loadAgentProfile();
      loadAgentActivity();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Transfer failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile, loadAgentActivity]);

  const agentCreatePaymentRequest = useCallback(async (payer, token, amount, isNative, description) => {
    setWalletError('');
    if (!isAddress(payer)) { setWalletError('Invalid payer address.'); return null; }
    if (!amount || amount <= 0n) { setWalletError('Amount must be greater than zero.'); return null; }
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.createAgentPaymentRequest(payer, token, amount, isNative, description);
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
      await loadAgentProfile();
      loadAgentActivity();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Settlement failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, loadAgentProfile, loadAgentActivity]);

  const agentLoadTokenBalance = useCallback(async (tokenAddress) => {
    if (!walletAddress || !tokenAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    clearDataLoadError();
    try {
      const bal = await contract.getAgentTokenBalance(walletAddress, tokenAddress);
      setAgentTokenBalances(prev => ({ ...prev, [tokenAddress.toLowerCase()]: bal.toString() }));
    } catch (err) { handleLoadError('token balance', err); }
  }, [walletAddress, getDaoReadContract, handleLoadError, clearDataLoadError]);

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
        contract.queryFilter(contract.filters.DirectMessageSent(null, walletAddress, null), baseFromBlock, latestBlock),
        contract.queryFilter(contract.filters.DirectMessageSent(null, null, walletAddress), baseFromBlock, latestBlock),
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
    } catch (err) {
      console.error('loadAgentActivity failed:', err);
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
      await agentLoadTokenBalance(tokenAddress);
      loadAgentActivity();
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Token transfer failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract, agentLoadTokenBalance, loadAgentActivity]);

  const agentTransferAsset = useCallback(async (assetContract, toAddress, tokenId, memo, flatFeeWei) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.transferAssetBetweenAgents(assetContract, toAddress, tokenId, memo || '', { value: flatFeeWei });
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
    clearDataLoadError();
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
    } catch (err) { handleLoadError('projects', err); }
    finally { setEconomicProjectsLoading(false); }
  }, [getDaoReadContract, handleLoadError, clearDataLoadError]);

  const createEconomicProject = useCallback(async (metadataURI, targetBudgetWei, deadlineTs) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.createEconomicProject(metadataURI, targetBudgetWei, deadlineTs);
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Refund failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  // ─── Direct messaging state ──────────────────────────────────────────────
  const [inbox, setInbox] = useState({ messages: [], total: 0 });
  const [inboxLoading, setInboxLoading] = useState(false);
  const [conversationMessages, setConversationMessages] = useState({ messages: [], total: 0 });
  const [conversationLoading, setConversationLoading] = useState(false);

  const hydrateMessages = useCallback(async (contract, messageIds) => {
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        try {
          const m = await contract.getDirectMessage(id);
          return {
            id: Number(m.id), sender: m.sender, recipient: m.recipient,
            contentHash: m.contentHash, encryptedContent: m.encryptedContent,
            timestamp: Number(m.timestamp), readByRecipient: m.readByRecipient,
          };
        } catch (err) { console.error('hydrateMessages failed:', err); return null; }
      })
    );
    return messages.filter(Boolean);
  }, []);

  const loadInbox = useCallback(async (offset = 0, limit = 50) => {
    if (!walletAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    clearDataLoadError();
    setInboxLoading(true);
    try {
      const [messageIds, total] = await contract.getInbox(offset, limit);
      const messages = await hydrateMessages(contract, messageIds);
      setInbox({ messages, total: Number(total) });
    } catch (err) { handleLoadError('inbox', err); setInbox({ messages: [], total: 0 }); }
    finally { setInboxLoading(false); }
  }, [walletAddress, getDaoReadContract, hydrateMessages, handleLoadError, clearDataLoadError]);

  const loadConversation = useCallback(async (otherAgent, offset = 0, limit = 50) => {
    if (!walletAddress) return;
    const contract = getDaoReadContract();
    if (!contract) return;
    clearDataLoadError();
    setConversationLoading(true);
    try {
      const [messageIds, total] = await contract.getConversation(otherAgent, offset, limit);
      const messages = await hydrateMessages(contract, messageIds);
      setConversationMessages({ messages, total: Number(total) });
    } catch (err) { handleLoadError('conversation', err); setConversationMessages({ messages: [], total: 0 }); }
    finally { setConversationLoading(false); }
  }, [walletAddress, getDaoReadContract, hydrateMessages, handleLoadError, clearDataLoadError]);

  const agentSendMessage = useCallback(async (toAddress, encryptedContent, contentHash) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.sendDirectMessage(toAddress, encryptedContent, contentHash);
      const receipt = await waitWithTimeout(tx.wait());
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Message send failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  const agentMarkMessageRead = useCallback(async (messageId) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.markMessageRead(messageId);
      const receipt = await waitWithTimeout(tx.wait());
      return receipt.hash;
    } catch (error) {
      setWalletError(error?.shortMessage || error?.message || 'Mark read failed.');
      return null;
    } finally {
      setTxPending(false);
    }
  }, [getDaoWriteContract]);

  // ─── Reputation state ──────────────────────────────────────────────────────
  const [reputationLeaderboard, setReputationLeaderboard] = useState([]);
  const [myReputation, setMyReputation] = useState(null);
  const [reputationLoading, setReputationLoading] = useState(false);
  const [reputationError, setReputationError] = useState('');

  const loadReputation = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) {
      setReputationLeaderboard([]);
      setMyReputation(null);
      setReputationError('');
      setReputationLoading(false);
      return;
    }
    clearDataLoadError();
    setReputationLoading(true);
    setReputationError('');
    try {
      const [agents_, scores, tiers, registered] = await contract.getReputationLeaderboard(0, 50);
      const entries = agents_.map((addr, i) => ({
        address: addr,
        score: Number(scores[i]),
        tier: Number(tiers[i]),
        registered: registered[i],
      })).filter(a => a.registered).sort((a, b) => b.score - a.score);
      setReputationLeaderboard(entries);

      if (walletAddress) {
        try {
          const r = await contract.getAgentReputation(walletAddress);
          setMyReputation({
            score: Number(r.score),
            tier: Number(r.tier),
            transactionCount: Number(r.transactionCount),
            lastActiveAt: Number(r.lastActiveAt),
            registeredAt: Number(r.registeredAt),
            messagingFeeDiscount: Number(r.messagingFeeDiscount),
          });
        } catch {
          setMyReputation(null);
        }
      } else {
        setMyReputation(null);
      }
    } catch (err) {
      setReputationError('Failed to load reputation data.');
      console.error('loadReputation failed:', err);
    }
    finally { setReputationLoading(false); }
  }, [getDaoReadContract, walletAddress, clearDataLoadError]);

  // ─── Commerce Blackhole state ─────────────────────────────────────────────
  const [commerceMetrics, setCommerceMetrics] = useState(null);
  const [agentCommerceMetrics, setAgentCommerceMetrics] = useState(null);
  const [commerceLoading, setCommerceLoading] = useState(false);
  const [commerceError, setCommerceError] = useState('');

  const loadCommerceMetrics = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) {
      setCommerceMetrics(null);
      setAgentCommerceMetrics(null);
      setCommerceError('');
      setCommerceLoading(false);
      return;
    }
    clearDataLoadError();
    setCommerceLoading(true);
    setCommerceError('');
    try {
      const m = await contract.getBlackholeMetrics();
      setCommerceMetrics({
        totalVolume: m._totalCommerceVolume,
        totalFees: m._totalFeesCollected,
        agentCount: Number(m._agentCount),
        feeBps: Number(m._feeBps),
        exitFeeBps: Number(m._exitFeeBps),
        messagingFee: m._messagingFeeWei,
        aiServiceFee: m._aiServiceFeeWei,
        assetFlatFee: m._assetTransferFlatFeeWei,
      });

      if (walletAddress) {
        const am = await contract.getAgentCommerceMetrics(walletAddress);
        setAgentCommerceMetrics({
          volume: am.volume,
          feesPaid: am.feesPaid,
          escrow: am.escrowBalance,
          registered: am.registered,
        });
      } else {
        setAgentCommerceMetrics(null);
      }
    } catch (err) {
      setCommerceError('Failed to load commerce metrics.');
      console.error('loadCommerceMetrics failed:', err);
    }
    finally { setCommerceLoading(false); }
  }, [getDaoReadContract, walletAddress, clearDataLoadError]);

  // ─── Feature Kit state ────────────────────────────────────────────────────
  const [featureKits, setFeatureKits] = useState([]);
  const [featureKitsLoading, setFeatureKitsLoading] = useState(false);

  const loadFeatureKits = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) return;
    clearDataLoadError();
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
    } catch (err) { handleLoadError('feature kits', err); }
    finally { setFeatureKitsLoading(false); }
  }, [getDaoReadContract, handleLoadError, clearDataLoadError]);

  const submitFeatureKit = useCallback(async (metadataURI, priority) => {
    setWalletError('');
    const contract = await getDaoWriteContract();
    if (!contract) { setWalletError('Wallet not connected or contract not configured.'); return null; }
    try {
      setTxPending(true);
      const tx = await contract.submitFeatureKit(metadataURI, priority);
      const receipt = await waitWithTimeout(tx.wait());
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
      const receipt = await waitWithTimeout(tx.wait());
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
    walletConnected, walletAddress, walletError, dataLoadError, txPending, syncingProposals,
    connectWallet, disconnectWallet, castVote, syncProposalsFromChain,
    addProject, addProposal, addCompany, addNft,
    getDaoReadContract, getDaoWriteContract,
    // agent economy
    agentProfile, agentPaymentRequests, agentFeeBps, agentFlatFeeWei,
    agentTokenBalances, agentActivity, agentActivityLoading,
    loadAgentConfig, loadAgentProfile, setAgentPaymentRequests,
    agentRegister, agentDepositNative, agentWithdrawNative, agentTransferNative,
    agentDepositToken, agentWithdrawToken, agentTransferToken, agentTransferAsset,
    agentLoadTokenBalance, loadAgentActivity,
    agentCreatePaymentRequest, agentSettlePaymentRequest, agentCancelPaymentRequest,
    // direct messaging
    inbox, inboxLoading, conversationMessages, conversationLoading,
    loadInbox, loadConversation, agentSendMessage, agentMarkMessageRead,
    // reputation
    reputationLeaderboard, myReputation, reputationLoading, reputationError, loadReputation,
    // commerce blackhole
    commerceMetrics, agentCommerceMetrics, commerceLoading, commerceError, loadCommerceMetrics,
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
    walletConnected, walletAddress, walletError, dataLoadError, txPending, syncingProposals,
    connectWallet, disconnectWallet, castVote, syncProposalsFromChain,
    addProject, addProposal, addCompany, addNft,
    getDaoReadContract, getDaoWriteContract,
    agentProfile, agentPaymentRequests, agentFeeBps, agentFlatFeeWei,
    agentTokenBalances, agentActivity, agentActivityLoading,
    loadAgentConfig, loadAgentProfile, setAgentPaymentRequests,
    agentRegister, agentDepositNative, agentWithdrawNative, agentTransferNative,
    agentDepositToken, agentWithdrawToken, agentTransferToken, agentTransferAsset,
    agentLoadTokenBalance, loadAgentActivity,
    agentCreatePaymentRequest, agentSettlePaymentRequest, agentCancelPaymentRequest,
    inbox, inboxLoading, conversationMessages, conversationLoading,
    loadInbox, loadConversation, agentSendMessage, agentMarkMessageRead,
    reputationLeaderboard, myReputation, reputationLoading, reputationError, loadReputation,
    commerceMetrics, agentCommerceMetrics, commerceLoading, commerceError, loadCommerceMetrics,
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

export { AppContext, waitWithTimeout };

export function AppProvider({ children }) {
  const state = useAppState();
  return <AppContext.Provider value={state}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
