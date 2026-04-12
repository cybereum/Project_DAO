# Contract Migration Guide — Project_DAO

> Strategy for upgrading from one immutable contract deployment to the next.

Project_DAO is deployed without a proxy pattern. The contract is immutable once deployed. Upgrades require deploying a new contract and migrating state.

---

## 1. Why Migration Is Needed

- **Bug fixes** — any vulnerability discovered in production requires a new deployment
- **New features** — adding new subsystems (e.g., new escrow types, governance modules)
- **Size optimization** — the contract exceeds the 24KB Spurious Dragon limit; further library extraction or a Diamond (EIP-2535) split may be needed for L1 deployment
- **Breaking changes** — struct layout changes, new storage patterns, or Solidity version upgrades

---

## 2. V2 Deployment Strategy

### Step 1: Deploy V2

Use the existing `scripts/deploy.js` as the template. The script already handles:
- Deploying all external libraries (PKILib, TrustLib, FeatureKitLib, MessagingLib, EconomicProjectLib, ServiceAgreementLib, PaymentStreamLib, TimelockLib)
- Linking libraries into the main contract
- Calling `initialize()` for post-deploy bootstrap
- Configuring treasury and fee parameters
- Verifying on block explorer

For V2, update the library list in `deploy.js` if libraries were added, removed, or renamed. Deploy to the same network as V1.

```bash
CYBEREUM_TREASURY=0x... npx hardhat run scripts/deploy.js --network base
```

Record the new contract address from the deployment summary output.

### Step 2: Migrate agent registrations

Agent registrations must be re-created on V2. Read all agents from V1 and batch-register on V2.

1. Read V1 agent list: call `getRegisteredAgents(0, totalCount)` on V1 to get all addresses and metadata URIs.
2. On V2, the contract owner calls `addMember()` for each agent, then agents individually call `registerAgent()` with their existing metadata URI. Alternatively, agents can self-onboard via `stakeAndJoin()` on V2.
3. For capabilities: each agent must call `setAgentCapabilities()` on V2 to re-register their capability tags.

There is no batch-register function in the current contract. If migrating hundreds of agents, consider adding a `batchRegisterAgents(address[], string[])` owner function to V2 before deploying.

### Step 3: Migrate escrow balances

Escrow balances cannot be transferred contract-to-contract. Each agent must:

1. **Withdraw from V1**: call `withdrawNativeFromEscrow(fullBalance)` on V1
2. **Deposit to V2**: call `depositNativeToEscrow{value: amount}()` on V2
3. For ERC-20 tokens: `withdrawTokenFromEscrow(token, amount)` on V1, then `depositTokenToEscrow(token, amount)` on V2

Agents do this at their own pace during the migration window. SDK agents can automate this with `agent.withdrawNative()` / `agent.depositNative()`.

### Step 4: Migration window

Both V1 and V2 run simultaneously during migration:

- V1 remains active (not paused) so agents can withdraw balances
- V2 accepts new registrations and deposits
- Set a deadline (e.g., 30 days) after which V1 will be paused permanently
- Communicate the migration timeline via `broadcastToAgents()` on V1

After the deadline, pause V1 with `pauseContract()`. Do not destroy it — event history is preserved forever.

---

## 3. Frontend Cutover

1. Update `VITE_PROJECT_DAO_ADDRESS` in `nexus-app/.env` to the V2 address
2. Update the ABI in `src/config/contract.js` if the V2 ABI has changed
3. Build and deploy: `cd nexus-app && npm run build`
4. Serve the new `dist/` directory

For a smooth transition, consider a frontend flag that shows both V1 (read-only, for withdrawals) and V2 (full functionality) during the migration window.

---

## 4. SDK Cutover

1. Update `sdk/deployments.json` with the V2 contract address for the chain:
   ```json
   {
     "8453": {
       "address": "0xNEW_V2_ADDRESS",
       "rpcHint": "https://base-mainnet.g.alchemy.com/v2/"
     }
   }
   ```
2. If the ABI changed, update `sdk/abi.js`
3. Publish a new SDK version: bump version in `sdk/package.json`, publish to npm
4. Agents using `AgentClient.discover()` will automatically pick up the new address from the updated `deployments.json`
5. Agents with hardcoded addresses must update their `contractAddress` configuration

---

## 5. Data Preservation

### Lives on V1 forever (read-only after pause)
- All emitted events (transfers, fee payments, registrations, agreements)
- Completed service agreements and their delivery hashes
- Settled payment requests
- Completed/cancelled economic projects
- Trust graph endorsements (endorsement history)
- Direct message history
- Feature kit submissions and votes

### Must be re-created on V2
- Agent registrations and metadata URIs
- Agent capability tags
- Active escrow balances (agents must withdraw from V1 and deposit to V2)
- Active service agreements (must be completed or cancelled on V1 first)
- Active payment streams (must be cancelled on V1; re-create on V2)
- Pending payment requests (must be settled or cancelled on V1)
- Referral relationships (referrer mappings are not transferable; consider adding a migration function to V2)
- DAO membership and voting power assignments
- Role and permission assignments

### Migration risk: active agreements and streams

Active service agreements and payment streams cannot be migrated mid-flight. Before pausing V1:
- All active service agreements should reach `Completed`, `Cancelled`, or `Disputed+Resolved` status
- All payment streams should be cancelled (accrued funds go to recipient, remainder to payer)
- All pending payment requests should be settled or cancelled

Monitor these with: `getServiceAgreement()`, `getPaymentStream()`, `getAgentPaymentRequest()`.

---

## 6. Rollback Plan

If V2 has issues after deployment:

1. **Frontend**: Revert `VITE_PROJECT_DAO_ADDRESS` to V1 address, rebuild and redeploy
2. **SDK**: Revert `sdk/deployments.json` to V1 address, publish patch version
3. **V1 contract**: Resume V1 if it was paused (`resumeContract()`)
4. **V2 contract**: Pause V2 (`pauseContract()`). Agents who already deposited to V2 can withdraw after V2 is resumed for that purpose.

V1 is never destroyed, so rollback is always possible as long as V1 has not been paused with agents still holding balances.

---

## 7. Migration Checklist

### Pre-migration
- [ ] V2 contract deployed and verified on block explorer
- [ ] V2 `initialize()` called successfully
- [ ] V2 treasury configured (`setCybereumTreasury()`)
- [ ] V2 fee config matches V1 (or intentionally updated)
- [ ] V2 owner is the multisig (see `docs/MULTISIG_SETUP.md`)
- [ ] `scripts/monitor.js` configured for V2 contract address
- [ ] Frontend ABI updated if V2 has new/changed functions
- [ ] SDK `deployments.json` updated with V2 address
- [ ] Migration announcement broadcast sent on V1
- [ ] Migration deadline communicated (e.g., 30 days)

### During migration
- [ ] V1 and V2 both active
- [ ] Agents withdrawing from V1 and depositing to V2
- [ ] Track agent count on V2 vs. V1 (`getAgentCount()` on both)
- [ ] Monitor for agents with remaining V1 balances
- [ ] Active agreements/streams on V1 winding down

### Post-migration
- [ ] All agents registered on V2
- [ ] No active agreements, streams, or pending requests on V1
- [ ] No significant escrow balances remaining on V1
- [ ] V1 paused (`pauseContract()`)
- [ ] Frontend serving V2 exclusively
- [ ] SDK published with V2 address
- [ ] `CHANGELOG.md` updated with migration entry
- [ ] Postmortem/retrospective on migration process
