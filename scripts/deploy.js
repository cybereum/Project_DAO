// scripts/deploy.js
// Hardhat deployment script for Project_DAO
//
// Usage:
//   npx hardhat run scripts/deploy.js --network <network>
//
// Environment variables:
//   CYBEREUM_TREASURY  - Address for the Cybereum fee treasury (required for production)
//   FEE_BPS            - Fee in basis points (optional, default: 5)
//   ASSET_FEE_WEI      - Flat fee for NFT transfers in wei (optional, default: 1e12)

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isLocalNetwork = chainId === 31337;

  console.log("=== Pre-deployment Checks ===");
  console.log("Network:", network.name, `(chain ${chainId})`);
  console.log("Deployer:", deployer.address);

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");
  if (balance === 0n) {
    throw new Error("Deployer has zero balance. Fund the account before deploying.");
  }

  // Validate treasury for non-local networks
  const treasury = process.env.CYBEREUM_TREASURY;
  if (!isLocalNetwork && !treasury) {
    throw new Error(
      "CYBEREUM_TREASURY env var is required for non-local deployments. " +
      "Set it to the resolved address of cybereum.eth."
    );
  }

  if (treasury) {
    try {
      ethers.getAddress(treasury); // checksum validation
    } catch {
      throw new Error(`Invalid CYBEREUM_TREASURY address: ${treasury}`);
    }
  }

  // Deploy contract
  console.log("\n=== Deploying Contract ===");
  const DAO = await ethers.getContractFactory("Project_DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  const address = await dao.getAddress();
  console.log("Project_DAO deployed to:", address);

  // Verify deployment
  const code = await ethers.provider.getCode(address);
  if (code === "0x") {
    throw new Error("Deployment failed — no bytecode at contract address.");
  }
  const codeSize = (code.length - 2) / 2;
  console.log(`Contract size: ${codeSize} bytes (${(codeSize / 1024).toFixed(1)} KB / 24 KB limit)`);
  if (codeSize > 24576) {
    console.warn("WARNING: Contract exceeds 24KB EVM bytecode limit!");
  }

  // Configure treasury
  console.log("\n=== Post-deployment Configuration ===");
  if (treasury) {
    console.log("Setting Cybereum treasury to:", treasury);
    const tx = await dao.setCybereumTreasury(treasury);
    await tx.wait();
    console.log("Treasury configured.");
  } else {
    console.warn("WARNING: CYBEREUM_TREASURY not set (local network). Call setCybereumTreasury() before going live.");
  }

  // Configure fee (optional)
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 0;
  const assetFeeWei = process.env.ASSET_FEE_WEI ? BigInt(process.env.ASSET_FEE_WEI) : 0n;
  if (feeBps > 0 && assetFeeWei > 0n) {
    if (feeBps < 1 || feeBps > 100) {
      throw new Error(`FEE_BPS must be between 1 and 100, got ${feeBps}`);
    }
    console.log(`Setting fee config: ${feeBps} bps, asset flat fee: ${assetFeeWei} wei`);
    const tx = await dao.setCybereumFeeConfig(feeBps, assetFeeWei);
    await tx.wait();
    console.log("Fee config updated.");
  }

  // Verify final state
  console.log("\n=== Deployment Summary ===");
  const finalTreasury = await dao.cybereumTreasury();
  const finalFeeBps = await dao.cybereumFeeBps();
  const finalAssetFee = await dao.assetTransferFlatFeeWei();
  const finalOwner = await dao.owner();

  console.log("Contract address:", address);
  console.log("Owner:", finalOwner);
  console.log("Treasury:", finalTreasury);
  console.log("Fee (bps):", finalFeeBps.toString());
  console.log("Asset transfer fee (wei):", finalAssetFee.toString());

  // Sanity checks
  if (finalOwner !== deployer.address) {
    console.warn("WARNING: Owner is not the deployer!");
  }
  if (!isLocalNetwork && finalTreasury === ethers.ZeroAddress) {
    console.warn("WARNING: Treasury is still zero address!");
  }

  console.log("\nNext steps:");
  console.log(`  1. Set VITE_PROJECT_DAO_ADDRESS=${address} in nexus-app/.env`);
  console.log(`  2. Update sdk/deployments.json with the contract address for chain ${chainId}`);
  console.log("  3. Add members with addMember() or let agents self-onboard via stakeAndJoin()");
  console.log("  4. Agents can auto-discover using AgentClient.discover({ chainId })");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
