# Incident Response Playbook — Project_DAO

> Practical procedures for detecting, triaging, and resolving incidents affecting the protocol, NEXUS frontend, or agent SDK.

---

## 1. Severity Levels

| Level | Name | Criteria | Examples |
|-------|------|----------|----------|
| **P0** | Funds at risk | Active or imminent loss of user/agent funds, treasury drain, or exploitable vulnerability in production | Reentrancy exploit, compromised owner key, malicious treasury redirect |
| **P1** | Protocol degraded | Core functionality broken but no immediate fund loss; agents cannot transact normally | Contract paused unexpectedly, fee rail misconfigured, escrow deposits failing, RPC provider down |
| **P2** | Non-critical issue | Feature broken or degraded; workaround exists | Frontend page crash (caught by RouteErrorBoundary), SDK method returning wrong data, stale agent discovery results |
| **P3** | Cosmetic / docs | UI glitch, typo, documentation error, non-user-facing issue | Styling bug, incorrect help text, outdated CLAUDE.md section |

---

## 2. Detection Channels

### Automated monitoring
- **`scripts/monitor.js`** — listens for critical on-chain events in real time:
  - Treasury address changes (`CybereumTreasuryUpdated`)
  - Fee configuration changes (`CybereumFeeConfigUpdated`)
  - Large native transfers above threshold (`AgentToAgentNativeTransfer`)
  - Timelock operations (queued, executed, cancelled)
  - Membership changes, network milestones
  - Treasury balance polled every 5 minutes
- Alerts dispatched via webhook (`WEBHOOK_URL` env var) to Slack/PagerDuty/Discord

### Manual / external
- User reports via GitHub Issues or support channels
- On-chain analytics (Dune, block explorer event logs)
- SDK error callbacks (`agent.onPaymentRequest`, `agent.onTransferReceived` returning unexpected data)
- Frontend error boundaries logging to analytics (`lib/analytics.js`)

---

## 3. Response Procedures

### P0 — Funds at Risk

**Target: 15-minute acknowledgment, immediate action.**

1. **Pause the contract immediately.**
   The owner (or multisig) calls `pauseContract()`. This halts all state-changing functions (`whenNotPaused` modifier). No deposits, withdrawals, transfers, or settlements can execute while paused.

2. **Notify all signers.** If using a multisig (see `docs/MULTISIG_SETUP.md`), alert all 5 signers via out-of-band channel (phone, Signal). Do not rely solely on email.

3. **Assess scope.** Use block explorer event logs to reconstruct the attack timeline:
   - Filter `CybereumFeePaid` events for unusual amounts
   - Check `AgentToAgentNativeTransfer` for unauthorized movements
   - Review `TimelockExecuted` events for unexpected config changes
   - Query `cybereumTreasury()` and `cybereumFeeBps()` to verify current state

4. **If treasury is compromised:** Queue a treasury redirect via `queueSetTreasury(newAddress)` (24h timelock). If the timelock itself is compromised, use `changeOwner()` to transfer control to a clean key, then call `setCybereumTreasury()` directly from the new owner.

5. **If owner key is compromised:** A second signer on the multisig must call `changeOwner(newSafeAddress)` before the attacker can. If using an EOA owner, this is a race condition — this is why multisig ownership is critical (see `docs/MULTISIG_SETUP.md`).

6. **Communicate to agents.** Post a broadcast via `broadcastToAgents(3, "ipfs://incident-notice")` (type 3 = security). SDK agents listening via `agent.onBroadcast()` will receive the notice.

7. **Do not resume until** root cause is identified and fixed or mitigated.

### P1 — Protocol Degraded

**Target: 1-hour acknowledgment.**

1. **Assess impact.** Determine which functions are affected. Check `scripts/monitor.js` output for anomalies.
2. **Engage on-call.** The responsible engineer investigates. If the issue is contract-side, consider pausing while investigating.
3. **Consider targeted pause.** If only one subsystem is affected (e.g., payment streams), a pause protects all functions — there is no partial pause. Weigh disruption vs. risk.
4. **Hotfix if possible.** Frontend/SDK issues can be patched and redeployed. Contract issues require a migration (see `docs/MIGRATION.md`).
5. **Communicate.** Update status page or broadcast channel. Inform agents via SDK broadcast if transaction flows are affected.

### P2 — Non-Critical Issue

**Target: 24-hour acknowledgment.**

1. Open a GitHub Issue with reproduction steps.
2. Assign to the relevant team (frontend, SDK, contract).
3. Fix in the next scheduled release. No emergency deployment needed.

### P3 — Cosmetic / Docs

1. Open a GitHub Issue labeled `low-priority`.
2. Fix when convenient. Can be bundled into any release.

---

## 4. Communication Templates

### Incident Notification

```
INCIDENT: [P0/P1/P2] — [Brief description]
Time detected: [UTC timestamp]
Status: Investigating / Mitigating / Resolved
Impact: [What is affected — e.g., "All agent escrow operations paused"]
Actions taken: [e.g., "Contract paused via pauseContract()"]
Next update: [ETA]
```

### Resolution Notice

```
RESOLVED: [Brief description]
Duration: [Start time] — [End time] ([duration])
Root cause: [1-2 sentence explanation]
Impact: [What was affected, number of agents/transactions impacted]
Remediation: [What was done to fix it]
Prevention: [What changes will prevent recurrence]
Postmortem: [Link to postmortem document, if P0/P1]
```

---

## 5. Post-Incident Process

### Postmortem (required for P0 and P1)

Conduct within 48 hours of resolution. Document:

1. **Timeline** — Reconstruct from on-chain events. Key sources:
   - Block explorer event logs (filter by contract address)
   - `scripts/monitor.js` webhook history
   - Transaction hashes for all remediation actions
2. **Root cause** — What failed and why. Distinguish between trigger and underlying vulnerability.
3. **Impact assessment** — Agents affected, funds at risk or lost, duration of disruption.
4. **What went well** — Detection speed, response effectiveness.
5. **What went poorly** — Gaps in monitoring, slow response, missing runbook steps.
6. **Action items** — Concrete changes with owners and deadlines. Examples:
   - Add monitoring for the specific event pattern that was missed
   - Add test coverage for the edge case that was exploited
   - Update this playbook if procedures were inadequate

### Timeline Reconstruction

The contract emits events for every state change. Key events for forensics:

| Event | What it tells you |
|-------|-------------------|
| `CybereumTreasuryUpdated` | Treasury address was changed — by whom, when |
| `CybereumFeeConfigUpdated` | Fee parameters changed |
| `TimelockQueued` / `TimelockExecuted` | Sensitive operation was scheduled and executed |
| `CybereumFeePaid` | Every fee collection — amount, payer, context |
| `AgentToAgentNativeTransfer` | Fund movements between agents |
| `OwnerChanged` | Ownership transferred |

---

## 6. Escalation Matrix

| Severity | Acknowledgment | Resolution Target | Who |
|----------|---------------|-------------------|-----|
| **P0** | 15 minutes | ASAP (hours) | All multisig signers + lead engineer |
| **P1** | 1 hour | Same business day | On-call engineer + tech lead |
| **P2** | 24 hours | Next release cycle | Assigned engineer |
| **P3** | 1 week | When convenient | Any contributor |

If the on-call engineer is unreachable for a P0 within 15 minutes, escalate to the next signer on the multisig. The multisig can pause the contract without the on-call engineer.

---

## 7. Emergency Contract Functions

These are the owner-only functions available during an incident:

| Function | Effect | When to use |
|----------|--------|-------------|
| `pauseContract()` | Halts all state-changing functions | Immediately on any P0 |
| `resumeContract()` | Re-enables normal operation | Only after root cause is addressed |
| `setCybereumTreasury(address)` | Redirects fee collection | If treasury address is compromised (bypasses timelock if called directly by owner) |
| `changeOwner(address)` | Transfers contract control | If owner key is compromised — transfer to clean multisig |
| `cancelTimelockOperation(opId)` | Aborts a pending timelocked change | If an attacker queued a malicious treasury/fee change |
| `setCybereumFeeConfig(bps, flatFee)` | Resets fee parameters | If fees were set to exploitative values |

### Pause behavior

When paused:
- No deposits, withdrawals, transfers, settlements, or registrations
- No proposal creation, voting, or execution
- No service agreement or stream operations
- Read-only functions (getters, view functions) still work
- Owner can still call `resumeContract()` and `changeOwner()`

### Timelock considerations

The `TimelockLib` enforces a 24-hour delay on `queueSetTreasury` and `queueSetFeeConfig`. During an emergency, the owner can bypass the timelock by calling `setCybereumTreasury()` or `setCybereumFeeConfig()` directly. The timelock queue/execute path is for routine changes; direct calls are the emergency path.

---

## Owner Key Compromise

### Immediate actions (within minutes)

1. **Pause the contract** from a signer key that still has access: `pauseContract()`.
2. **Rotate ownership** by calling `changeOwner(backupAddress)` before the attacker can. Speed is critical — this is a race.
3. **Notify all multisig signers** via out-of-band channels (phone, Signal). Do not use email or chat tools the attacker may monitor.

### If the owner is a multisig (Gnosis Safe)

- Contact the minimum quorum of signers (e.g., 3-of-5) to propose and approve an emergency `changeOwner(newSafeAddress)` transaction.
- If the compromised key is one signer, the remaining signers can still reach quorum and execute the ownership transfer without the attacker.
- After transfer, remove the compromised signer from the Safe via the Safe UI and add a replacement.
- Cancel any pending timelock operations the attacker may have queued: `cancelTimelockOperation(opId)`.

### If the owner is a single EOA

- Call `changeOwner(coldBackupAddress)` immediately from the compromised key if you still have access (attacker may not have changed owner yet).
- If the attacker has already called `changeOwner`, the contract is lost — proceed to emergency contract migration (see `docs/MIGRATION.md`).
- Cold backup key should be a hardware wallet stored offline and known only to the protocol lead and one designated backup person.
- Emergency contacts: reach the protocol lead and backup keyholder via pre-agreed phone numbers.

### Post-rotation verification

1. Confirm `owner()` returns the new address on-chain.
2. Test that the new owner can call: `pauseContract()`, `resumeContract()`, `setCybereumTreasury()`, `setCybereumFeeConfig()`, `addMember()`, `changeOwner()`.
3. Update `scripts/monitor.js` config with the new owner address for alert filtering.
4. Update deployment scripts and CI secrets if the owner key is used for deploys.
5. Broadcast a security notice to agents: `broadcastToAgents(3, "ipfs://key-rotation-notice")`.
