import { useApp } from '../store/appStore';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  FolderKanban, Users, Milestone as MilestoneIcon, Vote, TrendingUp,
  ArrowUpRight, Clock, Zap, Activity, Shield, Bot, Brain, Lightbulb,
  ChevronRight, Rocket, AlertTriangle
} from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

function StatCard({ icon: Icon, label, value, change, color, index }) {
  const colorMap = {
    cyan: 'from-nexus-cyan/20 to-nexus-cyan/5 border-nexus-cyan/20 text-nexus-cyan',
    purple: 'from-nexus-purple/20 to-nexus-purple/5 border-nexus-purple/20 text-nexus-purple',
    green: 'from-nexus-green/20 to-nexus-green/5 border-nexus-green/20 text-nexus-green',
    pink: 'from-nexus-pink/20 to-nexus-pink/5 border-nexus-pink/20 text-nexus-pink',
    amber: 'from-nexus-amber/20 to-nexus-amber/5 border-nexus-amber/20 text-nexus-amber',
  };
  return (
    <Motion.div {...anim(index)} className={`rounded-xl border bg-gradient-to-br ${colorMap[color]} p-5`}>
      <div className="flex items-center justify-between mb-3">
        {Icon && <Icon size={22} className={`text-nexus-${color}`} />}
        {change && (
          <span className="flex items-center gap-1 text-xs text-nexus-green">
            <ArrowUpRight size={12} />{change}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-nexus-text">{value}</div>
      <div className="text-xs text-nexus-text-dim mt-1">{label}</div>
    </Motion.div>
  );
}

export default function Dashboard() {
  const { projects, milestones, proposals, members, agentProfile, featureKits } = useApp();

  const activityData = [
    { name: 'Mon', proposals: 4, tasks: 8, milestones: 2 },
    { name: 'Tue', proposals: 3, tasks: 12, milestones: 1 },
    { name: 'Wed', proposals: 7, tasks: 6, milestones: 3 },
    { name: 'Thu', proposals: 2, tasks: 15, milestones: 2 },
    { name: 'Fri', proposals: 5, tasks: 10, milestones: 4 },
    { name: 'Sat', proposals: 1, tasks: 4, milestones: 1 },
    { name: 'Sun', proposals: 3, tasks: 7, milestones: 2 },
  ];

  const statusData = [
    { name: 'Completed', value: milestones.filter(m => m.status === 'Completed').length, color: '#10b981' },
    { name: 'In Progress', value: milestones.filter(m => m.status === 'In Progress').length, color: '#06b6d4' },
    { name: 'Pending', value: milestones.filter(m => m.status === 'Pending').length, color: '#94a3b8' },
  ];

  const valueData = [
    { name: 'Jan', value: 1200 }, { name: 'Feb', value: 1800 },
    { name: 'Mar', value: 2400 }, { name: 'Apr', value: 3100 },
    { name: 'May', value: 4200 }, { name: 'Jun', value: 5800 },
  ];

  const activeProposals = proposals.filter(p => p.status === 'Active');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Command Center</h1>
          <p className="text-nexus-text-dim text-sm mt-1">Protocol-wide operational overview</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-nexus-green/10 border border-nexus-green/20">
          <Activity size={14} className="text-nexus-green" />
          <span className="text-xs text-nexus-green font-medium">All Systems Nominal</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={FolderKanban} label="Active Projects" value={projects.filter(p => p.status === 'Active').length} change="+2" color="cyan" index={0} />
        <StatCard icon={Users} label="Contributors" value={members.length} change="+5" color="purple" index={1} />
        <StatCard icon={MilestoneIcon} label="Milestones" value={milestones.length} color="green" index={2} />
        <StatCard icon={Vote} label="Active Proposals" value={activeProposals.length} color="pink" index={3} />
        <StatCard icon={TrendingUp} label="Total Value Locked" value="$11.6M" change="+12%" color="amber" index={4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Motion.div {...anim(5)} className="lg:col-span-2 rounded-xl border border-nexus-border bg-nexus-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-nexus-cyan" />
            Weekly Activity
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activityData}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="tasks" fill="#06b6d4" radius={[4,4,0,0]} />
              <Bar dataKey="proposals" fill="#a855f7" radius={[4,4,0,0]} />
              <Bar dataKey="milestones" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Motion.div>

        <Motion.div {...anim(6)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <MilestoneIcon size={16} className="text-nexus-green" />
            Milestone Status
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-xs text-nexus-text-dim">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </Motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Motion.div {...anim(7)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp size={16} className="text-nexus-amber" />
              Value Accumulation
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={valueData}>
              <defs>
                <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#06b6d4" fill="url(#valueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Motion.div>

        <Motion.div {...anim(8)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Vote size={16} className="text-nexus-pink" />
              Active Proposals
            </h3>
            <Link to="/proposals" className="text-xs text-nexus-cyan hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {activeProposals.slice(0, 4).map(p => {
              const total = p.yesVotes + p.noVotes;
              const pct = total > 0 ? Math.round((p.yesVotes / total) * 100) : 0;
              return (
                <div key={p.id} className="p-3 rounded-lg bg-nexus-bg/50 border border-nexus-border/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium leading-snug">{p.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-nexus-cyan/10 text-nexus-cyan whitespace-nowrap">{p.yesVotes + p.noVotes} votes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-nexus-border overflow-hidden">
                      <div className="h-full rounded-full bg-nexus-green transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-nexus-text-dim">{pct}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-nexus-text-dim">
                    <Clock size={10} />
                    <span>Ends {p.deadline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Motion.div>
      </div>

      <Motion.div {...anim(9)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Shield size={16} className="text-nexus-purple" />
            Top Contributors
          </h3>
          <Link to="/reputation" className="text-xs text-nexus-cyan hover:underline">Leaderboard</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {members.slice(0, 4).map((m, i) => (
            <div key={m.address} className="flex items-center gap-3 p-3 rounded-lg bg-nexus-bg/50 border border-nexus-border/50">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                i === 0 ? 'bg-nexus-amber/20 text-nexus-amber' :
                i === 1 ? 'bg-nexus-cyan/20 text-nexus-cyan' :
                i === 2 ? 'bg-nexus-purple/20 text-nexus-purple' :
                'bg-nexus-green/20 text-nexus-green'
              }`}>
                #{i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.name}</div>
                <div className="text-xs text-nexus-text-dim">{m.role}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-nexus-green">{m.reputation}</div>
                <div className="text-xs text-nexus-text-dim">REP</div>
              </div>
            </div>
          ))}
        </div>
      </Motion.div>

      {/* ── Agent Intelligence Hub ── */}
      <Motion.div {...anim(10)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Economy status */}
        <div className="rounded-xl border border-nexus-border bg-gradient-to-br from-nexus-cyan/10 to-nexus-cyan/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bot size={16} className="text-nexus-cyan" />
              Agent Economy
            </h3>
            <Link to="/agent-economy" className="flex items-center gap-1 text-xs text-nexus-cyan hover:underline">
              Open <ChevronRight size={12} />
            </Link>
          </div>
          {agentProfile?.registered ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-nexus-green animate-pulse" />
                <span className="text-xs text-nexus-green font-medium">Agent Registered</span>
              </div>
              <div className="text-xs text-nexus-text-dim">
                Escrow: <span className="text-nexus-text font-mono">{agentProfile.nativeEscrowBalance} wei</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-nexus-amber" />
                <span className="text-xs text-nexus-amber">Not registered</span>
              </div>
              <p className="text-xs text-nexus-text-dim">Register as an agent to access escrow, transfers, and payment requests.</p>
              <Link to="/agent-economy" className="block text-center text-xs px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-nexus-cyan hover:bg-nexus-cyan/20 transition-colors">
                Register Agent →
              </Link>
            </div>
          )}
        </div>

        {/* NexusAI self-improvement */}
        <div className="rounded-xl border border-nexus-border bg-gradient-to-br from-nexus-purple/10 to-nexus-purple/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Brain size={16} className="text-nexus-purple" />
              NexusAI
            </h3>
            <Link to="/nexus-ai" className="flex items-center gap-1 text-xs text-nexus-cyan hover:underline">
              Open <ChevronRight size={12} />
            </Link>
          </div>
          <p className="text-xs text-nexus-text-dim mb-3">
            Claude claude-opus-4-6 analyses live source files and generates prioritised improvements for the protocol.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Health Scan', color: 'text-nexus-green', path: '/nexus-ai' },
              { label: 'Security Audit', color: 'text-red-400', path: '/nexus-ai' },
              { label: 'UX Review', color: 'text-nexus-cyan', path: '/nexus-ai' },
              { label: 'Growth Analysis', color: 'text-nexus-amber', path: '/nexus-ai' },
            ].map(({ label, color, path }) => (
              <Link key={label} to={path} className={`text-xs px-2 py-1.5 rounded-lg bg-white/5 border border-nexus-border hover:border-nexus-purple/30 ${color} transition-colors text-center`}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Feature Kit pipeline */}
        <div className="rounded-xl border border-nexus-border bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb size={16} className="text-amber-400" />
              Feature Kits
            </h3>
            <Link to="/feature-kits" className="flex items-center gap-1 text-xs text-nexus-cyan hover:underline">
              Open <ChevronRight size={12} />
            </Link>
          </div>
          {featureKits.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg py-2">
                  <div className="text-lg font-bold text-nexus-text font-mono">{featureKits.filter(k => k.status === 0).length}</div>
                  <div className="text-xs text-nexus-text-dim">Pending</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2">
                  <div className="text-lg font-bold text-nexus-cyan font-mono">{featureKits.filter(k => k.status === 2).length}</div>
                  <div className="text-xs text-nexus-text-dim">Queued</div>
                </div>
                <div className="bg-white/5 rounded-lg py-2">
                  <div className="text-lg font-bold text-nexus-green font-mono">{featureKits.filter(k => k.status === 4).length}</div>
                  <div className="text-xs text-nexus-text-dim">Done</div>
                </div>
              </div>
              <Link to="/feature-kits" className="block text-center text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors">
                View Pipeline →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-nexus-text-dim">No feature kits submitted yet. Agents can request protocol improvements here.</p>
              <Link to="/feature-kits" className="block text-center text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors">
                Submit First Kit →
              </Link>
            </div>
          )}
        </div>
      </Motion.div>
    </div>
  );
}
