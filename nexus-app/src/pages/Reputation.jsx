import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../store/appStore';
import { motion as Motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Trophy, Star, Medal, Target, TrendingUp, Award, Crown, Zap, RefreshCw, Shield } from 'lucide-react';

const anim = (i) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.05 } });

const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];
const TIER_COLORS = ['text-orange-400', 'text-gray-300', 'text-amber-400', 'text-purple-400'];
const TIER_BG = [
  'bg-gradient-to-br from-orange-600/20 to-orange-700/10 border-orange-600/30',
  'bg-gradient-to-br from-gray-300/20 to-gray-400/10 border-gray-400/30',
  'bg-gradient-to-br from-yellow-500/20 to-amber-600/10 border-amber-500/30',
  'bg-gradient-to-br from-purple-500/20 to-purple-600/10 border-purple-500/30',
];

const RANK_ICONS = [Crown, Medal, Medal];
const barColors = ['#f59e0b', '#94a3b8', '#c2410c', '#06b6d4', '#a855f7', '#10b981', '#ec4899', '#64748b'];

function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function Reputation() {
  const { getDaoReadContract, walletAddress } = useApp();
  const [leaderboard, setLeaderboard] = useState([]);
  const [myReputation, setMyReputation] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadReputation = useCallback(async () => {
    const contract = getDaoReadContract();
    if (!contract) { setLoading(false); return; }
    try {
      setLoading(true);
      const [agents_, scores, tiers] = await contract.getReputationLeaderboard(0, 50);
      const entries = agents_.map((addr, i) => ({
        address: addr,
        score: Number(scores[i]),
        tier: Number(tiers[i]),
      }));
      // Sort by score descending
      entries.sort((a, b) => b.score - a.score);
      setLeaderboard(entries);

      if (walletAddress) {
        try {
          const r = await contract.getAgentReputation(walletAddress);
          setMyReputation({
            score: Number(r.score),
            tier: Number(r.tier),
            transactionCount: Number(r.transactionCount),
            lastActiveAt: Number(r.lastActiveAt),
            registeredAt: Number(r.registeredAt),
            messagingFeeDiscount: Number(r.messagingFeeDiscount),
          });
        } catch {
          setMyReputation(null);
        }
      }
    } catch (e) {
      console.error('Failed to load reputation:', e);
    } finally {
      setLoading(false);
    }
  }, [getDaoReadContract, walletAddress]);

  useEffect(() => { loadReputation(); }, [loadReputation]);

  const topScore = leaderboard.length > 0 ? leaderboard[0].score : 0;
  const avgScore = leaderboard.length > 0 ? Math.round(leaderboard.reduce((s, a) => s + a.score, 0) / leaderboard.length) : 0;
  const platinumCount = leaderboard.filter(a => a.tier === 3).length;
  const totalAgents = leaderboard.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-glow-cyan flex items-center gap-3">
          <Trophy className="text-amber-400" size={24} />
          Reputation Leaderboard
        </h1>
        <p className="text-nexus-text-dim text-sm mt-1">
          On-chain reputation derived from commerce activity. More volume, more transactions, more reputation.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-nexus-cyan" size={24} />
          <span className="ml-3 text-nexus-text-dim">Loading reputation data...</span>
        </div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Trophy, label: 'Top Score', value: topScore, color: 'text-amber-400' },
              { icon: Star, label: 'Avg Score', value: avgScore, color: 'text-nexus-cyan' },
              { icon: Target, label: 'Total Agents', value: totalAgents, color: 'text-purple-400' },
              { icon: TrendingUp, label: 'Platinum Agents', value: platinumCount, color: 'text-green-400' },
            ].map((s, i) => (
              <Motion.div key={s.label} {...anim(i)} className="rounded-xl border border-nexus-border bg-nexus-card p-4">
                <s.icon size={18} className={`${s.color} mb-2`} />
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-nexus-text-dim">{s.label}</div>
              </Motion.div>
            ))}
          </div>

          {/* Your Reputation */}
          {myReputation && myReputation.score > 0 && (
            <Motion.div {...anim(4)} className="p-6 rounded-2xl border border-nexus-border bg-nexus-surface/50">
              <div className="flex items-center gap-2 mb-5">
                <Shield size={18} className="text-nexus-cyan" />
                <h3 className="font-semibold text-base">Your Reputation</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-nexus-border bg-nexus-bg/30">
                  <div className="text-xs text-nexus-text-dim mb-1">Score</div>
                  <div className="text-2xl font-bold font-mono text-nexus-cyan">{myReputation.score}</div>
                  <div className="text-xs text-nexus-text-dim">/ 1000</div>
                </div>
                <div className="p-4 rounded-xl border border-nexus-border bg-nexus-bg/30">
                  <div className="text-xs text-nexus-text-dim mb-1">Tier</div>
                  <div className={`text-2xl font-bold ${TIER_COLORS[myReputation.tier]}`}>
                    {TIER_NAMES[myReputation.tier]}
                  </div>
                </div>
                <div className="p-4 rounded-xl border border-nexus-border bg-nexus-bg/30">
                  <div className="text-xs text-nexus-text-dim mb-1">Transactions</div>
                  <div className="text-2xl font-bold font-mono">{myReputation.transactionCount}</div>
                </div>
                <div className="p-4 rounded-xl border border-nexus-border bg-nexus-bg/30">
                  <div className="text-xs text-nexus-text-dim mb-1">Messaging Discount</div>
                  <div className="text-2xl font-bold font-mono text-green-400">{myReputation.messagingFeeDiscount}%</div>
                </div>
              </div>
            </Motion.div>
          )}

          {/* Tier Legend */}
          <Motion.div {...anim(5)} className="p-5 rounded-2xl border border-nexus-border bg-nexus-surface/50">
            <div className="flex items-center gap-2 mb-4">
              <Award size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold">Reputation Tiers</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TIER_NAMES.map((name, i) => (
                <div key={name} className={`p-3 rounded-lg border ${TIER_BG[i]}`}>
                  <div className={`text-sm font-bold ${TIER_COLORS[i]}`}>{name}</div>
                  <div className="text-xs text-nexus-text-dim mt-1">
                    {i === 0 && '0-249 pts | No discount'}
                    {i === 1 && '250-499 pts | 10% msg discount'}
                    {i === 2 && '500-749 pts | 25% msg discount'}
                    {i === 3 && '750-1000 pts | 50% msg discount'}
                  </div>
                </div>
              ))}
            </div>
          </Motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rankings */}
            <Motion.div {...anim(6)} className="lg:col-span-2 rounded-xl border border-nexus-border bg-nexus-card p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Trophy size={16} className="text-nexus-amber" /> Rankings
              </h3>
              {leaderboard.length === 0 ? (
                <p className="text-nexus-text-dim text-sm py-8 text-center">No agents registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((agent, i) => {
                    const RankIcon = RANK_ICONS[i];
                    const isMe = walletAddress && agent.address.toLowerCase() === walletAddress.toLowerCase();
                    return (
                      <Motion.div key={agent.address} {...anim(i + 7)}
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                          i < 3
                            ? `${TIER_BG[i === 0 ? 2 : i === 1 ? 1 : 0]}`
                            : 'bg-nexus-bg/30 border-nexus-border/50 hover:border-nexus-cyan/20'
                        } ${isMe ? 'ring-1 ring-nexus-cyan/40' : ''}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${
                          i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-nexus-text-dim'
                        }`}>
                          {RankIcon ? <RankIcon size={20} /> : `#${i + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono">{shortenAddress(agent.address)}</span>
                            {isMe && <span className="text-xs px-1.5 py-0.5 rounded bg-nexus-cyan/20 text-nexus-cyan">YOU</span>}
                            {i === 0 && <Zap size={14} className="text-amber-400" />}
                          </div>
                          <div className={`text-xs ${TIER_COLORS[agent.tier]}`}>{TIER_NAMES[agent.tier]}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-black font-mono ${
                            i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-nexus-cyan'
                          }`}>
                            {agent.score}
                          </div>
                          <div className="text-xs text-nexus-text-dim">REP</div>
                        </div>
                      </Motion.div>
                    );
                  })}
                </div>
              )}
            </Motion.div>

            {/* Score Distribution Chart */}
            <div className="space-y-6">
              <Motion.div {...anim(8)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Star size={16} className="text-nexus-amber" /> Score Distribution
                </h3>
                {leaderboard.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={leaderboard.slice(0, 10).map((a, i) => ({ name: `#${i + 1}`, score: a.score }))}>
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 1000]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#1a2236', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {leaderboard.slice(0, 10).map((_, i) => <Cell key={i} fill={barColors[i % barColors.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-nexus-text-dim text-sm py-8 text-center">No data yet.</p>
                )}
              </Motion.div>

              <Motion.div {...anim(9)} className="rounded-xl border border-nexus-border bg-nexus-card p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Zap size={16} className="text-purple-400" /> How Reputation Works
                </h3>
                <div className="space-y-2 text-xs text-nexus-text-dim">
                  <p><span className="text-white font-medium">Volume:</span> 50 pts per ETH of commerce (max 250)</p>
                  <p><span className="text-white font-medium">Transactions:</span> 5 pts per tx (max 250 at 50 txns)</p>
                  <p><span className="text-white font-medium">Tenure:</span> 1 pt per day registered (max 250)</p>
                  <p><span className="text-white font-medium">Escrow:</span> 50 pts per 0.1 ETH held (max 250 at 0.5 ETH)</p>
                  <p className="text-amber-400 mt-3">Decay: Inactivity reduces score. Stay active to keep your tier.</p>
                </div>
              </Motion.div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
