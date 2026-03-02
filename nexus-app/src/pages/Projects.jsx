import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import { FolderKanban, Users, Milestone, CheckCircle2, ArrowRight, Plus, Search, Filter } from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const TYPE_COLORS = {
  Infrastructure: 'bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20',
  Technology: 'bg-nexus-purple/10 text-nexus-purple border-nexus-purple/20',
  Environmental: 'bg-nexus-green/10 text-nexus-green border-nexus-green/20',
  Healthcare: 'bg-nexus-pink/10 text-nexus-pink border-nexus-pink/20',
};

const STATUS_COLORS = {
  Active: 'bg-nexus-green/10 text-nexus-green',
  Pending: 'bg-nexus-amber/10 text-nexus-amber',
  Completed: 'bg-nexus-cyan/10 text-nexus-cyan',
};

export default function Projects() {
  const { projects, addProject } = useApp();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', type: 'Infrastructure', description: '', budget: '', votingPeriod: 7 });

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Project Registry</h1>
          <p className="text-nexus-text-dim text-sm mt-1">Manage and monitor all DAO projects</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus size={16} /> New Project
        </button>
      </div>

      {showCreate && (
        <Motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-6">
          <h3 className="text-lg font-semibold mb-4">Initialize New Project DAO</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Project Name</label>
              <input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none transition-colors" placeholder="Enter project name..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Category</label>
              <select value={newProject.type} onChange={e => setNewProject(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none">
                <option>Infrastructure</option><option>Technology</option><option>Environmental</option><option>Healthcare</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-nexus-text-dim mb-1.5">Description</label>
              <textarea value={newProject.description} onChange={e => setNewProject(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none h-20 resize-none" placeholder="Describe the project..." />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Initial Budget (USD)</label>
              <input type="text" value={newProject.budget} onChange={e => setNewProject(p => ({ ...p, budget: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-nexus-text-dim mb-1.5">Voting Period (days)</label>
              <input type="number" value={newProject.votingPeriod} onChange={e => setNewProject(p => ({ ...p, votingPeriod: parseInt(e.target.value) || 7 }))}
                className="w-full px-3 py-2.5 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => { if (newProject.name.trim()) { addProject(newProject); setNewProject({ name: '', type: 'Infrastructure', description: '', budget: '', votingPeriod: 7 }); setShowCreate(false); } }}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white text-sm font-medium hover:opacity-90">Deploy Contract</button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">Cancel</button>
          </div>
        </Motion.div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-text-dim" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-nexus-card border border-nexus-border text-sm text-nexus-text focus:border-nexus-cyan focus:outline-none"
            placeholder="Search projects..." />
        </div>
        <button className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-nexus-border text-nexus-text-dim text-sm hover:bg-white/5">
          <Filter size={14} /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((project, i) => (
          <Motion.div key={project.id} {...anim(i)} >
            <Link to={`/projects/${project.id}`}
              className="block rounded-xl border border-nexus-border bg-nexus-card p-5 hover:border-nexus-cyan/30 transition-all group gradient-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TYPE_COLORS[project.type]}`}>{project.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[project.status]}`}>{project.status}</span>
                  </div>
                  <h3 className="text-lg font-semibold group-hover:text-nexus-cyan transition-colors">{project.name}</h3>
                </div>
                <ArrowRight size={18} className="text-nexus-text-dim group-hover:text-nexus-cyan group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-sm text-nexus-text-dim mb-4 line-clamp-2">{project.description}</p>
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-nexus-text-dim">Progress</span>
                  <span className="text-nexus-cyan font-mono">{project.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-nexus-border overflow-hidden progress-bar">
                  <div className="h-full rounded-full bg-gradient-to-r from-nexus-cyan to-nexus-purple transition-all" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 pt-3 border-t border-nexus-border/50">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-nexus-text-dim mb-0.5"><Users size={12} /></div>
                  <div className="text-sm font-semibold">{project.members}</div>
                  <div className="text-xs text-nexus-text-dim">Members</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-nexus-text-dim mb-0.5"><Milestone size={12} /></div>
                  <div className="text-sm font-semibold">{project.completedMilestones}/{project.milestones}</div>
                  <div className="text-xs text-nexus-text-dim">Milestones</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-nexus-text-dim mb-0.5"><CheckCircle2 size={12} /></div>
                  <div className="text-sm font-semibold">{project.completedTasks}/{project.tasks}</div>
                  <div className="text-xs text-nexus-text-dim">Tasks</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-nexus-text-dim mb-0.5"><FolderKanban size={12} /></div>
                  <div className="text-sm font-semibold">${project.budget}</div>
                  <div className="text-xs text-nexus-text-dim">Budget</div>
                </div>
              </div>
            </Link>
          </Motion.div>
        ))}
      </div>
    </div>
  );
}
