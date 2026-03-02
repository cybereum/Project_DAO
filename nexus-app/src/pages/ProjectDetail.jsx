import { useParams, Link } from 'react-router-dom';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import {
  ArrowLeft, Users, Milestone, CheckCircle2, Clock, AlertTriangle,
  Plus, ChevronRight, Zap
} from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const STATUS_BADGE = {
  'Completed': 'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  'In Progress': 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  'Pending': 'bg-nexus-text-dim/10 text-nexus-text-dim border-nexus-border',
};

const PRIORITY_BADGE = {
  'Critical': 'bg-nexus-red/10 text-nexus-red',
  'High': 'bg-nexus-amber/10 text-nexus-amber',
  'Medium': 'bg-nexus-cyan/10 text-nexus-cyan',
  'Low': 'bg-nexus-green/10 text-nexus-green',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const { projects, milestones, tasks, members, proposals } = useApp();
  const project = projects.find(p => p.id === Number(id));
  if (!project) return <div className="text-nexus-text-dim">Project not found.</div>;

  const projMilestones = milestones.filter(m => m.projectId === project.id);
  const projProposals = proposals.filter(p => p.projectId === project.id);
  const projTasks = tasks.filter(t => projMilestones.some(m => m.id === t.milestoneId));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="p-2 rounded-lg hover:bg-white/5 text-nexus-text-dim hover:text-nexus-text transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">{project.name}</h1>
          <p className="text-nexus-text-dim text-sm">{project.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users, label: 'Members', value: project.members, color: 'purple' },
          { icon: Milestone, label: 'Milestones', value: `${project.completedMilestones}/${project.milestones}`, color: 'green' },
          { icon: CheckCircle2, label: 'Tasks Done', value: `${project.completedTasks}/${project.tasks}`, color: 'cyan' },
          { icon: Zap, label: 'Budget', value: `$${project.budget}`, color: 'amber' },
        ].map((s, i) => (
          <Motion.div key={s.label} {...anim(i)} className={`rounded-xl border border-nexus-${s.color}/20 bg-nexus-${s.color}/5 p-4`}>
            <s.icon size={18} className={`text-nexus-${s.color} mb-2`} />
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-xs text-nexus-text-dim">{s.label}</div>
          </Motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Motion.div {...anim(4)} className="lg:col-span-2 rounded-xl border border-nexus-border bg-nexus-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Milestone size={16} className="text-nexus-green" /> Milestones
            </h3>
            <button className="flex items-center gap-1 text-xs text-nexus-cyan hover:underline"><Plus size={12} /> Add</button>
          </div>
          <div className="space-y-3">
            {projMilestones.map(m => (
              <div key={m.id} className="p-4 rounded-lg bg-nexus-bg/50 border border-nexus-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {m.status === 'Completed' ? <CheckCircle2 size={16} className="text-nexus-green" /> :
                     m.status === 'In Progress' ? <Clock size={16} className="text-nexus-cyan animate-pulse" /> :
                     <Clock size={16} className="text-nexus-text-dim" />}
                    <span className="text-sm font-medium">{m.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[m.status]}`}>{m.status}</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 h-1.5 rounded-full bg-nexus-border overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${m.status === 'Completed' ? 'bg-nexus-green' : 'bg-gradient-to-r from-nexus-cyan to-nexus-purple'}`}
                      style={{ width: `${m.progress}%` }} />
                  </div>
                  <span className="text-xs font-mono text-nexus-text-dim">{m.progress}%</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-nexus-text-dim">
                  <span>Deadline: {m.deadline}</span>
                  <span>Amount: ${m.amount}</span>
                  <span>{m.contractors} contractors</span>
                </div>
              </div>
            ))}
          </div>
        </Motion.div>

        <div className="space-y-6">
          <Motion.div {...anim(5)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle size={16} className="text-nexus-amber" /> Active Proposals
            </h3>
            <div className="space-y-2">
              {projProposals.slice(0, 3).map(p => (
                <Link key={p.id} to="/proposals"
                  className="block p-3 rounded-lg bg-nexus-bg/50 border border-nexus-border/50 hover:border-nexus-cyan/30 transition-colors group">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate group-hover:text-nexus-cyan transition-colors">{p.title}</span>
                    <ChevronRight size={14} className="text-nexus-text-dim" />
                  </div>
                  <div className="text-xs text-nexus-text-dim mt-1">
                    {p.yesVotes} yes / {p.noVotes} no
                  </div>
                </Link>
              ))}
            </div>
          </Motion.div>

          <Motion.div {...anim(6)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Users size={16} className="text-nexus-purple" /> Team
            </h3>
            <div className="space-y-2">
              {members.slice(0, 5).map(m => (
                <div key={m.address} className="flex items-center gap-3 p-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexus-cyan/30 to-nexus-purple/30 flex items-center justify-center text-xs font-bold">
                    {m.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{m.name}</div>
                    <div className="text-xs text-nexus-text-dim">{m.role}</div>
                  </div>
                  <span className="text-xs text-nexus-green font-mono">{m.reputation}</span>
                </div>
              ))}
            </div>
          </Motion.div>
        </div>
      </div>

      <Motion.div {...anim(7)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-nexus-cyan" /> Task Board
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-nexus-border text-nexus-text-dim text-xs">
                <th className="text-left pb-3 font-medium">Task</th>
                <th className="text-left pb-3 font-medium">Assignee</th>
                <th className="text-left pb-3 font-medium">Priority</th>
                <th className="text-left pb-3 font-medium">Status</th>
                <th className="text-left pb-3 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border/50">
              {projTasks.map(t => (
                <tr key={t.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 font-medium">{t.name}</td>
                  <td className="py-3 text-nexus-text-dim">{t.assignee}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_BADGE[t.priority]}`}>{t.priority}</span>
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.status]}`}>{t.status}</span>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-nexus-border overflow-hidden">
                        <div className="h-full rounded-full bg-nexus-cyan" style={{ width: `${t.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono text-nexus-text-dim">{t.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Motion.div>
    </div>
  );
}
