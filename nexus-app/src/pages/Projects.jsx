import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import { parseEther, formatEther } from 'ethers';
import {
  FolderKanban, Users, Milestone, CheckCircle2, ArrowRight, Plus,
  Search, Filter, Zap, Globe, RefreshCw, AlertCircle, ExternalLink,
} from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const PROJECT_STATUS = ['Open', 'Active', 'Completed', 'Cancelled'];
const STATUS_COLORS = {
  Open:      'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
  Active:    'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  Completed: 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  Cancelled: 'bg-nexus-text-dim/10 text-nexus-text-dim border-nexus-border',
  Pending:   'bg-nexus-amber/10 text-nexus-amber',
};
const TYPE_COLORS = {
  Infrastructure: 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  Technology:     'bg-nexus-purple/10 text-nexus-purple border-nexus-purple/20',
  Environmental:  'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  Healthcare:     'bg-nexus-pink/10 text-nexus-pink border-nexus-pink/20',
  'On-chain':     'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20',
};

function FundingBar({ funded, target }) {
  const pct = target > 0n ? Number((funded * 100n) / target) : 0;
  const capped = Math.min(pct, 100);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-nexus-text-dim">Funded</span>
        <span className="text-nexus-cyan font-mono">
          {formatEther(funded)} / {formatEther(target)} ETH ({capped}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-nexus-border overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-purple transition-all"
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  );
}

export default function Projects() {
  const {
    projects, addProject,
    walletConnected, walletAddress, txPending, walletError,
    economicProjects, economicProjectsLoading,
    loadEconomicProjects, createEconomicProject, fundEconomicProject,
    agentProfile,
  } = useApp();

  const [search, setSearch]       = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab]             = useState('all'); // 'all' | 'onchain' | 'legacy'
  const [fundModal, setFundModal] = useState(null); // projectId
  const [fundAmt, setFundAmt]     = useState('');
  const [txHash, setTxHash]       = useState('');

  const [newProject, setNewProject] = useState({
    name: '', description: '', targetEth: '', deadlineDays: 30,
    onChain: true,
  });

  useEffect(() => { loadEconomicProjects(); }, [loadEconomicProjects]);

  // ─── Create handler ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newProject.name.trim()) return;

    if (newProject.onChain) {
      if (!walletConnected || !agentProfile?.registered) return;
      const targetWei = parseEther(newProject.targetEth || '0');
      const deadline  = Math.floor(Date.now() / 1000) + newProject.deadlineDays * 86400;
      // Simple metadata: encode as JSON string URI (production should use IPFS)
      const metaURI = `data:application/json,${encodeURIComponent(JSON.stringify({
        name: newProject.name,
        description: newProject.description,
      }))}`;
      const hash = await createEconomicProject(metaURI, targetWei, deadline);
      if (hash) {
        setTxHash(hash);
        setNewProject({ name: '', description: '', targetEth: '', deadlineDays: 30, onChain: true });
        setShowCreate(false);
      }
    } else {
      addProject({ name: newProject.name, type: 'Infrastructure', description: newProject.description, budget: newProject.targetEth || '0' });
      setNewProject({ name: '', description: '', targetEth: '', deadlineDays: 30, onChain: true });
      setShowCreate(false);
    }
  };

  // ─── Fund handler ─────────────────────────────────────────────────────────
  const handleFund = async () => {
    if (!fundModal || !fundAmt) return;
    try {
      const wei = parseEther(fundAmt);
      const hash = await fundEconomicProject(fundModal, wei);
      if (hash) { setTxHash(hash); setFundModal(null); setFundAmt(''); }
    } catch { /* parseEther error handled by UI */ }
  };

  // ─── Filtered lists ───────────────────────────────────────────────────────
  const filteredLegacy = projects.filter(p =>
    tab !== 'onchain' &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     (p.type || '').toLowerCase().includes(search.toLowerCase()))
  );

  const filteredOnChain = economicProjects.filter(p => {
    if (tab === 'legacy') return false;
    const name = (() => { try { return JSON.parse(decodeURIComponent(p.metadataURI.replace('data:application/json,', ''))).name; } catch { return p.metadataURI; } })();
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const isAgent = agentProfile?.registered;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Project Economy</h1>
          <p className="text-nexus-text-dim text-sm mt-1">
            Propose, fund and build projects across agents, orgs, and humans
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadEconomicProjects()}
            disabled={economicProjectsLoading}
            className="p-2 rounded-lg border border-nexus-border text-nexus-text-dim hover:bg-white/5 transition-colors"
            title="Refresh on-chain projects"
          >
            <RefreshCw size={15} className={economicProjectsLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Project
          </button>
        </div>
      </div>

      {/* Tx confirmation */}
      {txHash && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-nexus-green/10 border border-nexus-green/20 text-nexus-green text-sm">
          <CheckCircle2 size={16} />
          <span>Transaction confirmed: <span className="font-mono">{txHash.slice(0, 18)}…</span></span>
          <button className="ml-auto text-nexus-text-dim hover:text-nexus-text text-xs" onClick={() => setTxHash('')}>dismiss</button>
        </div>
      )}

      {/* Error */}
      {walletError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-nexus-pink/10 border border-nexus-pink/20 text-nexus-pink text-sm">
          <AlertCircle size={16} />
          <span className="flex-1">{walletError}</span>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe size={18} className="text-nexus-cyan" /> Propose New Project
          </h3>

          {/* On-chain toggle */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-nexus-bg/60 border border-nexus-border/50">
            <button
              onClick={() => setNewProject(p => ({ ...p, onChain: true }))}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${newProject.onChain ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30' : 'text-nexus-text-dim hover:text-nexus-text'}`}
            >
              On-chain (live economy)
            </button>
            <button
              onClick={() => setNewProject(p => ({ ...p, onChain: false }))}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${!newProject.onChain ? 'bg-nexus-purple/20 text-nexus-purple border border-nexus-purple/30' : 'text-nexus-text-dim hover:text-nexus-text'}`}
            >
              Local draft
            </button>
          </div>

          {newProject.onChain && !isAgent && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-nexus-amber/10 border border-nexus-amber/20 text-nexus-amber text-xs">
              You must be a registered agent to create on-chain projects. Register via Agent Economy or use Stake &amp; Join.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Project Name</label>
              <input
                value={newProject.name}
                onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                placeholder="e.g. Cross-chain AI Settlement Layer"
              />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Target Budget (ETH)</label>
              <input
                type="number" min="0" step="0.01"
                value={newProject.targetEth}
                onChange={e => setNewProject(p => ({ ...p, targetEth: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                placeholder="10"
              />
            </div>
            {newProject.onChain && (
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1.5">Deadline (days from now)</label>
                <input
                  type="number" min="1"
                  value={newProject.deadlineDays}
                  onChange={e => setNewProject(p => ({ ...p, deadlineDays: parseInt(e.target.value) || 30 }))}
                  className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                />
              </div>
            )}
            <div className={newProject.onChain ? '' : 'md:col-span-2'}>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Description</label>
              <textarea
                value={newProject.description}
                onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none h-20 resize-none"
                placeholder="What will this project build, and who can contribute?"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={handleCreate}
              disabled={txPending || (newProject.onChain && !isAgent) || !newProject.name.trim()}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {txPending ? 'Submitting…' : newProject.onChain ? 'Deploy On-chain' : 'Save Draft'}
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">
              Cancel
            </button>
          </div>
        </Motion.div>
      )}

      {/* Fund modal */}
      {fundModal !== null && (
        <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setFundModal(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-nexus-border bg-nexus-card p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold flex items-center gap-2"><Zap size={18} className="text-nexus-cyan" /> Fund Project #{fundModal}</h3>
            <p className="text-xs text-nexus-text-dim">A ~0.05% protocol fee is deducted. Net amount enters the project pool.</p>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Amount (ETH)</label>
              <input
                type="number" min="0" step="0.001"
                value={fundAmt} onChange={e => setFundAmt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
                placeholder="0.5"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleFund}
                disabled={txPending || !fundAmt}
                className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {txPending ? 'Submitting…' : 'Fund Project'}
              </button>
              <button onClick={() => { setFundModal(null); setFundAmt(''); }} className="px-4 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">
                Cancel
              </button>
            </div>
          </div>
        </Motion.div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-nexus-border overflow-hidden text-xs">
          {[['all', 'All'], ['onchain', 'On-chain'], ['legacy', 'Legacy']].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              className={`px-3 py-2 font-medium transition-colors ${tab === v ? 'bg-nexus-cyan/20 text-nexus-cyan' : 'text-nexus-text-dim hover:text-nexus-text hover:bg-white/5'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-dim" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-nexus-card border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
            placeholder="Search projects…" />
        </div>
        <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">
          <Filter size={14} /> Filter
        </button>
      </div>

      {/* On-chain projects */}
      {tab !== 'legacy' && (
        <>
          {filteredOnChain.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-nexus-cyan" />
                <span className="text-xs font-semibold text-nexus-cyan uppercase tracking-widest">On-chain Projects</span>
                <span className="text-xs text-nexus-text-dim">({filteredOnChain.length})</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredOnChain.map((p, i) => {
                  const meta = (() => { try { return JSON.parse(decodeURIComponent(p.metadataURI.replace('data:application/json,', ''))); } catch { return { name: p.metadataURI, description: '' }; } })();
                  const statusLabel = PROJECT_STATUS[p.status] || 'Open';
                  const funded = BigInt(p.totalFunded);
                  const target = BigInt(p.targetBudget);
                  const isProposer = walletAddress?.toLowerCase() === p.proposer?.toLowerCase();
                  return (
                    <Motion.div key={p.id} {...anim(i)}
                      className="rounded-xl border border-nexus-border bg-nexus-card p-5 hover:border-nexus-cyan/30 transition-all gradient-border">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS['On-chain']}`}>On-chain</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[statusLabel]}`}>{statusLabel}</span>
                            <span className="text-xs text-nexus-text-dim font-mono">#{p.id}</span>
                          </div>
                          <h3 className="text-base font-semibold truncate">{meta.name}</h3>
                        </div>
                        <Link to={`/projects/chain-${p.id}`} className="ml-2 shrink-0 text-nexus-text-dim hover:text-nexus-cyan transition-colors">
                          <ExternalLink size={16} />
                        </Link>
                      </div>
                      {meta.description && (
                        <p className="text-xs text-nexus-text-dim mb-3 line-clamp-2">{meta.description}</p>
                      )}
                      <FundingBar funded={funded} target={target} />
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-nexus-border/50 mb-3">
                        <div className="text-center">
                          <div className="text-sm font-semibold">{p.funderCount}</div>
                          <div className="text-xs text-nexus-text-dim">Funders</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold">{p.contributorCount}</div>
                          <div className="text-xs text-nexus-text-dim">Contributors</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold">{p.deadline ? new Date(p.deadline * 1000).toLocaleDateString() : '—'}</div>
                          <div className="text-xs text-nexus-text-dim">Deadline</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {(p.status === 0 || p.status === 1) && walletConnected && (
                          <button
                            onClick={() => setFundModal(p.id)}
                            className="flex-1 py-1.5 rounded-lg bg-nexus-cyan/10 text-nexus-cyan text-xs font-medium border border-nexus-cyan/20 hover:bg-nexus-cyan/20 transition-colors"
                          >
                            Fund
                          </button>
                        )}
                        <Link to={`/projects/chain-${p.id}`}
                          className="flex-1 py-1.5 rounded-lg bg-nexus-bg text-nexus-text-dim text-xs font-medium border border-nexus-border hover:border-nexus-cyan/30 hover:text-nexus-text transition-colors text-center"
                        >
                          Details
                        </Link>
                        {isProposer && (p.status === 0 || p.status === 1) && (
                          <Link to={`/projects/chain-${p.id}`}
                            className="flex-1 py-1.5 rounded-lg bg-nexus-purple/10 text-nexus-purple text-xs font-medium border border-nexus-purple/20 hover:bg-nexus-purple/20 transition-colors text-center"
                          >
                            Manage
                          </Link>
                        )}
                      </div>
                    </Motion.div>
                  );
                })}
              </div>
            </div>
          )}
          {tab === 'onchain' && filteredOnChain.length === 0 && !economicProjectsLoading && (
            <div className="text-center py-12 text-nexus-text-dim">
              <Globe size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No on-chain projects yet.</p>
              {isAgent && <p className="text-xs mt-1">Be the first to propose one above.</p>}
            </div>
          )}
        </>
      )}

      {/* Legacy mock projects */}
      {tab !== 'onchain' && filteredLegacy.length > 0 && (
        <div>
          {tab === 'all' && (
            <div className="flex items-center gap-2 mb-3">
              <FolderKanban size={14} className="text-nexus-purple" />
              <span className="text-xs font-semibold text-nexus-purple uppercase tracking-widest">Legacy Projects</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredLegacy.map((project, i) => (
              <Motion.div key={project.id} {...anim(i)}>
                <Link to={`/projects/${project.id}`}
                  className="block rounded-xl border border-nexus-border bg-nexus-card p-5 hover:border-nexus-cyan/30 transition-all group gradient-border">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[project.type] || ''}`}>{project.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status] || ''}`}>{project.status}</span>
                      </div>
                      <h3 className="text-base font-semibold group-hover:text-nexus-cyan transition-colors">{project.name}</h3>
                    </div>
                    <ArrowRight size={18} className="text-nexus-text-dim group-hover:text-nexus-cyan group-hover:translate-x-1 transition-all" />
                  </div>
                  <p className="text-xs text-nexus-text-dim mb-4 line-clamp-2">{project.description}</p>
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-nexus-text-dim">Progress</span>
                      <span className="text-nexus-cyan font-mono">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-nexus-border overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-purple transition-all" style={{ width: `${project.progress}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 pt-3 border-t border-nexus-border/50">
                    <div className="text-center">
                      <div className="text-sm font-semibold">{project.members}</div>
                      <div className="text-xs text-nexus-text-dim">Members</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold">{project.completedMilestones}/{project.milestones}</div>
                      <div className="text-xs text-nexus-text-dim">Milestones</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold">{project.completedTasks}/{project.tasks}</div>
                      <div className="text-xs text-nexus-text-dim">Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-semibold">${project.budget}</div>
                      <div className="text-xs text-nexus-text-dim">Budget</div>
                    </div>
                  </div>
                </Link>
              </Motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
