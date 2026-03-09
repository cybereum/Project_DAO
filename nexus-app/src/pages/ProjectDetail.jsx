import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import { parseEther, formatEther } from 'ethers';
import {
  ArrowLeft, Users, Milestone, CheckCircle2, Clock, AlertTriangle,
  Plus, ChevronRight, Zap, Globe, UserPlus, Award, XCircle,
  RefreshCw, AlertCircle,
} from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const PROJECT_STATUS = ['Open', 'Active', 'Completed', 'Cancelled'];
const STATUS_BADGE = {
  'Completed':  'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  'In Progress':'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  'Pending':    'bg-nexus-text-dim/10 text-nexus-text-dim border-nexus-border',
  'Open':       'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
  'Active':     'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  'Cancelled':  'bg-nexus-pink/10 text-nexus-pink border-nexus-pink/20',
};
const PRIORITY_BADGE = {
  Critical: 'bg-red-900/20 text-red-400',
  High:     'bg-nexus-amber/10 text-nexus-amber',
  Medium:   'bg-nexus-cyan/10 text-nexus-cyan',
  Low:      'bg-nexus-green/10 text-nexus-green',
};

// ─── On-chain Project Detail ───────────────────────────────────────────────

function OnChainProjectDetail({ projectId }) {
  const {
    walletConnected, walletAddress, txPending, walletError,
    economicProjects, loadEconomicProjects,
    fundEconomicProject, applyToEconomicProject, approveProjectContributor,
    completeEconomicProject, claimEconomicProjectShare,
    cancelEconomicProject, refundFromEconomicProject,
    agentProfile,
  } = useApp();

  const [contributors, setContributors]   = useState([]);
  const [funders, setFunders]             = useState([]);
  const [loading, setLoading]             = useState(false);
  const [fundAmt, setFundAmt]             = useState('');
  const [approveAddr, setApproveAddr]     = useState('');
  const [approveShares, setApproveShares] = useState('');
  const [txHash, setTxHash]               = useState('');

  // Refresh project + side-data
  const refresh = useCallback(async () => {
    setLoading(true);
    await loadEconomicProjects();
    setLoading(false);
  }, [loadEconomicProjects]);

  useEffect(() => { refresh(); }, [refresh]);

  const project = economicProjects.find(p => p.id === projectId);

  if (!project) {
    return (
      <div className="text-center py-20 text-nexus-text-dim">
        {loading
          ? <RefreshCw size={24} className="mx-auto animate-spin mb-2" />
          : <span>On-chain project #{projectId} not found. <button onClick={refresh} className="underline text-nexus-cyan">Refresh</button></span>
        }
      </div>
    );
  }

  const meta = (() => {
    try { return JSON.parse(decodeURIComponent(project.metadataURI.replace('data:application/json,', ''))); }
    catch { return { name: `Project #${project.id}`, description: '' }; }
  })();

  const statusLabel = PROJECT_STATUS[project.status] || 'Open';
  const funded  = BigInt(project.totalFunded);
  const target  = BigInt(project.targetBudget);
  const fundPct = target > 0n ? Math.min(Number((funded * 100n) / target), 100) : 0;

  const isProposer    = walletAddress?.toLowerCase() === project.proposer?.toLowerCase();
  const isAgent       = agentProfile?.registered;
  const isOpen        = project.status === 0;
  const isActive      = project.status === 1;
  const isCompleted   = project.status === 2;
  const isCancelled   = project.status === 3;
  const canFund       = (isOpen || isActive) && walletConnected;
  const canApply      = (isOpen || isActive) && isAgent && !isProposer;
  const canComplete   = isProposer && (isOpen || isActive);
  const canCancel     = isProposer && (isOpen || isActive);
  const canClaim      = isCompleted && isAgent;

  const withHash = async (fn) => {
    const hash = await fn();
    if (hash) { setTxHash(hash); await refresh(); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/projects" className="p-2 rounded-lg hover:bg-white/5 text-nexus-text-dim hover:text-nexus-text transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full border border-nexus-amber/20 bg-nexus-amber/10 text-nexus-amber">On-chain</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[statusLabel]}`}>{statusLabel}</span>
            <span className="text-xs text-nexus-text-dim font-mono">#{project.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-glow-cyan mt-1">{meta.name}</h1>
          {meta.description && <p className="text-nexus-text-dim text-sm mt-1">{meta.description}</p>}
          <p className="text-xs text-nexus-text-dim mt-1">
            Proposed by <span className="font-mono text-nexus-text">{project.proposer}</span>
          </p>
        </div>
        <button onClick={refresh} disabled={loading} className="p-2 rounded-lg hover:bg-white/5 text-nexus-text-dim">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Tx confirmation */}
      {txHash && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-nexus-green text-sm">
          <CheckCircle2 size={16} />
          <span>Transaction confirmed: <span className="font-mono">{txHash.slice(0, 20)}…</span></span>
          <button className="ml-auto text-xs text-nexus-text-dim" onClick={() => setTxHash('')}>dismiss</button>
        </div>
      )}
      {walletError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-nexus-pink/10 border border-nexus-pink/20 text-nexus-pink text-sm">
          <AlertCircle size={16} /><span className="flex-1">{walletError}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Zap,       label: 'Total Funded',    value: `${formatEther(funded)} ETH`,  color: 'cyan' },
          { icon: Zap,       label: 'Target Budget',   value: `${formatEther(target)} ETH`,  color: 'amber' },
          { icon: Users,     label: 'Contributors',    value: project.contributorCount,       color: 'purple' },
          { icon: Globe,     label: 'Funders',         value: project.funderCount,            color: 'green' },
        ].map((s, i) => (
          <Motion.div key={s.label} {...anim(i)} className={`rounded-xl border border-nexus-${s.color}/20 bg-nexus-${s.color}/5 p-4`}>
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </Motion.div>
        ))}
      </div>

      {/* Funding bar */}
      <Motion.div {...anim(4)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Zap size={16} className="text-nexus-cyan" /> Funding Progress
        </h3>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-nexus-text-dim">{formatEther(funded)} ETH raised</span>
          <span className="text-nexus-cyan font-bold">{fundPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-nexus-border overflow-hidden mb-3">
          <div className="h-full rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-purple transition-all" style={{ width: `${fundPct}%` }} />
        </div>
        {project.deadline > 0 && (
          <p className="text-xs text-nexus-text-dim">
            Deadline: {new Date(project.deadline * 1000).toLocaleString()}
            {Date.now() / 1000 > project.deadline && <span className="text-nexus-pink ml-2">(expired)</span>}
          </p>
        )}
      </Motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Fund + Apply + Claim */}
        <div className="space-y-4">
          {/* Fund */}
          {canFund && (
            <Motion.div {...anim(5)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Zap size={16} className="text-nexus-cyan" /> Fund This Project
              </h3>
              <p className="text-xs text-nexus-text-dim mb-3">A ~0.05% protocol fee is deducted. Net ETH enters the pool.</p>
              <input
                type="number" min="0" step="0.001"
                value={fundAmt} onChange={e => setFundAmt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none mb-3"
                placeholder="0.5 ETH"
              />
              <button
                onClick={() => withHash(() => fundEconomicProject(project.id, parseEther(fundAmt || '0')))}
                disabled={txPending || !fundAmt}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {txPending ? 'Submitting…' : 'Fund Project'}
              </button>
            </Motion.div>
          )}

          {/* Apply */}
          {canApply && (
            <Motion.div {...anim(6)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <UserPlus size={16} className="text-nexus-purple" /> Apply to Contribute
              </h3>
              <p className="text-xs text-nexus-text-dim mb-3">Signal intent to contribute. The proposer can then assign you a revenue share.</p>
              <button
                onClick={() => withHash(() => applyToEconomicProject(project.id))}
                disabled={txPending}
                className="w-full py-2.5 rounded-lg bg-nexus-purple/20 text-nexus-purple border border-nexus-purple/30 text-sm font-medium hover:bg-nexus-purple/30 disabled:opacity-40 transition-colors"
              >
                {txPending ? 'Submitting…' : 'Apply Now'}
              </button>
            </Motion.div>
          )}

          {/* Claim */}
          {canClaim && (
            <Motion.div {...anim(7)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Award size={16} className="text-nexus-green" /> Claim Your Share
              </h3>
              <p className="text-xs text-nexus-text-dim mb-3">Project is complete. Claim your proportional share of the funding pool.</p>
              <button
                onClick={() => withHash(() => claimEconomicProjectShare(project.id))}
                disabled={txPending}
                className="w-full py-2.5 rounded-lg bg-nexus-green/20 text-nexus-green border border-nexus-green/30 text-sm font-medium hover:bg-nexus-green/30 disabled:opacity-40 transition-colors"
              >
                {txPending ? 'Claiming…' : 'Claim Share'}
              </button>
            </Motion.div>
          )}

          {/* Refund */}
          {isCancelled && walletConnected && (
            <Motion.div {...anim(8)} className="rounded-xl border border-nexus-pink/20 bg-nexus-pink/5 p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <XCircle size={16} className="text-nexus-pink" /> Project Cancelled
              </h3>
              <p className="text-xs text-nexus-text-dim mb-3">If you funded this project, you can reclaim your contribution.</p>
              <button
                onClick={() => withHash(() => refundFromEconomicProject(project.id))}
                disabled={txPending}
                className="w-full py-2.5 rounded-lg bg-nexus-pink/20 text-nexus-pink border border-nexus-pink/30 text-sm font-medium hover:bg-nexus-pink/30 disabled:opacity-40 transition-colors"
              >
                {txPending ? 'Processing…' : 'Reclaim Contribution'}
              </button>
            </Motion.div>
          )}
        </div>

        {/* Right: Contributors + Proposer Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contributors */}
          <Motion.div {...anim(9)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Users size={16} className="text-nexus-purple" /> Contributors ({project.contributorCount})
            </h3>
            {project.contributorCount === 0 ? (
              <p className="text-xs text-nexus-text-dim">No approved contributors yet. Apply to be first.</p>
            ) : (
              <p className="text-xs text-nexus-text-dim">Load contributors on-chain via the refresh button above.</p>
            )}

            {/* Proposer: approve contributor form */}
            {isProposer && (isOpen || isActive) && (
              <div className="mt-4 pt-4 border-t border-nexus-border/50 space-y-3">
                <p className="text-xs font-medium text-nexus-text">Approve a Contributor</p>
                <input
                  value={approveAddr} onChange={e => setApproveAddr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                  placeholder="0x contributor address"
                />
                <div className="flex gap-2">
                  <input
                    type="number" min="1" max="10000"
                    value={approveShares} onChange={e => setApproveShares(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                    placeholder="Share in bps (100 = 1%)"
                  />
                  <button
                    onClick={() => withHash(() => approveProjectContributor(project.id, approveAddr, parseInt(approveShares)))}
                    disabled={txPending || !approveAddr || !approveShares}
                    className="px-4 py-2 rounded-lg bg-nexus-purple/20 text-nexus-purple text-xs border border-nexus-purple/30 hover:bg-nexus-purple/30 disabled:opacity-40"
                  >
                    Approve
                  </button>
                </div>
                <p className="text-xs text-nexus-text-dim">Sum of all contributor shares must be ≤ 10 000 bps (100%).</p>
              </div>
            )}
          </Motion.div>

          {/* Proposer lifecycle actions */}
          {isProposer && (
            <Motion.div {...anim(10)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Globe size={16} className="text-nexus-amber" /> Proposer Controls
              </h3>
              <div className="flex gap-3 flex-wrap">
                {canComplete && (
                  <button
                    onClick={() => withHash(() => completeEconomicProject(project.id))}
                    disabled={txPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-green/20 text-nexus-green text-xs border border-nexus-green/30 hover:bg-nexus-green/30 disabled:opacity-40 transition-colors"
                  >
                    <CheckCircle2 size={14} /> Mark Complete
                  </button>
                )}
                {canCancel && (
                  <button
                    onClick={() => withHash(() => cancelEconomicProject(project.id))}
                    disabled={txPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-pink/20 text-nexus-pink text-xs border border-nexus-pink/30 hover:bg-nexus-pink/30 disabled:opacity-40 transition-colors"
                  >
                    <XCircle size={14} /> Cancel Project
                  </button>
                )}
              </div>
              <p className="text-xs text-nexus-text-dim mt-3">
                Marking complete unlocks contributor claims. Cancelling enables funder refunds.
              </p>
            </Motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Legacy Project Detail (unchanged) ───────────────────────────────────

function LegacyProjectDetail({ id }) {
  const { projects, milestones, tasks, members, proposals } = useApp();
  const project = projects.find(p => p.id === Number(id));
  if (!project) return <div className="text-nexus-text-dim">Project not found.</div>;

  const projMilestones = milestones.filter(m => m.projectId === project.id);
  const projProposals  = proposals.filter(p => p.projectId === project.id);
  const projTasks      = tasks.filter(t => projMilestones.some(m => m.id === t.milestoneId));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="p-2 rounded-lg hover:bg-white/5 text-nexus-text-dim hover:text-nexus-text transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">{project.name}</h1>
          <p className="text-nexus-text-dim text-sm">{project.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,       label: 'Members',    value: project.members,                              color: 'purple' },
          { icon: Milestone,   label: 'Milestones', value: `${project.completedMilestones}/${project.milestones}`, color: 'green' },
          { icon: CheckCircle2,label: 'Tasks Done', value: `${project.completedTasks}/${project.tasks}`, color: 'cyan' },
          { icon: Zap,         label: 'Budget',     value: `$${project.budget}`,                         color: 'amber' },
        ].map((s, i) => (
          <Motion.div key={s.label} {...anim(i)} className={`rounded-xl border border-nexus-${s.color}/20 bg-nexus-${s.color}/5 p-4`}>
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </Motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Motion.div {...anim(4)} className="lg:col-span-2 rounded-xl border border-nexus-border bg-nexus-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Milestone size={16} className="text-nexus-green" /> Milestones
            </h3>
            <button className="flex items-center gap-1 text-xs text-nexus-cyan hover:underline"><Plus size={12} /> Add</button>
          </div>
          <div className="space-y-3">
            {projMilestones.map(m => (
              <div key={m.id} className="p-4 rounded-lg bg-nexus-bg/50 border border-nexus-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {m.status === 'Completed'   ? <CheckCircle2 size={16} className="text-nexus-green" /> :
                     m.status === 'In Progress' ? <Clock size={16} className="text-nexus-cyan animate-pulse" /> :
                     <Clock size={16} className="text-nexus-text-dim" />}
                    <span className="text-sm font-medium">{m.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full bg-nexus-border overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${m.status === 'Completed' ? 'bg-nexus-green' : 'bg-gradient-to-r from-nexus-cyan to-nexus-purple'}`}
                      style={{ width: `${m.progress}%` }} />
                  </div>
                  <span className="text-xs font-mono text-nexus-text-dim">{m.progress}%</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-nexus-text-dim">
                  <span>Deadline: {m.deadline}</span>
                  <span>Amount: ${m.amount}</span>
                  <span>{m.contractors} contractors</span>
                </div>
              </div>
            ))}
          </div>
        </Motion.div>

        <div className="space-y-6">
          <Motion.div {...anim(5)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-nexus-amber" /> Active Proposals
            </h3>
            <div className="space-y-2">
              {projProposals.slice(0, 3).map(p => (
                <Link key={p.id} to="/proposals"
                  className="block p-3 rounded-lg bg-nexus-bg/50 border border-nexus-border/50 hover:border-nexus-cyan/30 transition-colors group">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate group-hover:text-nexus-cyan transition-colors">{p.title}</span>
                    <ChevronRight size={14} className="text-nexus-text-dim" />
                  </div>
                  <div className="text-xs text-nexus-text-dim mt-1">{p.yesVotes} yes / {p.noVotes} no</div>
                </Link>
              ))}
            </div>
          </Motion.div>

          <Motion.div {...anim(6)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Users size={16} className="text-nexus-purple" /> Team
            </h3>
            <div className="space-y-2">
              {members.slice(0, 5).map(m => (
                <div key={m.address} className="flex items-center gap-3 p-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-cyan/30 to-nexus-purple/30 flex items-center justify-center text-xs font-bold">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-nexus-text-dim">{m.role}</div>
                  </div>
                  <span className="text-xs text-nexus-green font-mono">{m.reputation}</span>
                </div>
              ))}
            </div>
          </Motion.div>
        </div>
      </div>

      <Motion.div {...anim(7)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-nexus-cyan" /> Task Board
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nexus-border text-nexus-text-dim text-xs">
                <th className="text-left pb-3 font-medium">Task</th>
                <th className="text-left pb-3 font-medium">Assignee</th>
                <th className="text-left pb-3 font-medium">Priority</th>
                <th className="text-left pb-3 font-medium">Status</th>
                <th className="text-left pb-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border/50">
              {projTasks.map(t => (
                <tr key={t.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-medium">{t.name}</td>
                  <td className="py-3 text-nexus-text-dim">{t.assignee}</td>
                  <td className="py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span></td>
                  <td className="py-3"><span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.status]}`}>{t.status}</span></td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-nexus-border overflow-hidden">
                        <div className="h-full rounded-full bg-nexus-cyan" style={{ width: `${t.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-nexus-text-dim">{t.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Motion.div>
    </div>
  );
}

// ─── Router: chain- prefix → on-chain, numeric → legacy ──────────────────

export default function ProjectDetail() {
  const { id } = useParams();
  if (id?.startsWith('chain-')) {
    return <OnChainProjectDetail projectId={Number(id.replace('chain-', ''))} />;
  }
  return <LegacyProjectDetail id={id} />;
}
