// scripts/deploy.js
// Hardhat deployment script for Project_DAO
//
// Usage:
//   npx hardhat run scripts/deploy.js --network <network>
//
// Environment variables:
//   CYBEREUM_TREASURY  - Address for the Cybereum fee treasury (required)
//   FEE_BPS            - Fee in basis points (optional, default: 5)
//   ASSET_FEE_WEI      - Flat fee for NFT transfers in wei (optional, default: 1e12)

const hre = require("hardhat");
const { ethers } = hre;

const EIP170_RUNTIME_LIMIT_BYTES = 24_576;
const L1_CHAIN_IDS = new Set([1]);

async function getRuntimeSizeBytes(contractName) {
  const artifact = await hre.artifacts.readArtifact(contractName);
  return artifact.deployedBytecode.replace(/^0x/, "").length / 2;
}

async function main() {
  const runtimeSizeBytes = await getRuntimeSizeBytes("Project_DAO");
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`Target network: ${hre.network.name} (chain ${chainId})`);
  console.log(`Project_DAO runtime size: ${runtimeSizeBytes} bytes`);

  if (runtimeSizeBytes > EIP170_RUNTIME_LIMIT_BYTES) {
    const warning =
      `Project_DAO runtime size (${runtimeSizeBytes} bytes) exceeds the EIP-170 L1 limit ` +
      `(${EIP170_RUNTIME_LIMIT_BYTES} bytes). Prefer Base / Base Sepolia / another L2.`;

    if (L1_CHAIN_IDS.has(chainId) && process.env.ALLOW_UNSAFE_L1_DEPLOY !== "true") {
      throw new Error(`${warning} Refusing L1 deploy. Set ALLOW_UNSAFE_L1_DEPLOY=true to override.`);
    }

    console.warn(`WARNING: ${warning}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying Project_DAO with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy contract
  const DAO = await ethers.getContractFactory("Project_DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  const address = await dao.getAddress();
  console.log("Project_DAO deployed to:", address);

  // Configure treasury
  const treasury = process.env.CYBEREUM_TREASURY;
  if (treasury) {
    console.log("Setting Cybereum treasury to:", treasury);
    const tx = await dao.setCybereumTreasury(treasury);
    await tx.wait();
    console.log("Treasury configured.");
  } else {
    console.warn("WARNING: CYBEREUM_TREASURY not set. Treasury defaults to deployer address.");
    console.warn("Call setCybereumTreasury() manually before going live.");
  }

  // Configure fee (optional)
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 0;
  const assetFeeWei = process.env.ASSET_FEE_WEI ? BigInt(process.env.ASSET_FEE_WEI) : 0n;
  if (feeBps > 0 && assetFeeWei > 0n) {
    console.log(`Setting fee config: ${feeBps} bps, asset flat fee: ${assetFeeWei} wei`);
    const tx = await dao.setCybereumFeeConfig(feeBps, assetFeeWei);
    await tx.wait();
    console.log("Fee config updated.");
  }

  // Summary
  console.log("\n--- Deployment Summary ---");
  console.log("Contract address:", address);
  console.log("Fee (bps):", (await dao.cybereumFeeBps()).toString());
  console.log("Asset transfer fee (wei):", (await dao.assetTransferFlatFeeWei()).toString());
  console.log("Treasury:", await dao.cybereumTreasury());
  console.log("Owner:", await dao.owner());
  console.log("\nNext steps:");
  console.log(`  1. Set VITE_PROJECT_DAO_ADDRESS=${address} in nexus-app/.env`);
  console.log(`  2. Update sdk/deployments.json with the contract address for this chain`);
  console.log("  3. Add members with addMember() or let agents self-onboard via stakeAndJoin()");
  console.log("  4. Agents can auto-discover using AgentClient.discover({ chainId })");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
