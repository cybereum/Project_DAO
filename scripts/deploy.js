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

const hre = require("hardhat");
const { ethers } = hre;

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
  // Deploy all external libraries first and link them into Project_DAO.
  // Breaking the contract into subsystem libraries (PKI, Trust, FeatureKit,
  // Messaging) is how we keep the main contract's deployed bytecode small
  // enough to fit under the Osaka/Fusaka per-transaction gas cap.
  const libArtifacts = ["PKILib", "TrustLib", "FeatureKitLib", "MessagingLib"];
  const linkedLibraries = {};
  for (const name of libArtifacts) {
    const Lib = await ethers.getContractFactory(name);
    const lib = await Lib.deploy();
    await lib.waitForDeployment();
    const libAddress = await lib.getAddress();
    linkedLibraries[name] = libAddress;
    console.log(`${name} deployed to:`, libAddress);
  }

  const DAO = await ethers.getContractFactory("Project_DAO", {
    libraries: linkedLibraries,
  });
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  const address = await dao.getAddress();
  console.log("Project_DAO deployed to:", address);

  // Second transaction: seed counters, fee defaults, reputation decay
  // constants, and the Owner role. These were moved out of the
  // constructor so the deploy tx stays under EIP-7825 / Osaka's 16.78 M
  // per-transaction gas cap. initialize() is single-use and onlyOwner.
  console.log("Initializing Project_DAO (post-deploy bootstrap)...");
  const initTx = await dao.initialize();
  await initTx.wait();
  console.log("Project_DAO initialized.");

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
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS, 10) : 0;
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
  console.log("\n=== Verifying Deployment ===");
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
    throw new Error("FATAL: Treasury is zero address on non-local network. Deployment unsafe.");
  }
  if (!isLocalNetwork && finalFeeBps < 1n) {
    throw new Error("FATAL: Fee BPS is zero on non-local network. Protocol fee rail is inactive.");
  }

  // Verify contract on Etherscan (non-local only)
  if (!isLocalNetwork) {
    console.log("\n=== Contract Verification ===");
    try {
      await hre.run("verify:verify", {
        address,
        constructorArguments: [],
      });
      console.log("Contract verified on block explorer.");
    } catch (verifyErr) {
      if (verifyErr.message?.includes("Already Verified") || verifyErr.message?.includes("already verified") || verifyErr.message?.includes("Contract source code already verified")) {
        console.log("Contract already verified.");
      } else {
        console.warn("Verification failed (non-fatal):", verifyErr.message);
        console.warn("Run manually: npx hardhat verify --network <network>", address);
      }
    }
  }

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify({
    chainId,
    contractAddress: address,
    owner: finalOwner,
    treasury: finalTreasury,
    feeBps: Number(finalFeeBps),
    assetTransferFlatFeeWei: finalAssetFee.toString(),
    deployedAt: new Date().toISOString(),
  }, null, 2));

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
