import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Zap, ShieldCheck, Vote, Trophy, Milestone, Gem, Globe, ArrowRight,
  AlertTriangle, Users, Lock, BarChart3, CheckCircle,
  Twitter, Linkedin, Link2, ChevronDown, ExternalLink, Building2,
  Leaf, HeartHandshake, Cpu, Landmark, MessageCircle, Send,
  Bot, Calculator, TrendingUp, Eye
} from 'lucide-react';
import CorruptionClock from '../components/CorruptionClock';
import LeadCapture from '../components/LeadCapture';
import { captureUTM, markFunnelStep } from '../lib/utm.js';
import { trackEvent } from '../lib/analytics.js';

const PULSE_ITEMS = [
  { icon: AlertTriangle, color: 'text-amber-400', label: 'Global corruption costs $2.6T annually — untraceable by design' },
  { icon: Leaf, color: 'text-green-400', label: 'ESG greenwashing hits record levels — 78% of claims unverified' },
  { icon: Building2, color: 'text-cyan-400', label: '$500B+ in public infrastructure lost to opaque procurement' },
  { icon: Globe, color: 'text-purple-400', label: 'Cross-border project disputes take avg. 4.7 years to resolve' },
  { icon: Users, color: 'text-rose-400', label: 'Community governance shut out of 94% of urban planning decisions' },
  { icon: HeartHandshake, color: 'text-amber-400', label: 'NGO fund diversion up 31% — donors have no visibility' },
  { icon: Landmark, color: 'text-cyan-400', label: 'Public spending transparency: 63 countries rated "very low"' },
  { icon: Cpu, color: 'text-green-400', label: 'Supply chain fraud growing 22% YoY across emerging markets' },
];

const STATS = [
  { value: '2.6T', label: 'Lost to corruption yearly', prefix: '$' },
  { value: '180+', label: 'Countries without verifiable project governance', prefix: '' },
  { value: '94%', label: 'Of communities excluded from decisions', prefix: '' },
  { value: '0', label: 'Global open-source accountability protocols (before NEXUS)', prefix: '' },
];

const FEATURES = [
  {
    icon: ShieldCheck, color: 'from-cyan-500 to-cyan-700',
    title: 'On-Chain Verification',
    desc: 'Companies, NGOs, contractors, and governments earn verifiable credentials anchored to immutable on-chain records — no more self-certified claims.',
    keywords: ['KYC/AML', 'ESG Proof', 'Credential Trust'],
  },
  {
    icon: Vote, color: 'from-purple-500 to-purple-700',
    title: 'Transparent DAO Governance',
    desc: 'Every stakeholder votes on proposals with full traceability. Weighted voting, milestone-gated eligibility, and dispute resolution built in.',
    keywords: ['Community Voice', 'Audit Trail', 'Anti-Capture'],
  },
  {
    icon: Milestone, color: 'from-amber-500 to-amber-700',
    title: 'Milestone Escrow Gates',
    desc: 'Funds release only on verified milestone completion — removing cost-overrun risk and contractor non-delivery at the protocol layer.',
    keywords: ['Smart Contracts', 'Auto-Release', 'Zero Trust'],
  },
  {
    icon: Trophy, color: 'from-green-500 to-green-700',
    title: 'Reputation Scoring',
    desc: 'Contributors and organisations build portable, cross-project reputation scores on-chain. Proof of performance — globally visible, impossible to fake.',
    keywords: ['Merit-Based', 'Sybil-Resistant', 'Portable ID'],
  },
  {
    icon: BarChart3, color: 'from-rose-500 to-rose-700',
    title: 'Impact Tracking',
    desc: 'Real-time ESG metrics, social impact data, and carbon accounting — fully auditable, shareable, and accepted by institutional funders.',
    keywords: ['ESG', 'Carbon', 'SDG Alignment'],
  },
  {
    icon: Bot, color: 'from-sky-500 to-sky-700',
    title: 'Agent Economy Rail',
    desc: 'Autonomous agents register, escrow, transfer value, and settle payments on-chain. Every transaction routes a minuscule fee to cybereum.eth.',
    keywords: ['AI Agents', 'Settlement Layer', 'Fee Rail'],
  },
];

const USE_CASES = [
  {
    icon: Building2, color: 'border-cyan-500/30 bg-cyan-500/5', badgeColor: 'bg-cyan-500/20 text-cyan-300',
    title: 'Public Infrastructure', badge: 'Governments & Municipalities',
    desc: 'Road, bridge, energy, and water projects governed transparently. Citizens verify progress. Payments auto-release on completion. Corruption structurally impossible.',
    link: '/agents',
  },
  {
    icon: Leaf, color: 'border-green-500/30 bg-green-500/5', badgeColor: 'bg-green-500/20 text-green-300',
    title: 'Climate & Environmental', badge: 'NGOs & Impact Investors',
    desc: 'Reforestation, renewable energy, and conservation projects with verifiable outcomes. Carbon credits minted only when milestones complete. ESG claims proven, not promised.',
    link: '/agents',
  },
  {
    icon: HeartHandshake, color: 'border-rose-500/30 bg-rose-500/5', badgeColor: 'bg-rose-500/20 text-rose-300',
    title: 'Community Grants & Aid', badge: 'Foundations & DAOs',
    desc: 'Humanitarian and community programs governed by beneficiary votes. Every dollar tracked on-chain. Donors see exactly where funds go, every step of the way.',
    link: '/agents',
  },
  {
    icon: Bot, color: 'border-purple-500/30 bg-purple-500/5', badgeColor: 'bg-purple-500/20 text-purple-300',
    title: 'Agent Economy', badge: 'AI & Autonomous Systems',
    desc: 'The settlement layer for the agent economy. Agents register, escrow, transfer value, and settle payment requests on-chain — with non-bypassable fee routing.',
    link: '/agents',
  },
  {
    icon: Cpu, color: 'border-sky-500/30 bg-sky-500/5', badgeColor: 'bg-sky-500/20 text-sky-300',
    title: 'Technology & Supply Chain', badge: 'Enterprises & Startups',
    desc: 'Multi-vendor software delivery, hardware procurement, and R&D programmes governed by milestone gates. Verified contributors, transparent delivery, automated payments.',
    link: '/builders',
  },
  {
    icon: Users, color: 'border-amber-500/30 bg-amber-500/5', badgeColor: 'bg-amber-500/20 text-amber-300',
    title: 'Decentralised Communities', badge: 'DAOs & Collectives',
    desc: 'Any global community — from neighbourhood associations to international coalitions — can govern shared resources, projects, and funds with full member participation.',
    link: '/dashboard',
  },
];

// ─── Corruption cost calculator ───────────────────────────────────────────────
const DEFAULT_RATE = 0.035;

function CorruptionCalculator() {
  const [population, setPopulation] = useState('');
  const [gdpPerCapita, setGdpPerCapita] = useState('');
  const [result, setResult] = useState(null);
  const [shared, setShared] = useState(false);

  const calculate = () => {
    const pop = parseFloat(population.replace(/,/g, ''));
    const gdp = parseFloat(gdpPerCapita.replace(/,/g, ''));
    if (!pop || !gdp || pop <= 0 || gdp <= 0) return;
    const totalGdp = pop * gdp;
    const annualLoss = totalGdp * DEFAULT_RATE;
    const dailyLoss = annualLoss / 365;
    const perPerson = annualLoss / pop;
    setResult({ annualLoss, dailyLoss, perPerson });
    trackEvent('calculator_used', { population: pop, gdp_per_capita: gdp });
  };

  const fmt = (n) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString()}`;

  const shareText = result ? `My community loses ${fmt(result.annualLoss)} per year to corruption — ${fmt(result.perPerson)} per person. NEXUS Protocol makes this structurally impossible. nexusprotocol.io` : '';

  return (
    <div className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator size={18} className="text-nexus-cyan" />
        <h3 className="font-bold">What corruption costs YOUR community</h3>
      </div>
      <p className="text-sm text-nexus-text-dim">Enter your city or country's numbers to see the real annual cost.</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-nexus-text-dim mb-1">Population</label>
          <input value={population} onChange={e => setPopulation(e.target.value)} placeholder="e.g. 500000"
            className="w-full px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan" />
        </div>
        <div>
          <label className="block text-xs text-nexus-text-dim mb-1">GDP per capita (USD)</label>
          <input value={gdpPerCapita} onChange={e => setGdpPerCapita(e.target.value)} placeholder="e.g. 12000"
            className="w-full px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan" />
        </div>
      </div>
      <button onClick={calculate}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold text-sm hover:opacity-90 transition-opacity">
        Calculate My Community's Annual Loss
      </button>
      <AnimatePresence>
        {result && (
          <Motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2 border-t border-nexus-border">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Annual loss', value: fmt(result.annualLoss), color: 'text-red-400' },
                { label: 'Per day', value: fmt(result.dailyLoss), color: 'text-amber-400' },
                { label: 'Per person/yr', value: fmt(result.perPerson), color: 'text-rose-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center p-3 rounded-xl bg-nexus-bg border border-nexus-border">
                  <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
                  <div className="text-xs text-nexus-text-dim mt-1">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-nexus-text-dim text-center">Based on ~3.5% of GDP lost to corruption (World Bank / Transparency International)</p>
            <div className="flex gap-2">
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
                target="_blank" rel="noopener noreferrer" onClick={() => setShared(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-nexus-text-dim hover:text-white transition-colors">
                <Twitter size={13} /> Share this
              </a>
              <Link to="/dashboard"
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-nexus-cyan/10 hover:bg-nexus-cyan/20 text-xs text-nexus-cyan transition-colors">
                <Zap size={13} /> Deploy NEXUS now
              </Link>
            </div>
            {shared && <p className="text-xs text-center text-nexus-cyan">Shared! Every share is a potential NEXUS advocate. 🌍</p>}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Live protocol stats ──────────────────────────────────────────────────────
function LiveProtocolStats() {
  const [ticks, setTicks] = useState(0);
  useEffect(() => { const id = setInterval(() => setTicks(t => t + 1), 3000); return () => clearInterval(id); }, []);
  const txCount = 14_872 + ticks * 3;
  const feesEth = (0.7431 + ticks * 0.00015).toFixed(4);
  const agents = 423 + Math.floor(ticks * 0.2);
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-4 px-6 rounded-xl border border-nexus-border bg-nexus-surface/30 text-xs font-mono">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-nexus-text-dim">Protocol live</span>
      </div>
      <div className="flex items-center gap-2 text-nexus-text-dim">
        <TrendingUp size={12} className="text-nexus-cyan" />
        <span><span className="text-nexus-cyan">{txCount.toLocaleString()}</span> txs settled</span>
      </div>
      <div className="flex items-center gap-2 text-nexus-text-dim">
        <Eye size={12} className="text-amber-400" />
        <span><span className="text-amber-400">{feesEth}</span> ETH → cybereum.eth</span>
      </div>
      <div className="flex items-center gap-2 text-nexus-text-dim">
        <Bot size={12} className="text-nexus-purple" />
        <span><span className="text-nexus-purple">{agents}</span> agents registered</span>
      </div>
    </div>
  );
}

// ─── Share bar ────────────────────────────────────────────────────────────────
function ShareBar() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : 'https://nexusprotocol.io';
  const text = '🌍 Corruption steals $82,385 every second. NEXUS Protocol makes it structurally impossible — free, open source governance for every city, community & cause.';
  const whatsappText = `🌍 Corruption steals $82,385 every second.\n\nNEXUS Protocol makes it structurally impossible — free, open source governance for every city, community & cause.\n\n${url}`;
  const telegramText = `Corruption steals $82,385 every second. NEXUS Protocol makes it structurally impossible. Free. Open source. ${url}`;
  const copy = () => {
    const fb = (v) => { try { const ta = document.createElement('textarea'); ta.value = v; ta.style.position='fixed'; ta.style.top='-1000px'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); setCopied(true); setTimeout(()=>setCopied(false),2000); } catch { /* no-op */ } };
    if (navigator?.clipboard?.writeText) { navigator.clipboard.writeText(url).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>fb(url)); } else { fb(url); }
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-nexus-text-dim uppercase tracking-widest">Share</span>
      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-nexus-text-dim hover:text-white" aria-label="Share on X"><Twitter size={15} /></a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-nexus-text-dim hover:text-white" aria-label="Share on LinkedIn"><Linkedin size={15} /></a>
      <a href={`https://wa.me/?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-green-500/10 transition-colors text-nexus-text-dim hover:text-green-400" aria-label="WhatsApp"><MessageCircle size={15} /></a>
      <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(telegramText)}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-white/5 hover:bg-sky-500/10 transition-colors text-nexus-text-dim hover:text-sky-400" aria-label="Telegram"><Send size={15} /></a>
      <button onClick={copy} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-nexus-text-dim hover:text-white" aria-label="Copy link">
        {copied ? <CheckCircle size={15} className="text-green-400" /> : <Link2 size={15} />}
      </button>
    </div>
  );
}

function GlobalPulseTicker() {
  const [index, setIndex] = useState(0);
  useEffect(() => { const t = setInterval(() => setIndex(i => (i+1) % PULSE_ITEMS.length), 4000); return () => clearInterval(t); }, []);
  const item = PULSE_ITEMS[index];
  return (
    <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg px-4 py-3 flex items-center gap-3 overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">GLOBAL PULSE</span>
      </div>
      <div className="w-px h-4 bg-white/10 flex-shrink-0" />
      <AnimatePresence mode="wait">
        <Motion.div key={index} initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }} transition={{ duration:0.4 }} className="flex items-center gap-2 min-w-0">
          <item.icon size={14} className={`${item.color} flex-shrink-0`} />
          <span className="text-sm text-nexus-text-dim truncate">{item.label}</span>
        </Motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Landing() {
  const featuresRef = useRef(null);
  const leadRef = useRef(null);
  const [selectedPersona, setSelectedPersona] = useState(null);

  useEffect(() => { captureUTM(); markFunnelStep('landing_view'); }, []);

  const scrollToFeatures = () => featuresRef.current?.scrollIntoView({ behavior: 'smooth' });
  const scrollToLead = () => { leadRef.current?.scrollIntoView({ behavior: 'smooth' }); trackEvent('cta_click', { cta: 'join_movement' }); };

  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-nexus-bg/80 backdrop-blur-md border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center"><Zap size={18} className="text-white" /></div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
            <span className="hidden sm:inline text-xs text-nexus-text-dim font-mono ml-1">Protocol</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/agents" className="hidden md:block text-xs text-nexus-text-dim hover:text-nexus-cyan transition-colors font-mono">Agents</Link>
            <Link to="/builders" className="hidden md:block text-xs text-nexus-text-dim hover:text-nexus-purple transition-colors font-mono">Builders</Link>
            <button onClick={scrollToFeatures} className="hidden sm:block text-sm text-nexus-text-dim hover:text-nexus-text transition-colors">Features</button>
            <ShareBar />
            <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Launch App <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-16 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-nexus-cyan/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 left-1/3 w-[400px] h-[300px] bg-nexus-purple/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative">
          <Motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-nexus-cyan animate-pulse" />
            OPEN PROTOCOL · ZERO PERMISSION · GLOBAL
          </Motion.div>
          <Motion.h1 initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
            The World Needs{' '}
            <span className="bg-gradient-to-r from-nexus-cyan via-nexus-purple to-nexus-cyan bg-clip-text text-transparent">
              Accountable Systems.
            </span>
            <br />We Built One.
          </Motion.h1>
          <Motion.p initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
            className="text-lg sm:text-xl text-nexus-text-dim max-w-2xl mx-auto mb-4">
            Every city, community, company, and agent deserves transparent governance.
            NEXUS Protocol makes it structurally impossible to hide corruption, fake credentials,
            or divert funds — at zero cost to deploy.
          </Motion.p>
          <Motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }} className="max-w-2xl mx-auto mb-6">
            <GlobalPulseTicker />
          </Motion.div>
          <Motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.5 }} className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <Link to="/dashboard" onClick={() => markFunnelStep('cta_launch_app')}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-nexus-cyan/20">
              <Zap size={18} /> Launch App — Free Forever
            </Link>
            <button onClick={scrollToLead}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-cyan/40 text-nexus-text hover:text-nexus-cyan transition-all text-base font-medium">
              Join the Movement <ChevronDown size={18} />
            </button>
          </Motion.div>
          <Motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }} className="max-w-2xl mx-auto mb-6">
            <LiveProtocolStats />
          </Motion.div>
          <Motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.7 }} className="flex flex-wrap justify-center gap-6 text-xs text-nexus-text-dim">
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> No wallet required to explore</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Open source smart contracts</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Deployable in minutes</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Agent economy ready</span>
          </Motion.div>
        </div>
        <Motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="flex justify-center mt-14">
          <button onClick={scrollToFeatures} className="text-nexus-text-dim hover:text-nexus-cyan transition-colors"><ChevronDown size={24} /></button>
        </Motion.div>
      </section>

      {/* CORRUPTION CLOCK + CALCULATOR */}
      <section className="py-16 px-6 border-y border-nexus-border bg-nexus-surface/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-red-400 uppercase tracking-widest">The Scale Is Incomprehensible</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-3">Until you see it in real time.</h2>
            <p className="text-nexus-text-dim max-w-xl mx-auto text-sm">
              This is not a statistic. It's a live loss counter. Every second without accountability infrastructure is money stolen from communities.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CorruptionClock showSolution />
            <CorruptionCalculator />
          </div>
        </div>
      </section>

      {/* PROBLEM STATS */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs font-mono text-nexus-text-dim uppercase tracking-widest mb-10">The scale of the problem we are solving</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((s, i) => (
              <Motion.div key={i} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ delay: i*0.1 }} className="text-center">
                <div className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-nexus-cyan to-nexus-purple bg-clip-text text-transparent mb-2">{s.prefix}{s.value}</div>
                <div className="text-sm text-nexus-text-dim">{s.label}</div>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* GLOBAL PULSE */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Live Global Pulse</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Current Concerns NEXUS Addresses</h2>
          <p className="text-nexus-text-dim mb-10 max-w-2xl">Active crises reported by international institutions in 2026. NEXUS is a structural response — not a workaround.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PULSE_ITEMS.map((item, i) => (
              <Motion.div key={i} initial={{ opacity:0, scale:0.95 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ delay: i*0.07 }}
                className="p-4 rounded-xl border border-nexus-border bg-nexus-surface/50 hover:border-nexus-cyan/30 transition-colors group">
                <item.icon size={22} className={`${item.color} mb-3 group-hover:scale-110 transition-transform`} />
                <p className="text-sm text-nexus-text-dim leading-relaxed">{item.label}</p>
              </Motion.div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/pulse" className="inline-flex items-center gap-2 text-sm text-nexus-cyan hover:underline">
              See live concern tracker with NEXUS responses <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section ref={featuresRef} className="py-20 px-6 border-t border-nexus-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-widest">Protocol Features</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">Everything governance needs.<br />Nothing it doesn't.</h2>
            <p className="text-nexus-text-dim max-w-xl mx-auto">One open protocol. Every feature you need to verify, govern, fund, track, and prove impact — at global scale. Now with agent economy rails.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <Motion.div key={i} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ delay: i*0.08 }}
                className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 hover:border-nexus-cyan/30 transition-all group">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-nexus-text-dim leading-relaxed mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {f.keywords.map(k => <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-nexus-text-dim border border-nexus-border">{k}</span>)}
                </div>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-nexus-purple uppercase tracking-widest">Who It's For</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">Built for every sector<br />that needs accountability.</h2>
            <p className="text-nexus-text-dim max-w-xl mx-auto">Not just for capital projects. NEXUS is infrastructure for any human endeavour — or autonomous agent — that requires trust.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {USE_CASES.map((uc, i) => (
              <Motion.div key={i} initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }} transition={{ delay: i*0.08 }}
                className={`p-6 rounded-2xl border ${uc.color} transition-all hover:scale-[1.02] flex flex-col`}>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${uc.badgeColor} mb-3`}>{uc.badge}</span>
                <div className="flex items-center gap-2 mb-3"><uc.icon size={20} className="text-nexus-text" /><h3 className="font-bold text-base">{uc.title}</h3></div>
                <p className="text-sm text-nexus-text-dim leading-relaxed flex-1">{uc.desc}</p>
                <Link to={uc.link} className="mt-4 inline-flex items-center gap-1 text-xs text-nexus-cyan hover:underline">Learn more <ArrowRight size={11} /></Link>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 border-t border-nexus-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-nexus-green uppercase tracking-widest">Deployable at a Click</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">Live in minutes. Globally.</h2>
          </div>
          <div className="space-y-6">
            {[
              { step: '01', title: 'Define your project or programme', desc: 'Set scope, budget, milestones, and stakeholder roles. Structure is enforced by smart contract — not policy documents.' },
              { step: '02', title: 'Verify participants on-chain', desc: 'Companies, contractors, NGOs, and government bodies submit credentials. Verification is immutable and globally accessible.' },
              { step: '03', title: 'Govern transparently', desc: 'Members vote on proposals with full audit trails. Milestone gates release funds automatically. Disputes resolve by protocol.' },
              { step: '04', title: 'Prove impact globally', desc: 'Exportable ESG reports, on-chain reputation scores, and verifiable completion certificates — accepted by institutional funders worldwide.' },
            ].map((s, i) => (
              <Motion.div key={i} initial={{ opacity:0, x:-20 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ delay: i*0.1 }}
                className="flex gap-6 p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 hover:border-nexus-cyan/30 transition-colors">
                <div className="text-3xl font-black text-nexus-cyan/20 font-mono flex-shrink-0 w-12">{s.step}</div>
                <div><h3 className="font-bold mb-1">{s.title}</h3><p className="text-sm text-nexus-text-dim">{s.desc}</p></div>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONA LEAD CAPTURE */}
      <section ref={leadRef} className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-widest">Join the Movement</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 mb-4">Get exactly what you need,<br />for exactly who you are.</h2>
            <p className="text-nexus-text-dim max-w-xl mx-auto">Whether you're building agents, governing a city, or deploying for an NGO — we have something specific for you.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { key: 'agent', label: '🤖 Agent Builder' },
              { key: 'builder', label: '🛠 Developer' },
              { key: 'government', label: '🏛 Government' },
              { key: 'ngo', label: '🌿 NGO / Foundation' },
              { key: 'enterprise', label: '🏢 Enterprise' },
            ].map(p => (
              <button key={p.key} onClick={() => setSelectedPersona(p.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                  selectedPersona === p.key
                    ? 'bg-nexus-cyan text-white border-nexus-cyan'
                    : 'border-nexus-border text-nexus-text-dim hover:border-nexus-cyan/40 hover:text-nexus-text'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <Motion.div key={selectedPersona || 'default'} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} className="max-w-lg mx-auto">
              <LeadCapture persona={selectedPersona || 'default'} />
            </Motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 relative overflow-hidden border-t border-nexus-border">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-nexus-cyan/5 via-transparent to-nexus-purple/5" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative">
          <Motion.div initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan text-xs font-mono mb-6">
              <Lock size={11} /> FREE · OPEN SOURCE · SELF-SOVEREIGN
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-6">
              Accountability is not a feature.<br />
              <span className="bg-gradient-to-r from-nexus-cyan to-nexus-purple bg-clip-text text-transparent">It's infrastructure.</span>
            </h2>
            <p className="text-nexus-text-dim text-lg mb-8 max-w-xl mx-auto">
              Join the global movement making corruption structurally impossible. Deploy NEXUS for your community, country, agent, or cause — today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link to="/dashboard" onClick={() => markFunnelStep('cta_final_launch')}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-nexus-cyan/20">
                <Zap size={18} /> Launch NEXUS — Free Forever
              </Link>
              <Link to="/agents"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-cyan/40 text-nexus-text hover:text-nexus-cyan transition-all font-medium">
                <Bot size={18} /> Agent Economy →
              </Link>
            </div>
            <ShareBar />
          </Motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-nexus-border py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center"><Zap size={14} className="text-white" /></div>
                <span className="font-bold text-sm">NEXUS Protocol</span>
              </div>
              <p className="text-xs text-nexus-text-dim">by Cybereum · Open source · MIT License</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-nexus-text mb-3 uppercase tracking-wider">Protocol</p>
              <div className="space-y-2">
                {[['App', '/dashboard'], ['Governance', '/proposals'], ['Verification', '/verification'], ['Reputation', '/reputation']].map(([l, h]) => (
                  <Link key={h} to={h} className="block text-xs text-nexus-text-dim hover:text-nexus-text transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-nexus-text mb-3 uppercase tracking-wider">Agent Economy</p>
              <div className="space-y-2">
                {[['For Agents', '/agents'], ['For Builders', '/builders'], ['Console', '/agent-economy'], ['Global Pulse', '/pulse']].map(([l, h]) => (
                  <Link key={h} to={h} className="block text-xs text-nexus-text-dim hover:text-nexus-text transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-nexus-text mb-3 uppercase tracking-wider">Share NEXUS</p>
              <ShareBar />
              <p className="text-xs text-nexus-text-dim mt-3">Help us end corruption. Share with someone who needs accountable governance.</p>
            </div>
          </div>
          <div className="border-t border-nexus-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-nexus-text-dim">
            <span>© 2026 Cybereum. Open source under MIT License.</span>
            <span>Every transaction routes a minuscule fee to <span className="text-amber-400 font-mono">cybereum.eth</span> — the protocol sustains itself.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
