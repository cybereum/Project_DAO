# Network Effects Design — Project_DAO

> Making every new agent increase the value for every existing agent.

---

## The Problem

Project_DAO has strong **single-player value** (escrow, transfers, agreements, streams).
But to become the cornerstone of the mixed human-agent economy, it needs
**multi-player value** — mechanisms where each new participant makes the
network exponentially more valuable for everyone already here.

## The Three Network Effect Primitives

### 1. Referral Rewards (Viral Growth Loop)

**Insight:** Every registered agent should be a recruiter. When Agent A refers
Agent B, and Agent B generates commerce, Agent A earns a share of the protocol
fees — forever. This turns passive participants into active evangelists.

**Mechanism:**
- When calling `stakeAndJoin(metadataURI, referrer)`, a new agent can
  optionally specify a referrer address (must be a registered agent).
- The referral relationship is recorded on-chain and is permanent.
- On every fee collection from the referred agent, a configurable percentage
  of the fee (default: 10% of the protocol fee, i.e., 0.005% of the
  transaction) is credited to the referrer's escrow.
- Referrers can also earn from second-degree referrals (the agents *their*
  referrals brought in) at a reduced rate (default: 3%).
- A `referralRewardBps` is configurable by the owner (max 25% of fees).

**Why it works:**
- Creates a viral coefficient > 1: each agent has financial incentive to
  bring in more agents.
- Two-tier depth means early adopters benefit from network growth
  exponentially.
- Referral rewards come from existing fees (no new cost to the protocol).

**Contract additions:**
```solidity
mapping(address => address) public agentReferrer;        // who referred me
mapping(address => uint256) public agentReferralCount;   // how many I referred
mapping(address => uint256) public agentReferralEarnings; // total earned from referrals
uint256 public referralRewardBps = 1000;   // 10% of protocol fee to referrer
uint256 public referralTier2Bps = 300;     // 3% of fee to referrer's referrer
event ReferralRecorded(address indexed agent, address indexed referrer);
event ReferralRewardPaid(address indexed referrer, address indexed agent, uint256 amount, uint8 tier);
```

### 2. Trust Graph (Cross-Agent Endorsements)

**Insight:** In a world of anonymous agents, trust is the scarcest resource.
A web of trust — where agents endorse each other after successful interactions
— makes discovery dramatically more valuable as the network grows. It's the
difference between a directory and a recommendation engine.

**Mechanism:**
- After a service agreement completes successfully, the client can endorse
  the provider (and vice versa). Endorsements are permanent on-chain records.
- Each endorsement carries the endorser's reputation tier as a weight:
  Bronze=1, Silver=2, Gold=3, Platinum=4.
- An agent's **trust score** is the sum of weighted endorsements received.
- Discovery by capability can be sorted by trust score off-chain, making
  highly-endorsed agents more visible.
- Endorsements are scoped to specific capabilities (e.g., "data-oracle"),
  creating a skill-specific trust signal.

**Why it works:**
- More agents = more endorsement data = better signal for everyone.
- Creates a **reputation moat**: early, reliable agents accumulate trust
  that newcomers can't fake.
- Human principals can see which agents other humans trust.
- Agent-to-agent: AI agents can programmatically prefer high-trust providers.

**Contract additions:**
```solidity
struct Endorsement {
    address endorser;
    address endorsed;
    uint256 agreementId;   // the service agreement that justified this
    string capability;     // which capability is being endorsed
    uint256 weight;        // endorser's reputation tier at time of endorsement
    uint256 timestamp;
}
mapping(address => uint256) public agentTrustScore;
mapping(address => uint256) public agentEndorsementCount;
event EndorsementCreated(address indexed endorser, address indexed endorsed, uint256 agreementId, string capability, uint256 weight);
```

### 3. Network Growth Milestones (Collective Incentives)

**Insight:** When the network hits growth thresholds, everyone benefits.
This creates a shared identity and collective motivation to grow.

**Mechanism:**
- Predefined network milestones: 10, 50, 100, 500, 1000, 5000 agents.
- When a milestone is reached (via `stakeAndJoin` or `registerAgent`), an
  event is emitted that all agents can listen to.
- Each milestone unlocks a protocol-wide benefit:
  - 50 agents: messaging fee reduced by 10%
  - 100 agents: protocol fee reduced by 1 bps
  - 500 agents: messaging fee reduced by 25%
  - 1000 agents: protocol fee reduced to 3 bps
- These are automatic — no governance needed — creating anticipation and
  shared momentum.

**Contract additions:**
```solidity
uint256 public lastMilestoneReached;
event NetworkMilestoneReached(uint256 agentCount, uint256 milestone, string benefit);
```

---

## How They Compound

```
Referral Rewards → More agents join → More endorsements possible
     ↓                                        ↓
More commerce → Higher reputation → Better trust scores
     ↓                                        ↓
Network milestones → Lower fees → Even more commerce
     ↓
Referral earnings grow → Even more referrals
```

This is a **triple flywheel**: growth feeds trust, trust feeds commerce,
commerce feeds growth. Each cycle strengthens the others.

---

## Implementation Priority

1. **Referral Rewards** — Highest impact, directly drives agent acquisition
2. **Trust Graph** — Highest defensibility, creates switching costs
3. **Network Milestones** — Psychological motivation, shared narrative

All three are implemented in the same release to create the compound effect
from day one.
