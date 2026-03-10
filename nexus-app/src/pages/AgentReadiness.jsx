import { useMemo, useState } from 'react';
import { Database, Download, ShieldCheck, Cpu, CheckCircle2, XCircle } from 'lucide-react';
import { useApp } from '../store/appStore';
import {
  buildWorldModel,
  scoreAgentReadiness,
  evaluateSettlementPolicy,
} from '../lib/agentAudit';

function Pill({ score }) {
  const tone = score >= 75 ? 'text-green-400 bg-green-400/10' : score >= 60 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10';
  return <span className={`px-2 py-1 rounded text-xs font-mono ${tone}`}>{score}/100</span>;
}

export default function AgentReadiness() {
  const {
    projects,
    milestones,
    tasks,
    proposals,
    members,
    companies,
    walletConnected,
    agentProfile,
    agentActivity,
  } = useApp();

  const [guards, setGuards] = useState({
    inspectionAccepted: true,
    lienWaiversReceived: false,
    evidenceUploaded: true,
  });

  const { overall, dimensions } = useMemo(
    () => scoreAgentReadiness({ projects, milestones, tasks, proposals, members, companies, walletConnected, agentProfile, agentActivity }),
    [projects, milestones, tasks, proposals, members, companies, walletConnected, agentProfile, agentActivity]
  );

  const worldModel = useMemo(
    () => buildWorldModel({ projects, milestones, tasks, proposals, members, companies, agentActivity, agentProfile }),
    [projects, milestones, tasks, proposals, members, companies, agentActivity, agentProfile]
  );

  const policyOutcome = evaluateSettlementPolicy(guards);

  const downloadWorldModel = () => {
    const blob = new Blob([JSON.stringify(worldModel, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexus-world-model.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-glow-cyan">Agent-Native Readiness Audit</h1>
          <p className="text-sm text-nexus-text-dim mt-1">Gap audit mapped to the 10 collaboration + settlement magnets.</p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-nexus-cyan/10 border border-nexus-cyan/20">
          <div className="text-xs text-nexus-text-dim">Overall readiness</div>
          <div className="text-xl font-bold text-nexus-cyan">{overall}/100</div>
        </div>
      </div>

      <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Database size={16} className="text-nexus-cyan" />Shared machine-readable world model</h2>
          <button onClick={downloadWorldModel} className="text-xs px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-nexus-cyan flex items-center gap-2">
            <Download size={13} /> Export JSON
          </button>
        </div>
        <p className="text-xs text-nexus-text-dim mb-3">This closes the biggest integration gap by making project state portable for external agents and toolchains.</p>
        <pre className="text-xs bg-nexus-bg border border-nexus-border rounded-lg p-3 overflow-x-auto max-h-56">
{JSON.stringify({ entities: Object.keys(worldModel.entities), links: worldModel.links, traceCount: worldModel.traces.length }, null, 2)}
        </pre>
      </div>

      <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><ShieldCheck size={16} className="text-nexus-purple" />Gap closure plan by magnet</h2>
        <div className="space-y-3">
          {dimensions.map((item) => (
            <div key={item.key} className="border border-nexus-border rounded-lg p-3 bg-nexus-bg/40">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{item.title}</div>
                <Pill score={item.score} />
              </div>
              <p className="text-xs text-red-300/90 mt-2"><strong>Gap:</strong> {item.gap}</p>
              <p className="text-xs text-green-300 mt-1"><strong>Closed now:</strong> {item.closure}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-nexus-border bg-nexus-card p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Cpu size={16} className="text-nexus-green" />Deterministic settlement policy simulator</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {Object.entries(guards).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm p-2 rounded bg-nexus-bg border border-nexus-border">
              <input type="checkbox" checked={value} onChange={(e) => setGuards((prev) => ({ ...prev, [key]: e.target.checked }))} />
              {key}
            </label>
          ))}
        </div>
        <div className={`rounded-lg p-3 border ${policyOutcome.ready ? 'border-green-400/30 bg-green-500/10' : 'border-amber-400/30 bg-amber-500/10'}`}>
          <div className="flex items-center gap-2 text-sm font-medium">
            {policyOutcome.ready ? <CheckCircle2 size={16} className="text-green-400" /> : <XCircle size={16} className="text-amber-400" />}
            {policyOutcome.reason}
          </div>
        </div>
      </div>
    </div>
  );
}
