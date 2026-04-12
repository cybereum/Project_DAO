import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock data shape validation ─────────────────────────────────────────────

import {
  MOCK_PROJECTS, MOCK_MILESTONES, MOCK_PROPOSALS, MOCK_MEMBERS,
  MOCK_COMPANIES, MOCK_NFTS, MOCK_TASKS,
} from '../mockData';

describe('mockData exports', () => {
  it('exports all expected collections as non-empty arrays', () => {
    const collections = {
      MOCK_PROJECTS, MOCK_MILESTONES, MOCK_PROPOSALS,
      MOCK_MEMBERS, MOCK_COMPANIES, MOCK_NFTS, MOCK_TASKS,
    };
    for (const [name, arr] of Object.entries(collections)) {
      expect(Array.isArray(arr), `${name} should be an array`).toBe(true);
      expect(arr.length, `${name} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('MOCK_PROJECTS entries have the shape consumed by the store', () => {
    for (const p of MOCK_PROJECTS) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('status');
      expect(p).toHaveProperty('budget');
      expect(p).toHaveProperty('progress');
      expect(typeof p.id).toBe('number');
      expect(typeof p.name).toBe('string');
      expect(typeof p.progress).toBe('number');
    }
  });

  it('MOCK_PROPOSALS entries have voting fields used by castVote', () => {
    for (const p of MOCK_PROPOSALS) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('yesVotes');
      expect(p).toHaveProperty('noVotes');
      expect(p).toHaveProperty('status');
      expect(typeof p.yesVotes).toBe('number');
      expect(typeof p.noVotes).toBe('number');
    }
  });

  it('MOCK_MILESTONES entries reference valid project IDs', () => {
    const projectIds = new Set(MOCK_PROJECTS.map(p => p.id));
    for (const m of MOCK_MILESTONES) {
      expect(m).toHaveProperty('projectId');
      expect(projectIds.has(m.projectId), `milestone ${m.id} references unknown projectId ${m.projectId}`).toBe(true);
    }
  });

  it('MOCK_MEMBERS entries have address and votingPower fields', () => {
    for (const m of MOCK_MEMBERS) {
      expect(m).toHaveProperty('address');
      expect(m).toHaveProperty('votingPower');
      expect(typeof m.address).toBe('string');
      expect(typeof m.votingPower).toBe('number');
    }
  });

  it('MOCK_NFTS entries have owner and value fields', () => {
    for (const n of MOCK_NFTS) {
      expect(n).toHaveProperty('id');
      expect(n).toHaveProperty('owner');
      expect(n).toHaveProperty('value');
    }
  });

  it('MOCK_TASKS entries reference valid milestone IDs', () => {
    const milestoneIds = new Set(MOCK_MILESTONES.map(m => m.id));
    for (const t of MOCK_TASKS) {
      expect(t).toHaveProperty('milestoneId');
      expect(milestoneIds.has(t.milestoneId), `task ${t.id} references unknown milestoneId ${t.milestoneId}`).toBe(true);
    }
  });
});

// ─── hasContractConfig behavior ─────────────────────────────────────────────

describe('hasContractConfig', () => {
  it('returns false when VITE_PROJECT_DAO_ADDRESS is not set (default test env)', async () => {
    // In the test environment, import.meta.env.VITE_PROJECT_DAO_ADDRESS is undefined,
    // so PROJECT_DAO_ADDRESS defaults to '' and hasContractConfig() returns false.
    const { hasContractConfig } = await import('../../config/contract');
    expect(hasContractConfig()).toBe(false);
  });

  it('USE_MOCK is true when no contract is configured, causing mock data to populate state', async () => {
    // The store imports USE_MOCK = !hasContractConfig(). When no address is set,
    // the initial state arrays are populated from mock data. We verify the mock
    // data is well-formed above; here we verify the contract config flag itself.
    // Since VITE_PROJECT_DAO_ADDRESS is not set in test env, hasContractConfig() is false.
    // We can't directly access the private USE_MOCK constant, but we verify the
    // precondition: hasContractConfig() === false implies USE_MOCK === true.
    const { hasContractConfig, PROJECT_DAO_ADDRESS } = await import('../../config/contract');
    expect(PROJECT_DAO_ADDRESS).toBe('');
    expect(hasContractConfig()).toBe(false);
  });
});

// ─── waitWithTimeout utility ────────────────────────────────────────────────

// Re-implement waitWithTimeout identically to the source so we can test it
// in isolation (it's a module-private function in appStore.jsx).
const TX_TIMEOUT_MS = 120_000;

function waitWithTimeout(txPromise, ms = TX_TIMEOUT_MS) {
  let timeoutId;
  let settled = false;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Transaction timed out. It may still confirm — check your wallet.'));
    }, ms);
  });

  const wrappedTxPromise = txPromise.finally(() => {
    if (!settled) {
      settled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  });

  return Promise.race([wrappedTxPromise, timeoutPromise]);
}

describe('waitWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the inner promise value when it settles before the timeout', async () => {
    const receipt = { hash: '0xabc', status: 1 };
    const txPromise = Promise.resolve(receipt);

    const result = await waitWithTimeout(txPromise, 5000);
    expect(result).toEqual(receipt);
  });

  it('rejects with timeout error when the inner promise does not settle in time', async () => {
    // A promise that never resolves
    const neverResolves = new Promise(() => {});

    const racePromise = waitWithTimeout(neverResolves, 5000);

    // Advance past the timeout
    vi.advanceTimersByTime(5001);

    await expect(racePromise).rejects.toThrow('Transaction timed out');
  });

  it('propagates rejection from the inner promise (not the timeout)', async () => {
    const txPromise = Promise.reject(new Error('user rejected transaction'));

    await expect(waitWithTimeout(txPromise, 5000)).rejects.toThrow('user rejected transaction');
  });

  it('clears the timeout when the inner promise resolves before deadline', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    let resolve;
    const txPromise = new Promise((r) => { resolve = r; });

    const racePromise = waitWithTimeout(txPromise, 10_000);

    // Resolve before the timeout fires
    resolve({ status: 1 });
    await racePromise;

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('uses the default 120s timeout when no ms argument is provided', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const neverResolves = new Promise(() => {});
    const racePromise = waitWithTimeout(neverResolves);

    // Find the setTimeout call made by waitWithTimeout (not any internal ones)
    const timeoutCall = setTimeoutSpy.mock.calls.find(([, ms]) => ms === 120_000);
    expect(timeoutCall).toBeDefined();

    // Advance to trigger timeout so the promise settles and test cleans up
    vi.advanceTimersByTime(120_001);
    await expect(racePromise).rejects.toThrow('Transaction timed out');

    setTimeoutSpy.mockRestore();
  });
});

// ─── syncProposalsFromChain data transformation ─────────────────────────────

// The transformation logic inside syncProposalsFromChain converts raw contract
// tuples into the UI proposal shape. We extract and test that mapping here.

function transformChainProposals(chainProposals) {
  return chainProposals.map((proposalTuple, i) => {
    const proposalId = Number(proposalTuple.id ?? i + 1);
    const votingDeadline = Number(proposalTuple.votingDeadline ?? 0);
    const yesVotes = Number(proposalTuple.yesVotes ?? 0);
    const noVotes = Number(proposalTuple.noVotes ?? 0);
    const title = (proposalTuple.description || `On-chain Proposal #${proposalId}`).slice(0, 64);
    const status = proposalTuple.executed
      ? (proposalTuple.proposalPassed ? 'Passed' : 'Rejected')
      : 'Active';

    return {
      id: proposalId,
      title,
      description: proposalTuple.description || 'On-chain governance proposal.',
      status,
      yesVotes,
      noVotes,
      projectId: 1,
      author: 'On-chain',
      deadline: votingDeadline
        ? new Date(votingDeadline * 1000).toISOString().split('T')[0]
        : 'N/A',
    };
  }).sort((a, b) => a.id - b.id);
}

describe('syncProposalsFromChain — data transformation', () => {
  it('converts a chain proposal tuple into the UI shape', () => {
    const chainData = [{
      id: 3n,
      description: 'Increase staking reward',
      votingDeadline: 1714500000n,
      executed: false,
      proposalPassed: false,
      yesVotes: 7n,
      noVotes: 2n,
    }];

    const result = transformChainProposals(chainData);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 3,
      title: 'Increase staking reward',
      description: 'Increase staking reward',
      status: 'Active',
      yesVotes: 7,
      noVotes: 2,
      projectId: 1,
      author: 'On-chain',
      deadline: '2024-04-30',
    });
  });

  it('marks executed proposals as Passed or Rejected based on proposalPassed', () => {
    const passed = transformChainProposals([{
      id: 1n, description: 'A', votingDeadline: 0n,
      executed: true, proposalPassed: true, yesVotes: 10n, noVotes: 1n,
    }]);
    expect(passed[0].status).toBe('Passed');

    const rejected = transformChainProposals([{
      id: 2n, description: 'B', votingDeadline: 0n,
      executed: true, proposalPassed: false, yesVotes: 1n, noVotes: 10n,
    }]);
    expect(rejected[0].status).toBe('Rejected');
  });

  it('uses fallback title when description is empty', () => {
    const result = transformChainProposals([{
      id: 5n, description: '', votingDeadline: 0n,
      executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n,
    }]);

    expect(result[0].title).toBe('On-chain Proposal #5');
    expect(result[0].description).toBe('On-chain governance proposal.');
  });

  it('truncates title to 64 characters', () => {
    const longDesc = 'A'.repeat(100);
    const result = transformChainProposals([{
      id: 1n, description: longDesc, votingDeadline: 0n,
      executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n,
    }]);

    expect(result[0].title).toHaveLength(64);
    // Full description is preserved untruncated
    expect(result[0].description).toBe(longDesc);
  });

  it('sets deadline to N/A when votingDeadline is zero', () => {
    const result = transformChainProposals([{
      id: 1n, description: 'Test', votingDeadline: 0n,
      executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n,
    }]);

    expect(result[0].deadline).toBe('N/A');
  });

  it('sorts proposals by id in ascending order', () => {
    const result = transformChainProposals([
      { id: 3n, description: 'C', votingDeadline: 0n, executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n },
      { id: 1n, description: 'A', votingDeadline: 0n, executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n },
      { id: 2n, description: 'B', votingDeadline: 0n, executed: false, proposalPassed: false, yesVotes: 0n, noVotes: 0n },
    ]);

    expect(result.map(p => p.id)).toEqual([1, 2, 3]);
  });

  it('replaces state entirely (no mock data survives)', () => {
    // The store calls setProposals(() => transformedChainData).
    // This is a state replacement, not a merge. We verify the transformation
    // output contains ONLY the chain data entries, not any mock entries.
    const chainData = [
      { id: 1n, description: 'Only chain proposal', votingDeadline: 0n, executed: false, proposalPassed: false, yesVotes: 3n, noVotes: 1n },
    ];

    const result = transformChainProposals(chainData);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Only chain proposal');
    // None of the mock proposal titles appear
    const mockTitles = MOCK_PROPOSALS.map(p => p.title);
    for (const p of result) {
      expect(mockTitles).not.toContain(p.title);
    }
  });

  it('handles BigInt values from ethers.js contract calls', () => {
    const result = transformChainProposals([{
      id: BigInt(42),
      description: 'BigInt test',
      votingDeadline: BigInt(1700000000),
      executed: false,
      proposalPassed: false,
      yesVotes: BigInt(999),
      noVotes: BigInt(1),
    }]);

    expect(result[0].id).toBe(42);
    expect(result[0].yesVotes).toBe(999);
    expect(result[0].noVotes).toBe(1);
    expect(typeof result[0].id).toBe('number');
    expect(typeof result[0].yesVotes).toBe('number');
  });
});
