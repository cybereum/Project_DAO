import { useState } from 'react';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Milestone as MIcon, CheckCircle2, Clock, DollarSign, Users, TrendingUp } from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const STATUS_STYLES = {
  'Completed': { bg: 'bg-nexus-green/10', text: 'text-nexus-green', border: 'border-nexus-green/20', bar: '#10b981' },
  'In Progress': { bg: 'bg-nexus-cyan/10', text: 'text-nexus-cyan', border: 'border-nexus-cyan/20', bar: '#06b6d4' },
  'Pending': { bg: 'bg-nexus-text-dim/10', text: 'text-nexus-text-dim', border: 'border-nexus-border', bar: '#64748b' },
};

export default function Milestones() {
  const { milestones, projects } = useApp();
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? milestones : milestones.filter(m => m.status === filter);

  const chartData = milestones.map(m => ({
    name: m.name.length > 15 ? m.name.slice(0, 15) + '...' : m.name,
    progress: m.progress,
    status: m.status,
  }));

  const parseAmount = (amount) => parseInt(String(amount).replace(/,/g, '')) || 0;
  const totalValue = milestones.reduce((sum, m) => sum + parseAmount(m.amount), 0);
  const completedValue = milestones.filter(m => m.status === 'Completed').reduce((sum, m) => sum + parseAmount(m.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-glow-cyan">Milestone Tracker</h1>
        <p className="text-nexus-text-dim text-sm mt-1">Track deliverables, payments, and contractor progress</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: MIcon, label: 'Total Milestones', value: milestones.length, color: 'cyan' },
          { icon: CheckCircle2, label: 'Completed', value: milestones.filter(m => m.status === 'Completed').length, color: 'green' },
          { icon: DollarSign, label: 'Total Value', value: `$${totalValue.toLocaleString()}`, color: 'amber' },
          { icon: TrendingUp, label: 'Value Delivered', value: `$${completedValue.toLocaleString()}`, color: 'purple' },
        ].map((s, i) => (
          <Motion.div key={s.label} {...anim(i)} className="rounded-xl border border-nexus-border bg-nexus-card p-4">
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </Motion.div>
        ))}
      </div>

      <Motion.div {...anim(4)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h3 className="text-sm font-semibold mb-4">Progress Overview</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="progress" radius={[0,4,4,0]}>
              {chartData.map((entry, i) => <Cell key={i} fill={STATUS_STYLES[entry.status]?.bar || '#64748b'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Motion.div>

      <div className="flex items-center gap-2">
        {['All', 'Completed', 'In Progress', 'Pending'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? 'bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/20' : 'text-nexus-text-dim hover:bg-white/5 border border-transparent'
            }`}>
            {s} {s !== 'All' && `(${milestones.filter(m => m.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((m, i) => {
          const project = projects.find(p => p.id === m.projectId);
          const style = STATUS_STYLES[m.status];
          return (
            <Motion.div key={m.id} {...anim(i)}
              className="rounded-xl border border-nexus-border bg-nexus-card p-5 hover:border-nexus-cyan/20 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>{m.status}</span>
                    {project && <span className="text-xs text-nexus-text-dim">{project.name}</span>}
                  </div>
                  <h3 className="text-lg font-semibold">{m.name}</h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-nexus-amber">${m.amount}</div>
                  <div className="text-xs text-nexus-text-dim">Milestone Value</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-2 rounded-full bg-nexus-border overflow-hidden progress-bar">
                  <div className={`h-full rounded-full transition-all ${m.status === 'Completed' ? 'bg-nexus-green' : 'bg-gradient-to-r from-nexus-cyan to-nexus-purple'}`}
                    style={{ width: `${m.progress}%` }} />
                </div>
                <span className="text-sm font-mono font-bold" style={{ color: style.bar }}>{m.progress}%</span>
              </div>
              <div className="flex items-center gap-6 text-xs text-nexus-text-dim">
                <span className="flex items-center gap-1"><Clock size={12} /> Deadline: {m.deadline}</span>
                <span className="flex items-center gap-1"><Users size={12} /> {m.contractors} contractors</span>
                <span className="flex items-center gap-1"><MIcon size={12} /> ID: #{m.id}</span>
              </div>
            </Motion.div>
          );
        })}
      </div>
    </div>
  );
}
