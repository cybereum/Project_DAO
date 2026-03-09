/**
 * LeadCapture — universal inbound + outbound form component.
 *
 * Features:
 * - Persona-aware messaging (agent, builder, ngo, government, enterprise)
 * - Full UTM attribution baked into every submission
 * - Geo-locale personalisation (country hint from browser Intl API)
 * - Configurable via props — renders as inline section or modal
 * - Submits to VITE_LEAD_WEBHOOK (falls back to console in dev)
 * - Tracks funnel step in localStorage for cohort analysis
 * - Post-submit: shows shareable confirmation card
 */
import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, ArrowRight, Loader2, Share2, Copy, Twitter, Send } from 'lucide-react';
import { submitLead, getLocaleHint, markFunnelStep, captureUTM } from '../lib/utm.js';
import { trackEvent } from '../lib/analytics.js';

// ─── Persona configurations ───────────────────────────────────────────────────

const PERSONAS = {
  agent: {
    badge: 'AI Agents & Autonomous Systems',
    headline: 'Get the Agent Economy Integration Kit',
    subhead: 'Private early-access docs, API key request, and integration support — straight to your inbox.',
    cta: 'Get Integration Kit',
    placeholder: 'agent@yourproject.ai',
    gift: 'Agent Economy Integration Kit',
    color: 'from-nexus-cyan to-nexus-purple',
    borderColor: 'border-nexus-cyan/30',
    bgColor: 'bg-nexus-cyan/5',
    badgeColor: 'text-nexus-cyan bg-nexus-cyan/10',
  },
  builder: {
    badge: 'Developers & Integrators',
    headline: 'Get Early API Access',
    subhead: 'Deployment guide, contract ABIs, and a developer Slack invite — free for builders.',
    cta: 'Request Dev Access',
    placeholder: 'dev@yourproject.io',
    gift: 'Developer Early Access',
    color: 'from-nexus-purple to-nexus-cyan',
    borderColor: 'border-nexus-purple/30',
    bgColor: 'bg-nexus-purple/5',
    badgeColor: 'text-nexus-purple bg-nexus-purple/10',
  },
  ngo: {
    badge: 'NGOs & Foundations',
    headline: 'Deploy transparent governance for your programmes',
    subhead: 'Get a free deployment consultation and the NGO Accountability Toolkit — no technical knowledge needed.',
    cta: 'Get Free Consultation',
    placeholder: 'director@yourorg.org',
    gift: 'NGO Governance Toolkit',
    color: 'from-green-500 to-cyan-500',
    borderColor: 'border-green-500/30',
    bgColor: 'bg-green-500/5',
    badgeColor: 'text-green-400 bg-green-500/10',
  },
  government: {
    badge: 'Governments & Municipalities',
    headline: 'Deploy NEXUS for your city or programme',
    subhead: 'Join the pilot programme. Get a personalised deployment roadmap and implementation support from our team.',
    cta: 'Request Pilot Access',
    placeholder: 'official@yourcity.gov',
    gift: 'Government Pilot Programme',
    color: 'from-amber-500 to-orange-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
    badgeColor: 'text-amber-400 bg-amber-500/10',
  },
  enterprise: {
    badge: 'Enterprises & Supply Chains',
    headline: 'Bring verifiable governance to your supply chain',
    subhead: 'Book a 30-minute demo. See how Project_DAO replaces spreadsheets and siloed approvals with auditable on-chain governance.',
    cta: 'Book a Demo',
    placeholder: 'cto@yourcompany.com',
    gift: 'Enterprise Demo Session',
    color: 'from-sky-500 to-blue-600',
    borderColor: 'border-sky-500/30',
    bgColor: 'bg-sky-500/5',
    badgeColor: 'text-sky-400 bg-sky-500/10',
  },
  default: {
    badge: 'Global Community',
    headline: 'Join the accountability movement',
    subhead: 'Get the NEXUS Protocol newsletter: governance insights, project launches, and corruption data — monthly.',
    cta: 'Join the Movement',
    placeholder: 'you@anywhere.com',
    gift: 'NEXUS Protocol Newsletter',
    color: 'from-nexus-cyan to-nexus-purple',
    borderColor: 'border-nexus-border',
    bgColor: 'bg-nexus-surface/50',
    badgeColor: 'text-nexus-cyan bg-nexus-cyan/10',
  },
};

// ─── Share confirmation card ──────────────────────────────────────────────────

function ShareConfirmation({ persona: _persona, gift, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://www.cybereum.io';
  const shareText = `I just joined the accountability movement. ${gift} from NEXUS Protocol — making corruption structurally impossible. ${url}`;

  const copy = () => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-5 rounded-2xl border border-green-500/30 bg-green-500/5 text-center space-y-4"
    >
      <div className="flex items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <CheckCircle size={20} className="text-green-400" />
        </div>
      </div>
      <div>
        <p className="font-bold text-green-400 mb-1">You're in.</p>
        <p className="text-xs text-nexus-text-dim">
          <strong>{gift}</strong> is on its way to your inbox.
        </p>
      </div>

      <div className="pt-2 border-t border-green-500/10 space-y-2">
        <p className="text-xs text-nexus-text-dim">
          Help us reach more communities — share NEXUS with someone who needs it.
        </p>
        <div className="flex items-center justify-center gap-2">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-nexus-text-dim hover:text-white transition-colors"
          >
            <Twitter size={12} /> Share on X
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-sky-500/10 text-xs text-nexus-text-dim hover:text-sky-400 transition-colors"
          >
            <Send size={12} /> Telegram
          </a>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-nexus-text-dim hover:text-white transition-colors"
          >
            {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      </div>

      <button onClick={onDismiss} className="text-xs text-nexus-text-dim hover:text-nexus-text transition-colors">
        Continue exploring →
      </button>
    </Motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LeadCapture({
  persona = 'default',
  /** Override any persona field */
  overrides = {},
  /** Render as a minimal inline bar rather than full card */
  compact = false,
  /** Extra className for the outer wrapper */
  className = '',
}) {
  const config = { ...PERSONAS[persona] || PERSONAS.default, ...overrides };
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [localeHint, setLocaleHint] = useState('');

  useEffect(() => {
    captureUTM();
    const { country } = getLocaleHint();
    if (country) setLocaleHint(country); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);

    markFunnelStep('lead_submit');
    trackEvent('lead_capture', { persona, email_domain: email.split('@')[1] });

    const result = await submitLead({
      email,
      name,
      persona,
      message: `Lead from ${persona} persona page${localeHint ? ` (locale: ${localeHint})` : ''}`,
    });

    setLoading(false);

    if (result.ok) {
      setSubmitted(true);
      markFunnelStep('lead_confirmed');
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className={className}>
        <ShareConfirmation persona={persona} gift={config.gift} onDismiss={() => setSubmitted(false)} />
      </div>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className={`flex items-center gap-2 ${className}`}>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={config.placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
          required
        />
        <button type="submit" disabled={loading}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r ${config.color} text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 whitespace-nowrap`}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
          {config.cta}
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </form>
    );
  }

  return (
    <div className={`p-6 rounded-2xl border ${config.borderColor} ${config.bgColor} ${className}`}>
      <div className="mb-4">
        <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-mono mb-3 ${config.badgeColor}`}>
          {config.badge}
        </span>
        {localeHint && (
          <span className="inline-block ml-2 text-xs px-2.5 py-0.5 rounded-full font-mono bg-white/5 text-nexus-text-dim">
            📍 {localeHint}
          </span>
        )}
        <h3 className="text-lg font-bold mb-1">{config.headline}</h3>
        <p className="text-sm text-nexus-text-dim">{config.subhead}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
        />
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={config.placeholder}
          className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
          required
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button type="submit" disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r ${config.color} text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-60`}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {loading ? 'Sending...' : config.cta}
        </button>
        <p className="text-xs text-nexus-text-dim text-center">
          No spam. Unsubscribe anytime. Attribution tracked for product improvement.
        </p>
      </form>
    </div>
  );
}
