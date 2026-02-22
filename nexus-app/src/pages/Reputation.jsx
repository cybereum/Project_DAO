import { useApp } from '../store/appStore';
import { motion } from 'framer-motion';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Trophy, Star, Medal, Target, TrendingUp, Award, Crown, Zap } from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const RANK_STYLES = [
  { bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/10', border: 'border-amber-500/30', icon: Crown, color: 'text-amber-400', glow: 'glow-cyan' },
  { bg: 'bg-gradient-to-br from-gray-300/20 to-gray-400/10', border: 'border-gray-400/30', icon: Medal, color: 'text-gray-300', glow: '' },
  { bg: 'bg-gradient-to-br from-orange-600/20 to-orange-700/10', border: 'border-orange-600/30', icon: Medal, color: 'text-orange-400', glow: '' },
];

export default function Reputation() {
  const { members } = useApp();

  const sorted = [...members].sort((a, b) => b.reputation - a.reputation);

  const radarData = [
    { subject: 'Task Completion', A: 95, fullMark: 100 },
    { subject: 'On-Time Delivery', A: 88, fullMark: 100 },
    { subject: 'Code Quality', A: 92, fullMark: 100 },
    { subject: 'Collaboration', A: 85, fullMark: 100 },
    { subject: 'Communication', A: 90, fullMark: 100 },
    { subject: 'Innovation', A: 78, fullMark: 100 },
  ];

  const barColors = ['#f59e0b', '#94a3b8', '#c2410c', '#06b6d4', '#a855f7', '#10b981', '#ec4899', '#64748b'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-glow-cyan">Reputation Leaderboard</h1>
        <p className="text-nexus-text-dim text-sm mt-1">Contributor rankings, reputation scores, and performance metrics</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Trophy, label: 'Top Score', value: sorted[0]?.reputation || 0, color: 'amber' },
          { icon: Star, label: 'Avg Score', value: members.length > 0 ? Math.round(members.reduce((s, m) => s + m.reputation, 0) / members.length) : 0, color: 'cyan' },
          { icon: Target, label: 'Total Tasks', value: members.reduce((s, m) => s + m.tasks, 0), color: 'purple' },
          { icon: TrendingUp, label: 'Completion Rate', value: `${members.reduce((s, m) => s + m.tasks, 0) > 0 ? Math.round(members.reduce((s, m) => s + m.completed, 0) / members.reduce((s, m) => s + m.tasks, 0) * 100) : 0}%`, color: 'green' },
        ].map((s, i) => (
          <motion.div key={s.label} {...anim(i)} className="rounded-xl border border-nexus-border bg-nexus-card p-4">
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div {...anim(4)} className="lg:col-span-2 rounded-xl border border-nexus-border bg-nexus-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Trophy size={16} className="text-nexus-amber" /> Rankings
          </h3>
          <div className="space-y-2">
            {sorted.map((member, i) => {
              const rankStyle = RANK_STYLES[i];
              const completionRate = member.tasks > 0 ? Math.round((member.completed / member.tasks) * 100) : 0;
              return (
                <motion.div key={member.address} {...anim(i + 5)}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                    rankStyle
                      ? `${rankStyle.bg} ${rankStyle.border} ${rankStyle.glow}`
                      : 'bg-nexus-bg/30 border-nexus-border/50 hover:border-nexus-cyan/20'
                  }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                    rankStyle ? rankStyle.color : 'text-nexus-text-dim'
                  }`}>
                    {rankStyle ? <rankStyle.icon size={20} /> : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{member.name}</span>
                      {i === 0 && <Zap size={14} className="text-amber-400" />}
                    </div>
                    <div className="text-xs text-nexus-text-dim">{member.role} &middot; {member.address}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-sm font-bold">{member.completed}/{member.tasks}</div>
                      <div className="text-xs text-nexus-text-dim">Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold">{completionRate}%</div>
                      <div className="text-xs text-nexus-text-dim">Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold">{member.votingPower}</div>
                      <div className="text-xs text-nexus-text-dim">VP</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-black ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-nexus-cyan'}`}>
                      {member.reputation}
                    </div>
                    <div className="text-xs text-nexus-text-dim">REP</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div {...anim(5)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Award size={16} className="text-nexus-purple" /> Performance Radar
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e293b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div {...anim(6)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Star size={16} className="text-nexus-amber" /> Score Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sorted.map(m => ({ name: m.name.split(' ')[0], score: m.reputation }))}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="score" radius={[4,4,0,0]}>
                  {sorted.map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
