/**
 * FeatureKits.jsx — Agent Feature Kit Pipeline
 *
 * Agents submit desired feature requests (off-chain or on-chain).
 * NexusAI triages them: deduplication → scoring → ranked queue.
 * Members upvote to signal demand; top kits are promoted to proposals.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb, ArrowUp, Cpu, FlaskConical, Filter,
  Loader2, CheckCircle2, XCircle, Clock, Rocket,
  ChevronDown, ChevronUp, Bot, Sparkles, ListOrdered,
  Plus, Send, RefreshCw
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { nexusAI } from '../services/nexusAI';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_LABELS = ['Low', 'Medium', 'High', 'Critical'];
const PRIORITY_COLORS = [
  'text-slate-400 bg-slate-400/10 border-slate-400/20',
  'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'text-red-400 bg-red-400/10 border-red-400/20',
];

const STATUS_LABELS   = ['Pending', 'Validated', 'Queued', 'Rejected', 'Implemented'];
const STATUS_COLORS   = [
  'text-nexus-text-dim bg-white/5 border-white/10',
  'text-blue-400 bg-blue-400/10 border-blue-400/20',
  'text-nexus-cyan bg-nexus-cyan/10 border-nexus-cyan/20',
  'text-red-400 bg-red-400/10 border-red-400/20',
  'text-nexus-green bg-nexus-green/10 border-nexus-green/20',
];

const STATUS_ICONS = [Clock, CheckCircle2, Rocket, XCircle, CheckCircle2];

const RECOMMENDATION_COLORS = {
  'implement-now': 'text-nexus-green',
  'queue':         'text-nexus-cyan',
  'defer':         'text-amber-400',
  'reject':        'text-red-400',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, colorClass }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-mono ${colorClass}`}>
      {label}
    </span>
  );
}

function KitCard({ kit, onUpvote, loading }) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_ICONS[kit.status] ?? Clock;
  const priorityColor = PRIORITY_COLORS[kit.priority] ?? PRIORITY_COLORS[0];
  const statusColor   = STATUS_COLORS[kit.status]   ?? STATUS_COLORS[0];

  const shortAddress = kit.submitter
    ? `${kit.submitter.slice(0, 6)}…${kit.submitter.slice(-4)}`
    : 'Unknown';

  return (
    <Motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-nexus-surface border border-nexus-border rounded-xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Upvote button */}
          <button
            onClick={() => onUpvote(kit.id)}
            disabled={loading || kit.status === 3}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border border-nexus-border hover:border-nexus-cyan/40 hover:bg-nexus-cyan/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <ArrowUp size={14} className="text-nexus-cyan" />
            <span className="text-xs font-bold text-nexus-cyan font-mono">{kit.voteCount}</span>
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 items-center mb-1">
              <Badge label={PRIORITY_LABELS[kit.priority] ?? 'Low'} colorClass={priorityColor} />
              <Badge label={STATUS_LABELS[kit.status] ?? 'Pending'} colorClass={statusColor} />
              <span className="text-xs text-nexus-text-dim font-mono ml-auto">{shortAddress}</span>
            </div>

            <p className="text-sm font-medium text-nexus-text leading-snug mb-1">
              {kit.title || kit.metadataURI}
            </p>

            {kit.description && (
              <p className="text-xs text-nexus-text-dim line-clamp-2">{kit.description}</p>
            )}
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-nexus-text-dim hover:text-nexus-text transition-colors flex-shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && kit.rationale && (
            <Motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-nexus-border overflow-hidden"
            >
              <p className="text-xs text-nexus-text-dim">{kit.rationale}</p>
              {kit.submittedAt > 0 && (
                <p className="text-xs text-nexus-text-dim/50 mt-1">
                  Submitted {new Date(kit.submittedAt * 1000).toLocaleDateString()}
                </p>
              )}
            </Motion.div>
          )}
        </AnimatePresence>
      </div>
    </Motion.div>
  );
}

function TriageResultCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const recColor = RECOMMENDATION_COLORS[entry.recommendation] ?? 'text-nexus-text';

  return (
    <Motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-nexus-surface border border-nexus-border rounded-xl p-4"
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className="w-8 h-8 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-nexus-cyan font-mono">#{entry.rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge
              label={entry.priority?.toUpperCase() ?? 'MEDIUM'}
              colorClass={PRIORITY_COLORS[['low','medium','high','critical'].indexOf(entry.priority)] ?? PRIORITY_COLORS[1]}
            />
            <span className={`text-xs font-semibold ${recColor}`}>
              {entry.recommendation?.replace('-', ' ').toUpperCase()}
            </span>
            <span className="text-xs text-nexus-text-dim font-mono ml-auto">
              score: {entry.composite}
            </span>
          </div>

          <p className="text-sm font-medium text-nexus-text mb-1">{entry.title}</p>
          <p className="text-xs text-nexus-text-dim line-clamp-2">{entry.description}</p>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-nexus-text-dim hover:text-nexus-text transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <Motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t border-nexus-border overflow-hidden space-y-2"
          >
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <div className="text-nexus-text-dim">Impact</div>
                <div className="text-nexus-cyan font-bold font-mono">{entry.impact}/10</div>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <div className="text-nexus-text-dim">Feasibility</div>
                <div className="text-nexus-cyan font-bold font-mono">{entry.feasibility}/10</div>
              </div>
              <div className="bg-white/3 rounded-lg p-2 text-center">
                <div className="text-nexus-text-dim">Effort</div>
                <div className="text-nexus-cyan font-bold font-mono">{entry.effort}</div>
              </div>
            </div>
            {entry.rationale && (
              <p className="text-xs text-nexus-text-dim">{entry.rationale}</p>
            )}
            {entry.alreadyPlanned && (
              <div className="flex items-center gap-1 text-xs text-nexus-green">
                <CheckCircle2 size={12} />
                <span>Already tracked in implementation plan</span>
                {entry.planReference && <span className="text-nexus-text-dim">— {entry.planReference}</span>}
              </div>
            )}
            {entry.submitters?.length > 1 && (
              <p className="text-xs text-nexus-text-dim">
                Merged {entry.submitters.length} duplicate submissions
              </p>
            )}
          </Motion.div>
        )}
      </AnimatePresence>
    </Motion.div>
  );
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

function SubmitKitForm({ onSubmit, loading }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rationale, setRationale] = useState('');
  const [priority, setPriority] = useState(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    // Build a pseudo-IPFS URI from the data (in production: pin to IPFS first)
    const metadataURI = `data:application/json;base64,${btoa(JSON.stringify({
      title: title.trim(),
      description: description.trim(),
      rationale: rationale.trim(),
      effort: 'M',
    }))}`;
    await onSubmit(metadataURI, priority);
    setTitle(''); setDescription(''); setRationale(''); setPriority(1);
    setOpen(false);
  };

  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-nexus-cyan">
          <Plus size={16} />
          Submit a Feature Kit
        </div>
        {open ? <ChevronUp size={16} className="text-nexus-text-dim" /> : <ChevronDown size={16} className="text-nexus-text-dim" />}
      </button>

      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-nexus-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                <div className="md:col-span-2">
                  <label className="block text-xs text-nexus-text-dim mb-1">Title *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Short feature name"
                    className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-text-dim/50 focus:outline-none focus:border-nexus-cyan/50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-nexus-text-dim mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(Number(e.target.value))}
                    className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text focus:outline-none focus:border-nexus-cyan/50"
                  >
                    {PRIORITY_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-nexus-text-dim mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What should be built? How does it work?"
                  rows={3}
                  className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-text-dim/50 focus:outline-none focus:border-nexus-cyan/50 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-nexus-text-dim mb-1">Rationale</label>
                <textarea
                  value={rationale}
                  onChange={e => setRationale(e.target.value)}
                  placeholder="Why is this valuable to the protocol and agents?"
                  rows={2}
                  className="w-full bg-nexus-bg border border-nexus-border rounded-lg px-3 py-2 text-sm text-nexus-text placeholder-nexus-text-dim/50 focus:outline-none focus:border-nexus-cyan/50 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !title.trim() || !description.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Submit Kit
                </button>
              </div>
            </form>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'queue',  label: 'Queue',      icon: ListOrdered },
  { id: 'triage', label: 'AI Triage',  icon: Sparkles    },
  { id: 'submit', label: 'Submit',     icon: Lightbulb   },
];

const FILTER_OPTIONS = ['All', 'Pending', 'Validated', 'Queued', 'Rejected', 'Implemented'];

export default function FeatureKits() {
  const {
    featureKits: kits, featureKitsLoading,
    loadFeatureKits, submitFeatureKit, upvoteFeatureKit,
    walletConnected, txPending,
  } = useApp();

  const [tab, setTab] = useState('queue');
  const [filter, setFilter] = useState('All');

  // Triage state
  const [triageResult, setTriageResult] = useState(null);
  const [triageRunning, setTriageRunning] = useState(false);
  const [triageError, setTriageError] = useState('');

  // Hydrate kit titles/descriptions from inline data: URIs (fallback for kits without real IPFS)
  const hydrateKit = useCallback((kit) => {
    if (!kit.metadataURI) return kit;
    try {
      if (kit.metadataURI.startsWith('data:application/json;base64,')) {
        const json = JSON.parse(atob(kit.metadataURI.split(',')[1]));
        return { ...kit, ...json };
      }
    } catch { /* no-op */ }
    return kit;
  }, []);

  useEffect(() => { loadFeatureKits(); }, [loadFeatureKits]);

  const hydratedKits = kits.map(hydrateKit);

  const filteredKits = filter === 'All'
    ? hydratedKits
    : hydratedKits.filter(k => STATUS_LABELS[k.status] === filter);

  const sortedKits = [...filteredKits].sort((a, b) => b.voteCount - a.voteCount || b.submittedAt - a.submittedAt);

  // ── AI Triage ──
  const runTriage = useCallback(async () => {
    if (!hydratedKits.length) return;
    setTriageRunning(true);
    setTriageError('');
    setTriageResult(null);
    setTriageStream('');

    const kitsPayload = hydratedKits
      .filter(k => k.status <= 1)   // only pending + validated
      .map(k => ({
        id:          k.id,
        submitter:   k.submitter,
        title:       k.title       || k.metadataURI,
        description: k.description || '',
        rationale:   k.rationale   || '',
        priority:    PRIORITY_LABELS[k.priority] ?? 'medium',
        voteCount:   k.voteCount,
      }));

    if (!kitsPayload.length) {
      setTriageError('No pending or validated kits to triage.');
      setTriageRunning(false);
      return;
    }

    try {
      const result = await nexusAI.triage(kitsPayload);

      if (result?.error) {
        setTriageError(result.offline
          ? 'NexusAI server is offline. Run: cd nexus-ai-server && npm start'
          : result.error
        );
      } else if (result?.ranked) {
        setTriageResult(result);
      } else {
        setTriageError('Triage returned unexpected format. Check NexusAI server logs.');
      }
    } catch (err) {
      setTriageError(err.message || 'Triage failed.');
    } finally {
      setTriageRunning(false);
    }
  }, [hydratedKits]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text flex items-center gap-2">
            <Lightbulb className="text-nexus-cyan" size={26} />
            Feature Kit Pipeline
          </h1>
          <p className="text-sm text-nexus-text-dim mt-1">
            Agents submit desired features · NexusAI triages with impact × feasibility scoring · Community upvotes the best ideas
          </p>
        </div>
        <button
          onClick={loadFeatureKits}
          disabled={featureKitsLoading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-nexus-border hover:border-nexus-cyan/40 text-nexus-text-dim hover:text-nexus-cyan transition-all text-sm"
        >
          <RefreshCw size={14} className={featureKitsLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {kits.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Kits',  value: kits.length,                                  icon: Lightbulb,    color: 'text-nexus-cyan' },
            { label: 'Queued',      value: kits.filter(k => k.status === 2).length,       icon: Rocket,       color: 'text-nexus-cyan' },
            { label: 'Pending',     value: kits.filter(k => k.status === 0).length,       icon: Clock,        color: 'text-amber-400'  },
            { label: 'Implemented', value: kits.filter(k => k.status === 4).length,       icon: CheckCircle2, color: 'text-nexus-green' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-nexus-surface border border-nexus-border rounded-xl p-4 flex items-center gap-3">
              <Icon size={20} className={color} />
              <div>
                <div className="text-lg font-bold text-nexus-text font-mono">{value}</div>
                <div className="text-xs text-nexus-text-dim">{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-nexus-surface border border-nexus-border rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-nexus-cyan/15 text-nexus-cyan border border-nexus-cyan/20'
                : 'text-nexus-text-dim hover:text-nexus-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Queue tab ── */}
      {tab === 'queue' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-nexus-text-dim" />
            {FILTER_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setFilter(opt)}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  filter === opt
                    ? 'border-nexus-cyan/40 bg-nexus-cyan/10 text-nexus-cyan'
                    : 'border-nexus-border text-nexus-text-dim hover:border-nexus-cyan/20 hover:text-nexus-text'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {featureKitsLoading ? (
            <div className="flex items-center justify-center py-16 text-nexus-text-dim gap-2">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading feature kits from chain…</span>
            </div>
          ) : sortedKits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-nexus-text-dim gap-3">
              <Bot size={36} className="text-nexus-border" />
              <p className="text-sm">No kits yet. Be the first to submit one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {sortedKits.map(kit => (
                  <KitCard
                    key={kit.id}
                    kit={kit}
                    onUpvote={upvoteFeatureKit}
                    loading={txPending}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ── AI Triage tab ── */}
      {tab === 'triage' && (
        <div className="space-y-4">
          <div className="bg-nexus-surface border border-nexus-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-nexus-text flex items-center gap-2 mb-1">
                  <Cpu size={16} className="text-nexus-cyan" />
                  NexusAI Triage Engine
                </h3>
                <p className="text-xs text-nexus-text-dim max-w-lg">
                  Sends all pending feature kits to Claude claude-opus-4-6 with adaptive thinking.
                  AI detects duplicates, cross-checks the implementation plan, scores
                  impact × feasibility ÷ effort, and returns a ranked queue.
                </p>
              </div>
              <button
                onClick={runTriage}
                disabled={triageRunning || hydratedKits.filter(k => k.status <= 1).length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
              >
                {triageRunning
                  ? <><Loader2 size={14} className="animate-spin" /> Running…</>
                  : <><FlaskConical size={14} /> Run Triage</>
                }
              </button>
            </div>

            {/* Scoring legend */}
            <div className="flex flex-wrap gap-4 text-xs text-nexus-text-dim border-t border-nexus-border pt-3">
              <span>Composite = (impact × feasibility) ÷ effort</span>
              <span>Effort: S=1 · M=2 · L=4 · XL=8</span>
              <span>{hydratedKits.filter(k => k.status <= 1).length} kits eligible for triage</span>
            </div>
          </div>

          {triageError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
              {triageError}
            </div>
          )}

          {triageRunning && !triageResult && (
            <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4 flex items-center gap-3">
              <Cpu size={16} className="animate-pulse text-nexus-cyan flex-shrink-0" />
              <span className="text-sm text-nexus-text-dim">Claude is analysing feature kits…</span>
            </div>
          )}

          {triageResult && (
            <div className="space-y-4">
              <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4">
                <p className="text-sm text-nexus-text">{triageResult.summary}</p>
                <div className="flex gap-4 mt-2 text-xs text-nexus-text-dim">
                  <span>Total submitted: {triageResult.totalSubmitted}</span>
                  <span>Duplicates collapsed: {triageResult.duplicatesCollapsed}</span>
                </div>
              </div>
              <div className="space-y-3">
                <AnimatePresence>
                  {triageResult.ranked?.map(entry => (
                    <TriageResultCard key={entry.rank} entry={entry} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Submit tab ── */}
      {tab === 'submit' && (
        <div className="space-y-4">
          {!walletConnected && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400 flex items-center gap-2">
              <Bot size={16} />
              Connect your wallet to submit feature kits on-chain. Submissions require agent registration.
            </div>
          )}
          <SubmitKitForm onSubmit={submitFeatureKit} loading={txPending} />
          <div className="bg-nexus-surface border border-nexus-border rounded-xl p-4 text-xs text-nexus-text-dim space-y-2">
            <p className="font-semibold text-nexus-text text-sm">How it works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Submit your feature kit — metadata is stored (IPFS in production, inline for demo).</li>
              <li>Members upvote to signal demand; NexusAI triages the full queue.</li>
              <li>Top-ranked kits move to <strong>Queued</strong> status via governance or owner action.</li>
              <li>Queued kits are promoted to formal DAO proposals for implementation funding.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
