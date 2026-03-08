import { useState, useEffect, useCallback } from 'react';
import { motion as Motion } from 'framer-motion';
import { parseEther, formatEther } from 'ethers';
import {
  Bot, Wallet, ArrowUpRight, ArrowDownLeft, Send, FileText,
  CheckCircle, XCircle, Clock, Zap, Info, Copy, ExternalLink,
  RefreshCw, Shield
} from 'lucide-react';
import { useApp } from '../store/appStore';

// ─── Fee preview helper ────────────────────────────────────────────────────
function FeePreview({ amountEth, feeBps }) {
  if (!amountEth || isNaN(parseFloat(amountEth)) || parseFloat(amountEth) <= 0) return null;
  const amount = parseFloat(amountEth);
  const fee = Math.max(amount * feeBps / 10000, 1e-18);
  const net = amount - fee;
  return (
    <div className="mt-2 p-3 rounded-lg bg-nexus-surface border border-nexus-border text-xs space-y-1">
      <div className="flex justify-between text-nexus-text-dim">
        <span>Gross amount</span><span>{amount.toFixed(6)} ETH</span>
      </div>
      <div className="flex justify-between text-amber-400">
        <span>Protocol fee (~{feeBps} bps → cybereum.eth)</span>
        <span>-{fee.toFixed(8)} ETH</span>
      </div>
      <div className="flex justify-between text-nexus-cyan font-semibold border-t border-nexus-border pt-1 mt-1">
        <span>Net to recipient</span><span>{net.toFixed(6)} ETH</span>
      </div>
    </div>
  );
}

// ─── TX hash link ─────────────────────────────────────────────────────────
function TxLink({ hash }) {
  if (!hash) return null;
  const short = `${hash.slice(0, 10)}...${hash.slice(-6)}`;
  return (
    <a href={`https://etherscan.io/tx/${hash}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-nexus-cyan hover:underline mt-2">
      <CheckCircle size={12} className="text-green-400" />
      TX confirmed: {short}
      <ExternalLink size={10} />
    </a>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    0: { label: 'Open', color: 'text-amber-400 bg-amber-400/10' },
    1: { label: 'Settled', color: 'text-green-400 bg-green-400/10' },
    2: { label: 'Cancelled', color: 'text-red-400 bg-red-400/10' },
  };
  const s = map[status] || map[0];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${s.color}`}>{s.label}</span>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────
function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50 ${className}`}>
      <div className="flex items-center gap-2 mb-5">
        <Icon size={18} className="text-nexus-cyan" />
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────
function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-nexus-text-dim mb-1">{label}</label>
      <input
        className="w-full px-3 py-2 rounded-lg bg-nexus-bg border border-nexus-border text-sm text-nexus-text placeholder-nexus-text-dim focus:outline-none focus:border-nexus-cyan"
        {...props}
      />
    </div>
  );
}

function Btn({ children, loading, variant = 'primary', disabled, ...props }) {
  const base = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50';
  const v = variant === 'primary'
    ? 'bg-gradient-to-r from-nexus-cyan to-nexus-purple text-white hover:opacity-90'
    : 'border border-nexus-border text-nexus-text-dim hover:text-nexus-text hover:border-nexus-cyan/40';
  return (
    <button className={`${base} ${v}`} disabled={disabled || loading} {...props}>
      {loading && <RefreshCw size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────
export default function AgentEconomy() {
  const {
    walletConnected, walletAddress, walletError, txPending,
    connectWallet,
    agentProfile, agentFeeBps, agentFlatFeeWei,
    loadAgentConfig, loadAgentProfile,
    agentRegister, agentDepositNative, agentWithdrawNative, agentTransferNative,
    agentCreatePaymentRequest, agentSettlePaymentRequest, agentCancelPaymentRequest,
  } = useApp();

  const [lastTx, setLastTx] = useState('');
  const [tab, setTab] = useState('overview');

  // Register form
  const [metadataURI, setMetadataURI] = useState('');

  // Escrow forms
  const [depositAmt, setDepositAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');

  // Transfer form
  const [transferTo, setTransferTo] = useState('');
  const [transferAmt, setTransferAmt] = useState('');
  const [transferMemo, setTransferMemo] = useState('');

  // Payment request form
  const [prPayer, setPrPayer] = useState('');
  const [prAmount, setPrAmount] = useState('');
  const [prDesc, setPrDesc] = useState('');

  // Settle / cancel
  const [settleId, setSettleId] = useState('');
  const [cancelId, setCancelId] = useState('');

  const refresh = useCallback(() => {
    loadAgentConfig();
    loadAgentProfile();
  }, [loadAgentConfig, loadAgentProfile]);

  useEffect(() => {
    if (walletConnected) refresh();
  }, [walletConnected, refresh]);

  const handle = (fn) => async (...args) => {
    const hash = await fn(...args);
    if (hash) setLastTx(hash);
  };

  const escrowBalanceEth = agentProfile?.nativeEscrowBalance
    ? parseFloat(formatEther(agentProfile.nativeEscrowBalance)).toFixed(6)
    : '0.000000';

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'escrow', label: 'Escrow' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'requests', label: 'Payment Requests' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot size={24} className="text-nexus-cyan" />
            <h1 className="text-2xl font-bold">Agent Economy</h1>
          </div>
          <p className="text-sm text-nexus-text-dim max-w-xl">
            The on-chain transaction and settlement layer for autonomous agents.
            Every transfer routes a minuscule protocol fee to <span className="text-nexus-cyan font-mono">cybereum.eth</span> — non-bypassable by design.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refresh} className="p-2 rounded-lg border border-nexus-border text-nexus-text-dim hover:text-nexus-text transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
          {!walletConnected && (
            <Btn onClick={connectWallet} loading={txPending}>
              <Wallet size={16} /> Connect Wallet
            </Btn>
          )}
        </div>
      </div>

      {/* ── Protocol fee banner ── */}
      <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400">
        <Shield size={14} className="flex-shrink-0" />
        <span>
          Protocol fee: <strong>{agentFeeBps} bps ({agentFeeBps / 100}%)</strong> on every transaction · Asset flat fee: <strong>{(parseInt(agentFlatFeeWei) / 1e12).toFixed(0)} gwei</strong> · Destination: <strong>cybereum.eth</strong> · Floor: <strong>1 bps (non-bypassable)</strong>
        </span>
      </div>

      {walletError && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-sm text-red-400">{walletError}</div>
      )}
      {lastTx && <TxLink hash={lastTx} />}

      {/* ── Tab nav ── */}
      <div className="flex gap-1 border-b border-nexus-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-nexus-cyan text-nexus-cyan' : 'border-transparent text-nexus-text-dim hover:text-nexus-text'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Agent Profile" icon={Bot}>
            {!walletConnected ? (
              <p className="text-sm text-nexus-text-dim">Connect wallet to view your agent profile.</p>
            ) : !agentProfile?.registered ? (
              <div className="space-y-4">
                <p className="text-sm text-nexus-text-dim">You are not registered as an agent yet.</p>
                <Field
                  label="Metadata URI (IPFS or HTTPS)"
                  placeholder="ipfs://Qm.../agent-profile.json"
                  value={metadataURI}
                  onChange={e => setMetadataURI(e.target.value)}
                />
                <Btn loading={txPending} onClick={() => handle(agentRegister)(metadataURI)}>
                  <Bot size={14} /> Register Agent
                </Btn>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-sm font-medium text-green-400">Registered Agent</span>
                </div>
                <div className="text-xs text-nexus-text-dim font-mono break-all">{agentProfile.metadataURI}</div>
                <div className="p-3 rounded-lg bg-nexus-bg border border-nexus-border">
                  <div className="text-xs text-nexus-text-dim mb-1">Native Escrow Balance</div>
                  <div className="text-xl font-bold text-nexus-cyan font-mono">{escrowBalanceEth} ETH</div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Protocol Stats" icon={Zap}>
            <div className="space-y-3">
              {[
                { label: 'Current fee rate', value: `${agentFeeBps} bps (${agentFeeBps / 100}%)` },
                { label: 'Asset flat fee', value: `${(parseInt(agentFlatFeeWei) / 1e12).toFixed(0)} gwei` },
                { label: 'Fee recipient', value: 'cybereum.eth' },
                { label: 'Minimum fee floor', value: '1 bps — enforced on-chain' },
                { label: 'Rails supported', value: 'Native · ERC-20 · ERC-721' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm border-b border-nexus-border pb-2 last:border-0 last:pb-0">
                  <span className="text-nexus-text-dim">{label}</span>
                  <span className="font-mono text-nexus-text">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="How it works" icon={Info} className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { step: '01', title: 'Register', desc: 'Call registerAgent() with your metadata URI. One time only.' },
                { step: '02', title: 'Fund Escrow', desc: 'Deposit ETH or ERC-20 tokens into the contract escrow pool.' },
                { step: '03', title: 'Transact', desc: 'Transfer to agents or create payment requests. Fee auto-deducted.' },
                { step: '04', title: 'Settle', desc: 'Payer settles requests. Requester receives net after protocol fee.' },
              ].map(s => (
                <div key={s.step} className="flex gap-3">
                  <span className="text-2xl font-black text-nexus-cyan/20 font-mono w-8 flex-shrink-0">{s.step}</span>
                  <div>
                    <div className="font-semibold text-sm mb-1">{s.title}</div>
                    <div className="text-xs text-nexus-text-dim">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Escrow tab ── */}
      {tab === 'escrow' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Deposit Native ETH" icon={ArrowDownLeft}>
            <div className="space-y-4">
              <Field label="Amount (ETH)" type="number" step="0.001" min="0" placeholder="0.1"
                value={depositAmt} onChange={e => setDepositAmt(e.target.value)} />
              <FeePreview amountEth={depositAmt} feeBps={agentFeeBps} />
              <Btn loading={txPending} disabled={!walletConnected || !depositAmt}
                onClick={() => handle(agentDepositNative)(parseEther(depositAmt || '0'))}>
                <ArrowDownLeft size={14} /> Deposit to Escrow
              </Btn>
            </div>
          </Card>

          <Card title="Withdraw Native ETH" icon={ArrowUpRight}>
            <div className="space-y-4">
              <div className="text-xs text-nexus-text-dim">Escrow balance: <span className="text-nexus-cyan font-mono">{escrowBalanceEth} ETH</span></div>
              <Field label="Amount (ETH)" type="number" step="0.001" min="0" placeholder="0.05"
                value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
              <FeePreview amountEth={withdrawAmt} feeBps={agentFeeBps} />
              <Btn loading={txPending} disabled={!walletConnected || !withdrawAmt}
                onClick={() => handle(agentWithdrawNative)(parseEther(withdrawAmt || '0'))}>
                <ArrowUpRight size={14} /> Withdraw from Escrow
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {/* ── Transfer tab ── */}
      {tab === 'transfer' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Transfer Native ETH to Agent" icon={Send}>
            <div className="space-y-4">
              <Field label="Recipient agent address" placeholder="0x..." value={transferTo} onChange={e => setTransferTo(e.target.value)} />
              <Field label="Amount (ETH)" type="number" step="0.001" min="0" placeholder="0.05"
                value={transferAmt} onChange={e => setTransferAmt(e.target.value)} />
              <Field label="Memo (optional)" placeholder="Payment for task #42" value={transferMemo} onChange={e => setTransferMemo(e.target.value)} />
              <FeePreview amountEth={transferAmt} feeBps={agentFeeBps} />
              <Btn loading={txPending} disabled={!walletConnected || !transferTo || !transferAmt}
                onClick={() => handle(agentTransferNative)(transferTo, parseEther(transferAmt || '0'), transferMemo)}>
                <Send size={14} /> Transfer
              </Btn>
            </div>
          </Card>

          <Card title="About Agent Transfers" icon={Info}>
            <ul className="space-y-3 text-sm text-nexus-text-dim">
              <li className="flex gap-2"><CheckCircle size={14} className="text-nexus-cyan flex-shrink-0 mt-0.5" /><span>Both sender and recipient must be registered agents.</span></li>
              <li className="flex gap-2"><CheckCircle size={14} className="text-nexus-cyan flex-shrink-0 mt-0.5" /><span>Protocol fee (~{agentFeeBps} bps) is deducted from the amount and sent to cybereum.eth before the net reaches the recipient escrow.</span></li>
              <li className="flex gap-2"><CheckCircle size={14} className="text-nexus-cyan flex-shrink-0 mt-0.5" /><span>Funds stay in contract escrow until the recipient withdraws.</span></li>
              <li className="flex gap-2"><CheckCircle size={14} className="text-nexus-cyan flex-shrink-0 mt-0.5" /><span>All transfers emit AgentToAgentNativeTransfer and CybereumFeePaid events — fully auditable on-chain.</span></li>
            </ul>
          </Card>
        </div>
      )}

      {/* ── Payment Requests tab ── */}
      {tab === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Create Payment Request" icon={FileText}>
            <div className="space-y-4">
              <Field label="Payer agent address" placeholder="0x..." value={prPayer} onChange={e => setPrPayer(e.target.value)} />
              <Field label="Amount (ETH)" type="number" step="0.001" min="0" placeholder="0.5"
                value={prAmount} onChange={e => setPrAmount(e.target.value)} />
              <Field label="Description / Invoice" placeholder="Design work for milestone #3" value={prDesc} onChange={e => setPrDesc(e.target.value)} />
              <FeePreview amountEth={prAmount} feeBps={agentFeeBps} />
              <Btn loading={txPending} disabled={!walletConnected || !prPayer || !prAmount}
                onClick={() => handle(agentCreatePaymentRequest)(
                  prPayer,
                  '0x0000000000000000000000000000000000000000',
                  parseEther(prAmount || '0'),
                  true,
                  prDesc
                )}>
                <FileText size={14} /> Create Request
              </Btn>
            </div>
          </Card>

          <div className="space-y-6">
            <Card title="Settle a Request (as Payer)" icon={CheckCircle}>
              <div className="space-y-4">
                <Field label="Request ID" type="number" min="1" placeholder="1" value={settleId} onChange={e => setSettleId(e.target.value)} />
                <p className="text-xs text-nexus-text-dim">Enter the request amount below to send the native payment.</p>
                <Field label="Amount (ETH — must match request)" type="number" step="0.001" min="0" placeholder="0.5"
                  value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)} />
                <Btn loading={txPending} disabled={!walletConnected || !settleId}
                  onClick={() => handle(agentSettlePaymentRequest)(settleId, withdrawAmt ? parseEther(withdrawAmt) : undefined)}>
                  <CheckCircle size={14} /> Settle Request
                </Btn>
              </div>
            </Card>

            <Card title="Cancel a Request (as Requester)" icon={XCircle}>
              <div className="space-y-4">
                <Field label="Request ID" type="number" min="1" placeholder="1" value={cancelId} onChange={e => setCancelId(e.target.value)} />
                <Btn variant="secondary" loading={txPending} disabled={!walletConnected || !cancelId}
                  onClick={() => handle(agentCancelPaymentRequest)(cancelId)}>
                  <XCircle size={14} /> Cancel Request
                </Btn>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── Quick CLI reference ── */}
      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-nexus-text-dim hover:text-nexus-text select-none">
          Developer / Agent CLI reference (Solidity / ethers.js)
        </summary>
        <pre className="mt-3 p-4 rounded-xl bg-nexus-bg border border-nexus-border text-xs text-nexus-text-dim overflow-x-auto leading-relaxed">
{`// Register
await contract.registerAgent("ipfs://Qm.../profile.json");

// Deposit ETH
await contract.depositNativeToEscrow({ value: parseEther("0.1") });

// Transfer ETH between agents (fee auto-deducted)
await contract.transferNativeBetweenAgents(recipientAddr, parseEther("0.05"), "memo");

// Payment request lifecycle
const requestId = await contract.createAgentPaymentRequest(
  payerAddr, ethers.ZeroAddress, parseEther("0.5"), true, "invoice"
);
await contract.settleAgentPaymentRequest(requestId, { value: parseEther("0.5") });

// Fee preview (read)
const [fee, net] = await contract.previewFee(parseEther("1.0"));`}
        </pre>
      </details>
    </div>
  );
}
