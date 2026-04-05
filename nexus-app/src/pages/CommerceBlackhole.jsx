import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { formatEther, parseEther } from 'ethers';
import {
  Activity, TrendingUp, Zap, DollarSign, Users, ArrowDownRight,
  Send, RefreshCw, Shield, Eye, BarChart3, Gauge, Bot, Trophy, AlertCircle
} from 'lucide-react';
import { useApp, waitWithTimeout } from '../store/appStore';

function StatCard({ label, value, sub, icon: Icon, color = 'text-nexus-cyan' }) {
  return (
    <div className="p-5 rounded-2xl border border-nexus-border bg-nexus-surface/50">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={color} />
        <span className="text-xs text-nexus-text-dim uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-nexus-text-dim mt-1">{sub}</div>}
    </div>
  );
}

function FeeRail({ label, bps, description }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-nexus-surface border border-nexus-border">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-nexus-text-dim">{description}</div>
      </div>
      <div className="text-right">
        <div className="text-lg font-mono text-amber-400">{bps}</div>
      </div>
    </div>
  );
}

export default function CommerceBlackhole() {
  const {
    getDaoWriteContract,
    commerceMetrics: metrics, agentCommerceMetrics: agentMetrics,
    commerceLoading: loading, commerceError, loadCommerceMetrics,
  } = useApp();

  // Batch transfer state
  const [batchRecipients, setBatchRecipients] = useState('');
  const [batchAmounts, setBatchAmounts] = useState('');
  const [batchMemos, setBatchMemos] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const [batchPending, setBatchPending] = useState(false);

  useEffect(() => { loadCommerceMetrics(); }, [loadCommerceMetrics]);

  const handleBatchTransfer = async () => {
    const contract = await getDaoWriteContract();
    if (!contract) return;
    try {
      setBatchPending(true);
      setBatchStatus('Processing batch transfer...');
      const recipients = batchRecipients.split('\n').map(s => s.trim()).filter(Boolean);
      const amounts = batchAmounts.split('\n').map(s => s.trim()).filter(Boolean).map(s => parseEther(s));
      const memos = batchMemos.split('\n').map(s => s.trim()).filter(Boolean);

      if (recipients.length === 0) { setBatchStatus('Error: No recipients.'); return; }
      if (amounts.length !== recipients.length) { setBatchStatus(`Error: ${recipients.length} recipients but ${amounts.length} amounts.`); return; }

      // Pad memos if shorter
      while (memos.length < recipients.length) memos.push('');

      const tx = await contract.batchTransferNative(recipients, amounts, memos);
      await waitWithTimeout(tx.wait());
      setBatchStatus(`Batch complete! ${recipients.length} transfers executed.`);
      setBatchRecipients('');
      setBatchAmounts('');
      setBatchMemos('');
      loadCommerceMetrics();
    } catch (e) {
      setBatchStatus(`Error: ${e.reason || e.message}`);
    } finally {
      setBatchPending(false);
    }
  };

  const fmtEth = (wei) => {
    if (!wei) return '0';
    const val = parseFloat(formatEther(wei));
    if (val < 0.0001) return '<0.0001';
    return val.toFixed(4);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold flex items-center gap-3"
          >
            <Activity className="text-red-500" size={28} />
            Commerce Blackhole
          </Motion.h1>
          <p className="text-nexus-text-dim mt-2">
            Every value movement is tracked. Every exit is taxed. The blackhole sucks in all agent commerce.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/agent-economy" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexus-cyan/10 border border-nexus-cyan/20 text-xs text-nexus-cyan hover:bg-nexus-cyan/20 transition-colors">
            <Bot size={13} /> Agent Console
          </Link>
          <Link to="/reputation" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-nexus-border text-xs text-nexus-text-dim hover:text-white hover:border-nexus-cyan/30 transition-colors">
            <Trophy size={13} /> Reputation
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-nexus-cyan" size={24} />
          <span className="ml-3 text-nexus-text-dim">Loading blackhole metrics...</span>
        </div>
      ) : commerceError && !metrics ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle size={32} className="text-amber-400 mb-3" />
          <p className="text-nexus-text-dim text-sm">{commerceError}</p>
          <button onClick={loadCommerceMetrics} className="mt-3 text-xs text-nexus-cyan hover:underline">Retry</button>
        </div>
      ) : metrics ? (
        <>
          {/* Protocol Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Commerce Volume"
              value={`${fmtEth(metrics.totalVolume)} ETH`}
              sub="All value movements through protocol"
              icon={TrendingUp}
              color="text-green-400"
            />
            <StatCard
              label="Total Fees Collected"
              value={`${fmtEth(metrics.totalFees)} ETH`}
              sub="Revenue to cybereum.eth"
              icon={DollarSign}
              color="text-amber-400"
            />
            <StatCard
              label="Registered Agents"
              value={metrics.agentCount}
              sub="Active on the protocol"
              icon={Users}
              color="text-nexus-cyan"
            />
            <StatCard
              label="Capture Rate"
              value={metrics.totalVolume > 0n
                ? `${(Number(metrics.totalFees * 100_000n / metrics.totalVolume) / 1000).toFixed(3)}%`
                : '0%'}
              sub="Effective fee capture"
              icon={Gauge}
              color="text-purple-400"
            />
          </div>

          {/* Fee Rails */}
          <div className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50">
            <div className="flex items-center gap-2 mb-5">
              <Shield size={18} className="text-amber-400" />
              <h3 className="font-semibold text-base">Fee Rails (Non-Bypassable)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FeeRail
                label="Commerce Fee"
                bps={`${metrics.feeBps} bps`}
                description="All deposits, withdrawals, transfers, settlements"
              />
              <FeeRail
                label="Exit Fee"
                bps={`${metrics.exitFeeBps} bps`}
                description="Project claims, refunds, stake withdrawals"
              />
              <FeeRail
                label="Messaging Fee"
                bps={`${fmtEth(metrics.messagingFee)} ETH`}
                description="Per direct message from sender escrow"
              />
              <FeeRail
                label="AI Service Fee"
                bps={`${fmtEth(metrics.aiServiceFee)} ETH`}
                description="Per AI analysis request"
              />
              <FeeRail
                label="Asset Transfer Fee"
                bps={`${fmtEth(metrics.assetFlatFee)} ETH`}
                description="Flat fee per NFT/asset transfer"
              />
              <FeeRail
                label="Min Fee Floor"
                bps="1 bps"
                description="Cannot be set lower — enforced by contract"
              />
            </div>
          </div>

          {/* Agent Metrics */}
          {agentMetrics && agentMetrics.registered && (
            <div className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Eye size={18} className="text-nexus-cyan" />
                  <h3 className="font-semibold text-base">Your Commerce Footprint</h3>
                </div>
                <Link to="/reputation" className="text-xs text-nexus-cyan hover:underline flex items-center gap-1">
                  <Trophy size={12} /> View your reputation tier
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Your Volume"
                  value={`${fmtEth(agentMetrics.volume)} ETH`}
                  icon={BarChart3}
                  color="text-nexus-cyan"
                />
                <StatCard
                  label="Fees Paid"
                  value={`${fmtEth(agentMetrics.feesPaid)} ETH`}
                  sub="Your contribution to the protocol"
                  icon={ArrowDownRight}
                  color="text-amber-400"
                />
                <StatCard
                  label="Escrow Balance"
                  value={`${fmtEth(agentMetrics.escrow)} ETH`}
                  icon={DollarSign}
                  color="text-green-400"
                />
              </div>
            </div>
          )}

          {/* Batch Operations */}
          <div className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50">
            <div className="flex items-center gap-2 mb-5">
              <Zap size={18} className="text-purple-400" />
              <h3 className="font-semibold text-base">Batch Transfer (Commerce Multiplier)</h3>
            </div>
            <p className="text-xs text-nexus-text-dim mb-4">
              Transfer to multiple agents in one transaction. Each transfer collects a protocol fee.
              Enter one per line.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1">Recipients (one per line)</label>
                <textarea
                  value={batchRecipients}
                  onChange={e => setBatchRecipients(e.target.value)}
                  className="w-full bg-gray-900 border border-nexus-border rounded-lg p-3 text-sm font-mono resize-none h-28"
                  placeholder={'0xabc...\n0xdef...'}
                />
              </div>
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1">Amounts in ETH (one per line)</label>
                <textarea
                  value={batchAmounts}
                  onChange={e => setBatchAmounts(e.target.value)}
                  className="w-full bg-gray-900 border border-nexus-border rounded-lg p-3 text-sm font-mono resize-none h-28"
                  placeholder={'0.01\n0.02'}
                />
              </div>
              <div>
                <label className="block text-xs text-nexus-text-dim mb-1">Memos (one per line)</label>
                <textarea
                  value={batchMemos}
                  onChange={e => setBatchMemos(e.target.value)}
                  className="w-full bg-gray-900 border border-nexus-border rounded-lg p-3 text-sm font-mono resize-none h-28"
                  placeholder={'payment 1\npayment 2'}
                />
              </div>
            </div>
            <button
              onClick={handleBatchTransfer}
              disabled={batchPending}
              className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-medium flex items-center gap-2 transition"
            >
              {batchPending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Execute Batch Transfer
            </button>
            {batchStatus && (
              <p className={`text-xs mt-3 ${batchStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {batchStatus}
              </p>
            )}
          </div>

          {/* How It Works */}
          <div className="p-6 rounded-2xl border border-nexus-border bg-gradient-to-br from-red-950/20 to-nexus-surface/50">
            <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
              <Activity size={18} className="text-red-500" />
              How the Blackhole Works
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-nexus-text-dim">
              <div className="space-y-2">
                <p><span className="text-white font-medium">Entry fees:</span> Every deposit, stake, and project funding is taxed at {metrics.feeBps} bps.</p>
                <p><span className="text-white font-medium">Movement fees:</span> Every transfer and payment settlement is taxed at {metrics.feeBps} bps.</p>
                <p><span className="text-white font-medium">Exit fees:</span> Project claims, refunds, and DAO exits are taxed at {metrics.exitFeeBps} bps.</p>
              </div>
              <div className="space-y-2">
                <p><span className="text-white font-medium">Service fees:</span> Messaging costs {fmtEth(metrics.messagingFee)} ETH per message. AI costs {fmtEth(metrics.aiServiceFee)} ETH per query.</p>
                <p><span className="text-white font-medium">Batch ops:</span> Multi-transfers generate fees on every operation — more commerce, more revenue.</p>
                <p><span className="text-white font-medium">Non-bypassable:</span> Fee floor of 1 bps enforced at the contract level. No escape.</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-nexus-text-dim">
          Connect your wallet to view Commerce Blackhole metrics.
        </div>
      )}
    </div>
  );
}
