import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion as Motion } from 'framer-motion';
import { Lock, Shield, Wallet, RefreshCcw, Activity, TrendingUp, Vote, AlertTriangle, Settings, Users, Pause, Play } from 'lucide-react';
import { useApp } from '../store/appStore';
import { BrowserProvider, Contract, isAddress } from 'ethers';
import { PROJECT_DAO_ABI, PROJECT_DAO_ADDRESS, hasContractConfig } from '../config/contract';

const OWNER_PASSCODE = import.meta.env.VITE_OWNER_DASHBOARD_PASSCODE || '';
const OWNER_WALLET = (import.meta.env.VITE_OWNER_WALLET_ADDRESS || '').toLowerCase();
const SESSION_KEY = 'owner_dashboard_unlocked';

const eventLabels = {
  AgentNativeEscrowDeposited: 'Escrow deposit',
  AgentNativeEscrowWithdrawn: 'Escrow withdrawal',
  AgentToAgentNativeTransfer: 'Native transfer',
  AgentToAgentTokenTransfer: 'Token transfer',
  AgentAssetTransfer: 'Asset transfer',
  AgentPaymentRequestCreated: 'Payment request created',
  AgentPaymentRequestSettled: 'Payment request settled',
};

function MetricCard({ icon: Icon, label, value, tone = 'cyan' }) {
  const tones = {
    cyan: 'border-nexus-cyan/20 bg-nexus-cyan/10 text-nexus-cyan',
    green: 'border-nexus-green/20 bg-nexus-green/10 text-nexus-green',
    purple: 'border-nexus-purple/20 bg-nexus-purple/10 text-nexus-purple',
    amber: 'border-nexus-amber/20 bg-nexus-amber/10 text-nexus-amber',
  };

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <Icon size={16} />
      </div>
      <div className="text-2xl font-bold text-nexus-text">{value}</div>
    </div>
  );
}

function AdminPanel() {
  const [feeConfig, setFeeConfig] = useState({ feeBps: '', assetFeeWei: '' });
  const [treasuryAddr, setTreasuryAddr] = useState('');
  const [memberAddr, setMemberAddr] = useState('');
  const [memberPower, setMemberPower] = useState('100');
  const [removeMemberAddr, setRemoveMemberAddr] = useState('');
  const [adminStatus, setAdminStatus] = useState('');
  const [adminError, setAdminError] = useState('');
  const [currentTreasury, setCurrentTreasury] = useState('');
  const [currentFee, setCurrentFee] = useState({ feeBps: '5', assetFeeWei: '1000000000000' });

  const getWriteContract = useCallback(async () => {
    if (!hasContractConfig() || !isAddress(PROJECT_DAO_ADDRESS) || !window?.ethereum) return null;
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, signer);
  }, []);

  // Load current config
  useEffect(() => {
    if (!hasContractConfig() || !isAddress(PROJECT_DAO_ADDRESS) || !window?.ethereum) return;
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, provider);
    Promise.allSettled([
      contract.cybereumFeeBps(),
      contract.assetTransferFlatFeeWei(),
      contract.cybereumTreasury(),
    ]).then(([feeBps, assetFee, treasury]) => {
      if (feeBps.status === 'fulfilled') setCurrentFee(prev => ({ ...prev, feeBps: feeBps.value.toString() }));
      if (assetFee.status === 'fulfilled') setCurrentFee(prev => ({ ...prev, assetFeeWei: assetFee.value.toString() }));
      if (treasury.status === 'fulfilled') setCurrentTreasury(treasury.value);
    });
  }, []);

  const runAdminAction = async (label, fn) => {
    setAdminStatus('');
    setAdminError('');
    try {
      setAdminStatus(`${label}...`);
      const contract = await getWriteContract();
      if (!contract) { setAdminError('Contract not configured.'); return; }
      const tx = await fn(contract);
      await tx.wait();
      setAdminStatus(`${label} — confirmed.`);
    } catch (err) {
      setAdminError(err?.shortMessage || err?.message || `${label} failed.`);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Settings size={18} className="text-nexus-cyan" /> Contract Administration</h2>

      {adminStatus && <p className="text-xs text-nexus-green">{adminStatus}</p>}
      {adminError && <p className="text-xs text-red-400">{adminError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Config */}
        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Fee Configuration</h3>
          <p className="text-xs text-nexus-text-dim">Current: {currentFee.feeBps} bps, asset flat fee: {currentFee.assetFeeWei} wei</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-nexus-text-dim">Fee (bps, 1-100)</label>
              <input type="number" min="1" max="100" value={feeConfig.feeBps} onChange={(e) => setFeeConfig(prev => ({ ...prev, feeBps: e.target.value }))}
                className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm" placeholder="5" />
            </div>
            <div>
              <label className="text-xs text-nexus-text-dim">Asset flat fee (wei)</label>
              <input type="text" value={feeConfig.assetFeeWei} onChange={(e) => setFeeConfig(prev => ({ ...prev, assetFeeWei: e.target.value }))}
                className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm" placeholder="1000000000000" />
            </div>
          </div>
          <button onClick={() => {
            if (!feeConfig.feeBps || !feeConfig.assetFeeWei) { setAdminError('Both fee fields required.'); return; }
            if (confirm(`Update fee to ${feeConfig.feeBps} bps and asset fee to ${feeConfig.assetFeeWei} wei?`)) {
              runAdminAction('Updating fee config', (c) => c.setCybereumFeeConfig(parseInt(feeConfig.feeBps), BigInt(feeConfig.assetFeeWei)));
            }
          }} className="px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-xs text-nexus-cyan hover:bg-nexus-cyan/20">
            Update Fee Config
          </button>
        </div>

        {/* Treasury */}
        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5 space-y-3">
          <h3 className="text-sm font-semibold">Treasury Address</h3>
          <p className="text-xs text-nexus-text-dim font-mono">Current: {currentTreasury || 'loading...'}</p>
          <input type="text" value={treasuryAddr} onChange={(e) => setTreasuryAddr(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm font-mono" placeholder="0x..." />
          <button onClick={() => {
            if (!isAddress(treasuryAddr)) { setAdminError('Invalid treasury address.'); return; }
            if (confirm(`Set treasury to ${treasuryAddr}?`)) {
              runAdminAction('Setting treasury', (c) => c.setCybereumTreasury(treasuryAddr));
            }
          }} className="px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-xs text-nexus-cyan hover:bg-nexus-cyan/20">
            Set Treasury
          </button>
        </div>

        {/* Add Member */}
        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Users size={14} /> Add Member</h3>
          <input type="text" value={memberAddr} onChange={(e) => setMemberAddr(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm font-mono" placeholder="Member address (0x...)" />
          <input type="number" min="1" value={memberPower} onChange={(e) => setMemberPower(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm" placeholder="Voting power" />
          <button onClick={() => {
            if (!isAddress(memberAddr)) { setAdminError('Invalid member address.'); return; }
            runAdminAction('Adding member', (c) => c.addMember(memberAddr, parseInt(memberPower) || 100));
          }} className="px-3 py-1.5 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-xs text-nexus-green hover:bg-nexus-green/20">
            Add Member
          </button>
        </div>

        {/* Remove Member */}
        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Users size={14} /> Remove Member</h3>
          <input type="text" value={removeMemberAddr} onChange={(e) => setRemoveMemberAddr(e.target.value)}
            className="w-full px-2 py-1.5 rounded border border-nexus-border bg-nexus-bg text-sm font-mono" placeholder="Member address (0x...)" />
          <button onClick={() => {
            if (!isAddress(removeMemberAddr)) { setAdminError('Invalid address.'); return; }
            if (confirm(`Remove member ${removeMemberAddr}?`)) {
              runAdminAction('Removing member', (c) => c.removeMember(removeMemberAddr));
            }
          }} className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20">
            Remove Member
          </button>
        </div>
      </div>

      {/* Pause/Resume */}
      <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h3 className="text-sm font-semibold mb-3">Contract State</h3>
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (confirm('Pause the contract? All state-changing functions will be disabled.')) {
              runAdminAction('Pausing contract', (c) => c.pauseContract());
            }
          }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:bg-red-500/20">
            <Pause size={13} /> Pause Contract
          </button>
          <button onClick={() => {
            runAdminAction('Resuming contract', (c) => c.resumeContract());
          }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-xs text-nexus-green hover:bg-nexus-green/20">
            <Play size={13} /> Resume Contract
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OwnerDashboard() {
  const {
    walletConnected,
    walletAddress,
    connectWallet,
    projects,
    milestones,
    agentActivity,
    agentActivityLoading,
    loadAgentActivity,
    loadAgentProfile,
  } = useApp();

  const [passcodeInput, setPasscodeInput] = useState('');
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');

  const normalizedWalletAddress = (walletAddress || '').toLowerCase();
  const walletMatchesOwner = !OWNER_WALLET || normalizedWalletAddress === OWNER_WALLET;

  useEffect(() => {
    if (!unlocked || !walletConnected || !walletMatchesOwner) return;
    loadAgentProfile();
    loadAgentActivity({ forceFull: true });
  }, [unlocked, walletConnected, walletMatchesOwner, loadAgentActivity, loadAgentProfile]);

  const txSummary = useMemo(() => {
    const recent = agentActivity.slice(0, 10);
    const valueMovementEvents = new Set([
      'AgentNativeEscrowDeposited',
      'AgentNativeEscrowWithdrawn',
      'AgentToAgentNativeTransfer',
      'AgentToAgentTokenTransfer',
      'AgentAssetTransfer',
      'AgentPaymentRequestSettled',
    ]);

    const wallet = normalizedWalletAddress;
    const openRequests = new Set();
    const settledRequests = new Set();
    const counterparties = new Set();

    agentActivity.forEach((event) => {
      const from = event.from?.toLowerCase();
      const to = event.to?.toLowerCase();

      if (from && from !== wallet) counterparties.add(from);
      if (to && to !== wallet) counterparties.add(to);

      if (!event.requestId) return;
      if (event.name === 'AgentPaymentRequestCreated') {
        openRequests.add(event.requestId);
      }

      if (event.name === 'AgentPaymentRequestSettled') {
        settledRequests.add(event.requestId);
      }
    });

    settledRequests.forEach((requestId) => openRequests.delete(requestId));

    return {
      total: agentActivity.length,
      valueMovements: agentActivity.filter((event) => valueMovementEvents.has(event.name)).length,
      paymentRequests: agentActivity.filter((event) => event.name === 'AgentPaymentRequestCreated').length,
      openPaymentRequests: openRequests.size,
      counterparties: counterparties.size,
      recent,
    };
  }, [agentActivity, normalizedWalletAddress]);

  const governanceSummary = useMemo(() => {
    const completedMilestones = milestones.filter((milestone) => milestone.status === 'Completed').length;
    const activeProjects = projects.filter((project) => project.status === 'Active').length;

    return { completedMilestones, activeProjects };
  }, [projects, milestones]);

  const handleUnlock = (event) => {
    event.preventDefault();
    if (!OWNER_PASSCODE) {
      setError('Missing VITE_OWNER_DASHBOARD_PASSCODE. Set it in your .env file to enable private access.');
      return;
    }

    if (passcodeInput !== OWNER_PASSCODE) {
      setError('Invalid passcode.');
      return;
    }

    setError('');
    setUnlocked(true);
    sessionStorage.setItem(SESSION_KEY, 'true');
  };

  const lockDashboard = () => {
    setUnlocked(false);
    sessionStorage.removeItem(SESSION_KEY);
    setPasscodeInput('');
  };

  if (!unlocked) {
    return (
      <div className="max-w-lg mx-auto mt-10 rounded-2xl border border-nexus-border bg-nexus-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-nexus-cyan/10 flex items-center justify-center">
            <Lock size={18} className="text-nexus-cyan" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-glow-cyan">Private Owner Dashboard</h1>
            <p className="text-xs text-nexus-text-dim">Restricted access for your personal protocol telemetry.</p>
          </div>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <label className="block text-xs text-nexus-text-dim">Owner passcode</label>
          <input
            type="password"
            value={passcodeInput}
            onChange={(event) => setPasscodeInput(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-nexus-border bg-nexus-bg text-sm"
            placeholder="Enter your passcode"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90"
          >
            <Shield size={14} /> Unlock dashboard
          </button>
        </form>
      </div>
    );
  }

  if (!walletConnected) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-nexus-border bg-nexus-card p-6 space-y-3">
        <h1 className="text-xl font-bold text-glow-cyan">Owner Dashboard</h1>
        <p className="text-sm text-nexus-text-dim">Connect your wallet to view your transaction telemetry and metrics.</p>
        <button
          onClick={connectWallet}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium"
        >
          <Wallet size={14} /> Connect wallet
        </button>
      </div>
    );
  }

  if (!walletMatchesOwner) {
    return (
      <div className="max-w-xl mx-auto mt-10 rounded-2xl border border-red-500/20 bg-red-500/5 p-6 space-y-2">
        <h1 className="text-lg font-semibold text-red-300">Wallet not authorized</h1>
        <p className="text-sm text-red-200/80">
          Connected wallet <span className="font-mono">{walletAddress}</span> does not match owner wallet allowlist.
        </p>
        <p className="text-xs text-red-200/70">Set VITE_OWNER_WALLET_ADDRESS to your wallet address in .env.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Owner Dashboard</h1>
          <p className="text-sm text-nexus-text-dim">Private command center for your wallet activity, governance, and execution velocity.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAgentActivity({ forceFull: true })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-nexus-border hover:bg-white/5 text-xs"
          >
            <RefreshCcw size={13} /> Refresh
          </button>
          <button
            onClick={lockDashboard}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-nexus-border hover:bg-white/5 text-xs"
          >
            <Lock size={13} /> Lock
          </button>
        </div>
      </div>

      <Motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Activity} label="Tracked Events" value={txSummary.total} tone="cyan" />
        <MetricCard icon={TrendingUp} label="Value Movements" value={txSummary.valueMovements} tone="green" />
        <MetricCard icon={Vote} label="Open Payment Requests" value={txSummary.openPaymentRequests} tone="purple" />
        <MetricCard icon={AlertTriangle} label="Counterparties" value={txSummary.counterparties} tone="amber" />
      </Motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
          <h2 className="text-sm font-semibold mb-3">Execution Snapshot</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-nexus-text-dim">Active projects</span><strong>{governanceSummary.activeProjects}</strong></div>
            <div className="flex items-center justify-between"><span className="text-nexus-text-dim">Completed milestones</span><strong>{governanceSummary.completedMilestones}</strong></div>
            <div className="flex items-center justify-between"><span className="text-nexus-text-dim">Payment request events</span><strong>{txSummary.paymentRequests}</strong></div>
            <div className="flex items-center justify-between"><span className="text-nexus-text-dim">Wallet</span><strong className="font-mono text-xs">{walletAddress}</strong></div>
          </div>
        </div>

        <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
          <h2 className="text-sm font-semibold mb-3">Access controls</h2>
          <ul className="space-y-2 text-xs text-nexus-text-dim list-disc pl-4">
            <li>Passcode protected via <code>VITE_OWNER_DASHBOARD_PASSCODE</code>.</li>
            <li>Optional wallet allowlist via <code>VITE_OWNER_WALLET_ADDRESS</code>.</li>
            <li>Session lock stored locally and can be cleared with the <strong>Lock</strong> button.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h2 className="text-sm font-semibold mb-3">Recent Transaction Activity</h2>
        {agentActivityLoading ? (
          <p className="text-xs text-nexus-text-dim">Loading on-chain events...</p>
        ) : txSummary.recent.length === 0 ? (
          <p className="text-xs text-nexus-text-dim">No recent events found for this wallet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-nexus-text-dim border-b border-nexus-border">
                <tr>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Counterparty</th>
                  <th className="py-2 pr-4">Tx Hash</th>
                </tr>
              </thead>
              <tbody>
                {txSummary.recent.map((activity) => (
                  <tr key={activity.key} className="border-b border-nexus-border/50">
                    <td className="py-2 pr-4">{eventLabels[activity.name] || activity.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{activity.amount || '-'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{activity.to || activity.from || '-'}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-nexus-cyan">{activity.txHash?.slice(0, 10)}...{activity.txHash?.slice(-6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminPanel />
    </div>
  );
}
