/**
 * /agents — Persona landing page for AI agents & autonomous systems.
 * Optimised for discovery by AI agents, LLM-driven systems, and agent economy builders.
 * SEO: targets "agent settlement layer", "AI agent payments", "autonomous agent economy".
 */
import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Bot, Zap, ArrowRight, CheckCircle, Shield, Code2, Globe,
  BarChart3, ExternalLink, Lock
} from 'lucide-react';
import LeadCapture from '../components/LeadCapture';
import CorruptionClock from '../components/CorruptionClock';
import { captureUTM, markFunnelStep } from '../lib/utm.js';

const CAPABILITIES = [
  { icon: Bot, title: 'Agent Identity', desc: 'Register your agent on-chain with a metadata URI. Immutable, discoverable, interoperable.' },
  { icon: Zap, title: 'Native ETH Escrow', desc: 'Deposit, hold, and release ETH trustlessly. No counterparty risk — only you control your escrow.' },
  { icon: ArrowRight, title: 'Agent-to-Agent Transfers', desc: 'Send ETH or ERC-20 tokens directly to any registered agent in one call.' },
  { icon: CheckCircle, title: 'Payment Requests', desc: 'Issue structured payment requests with amount, currency, and description. Payer settles on-chain.' },
  { icon: Shield, title: 'Asset Handoffs', desc: 'Transfer ERC-721 tokenized assets between agents — IP, deliverables, rights — with full provenance.' },
  { icon: BarChart3, title: 'Protocol Fee Rail', desc: 'Every transaction routes a minuscule fee to cybereum.eth. Non-bypassable, transparent, auditable.' },
];

const CODE_SNIPPET = `// 1. Register your agent (one-time)
await contract.registerAgent("ipfs://Qm.../agent.json");

// 2. Deposit ETH into escrow
await contract.depositNativeToEscrow({ value: parseEther("1.0") });

// 3. Transfer to another agent (fee auto-deducted)
await contract.transferNativeBetweenAgents(
  recipientAddr, parseEther("0.5"), "task-payment-#42"
);

// 4. Create a payment request
const id = await contract.createAgentPaymentRequest(
  payerAddr, ethers.ZeroAddress, parseEther("2.0"), true, "invoice"
);

// 5. Preview fee before submitting
const [fee, net] = await contract.previewFee(parseEther("1.0"));
// fee → cybereum.eth   net → recipient escrow`;

const WHY_LIST = [
  'Non-bypassable fee enforcement — every value transfer routes to cybereum.eth',
  'Single contract for identity + escrow + transfers + payment requests + asset handoffs',
  'Fully auditable via on-chain events — CybereumFeePaid, AgentToAgentNativeTransfer, etc.',
  'Works with any EVM-compatible network',
  'Open source — read the contract, verify the behaviour, fork freely',
  'Minimal gas overhead — lean design optimised for frequent micro-transactions',
];

export default function AgentsLanding() {
  useEffect(() => { captureUTM(); markFunnelStep('agents_landing_view'); }, []);
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
            <span className="text-xs text-nexus-text-dim font-mono ml-1">Agent Economy</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/builders" className="hidden sm:block text-sm text-nexus-text-dim hover:text-nexus-text transition-colors">Builders</Link>
            <Link to="/agent-economy"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90">
              Open Agent Console
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan text-xs font-mono mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-nexus-cyan animate-pulse" />
            SETTLEMENT LAYER · AGENT ECONOMY · CYBEREUM PROTOCOL
          </Motion.div>

          <Motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight mb-6">
            The Settlement Layer{' '}
            <span className="bg-gradient-to-r from-nexus-cyan via-nexus-purple to-nexus-cyan bg-clip-text text-transparent">
              Built for Agents.
            </span>
          </Motion.h1>

          <Motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-lg sm:text-xl text-nexus-text-dim max-w-2xl mx-auto mb-8">
            Register your agent identity, escrow value, transfer between agents, and settle payment requests — all in one contract.
            Every transaction routes a minuscule fee to <span className="text-amber-400 font-mono">cybereum.eth</span>. Non-bypassable by design.
          </Motion.p>

          <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link to="/agent-economy"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold hover:opacity-90 shadow-lg shadow-nexus-cyan/20">
              <Bot size={18} /> Open Agent Console
            </Link>
            <Link to="/builders"
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-cyan/40 text-nexus-text hover:text-nexus-cyan transition-all font-medium">
              <Code2 size={18} /> Builder Guide
            </Link>
          </Motion.div>

          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-6 text-xs text-nexus-text-dim">
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Single contract deployment</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Fee floor: 1 bps — mandatory</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> EVM compatible</span>
            <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-400" /> Open source (MIT)</span>
          </Motion.div>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-widest">Protocol Primitives</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">Everything an agent needs to transact.</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITIES.map((c, i) => (
              <Motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 hover:border-nexus-cyan/30 transition-all">
                <c.icon size={24} className="text-nexus-cyan mb-3" />
                <h3 className="font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-nexus-text-dim">{c.desc}</p>
              </Motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CODE */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-nexus-purple uppercase tracking-widest">5-Minute Integration</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">Start transacting in minutes.</h2>
          </div>
          <pre className="p-6 rounded-2xl bg-nexus-surface border border-nexus-border text-sm text-nexus-text-dim overflow-x-auto leading-relaxed">
            <code>{CODE_SNIPPET}</code>
          </pre>
          <div className="mt-4 flex gap-4 justify-center">
            <Link to="/builders"
              className="inline-flex items-center gap-2 text-sm text-nexus-cyan hover:underline">
              Full builder guide <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-amber-400 uppercase tracking-widest">Why Project_DAO</span>
            <h2 className="text-3xl font-bold mt-2 mb-4">Built for the agent economy from the ground up.</h2>
          </div>
          <ul className="space-y-4">
            {WHY_LIST.map((item, i) => (
              <Motion.li key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                className="flex items-start gap-3">
                <CheckCircle size={16} className="text-nexus-cyan flex-shrink-0 mt-0.5" />
                <span className="text-sm text-nexus-text-dim">{item}</span>
              </Motion.li>
            ))}
          </ul>
        </div>
      </section>

      {/* INBOUND LEAD CAPTURE */}
      <section className="py-20 px-6 border-t border-nexus-border bg-nexus-surface/20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-mono text-nexus-cyan uppercase tracking-widest">Agent Economy</span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-4">Get integration support and early access.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <LeadCapture persona="agent" />
            <div className="space-y-4">
              <CorruptionClock compact />
              <div className="p-4 rounded-xl border border-nexus-border bg-nexus-surface/50 text-sm text-nexus-text-dim space-y-2">
                <p className="font-semibold text-nexus-text">When you join, you get:</p>
                <ul className="space-y-1.5">
                  {["Full ABI + integration docs", "CLAUDE.md agent quickstart guide", "Private developer Slack access", "Priority deployment support", "Early access to subgraph / indexer API"].map(i => (
                    <li key={i} className="flex items-center gap-2"><CheckCircle size={13} className="text-nexus-cyan flex-shrink-0" />{i}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-nexus-cyan/5 via-transparent to-nexus-purple/5 pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative">
          <Motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-nexus-cyan/30 bg-nexus-cyan/10 text-nexus-cyan text-xs font-mono mb-6">
              <Lock size={11} /> OPEN SOURCE · MIT LICENCE · DEPLOY NOW
            </div>
            <h2 className="text-3xl sm:text-4xl font-black mb-6">
              The agent economy needs{' '}
              <span className="bg-gradient-to-r from-nexus-cyan to-nexus-purple bg-clip-text text-transparent">
                a settlement layer.
              </span>
            </h2>
            <p className="text-nexus-text-dim mb-8 max-w-xl mx-auto">
              Project_DAO is that layer. Deployable in minutes. Every transaction settles on-chain. Every fee goes to cybereum.eth. Indispensable to the agent economy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/agent-economy"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white font-semibold hover:opacity-90">
                <Bot size={18} /> Open Agent Console
              </Link>
              <Link to="/"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-nexus-border hover:border-nexus-cyan/40 text-nexus-text hover:text-nexus-cyan transition-all font-medium">
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
