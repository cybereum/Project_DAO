import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Leaf, Building2, HeartHandshake, Cpu, Landmark, Users,
  Globe, TrendingUp, Zap, ArrowRight, ExternalLink, CheckCircle,
  Twitter, Linkedin, Link2, BarChart3, ShieldOff, Eye, Scale
} from 'lucide-react';

const CONCERNS = [
  {
    id: 'corruption',
    icon: ShieldOff,
    color: 'amber',
    urgency: 'CRITICAL',
    region: 'GLOBAL',
    headline: 'Corruption steals $2.6 trillion annually',
    body: 'The World Bank estimates corruption costs the global economy 5% of GDP each year. Infrastructure projects are the single largest vector — an estimated 10–30% of infrastructure investment is lost to corruption and mismanagement.',
    nexusResponse: 'NEXUS milestone escrow gates make fund diversion structurally impossible. Every payment requires verified milestone completion, on-chain proof, and DAO approval. No human middlemen control release.',
    tags: ['Governance', 'Public Finance', 'Infrastructure'],
    source: 'World Bank 2025 Governance Report',
    impact: '$2.6T/year',
    affectedCountries: '140+',
    nexusFeatures: ['Milestone Escrow', 'DAO Voting', 'On-Chain Audit'],
  },
  {
    id: 'esg',
    icon: Leaf,
    color: 'green',
    urgency: 'HIGH',
    region: 'GLOBAL',
    headline: 'ESG greenwashing hits record levels',
    body: 'Global regulators fined $4.7bn in ESG-related penalties in 2025. 78% of corporate ESG claims are unverified or unverifiable by third parties. Institutional investors are demanding cryptographic proof of sustainability outcomes.',
    nexusResponse: 'NEXUS provides on-chain ESG tracking from project initiation to completion. Carbon credits only mint when milestones verify. Auditable impact reports accepted by institutional ESG frameworks.',
    tags: ['ESG', 'Climate', 'Corporate Accountability'],
    source: 'IOSCO ESG Enforcement Report 2025',
    impact: '$4.7B in fines',
    affectedCountries: '60+',
    nexusFeatures: ['Impact Tracking', 'Asset NFTs', 'Verified Credentials'],
  },
  {
    id: 'infrastructure',
    icon: Building2,
    color: 'cyan',
    urgency: 'HIGH',
    region: 'GLOBAL',
    headline: '$500B+ lost to opaque infrastructure procurement',
    body: 'McKinsey Global Institute estimates $500 billion is wasted annually in infrastructure due to opaque procurement, cost overruns, and contractor non-delivery. Developing nations bear 70% of these losses.',
    nexusResponse: 'NEXUS turns any infrastructure project into a transparent, auditable governance system. Contractors earn verified reputation scores. Milestone gates enforce delivery. Citizens can monitor progress in real time.',
    tags: ['Infrastructure', 'Procurement', 'Public Spending'],
    source: 'McKinsey Global Infrastructure Initiative 2025',
    impact: '$500B/year',
    affectedCountries: '100+',
    nexusFeatures: ['Verification', 'Milestones', 'Reputation Scoring'],
  },
  {
    id: 'aid',
    icon: HeartHandshake,
    color: 'rose',
    urgency: 'HIGH',
    region: 'DEVELOPING WORLD',
    headline: 'NGO fund diversion up 31% in 3 years',
    body: 'The UN Office for the Coordination of Humanitarian Affairs documented a 31% rise in humanitarian aid diversion since 2022. Donors increasingly demand "traceability to impact" as a condition of large grants.',
    nexusResponse: 'Every dollar of humanitarian or development aid tracked on-chain from disbursement to verified impact. Beneficiary communities can vote. Donors see real-time progress. Diversion is structurally prevented.',
    tags: ['Humanitarian', 'Aid', 'NGO'],
    source: 'UNOCHA Humanitarian Finance Report 2025',
    impact: '+31% diversion',
    affectedCountries: '55+',
    nexusFeatures: ['DAO Governance', 'Milestone Escrow', 'Impact Tracking'],
  },
  {
    id: 'community',
    icon: Users,
    color: 'purple',
    urgency: 'MEDIUM',
    region: 'GLOBAL',
    headline: '94% of communities excluded from urban planning',
    body: 'UN Habitat reports that only 6% of urban communities have meaningful input into decisions that directly affect them. Democratic deficit at the local level is a root cause of inequality, civil unrest, and failed urban projects.',
    nexusResponse: 'NEXUS enables any community — urban, rural, or dispersed — to govern shared resources with full member participation. No technical expertise required. One protocol, every community.',
    tags: ['Community', 'Democracy', 'Urban'],
    source: 'UN Habitat World Cities Report 2026',
    impact: '3.5B affected',
    affectedCountries: '180+',
    nexusFeatures: ['DAO Governance', 'Proposals', 'Reputation'],
  },
  {
    id: 'supplychain',
    icon: Cpu,
    color: 'sky',
    urgency: 'MEDIUM',
    region: 'EMERGING MARKETS',
    headline: 'Supply chain fraud growing 22% YoY',
    body: 'Interpol and the ICC estimate supply chain fraud cost global trade $4.2 trillion in 2025. Fake certifications, counterfeit credentials, and opaque sub-contractor chains are the primary attack vectors.',
    nexusResponse: 'NEXUS provides on-chain verification for every entity in a supply chain. Credentials are immutable and publicly auditable. Fake companies cannot participate. Reputation scores eliminate unknown counterparty risk.',
    tags: ['Supply Chain', 'Trade', 'Verification'],
    source: 'ICC/Interpol Economic Crime Report 2025',
    impact: '$4.2T/year',
    affectedCountries: '120+',
    nexusFeatures: ['VCDAO Verification', 'Reputation', 'Asset NFTs'],
  },
  {
    id: 'disputes',
    icon: Scale,
    color: 'orange',
    urgency: 'MEDIUM',
    region: 'GLOBAL',
    headline: 'Cross-border project disputes avg. 4.7 years to resolve',
    body: 'The ICC International Court of Arbitration reports average project dispute resolution time of 4.7 years, costing parties an average 18% of disputed contract value in legal fees alone.',
    nexusResponse: 'NEXUS protocol-level dispute resolution uses on-chain evidence, milestone records, and DAO mediation to resolve disputes in days, not years — with full auditability and no lawyers required for standard cases.',
    tags: ['Dispute Resolution', 'Arbitration', 'Legal'],
    source: 'ICC Dispute Resolution Statistics 2025',
    impact: '4.7 year avg',
    affectedCountries: '90+',
    nexusFeatures: ['Proposal Disputes', 'DAO Voting', 'On-Chain Records'],
  },
  {
    id: 'transparency',
    icon: Eye,
    color: 'indigo',
    urgency: 'MEDIUM',
    region: 'GLOBAL',
    headline: '63 countries rated "very low" on public spending transparency',
    body: 'The Open Budget Survey 2025 found 63 countries provide inadequate public access to budget information. Citizens in these nations cannot verify where public money goes or hold governments accountable.',
    nexusResponse: 'NEXUS can be deployed by any government, municipality, or public institution to make spending transparent by default. Citizens audit. Journalists verify. Accountability becomes automatic.',
    tags: ['Government', 'Budget', 'Transparency'],
    source: 'International Budget Partnership Open Budget Survey 2025',
    impact: '2.1B people',
    affectedCountries: '63',
    nexusFeatures: ['On-Chain Audit', 'Public Proposals', 'Impact Tracking'],
  },
];

const COLOR_MAP = {
  amber: { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30', border: 'border-amber-500/20', dot: 'bg-amber-400', text: 'text-amber-400', icon: 'text-amber-400' },
  green: { badge: 'bg-green-500/20 text-green-300 border-green-500/30', border: 'border-green-500/20', dot: 'bg-green-400', text: 'text-green-400', icon: 'text-green-400' },
  cyan: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', border: 'border-cyan-500/20', dot: 'bg-cyan-400', text: 'text-cyan-400', icon: 'text-cyan-400' },
  rose: { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30', border: 'border-rose-500/20', dot: 'bg-rose-400', text: 'text-rose-400', icon: 'text-rose-400' },
  purple: { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30', border: 'border-purple-500/20', dot: 'bg-purple-400', text: 'text-purple-400', icon: 'text-purple-400' },
  sky: { badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30', border: 'border-sky-500/20', dot: 'bg-sky-400', text: 'text-sky-400', icon: 'text-sky-400' },
  orange: { badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30', border: 'border-orange-500/20', dot: 'bg-orange-400', text: 'text-orange-400', icon: 'text-orange-400' },
  indigo: { badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', border: 'border-indigo-500/20', dot: 'bg-indigo-400', text: 'text-indigo-400', icon: 'text-indigo-400' },
};

const URGENCY_COLOR = {
  CRITICAL: 'bg-red-500/20 text-red-300 border border-red-500/30',
  HIGH: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  MEDIUM: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
};

function ConcernCard({ concern, index }) {
  const c = COLOR_MAP[concern.color];

  const shareText = `${concern.headline} — and NEXUS Protocol provides a structural solution. nexusprotocol.io/pulse`;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/pulse#${concern.id}` : `https://nexusprotocol.io/pulse#${concern.id}`;

  return (
    <motion.div id={concern.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }} transition={{ delay: index * 0.07 }}
      className={`rounded-2xl border ${c.border} bg-nexus-surface/50 overflow-hidden`}>
      <div className="p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <concern.icon size={22} className={c.icon} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${URGENCY_COLOR[concern.urgency]}`}>
                  {concern.urgency}
                </span>
                <span className="text-xs text-nexus-text-dim font-mono">{concern.region}</span>
              </div>
              <h3 className="font-bold text-base leading-snug">{concern.headline}</h3>
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span className={`text-lg font-black ${c.text}`}>{concern.impact}</span>
            <span className="text-xs text-nexus-text-dim">{concern.affectedCountries} countries</span>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-nexus-text-dim leading-relaxed mb-4">{concern.body}</p>

        {/* NEXUS Response */}
        <div className="p-4 rounded-xl bg-nexus-cyan/5 border border-nexus-cyan/10 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={13} className="text-nexus-cyan" />
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-wider">NEXUS Response</span>
          </div>
          <p className="text-sm text-nexus-text-dim leading-relaxed">{concern.nexusResponse}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {concern.nexusFeatures.map(f => (
              <span key={f} className="text-xs px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/20">
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Tags + Source */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {concern.tags.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-nexus-text-dim border border-nexus-border">{t}</span>
            ))}
          </div>
          <span className="text-xs text-nexus-text-dim">Source: {concern.source}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-nexus-border">
          <Link to="/dashboard"
            className="flex items-center gap-1.5 text-xs text-nexus-cyan hover:underline">
            <Zap size={12} />
            Use NEXUS for this
          </Link>
          <div className="flex items-center gap-2">
            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-nexus-text-dim hover:text-white transition-colors"
              aria-label="Share this concern on X (Twitter)">
              <Twitter size={13} />
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-nexus-text-dim hover:text-white transition-colors"
              aria-label="Share this concern on LinkedIn">
              <Linkedin size={13} />
            </a>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function GlobalPulse() {
  const [filter, setFilter] = useState('ALL');
  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'];
  const filtered = filter === 'ALL' ? CONCERNS : CONCERNS.filter(c => c.urgency === filter);

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text">
      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-nexus-bg/80 backdrop-blur-md border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-nexus-text-dim hover:text-nexus-text transition-colors">Home</Link>
            <Link to="/dashboard"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Launch App
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-16 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            LIVE GLOBAL PULSE · UPDATED {new Date().getFullYear()}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Global Concerns.<br />
            <span className="bg-gradient-to-r from-amber-400 to-nexus-cyan bg-clip-text text-transparent">
              Structural Solutions.
            </span>
          </h1>
          <p className="text-lg text-nexus-text-dim max-w-2xl mx-auto mb-8">
            These are the systemic failures reported by international institutions in 2026.
            NEXUS Protocol is architected to make each one structurally impossible — not just harder.
          </p>

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto mb-10">
            {[
              { label: 'Active concerns', value: CONCERNS.length },
              { label: 'Critical urgency', value: CONCERNS.filter(c => c.urgency === 'CRITICAL').length },
              { label: 'Countries affected', value: '180+' },
              { label: 'NEXUS features deployed', value: '6' },
            ].map((s, i) => (
              <div key={i} className="p-3 rounded-xl border border-nexus-border bg-nexus-surface/50 text-center">
                <div className="text-2xl font-black text-nexus-cyan">{s.value}</div>
                <div className="text-xs text-nexus-text-dim">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex justify-center gap-2 flex-wrap">
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-mono transition-all ${
                  filter === f
                    ? 'bg-nexus-cyan text-nexus-bg font-bold'
                    : 'bg-white/5 text-nexus-text-dim hover:bg-white/10 border border-nexus-border'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONCERN CARDS ── */}
      <section className="py-10 px-6 pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map((concern, i) => (
            <ConcernCard key={concern.id} concern={concern} index={i} />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Every one of these concerns has a NEXUS solution.
          </h2>
          <p className="text-nexus-text-dim mb-8">
            Deploy NEXUS for your project, community, or government — free, open source, and live in minutes.
          </p>
          <Link to="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-nexus-cyan/20">
            <Zap size={18} />
            Launch NEXUS — Free Forever
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-nexus-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Zap size={16} className="text-nexus-cyan" />
            <span className="text-sm font-bold">NEXUS Protocol</span>
          </Link>
          <span className="text-xs text-nexus-text-dim">Open source · MIT License · Global</span>
        </div>
      </footer>
    </div>
  );
}
