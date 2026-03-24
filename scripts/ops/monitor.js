const hre = require("hardhat");
const fs = require("fs/promises");

const DEFAULT_POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 30_000);
const DEFAULT_WITHDRAW_ALERT_WEI = BigInt(process.env.WITHDRAW_ALERT_WEI || "1000000000000000000");
const STATE_FILE = process.env.MONITOR_STATE_FILE || ".ops-monitor-state.json";

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { lastBlock: 0, treasury: null };
  }
}

async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function formatEth(value) {
  return hre.ethers.formatEther(value);
}

function alertLine(level, message) {
  const prefix = level === "warn" ? "⚠️" : level === "error" ? "❌" : "✅";
  console.log(`${prefix} ${message}`);
}

async function main() {
  const address = process.env.PROJECT_DAO_ADDRESS;
  if (!address) {
    throw new Error("PROJECT_DAO_ADDRESS is required.");
  }

  const contract = await hre.ethers.getContractAt("Project_DAO", address);
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();

  console.log(`[ops-monitor] Watching ${address} on chain ${network.chainId} (${hre.network.name})`);
  console.log(`[ops-monitor] Poll interval: ${DEFAULT_POLL_INTERVAL_MS}ms`);
  console.log(`[ops-monitor] Large-withdraw alert threshold: ${DEFAULT_WITHDRAW_ALERT_WEI} wei`);

  let state = await readState();

  async function pollOnce() {
    const latestBlock = await provider.getBlockNumber();
    const fromBlock = state.lastBlock > 0 ? state.lastBlock + 1 : Math.max(latestBlock - 1_000, 0);
    const toBlock = latestBlock;

    const [treasury, feeBps, flatFeeWei, agentCount] = await Promise.all([
      contract.cybereumTreasury(),
      contract.cybereumFeeBps(),
      contract.assetTransferFlatFeeWei(),
      contract.getAgentCount(),
    ]);

    if (state.treasury && state.treasury.toLowerCase() !== treasury.toLowerCase()) {
      alertLine("warn", `Treasury changed from ${state.treasury} to ${treasury}`);
    }

    const [treasuryEvents, feeEvents, withdrawEvents] = await Promise.all([
      contract.queryFilter(contract.filters.CybereumTreasuryUpdated(), fromBlock, toBlock),
      contract.queryFilter(contract.filters.CybereumFeeConfigUpdated(), fromBlock, toBlock),
      contract.queryFilter(contract.filters.AgentNativeEscrowWithdrawn(), fromBlock, toBlock),
    ]);

    treasuryEvents.forEach((event) => {
      alertLine("warn", `CybereumTreasuryUpdated -> ${event.args?.treasury} @ block ${event.blockNumber}`);
    });

    feeEvents.forEach((event) => {
      alertLine(
        "warn",
        `CybereumFeeConfigUpdated -> feeBps=${event.args?.feeBps?.toString?.()} assetFeeWei=${event.args?.assetTransferFlatFeeWei?.toString?.()} @ block ${event.blockNumber}`
      );
    });

    withdrawEvents.forEach((event) => {
      const amount = BigInt(event.args?.amount?.toString?.() || "0");
      if (amount >= DEFAULT_WITHDRAW_ALERT_WEI) {
        alertLine(
          "warn",
          `Large AgentNativeEscrowWithdrawn by ${event.args?.agent} amount=${formatEth(amount)} ETH @ block ${event.blockNumber}`
        );
      }
    });

    alertLine(
      "ok",
      `Heartbeat -> block=${latestBlock} treasury=${treasury} feeBps=${feeBps} flatFeeWei=${flatFeeWei} agents=${agentCount}`
    );

    state = { lastBlock: latestBlock, treasury };
    await writeState(state);
  }

  await pollOnce();
  setInterval(() => {
    pollOnce().catch((error) => {
      alertLine("error", error.message || String(error));
    });
  }, DEFAULT_POLL_INTERVAL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
