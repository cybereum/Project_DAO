# Gas Optimization Notes

Known gas scaling issues in the current contract and recommended fixes for V2.

---

## 1. addMember / removeMember — O(n) Milestone Iteration

### Current Behavior

`addMember` and `removeMember` iterate over **all milestones** to update per-member voting eligibility:

```solidity
// addMember (line 1091-1094 of Project_DAO.sol)
for (uint256 i = 0; i < milestones.length; i++) {
    milestoneMembersWhoCanVote[i][_newMember] = true;
    milestones[i].membersWhoCanVoteCount++;
}
```

Each iteration costs ~25,000 gas (SSTORE for mapping write + counter increment). At scale:

| Milestones | addMember gas | removeMember gas |
|---|---|---|
| 10 | ~250K | ~300K |
| 50 | ~1.25M | ~1.5M |
| 100 | ~2.5M | ~3.0M |
| 500 | ~12.5M | ~15M (may hit block gas limit) |

### Operational Mitigation (Current Contract)

Since the contract is immutable once deployed:

1. **Keep milestone count reasonable.** Under 100 milestones keeps addMember/removeMember under 3M gas.
2. **Prefer stakeAndJoin** over owner-called addMember when possible — stakeAndJoin does NOT iterate milestones (it creates the member + agent in one tx without milestone eligibility setup).
3. **Batch member additions** during low-gas periods if adding many members.
4. **Archive completed milestones** off-chain and avoid creating unnecessary on-chain milestones.

### V2 Fix: Lazy Eligibility

Replace the per-milestone iteration with a timestamp-based eligibility check:

```solidity
// V2: Store when each member joined
mapping(address => uint256) public memberJoinedAtMilestone;

function addMember(address _newMember, uint256 _votingPower) public onlyOwner {
    members[_newMember].isMember = true;
    members[_newMember].votingPower = _votingPower;
    memberJoinedAtMilestone[_newMember] = milestones.length;
    memberCount++;
}

// V2: Check eligibility lazily during voting
function canVoteOnMilestone(address _member, uint256 _milestoneId) public view returns (bool) {
    return members[_member].isMember && memberJoinedAtMilestone[_member] <= _milestoneId;
}
```

This makes addMember O(1) regardless of milestone count. The trade-off is that milestone vote counting becomes lazy (computed at query time rather than stored), which costs slightly more gas per vote but eliminates the scaling issue entirely.

### Files to Change (V2)

- `contracts/Project_DAO.sol`: `addMember`, `removeMember`, `createMilestone`, all milestone voting eligibility checks
- `test/ProjectDAO.test.js`: Update tests for lazy eligibility
- `sdk/index.js`: No change needed (SDK doesn't call addMember)

---

## 2. memberAddresses Array Removal — O(n)

`removeMember` also iterates `memberAddresses[]` to find and swap-remove the member:

```solidity
for (uint256 i = 0; i < memberAddresses.length; i++) {
    if (memberAddresses[i] == _member) {
        memberAddresses[i] = memberAddresses[memberAddresses.length - 1];
        memberAddresses.pop();
        break;
    }
}
```

### V2 Fix

Use an index mapping:

```solidity
mapping(address => uint256) private memberAddressIndex;

// In addMember:
memberAddressIndex[_newMember] = memberAddresses.length;
memberAddresses.push(_newMember);

// In removeMember:
uint256 idx = memberAddressIndex[_member];
address last = memberAddresses[memberAddresses.length - 1];
memberAddresses[idx] = last;
memberAddressIndex[last] = idx;
memberAddresses.pop();
delete memberAddressIndex[_member];
```

This makes removal O(1).
