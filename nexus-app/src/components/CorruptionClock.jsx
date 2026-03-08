/**
 * CorruptionClock — real-time ticking counter.
 *
 * $2.6 trillion lost to corruption per year = $82,384.81 per second.
 * The number ticks every 100ms making the loss viscerally, unavoidably real.
 * This is the core emotional hook of the landing page.
 */
import { useState, useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Zap } from 'lucide-react';

const LOSS_PER_SECOND = 82_384.81;   // $2.6T / 31,536,000 seconds
const TICK_MS = 100;                  // update every 100ms

function formatDollars(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n).toLocaleString()}`;
  return `$${n.toFixed(2)}`;
}

/**
 * Digit flip animation — each digit animates independently for a mechanical clock feel.
 */
function Digit({ value }) {
  return (
    <AnimatePresence mode="popLayout">
      <Motion.span
        key={value}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.12, ease: 'easeInOut' }}
        className="inline-block tabular-nums"
      >
        {value}
      </Motion.span>
    </AnimatePresence>
  );
}

function AnimatedNumber({ value }) {
  const str = Math.round(value).toLocaleString();
  return (
    <span className="inline-flex">
      {str.split('').map((ch, i) => (
        <span key={i} className="inline-block min-w-[0.6em] text-center overflow-hidden">
          {/\d/.test(ch) ? <Digit value={ch} /> : ch}
        </span>
      ))}
    </span>
  );
}

/**
 * CorruptionClock — standalone component, drops anywhere.
 *
 * Props:
 *  - compact: boolean  — smaller inline version for nav/banners
 *  - showSolution: boolean — show the "NEXUS makes this impossible" tagline
 */
export default function CorruptionClock({ compact = false, showSolution = true }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed((Date.now() - startRef.current) / 1000);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const lost = elapsed * LOSS_PER_SECOND;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 text-xs font-mono">
        <AlertTriangle size={11} className="text-red-400 flex-shrink-0" />
        <span className="text-red-400">
          ${Math.round(lost).toLocaleString()} lost to corruption since you arrived
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center space-y-3">
      <div className="flex items-center justify-center gap-2 text-xs font-mono text-red-400 uppercase tracking-widest">
        <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
        Live Corruption Loss Counter
      </div>

      <div className="text-4xl sm:text-5xl font-black text-red-400 font-mono leading-none tracking-tighter">
        $<AnimatedNumber value={lost} />
      </div>

      <p className="text-xs text-nexus-text-dim">
        Stolen by corruption since you opened this page
      </p>

      <div className="flex items-center justify-center gap-4 text-xs text-nexus-text-dim pt-1 border-t border-red-500/10">
        <span>$82,385 / second</span>
        <span className="w-px h-3 bg-white/10" />
        <span>$2.6 trillion / year</span>
        <span className="w-px h-3 bg-white/10" />
        <span>180+ countries</span>
      </div>

      {showSolution && (
        <div className="flex items-center justify-center gap-2 text-xs text-nexus-cyan pt-1">
          <Zap size={11} />
          NEXUS makes this structurally impossible
        </div>
      )}
    </div>
  );
}
