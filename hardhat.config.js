require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

// Use bundled solcjs to avoid network download in restricted environments
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async () => {
  return {
    version: "0.8.26",
    longVersion: "0.8.26+bundled",
    compilerPath: require.resolve("solc/soljson.js"),
    isSolcJs: true,
  };
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },  // runs=200 balances deploy cost vs runtime gas efficiency
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      // Pin to "prague" — the hardfork currently active on Ethereum mainnet
      // and Base. Newer hardhat releases default to "osaka" (Fusaka), which
      // adds EIP-7825 semantics. Testing against Prague matches production.
      hardfork: "prague",
      // Raise the per-transaction gas limit to match the block gas limit.
      // Hardhat 2.28+ defaults `gas` to min(FUSAKA_TRANSACTION_GAS_LIMIT=16.78M,
      // blockGasLimit) even outside the Fusaka fork, which is not enough to
      // deploy Project_DAO (>16.78M creation gas). Matching `gas` to
      // `blockGasLimit` lets the contract deploy in tests.
      blockGasLimit: 60_000_000,
      gas: 60_000_000,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
