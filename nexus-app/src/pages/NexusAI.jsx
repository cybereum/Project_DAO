/**
 * NexusAI — Self-Improvement Engine
 *
 * Connects to the nexus-ai-server (Claude claude-opus-4-6 backend) and surfaces
 * AI-generated analysis of the codebase: health scans, security audits,
 * UX reviews, and growth analysis.
 *
 * Server: nexus-ai-server/server.js
 * Client: src/services/nexusAI.js
 * Env:    VITE_NEXUS_AI_URL (default http://localhost:3737)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Zap, Shield, Eye, TrendingUp, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Clock, FileText,
  ChevronDown, ChevronUp, ExternalLink, Sparkles, Server,
  Copy, Play, Lightbulb, SendHorizonal
} from 'lucide-react';
import { nexusAI } from '../services/nexusAI';
import { trackEvent } from '../lib/analytics';
import { useApp } from '../store/appStore';

// ─── Severity / priority colours ─────────────────────────────────────────

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high:     'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium:   'text-amber-400 bg-amber-400/10 border-amber-400/30',
  low:      'text-blue-400 bg-blue-400/10 border-blue-400/30',
  info:     'text-nexus-text-dim bg-white/5 border-nexus-border',
};

const CATEGORY_ICONS = {
  security:    Shield,
  ux:          Eye,
  feature:     Sparkles,
  performance: Zap,
  testing:     CheckCircle,
  docs:        FileText,
  default:     Brain,
};

// ─── Analysis modes metadata ──────────────────────────────────────────────

const MODES = [
  {
    id: 'health',
    label: 'Protocol Health',
    icon: Brain,
    description: 'Full codebase scan — security, features, UX, test gaps. Prioritised improvement list.',
    color: 'from-nexus-cyan to-nexus-purple',
  },
  {
    id: 'security',
    label: 'Security Audit',
    icon: Shield,
    description: 'Solidity contract audit against OWASP Smart Contract Top 10 and SWC Registry.',
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'ux',
    label: 'UX Review',
    icon: Eye,
    description: 'Agent Economy page analysis — accessibility, usability, missing error handling.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    id: 'feedback',
    label: 'Feedback Loop',
    icon: SendHorizonal,
    description: 'Blend human + AI feedback, filter noise, rank actions, and learn from outcomes.',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    id: 'growth',
    label: 'Growth Analysis',
    icon: TrendingUp,
    description: 'Marketing pages and tracking audit — conversion, copy, CTAs, funnel gaps.',
    color: 'from-green-500 to-emerald-500',
  },
];

// ─── Small components ─────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
}

function ScoreRing({ score, label }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = ((score ?? 0) / 100) * circ;
  const color = score >= 70 ? '#22d3ee' : score >= 40 ? '#fb923c' : '#f87171';
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} stroke="#1e293b" strokeWidth="8" fill="none" />
        <circle cx="40" cy="40" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" />
        <text x="40" y="46" textAnchor="middle" fill={color} fontSize="18" fontWeight="bold">{score ?? '—'}</text>
      </svg>
      <span className="text-xs text-nexus-text-dim">{label}</span>
    </div>
  );
}

function SuggestionCard({ item, onApply, applying, onSubmitKit, submittingKit }) {
  const [open, setOpen] = useState(false);
  const [kitSubmitted, setKitSubmitted] = useState(false);
  const Icon = CATEGORY_ICONS[item.category] || CATEGORY_ICONS.default;
  const severity = item.priority || item.severity || 'low';
  const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.low;

  const handleSubmitKit = async () => {
    if (!onSubmitKit) return;
    const metadataURI = `data:application/json;base64,${btoa(JSON.stringify({
      title: item.title || 'NexusAI Finding',
      description: item.description || '',
      rationale: item.recommendation || item.fix || '',
      source: 'nexus-ai',
      category: item.category,
      effort: item.effort,
    }))}`;
    const priorityMap = { critical: 3, high: 2, medium: 1, low: 0 };
    const priority = priorityMap[severity] ?? 1;
    const hash = await onSubmitKit(metadataURI, priority);
    if (hash) setKitSubmitted(true);
  };

  return (
    <div className={`rounded-xl border p-4 space-y-2 ${color}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Icon size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm leading-snug">{item.title || item.finding || 'Finding'}</div>
            {(item.file || item.line) && (
              <div className="text-xs opacity-70 font-mono mt-0.5">
                {item.file}{item.line ? `:${item.line}` : ''}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.effort && <span className="text-xs opacity-60">{item.effort}</span>}
          <Badge label={severity} color={color} />
          <button onClick={() => setOpen(o => !o)} className="opacity-60 hover:opacity-100">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              {item.description && (
                <p className="text-xs opacity-80 leading-relaxed">{item.description}</p>
              )}
              {(item.recommendation || item.fix) && (
                <div className="text-xs p-2 rounded bg-black/20">
                  <span className="font-semibold">Fix: </span>{item.recommendation || item.fix}
                </div>
              )}
              {item.patch && (
                <div className="space-y-1">
                  <pre className="text-xs font-mono bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">
                    {item.patch}
                  </pre>
                  {onApply && item.file && (
                    <button
                      disabled={applying}
                      onClick={() => onApply(item.file, item.patch)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-nexus-cyan/10 hover:bg-nexus-cyan/20 text-nexus-cyan transition-colors disabled:opacity-50"
                    >
                      {applying ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
                      Apply patch
                    </button>
                  )}
                </div>
              )}

              {/* Submit to Feature Kit Pipeline */}
              {onSubmitKit && (severity === 'critical' || severity === 'high' || severity === 'medium') && (
                <div className="pt-1 border-t border-white/10">
                  {kitSubmitted ? (
                    <div className="flex items-center gap-1.5 text-xs text-nexus-green">
                      <CheckCircle size={11} />
                      Submitted to Feature Kit pipeline
                    </div>
                  ) : (
                    <button
                      disabled={submittingKit}
                      onClick={handleSubmitKit}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 transition-colors disabled:opacity-50"
                    >
                      <Lightbulb size={11} />
                      Submit as Feature Kit
                    </button>
                  )}
                </div>
              )}
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function NexusAI() {
  const { submitFeatureKit, txPending } = useApp();
  const [serverOk, setServerOk] = useState(null); // null=checking, true, false
  const [activeMode, setActiveMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [applyingPatch, setApplyingPatch] = useState(false);
  const [feedbackForm, setFeedbackForm] = useState({
    sourceType: 'human',
    title: '',
    description: '',
    category: 'ux',
    severity: 'medium',
    confidence: 0.8,
  });
  const [feedbackSubmitMsg, setFeedbackSubmitMsg] = useState('');
  const [feedbackInsights, setFeedbackInsights] = useState(null);
  const streamRef = useRef('');

  // Check server reachability on mount
  useEffect(() => {
    nexusAI.ping().then(r => setServerOk(!!r?.ok));
  }, []);

  const refreshFeedbackInsights = useCallback(async () => {
    const insight = await nexusAI.getFeedbackInsights();
    if (!insight?.error) setFeedbackInsights(insight);
  }, []);

  useEffect(() => {
    refreshFeedbackInsights();
  }, [refreshFeedbackInsights]);

  const runAnalysis = useCallback(async (mode) => {
    setActiveMode(mode);
    setLoading(true);
    setResult(null);
    setError('');
    setStreamText('');
    streamRef.current = '';
    trackEvent('nexus_ai_analyse', { mode });

    // Use streaming so the user sees tokens as they arrive
    const raw = await nexusAI.analyseStream(mode, (chunk) => {
      streamRef.current += chunk;
      setStreamText(streamRef.current);
    });

    setLoading(false);

    if (!raw) {
      setError('Empty response from NexusAI server.');
      return;
    }

    try {
      setResult(JSON.parse(raw));
    } catch {
      // Not valid JSON — show raw (happens if server error leaked into stream)
      setResult({ raw });
    }
  }, []);

  const submitFeedback = useCallback(async (e) => {
    e.preventDefault();
    setFeedbackSubmitMsg('');
    const res = await nexusAI.submitFeedback(feedbackForm);
    if (res?.error) {
      setFeedbackSubmitMsg(`Failed: ${res.error}`);
      return;
    }
    setFeedbackSubmitMsg('Feedback saved and ranked.');
    setFeedbackForm((prev) => ({ ...prev, title: '', description: '' }));
    setFeedbackInsights(res.insights || null);
  }, [feedbackForm]);

  const recordOutcome = useCallback(async (id, outcome) => {
    const res = await nexusAI.recordFeedbackOutcome(id, outcome);
    if (!res?.error && res?.insights) {
      setFeedbackInsights(res.insights);
    }
  }, []);

  const applyPatch = useCallback(async (filePath, patch) => {
    if (!confirm(`Apply this patch to ${filePath}?\n\nThis modifies the file on disk. Make sure you have a clean git state.`)) return;
    setApplyingPatch(true);
    const res = await nexusAI.applySuggestion(filePath, patch);
    setApplyingPatch(false);
    if (res.error) {
      alert(`Patch failed: ${res.error}`);
    } else {
      alert(`Patch applied to ${filePath}. Refresh your dev server to see changes.`);
      trackEvent('nexus_ai_patch_applied', { filePath });
    }
  }, []);

  // ── Helpers to render result by mode ───────────────────────────────────

  function renderHealthResult(r) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing score={r.score} label="Health score" />
          <p className="flex-1 text-sm text-nexus-text-dim leading-relaxed">{r.summary}</p>
        </div>

        {r.suggestions?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles size={14} className="text-nexus-cyan" /> Suggestions ({r.suggestions.length})
            </h3>
            {r.suggestions.map(s => (
              <SuggestionCard key={s.id || s.title} item={s} onApply={applyPatch} applying={applyingPatch} onSubmitKit={submitFeatureKit} submittingKit={txPending} />
            ))}
          </div>
        )}

        {r.planGaps?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock size={14} className="text-amber-400" /> Plan gaps ({r.planGaps.length})
            </h3>
            <ul className="space-y-1">
              {r.planGaps.map((g, i) => (
                <li key={i} className="text-xs text-nexus-text-dim flex gap-2">
                  <XCircle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />{g}
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.newIdeas?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain size={14} className="text-nexus-purple" /> New ideas ({r.newIdeas.length})
            </h3>
            <ul className="space-y-1">
              {r.newIdeas.map((idea, i) => (
                <li key={i} className="text-xs text-nexus-text-dim flex gap-2">
                  <CheckCircle size={12} className="text-nexus-purple flex-shrink-0 mt-0.5" />{idea}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderSecurityResult(r) {
    const riskColor = { critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-green-400' };
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Shield size={28} className={riskColor[r.riskLevel] || 'text-nexus-text-dim'} />
          <div>
            <div className={`text-lg font-bold capitalize ${riskColor[r.riskLevel]}`}>{r.riskLevel} risk</div>
            <p className="text-sm text-nexus-text-dim">{r.summary}</p>
          </div>
        </div>
        {r.findings?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Findings ({r.findings.length})</h3>
            {r.findings.map((f, i) => (
              <SuggestionCard key={i} item={{ ...f, category: 'security' }} onApply={applyPatch} applying={applyingPatch} onSubmitKit={submitFeatureKit} submittingKit={txPending} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderUXResult(r) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-nexus-text-dim">{r.summary}</p>
        {r.issues?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Issues ({r.issues.length})</h3>
            {r.issues.map((issue, i) => (
              <SuggestionCard key={i} item={{ ...issue, category: issue.type || 'ux', priority: issue.severity }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderGrowthResult(r) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing score={r.conversionScore} label="Conversion score" />
          <p className="flex-1 text-sm text-nexus-text-dim leading-relaxed">{r.summary}</p>
        </div>
        {r.suggestions?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Growth suggestions ({r.suggestions.length})</h3>
            {r.suggestions.map((s, i) => (
              <SuggestionCard key={i} item={{ ...s, category: s.area || 'growth', priority: s.priority }} />
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderFeedbackResult(r) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-nexus-text-dim">{r.summary}</p>
        {r.topActions?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Top actions ({r.topActions.length})</h3>
            {r.topActions.map((action, i) => (
              <div key={i} className="rounded-xl border border-nexus-border p-3 bg-nexus-bg/50">
                <div className="text-sm font-medium">#{action.rank} {action.title}</div>
                <div className="text-xs text-nexus-text-dim mt-1">Owner: {action.owner} · Priority: {action.priority}</div>
                <div className="text-xs mt-2">{action.whyNow}</div>
              </div>
            ))}
          </div>
        )}
        {r.selfImprovementRules?.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Self-improvement rules</h3>
            <ul className="space-y-1 text-xs text-nexus-text-dim">
              {r.selfImprovementRules.map((rule, i) => <li key={i}>• {rule}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function renderResult() {
    if (!result) return null;
    if (result.raw) {
      return (
        <pre className="text-xs font-mono text-nexus-text-dim bg-nexus-bg p-4 rounded-xl overflow-x-auto whitespace-pre-wrap break-all">
          {result.raw}
        </pre>
      );
    }
    switch (activeMode) {
      case 'health':   return renderHealthResult(result);
      case 'security': return renderSecurityResult(result);
      case 'ux':       return renderUXResult(result);
      case 'growth':   return renderGrowthResult(result);
      case 'feedback': return renderFeedbackResult(result);
      default:         return <pre className="text-xs font-mono">{JSON.stringify(result, null, 2)}</pre>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Brain size={24} className="text-nexus-cyan" />
            <h1 className="text-2xl font-bold">NexusAI</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/20">
              Self-Improvement Engine
            </span>
          </div>
          <p className="text-sm text-nexus-text-dim max-w-xl">
            Claude claude-opus-4-6 analyses the live codebase and generates prioritised improvement suggestions.
            Findings include security audits, UX reviews, plan gaps, and net-new ideas.
          </p>
        </div>

        {/* Server status pill */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border ${
          serverOk === null ? 'border-nexus-border text-nexus-text-dim' :
          serverOk ? 'border-green-500/30 text-green-400 bg-green-400/5' :
          'border-red-500/30 text-red-400 bg-red-400/5'
        }`}>
          <Server size={12} />
          {serverOk === null ? 'Checking server…' :
           serverOk ? 'NexusAI server online' :
           'Server offline — run nexus-ai-server'}
        </div>
      </div>

      {/* Server offline notice */}
      {serverOk === false && (
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-400 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} /> NexusAI server is not running
          </div>
          <p className="text-xs text-nexus-text-dim">Start it with:</p>
          <pre className="text-xs font-mono bg-black/30 px-3 py-2 rounded">
            cd nexus-ai-server{'\n'}
            npm install{'\n'}
            ANTHROPIC_API_KEY=sk-ant-... npm start
          </pre>
          <p className="text-xs text-nexus-text-dim">
            Then set <code className="text-nexus-cyan">VITE_NEXUS_AI_URL=http://localhost:3737</code> in <code className="text-nexus-cyan">nexus-app/.env</code>.
          </p>
        </div>
      )}

      {/* Mode selection grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {MODES.map(m => {
          const Icon = m.icon;
          const isActive = activeMode === m.id && (loading || result);
          return (
            <button
              key={m.id}
              disabled={loading || !serverOk}
              onClick={() => runAnalysis(m.id)}
              className={`relative p-5 rounded-2xl border text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed
                ${isActive
                  ? 'border-nexus-cyan/50 bg-nexus-cyan/5'
                  : 'border-nexus-border bg-nexus-surface/50 hover:border-nexus-cyan/30 hover:bg-nexus-surface'
                }`}
            >
              {isActive && loading && (
                <div className="absolute top-3 right-3">
                  <RefreshCw size={12} className="animate-spin text-nexus-cyan" />
                </div>
              )}
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center mb-3`}>
                <Icon size={16} className="text-white" />
              </div>
              <div className="font-semibold text-sm mb-1">{m.label}</div>
              <div className="text-xs text-nexus-text-dim leading-relaxed">{m.description}</div>
            </button>
          );
        })}
      </div>

      {/* Feedback intake + ranked queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={submitFeedback} className="p-4 rounded-xl border border-nexus-border bg-nexus-surface/40 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><SendHorizonal size={14} className="text-nexus-cyan" /> Submit feedback (human or AI)</h3>
          <div className="grid grid-cols-2 gap-2">
            <select value={feedbackForm.sourceType} onChange={(e) => setFeedbackForm({ ...feedbackForm, sourceType: e.target.value })} className="bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs">
              <option value="human">Human</option>
              <option value="ai">AI</option>
            </select>
            <select value={feedbackForm.category} onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })} className="bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs">
              <option value="ux">UX</option><option value="security">Security</option><option value="feature">Feature</option><option value="performance">Performance</option>
            </select>
          </div>
          <input required value={feedbackForm.title} onChange={(e) => setFeedbackForm({ ...feedbackForm, title: e.target.value })} placeholder="Feedback title" className="w-full bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs" />
          <textarea required value={feedbackForm.description} onChange={(e) => setFeedbackForm({ ...feedbackForm, description: e.target.value })} rows={3} placeholder="Describe the issue or improvement" className="w-full bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={feedbackForm.severity} onChange={(e) => setFeedbackForm({ ...feedbackForm, severity: e.target.value })} className="bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs">
              <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
            <input type="number" min="0" max="1" step="0.1" value={feedbackForm.confidence} onChange={(e) => setFeedbackForm({ ...feedbackForm, confidence: Number(e.target.value) })} className="bg-nexus-bg border border-nexus-border rounded px-2 py-1.5 text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" className="text-xs px-3 py-1.5 rounded bg-nexus-cyan/20 text-nexus-cyan hover:bg-nexus-cyan/30">Save feedback</button>
            {feedbackSubmitMsg && <span className="text-xs text-nexus-text-dim">{feedbackSubmitMsg}</span>}
          </div>
        </form>

        <div className="p-4 rounded-xl border border-nexus-border bg-nexus-surface/40 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Ranked feedback queue</h3>
            <button onClick={refreshFeedbackInsights} className="text-xs text-nexus-text-dim hover:text-nexus-text">Refresh</button>
          </div>
          {feedbackInsights?.ranked?.length ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {feedbackInsights.ranked.slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-lg border border-nexus-border p-2 bg-black/10">
                  <div className="text-xs font-medium">#{item.rank} {item.title}</div>
                  <div className="text-[11px] text-nexus-text-dim">{item.sourceType} · {item.category} · score {item.rankScore}</div>
                  <div className="flex gap-1 mt-2">
                    {['adopted', 'successful', 'rejected', 'noisy'].map((o) => (
                      <button key={o} onClick={() => recordOutcome(item.id, o)} className="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10">{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-nexus-text-dim">No feedback collected yet.</p>
          )}
        </div>
      </div>

      {/* Streaming token display while loading */}
      {loading && streamText && (
        <div className="p-4 rounded-xl border border-nexus-border bg-nexus-bg">
          <div className="flex items-center gap-2 text-xs text-nexus-cyan mb-2">
            <RefreshCw size={11} className="animate-spin" /> Thinking…
          </div>
          <pre className="text-xs font-mono text-nexus-text-dim whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
            {streamText}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <Motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Brain size={16} className="text-nexus-cyan" />
              {MODES.find(m => m.id === activeMode)?.label} — Results
            </div>
            <button
              onClick={() => runAnalysis(activeMode)}
              className="flex items-center gap-1.5 text-xs text-nexus-text-dim hover:text-nexus-text transition-colors"
            >
              <RefreshCw size={12} /> Re-run
            </button>
          </div>
          {renderResult()}
        </Motion.div>
      )}

      {/* How it works */}
      {!loading && !result && (
        <div className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/30">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Sparkles size={14} className="text-nexus-cyan" /> How NexusAI works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { step: '01', title: 'Read', desc: 'Server reads live source files from the repo — contract, store, pages, config.' },
              { step: '02', title: 'Analyse', desc: 'Claude claude-opus-4-6 with adaptive thinking processes the code against the selected mode.' },
              { step: '03', title: 'Suggest', desc: 'Returns typed JSON: suggestions with priority, effort estimates, and patch diffs.' },
              { step: '04', title: 'Apply', desc: 'Patches can be applied directly to files on disk for 1-click improvements.' },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <span className="text-2xl font-black text-nexus-cyan/20 font-mono w-8 flex-shrink-0">{s.step}</span>
                <div>
                  <div className="font-semibold text-sm mb-1">{s.title}</div>
                  <div className="text-xs text-nexus-text-dim">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
