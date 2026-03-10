import { useMemo, useState } from 'react';
import { useApp } from '../store/appStore';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Vote, ThumbsUp, ThumbsDown, Clock, User, AlertTriangle, CheckCircle2, XCircle, Plus, RefreshCcw } from 'lucide-react';
import ShareProposal from '../components/ShareProposal';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const STATUS_CONFIG = {
  'Active': { bg: 'bg-nexus-cyan/10', text: 'text-nexus-cyan', border: 'border-nexus-cyan/20', icon: Clock },
  'Passed': { bg: 'bg-nexus-green/10', text: 'text-nexus-green', border: 'border-nexus-green/20', icon: CheckCircle2 },
  'Disputed': { bg: 'bg-nexus-amber/10', text: 'text-nexus-amber', border: 'border-nexus-amber/20', icon: AlertTriangle },
  'Rejected': { bg: 'bg-nexus-red/10', text: 'text-nexus-red', border: 'border-nexus-red/20', icon: XCircle },
};

export default function Proposals() {
  const {
    proposals, projects, castVote, walletConnected, walletError, txPending, addProposal,
    syncProposalsFromChain, syncingProposals,
  } = useApp();
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newProposal, setNewProposal] = useState({ title: '', description: '', projectId: projects[0]?.id || 1, votingDays: 7 });

  const [txFeedback, setTxFeedback] = useState(null);

  const txFeedbackTone = useMemo(() => {
    if (!txFeedback) return null;
    if (txFeedback.type === 'error') return 'border-nexus-red/30 bg-nexus-red/10 text-nexus-red';
    if (txFeedback.type === 'success') return 'border-nexus-green/30 bg-nexus-green/10 text-nexus-green';
    return 'border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan';
  }, [txFeedback]);

  const filtered = filter === 'All' ? proposals : proposals.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Governance Hub</h1>
          <p className="text-nexus-text-dim text-sm mt-1">Vote on proposals, resolve disputes, and shape project direction</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={syncProposalsFromChain}
            disabled={syncingProposals}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm font-medium hover:bg-white/5 disabled:opacity-50">
            <RefreshCcw size={16} className={syncingProposals ? 'animate-spin' : ''} />
            {syncingProposals ? 'Syncing...' : 'Sync On-chain'}
          </button>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90">
            <Plus size={16} /> New Proposal
          </button>
        </div>
      </div>


      {(txPending || walletError || txFeedback) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${walletError ? 'border-nexus-red/30 bg-nexus-red/10 text-nexus-red' : txFeedbackTone || 'border-nexus-border bg-nexus-card text-nexus-text-dim'}`}>
          {txPending && <p>Transaction pending in wallet / chain confirmation…</p>}
          {!txPending && walletError && <p>{walletError}</p>}
          {!txPending && !walletError && txFeedback && (
            <div className="space-y-1">
              <p>{txFeedback.message}</p>
              {txFeedback.txHash && (
                <p className="text-xs opacity-80 font-mono break-all">tx: {txFeedback.txHash}</p>
              )}
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-6">
          <h3 className="text-lg font-semibold mb-4">Submit New Proposal</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Title</label>
              <input value={newProposal.title} onChange={e => setNewProposal(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none" placeholder="Proposal title..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Description</label>
              <textarea value={newProposal.description} onChange={e => setNewProposal(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none h-24 resize-none" placeholder="Detailed description..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1.5">Project</label>
                <select value={newProposal.projectId} onChange={e => setNewProposal(p => ({ ...p, projectId: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text">
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1.5">Voting Period (days)</label>
                <input type="number" value={newProposal.votingDays} onChange={e => setNewProposal(p => ({ ...p, votingDays: parseInt(e.target.value) || 7 }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => {
                if (!newProposal.title.trim()) return;
                const deadline = new Date();
                deadline.setDate(deadline.getDate() + newProposal.votingDays);
                addProposal({ ...newProposal, deadline: deadline.toISOString().split('T')[0] });
                setTxFeedback({ type: 'info', message: 'Proposal submitted to local workspace state. On-chain proposal creation endpoint is not wired yet.' });
                setNewProposal({ title: '', description: '', projectId: projects[0]?.id || 1, votingDays: 7 });
                setShowCreate(false);
              }}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium">Submit Proposal</button>
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">Cancel</button>
            </div>
          </div>
        </Motion.div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {['All', 'Active', 'Passed', 'Disputed', 'Rejected'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/20' : 'text-nexus-text-dim hover:bg-white/5 border border-transparent'
            }`}>
            {s} {s !== 'All' && `(${proposals.filter(p => p.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((proposal, i) => {
          const total = proposal.yesVotes + proposal.noVotes;
          const yesPct = total > 0 ? Math.round((proposal.yesVotes / total) * 100) : 0;
          const noPct = total > 0 ? 100 - yesPct : 0;
          const config = STATUS_CONFIG[proposal.status];
          const StatusIcon = config?.icon || Clock;
          const project = projects.find(p => p.id === proposal.projectId);
          const isExpanded = expanded === proposal.id;

          return (
            <Motion.div key={proposal.id} {...anim(i)}
              className="rounded-xl border border-nexus-border bg-nexus-card overflow-hidden hover:border-nexus-cyan/20 transition-colors">
              <div className="p-5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : proposal.id)}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${config.bg} ${config.text} ${config.border}`}>
                        <StatusIcon size={10} />{proposal.status}
                      </span>
                      {project && <span className="text-xs text-nexus-text-dim">{project.name}</span>}
                    </div>
                    <h3 className="text-lg font-semibold">{proposal.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-nexus-cyan">{yesPct}%</div>
                    <div className="text-xs text-nexus-text-dim">approval</div>
                  </div>
                </div>

                <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-3">
                  <div className="bg-nexus-green rounded-l-full transition-all" style={{ width: `${yesPct}%` }} />
                  <div className="bg-nexus-red rounded-r-full transition-all" style={{ width: `${noPct}%` }} />
                  {total === 0 && <div className="bg-nexus-border w-full rounded-full" />}
                </div>

                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-6 text-xs text-nexus-text-dim">
                    <span className="flex items-center gap-1"><ThumbsUp size={12} className="text-nexus-green" /> {proposal.yesVotes} Yes</span>
                    <span className="flex items-center gap-1"><ThumbsDown size={12} className="text-nexus-red" /> {proposal.noVotes} No</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> Ends {proposal.deadline}</span>
                    <span className="flex items-center gap-1"><User size={12} /> {proposal.author}</span>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <ShareProposal proposal={proposal} />
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <Motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-nexus-border">
                    <div className="p-5">
                      <p className="text-sm text-nexus-text-dim mb-4">{proposal.description}</p>
                      {proposal.status === 'Active' && (
                        <div className="flex gap-3">
                          <button onClick={async (e) => { e.stopPropagation(); const result = await castVote(proposal.id, true); if (result?.ok) { setTxFeedback({ type: 'success', message: result.onChain ? 'Vote recorded on-chain.' : 'Vote recorded locally (demo mode).', txHash: result.txHash || null }); } else { setTxFeedback({ type: 'error', message: 'Vote failed. See error above.', txHash: null }); } }}
                            disabled={!walletConnected || txPending}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-nexus-green text-sm font-medium hover:bg-nexus-green/20 transition-colors disabled:opacity-50">
                            <ThumbsUp size={16} /> Vote Yes
                          </button>
                          <button onClick={async (e) => { e.stopPropagation(); const result = await castVote(proposal.id, false); if (result?.ok) { setTxFeedback({ type: 'success', message: result.onChain ? 'Vote recorded on-chain.' : 'Vote recorded locally (demo mode).', txHash: result.txHash || null }); } else { setTxFeedback({ type: 'error', message: 'Vote failed. See error above.', txHash: null }); } }}
                            disabled={!walletConnected || txPending}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexus-red/10 border border-nexus-red/20 text-nexus-red text-sm font-medium hover:bg-nexus-red/20 transition-colors disabled:opacity-50">
                            <ThumbsDown size={16} /> Vote No
                          </button>
                          {proposal.status === 'Active' && (
                            <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 text-nexus-amber text-sm font-medium hover:bg-nexus-amber/20 transition-colors">
                              <AlertTriangle size={16} /> Dispute
                            </button>
                          )}
                        </div>
                      )}
                      {!walletConnected && proposal.status === 'Active' && (
                        <p className="text-xs text-nexus-amber mt-2">Connect your wallet to vote</p>
                      )}
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </Motion.div>
          );
        })}
      </div>
    </div>
  );
}
