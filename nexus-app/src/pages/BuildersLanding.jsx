/**
 * /builders — Persona landing page for developers integrating Project_DAO.
 * SEO: "build on agent settlement layer", "DAO smart contract integration", "NEXUS Protocol developers".
 */
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Code2, Zap, ArrowRight, CheckCircle, FileCode, Globe,
  Terminal, BookOpen, GitFork, Shield, ExternalLink, Lock
} from 'lucide-react';
import LeadCapture from '../components/LeadCapture';
import { captureUTM, markFunnelStep } from '../lib/utm.js';

const STEPS = [
  {
    step: '01', icon: GitFork, title: 'Clone & deploy',
    desc: 'Fork the repo. Deploy Project_DAO.sol to your target EVM network.',
    code: 'git clone https://github.com/cybereum/Project_DAO\ncd Project_DAO/contracts\n# Deploy with Hardhat or Foundry',
  },
  {
    step: '02', icon: Shield, title: 'Configure Cybereum fee rail',
    desc: 'Set the treasury to cybereum.eth resolved address. Fee floor is enforced at 1 bps — cannot be zeroed.',
    code: 'await contract.setCybereumTreasury(\n  "0x<cybereum_eth_resolved_address>"\n);\n// Optional: tune fee (min 1 bps, max 100 bps)\nawait contract.setCybereumFeeConfig(5, 1e12);',
  },
  {
    step: '03', icon: Code2, title: 'Integrate ABI in your app',
    desc: 'Import the full ABI from nexus-app/src/config/contract.js. All agent functions, events, and reads are defined.',
    code: 'import { PROJECT_DAO_ABI, PROJECT_DAO_ADDRESS }\n  from "./config/contract";\n\nconst contract = new Contract(\n  PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, signer\n);',
  },
  {
    step: '04', icon: Terminal, title: 'Call agent functions',
    desc: 'Agents register, deposit, transfer, and settle with single-function calls. All events are emitted for indexing.',
    code: 'await contract.registerAgent("ipfs://Qm.../profile.json");\nawait contract.depositNativeToEscrow({ value: parseEther("1") });\nawait contract.transferNativeBetweenAgents(\n  toAddr, parseEther("0.5"), "memo"\n);',
  },
];

const CONTRACT_FEATURES = [
  { label: 'Solidity version', value: '^0.8.0' },
  { label: 'License', value: 'MIT' },
  { label: 'Rails', value: 'Native ETH · ERC-20 · ERC-721' },
  { label: 'Fee range', value: '1–100 bps (configurable)' },
  { label: 'Fee floor', value: 'MIN_FEE_BPS = 1 (non-bypassable)' },
  { label: 'Treasury', value: 'cybereum.eth (owner-set)' },
  { label: 'Governance', value: 'Proposals · Milestones · Disputes' },
  { label: 'Identity', value: 'Member + Agent profiles (IPFS metadata)' },
];

const RESOURCES = [
  { icon: BookOpen, title: 'CLAUDE.md', desc: 'Agent-first quickstart — protocol reference, ABI, fee math, integration checklist.', link: '/', linkLabel: 'Read in repo' },
  { icon: FileCode, title: 'AGENT_TX_QUICKSTART.md', desc: 'Minimal Solidity-level quickstart for immediate agent onboarding.', link: '/', linkLabel: 'Read in repo' },
  { icon: BookOpen, title: 'FULL_IMPLEMENTATION_PLAN.md', desc: 'Complete program roadmap — contract hardening, agent UX, SEO, indexing, CI gates.', link: '/', linkLabel: 'Read in repo' },
  { icon: Code2, title: 'Agent Economy Console', desc: 'React UI for agent registration, escrow, transfers, and payment requests.', link: '/agent-economy', linkLabel: 'Open Console' },
];

export default function BuildersLanding() {
  useEffect(() => { captureUTM(); markFunnelStep('builders_landing_view'); }, []);
  return (
    <div className="min-h-screen bg-nexus-bg text-nexus-text">

      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-nexus-bg/80 backdrop-blur-md border-b border-nexus-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
            <span className="text-xs text-nexus-text-dim font-mono ml-1">Builders</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/agents" className="hidden sm:block text-sm text-nexus-text-dim hover:text-nexus-text transition-colors">Agents</Link>
            <Link to="/agent-economy"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90">
              Agent Console
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-purple/30 bg-nexus-purple/10 text-nexus-purple text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-nexus-purple animate-pulse" />
            BUILDERS · DEVELOPERS · INTEGRATORS
          </Motion.div>

          <Motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
            Build on the{' '}
            <span className="bg-gradient-to-r from-nexus-purple via-nexus-cyan to-nexus-purple bg-clip-text text-transparent">
              Agent Economy.
            </span>
          </Motion.h1>

          <Motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-lg sm:text-xl text-nexus-text-dim max-w-2xl mx-auto mb-8">
            Project_DAO is a production-grade settlement layer you can deploy in minutes.
            One contract handles identity, escrow, transfers, payment requests, asset handoffs, and DAO governance — with non-bypassable fee routing to <span className="text-amber-400 font-mono">cybereum.eth</span>.
          </Motion.p>

          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/agent-economy"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-purple to-nexus-cyan text-white font-semibold hover:opacity-90">
              <Code2 size={18} /> Open Agent Console
            </Link>
            <Link to="/agents"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-purple/40 text-nexus-text hover:text-nexus-purple transition-all font-medium">
              Agent Quickstart
              <ArrowRight size={18} />
            </Link>
          </Motion.div>
        </div>
      </section>

      {/* INTEGRATION STEPS */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-nexus-purple uppercase tracking-widest">Integration Playbook</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">From zero to production in 4 steps.</h2>
          </div>
          <div className="space-y-8">
            {STEPS.map((s, i) => (
              <Motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50">
                <div className="flex gap-4">
                  <span className="text-3xl font-black text-nexus-purple/20 font-mono w-10 flex-shrink-0">{s.step}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <s.icon size={18} className="text-nexus-purple" />
                      <h3 className="font-bold">{s.title}</h3>
                    </div>
                    <p className="text-sm text-nexus-text-dim">{s.desc}</p>
                  </div>
                </div>
                <pre className="p-4 rounded-xl bg-nexus-bg border border-nexus-border text-xs text-nexus-text-dim overflow-x-auto leading-relaxed">
                  <code>{s.code}</code>
                </pre>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTRACT REFERENCE */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-widest">Contract Specs</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">Know what you're building on.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONTRACT_FEATURES.map(({ label, value }) => (
              <div key={label} className="flex justify-between p-4 rounded-xl border border-nexus-border bg-nexus-surface/50 text-sm">
                <span className="text-nexus-text-dim">{label}</span>
                <span className="font-mono text-nexus-cyan">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESOURCES */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Documentation</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">Everything you need to ship.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {RESOURCES.map((r, i) => (
              <Motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 hover:border-nexus-purple/30 transition-all">
                <r.icon size={20} className="text-nexus-purple mb-3" />
                <h3 className="font-bold mb-2">{r.title}</h3>
                <p className="text-sm text-nexus-text-dim mb-4">{r.desc}</p>
                <Link to={r.link} className="inline-flex items-center gap-1 text-xs text-nexus-purple hover:underline">
                  {r.linkLabel} <ExternalLink size={11} />
                </Link>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BUILDER INBOUND — Demo + Dev Access */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-mono text-nexus-purple uppercase tracking-widest">Get Started</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">Book a demo or request dev access.</h2>
            <p className="text-nexus-text-dim max-w-xl mx-auto">We work directly with builders. Tell us what you're building and we'll get you set up fast.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LeadCapture persona="builder" />
            <LeadCapture persona="enterprise"
              overrides={{ headline: 'Book a 30-min integration demo', cta: 'Book Demo' }} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nexus-purple/5 via-transparent to-nexus-cyan/5 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <Motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-purple/30 bg-nexus-purple/10 text-nexus-purple text-xs font-mono mb-6">
              <Lock size={11} /> MIT LICENSE · EVM COMPATIBLE · PRODUCTION READY
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-6">
              The agent economy is here.{' '}
              <span className="bg-gradient-to-r from-nexus-purple to-nexus-cyan bg-clip-text text-transparent">
                Build the infrastructure.
              </span>
            </h2>
            <p className="text-nexus-text-dim mb-8 max-w-xl mx-auto">
              Every transaction. Every fee to cybereum.eth. Every settlement on-chain. This is the layer the agent economy runs on.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/agent-economy"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-purple to-nexus-cyan text-white font-semibold hover:opacity-90">
                <Code2 size={18} /> Start Building
              </Link>
              <Link to="/"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-purple/40 text-nexus-text hover:text-nexus-purple transition-all font-medium">
                <Globe size={18} /> NEXUS Protocol Home
              </Link>
            </div>
          </Motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-nexus-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm">NEXUS Protocol</span>
            <span className="text-xs text-nexus-text-dim">by Cybereum</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-nexus-text-dim">
            <Link to="/agents" className="hover:text-nexus-text">Agents</Link>
            <Link to="/builders" className="hover:text-nexus-text">Builders</Link>
            <Link to="/agent-economy" className="hover:text-nexus-text">Console</Link>
            <Link to="/" className="hover:text-nexus-text">Home</Link>
          </div>
          <div className="text-xs text-nexus-text-dim">Open source · MIT License</div>
        </div>
      </footer>
    </div>
  );
}
