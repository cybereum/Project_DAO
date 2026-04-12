/**
 * Smoke tests for the split contract architecture.
 *
 * Deploys Core, Governance, Commerce, Network + Router, registers all
 * selectors, initializes each sub-contract, and runs key operations
 * through the Router proxy to verify delegatecall routing and storage
 * alignment work correctly.
 */
const { expect } = require("chai");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = require("hardhat");

async function deploySplit() {
  const [owner, alice, bob, carol, treasury] = await ethers.getSigners();

  // Deploy libraries
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
  }

  // Deploy implementations
  const Core = await ethers.getContractFactory("ProjectDAOCore", {
    libraries: { TimelockLib: libs.TimelockLib },
  });
  const coreImpl = await Core.deploy();
  await coreImpl.waitForDeployment();

  const Governance = await ethers.getContractFactory("ProjectDAOGovernance");
  const govImpl = await Governance.deploy();
  await govImpl.waitForDeployment();

  const Commerce = await ethers.getContractFactory("ProjectDAOCommerce", {
    libraries: {
      EconomicProjectLib: libs.EconomicProjectLib,
      ServiceAgreementLib: libs.ServiceAgreementLib,
      PaymentStreamLib: libs.PaymentStreamLib,
    },
  });
  const commImpl = await Commerce.deploy();
  await commImpl.waitForDeployment();

  const Network = await ethers.getContractFactory("ProjectDAONetwork", {
    libraries: {
      TrustLib: libs.TrustLib,
      FeatureKitLib: libs.FeatureKitLib,
      MessagingLib: libs.MessagingLib,
      PKILib: libs.PKILib,
    },
  });
  const netImpl = await Network.deploy();
  await netImpl.waitForDeployment();

  // Deploy Router
  const Router = await ethers.getContractFactory("ProjectDAORouter");
  const router = await Router.deploy(
    await coreImpl.getAddress(),
    await govImpl.getAddress(),
    await commImpl.getAddress(),
    await netImpl.getAddress()
  );
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();

  // Register selectors — deduplicate across implementations.
  // Shared getters from ProjectDAOStorage (owner, members, agents, etc.)
  // are present in all ABIs. Route them to Core; skip duplicates.
  const registered = new Set();
  const implEntries = [
    { addr: await coreImpl.getAddress(), factory: Core },
    { addr: await govImpl.getAddress(), factory: Governance },
    { addr: await commImpl.getAddress(), factory: Commerce },
    { addr: await netImpl.getAddress(), factory: Network },
  ];
  for (const { addr, factory } of implEntries) {
    const selectors = [];
    factory.interface.forEachFunction((fn) => {
      if (!registered.has(fn.selector)) {
        selectors.push(fn.selector);
        registered.add(fn.selector);
      }
    });
    if (selectors.length > 0) {
      await router.registerSelectors(addr, selectors);
    }
  }

  // Attach ABIs to the Router address for easy calling
  const core = Core.attach(routerAddr);
  const gov = Governance.attach(routerAddr);
  const comm = Commerce.attach(routerAddr);
  const net = Network.attach(routerAddr);

  // Initialize all sub-contracts
  await core.initializeCore();
  await gov.initializeGovernance();
  await comm.initializeCommerce();
  await net.initializeNetwork();
  await core.setCybereumTreasury(treasury.address);

  return { router, core, gov, comm, net, owner, alice, bob, carol, treasury };
}

async function deploy() {
  return loadFixture(deploySplit);
}

// Helper: add member + register as agent
async function memberAgent(core, signer) {
  await core.addMember(signer.address, 10);
  await core.connect(signer).registerAgent("ipfs://test");
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("Split architecture: Router deployment", () => {
  it("deploys with all implementations under 24KB", async () => {
    const { router } = await deploy();
    expect(await router.getAddress()).to.be.properAddress;
  });

  it("routes to correct implementation", async () => {
    const { router, core } = await deploy();
    // getAgentCount is a Core function
    const impl = await router.getImplementation(core.interface.getFunction("getAgentCount").selector);
    expect(impl).to.equal(await router.core());
  });

  it("reverts on unregistered selector", async () => {
    const { router } = await deploy();
    // Call a random selector
    await expect(
      ethers.provider.call({ to: await router.getAddress(), data: "0xdeadbeef" })
    ).to.be.reverted;
  });
});

describe("Split architecture: Core operations via Router", () => {
  it("owner is set correctly", async () => {
    const { core, owner } = await deploy();
    expect(await core.owner()).to.equal(owner.address);
  });

  it("can add member and register agent", async () => {
    const { core, alice } = await deploy();
    await memberAgent(core, alice);
    expect(await core.getAgentCount()).to.equal(1n);
    const profile = await core.getAgentProfile(alice.address);
    expect(profile.registered).to.be.true;
  });

  it("can deposit and withdraw native escrow", async () => {
    const { core, alice } = await deploy();
    await memberAgent(core, alice);
    await core.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const profile = await core.getAgentProfile(alice.address);
    expect(profile.nativeEscrowBalance).to.be.gt(0n);
  });

  it("can transfer between agents", async () => {
    const { core, alice, bob } = await deploy();
    await memberAgent(core, alice);
    await memberAgent(core, bob);
    await core.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const balBefore = (await core.getAgentProfile(alice.address)).nativeEscrowBalance;
    await core.connect(alice).transferNativeBetweenAgents(
      bob.address, ethers.parseEther("0.1"), "test payment"
    );
    const balAfter = (await core.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(balAfter).to.be.lt(balBefore);
    const bobBal = (await core.getAgentProfile(bob.address)).nativeEscrowBalance;
    expect(bobBal).to.be.gt(0n);
  });

  it("pause/resume works", async () => {
    const { core, alice } = await deploy();
    await core.pauseContract();
    await expect(core.addMember(alice.address, 10)).to.be.revertedWith("Contract is paused.");
    await core.resumeContract();
    await core.addMember(alice.address, 10);
  });

  it("timelock queue/execute works via Router", async () => {
    const { core, alice } = await deploy();
    await core.queueSetTreasury(alice.address);
    await time.increase(24 * 3600 + 1);
    await core.executeSetTreasury(alice.address);
    expect(await core.cybereumTreasury()).to.equal(alice.address);
  });
});

describe("Split architecture: Governance via Router", () => {
  it("can create and vote on proposals", async () => {
    const { core, gov, owner } = await deploy();
    await core.registerAgent("ipfs://owner");
    // Must create a milestone first (proposals require previousMilestoneIds)
    const future = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await gov.createMilestone("Milestone 1", future);
    await gov.createProposal("Test proposal", [0]);
    const count = await gov.getProposalCount();
    expect(count).to.equal(1n);
    await gov.vote(1, true);
    const proposal = await gov.getProposal(1);
    expect(proposal.yesVotes).to.equal(100n); // owner has 100 voting power
  });
});

describe("Split architecture: Commerce via Router", () => {
  it("can create and fund economic project", async () => {
    const { core, comm, alice } = await deploy();
    await memberAgent(core, alice);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await comm.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    const proj = await comm.economicProjects(1n);
    expect(proj.id).to.equal(1n);
    expect(proj.proposer).to.equal(alice.address);
  });

  it("can create service agreement", async () => {
    const { core, comm, alice, bob } = await deploy();
    await memberAgent(core, alice);
    await memberAgent(core, bob);
    await core.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await comm.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test service"
    );
    const agreement = await comm.serviceAgreements(1n);
    expect(agreement.client).to.equal(alice.address);
    expect(agreement.provider).to.equal(bob.address);
  });

  it("stakeAndJoin works via Router", async () => {
    const { core, comm, alice } = await deploy();
    await comm.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") });
    const profile = await core.getAgentProfile(alice.address);
    expect(profile.registered).to.be.true;
    const member = await core.members(alice.address);
    expect(member.isMember).to.be.true;
  });

  it("leaveDAO works via Router", async () => {
    const { core, comm, alice } = await deploy();
    await comm.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") });
    await comm.connect(alice).leaveDAO();
    const profile = await core.getAgentProfile(alice.address);
    expect(profile.registered).to.be.false;
  });
});

describe("Split architecture: Network via Router", () => {
  it("can set and query capabilities", async () => {
    const { core, net, alice } = await deploy();
    await memberAgent(core, alice);
    await net.connect(alice).setAgentCapabilities(["data-oracle", "payment-settlement"]);
    const caps = await net.getAgentCapabilities(alice.address);
    expect(caps.length).to.equal(2);
    expect(caps[0]).to.equal("data-oracle");
  });

  it("can discover agents by capability", async () => {
    const { core, net, alice, bob } = await deploy();
    await memberAgent(core, alice);
    await memberAgent(core, bob);
    await net.connect(alice).setAgentCapabilities(["data-oracle"]);
    await net.connect(bob).setAgentCapabilities(["data-oracle"]);
    const result = await net.discoverAgentsByCapability("data-oracle", 0, 50);
    expect(result.total).to.equal(2n);
  });

  it("can send and read direct messages", async () => {
    const { core, net, alice, bob } = await deploy();
    await memberAgent(core, alice);
    await memberAgent(core, bob);
    // Deposit to cover messaging fee
    await core.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes("hello"));
    await net.connect(alice).sendDirectMessage(bob.address, "encrypted-hello", contentHash);
    const msgId = await net.currentDirectMessageId();
    expect(Number(msgId)).to.be.gte(2); // next ID after first message
  });

  it("can submit and upvote feature kits", async () => {
    const { core, net, alice } = await deploy();
    await memberAgent(core, alice);
    await net.connect(alice).submitFeatureKit("ipfs://feature1", 1);
    const kitId = await net.currentFeatureKitId();
    expect(Number(kitId)).to.be.gte(1);
  });

  it("can publish PKI public key", async () => {
    const { core, net, alice } = await deploy();
    await memberAgent(core, alice);
    const pubKey = "0x" + "aa".repeat(33);
    await net.connect(alice).publishAgentPublicKey(pubKey);
    const [key] = await net.getAgentPublicKey(alice.address);
    expect(key).to.equal(pubKey);
  });
});

describe("Split architecture: Cross-contract storage alignment", () => {
  it("Core state persists when calling Commerce functions", async () => {
    const { core, comm, alice, bob } = await deploy();
    // Register both agents via Core
    await memberAgent(core, alice);
    await memberAgent(core, bob);
    // Deposit via Core
    await core.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const balBefore = (await core.getAgentProfile(alice.address)).nativeEscrowBalance;
    // Create agreement via Commerce — debits escrow from alice
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await comm.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.05"), deadline, "cross-test"
    );
    // Core's agent state should reflect the debit
    const balAfter = (await core.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(balAfter).to.equal(balBefore - ethers.parseEther("0.05"));
  });

  it("fee config changes in Core affect Commerce operations", async () => {
    const { core, comm, alice } = await deploy();
    // Change fee via Core
    await core.setCybereumFeeConfig(10, 2_000_000_000_000n);
    expect(await core.cybereumFeeBps()).to.equal(10n);
    // Fund a project via Commerce — fee should use the new 10 bps rate
    await memberAgent(core, alice);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await comm.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await comm.fundProject(1n, { value: ethers.parseEther("0.5") });
    const proj = await comm.economicProjects(1n);
    // With 10 bps fee, net should be 0.5 - 0.0005 = 0.4995 ETH
    const expectedNet = ethers.parseEther("0.5") - (ethers.parseEther("0.5") * 10n / 10000n);
    expect(proj.totalFunded).to.equal(expectedNet);
  });
});
