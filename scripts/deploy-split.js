// scripts/deploy-split.js
// Hardhat deployment script for the split Project_DAO architecture.
//
// Deploys: libraries → 4 implementation contracts → Router → registers selectors → initializes
//
// Usage:
//   npx hardhat run scripts/deploy-split.js --network <network>

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isLocalNetwork = chainId === 31337;

  console.log("=== Split Architecture Deployment ===");
  console.log("Network:", network.name, `(chain ${chainId})`);
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  if (balance === 0n) throw new Error("Deployer has zero balance.");

  // ── Step 1: Deploy all libraries ─────────────────────────────────────
  console.log("\n=== Step 1: Deploy Libraries ===");
  const libNames = [
    "TimelockLib", "EconomicProjectLib", "ServiceAgreementLib",
    "PaymentStreamLib", "TrustLib", "FeatureKitLib", "MessagingLib", "PKILib",
  ];
  const libs = {};
  for (const name of libNames) {
    const Lib = await ethers.getContractFactory(name);
    const lib = await Lib.deploy();
    await lib.waitForDeployment();
    libs[name] = await lib.getAddress();
    console.log(`  ${name}: ${libs[name]}`);
  }

  // ── Step 2: Deploy implementation contracts ──────────────────────────
  console.log("\n=== Step 2: Deploy Implementations ===");

  const Core = await ethers.getContractFactory("ProjectDAOCore", {
    libraries: { TimelockLib: libs.TimelockLib },
  });
  const core = await Core.deploy();
  await core.waitForDeployment();
  const coreAddr = await core.getAddress();
  console.log("  Core:", coreAddr);

  const Governance = await ethers.getContractFactory("ProjectDAOGovernance");
  const governance = await Governance.deploy();
  await governance.waitForDeployment();
  const govAddr = await governance.getAddress();
  console.log("  Governance:", govAddr);

  const Commerce = await ethers.getContractFactory("ProjectDAOCommerce", {
    libraries: {
      EconomicProjectLib: libs.EconomicProjectLib,
      ServiceAgreementLib: libs.ServiceAgreementLib,
      PaymentStreamLib: libs.PaymentStreamLib,
    },
  });
  const commerce = await Commerce.deploy();
  await commerce.waitForDeployment();
  const commAddr = await commerce.getAddress();
  console.log("  Commerce:", commAddr);

  const Network = await ethers.getContractFactory("ProjectDAONetwork", {
    libraries: {
      TrustLib: libs.TrustLib,
      FeatureKitLib: libs.FeatureKitLib,
      MessagingLib: libs.MessagingLib,
      PKILib: libs.PKILib,
    },
  });
  const network_ = await Network.deploy();
  await network_.waitForDeployment();
  const netAddr = await network_.getAddress();
  console.log("  Network:", netAddr);

  // ── Step 3: Deploy Router ────────────────────────────────────────────
  console.log("\n=== Step 3: Deploy Router ===");
  const Router = await ethers.getContractFactory("ProjectDAORouter");
  const router = await Router.deploy(coreAddr, govAddr, commAddr, netAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("  Router:", routerAddr);

  // ── Step 4: Register selectors ───────────────────────────────────────
  console.log("\n=== Step 4: Register Selectors ===");

  // Extract selectors from each implementation's ABI.
  // Shared getters inherited from ProjectDAOStorage (owner, members, agents,
  // etc.) exist in all ABIs — route them to Core; skip duplicates.
  const registered = new Set();
  const implMap = [
    { name: "Core", addr: coreAddr, factory: Core },
    { name: "Governance", addr: govAddr, factory: Governance },
    { name: "Commerce", addr: commAddr, factory: Commerce },
    { name: "Network", addr: netAddr, factory: Network },
  ];

  for (const { name, addr, factory } of implMap) {
    const selectors = [];
    factory.interface.forEachFunction((fn) => {
      if (!registered.has(fn.selector)) {
        selectors.push(fn.selector);
        registered.add(fn.selector);
      }
    });

    if (selectors.length > 0) {
      const tx = await router.registerSelectors(addr, selectors);
      await tx.wait();
      console.log(`  ${name}: ${selectors.length} selectors registered`);
    } else {
      console.log(`  ${name}: 0 unique selectors (all shared with earlier impls)`);
    }
  }

  // Freeze selector registration — no more changes after this point
  await (await router.freezeSelectors()).wait();
  console.log("  Selectors frozen (permanent)");

  // ── Step 5: Initialize via Router ────────────────────────────────────
  console.log("\n=== Step 5: Initialize ===");

  // Attach the full combined ABI to the Router address
  const routerAsCore = Core.attach(routerAddr);
  const routerAsGov = Governance.attach(routerAddr);
  const routerAsComm = Commerce.attach(routerAddr);
  const routerAsNet = Network.attach(routerAddr);

  // Treasury is set at initialization — no instant setter exists.
  const treasury = process.env.CYBEREUM_TREASURY;
  if (!treasury && !isLocalNetwork) {
    throw new Error("CYBEREUM_TREASURY must be set for non-local deployments.");
  }
  const treasuryAddr = treasury || (await ethers.getSigners())[0].address;

  await (await routerAsCore.initializeCore(treasuryAddr)).wait();
  console.log("  Core initialized with treasury:", treasuryAddr);

  await (await routerAsGov.initializeGovernance()).wait();
  console.log("  Governance initialized");

  await (await routerAsComm.initializeCommerce()).wait();
  console.log("  Commerce initialized");

  await (await routerAsNet.initializeNetwork()).wait();
  console.log("  Network initialized");

  if (!treasury && isLocalNetwork) {
    console.warn("  NOTE: Treasury set to deployer address (local network). Use queueSetTreasury for production.");
  }

  // ── Summary ──────────────────────────────────────────────────────────
  console.log("\n=== Deployment Summary ===");
  console.log("Router (user-facing address):", routerAddr);
  console.log("  Core impl:", coreAddr);
  console.log("  Governance impl:", govAddr);
  console.log("  Commerce impl:", commAddr);
  console.log("  Network impl:", netAddr);
  console.log("\nSet VITE_PROJECT_DAO_ADDRESS=" + routerAddr + " in nexus-app/.env");
  console.log("Update sdk/deployments.json with the Router address.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
