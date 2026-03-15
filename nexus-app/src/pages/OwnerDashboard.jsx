import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Lock, Shield, Wallet, RefreshCcw, Activity, TrendingUp, Vote, AlertTriangle } from 'lucide-react';
import { useApp } from '../store/appStore';

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

export default function OwnerDashboard() {
  const {
    walletConnected,
    walletAddress,
    connectWallet,
    proposals,
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

  const walletMatchesOwner = !OWNER_WALLET || walletAddress.toLowerCase() === OWNER_WALLET;

  useEffect(() => {
    if (!unlocked || !walletConnected || !walletMatchesOwner) return;
    loadAgentProfile();
    loadAgentActivity({ forceFull: true });
  }, [unlocked, walletConnected, walletMatchesOwner, loadAgentActivity, loadAgentProfile]);

  const txSummary = useMemo(() => {
    const recent = agentActivity.slice(0, 10);
    return {
      total: agentActivity.length,
      transfers: agentActivity.filter((t) => t.name?.includes('Transfer')).length,
      paymentRequests: agentActivity.filter((t) => t.name?.includes('PaymentRequest')).length,
      recent,
    };
  }, [agentActivity]);

  const governanceSummary = useMemo(() => {
    const active = proposals.filter((proposal) => proposal.status === 'Active').length;
    const disputed = proposals.filter((proposal) => proposal.status === 'Disputed').length;
    const completedMilestones = milestones.filter((milestone) => milestone.status === 'Completed').length;
    const activeProjects = projects.filter((project) => project.status === 'Active').length;

    return { active, disputed, completedMilestones, activeProjects };
  }, [projects, milestones, proposals]);

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
        <MetricCard icon={Activity} label="Tracked Transactions" value={txSummary.total} tone="cyan" />
        <MetricCard icon={TrendingUp} label="Transfers" value={txSummary.transfers} tone="green" />
        <MetricCard icon={Vote} label="Active Proposals" value={governanceSummary.active} tone="purple" />
        <MetricCard icon={AlertTriangle} label="Disputed Proposals" value={governanceSummary.disputed} tone="amber" />
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
    </div>
  );
}
