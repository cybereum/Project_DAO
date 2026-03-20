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
//   MIN_STAKE           - Minimum stake to join in wei (optional, default: 0)
//   CONFIRM_MAINNET    - Set to "true" to allow mainnet deployment

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const networkName = network.name === 'unknown' ? `chain-${chainId}` : network.name;

  console.log(`\n--- Deploying to ${networkName} (chainId: ${chainId}) ---`);
  console.log("Deployer:", deployer.address);

  // Safety check: prevent accidental mainnet deployment
  const isMainnet = chainId === 1 || chainId === 8453; // Ethereum mainnet or Base mainnet
  if (isMainnet && process.env.CONFIRM_MAINNET !== 'true') {
    console.error("ERROR: Mainnet deployment requires CONFIRM_MAINNET=true environment variable.");
    console.error("This is a safety check to prevent accidental mainnet deployments.");
    process.exit(1);
  }

  // Check deployer balance
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);
  console.log("Deployer balance:", balanceEth, "ETH");
  if (balance === 0n) {
    console.error("ERROR: Deployer has zero balance. Fund the account before deploying.");
    process.exit(1);
  }

  // Deploy contract
  console.log("\nDeploying Project_DAO...");
  const DAO = await ethers.getContractFactory("Project_DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  const address = await dao.getAddress();
  console.log("Project_DAO deployed to:", address);

  // Configure treasury
  const treasury = process.env.CYBEREUM_TREASURY;
  if (treasury) {
    if (!ethers.isAddress(treasury)) {
      console.error("ERROR: CYBEREUM_TREASURY is not a valid address:", treasury);
      process.exit(1);
    }
    console.log("Setting Cybereum treasury to:", treasury);
    const tx = await dao.setCybereumTreasury(treasury);
    await tx.wait();
    console.log("Treasury configured.");
  } else if (isMainnet) {
    console.error("ERROR: CYBEREUM_TREASURY must be set for mainnet deployment.");
    process.exit(1);
  } else {
    console.warn("WARNING: CYBEREUM_TREASURY not set. Treasury defaults to deployer address.");
    console.warn("Call setCybereumTreasury() manually before going live.");
  }

  // Configure fee (optional)
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS) : 0;
  const assetFeeWei = process.env.ASSET_FEE_WEI ? BigInt(process.env.ASSET_FEE_WEI) : 0n;
  if (feeBps > 0 && assetFeeWei > 0n) {
    if (feeBps < 1 || feeBps > 100) {
      console.error("ERROR: FEE_BPS must be between 1 and 100 (0.01% to 1%).");
      process.exit(1);
    }
    console.log(`Setting fee config: ${feeBps} bps, asset flat fee: ${assetFeeWei} wei`);
    const tx = await dao.setCybereumFeeConfig(feeBps, assetFeeWei);
    await tx.wait();
    console.log("Fee config updated.");
  }

  // Configure minimum stake (optional)
  const minStake = process.env.MIN_STAKE ? BigInt(process.env.MIN_STAKE) : 0n;
  if (minStake > 0n) {
    console.log(`Setting minimum stake to join: ${ethers.formatEther(minStake)} ETH`);
    const tx = await dao.setMinStakeToJoin(minStake);
    await tx.wait();
    console.log("Minimum stake configured.");
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║              DEPLOYMENT SUMMARY                      ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Network:        ${networkName} (${chainId})`);
  console.log(`║  Contract:       ${address}`);
  console.log(`║  Fee (bps):      ${(await dao.cybereumFeeBps()).toString()}`);
  console.log(`║  Asset fee:      ${(await dao.assetTransferFlatFeeWei()).toString()} wei`);
  console.log(`║  Treasury:       ${await dao.cybereumTreasury()}`);
  console.log(`║  Owner:          ${await dao.owner()}`);
  console.log(`║  Min stake:      ${ethers.formatEther(await dao.minStakeToJoin())} ETH`);
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("\nNext steps:");
  console.log(`  1. Set VITE_PROJECT_DAO_ADDRESS=${address} in nexus-app/.env`);
  console.log("  2. Add members with addMember() or let them stakeAndJoin()");
  console.log("  3. Agents register with registerAgent()");
  if (isMainnet) {
    console.log("  4. Verify contract on Etherscan/Basescan");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
