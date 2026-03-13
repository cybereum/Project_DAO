# Operations Runbook — Project_DAO

> Day-to-day operational procedures for protocol operators, treasury managers, and DAO administrators.

---

## 1. Roles and Responsibilities

| Role | Who | Responsibilities |
|------|-----|------------------|
| **Contract Owner** | Deployer wallet / multisig | Treasury config, fee config, member management, pause/resume, role creation, feature kit status |
| **DAO Members** | Added by owner or self-onboarded | Agent registration, proposal creation, voting, feature kit submission/upvoting |
| **Registered Agents** | Members who called `registerAgent` | Escrow operations, transfers, payment requests, project participation |
| **Protocol Operator** | Infra/DevOps team | Monitoring, alerting, deployment, indexer management |

---

## 2. Treasury Management

### 2.1 Setting the Treasury Address

The treasury receives all protocol fees. It must be set before any agent transactions.

```bash
# Via deployment script (recommended for initial setup)
CYBEREUM_TREASURY=0x<resolved-cybereum-eth-address> npx hardhat run scripts/deploy.js --network <network>

# Via direct contract call (post-deployment)
# Only the contract owner can call this
setCybereumTreasury(0x<resolved-cybereum-eth-address>)
```

**Pre-flight checks:**
1. Resolve `cybereum.eth` ENS name to its current address
2. Verify the resolved address is correct (cross-check on Etherscan)
3. Ensure the treasury address can receive ETH (is an EOA or has `receive()` function)
4. Confirm the caller is the contract owner

**Post-change verification:**
```solidity
// Read back the treasury address
cybereumTreasury()  // Should return the newly set address
```

**Event emitted:** `CybereumTreasuryUpdated(address indexed treasury)`

### 2.2 Monitoring Treasury Balance

Monitor the treasury address for fee accrual:

```javascript
// Using ethers.js
const balance = await provider.getBalance(treasuryAddress);
console.log(`Treasury balance: ${ethers.formatEther(balance)} ETH`);
```

**Key monitoring signals:**
- Treasury balance should increase with each agent transaction
- Zero-growth periods indicate no agent activity or a misconfiguration
- Sudden large increases may indicate high-volume activity (normal) or test transactions

### 2.3 Treasury Address Change Procedure

Changing the treasury address redirects all future fee revenue. This is a high-impact operation.

**Procedure:**
1. Announce the change to DAO members (via `broadcastToAgents` if available)
2. Verify the new address is correct and can receive ETH
3. Call `setCybereumTreasury(newAddress)` from the owner wallet
4. Verify by reading `cybereumTreasury()` on-chain
5. Monitor the next few transactions to confirm fees route to the new address
6. Document the change in the changelog

**Risk:** Currently no timelock or multisig guard exists. The owner can change the treasury immediately. Consider implementing governance delay for production.

---

## 3. Fee Configuration

### 3.1 Current Fee Parameters

| Parameter | Default | Range | Function to Change |
|-----------|---------|-------|-------------------|
| `cybereumFeeBps` | 5 (0.05%) | 1–100 bps | `setCybereumFeeConfig` |
| `assetTransferFlatFeeWei` | 1e12 wei | Any uint256 | `setCybereumFeeConfig` |

### 3.2 Changing Fee Configuration

```solidity
// Both parameters must be set together
setCybereumFeeConfig(
    newFeeBps,                    // Must be >= MIN_FEE_BPS (1)
    newAssetTransferFlatFeeWei    // Flat fee for NFT transfers
)
```

**Constraints:**
- `newFeeBps` must be >= 1 (MIN_FEE_BPS) — fee cannot be disabled
- `newFeeBps` must be <= 100 (MAX_FEE_BPS) — fee cannot exceed 1%
- Only the contract owner can call this function

**Pre-change checklist:**
1. Calculate impact on agent transaction costs at the new rate
2. Consider announcing to agents before changing (especially if increasing)
3. Verify the math: `fee = amount * feeBps / 10000`

**Post-change verification:**
```solidity
cybereumFeeBps()           // Should return new value
assetTransferFlatFeeWei()  // Should return new value
```

**Event emitted:** `CybereumFeeConfigUpdated(uint256 feeBps, uint256 assetTransferFlatFeeWei)`

### 3.3 Fee Calculation Reference

```
For a 1 ETH transfer at 5 bps:
  fee = 1e18 * 5 / 10000 = 5e14 wei = 0.0005 ETH
  net = 1e18 - 5e14 = 999500000000000000 wei = 0.9995 ETH

For a 0.001 ETH transfer at 5 bps:
  fee = 1e15 * 5 / 10000 = 5e11 wei = 0.0000005 ETH
  net = 1e15 - 5e11 = 999500000000000 wei

Minimum fee: 1 wei (even on sub-dust amounts)
```

---

## 4. Member Management

### 4.1 Adding Members (Owner-Gated)

```solidity
addMember(0x<member-address>, votingPower)
```

- `votingPower` determines the member's weight in governance votes
- Members can then call `registerAgent` to become agents
- Members can create proposals, vote, and submit feature kits

### 4.2 Self-Onboarding (Permissionless)

Members can join without owner approval by staking:

```solidity
stakeAndJoin{ value: stakeAmount }("ipfs://<metadata-cid>")
```

- Requires `msg.value >= minStakeToJoin`
- Automatically registers the caller as both member and agent
- Stake is refundable via `leaveDAO()`

**Setting minimum stake:**
```solidity
setMinStakeToJoin(newMinStake)  // Owner only
```

### 4.3 Removing Members

```solidity
removeMember(0x<member-address>)  // Owner only
```

**Considerations:**
- This does not affect the member's escrow balances — they can still withdraw
- The member's agent registration is not automatically revoked
- Any pending proposals or votes from this member remain on-chain

### 4.4 Granting Privileges

```solidity
grantPrivilege(0x<member-address>, privilegeId)
```

### 4.5 Member Departure (Self-Service)

Members who joined via `stakeAndJoin` can leave and reclaim their stake:

```solidity
leaveDAO()  // Returns staked ETH to the caller
```

---

## 5. Role and Permission Management

### 5.1 Creating Roles

```solidity
createRole(bytes32("BUILDER"))      // Returns roleId
createRole(bytes32("VERIFIER"))     // Returns roleId
createRole(bytes32("AUDITOR"))      // Returns roleId
```

### 5.2 Adding Permissions to Roles

```solidity
addPermission(roleId, "create_task")
addPermission(roleId, "update_progress")
addPermission(roleId, "approve_milestone")
```

### 5.3 Assigning Roles to Members

```solidity
assignRole(0x<member-address>, roleId)
assignRoleToMilestone(0x<member-address>, milestoneId, bytes32("BUILDER"))
```

---

## 6. Emergency Procedures

### 6.1 Pausing the Contract

If a security issue, bug, or attack is detected, immediately pause the contract:

```solidity
pauseContract()  // Owner only
```

**Effect:** All state-changing functions are disabled. Read-only functions still work.

**When to pause:**
- Suspected reentrancy or exploit in progress
- Discovery of a critical bug in fee calculation
- Treasury address compromised
- Abnormal transaction patterns suggesting an attack

### 6.2 Resuming the Contract

After the issue is resolved:

```solidity
resumeContract()  // Owner only
```

**Before resuming, verify:**
1. The root cause has been identified and fixed (or mitigated)
2. Treasury address is correct and secure
3. Fee configuration is correct
4. No unauthorized member additions occurred during the incident
5. Consider announcing the resume to agents via `broadcastToAgents`

### 6.3 Emergency Treasury Redirect

If the treasury address is compromised:

1. **Immediately pause** the contract: `pauseContract()`
2. Set new treasury: `setCybereumTreasury(newSafeAddress)`
3. Verify: `cybereumTreasury()` returns the new address
4. Resume: `resumeContract()`
5. Monitor the next transactions to confirm correct fee routing

### 6.4 Owner Key Compromise

If the owner key is compromised:

1. **From a different secure key** (if owner transfer is possible), call `changeOwner(newOwnerAddress)`
2. If the compromised key has already been used maliciously:
   - Document all unauthorized changes (treasury, fees, members)
   - Broadcast alert to agents
   - Consider deploying a new contract and migrating state

---

## 7. Agent Broadcasts

The owner can send broadcasts to all agents listening on-chain:

```solidity
broadcastToAgents(
    "ipfs://<message-uri>",   // Message content URI
    broadcastType              // 0=info, 1=upgrade, 2=governance, 3=security
)
```

**Use cases:**
- **Type 0 (Info):** General announcements, feature releases
- **Type 1 (Upgrade):** Contract upgrades, migration notices
- **Type 2 (Governance):** Proposal results, policy changes
- **Type 3 (Security):** Security alerts, pause/resume notices, vulnerability disclosures

**Event emitted:** `AgentBroadcast(uint256 broadcastId, address sender, uint8 broadcastType, string messageURI, uint256 timestamp)`

---

## 8. Feature Kit Administration

### 8.1 Reviewing Submitted Kits

```solidity
getFeatureKits(0, 50)  // Returns (FeatureKit[], total)
```

### 8.2 Advancing Kit Status

```solidity
// Validate a promising kit
setFeatureKitStatus(kitId, 1, "Validated by core team")  // Pending -> Validated

// Queue for implementation
setFeatureKitStatus(kitId, 2, "Scheduled for Phase B")   // Validated -> Queued

// Mark as implemented
setFeatureKitStatus(kitId, 4, "Shipped in v0.4.0")       // Queued -> Implemented

// Reject a kit
setFeatureKitStatus(kitId, 3, "Out of scope for current roadmap")  // -> Rejected
```

**Status lifecycle:** Pending (0) -> Validated (1) -> Queued (2) -> Implemented (4), with Rejected (3) as terminal.

---

## 9. Deployment Operations

### 9.1 Deploying to a New Network

```bash
# 1. Set environment variables
export CYBEREUM_TREASURY=0x<treasury-address>
export FEE_BPS=5          # Optional, defaults to 5
export ASSET_FEE_WEI=1000000000000  # Optional, defaults to 1e12

# 2. Deploy
npx hardhat run scripts/deploy.js --network <network-name>

# 3. Record the deployed contract address
# 4. Set VITE_PROJECT_DAO_ADDRESS in nexus-app/.env
# 5. Rebuild and deploy frontend
cd nexus-app && npm run build
```

### 9.2 Post-Deployment Checklist

- [ ] Verify contract is deployed and verified on block explorer
- [ ] Confirm `cybereumTreasury` is set correctly
- [ ] Confirm `cybereumFeeBps` is set correctly
- [ ] Add initial members with `addMember`
- [ ] Test agent registration with a test account
- [ ] Test a small deposit and transfer to verify fee routing
- [ ] Update `VITE_PROJECT_DAO_ADDRESS` in frontend config
- [ ] Deploy updated frontend
- [ ] Monitor first few real transactions

### 9.3 Network Configuration

Hardhat network templates are in `hardhat.config.js`. To add a new network:

```javascript
// In hardhat.config.js networks section:
newNetwork: {
    url: process.env.NEW_NETWORK_RPC_URL,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
}
```

---

## 10. Monitoring Checklist

### Daily Checks
- [ ] Treasury balance has increased (indicates active fee collection)
- [ ] No unexpected `CybereumTreasuryUpdated` events
- [ ] No unexpected `CybereumFeeConfigUpdated` events
- [ ] Agent registration count trending correctly
- [ ] No error spikes in frontend logs

### Weekly Checks
- [ ] Review total fee accrual for the week
- [ ] Review agent count growth
- [ ] Review transaction volume by rail (native, token, asset, payment requests)
- [ ] Check for any pending feature kit submissions requiring triage
- [ ] Review any unresolved disputes

### Monthly Checks
- [ ] Review fee rate appropriateness (is 0.05% still correct?)
- [ ] Review minimum stake amount for self-onboarding
- [ ] Audit member list for any that should be removed
- [ ] Review and update agent metadata schema if needed
- [ ] Run NexusAI protocol health analysis

---

## 11. Troubleshooting

### Fee Not Being Collected
1. Check `cybereumTreasury()` is set to a valid, non-zero address
2. Check `cybereumFeeBps()` is > 0
3. Verify the treasury address can receive ETH (not a contract without `receive()`)
4. Check transaction logs for `CybereumFeePaid` events

### Agent Cannot Register
1. Verify the caller is a DAO member (`members[address].isMember == true`)
2. Check the contract is not paused (`_paused == false`)
3. Verify the metadata URI is not empty

### Transaction Reverts
1. Check if the contract is paused
2. Verify the caller has the required role (member, agent, owner)
3. Check sufficient balance for the operation
4. For payment request settlement: verify the request exists and is in "Requested" status
5. For asset transfers: verify exact `assetTransferFlatFeeWei` is sent as `msg.value`

### Frontend Cannot Connect to Contract
1. Verify `VITE_PROJECT_DAO_ADDRESS` is set correctly in `.env`
2. Verify the ABI in `config/contract.js` matches the deployed contract
3. Check the user's wallet is connected to the correct network
4. Verify the RPC endpoint is accessible
