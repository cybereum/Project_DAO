# Smart Contract Security Audit Report

**Project:** Project_DAO
**Date:** 2026-03-20
**Auditor:** Claude (AI-assisted audit)
**Contracts in scope:**
- `contracts/Project_DAO.sol` (core — 1633 lines)
- `contracts/ValTokens/AssetNFT.sol`
- `contracts/VCDAO/VCDAO.sol`
- `contracts/MilestoneTracker/MilestoneTracker.sol`
- `contracts/MilestoneTracker/MilestoneTracker2.sol` (also duplicated at `contracts/MilestoneTracker2.sol`)
- `contracts/IKleros.sol`, `contracts/IAragonCourt.sol`

**Test suite:** 66 tests — all passing

---

## Executive Summary

The core `Project_DAO.sol` contract is reasonably well-structured with good access control patterns and a consistent fee model. However, there are several **critical**, **high**, and **medium** severity issues that should be addressed before mainnet deployment. The supporting contracts (`MilestoneTracker`, `VCDAO`, `AssetNFT`) have additional concerns including missing reentrancy guards and access control gaps.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High     | 8 |
| Medium   | 12 |
| Low      | 10 |
| Informational | 8 |

---

## CRITICAL Findings

### C-1: Contract exceeds EIP-170 size limit (24,576 bytes)

**File:** `Project_DAO.sol`
**Compiler warning:** `Contract code size is 41039 bytes and exceeds 24576 bytes`

The contract is ~41 KB, well over the 24,576-byte Spurious Dragon limit. **This contract cannot be deployed to Ethereum mainnet or most EVM L2s** without `allowUnlimitedContractSize` (test-only config).

**Recommendation:** Split into multiple contracts using a proxy pattern, library pattern, or Diamond (EIP-2535) pattern. Separate the agent economy, governance, and project modules.

---

### C-2: Economic project insolvency — claim payouts can exceed contract balance

**File:** `Project_DAO.sol:1517-1536` (`claimProjectShare`)

When contributors claim their shares, the payout is calculated as:
```solidity
uint256 payout = (proj.totalFunded * shares) / 10000;
```

However, `totalFunded` is never decremented when shares are claimed. If the proposer allocates 100% of shares across contributors, the total claimed equals `totalFunded`. But the contract may not actually hold that much ETH because:
1. Fees were collected from funding (reducing contract-held ETH vs `totalFunded`)
2. Other operations (withdraw, leaveDAO refunds) can reduce the contract's ETH balance

Additionally, refunds for cancelled projects use `projectFunderContributions` amounts, but there is no check that the contract has sufficient balance. If project funds were used elsewhere (via other escrow mechanisms), refunds will fail silently on low balance.

**Recommendation:** Track actual ETH held per project in a dedicated balance variable. Deduct from it on claim. Add a solvency check.

---

### C-3: `_collectNativeFee` in `transferNativeBetweenAgents` sends ETH to treasury from contract balance but doesn't verify contract has enough

**File:** `Project_DAO.sol:524-544`

In `transferNativeBetweenAgents`, the fee is sent to treasury via:
```solidity
(bool feeOk,) = payable(cybereumTreasury).call{value: fee}("");
```

This sends ETH from the **contract's balance**. The sender's escrow is debited, but the fee ETH must actually exist in the contract. If the contract is ever drained or underfunded (e.g., via project claims), these transfers will fail for all agents.

**Recommendation:** Ensure accounting integrity by verifying `address(this).balance` covers all obligations, or keep escrow and project funds in separate accounting pools.

---

## HIGH Findings

### H-1: Missing `nonReentrant` on `depositNativeToEscrow`

**File:** `Project_DAO.sol:496-503`

`depositNativeToEscrow` calls `_collectNativeFee` which sends ETH to `cybereumTreasury` via `.call{value: fee}("")`. If the treasury is a malicious contract, it could re-enter before `nativeEscrowBalance` is updated. While the fee is sent before balance update, the state is partially modified.

**Recommendation:** Add `nonReentrant` modifier.

---

### H-2: Missing `nonReentrant` on `transferNativeBetweenAgents`

**File:** `Project_DAO.sol:524-544`

Same pattern — sends ETH to treasury via low-level call without reentrancy protection. The treasury could re-enter to drain escrow.

**Recommendation:** Add `nonReentrant` modifier.

---

### H-3: `changeOwner` removes old owner membership — breaks invariants

**File:** `Project_DAO.sol:737-754`

```solidity
members[owner].isMember = false;
```

Setting the old owner's `isMember` to `false` does **not** remove them from `memberAddresses[]`. This means:
- `getMemberCount()` iterates but skips them (benign)
- But they remain in the array, consuming gas forever
- If the old owner later re-joins via `stakeAndJoin`, they'll be added to `memberAddresses` again, creating a duplicate

Also, the old owner's agent registration is untouched — they remain a registered agent even after losing membership.

**Recommendation:** Clean up `memberAddresses` properly and de-register the agent if needed.

---

### H-4: `leaveDAO` does not remove from `agentAddresses` array

**File:** `Project_DAO.sol:1307-1339`

When leaving, `agents[msg.sender].registered = false` is set, but the address remains in `agentAddresses[]`. This means:
- `getAgentCount()` returns inflated numbers
- `getRegisteredAgents()` returns de-registered agents (with `registered = false`)
- Discovery becomes unreliable over time

**Recommendation:** Remove from `agentAddresses[]` using swap-and-pop, or filter in `getRegisteredAgents`.

---

### H-5: `removeMember` does not de-register agent

**File:** `Project_DAO.sol:711-730`

When a member is removed by the owner, their agent profile (`agents[member].registered`) is not set to false. The removed member retains full agent privileges (escrow, transfer, payment requests).

**Recommendation:** Set `agents[_member].registered = false` in `removeMember`.

---

### H-6: MilestoneTracker v1 — no reentrancy guard on ETH transfers

**File:** `MilestoneTracker.sol:226-235`, `MilestoneTracker.sol:237-254`

`_payContractors` and `_payVerifiers` use `transfer()` which has a 2300 gas stipend (safe from reentrancy in practice), but this is fragile and could break with EIP changes. More critically, `completeMilestone` (line 185) is accessible by any contractor/verifier/client with no reentrancy protection.

**Recommendation:** Add `ReentrancyGuard` and use `call` instead of `transfer`.

---

### H-7: MilestoneTracker v1 — `payMilestone` has no access control

**File:** `MilestoneTracker.sol:256-288`

Anyone can call `payMilestone` to trigger payment from the contract to contractors. There is no check that the caller is the client or an authorized party. This could be exploited to drain contract funds.

**Recommendation:** Add access control requiring the client or authorized address.

---

### H-8: MilestoneTracker v1 — `completeMilestone` contradictory deadline logic

**File:** `MilestoneTracker.sol:185-214`

```solidity
require(milestone.deadline >= block.timestamp, "Milestone is past deadline");
// ...
if (block.timestamp > milestone.deadline && milestone.penalty > 0) {
```

The `require` on line 192 ensures `block.timestamp <= deadline`, but the `if` on line 198 checks `block.timestamp > deadline`. This condition is **impossible** — the penalty logic is dead code.

**Recommendation:** Fix the logic to allow completion past deadline with penalty, or remove the dead penalty code.

---

## MEDIUM Findings

### M-1: `previewFee` and `_calculateFee` differ on zero-amount behavior

**File:** `Project_DAO.sol:380-384` vs `449-458`

`previewFee` returns `fee=0` when `_amount==0`. `_calculateFee` returns `0` when `_amount==0 || cybereumFeeBps==0`. But `cybereumFeeBps` can never be 0 due to `MIN_FEE_BPS=1`. The check is unreachable and misleading.

**Recommendation:** Remove the `cybereumFeeBps == 0` branch from `_calculateFee`.

---

### M-2: Payment request ID 0 can never be created but is used as existence check

**File:** `Project_DAO.sol:660`

```solidity
require(request.id != 0, "Payment request does not exist.");
```

`currentAgentPaymentRequestId` starts at 1, so ID 0 is never assigned. However, accessing `agentPaymentRequests[0]` returns a zero-initialized struct where `id == 0`. This is correct but fragile — if initialization ever changes, this breaks.

**Recommendation:** Add an explicit `exists` boolean or check `request.requester != address(0)`.

---

### M-3: No expiration on payment requests

**File:** `Project_DAO.sol:623-695`

Payment requests have no deadline. A request created years ago can still be settled. This is problematic for agents that may have changed pricing, gone offline, or been de-registered.

**Recommendation:** Add an optional `expiresAt` field, or allow payers to reject requests.

---

### M-4: ERC-20 fee-on-transfer tokens will break escrow accounting

**File:** `Project_DAO.sol:546-558`

`depositTokenToEscrow` does:
```solidity
IERC20(_token).transferFrom(msg.sender, address(this), _amount);
// ... then credits _amount - protocolFee
```

If the token has a fee-on-transfer mechanism, the contract receives less than `_amount`, but credits escrow based on `_amount`. This creates phantom balances.

**Recommendation:** Measure actual received amount via `balanceOf` before/after pattern, or document that fee-on-transfer tokens are unsupported.

---

### M-5: No allowlist/denylist for ERC-20 tokens

**File:** `Project_DAO.sol`

Any ERC-20 address can be deposited. Malicious or rebasing tokens could manipulate escrow balances or cause unexpected reverts.

**Recommendation:** Consider a token allowlist for production.

---

### M-6: `withdrawTokenFromEscrow` — no reentrancy guard

**File:** `Project_DAO.sol:560-578`

Token withdrawals make two external calls (`IERC20.transfer` for fee and for user) without `nonReentrant`. While ERC-20 `transfer` is typically safe, malicious tokens (e.g., ERC-777 with hooks) could re-enter.

**Recommendation:** Add `nonReentrant` modifier.

---

### M-7: `_resolveProposalDispute` can set `proposalPassed = true` on already-executed proposals

**File:** `Project_DAO.sol:987-996`

There is no check for `proposal.executed` in `_resolveProposalDispute`. A dispute resolved in favor after a proposal has been executed could set `proposalPassed = true` on an already-failed proposal, creating inconsistent state.

**Recommendation:** Check `!proposal.executed` before modifying.

---

### M-8: Governance votes use raw voting power, not percentage-based quorum

**File:** `Project_DAO.sol:864-897`

`executeProposal` checks if `yesVotes > 50%` of total votes cast, not of total eligible voting power. A single member could vote "yes" on a proposal with no "no" votes and it would pass with >50%.

**Recommendation:** Implement a quorum requirement (minimum total votes as percentage of total voting power).

---

### M-9: VCDAO — weak verification code generation

**File:** `VCDAO.sol:114-116`

```solidity
return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, totalVerifiedCompanies)));
```

The verification code is deterministic and predictable on-chain. Any observer can compute it.

**Recommendation:** Use a commit-reveal scheme or off-chain oracle for verification.

---

### M-10: VCDAO — `removeVerifiedCredential` uses `delete` which leaves a gap

**File:** `VCDAO.sol:194-199`

`delete company.credentials[_credentialIndex]` sets the element to empty string but preserves array length. This leaves gaps that can cause confusion.

**Recommendation:** Use swap-and-pop pattern, or track validity separately.

---

### M-11: AssetNFT — `mintAsset` and `createAsset` are identical functions

**File:** `AssetNFT.sol:28-56`

Both functions have identical bodies. This is dead code duplication.

**Recommendation:** Remove one and keep the other.

---

### M-12: AssetNFT — hardcoded token URI base URL

**File:** `AssetNFT.sol:36`

```solidity
_setTokenURI(assetId, string(abi.encodePacked("https://example.com/asset/", _uint2str(assetId))));
```

Uses a placeholder `example.com` URL. This should be configurable.

**Recommendation:** Make the base URI a constructor parameter or settable by owner.

---

## LOW Findings

### L-1: Pragma `^0.8.0` is too loose

**Files:** `Project_DAO.sol`, `AssetNFT.sol`, `VCDAO.sol`, `MilestoneTracker.sol`

Using `^0.8.0` allows compilation with any 0.8.x compiler. The hardhat config pins 0.8.26, but the pragma should match to prevent accidental compilation with older versions missing bug fixes.

**Recommendation:** Use `pragma solidity 0.8.26;` or `^0.8.26`.

---

### L-2: Custom errors defined but never used

**File:** `Project_DAO.sol:15-25`

Custom errors (`Unauthorized`, `NotMember`, etc.) are defined but never used — all reverts use string messages. Custom errors save gas.

**Recommendation:** Migrate `require` statements to use custom errors with `revert`.

---

### L-3: Duplicate `MilestoneTracker2.sol` files

**Files:** `contracts/MilestoneTracker2.sol` and `contracts/MilestoneTracker/MilestoneTracker2.sol`

These are identical files. This causes confusion and potential maintenance issues.

**Recommendation:** Remove one copy.

---

### L-4: `addMember` iterates all milestones — gas griefing risk

**File:** `Project_DAO.sol:699-709`

Adding a member iterates all milestones to grant voting rights. With many milestones, this becomes expensive and could hit the block gas limit.

**Recommendation:** Use lazy evaluation or cap the milestone iteration.

---

### L-5: `getMemberCount` is O(n) — gas-expensive view

**File:** `Project_DAO.sol:756-764`

Iterates all `memberAddresses` to count active members. Should track a counter variable instead.

**Recommendation:** Maintain an `activeMemberCount` variable.

---

### L-6: `findMemberIndex` returns `int256` — overflow risk on large arrays

**File:** `Project_DAO.sol:272-279`

While practically safe (arrays won't reach `int256` max), the pattern of casting `uint256` index to `int256` and returning `-1` as sentinel is fragile.

**Recommendation:** Return `(bool found, uint256 index)` tuple instead.

---

### L-7: `completeProject` allows proposer to complete with no contributors

**File:** `Project_DAO.sol:1499-1510`

A proposer can create a project, get it funded, and immediately complete it. With no contributors, the funded ETH is locked forever (no one can claim shares, and the project can't be refunded once completed).

**Recommendation:** Require at least one contributor before completion, or give proposer an implicit share.

---

### L-8: `cancelProject` doesn't check deadline

**File:** `Project_DAO.sol:1543-1557`

A proposer can cancel at any time, even after the deadline. This could be used to avoid payouts to contributors.

**Recommendation:** Consider restrictions on cancellation once project is Active with contributors.

---

### L-9: Economic project refund may underflow `totalFunded`

**File:** `Project_DAO.sol:1572`

```solidity
proj.totalFunded -= amount;
```

If `claimProjectShare` is somehow called before `cancelProject` (impossible with current status checks, but fragile if statuses are added), this could underflow.

**Recommendation:** Use SafeMath or add an explicit check.

---

### L-10: `AssetNFT._isApprovedOrOwner` — deprecated in OZ v5

**File:** `AssetNFT.sol:73`

OpenZeppelin v5 removed `_isApprovedOrOwner`. If the project upgrades OZ, this will break.

**Recommendation:** Use `_requireOwned` + `_isAuthorized` pattern from OZ v5.

---

## INFORMATIONAL Findings

### I-1: IERC20/IERC721 interfaces defined inline

`Project_DAO.sol` defines its own `IERC20` and `IERC721Lite` interfaces instead of importing OpenZeppelin's. While functionally equivalent, this diverges from the pattern used in other contracts.

### I-2: No `receive()` or `fallback()` function

`Project_DAO.sol` has no explicit `receive()`. ETH sent directly to the contract (not through a payable function) will revert. This is likely intentional but should be documented.

### I-3: Event indexing inconsistencies

Some events have indexed parameters, others don't. Events that will be queried by address (transfers, registrations) should consistently index address parameters.

### I-4: `currentMilestoneId` is incremented but never used as an ID

**File:** `Project_DAO.sol:151, 794`

`currentMilestoneId` starts at 1 and is incremented in `createMilestone`, but milestones are stored in an array using `milestones.length` as the index. The counter is unused.

### I-5: `roleIndex` in `assignRoleToMilestone` is computed but only used for event emission

**File:** `Project_DAO.sol:333-348`

The computed `roleIndex` doesn't affect storage — it's only used in the `RoleAssigned` event. This could be misleading.

### I-6: No ERC-165 `supportsInterface` on the main contract

If agents or other contracts try to detect capability via ERC-165, they won't find support. Consider implementing for discovery.

### I-7: Compiler warnings

- `VCDAO.sol:321` — unused function parameters in `trackImpact`
- `VCDAO.sol:321` — function could be `view`

### I-8: No upgrade path

The contract has no proxy or upgrade mechanism. Once deployed, bugs cannot be fixed without redeployment and migration.

---

## Test Coverage Gaps

The test suite (66 tests) covers the core agent economy flows well but has gaps:

| Area | Status |
|------|--------|
| Fee config, treasury | Well tested |
| Agent registration & discovery | Well tested |
| Native escrow (deposit/withdraw/transfer) | Well tested |
| Payment requests (create/settle/cancel) | Well tested |
| Token escrow & token payments | Well tested |
| NFT transfer between agents | Tested |
| Pause/unpause | Tested |
| stakeAndJoin / leaveDAO | Tested |
| Economic projects lifecycle | Tested |
| Feature kits | Tested |
| **Governance (proposals/voting/execution)** | **NOT TESTED** |
| **Disputes** | **NOT TESTED** |
| **Role management** | **NOT TESTED** |
| **Milestone management** | **NOT TESTED** |
| **Task management** | **NOT TESTED** |
| **Broadcast** | **NOT TESTED** |
| **changeOwner** | **NOT TESTED** |
| **Edge cases: leaveDAO with active projects** | **NOT TESTED** |
| **Edge cases: paused operations across all functions** | **Partially tested** |
| **Reentrancy attack scenarios** | **NOT TESTED** |
| **Fee-on-transfer token scenarios** | **NOT TESTED** |
| **Supporting contracts (VCDAO, MilestoneTracker, AssetNFT)** | **NOT TESTED** |

---

## Recommendations Summary

### Before Mainnet Deployment (blocking)
1. **Split the contract** to fit within the 24 KB limit (C-1)
2. **Fix economic project insolvency risk** — track per-project ETH balance (C-2, C-3)
3. **Add `nonReentrant`** to `depositNativeToEscrow`, `transferNativeBetweenAgents`, `withdrawTokenFromEscrow` (H-1, H-2, M-6)
4. **Fix `leaveDAO`** to remove from `agentAddresses[]` (H-4)
5. **Fix `removeMember`** to de-register agent (H-5)
6. **Fix `changeOwner`** to clean up old owner properly (H-3)

### Before Production Use (important)
7. Add expiration to payment requests (M-3)
8. Handle fee-on-transfer tokens or document unsupported (M-4)
9. Add quorum to governance (M-8)
10. Use custom errors instead of string reverts to reduce contract size (L-2)
11. Pin pragma to `0.8.26` (L-1)
12. Add comprehensive tests for governance, disputes, roles, and edge cases

### Nice to Have
13. Token allowlist (M-5)
14. ERC-165 support (I-6)
15. Upgrade mechanism (I-8)
16. Remove duplicate code (L-3, M-11)
