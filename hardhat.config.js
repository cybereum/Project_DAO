require("@nomicfoundation/hardhat-toolbox");
const { subtask } = require("hardhat/config");
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require("hardhat/builtin-tasks/task-names");

const sharedAccounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

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
      optimizer: { enabled: true, runs: 1 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "",
      accounts: sharedAccounts,
    },
    base: {
      url: process.env.BASE_RPC_URL || "",
      accounts: sharedAccounts,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: sharedAccounts,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: sharedAccounts,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
