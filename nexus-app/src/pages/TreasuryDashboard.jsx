import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { formatEther } from 'ethers';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Wallet, TrendingUp, Activity, Users, RefreshCw,
  ArrowUpRight, ArrowDownLeft, ExternalLink, Coins, Shield,
  Landmark, BarChart3,
} from 'lucide-react';
import { useApp } from '../store/appStore';
import { BrowserProvider, Contract, isAddress } from 'ethers';
import { PROJECT_DAO_ABI, PROJECT_DAO_ADDRESS, hasContractConfig } from '../config/contract';

// ─── Helpers ───────────────────────────────────────────────────────────────

const SCAN_BLOCK_RANGE = 50000;

function shortenAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatEth(wei) {
  if (!wei) return '0';
  const val = parseFloat(formatEther(wei));
  if (val === 0) return '0';
  if (val < 0.0001) return '< 0.0001';
  if (val < 1) return val.toFixed(6);
  if (val < 1000) return val.toFixed(4);
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const CHART_COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const EVENT_LABELS = {
  CybereumFeePaid: 'Fee Collected',
  AgentToAgentNativeTransfer: 'ETH Transfer',
  AgentToAgentTokenTransfer: 'Token Transfer',
  AgentAssetTransfer: 'NFT Transfer',
  AgentNativeEscrowDeposited: 'Deposit',
  AgentNativeEscrowWithdrawn: 'Withdrawal',
  AgentPaymentRequestSettled: 'Payment Settled',
  AgentPaymentRequestCreated: 'Payment Request',
};

// ─── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, tone = 'cyan' }) {
  const toneMap = {
    cyan: 'text-nexus-cyan border-nexus-cyan/20 bg-nexus-cyan/5',
    green: 'text-nexus-green border-nexus-green/20 bg-nexus-green/5',
    purple: 'text-nexus-purple border-nexus-purple/20 bg-nexus-purple/5',
    amber: 'text-amber-400 border-amber-400/20 bg-amber-400/5',
  };
  return (
    <Motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${toneMap[tone]} p-5`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={toneMap[tone].split(' ')[0]} />
        <span className="text-xs text-nexus-text-dim uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold font-mono">{value}</div>
      {sub && <div className="text-xs text-nexus-text-dim mt-1">{sub}</div>}
    </Motion.div>
  );
}

// ─── Chart tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-nexus-surface border border-nexus-border rounded-lg p-3 text-xs shadow-lg">
      <p className="text-nexus-text-dim mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {typeof p.value === 'number' && p.value < 100 ? p.value.toFixed(6) : p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function TreasuryDashboard() {
  const { walletConnected, walletAddress, connectWallet } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feeEvents, setFeeEvents] = useState([]);
  const [txEvents, setTxEvents] = useState([]);
  const [treasuryAddr, setTreasuryAddr] = useState('');
  const [treasuryBalance, setTreasuryBalance] = useState(null);
  const [feeBps, setFeeBps] = useState(null);
  const [agentCount, setAgentCount] = useState(null);
  const [scanRange, setScanRange] = useState({ from: 0, to: 0 });

  // ─── Load all treasury data from chain ─────────────────────────────────

  const loadTreasuryData = useCallback(async () => {
    if (!hasContractConfig() || !isAddress(PROJECT_DAO_ADDRESS) || !window?.ethereum) return;
    setLoading(true);
    setError('');

    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(PROJECT_DAO_ADDRESS, PROJECT_DAO_ABI, provider);
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(latestBlock - SCAN_BLOCK_RANGE, 0);
      setScanRange({ from: fromBlock, to: latestBlock });

      // Parallel: config + events
      const [
        treasury, fee, agents, treasuryBal,
        feeResults, nativeTransfers, tokenTransfers, assetTransfers,
        deposits, withdrawals, settledPayments, createdPayments,
      ] = await Promise.all([
        contract.cybereumTreasury(),
        contract.cybereumFeeBps(),
        contract.getAgentCount(),
        // Treasury balance — may be the contract or an external address
        contract.cybereumTreasury().then(addr => provider.getBalance(addr)).catch(() => null),
        // Fee events (all)
        contract.queryFilter(contract.filters.CybereumFeePaid(), fromBlock, latestBlock),
        // Transfer events (all, not filtered by wallet)
        contract.queryFilter(contract.filters.AgentToAgentNativeTransfer(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentToAgentTokenTransfer(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentAssetTransfer(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentNativeEscrowDeposited(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentNativeEscrowWithdrawn(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestSettled(), fromBlock, latestBlock),
        contract.queryFilter(contract.filters.AgentPaymentRequestCreated(), fromBlock, latestBlock),
      ]);

      setTreasuryAddr(treasury);
      setFeeBps(Number(fee));
      setAgentCount(Number(agents));
      setTreasuryBalance(treasuryBal);

      // Parse fee events
      const parsedFees = feeResults.map(ev => ({
        key: `${ev.transactionHash}-${ev.index}`,
        name: 'CybereumFeePaid',
        blockNumber: ev.blockNumber,
        txHash: ev.transactionHash,
        payer: ev.args?.payer,
        token: ev.args?.token,
        amount: ev.args?.amount,
        context: ev.args?.context || '',
      }));
      setFeeEvents(parsedFees);

      // Parse all tx events for the activity log
      const allTxEvents = [
        ...nativeTransfers.map(ev => ({ name: 'AgentToAgentNativeTransfer', ev })),
        ...tokenTransfers.map(ev => ({ name: 'AgentToAgentTokenTransfer', ev })),
        ...assetTransfers.map(ev => ({ name: 'AgentAssetTransfer', ev })),
        ...deposits.map(ev => ({ name: 'AgentNativeEscrowDeposited', ev })),
        ...withdrawals.map(ev => ({ name: 'AgentNativeEscrowWithdrawn', ev })),
        ...settledPayments.map(ev => ({ name: 'AgentPaymentRequestSettled', ev })),
        ...createdPayments.map(ev => ({ name: 'AgentPaymentRequestCreated', ev })),
      ].map(({ name, ev }) => ({
        key: `${ev.transactionHash}-${ev.index}`,
        name,
        blockNumber: ev.blockNumber,
        txHash: ev.transactionHash,
        from: ev.args?.from || ev.args?.agent || ev.args?.requester || ev.args?.payer || null,
        to: ev.args?.to || ev.args?.payer || ev.args?.requester || null,
        amount: ev.args?.amount || ev.args?.netAmount || null,
        token: ev.args?.token || null,
        memo: ev.args?.memo || ev.args?.description || null,
      })).sort((a, b) => b.blockNumber - a.blockNumber);

      setTxEvents(allTxEvents);
    } catch (err) {
      setError(err?.shortMessage || err?.message || 'Failed to load treasury data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (walletConnected) loadTreasuryData();
  }, [walletConnected, loadTreasuryData]);

  // ─── Derived metrics ───────────────────────────────────────────────────

  const totalFeesWei = useMemo(
    () => feeEvents.reduce((sum, e) => sum + (e.amount || 0n), 0n),
    [feeEvents],
  );

  const uniquePayers = useMemo(
    () => new Set(feeEvents.map(e => e.payer).filter(Boolean)).size,
    [feeEvents],
  );

  const totalTxCount = txEvents.length;

  const uniqueAgentsInTx = useMemo(() => {
    const addrs = new Set();
    txEvents.forEach(e => {
      if (e.from) addrs.add(e.from);
      if (e.to) addrs.add(e.to);
    });
    return addrs.size;
  }, [txEvents]);

  // ─── Fee revenue over time (by block buckets) ──────────────────────────

  const feeChartData = useMemo(() => {
    if (feeEvents.length === 0) return [];
    const bucketSize = Math.max(Math.floor((scanRange.to - scanRange.from) / 20), 1);
    const buckets = {};
    feeEvents.forEach(e => {
      const bucket = Math.floor((e.blockNumber - scanRange.from) / bucketSize);
      const label = `#${(scanRange.from + bucket * bucketSize).toLocaleString()}`;
      if (!buckets[label]) buckets[label] = { block: label, fees: 0 };
      buckets[label].fees += parseFloat(formatEther(e.amount || 0n));
    });
    return Object.values(buckets).sort((a, b) => {
      const aBlock = parseInt(a.block.replace(/[#,]/g, ''));
      const bBlock = parseInt(b.block.replace(/[#,]/g, ''));
      return aBlock - bBlock;
    });
  }, [feeEvents, scanRange]);

  // ─── Transaction volume by type (pie chart) ────────────────────────────

  const volumeByType = useMemo(() => {
    const counts = {};
    txEvents.forEach(e => {
      const label = EVENT_LABELS[e.name] || e.name;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [txEvents]);

  // ─── Fee breakdown by context (bar chart) ──────────────────────────────

  const feeByContext = useMemo(() => {
    const map = {};
    feeEvents.forEach(e => {
      const ctx = e.context || 'unknown';
      if (!map[ctx]) map[ctx] = { context: ctx, fees: 0, count: 0 };
      map[ctx].fees += parseFloat(formatEther(e.amount || 0n));
      map[ctx].count += 1;
    });
    return Object.values(map).sort((a, b) => b.fees - a.fees);
  }, [feeEvents]);

  // ─── Not connected state ───────────────────────────────────────────────

  if (!walletConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <Landmark size={48} className="text-nexus-cyan/40" />
        <h1 className="text-2xl font-bold">Treasury Dashboard</h1>
        <p className="text-nexus-text-dim text-sm max-w-md">
          Connect your wallet to view protocol fee revenue, transaction volume, and treasury analytics from on-chain data.
        </p>
        <button
          onClick={connectWallet}
          className="px-6 py-2.5 rounded-xl bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/20 hover:bg-nexus-cyan/20 transition-colors font-medium text-sm"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Landmark size={24} className="text-nexus-cyan" />
            Treasury Dashboard
          </h1>
          <p className="text-xs text-nexus-text-dim mt-1">
            Protocol fee revenue and transaction analytics &mdash; live from on-chain events
            {scanRange.to > 0 && (
              <span className="ml-2">
                (blocks #{scanRange.from.toLocaleString()} &ndash; #{scanRange.to.toLocaleString()})
              </span>
            )}
          </p>
        </div>
        <button
          onClick={loadTreasuryData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nexus-surface border border-nexus-border text-xs hover:border-nexus-cyan/30 transition-colors disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Coins}
          label="Total Fees Collected"
          value={`${formatEth(totalFeesWei)} ETH`}
          sub={`${feeEvents.length} fee events`}
          tone="green"
        />
        <KpiCard
          icon={Activity}
          label="Transactions"
          value={totalTxCount.toLocaleString()}
          sub={`${uniqueAgentsInTx} unique agents`}
          tone="cyan"
        />
        <KpiCard
          icon={Users}
          label="Registered Agents"
          value={agentCount !== null ? agentCount.toLocaleString() : '—'}
          sub={`${uniquePayers} fee payers`}
          tone="purple"
        />
        <KpiCard
          icon={Wallet}
          label="Treasury Balance"
          value={treasuryBalance !== null ? `${formatEth(treasuryBalance)} ETH` : '—'}
          sub={treasuryAddr ? shortenAddr(treasuryAddr) : 'Not set'}
          tone="amber"
        />
      </div>

      {/* Config bar */}
      {feeBps !== null && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-nexus-surface border border-nexus-border text-xs">
          <div className="flex items-center gap-2">
            <Shield size={13} className="text-nexus-cyan" />
            <span className="text-nexus-text-dim">Fee rate:</span>
            <span className="font-mono font-semibold">{feeBps} bps ({(feeBps / 100).toFixed(2)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <Landmark size={13} className="text-nexus-cyan" />
            <span className="text-nexus-text-dim">Treasury:</span>
            <span className="font-mono">{shortenAddr(treasuryAddr)}</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 size={13} className="text-nexus-cyan" />
            <span className="text-nexus-text-dim">Scan depth:</span>
            <span className="font-mono">{SCAN_BLOCK_RANGE.toLocaleString()} blocks</span>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fee Revenue Over Time */}
        <Motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-nexus-green" />
            Fee Revenue Over Time
          </h3>
          {feeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={feeChartData}>
                <defs>
                  <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="block" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="fees" name="Fees (ETH)" stroke="#10b981" fill="url(#feeGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-nexus-text-dim text-xs">
              {loading ? 'Scanning chain for fee events...' : 'No fee events found in scanned range'}
            </div>
          )}
        </Motion.div>

        {/* Transaction Volume by Type */}
        <Motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity size={15} className="text-nexus-cyan" />
            Transaction Volume by Type
          </h3>
          {volumeByType.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie data={volumeByType} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                    {volumeByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {volumeByType.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-nexus-text-dim">{item.name}</span>
                    </div>
                    <span className="font-mono font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-nexus-text-dim text-xs">
              {loading ? 'Scanning...' : 'No transactions found'}
            </div>
          )}
        </Motion.div>
      </div>

      {/* Fee Breakdown by Context */}
      {feeByContext.length > 0 && (
        <Motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-nexus-purple" />
            Fee Revenue by Source
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={feeByContext} layout="vertical">
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="context" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} width={140} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="fees" name="Fees (ETH)" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Motion.div>
      )}

      {/* Transaction Log */}
      <Motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-xl border border-nexus-border bg-nexus-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity size={15} className="text-nexus-cyan" />
            Recent Protocol Activity
          </h3>
          <span className="text-xs text-nexus-text-dim">{txEvents.length} events</span>
        </div>

        {txEvents.length === 0 ? (
          <p className="text-xs text-nexus-text-dim text-center py-8">
            {loading ? 'Scanning...' : 'No events found in scanned block range.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-nexus-text-dim border-b border-nexus-border">
                  <th className="text-left py-2 px-2 font-medium">Block</th>
                  <th className="text-left py-2 px-2 font-medium">Type</th>
                  <th className="text-left py-2 px-2 font-medium">From</th>
                  <th className="text-left py-2 px-2 font-medium">To</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-right py-2 px-2 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {txEvents.slice(0, 50).map((ev) => {
                  const isIncoming = ev.to?.toLowerCase() === walletAddress?.toLowerCase();
                  const typeLabel = EVENT_LABELS[ev.name] || ev.name;
                  return (
                    <tr key={ev.key} className="border-b border-nexus-border/50 hover:bg-nexus-surface/50 transition-colors">
                      <td className="py-2 px-2 font-mono text-nexus-text-dim">{ev.blockNumber.toLocaleString()}</td>
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-1.5">
                          {isIncoming
                            ? <ArrowDownLeft size={12} className="text-nexus-green" />
                            : <ArrowUpRight size={12} className="text-nexus-cyan" />
                          }
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono">{shortenAddr(ev.from)}</td>
                      <td className="py-2 px-2 font-mono">{shortenAddr(ev.to)}</td>
                      <td className="py-2 px-2 font-mono text-right">
                        {ev.amount ? formatEth(ev.amount) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <a
                          href={`https://basescan.org/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nexus-cyan hover:underline inline-flex items-center gap-1"
                        >
                          {ev.txHash.slice(0, 8)}...
                          <ExternalLink size={10} />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {txEvents.length > 50 && (
              <p className="text-xs text-nexus-text-dim text-center mt-3">
                Showing 50 of {txEvents.length} events
              </p>
            )}
          </div>
        )}
      </Motion.div>

      {/* Fee Events Detail */}
      {feeEvents.length > 0 && (
        <Motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-xl border border-nexus-border bg-nexus-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Coins size={15} className="text-nexus-green" />
              Fee Collection Log
            </h3>
            <span className="text-xs text-nexus-text-dim">{feeEvents.length} fee events &middot; {formatEth(totalFeesWei)} ETH total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-nexus-text-dim border-b border-nexus-border">
                  <th className="text-left py-2 px-2 font-medium">Block</th>
                  <th className="text-left py-2 px-2 font-medium">Payer</th>
                  <th className="text-left py-2 px-2 font-medium">Context</th>
                  <th className="text-right py-2 px-2 font-medium">Fee (ETH)</th>
                  <th className="text-right py-2 px-2 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {feeEvents.slice(0, 50).map((ev) => (
                  <tr key={ev.key} className="border-b border-nexus-border/50 hover:bg-nexus-surface/50 transition-colors">
                    <td className="py-2 px-2 font-mono text-nexus-text-dim">{ev.blockNumber.toLocaleString()}</td>
                    <td className="py-2 px-2 font-mono">{shortenAddr(ev.payer)}</td>
                    <td className="py-2 px-2 text-nexus-text-dim">{ev.context || '—'}</td>
                    <td className="py-2 px-2 font-mono text-right text-nexus-green">{formatEth(ev.amount)}</td>
                    <td className="py-2 px-2 text-right">
                      <a
                        href={`https://basescan.org/tx/${ev.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-nexus-cyan hover:underline inline-flex items-center gap-1"
                      >
                        {ev.txHash.slice(0, 8)}...
                        <ExternalLink size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Motion.div>
      )}
    </div>
  );
}
