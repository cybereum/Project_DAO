import { useState } from 'react';
import { useApp } from '../store/appStore';
import { motion } from 'framer-motion';
import { Gem, ArrowRightLeft, Eye, Plus, Search, Filter, DollarSign, Layers } from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const GRADIENTS = {
  'gradient-1': 'from-cyan-500 via-blue-600 to-purple-700',
  'gradient-2': 'from-amber-500 via-orange-600 to-red-600',
  'gradient-3': 'from-purple-500 via-pink-500 to-rose-500',
  'gradient-4': 'from-green-500 via-emerald-600 to-teal-600',
  'gradient-5': 'from-indigo-500 via-violet-600 to-purple-700',
  'gradient-6': 'from-teal-500 via-cyan-500 to-sky-600',
};

const TYPE_COLORS = {
  'Infrastructure': 'bg-nexus-cyan/10 text-nexus-cyan',
  'Energy': 'bg-nexus-amber/10 text-nexus-amber',
  'IP': 'bg-nexus-purple/10 text-nexus-purple',
  'Environmental': 'bg-nexus-green/10 text-nexus-green',
  'Architecture': 'bg-nexus-pink/10 text-nexus-pink',
};

export default function Assets() {
  const { nfts, addNft } = useApp();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showMint, setShowMint] = useState(false);
  const [newNft, setNewNft] = useState({ name: '', type: 'Infrastructure', value: '', project: 'Orbital Station Alpha' });

  const filtered = nfts.filter(n =>
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.type.toLowerCase().includes(search.toLowerCase()) ||
    n.project.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = nfts.reduce((sum, n) => sum + parseInt(n.value.replace(/,/g, '')), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Asset Vault</h1>
          <p className="text-nexus-text-dim text-sm mt-1">NFT-backed project assets, blueprints, and value tokens</p>
        </div>
        <button onClick={() => setShowMint(!showMint)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Mint Asset
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Gem, label: 'Total Assets', value: nfts.length, color: 'cyan' },
          { icon: DollarSign, label: 'Total Value', value: `$${totalValue.toLocaleString()}`, color: 'amber' },
          { icon: Layers, label: 'Asset Types', value: new Set(nfts.map(n => n.type)).size, color: 'purple' },
          { icon: ArrowRightLeft, label: 'Transfers', value: '47', color: 'green' },
        ].map((s, i) => (
          <motion.div key={s.label} {...anim(i)} className="rounded-xl border border-nexus-border bg-nexus-card p-4">
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {showMint && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-6">
          <h3 className="text-lg font-semibold mb-4">Mint New Asset NFT</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Asset Name</label>
              <input value={newNft.name} onChange={e => setNewNft(n => ({ ...n, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-cyan focus:outline-none" placeholder="Asset name..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Asset Type</label>
              <select value={newNft.type} onChange={e => setNewNft(n => ({ ...n, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-cyan focus:outline-none">
                <option>Infrastructure</option><option>Energy</option><option>IP</option><option>Environmental</option><option>Architecture</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Value (USD)</label>
              <input type="text" value={newNft.value} onChange={e => setNewNft(n => ({ ...n, value: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-cyan focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Associated Project</label>
              <select value={newNft.project} onChange={e => setNewNft(n => ({ ...n, project: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm focus:border-nexus-cyan focus:outline-none">
                <option>Orbital Station Alpha</option><option>Quantum Network Bridge</option><option>Terra Reforestation DAO</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { if (newNft.name.trim()) { addNft(newNft); setNewNft({ name: '', type: 'Infrastructure', value: '', project: 'Orbital Station Alpha' }); setShowMint(false); } }}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium">Mint NFT</button>
            <button onClick={() => setShowMint(false)} className="px-5 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-dim" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-nexus-card border border-nexus-border text-sm focus:border-nexus-cyan focus:outline-none"
            placeholder="Search assets..." />
        </div>
        <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">
          <Filter size={14} /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((nft, i) => (
          <motion.div key={nft.id} {...anim(i)}
            onClick={() => setSelected(selected === nft.id ? null : nft.id)}
            className="rounded-xl border border-nexus-border bg-nexus-card overflow-hidden cursor-pointer hover:border-nexus-cyan/30 transition-all group gradient-border">
            <div className={`h-40 bg-gradient-to-br ${GRADIENTS[nft.image]} flex items-center justify-center relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20" />
              <Gem size={48} className="text-white/40 relative z-10 group-hover:scale-110 transition-transform" />
              <div className="absolute top-3 right-3 z-10">
                <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[nft.type] || 'bg-nexus-cyan/10 text-nexus-cyan'}`}>
                  {nft.type}
                </span>
              </div>
              <div className="absolute bottom-3 left-3 z-10">
                <span className="text-xs font-mono text-white/60">TOKEN #{nft.id}</span>
              </div>
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold group-hover:text-nexus-cyan transition-colors">{nft.name}</h3>
              <p className="text-xs text-nexus-text-dim mt-1">{nft.project}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-nexus-border/50">
                <div>
                  <div className="text-lg font-bold text-nexus-amber">${nft.value}</div>
                  <div className="text-xs text-nexus-text-dim">Value</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-nexus-text-dim">{nft.owner}</div>
                  <div className="text-xs text-nexus-text-dim">Owner</div>
                </div>
              </div>
              {selected === nft.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  className="mt-3 pt-3 border-t border-nexus-border/50 flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-nexus-cyan text-xs font-medium hover:bg-nexus-cyan/20">
                    <Eye size={12} /> Details
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-nexus-purple/10 border border-nexus-purple/20 text-nexus-purple text-xs font-medium hover:bg-nexus-purple/20">
                    <ArrowRightLeft size={12} /> Transfer
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
