import { createElement, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store/appStore';
import {
  LayoutDashboard, FolderKanban, Milestone, Vote, ShieldCheck,
  Trophy, Gem, Wallet, Zap, ChevronRight, Globe,
  AlertTriangle, ArrowLeft, Radio, Bot, Brain, Lightbulb, ClipboardCheck
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/agent-economy', label: 'Agent Economy', icon: Bot, accent: true },
  { path: '/nexus-ai', label: 'NexusAI', icon: Brain, accent: true },
  { path: '/feature-kits', label: 'Feature Kits', icon: Lightbulb, accent: true },
  { path: '/agent-readiness', label: 'Agent Audit', icon: ClipboardCheck, accent: true },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/milestones', label: 'Milestones', icon: Milestone },
  { path: '/proposals', label: 'Proposals', icon: Vote },
  { path: '/verification', label: 'Verification', icon: ShieldCheck },
  { path: '/reputation', label: 'Reputation', icon: Trophy },
  { path: '/assets', label: 'Assets', icon: Gem },
  { path: '/pulse', label: 'Global Pulse', icon: Radio, highlight: true },
];

function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  return (
    <aside className={`fixed left-0 top-0 h-screen z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'} bg-nexus-surface border-r border-nexus-border flex flex-col`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-nexus-border">
        {!collapsed && (
          <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">NEXUS</span>
          </Motion.div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-cyan to-nexus-purple flex items-center justify-center mx-auto">
            <Zap size={18} className="text-white" />
          </div>
        )}
      </div>
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon, highlight, accent }) => {
          const isActive = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
          return (
            <NavLink key={path} to={path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                isActive
                  ? accent
                    ? 'bg-nexus-cyan/15 text-nexus-cyan border border-nexus-cyan/20'
                    : 'bg-nexus-cyan/10 text-nexus-cyan'
                  : highlight
                  ? 'text-amber-400 hover:bg-amber-500/10'
                  : accent
                  ? 'text-nexus-cyan/70 hover:text-nexus-cyan hover:bg-nexus-cyan/5'
                  : 'text-nexus-text-dim hover:text-nexus-text hover:bg-white/5'
              }`}
            >
              {isActive && (
                <Motion.div layoutId="nav-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-nexus-cyan rounded-r" />
              )}
              {createElement(Icon, {
                size: 20,
                className: isActive
                  ? 'text-nexus-cyan'
                  : highlight
                  ? 'text-amber-400'
                  : accent
                  ? 'text-nexus-cyan/70 group-hover:text-nexus-cyan'
                  : 'group-hover:text-nexus-text'
              })}
              {!collapsed && (
                <span className="text-sm font-medium flex items-center gap-2">
                  {label}
                  {highlight && !isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  {accent && !isActive && <span className="text-xs px-1.5 py-0.5 rounded bg-nexus-cyan/10 text-nexus-cyan font-mono leading-none">NEW</span>}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-nexus-border">
        <button onClick={onToggle} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-nexus-text-dim hover:text-nexus-text hover:bg-white/5 transition-colors">
          <ChevronRight size={16} className={`transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

function DemoBanner({ walletConnected }) {
  const [dismissed, setDismissed] = useState(false);
  if (walletConnected || dismissed) return null;
  return (
    <div className="bg-nexus-cyan/10 border-b border-nexus-cyan/20 px-6 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-xs text-nexus-cyan">
        <AlertTriangle size={13} />
        <span>
          <strong>Demo Mode</strong> — All data is simulated. Connect a wallet to interact on-chain, or explore freely without one.
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link to="/" className="text-xs text-nexus-cyan/70 hover:text-nexus-cyan flex items-center gap-1 transition-colors">
          <ArrowLeft size={11} /> Back to home
        </Link>
        <button onClick={() => setDismissed(true)} className="text-xs text-nexus-text-dim hover:text-nexus-text transition-colors">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function TopBar() {
  const { walletConnected, walletAddress, walletError, txPending, connectWallet } = useApp();
  return (
    <>
      <header className="h-16 border-b border-nexus-border bg-nexus-surface/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Globe size={16} className="text-nexus-cyan animate-pulse-glow" />
          <span className="text-xs text-nexus-text-dim font-mono">NETWORK: ETHEREUM MAINNET</span>
          <span className="w-2 h-2 rounded-full bg-nexus-green animate-pulse" />
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-nexus-text-dim font-mono hidden sm:block">
            BLOCK: #19,847,293
          </div>
          {walletConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20">
              <div className="w-2 h-2 rounded-full bg-nexus-green" />
              <span className="text-xs font-mono text-nexus-cyan">{walletAddress}</span>
            </div>
          ) : (
            <button onClick={connectWallet}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity">
              <Wallet size={16} />
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <DemoBanner walletConnected={walletConnected} />

      {(txPending || walletError) && (
        <div className="px-6 pt-2">
          {txPending && <p className="text-xs text-nexus-amber">Transaction pending confirmation...</p>}
          {walletError && <p className="text-xs text-red-400">{walletError}</p>}
        </div>
      )}
    </>
  );
}

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  return (
    <div className="min-h-screen bg-nexus-bg grid-bg">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-all duration-300 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <TopBar />
        <main className="p-6">
          <AnimatePresence mode="wait">
            <Motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {children}
            </Motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
