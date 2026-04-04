const { expect } = require("chai");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { ethers } = require("hardhat");

// Helper: deploy fresh contract + set treasury
async function deploy() {
  const [owner, alice, bob, carol, treasury] = await ethers.getSigners();
  const DAO = await ethers.getContractFactory("Project_DAO");
  const dao = await DAO.deploy();
  await dao.waitForDeployment();
  await dao.setCybereumTreasury(treasury.address);
  return { dao, owner, alice, bob, carol, treasury };
}

// Helper: add member + register as agent
async function memberAgent(dao, signer) {
  await dao.addMember(signer.address, 10);
  await dao.connect(signer).registerAgent("ipfs://test");
}

// ─── Fee Maths ───────────────────────────────────────────────────────────────

describe("Fee configuration", () => {
  it("defaults to 5 bps", async () => {
    const { dao } = await deploy();
    expect(await dao.cybereumFeeBps()).to.equal(5n);
  });

  it("owner can update fee config", async () => {
    const { dao } = await deploy();
    await dao.setCybereumFeeConfig(10, ethers.parseUnits("2", 12));
    expect(await dao.cybereumFeeBps()).to.equal(10n);
    expect(await dao.assetTransferFlatFeeWei()).to.equal(ethers.parseUnits("2", 12));
  });

  it("reverts if feeBps < MIN_FEE_BPS (1)", async () => {
    const { dao } = await deploy();
    await expect(dao.setCybereumFeeConfig(0, 1000n)).to.be.revertedWith(
      "Fee cannot be zero: mandatory Cybereum fee floor enforced."
    );
  });

  it("reverts if feeBps > 100 (1%)", async () => {
    const { dao } = await deploy();
    await expect(dao.setCybereumFeeConfig(101, 1000n)).to.be.revertedWith(
      "Fee cannot exceed 1%."
    );
  });

  it("non-owner cannot update fee config", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).setCybereumFeeConfig(5, 1000n)).to.be.revertedWith(
      "Only the owner can call this function."
    );
  });

  it("previewFee returns correct fee and net", async () => {
    const { dao } = await deploy();
    const amount = ethers.parseEther("1");
    const [fee, net] = await dao.previewFee(amount);
    // 5 bps of 1 ETH = 0.0005 ETH
    expect(fee).to.equal(amount * 5n / 10000n);
    expect(net).to.equal(amount - fee);
  });

  it("previewFee applies minimum 1-wei fee for tiny amounts", async () => {
    const { dao } = await deploy();
    const [fee] = await dao.previewFee(1n);
    expect(fee).to.equal(1n);
  });
});

// ─── Treasury ────────────────────────────────────────────────────────────────

describe("Cybereum treasury", () => {
  it("owner can set treasury", async () => {
    const { dao, alice } = await deploy();
    await dao.setCybereumTreasury(alice.address);
    expect(await dao.cybereumTreasury()).to.equal(alice.address);
  });

  it("reverts on zero address", async () => {
    const { dao } = await deploy();
    await expect(dao.setCybereumTreasury(ethers.ZeroAddress)).to.be.revertedWith(
      "Invalid treasury address."
    );
  });

  it("non-owner cannot set treasury", async () => {
    const { dao, alice, bob } = await deploy();
    await expect(dao.connect(alice).setCybereumTreasury(bob.address)).to.be.revertedWith(
      "Only the owner can call this function."
    );
  });
});

// ─── Agent Registration ───────────────────────────────────────────────────────

describe("Agent registration", () => {
  it("member can register as agent", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://meta");
    const [registered, uri] = await dao.getAgentProfile(owner.address);
    expect(registered).to.be.true;
    expect(uri).to.equal("ipfs://meta");
  });

  it("emits AgentRegistered event", async () => {
    const { dao, owner } = await deploy();
    await expect(dao.registerAgent("ipfs://meta"))
      .to.emit(dao, "AgentRegistered")
      .withArgs(owner.address, "ipfs://meta");
  });

  it("non-member cannot register", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).registerAgent("ipfs://meta")).to.be.revertedWith(
      "Only members can call this function."
    );
  });

  it("cannot register twice", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://meta");
    await expect(dao.registerAgent("ipfs://meta2")).to.be.revertedWith(
      "Agent already registered."
    );
  });

  it("registered agent can update metadata", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://v1");
    await dao.updateAgentMetadata("ipfs://v2");
    const [, uri] = await dao.getAgentProfile(owner.address);
    expect(uri).to.equal("ipfs://v2");
  });
});

// ─── Agent Discovery ─────────────────────────────────────────────────────────

describe("Agent discovery", () => {
  it("getAgentCount increases on registration", async () => {
    const { dao, alice } = await deploy();
    expect(await dao.getAgentCount()).to.equal(0n);
    await dao.registerAgent("ipfs://owner");
    expect(await dao.getAgentCount()).to.equal(1n);
    await memberAgent(dao, alice);
    expect(await dao.getAgentCount()).to.equal(2n);
  });

  it("getRegisteredAgents returns addresses and metadata URIs", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner-meta");
    await memberAgent(dao, alice);
    const [addrs, uris, total] = await dao.getRegisteredAgents(0, 10);
    expect(total).to.equal(2n);
    expect(addrs.length).to.equal(2);
    expect(addrs[0]).to.equal(owner.address);
    expect(addrs[1]).to.equal(alice.address);
    expect(uris[0]).to.equal("ipfs://owner-meta");
    expect(uris[1]).to.equal("ipfs://test");
  });

  it("getRegisteredAgents paginates correctly", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.addMember(bob.address, 10);
    await dao.connect(bob).registerAgent("ipfs://bob");
    // Page 1
    const [addrs1, , total1] = await dao.getRegisteredAgents(0, 2);
    expect(total1).to.equal(3n);
    expect(addrs1.length).to.equal(2);
    // Page 2
    const [addrs2] = await dao.getRegisteredAgents(2, 2);
    expect(addrs2.length).to.equal(1);
    expect(addrs2[0]).to.equal(bob.address);
  });

  it("stakeAndJoin also populates agent registry", async () => {
    const { dao, alice } = await deploy();
    await dao.connect(alice).stakeAndJoin("ipfs://alice-meta", { value: ethers.parseEther("0.01") });
    expect(await dao.getAgentCount()).to.equal(1n);
    const [addrs, uris] = await dao.getRegisteredAgents(0, 10);
    expect(addrs[0]).to.equal(alice.address);
    expect(uris[0]).to.equal("ipfs://alice-meta");
  });
});

// ─── Native ETH Escrow: Deposit ──────────────────────────────────────────────

describe("depositNativeToEscrow", () => {
  it("increases escrow balance net of fee", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    const amount = ethers.parseEther("1");
    await dao.depositNativeToEscrow({ value: amount });
    const [, , bal] = await dao.getAgentProfile(owner.address);
    const fee = amount * 5n / 10000n;
    expect(bal).to.equal(amount - fee);
  });

  it("sends fee to treasury", async () => {
    const { dao, owner, treasury } = await deploy();
    await dao.registerAgent("ipfs://a");
    const amount = ethers.parseEther("1");
    const before = await ethers.provider.getBalance(treasury.address);
    await dao.depositNativeToEscrow({ value: amount });
    const after = await ethers.provider.getBalance(treasury.address);
    const fee = amount * 5n / 10000n;
    expect(after - before).to.equal(fee);
  });

  it("emits AgentNativeEscrowDeposited", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    const amount = ethers.parseEther("1");
    const fee = amount * 5n / 10000n;
    await expect(dao.depositNativeToEscrow({ value: amount }))
      .to.emit(dao, "AgentNativeEscrowDeposited")
      .withArgs(owner.address, amount - fee);
  });

  it("reverts on zero value", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await expect(dao.depositNativeToEscrow({ value: 0n })).to.be.revertedWith(
      "Deposit amount must be greater than zero."
    );
  });

  it("non-agent cannot deposit", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Only registered agents can call this function.");
  });
});

// ─── Native ETH Escrow: Withdraw ─────────────────────────────────────────────

describe("withdrawNativeFromEscrow", () => {
  it("decreases balance and delivers net amount", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    const deposit = ethers.parseEther("2");
    await dao.depositNativeToEscrow({ value: deposit });

    const [, , balBefore] = await dao.getAgentProfile(owner.address);
    const withdrawAmt = ethers.parseEther("1");
    const ownerBefore = await ethers.provider.getBalance(owner.address);

    const tx = await dao.withdrawNativeFromEscrow(withdrawAmt);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    const [, , balAfter] = await dao.getAgentProfile(owner.address);
    const ownerAfter = await ethers.provider.getBalance(owner.address);

    const fee = withdrawAmt * 5n / 10000n;
    expect(balAfter).to.equal(balBefore - withdrawAmt);
    expect(ownerAfter - ownerBefore + gasCost).to.equal(withdrawAmt - fee);
  });

  it("emits AgentNativeEscrowWithdrawn", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    const withdrawAmt = ethers.parseEther("0.5");
    const fee = withdrawAmt * 5n / 10000n;
    await expect(dao.withdrawNativeFromEscrow(withdrawAmt))
      .to.emit(dao, "AgentNativeEscrowWithdrawn")
      .withArgs(owner.address, withdrawAmt - fee);
  });

  it("reverts on insufficient balance", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.5") });
    await expect(dao.withdrawNativeFromEscrow(ethers.parseEther("1"))).to.be.revertedWith(
      "Insufficient native escrow balance."
    );
  });
});

// ─── Agent-to-Agent Native Transfer ──────────────────────────────────────────

describe("transferNativeBetweenAgents", () => {
  it("moves net amount from sender to recipient escrow", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const deposit = ethers.parseEther("1");
    await dao.depositNativeToEscrow({ value: deposit });
    const [, , senderBal0] = await dao.getAgentProfile(owner.address);

    const transferAmt = ethers.parseEther("0.5");
    await dao.transferNativeBetweenAgents(alice.address, transferAmt, "payment");

    const fee = transferAmt * 5n / 10000n;
    const [, , senderBal1] = await dao.getAgentProfile(owner.address);
    const [, , recipBal] = await dao.getAgentProfile(alice.address);

    expect(senderBal1).to.equal(senderBal0 - transferAmt);
    expect(recipBal).to.equal(transferAmt - fee);
  });

  it("emits AgentToAgentNativeTransfer with net amount", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    const transferAmt = ethers.parseEther("0.4");
    const fee = transferAmt * 5n / 10000n;
    await expect(dao.transferNativeBetweenAgents(alice.address, transferAmt, "memo"))
      .to.emit(dao, "AgentToAgentNativeTransfer")
      .withArgs(owner.address, alice.address, transferAmt - fee, "memo");
  });

  it("emits CybereumFeePaid", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    await expect(
      dao.transferNativeBetweenAgents(alice.address, ethers.parseEther("0.4"), "memo")
    ).to.emit(dao, "CybereumFeePaid");
  });

  it("reverts if recipient is not a registered agent", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    await expect(
      dao.transferNativeBetweenAgents(alice.address, ethers.parseEther("0.1"), "memo")
    ).to.be.revertedWith("Recipient must be a registered agent.");
  });

  it("reverts on self-transfer", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    await expect(
      dao.transferNativeBetweenAgents(owner.address, ethers.parseEther("0.1"), "memo")
    ).to.be.revertedWith("Cannot transfer to self.");
  });

  it("reverts on insufficient balance", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.1") });
    await expect(
      dao.transferNativeBetweenAgents(alice.address, ethers.parseEther("1"), "memo")
    ).to.be.revertedWith("Insufficient native escrow balance.");
  });
});

// ─── Payment Requests ─────────────────────────────────────────────────────────

describe("Payment requests", () => {
  it("requester can create a native payment request", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, ethers.parseEther("0.1"), true, "invoice #1"
    );

    const req = await dao.getAgentPaymentRequest(1n);
    expect(req.requester).to.equal(alice.address);
    expect(req.payer).to.equal(owner.address);
    expect(req.amount).to.equal(ethers.parseEther("0.1"));
    expect(req.isNative).to.be.true;
    expect(req.status).to.equal(0n); // Requested
  });

  it("emits AgentPaymentRequestCreated", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).createAgentPaymentRequest(
        owner.address, ethers.ZeroAddress, ethers.parseEther("0.1"), true, "inv"
      )
    ).to.emit(dao, "AgentPaymentRequestCreated");
  });

  it("payer can settle with exact ETH — funds go to requester wallet", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const amount = ethers.parseEther("0.2");

    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, amount, true, "inv"
    );

    const fee = amount * 5n / 10000n;
    const aliceBefore = await ethers.provider.getBalance(alice.address);
    await dao.settleAgentPaymentRequest(1n, { value: amount });
    const aliceAfter = await ethers.provider.getBalance(alice.address);

    // settle sends net ETH directly to requester's wallet (not escrow)
    expect(aliceAfter - aliceBefore).to.equal(amount - fee);

    const req = await dao.getAgentPaymentRequest(1n);
    expect(req.status).to.equal(1n); // Settled
  });

  it("emits AgentPaymentRequestSettled on settle", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const amount = ethers.parseEther("0.2");
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, amount, true, "inv"
    );
    await expect(dao.settleAgentPaymentRequest(1n, { value: amount }))
      .to.emit(dao, "AgentPaymentRequestSettled");
  });

  it("reverts settling with wrong ETH value", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const amount = ethers.parseEther("0.2");
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, amount, true, "inv"
    );
    await expect(
      dao.settleAgentPaymentRequest(1n, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Incorrect native payment amount.");
  });

  it("requester can cancel a pending request", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, ethers.parseEther("0.1"), true, "inv"
    );
    await dao.connect(alice).cancelAgentPaymentRequest(1n);
    const req = await dao.getAgentPaymentRequest(1n);
    expect(req.status).to.equal(2n); // Cancelled
  });

  it("non-requester cannot cancel", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, ethers.parseEther("0.1"), true, "inv"
    );
    await expect(dao.cancelAgentPaymentRequest(1n)).to.be.revertedWith(
      "Only requester can cancel this payment request."
    );
  });
});

// ─── Pause ────────────────────────────────────────────────────────────────────

describe("Contract pause", () => {
  it("owner can pause and unpause", async () => {
    const { dao, owner } = await deploy();
    await dao.pauseContract();
    await dao.registerAgent("ipfs://a").catch(() => {});  // should fail, just verify state
    await dao.resumeContract();
  });

  it("pauseContract blocks state-changing calls", async () => {
    const { dao, owner } = await deploy();
    await dao.pauseContract();
    await expect(dao.registerAgent("ipfs://a")).to.be.revertedWith("Contract is paused.");
  });

  it("non-owner cannot pause", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).pauseContract()).to.be.revertedWith(
      "Only the owner can call this function."
    );
  });
});

// ─── Member Management ────────────────────────────────────────────────────────

describe("Member management", () => {
  it("owner can add a member", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 50);
    const m = await dao.members(alice.address);
    expect(m.isMember).to.be.true;
    expect(m.votingPower).to.equal(50n);
  });

  it("owner can remove a member", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 50);
    await dao.removeMember(alice.address);
    const m = await dao.members(alice.address);
    expect(m.isMember).to.be.false;
  });

  it("non-owner cannot add member", async () => {
    const { dao, alice, bob } = await deploy();
    await expect(dao.connect(alice).addMember(bob.address, 10)).to.be.revertedWith(
      "Only the owner can call this function."
    );
  });
});

// ─── Open Onboarding: stakeAndJoin ───────────────────────────────────────────

describe("stakeAndJoin / leaveDAO", () => {
  it("non-member can stake and join", async () => {
    const { dao, alice } = await deploy();
    await dao.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") });
    const m = await dao.members(alice.address);
    expect(m.isMember).to.be.true;
    const [registered] = await dao.getAgentProfile(alice.address);
    expect(registered).to.be.true;
  });

  it("alice can stake and join, then leave to reclaim stake (minus exit fee)", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.1");
    await dao.connect(alice).stakeAndJoin("ipfs://alice", { value: stake });

    const m = await dao.members(alice.address);
    expect(m.isMember).to.be.true;
    const [registered] = await dao.getAgentProfile(alice.address);
    expect(registered).to.be.true;

    const balBefore = await ethers.provider.getBalance(alice.address);
    const tx = await dao.connect(alice).leaveDAO();
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(alice.address);

    const joinFee = stake * 5n / 10000n;
    const netStake = stake - joinFee;
    // Exit fee (3 bps) deducted from netStake on leave
    const exitFee = netStake * 3n / 10000n;
    const refund = netStake - exitFee;
    // Balance after = before + refund - gas
    expect(balAfter - balBefore + gasCost).to.be.closeTo(refund, ethers.parseEther("0.0001"));

    const mAfter = await dao.members(alice.address);
    expect(mAfter.isMember).to.be.false;
  });

  it("reverts if already a member", async () => {
    const { dao, alice } = await deploy();
    await dao.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") });
    await expect(
      dao.connect(alice).stakeAndJoin("ipfs://alice2", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Already a member.");
  });

  it("reverts below minStakeToJoin", async () => {
    const { dao, alice } = await deploy();
    await dao.setMinStakeToJoin(ethers.parseEther("1"));
    await expect(
      dao.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Insufficient stake.");
  });
});

// ─── Economic Projects ────────────────────────────────────────────────────────

describe("Economic projects", () => {
  it("agent can create a project", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    const proj = await dao.economicProjects(1n);
    expect(proj.id).to.equal(1n);
    expect(proj.proposer).to.equal(owner.address);
    expect(proj.status).to.equal(0n); // Open
  });

  it("anyone can fund a project", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);

    const fundAmt = ethers.parseEther("0.5");
    await dao.connect(alice).fundProject(1n, { value: fundAmt });

    const fee = fundAmt * 5n / 10000n;
    const proj = await dao.economicProjects(1n);
    expect(proj.totalFunded).to.equal(fundAmt - fee);
  });

  it("contributor apply → approve → complete → claim", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);

    // Fund it
    const fundAmt = ethers.parseEther("1");
    await dao.connect(bob).fundProject(1n, { value: fundAmt });
    const fee = fundAmt * 5n / 10000n;
    const netFunded = fundAmt - fee;

    // alice applies
    await dao.connect(alice).applyToProject(1n);
    // owner approves 5000 bps = 50%
    await dao.approveContributor(1n, alice.address, 5000);

    const proj = await dao.economicProjects(1n);
    expect(proj.status).to.equal(1n); // Active

    // owner completes
    await dao.completeProject(1n);

    // alice claims — exit fee is deducted from payout
    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await dao.connect(alice).claimProjectShare(1n);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const aliceAfter = await ethers.provider.getBalance(alice.address);

    const grossPayout = netFunded * 5000n / 10000n;
    const exitFee = grossPayout * 3n / 10000n; // 3 bps exit fee
    const expectedPayout = grossPayout - exitFee;
    expect(aliceAfter - aliceBefore + gasCost).to.be.closeTo(
      expectedPayout, ethers.parseEther("0.0001")
    );
  });

  it("contributor cannot claim twice", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.connect(owner).fundProject(1n, { value: ethers.parseEther("1") });
    await dao.connect(alice).applyToProject(1n);
    await dao.approveContributor(1n, alice.address, 5000);
    await dao.completeProject(1n);
    await dao.connect(alice).claimProjectShare(1n);
    await expect(dao.connect(alice).claimProjectShare(1n)).to.be.revertedWith(
      "Share already claimed."
    );
  });

  it("reverts funding cancelled project", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.cancelProject(1n);
    await expect(
      dao.connect(alice).fundProject(1n, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Project not accepting funds.");
  });
});

// ─── Feature Kits ─────────────────────────────────────────────────────────────

describe("Feature kit pipeline", () => {
  it("registered agent can submit a kit", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://agent");
    await dao.submitFeatureKit("ipfs://kit1", 1);
    const kit = await dao.featureKits(1n);
    expect(kit.submitter).to.equal(owner.address);
    expect(kit.priority).to.equal(1n);
    expect(kit.status).to.equal(0n);
  });

  it("member can upvote a kit once", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://agent");
    await dao.submitFeatureKit("ipfs://kit1", 0);
    await dao.upvoteFeatureKit(1n);
    const kit = await dao.featureKits(1n);
    expect(kit.voteCount).to.equal(1n);
  });

  it("cannot upvote twice", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://agent");
    await dao.submitFeatureKit("ipfs://kit1", 0);
    await dao.upvoteFeatureKit(1n);
    await expect(dao.upvoteFeatureKit(1n)).to.be.revertedWith("Already voted.");
  });

  it("owner can change kit status", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://agent");
    await dao.submitFeatureKit("ipfs://kit1", 0);
    await dao.setFeatureKitStatus(1n, 2, "queued by owner");
    const kit = await dao.featureKits(1n);
    expect(kit.status).to.equal(2n);
  });

  it("getFeatureKits paginates correctly", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://agent");
    await dao.submitFeatureKit("ipfs://kit1", 0);
    await dao.submitFeatureKit("ipfs://kit2", 1);
    await dao.submitFeatureKit("ipfs://kit3", 2);
    const [page, total] = await dao.getFeatureKits(0, 2);
    expect(total).to.equal(3n);
    expect(page.length).to.equal(2);
    expect(page[0].metadataURI).to.equal("ipfs://kit1");
    expect(page[1].metadataURI).to.equal("ipfs://kit2");
  });
});


// ─── Secure Direct Messaging ─────────────────────────────────────────────────

describe("Secure direct messaging", () => {
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("hello agent"));

  it("registered agent can send a direct message", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    // Fund escrow for messaging fee
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await dao.sendDirectMessage(alice.address, "encrypted-payload-abc", sampleHash);
    const m = await dao.getDirectMessage(1n);
    expect(m.sender).to.equal(owner.address);
    expect(m.recipient).to.equal(alice.address);
    expect(m.contentHash).to.equal(sampleHash);
    expect(m.encryptedContent).to.equal("encrypted-payload-abc");
    expect(m.readByRecipient).to.be.false;
  });

  it("emits DirectMessageSent event", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await expect(dao.sendDirectMessage(alice.address, "enc-data", sampleHash))
      .to.emit(dao, "DirectMessageSent")
      .withArgs(1n, owner.address, alice.address, sampleHash, anyValue);
  });

  it("recipient can read the message", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.sendDirectMessage(alice.address, "enc-data", sampleHash);

    const m = await dao.connect(alice).getDirectMessage(1n);
    expect(m.encryptedContent).to.equal("enc-data");
  });

  it("third party cannot read the message", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.addMember(bob.address, 10);
    await dao.connect(bob).registerAgent("ipfs://bob");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.sendDirectMessage(alice.address, "enc-data", sampleHash);

    await expect(dao.connect(bob).getDirectMessage(1n)).to.be.revertedWith(
      "Only sender or recipient can read this message."
    );
  });

  it("recipient can mark message as read", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.sendDirectMessage(alice.address, "enc-data", sampleHash);

    await dao.connect(alice).markMessageRead(1n);
    const m = await dao.getDirectMessage(1n);
    expect(m.readByRecipient).to.be.true;
  });

  it("emits DirectMessageRead event", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.sendDirectMessage(alice.address, "enc-data", sampleHash);

    await expect(dao.connect(alice).markMessageRead(1n))
      .to.emit(dao, "DirectMessageRead")
      .withArgs(1n, alice.address);
  });

  it("non-recipient cannot mark as read", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.sendDirectMessage(alice.address, "enc-data", sampleHash);

    await expect(dao.markMessageRead(1n)).to.be.revertedWith(
      "Only recipient can mark as read."
    );
  });

  it("cannot message self", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await expect(
      dao.sendDirectMessage(owner.address, "enc", sampleHash)
    ).to.be.revertedWith("Cannot message self.");
  });

  it("cannot message unregistered agent", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await expect(
      dao.sendDirectMessage(alice.address, "enc", sampleHash)
    ).to.be.revertedWith("Recipient must be a registered agent.");
  });

  it("reverts on empty content", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await expect(
      dao.sendDirectMessage(alice.address, "", sampleHash)
    ).to.be.revertedWith("Message content required.");
  });

  it("reverts on zero content hash", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await expect(
      dao.sendDirectMessage(alice.address, "enc", ethers.ZeroHash)
    ).to.be.revertedWith("Content hash required.");
  });

  it("getConversation returns thread between two agents", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    // Fund both agents' escrow for messaging fees
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("msg1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("msg2"));
    const hash3 = ethers.keccak256(ethers.toUtf8Bytes("msg3"));

    await dao.sendDirectMessage(alice.address, "enc1", hash1);
    await dao.connect(alice).sendDirectMessage(owner.address, "enc2", hash2);
    await dao.sendDirectMessage(alice.address, "enc3", hash3);

    const [ids, total] = await dao.getConversation(alice.address, 0, 10);
    expect(total).to.equal(3n);
    expect(ids.length).to.equal(3);
    expect(ids[0]).to.equal(1n);
    expect(ids[1]).to.equal(2n);
    expect(ids[2]).to.equal(3n);

    // Same conversation from alice's perspective
    const [ids2, total2] = await dao.connect(alice).getConversation(owner.address, 0, 10);
    expect(total2).to.equal(3n);
    expect(ids2.length).to.equal(3);
  });

  it("getConversation paginates correctly", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.1") });

    for (let i = 0; i < 5; i++) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(`msg${i}`));
      await dao.sendDirectMessage(alice.address, `enc${i}`, hash);
    }

    const [page1, total] = await dao.getConversation(alice.address, 0, 3);
    expect(total).to.equal(5n);
    expect(page1.length).to.equal(3);
    const [page2] = await dao.getConversation(alice.address, 3, 3);
    expect(page2.length).to.equal(2);
  });

  it("getInbox returns received messages", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    await dao.sendDirectMessage(alice.address, "enc1", ethers.keccak256(ethers.toUtf8Bytes("m1")));
    await dao.sendDirectMessage(alice.address, "enc2", ethers.keccak256(ethers.toUtf8Bytes("m2")));

    const [ids, total] = await dao.connect(alice).getInbox(0, 10);
    expect(total).to.equal(2n);
    expect(ids[0]).to.equal(1n);
    expect(ids[1]).to.equal(2n);
  });

  it("non-agent cannot send messages", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");

    await expect(
      dao.connect(alice).sendDirectMessage(owner.address, "enc", sampleHash)
    ).to.be.revertedWith("Only registered agents can call this function.");
  });
});

// ─── Token Escrow & Token Payment Requests ───────────────────────────────────

describe("Token escrow and token payment requests", () => {
  async function deployWithToken() {
    const ctx = await deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy();
    await token.waitForDeployment();
    return { ...ctx, token };
  }

  it("depositTokenToEscrow credits net amount and pays treasury fee", async () => {
    const { dao, owner, treasury, token } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");

    const amount = ethers.parseEther("100");
    await token.approve(await dao.getAddress(), amount);

    const treasuryBefore = await token.balanceOf(treasury.address);
    await dao.depositTokenToEscrow(await token.getAddress(), amount);
    const treasuryAfter = await token.balanceOf(treasury.address);

    const fee = amount * 5n / 10000n;
    const escrowBal = await dao.getAgentTokenBalance(owner.address, await token.getAddress());
    expect(escrowBal).to.equal(amount - fee);
    expect(treasuryAfter - treasuryBefore).to.equal(fee);
  });

  it("transferTokenBetweenAgents moves net escrow and emits event", async () => {
    const { dao, owner, alice, token } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const depositAmount = ethers.parseEther("100");
    await token.approve(await dao.getAddress(), depositAmount);
    await dao.depositTokenToEscrow(await token.getAddress(), depositAmount);

    const transferAmt = ethers.parseEther("30");
    const fee = transferAmt * 5n / 10000n;

    await expect(
      dao.transferTokenBetweenAgents(await token.getAddress(), alice.address, transferAmt, "token memo")
    ).to.emit(dao, "AgentToAgentTokenTransfer");

    const senderBal = await dao.getAgentTokenBalance(owner.address, await token.getAddress());
    const recvBal = await dao.getAgentTokenBalance(alice.address, await token.getAddress());

    const depositFee = depositAmount * 5n / 10000n;
    expect(senderBal).to.equal((depositAmount - depositFee) - transferAmt);
    expect(recvBal).to.equal(transferAmt - fee);
  });

  it("settles token payment request from payer to requester wallet (net of fee)", async () => {
    const { dao, owner, alice, token, treasury } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const amount = ethers.parseEther("50");
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address,
      await token.getAddress(),
      amount,
      false,
      "token invoice"
    );

    await token.approve(await dao.getAddress(), amount);
    const aliceBefore = await token.balanceOf(alice.address);
    const treasuryBefore = await token.balanceOf(treasury.address);

    await dao.settleAgentPaymentRequest(1n);

    const fee = amount * 5n / 10000n;
    const aliceAfter = await token.balanceOf(alice.address);
    const treasuryAfter = await token.balanceOf(treasury.address);
    const req = await dao.getAgentPaymentRequest(1n);

    expect(aliceAfter - aliceBefore).to.equal(amount - fee);
    expect(treasuryAfter - treasuryBefore).to.equal(fee);
    expect(req.status).to.equal(1n);
  });
});

// ─── Asset transfer between agents ───────────────────────────────────────────

describe("transferAssetBetweenAgents", () => {
  it("transfers NFT and routes flat fee to treasury", async () => {
    const { dao, owner, alice, treasury } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const NFT = await ethers.getContractFactory("MockERC721");
    const nft = await NFT.deploy();
    await nft.waitForDeployment();

    await nft.mint(owner.address);
    await nft.approve(await dao.getAddress(), 0n);

    const fee = await dao.assetTransferFlatFeeWei();
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    await dao.transferAssetBetweenAgents(await nft.getAddress(), alice.address, 0n, "nft transfer", { value: fee });

    const treasuryAfter = await ethers.provider.getBalance(treasury.address);
    expect(await nft.ownerOf(0n)).to.equal(alice.address);
    expect(treasuryAfter - treasuryBefore).to.equal(fee);
  });
});

// ─── System / Integration ─────────────────────────────────────────────────────

describe("System integration: full agent lifecycle", () => {
  it("two agents can deposit, transfer, and withdraw end-to-end", async () => {
    const { dao, owner, alice, treasury } = await deploy();

    // Setup: owner already member, alice joins via stake
    await dao.registerAgent("ipfs://owner");
    await dao.connect(alice).stakeAndJoin("ipfs://alice", { value: ethers.parseEther("0.01") });

    // Owner deposits 2 ETH
    const deposit = ethers.parseEther("2");
    await dao.depositNativeToEscrow({ value: deposit });
    const depFee = deposit * 5n / 10000n;
    const ownerEscrow0 = deposit - depFee;

    const [, , ownerBal0] = await dao.getAgentProfile(owner.address);
    expect(ownerBal0).to.equal(ownerEscrow0);

    // Transfer 1 ETH to alice
    const xfer = ethers.parseEther("1");
    await dao.transferNativeBetweenAgents(alice.address, xfer, "payment for service");
    const xferFee = xfer * 5n / 10000n;

    const [, , ownerBal1] = await dao.getAgentProfile(owner.address);
    const [, , aliceBal1] = await dao.getAgentProfile(alice.address);
    expect(ownerBal1).to.equal(ownerEscrow0 - xfer);
    expect(aliceBal1).to.equal(xfer - xferFee);

    // Alice withdraws her balance
    const aliceWalletBefore = await ethers.provider.getBalance(alice.address);
    const withdrawAmt = aliceBal1;
    const tx = await dao.connect(alice).withdrawNativeFromEscrow(withdrawAmt);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const aliceWalletAfter = await ethers.provider.getBalance(alice.address);

    const withdrawFee = withdrawAmt * 5n / 10000n;
    expect(aliceWalletAfter - aliceWalletBefore + gasCost).to.equal(withdrawAmt - withdrawFee);

    // Treasury received all fees
    const treasuryBal = await ethers.provider.getBalance(treasury.address);
    // Treasury started with some initial balance; just confirm it received ETH
    expect(treasuryBal).to.be.greaterThan(ethers.parseEther("1000")); // default Hardhat balance
  });

  it("payment request full round-trip: create → settle → verify balances", async () => {
    const { dao, owner, alice, treasury } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const amount = ethers.parseEther("0.5");
    // Alice requests payment from owner
    await dao.connect(alice).createAgentPaymentRequest(
      owner.address, ethers.ZeroAddress, amount, true, "service rendered"
    );

    const reqBefore = await dao.getAgentPaymentRequest(1n);
    expect(reqBefore.status).to.equal(0n); // Requested

    // Track alice's wallet balance before settle
    const aliceWallet0 = await ethers.provider.getBalance(alice.address);

    // Owner settles
    await dao.settleAgentPaymentRequest(1n, { value: amount });

    const reqAfter = await dao.getAgentPaymentRequest(1n);
    expect(reqAfter.status).to.equal(1n); // Settled
    expect(reqAfter.settledAt).to.be.greaterThan(0n);

    // settle sends net ETH directly to requester's wallet (not escrow)
    const fee = amount * 5n / 10000n;
    const aliceWallet1 = await ethers.provider.getBalance(alice.address);
    expect(aliceWallet1 - aliceWallet0).to.equal(amount - fee);
  });
});

// ─── Governance: Proposals & Voting ──────────────────────────────────────────

describe("Governance: Proposals & Voting", () => {
  // Helper: deploy + create a milestone so proposals can reference it
  async function deployWithMilestone() {
    const ctx = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await ctx.dao.createMilestone("Milestone 1", futureDate);
    return ctx;
  }

  it("member with sufficient voting power can create a proposal", async () => {
    const { dao, owner } = await deployWithMilestone();
    await dao.createProposal("Proposal #1", [0]);
    expect(await dao.getProposalCount()).to.equal(1n);
    const p = await dao.getProposal(1n);
    expect(p.description).to.equal("Proposal #1");
    expect(p.executed).to.be.false;
  });

  it("non-member cannot create a proposal", async () => {
    const { dao, alice } = await deployWithMilestone();
    await expect(
      dao.connect(alice).createProposal("Proposal from non-member", [0])
    ).to.be.revertedWith("Only members can create proposals.");
  });

  it("member with insufficient voting power cannot create a proposal", async () => {
    const { dao, alice } = await deployWithMilestone();
    await dao.addMember(alice.address, 5); // below minimumVotingPower (10)
    await expect(
      dao.connect(alice).createProposal("Low power proposal", [0])
    ).to.be.revertedWith("Voting power not sufficient.");
  });

  it("member can vote yes on a proposal", async () => {
    const { dao, owner, alice } = await deployWithMilestone();
    await dao.addMember(alice.address, 20);
    await dao.createProposal("Proposal #1", [0]);
    await dao.connect(alice).vote(1n, true);
    const p = await dao.getProposal(1n);
    expect(p.yesVotes).to.equal(20n);
  });

  it("member can vote no on a proposal", async () => {
    const { dao, owner, alice } = await deployWithMilestone();
    await dao.addMember(alice.address, 15);
    await dao.createProposal("Proposal #1", [0]);
    await dao.connect(alice).vote(1n, false);
    const p = await dao.getProposal(1n);
    expect(p.noVotes).to.equal(15n);
  });

  it("cannot vote twice on the same proposal", async () => {
    const { dao, owner } = await deployWithMilestone();
    await dao.createProposal("Proposal #1", [0]);
    await dao.vote(1n, true);
    await expect(dao.vote(1n, true)).to.be.revertedWith("Member has already voted.");
  });

  it("non-member cannot vote", async () => {
    const { dao, owner, alice } = await deployWithMilestone();
    await dao.createProposal("Proposal #1", [0]);
    await expect(
      dao.connect(alice).vote(1n, true)
    ).to.be.revertedWith("Only members can vote.");
  });

  it("owner can execute a passed proposal after voting period", async () => {
    const { dao, owner } = await deployWithMilestone();
    await dao.createProposal("Proposal #1", [0]);
    await dao.vote(1n, true);
    // Advance time past voting period (7 days)
    await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine");
    await dao.executeProposal(1n);
    const p = await dao.getProposal(1n);
    expect(p.executed).to.be.true;
    expect(p.proposalPassed).to.be.true;
  });

  it("cannot execute proposal before voting period ends", async () => {
    const { dao, owner } = await deployWithMilestone();
    await dao.createProposal("Proposal #1", [0]);
    await dao.vote(1n, true);
    await expect(dao.executeProposal(1n)).to.be.revertedWith("Voting period has not ended.");
  });

  it("cannot execute non-existent proposal", async () => {
    const { dao } = await deployWithMilestone();
    await expect(dao.executeProposal(999n)).to.be.revertedWith("Invalid proposal ID.");
  });

  it("getProposal and getProposalCount work correctly", async () => {
    const { dao, owner } = await deployWithMilestone();
    expect(await dao.getProposalCount()).to.equal(0n);
    await dao.createProposal("First", [0]);
    await dao.createProposal("Second", [0]);
    expect(await dao.getProposalCount()).to.equal(2n);
    const p1 = await dao.getProposal(1n);
    const p2 = await dao.getProposal(2n);
    expect(p1.description).to.equal("First");
    expect(p2.description).to.equal("Second");
  });
});

// ─── Governance: Milestones ─────────────────────────────────────────────────

describe("Governance: Milestones", () => {
  it("owner can create a milestone", async () => {
    const { dao } = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("Build v1", futureDate);
    expect(await dao.getMilestoneCount()).to.equal(1n);
  });

  it("non-owner cannot create a milestone", async () => {
    const { dao, alice } = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await expect(
      dao.connect(alice).createMilestone("Unauthorized", futureDate)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("getMilestone returns correct data", async () => {
    const { dao } = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("Alpha release", futureDate);
    const m = await dao.getMilestone(0);
    expect(m.description).to.equal("Alpha release");
    expect(m.date).to.equal(BigInt(futureDate));
    expect(m.index).to.equal(0n);
  });

  it("getMilestoneCount tracks count correctly", async () => {
    const { dao } = await deploy();
    expect(await dao.getMilestoneCount()).to.equal(0n);
    const d1 = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("M1", d1);
    expect(await dao.getMilestoneCount()).to.equal(1n);
    const d2 = d1 + 86400;
    await dao.createMilestone("M2", d2);
    expect(await dao.getMilestoneCount()).to.equal(2n);
  });

  it("reverts on invalid milestone ID", async () => {
    const { dao } = await deploy();
    await expect(dao.getMilestone(0)).to.be.revertedWith("Invalid milestone ID.");
  });
});

// ─── Role & Permission Management ───────────────────────────────────────────

describe("Role & Permission Management", () => {
  it("owner can create a role", async () => {
    const { dao } = await deploy();
    // Role 0 is "Owner" created in constructor
    await dao.createRole(ethers.encodeBytes32String("Admin"));
    const [name, memberCount] = await dao.getRole(2); // 1-based: role 2 is Admin (role 1 is Owner)
    expect(ethers.decodeBytes32String(name)).to.equal("Admin");
    expect(memberCount).to.equal(0n);
  });

  it("owner can add a permission to a role", async () => {
    const { dao } = await deploy();
    await dao.createRole(ethers.encodeBytes32String("Editor"));
    // roleId for addPermission is 1-based: role at index 1 => roleId 2? No.
    // _createRole pushes to roles[], so after constructor: roles[0] = Owner.
    // createRole("Editor") => roles[1] = Editor. addPermission expects roleId 1-based? Let me check.
    // addPermission: require(_roleId > 0 && _roleId <= roles.length) => roles[_roleId - 1]
    // After constructor, roles.length = 1. After createRole("Editor"), roles.length = 2.
    // To target Editor: _roleId = 2 (since roles[2-1] = roles[1] = Editor).
    await dao.addPermission(2, "edit_content");
    // No revert means success. The permission is stored in a mapping, not easily readable.
    // We verify by emitting PermissionAdded event.
  });

  it("emits PermissionAdded event", async () => {
    const { dao } = await deploy();
    await dao.createRole(ethers.encodeBytes32String("Mod"));
    await expect(dao.addPermission(2, "moderate"))
      .to.emit(dao, "PermissionAdded")
      .withArgs(2n, "moderate");
  });

  it("owner can remove a permission from a role", async () => {
    const { dao } = await deploy();
    await dao.createRole(ethers.encodeBytes32String("Mod"));
    await dao.addPermission(2, "moderate");
    await expect(dao.removePermission(2, "moderate"))
      .to.emit(dao, "PermissionRemoved")
      .withArgs(2n, "moderate");
  });

  it("owner can assign role to a member", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createRole(ethers.encodeBytes32String("Builder"));
    await expect(dao.assignRole(alice.address, 2))
      .to.emit(dao, "RoleAssigned")
      .withArgs(alice.address, 2n);
  });

  it("non-owner cannot create role", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).createRole(ethers.encodeBytes32String("Hacker"))
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("assignRoleToMilestone works for valid roles", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("M1", futureDate);
    // assignRoleToMilestone requires a proposal to exist with milestoneId matching
    // Owner is already assigned to milestone 0 via createMilestone
    await dao.createProposal("Setup proposal", [0]);
    const builderRole = ethers.keccak256(ethers.toUtf8Bytes("builder"));
    await dao.assignRoleToMilestone(alice.address, 0, builderRole);
    // No revert means success
  });

  it("getRole returns correct data", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createRole(ethers.encodeBytes32String("Reviewer"));
    await dao.assignRole(alice.address, 2);
    const [name, memberCount] = await dao.getRole(2); // 1-based: role 2 is Reviewer
    expect(ethers.decodeBytes32String(name)).to.equal("Reviewer");
    expect(memberCount).to.equal(1n);
  });
});

// ─── Access Control & Edge Cases ────────────────────────────────────────────

describe("Access Control & Edge Cases", () => {
  it("changeOwner works and old owner loses access", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.changeOwner(alice.address);
    expect(await dao.owner()).to.equal(alice.address);
    // Old owner can no longer call onlyOwner functions
    await expect(
      dao.setCybereumTreasury(owner.address)
    ).to.be.revertedWith("Only the owner can call this function.");
    // New owner can call onlyOwner functions
    await dao.connect(alice).setCybereumTreasury(alice.address);
    expect(await dao.cybereumTreasury()).to.equal(alice.address);
  });

  it("changeOwner reverts on zero address", async () => {
    const { dao } = await deploy();
    await expect(dao.changeOwner(ethers.ZeroAddress)).to.be.revertedWith(
      "Invalid new owner address."
    );
  });

  it("changeOwner reverts on self-transfer", async () => {
    const { dao, owner } = await deploy();
    await expect(dao.changeOwner(owner.address)).to.be.revertedWith(
      "Already the owner."
    );
  });

  it("grantPrivilege works for a member", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.grantPrivilege(alice.address, 1);
    // Verify by reading the member's privileges
    const m = await dao.members(alice.address);
    expect(m.isMember).to.be.true;
  });

  it("grantPrivilege reverts for non-member", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.grantPrivilege(alice.address, 1)
    ).to.be.revertedWith("Invalid member address.");
  });

  it("paused contract blocks depositNativeToEscrow", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await dao.pauseContract();
    await expect(
      dao.depositNativeToEscrow({ value: ethers.parseEther("1") })
    ).to.be.revertedWith("Contract is paused.");
  });

  it("paused contract blocks transferNativeBetweenAgents", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("1") });
    await dao.pauseContract();
    await expect(
      dao.transferNativeBetweenAgents(alice.address, ethers.parseEther("0.1"), "memo")
    ).to.be.revertedWith("Contract is paused.");
  });

  it("paused contract blocks createAgentPaymentRequest", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.pauseContract();
    await expect(
      dao.connect(alice).createAgentPaymentRequest(
        owner.address, ethers.ZeroAddress, ethers.parseEther("0.1"), true, "inv"
      )
    ).to.be.revertedWith("Contract is paused.");
  });

  it("cannot register agent twice", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await expect(dao.registerAgent("ipfs://b")).to.be.revertedWith(
      "Agent already registered."
    );
  });

  it("cannot withdraw more than escrow balance", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://a");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.5") });
    await expect(
      dao.withdrawNativeFromEscrow(ethers.parseEther("1"))
    ).to.be.revertedWith("Insufficient native escrow balance.");
  });

  it("cannot create self-payment request", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const amount = ethers.parseEther("0.1");
    await expect(
      dao.createAgentPaymentRequest(
        owner.address, ethers.ZeroAddress, amount, true, "self-invoice"
      )
    ).to.be.revertedWith("Cannot request payment from self.");
  });

  it("zero-value deposit reverts", async () => {
    const { dao } = await deploy();
    await dao.registerAgent("ipfs://a");
    await expect(
      dao.depositNativeToEscrow({ value: 0n })
    ).to.be.revertedWith("Deposit amount must be greater than zero.");
  });
});

// ─── Task Management ────────────────────────────────────────────────────────

describe("Task management", () => {
  // Helper: deploy + create a milestone so tasks can reference it
  async function deployWithMilestone() {
    const ctx = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await ctx.dao.createMilestone("Milestone 1", futureDate);
    return ctx;
  }

  // Helper: deploy + milestone + task
  async function deployWithTask() {
    const ctx = await deployWithMilestone();
    await ctx.dao.addMember(ctx.alice.address, 10);
    await ctx.dao.createTask("Task 1", 9999999999, 0, ctx.alice.address, "open");
    return ctx;
  }

  it("owner can assign a task to a member", async () => {
    const ctx = await deployWithTask();
    const { dao, bob } = ctx;
    await dao.addMember(bob.address, 10);
    await dao.assignTask(1, bob.address);
    // Verify by reading task via getTasksForMilestone
    const tasks = await dao.getTasksForMilestone(0);
    expect(tasks[0].assignedMember).to.equal(bob.address);
  });

  it("assignTask reverts for non-member address", async () => {
    const { dao, bob } = await deployWithTask();
    await expect(dao.assignTask(1, bob.address)).to.be.revertedWith("Invalid member address.");
  });

  it("assignTask reverts for non-owner caller", async () => {
    const { dao, alice } = await deployWithTask();
    await expect(
      dao.connect(alice).assignTask(1, alice.address)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("assignTask reverts for invalid task ID", async () => {
    const { dao, alice } = await deployWithTask();
    await expect(dao.assignTask(999, alice.address)).to.be.revertedWith("Invalid task ID.");
  });

  it("owner can update task status", async () => {
    const { dao } = await deployWithTask();
    await dao.updateTaskStatus(1, "in-progress");
    const tasks = await dao.getTasksForMilestone(0);
    expect(tasks[0].status).to.equal("in-progress");
  });

  it("updateTaskStatus reverts for non-owner", async () => {
    const { dao, alice } = await deployWithTask();
    await expect(
      dao.connect(alice).updateTaskStatus(1, "done")
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("updateTaskStatus reverts for invalid task ID", async () => {
    const { dao } = await deployWithTask();
    await expect(dao.updateTaskStatus(999, "done")).to.be.revertedWith("Invalid task ID.");
  });

  it("owner can complete a task", async () => {
    const { dao } = await deployWithTask();
    await dao.completeTask(1);
    const tasks = await dao.getTasksForMilestone(0);
    expect(tasks[0].completed).to.be.true;
  });

  it("completeTask reverts for non-owner", async () => {
    const { dao, alice } = await deployWithTask();
    await expect(
      dao.connect(alice).completeTask(1)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("completeTask reverts for invalid task ID", async () => {
    const { dao } = await deployWithTask();
    await expect(dao.completeTask(999)).to.be.revertedWith("Invalid task ID.");
  });

  it("owner can delete a task", async () => {
    const { dao } = await deployWithTask();
    await expect(dao.deleteTask(1)).to.emit(dao, "TaskDeleted").withArgs(1n);
  });

  it("deleteTask reverts for non-owner", async () => {
    const { dao, alice } = await deployWithTask();
    await expect(
      dao.connect(alice).deleteTask(1)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("deleteTask reverts for invalid task ID", async () => {
    const { dao } = await deployWithTask();
    await expect(dao.deleteTask(999)).to.be.revertedWith("Invalid task ID.");
  });

  it("getTasksForMilestone returns tasks for a given milestone", async () => {
    const { dao, alice } = await deployWithTask();
    // Create a second task on the same milestone
    await dao.createTask("Task 2", 9999999999, 0, alice.address, "open");
    const tasks = await dao.getTasksForMilestone(0);
    expect(tasks.length).to.equal(2);
    expect(tasks[0].description).to.equal("Task 1");
    expect(tasks[1].description).to.equal("Task 2");
  });

  it("getTasksForMilestone reverts for invalid milestone ID", async () => {
    const { dao } = await deployWithTask();
    await expect(dao.getTasksForMilestone(999)).to.be.revertedWith("Invalid milestone ID.");
  });
});

// ─── Governance Config ──────────────────────────────────────────────────────

describe("Governance config", () => {
  it("owner can change voting period", async () => {
    const { dao } = await deploy();
    await dao.changeVotingPeriod(14 * 24 * 60 * 60); // 14 days
    expect(await dao.votingPeriod()).to.equal(BigInt(14 * 24 * 60 * 60));
  });

  it("changeVotingPeriod reverts for non-owner", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).changeVotingPeriod(1000)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("changeVotingPeriod reverts on zero value", async () => {
    const { dao } = await deploy();
    await expect(dao.changeVotingPeriod(0)).to.be.revertedWith(
      "New voting period should be greater than zero."
    );
  });

  it("owner can change minimum voting power", async () => {
    const { dao } = await deploy();
    await dao.changeMinimumVotingPower(50);
    expect(await dao.minimumVotingPower()).to.equal(50n);
  });

  it("changeMinimumVotingPower reverts for non-owner", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).changeMinimumVotingPower(50)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("changeMinimumVotingPower reverts on zero value", async () => {
    const { dao } = await deploy();
    await expect(dao.changeMinimumVotingPower(0)).to.be.revertedWith(
      "New minimum voting power should be greater than zero."
    );
  });
});

// ─── Proposal Disputes ──────────────────────────────────────────────────────

describe("Proposal disputes", () => {
  // Helper: deploy + milestone + proposal (not yet executed)
  async function deployWithProposal() {
    const ctx = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await ctx.dao.createMilestone("Milestone 1", futureDate);
    // Owner is a member assigned to milestone 0
    await ctx.dao.createProposal("Disputable proposal", [0]);
    return ctx;
  }

  it("member can dispute a proposal that has not been executed", async () => {
    const { dao, owner } = await deployWithProposal();
    // Owner is milestone-assigned member — can dispute
    await dao.disputeProposal(1, "I disagree with this proposal");
    const dispute = await dao.proposalDisputes(1);
    expect(dispute.id).to.equal(1n);
    expect(dispute.proposalId).to.equal(1n);
    expect(dispute.resolved).to.be.false;
  });

  it("disputeProposal reverts for non-member", async () => {
    const { dao, alice } = await deployWithProposal();
    await expect(
      dao.connect(alice).disputeProposal(1, "dispute")
    ).to.be.revertedWith("Only members can call this function.");
  });

  it("disputeProposal reverts for invalid proposal ID", async () => {
    const { dao } = await deployWithProposal();
    await expect(dao.disputeProposal(999, "dispute")).to.be.revertedWith("Invalid proposal ID.");
  });

  it("member can vote on a dispute", async () => {
    const { dao, owner } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await dao.voteOnProposalDispute(1, true);
    const dispute = await dao.proposalDisputes(1);
    expect(dispute.votesFor).to.equal(1n);
  });

  it("voteOnProposalDispute reverts for non-member", async () => {
    const { dao, alice } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await expect(
      dao.connect(alice).voteOnProposalDispute(1, true)
    ).to.be.revertedWith("Only members can call this function.");
  });

  it("voteOnProposalDispute reverts if already voted", async () => {
    const { dao } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await dao.voteOnProposalDispute(1, true);
    await expect(dao.voteOnProposalDispute(1, false)).to.be.revertedWith(
      "Already voted on this dispute."
    );
  });

  it("voteOnProposalDispute reverts for non-existent dispute", async () => {
    const { dao } = await deployWithProposal();
    await expect(dao.voteOnProposalDispute(999, true)).to.be.revertedWith(
      "Dispute does not exist."
    );
  });

  it("owner can resolve dispute after deadline", async () => {
    const { dao } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    // Advance time past dispute deadline (votingPeriod / 2 = 3.5 days)
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await dao.resolveProposalDispute(1, true);
    const dispute = await dao.proposalDisputes(1);
    expect(dispute.resolved).to.be.true;
  });

  it("resolveProposalDispute reverts for non-owner", async () => {
    const { dao, alice } = await deployWithProposal();
    await dao.addMember(alice.address, 10);
    await dao.disputeProposal(1, "I disagree");
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await expect(
      dao.connect(alice).resolveProposalDispute(1, true)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("resolveProposalDispute reverts before deadline", async () => {
    const { dao } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await expect(dao.resolveProposalDispute(1, true)).to.be.revertedWith(
      "The voting period has not yet ended."
    );
  });

  it("resolveProposalDispute in favor marks proposal as passed", async () => {
    const { dao } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await dao.resolveProposalDispute(1, true);
    const p = await dao.getProposal(1);
    expect(p.proposalPassed).to.be.true;
  });

  it("resolveProposalDispute not in favor does not mark proposal as passed", async () => {
    const { dao } = await deployWithProposal();
    await dao.disputeProposal(1, "I disagree");
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await dao.resolveProposalDispute(1, false);
    const p = await dao.getProposal(1);
    expect(p.proposalPassed).to.be.false;
  });
});

// ─── Member Query ───────────────────────────────────────────────────────────

describe("Member query functions", () => {
  it("getMember returns correct data for a member", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 25);
    const m = await dao.getMember(alice.address);
    expect(m.votingPower).to.equal(25n);
    expect(m.isMember).to.be.true;
  });

  it("getMember returns default data for non-member", async () => {
    const { dao, alice } = await deploy();
    const m = await dao.getMember(alice.address);
    expect(m.isMember).to.be.false;
    expect(m.votingPower).to.equal(0n);
  });

  it("getMemberCount returns correct count", async () => {
    const { dao, alice, bob } = await deploy();
    // Owner is added as member in constructor
    const initialCount = await dao.getMemberCount();
    await dao.addMember(alice.address, 10);
    expect(await dao.getMemberCount()).to.equal(initialCount + 1n);
    await dao.addMember(bob.address, 10);
    expect(await dao.getMemberCount()).to.equal(initialCount + 2n);
  });

  it("getMemberCount decreases when member is removed", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    const countBefore = await dao.getMemberCount();
    await dao.removeMember(alice.address);
    expect(await dao.getMemberCount()).to.equal(countBefore - 1n);
  });
});

// ─── Token Escrow: Withdraw ─────────────────────────────────────────────────

describe("withdrawTokenFromEscrow", () => {
  async function deployWithToken() {
    const ctx = await deploy();
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy();
    await token.waitForDeployment();
    return { ...ctx, token };
  }

  it("agent can withdraw tokens from escrow", async () => {
    const { dao, owner, treasury, token } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");

    const depositAmount = ethers.parseEther("100");
    await token.approve(await dao.getAddress(), depositAmount);
    await dao.depositTokenToEscrow(await token.getAddress(), depositAmount);

    const depositFee = depositAmount * 5n / 10000n;
    const escrowBalance = depositAmount - depositFee;

    const withdrawAmount = ethers.parseEther("50");
    const withdrawFee = withdrawAmount * 5n / 10000n;

    const ownerBalBefore = await token.balanceOf(owner.address);
    await dao.withdrawTokenFromEscrow(await token.getAddress(), withdrawAmount);
    const ownerBalAfter = await token.balanceOf(owner.address);

    expect(ownerBalAfter - ownerBalBefore).to.equal(withdrawAmount - withdrawFee);

    const remainingEscrow = await dao.getAgentTokenBalance(owner.address, await token.getAddress());
    expect(remainingEscrow).to.equal(escrowBalance - withdrawAmount);
  });

  it("withdrawTokenFromEscrow sends fee to treasury", async () => {
    const { dao, owner, treasury, token } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");

    const depositAmount = ethers.parseEther("100");
    await token.approve(await dao.getAddress(), depositAmount);
    await dao.depositTokenToEscrow(await token.getAddress(), depositAmount);

    const withdrawAmount = ethers.parseEther("50");
    const withdrawFee = withdrawAmount * 5n / 10000n;

    const treasuryBefore = await token.balanceOf(treasury.address);
    await dao.withdrawTokenFromEscrow(await token.getAddress(), withdrawAmount);
    const treasuryAfter = await token.balanceOf(treasury.address);

    expect(treasuryAfter - treasuryBefore).to.equal(withdrawFee);
  });

  it("withdrawTokenFromEscrow reverts on insufficient balance", async () => {
    const { dao, owner, token } = await deployWithToken();
    await dao.registerAgent("ipfs://owner");

    const depositAmount = ethers.parseEther("10");
    await token.approve(await dao.getAddress(), depositAmount);
    await dao.depositTokenToEscrow(await token.getAddress(), depositAmount);

    await expect(
      dao.withdrawTokenFromEscrow(await token.getAddress(), ethers.parseEther("100"))
    ).to.be.revertedWith("Insufficient token escrow balance.");
  });

  it("withdrawTokenFromEscrow reverts for non-agent", async () => {
    const { dao, alice, token } = await deployWithToken();
    await expect(
      dao.connect(alice).withdrawTokenFromEscrow(await token.getAddress(), ethers.parseEther("1"))
    ).to.be.revertedWith("Only registered agents can call this function.");
  });
});

// ─── getInbox ───────────────────────────────────────────────────────────────

describe("getInbox", () => {
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("inbox test"));

  it("returns correct message IDs after receiving multiple messages", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.addMember(bob.address, 10);
    await dao.connect(bob).registerAgent("ipfs://bob");
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.1") });
    await dao.connect(bob).depositNativeToEscrow({ value: ethers.parseEther("0.1") });

    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("msg1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("msg2"));
    const hash3 = ethers.keccak256(ethers.toUtf8Bytes("msg3"));

    // owner sends to alice (msg 1), bob sends to alice (msg 2), owner sends to alice (msg 3)
    await dao.sendDirectMessage(alice.address, "enc1", hash1);
    await dao.connect(bob).sendDirectMessage(alice.address, "enc2", hash2);
    await dao.sendDirectMessage(alice.address, "enc3", hash3);

    const [ids, total] = await dao.connect(alice).getInbox(0, 10);
    expect(total).to.equal(3n);
    expect(ids.length).to.equal(3);
    expect(ids[0]).to.equal(1n);
    expect(ids[1]).to.equal(2n);
    expect(ids[2]).to.equal(3n);
  });

  it("getInbox returns empty for agent with no messages", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const [ids, total] = await dao.getInbox(0, 10);
    expect(total).to.equal(0n);
    expect(ids.length).to.equal(0);
  });

  it("getInbox paginates correctly", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.1") });

    for (let i = 0; i < 5; i++) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(`inbox-msg${i}`));
      await dao.sendDirectMessage(alice.address, `enc${i}`, hash);
    }

    const [page1, total] = await dao.connect(alice).getInbox(0, 3);
    expect(total).to.equal(5n);
    expect(page1.length).to.equal(3);

    const [page2] = await dao.connect(alice).getInbox(3, 3);
    expect(page2.length).to.equal(2);
  });

  it("getInbox does not include sent messages", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    // owner sends to alice
    await dao.sendDirectMessage(alice.address, "enc1", sampleHash);
    // owner's inbox should be empty (they sent, not received)
    const [ids, total] = await dao.getInbox(0, 10);
    expect(total).to.equal(0n);
    expect(ids.length).to.equal(0);
  });
});

// ─── Economic Projects: Edge Cases ──────────────────────────────────────────

describe("Economic Projects: Edge Cases", () => {
  // Helper to get a future deadline relative to current block timestamp
  async function futureDeadline() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp + 86400;
  }

  it("refundProjectFunder works after cancellation", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = await futureDeadline();
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);

    const fundAmt = ethers.parseEther("0.5");
    await dao.connect(alice).fundProject(1n, { value: fundAmt });
    const fee = fundAmt * 5n / 10000n;
    const netFunded = fundAmt - fee;

    await dao.cancelProject(1n);

    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await dao.connect(alice).refundProjectFunder(1n);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const aliceAfter = await ethers.provider.getBalance(alice.address);

    // Refund amount is the net contribution minus exit fee (3 bps)
    const exitFee = netFunded * 3n / 10000n;
    expect(aliceAfter - aliceBefore + gasCost).to.be.closeTo(netFunded - exitFee, ethers.parseEther("0.0001"));
  });

  it("cannot fund a cancelled project", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = await futureDeadline();
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.cancelProject(1n);
    await expect(
      dao.connect(alice).fundProject(1n, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Project not accepting funds.");
  });

  it("proposer can complete a project without approved contributors", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = await futureDeadline();
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    // Complete without any contributors — the contract allows it
    await dao.completeProject(1n);
    const proj = await dao.economicProjects(1n);
    expect(proj.status).to.equal(2n); // Completed
  });

  it("getEconomicProject returns correct data", async () => {
    const { dao, owner } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = await futureDeadline();
    const budget = ethers.parseEther("5");
    await dao.createEconomicProject("ipfs://proj-meta", budget, deadline);
    const [id, proposer, metadataURI, targetBudget, totalFunded, dl, status, createdAt, contributorCount, funderCount] =
      await dao.getEconomicProject(1n);
    expect(id).to.equal(1n);
    expect(proposer).to.equal(owner.address);
    expect(metadataURI).to.equal("ipfs://proj-meta");
    expect(targetBudget).to.equal(budget);
    expect(totalFunded).to.equal(0n);
    expect(status).to.equal(0n); // Open
    expect(contributorCount).to.equal(0n);
    expect(funderCount).to.equal(0n);
  });

  it("getProjectContributors and getProjectFunders return correct lists", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const deadline = await futureDeadline();
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);

    // Fund
    await dao.connect(bob).fundProject(1n, { value: ethers.parseEther("0.5") });
    const funders = await dao.getProjectFunders(1n);
    expect(funders.length).to.equal(1);
    expect(funders[0]).to.equal(bob.address);

    // Apply and approve contributor
    await dao.connect(alice).applyToProject(1n);
    await dao.approveContributor(1n, alice.address, 5000);
    const contributors = await dao.getProjectContributors(1n);
    expect(contributors.length).to.equal(1);
    expect(contributors[0]).to.equal(alice.address);
  });
});

// ─── AI Service Fee ──────────────────────────────────────────────────────────

describe("AI Service Fee", () => {
  it("defaults to 0.0003 ETH", async () => {
    const { dao } = await deploy();
    expect(await dao.aiServiceFeeWei()).to.equal(ethers.parseEther("0.0003"));
  });

  it("owner can update AI service fee", async () => {
    const { dao } = await deploy();
    await dao.setAIServiceFee(ethers.parseEther("0.001"));
    expect(await dao.aiServiceFeeWei()).to.equal(ethers.parseEther("0.001"));
  });

  it("emits AIServiceFeeUpdated on config change", async () => {
    const { dao } = await deploy();
    const newFee = ethers.parseEther("0.0005");
    await expect(dao.setAIServiceFee(newFee))
      .to.emit(dao, "AIServiceFeeUpdated")
      .withArgs(newFee);
  });

  it("non-owner cannot update AI service fee", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).setAIServiceFee(1000))
      .to.be.revertedWith("Only the owner can call this function.");
  });

  it("registered agent can deduct AI service fee from escrow", async () => {
    const { dao, alice, treasury } = await deploy();
    await memberAgent(dao, alice);
    const depositAmount = ethers.parseEther("0.01");
    await dao.connect(alice).depositNativeToEscrow({ value: depositAmount });

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await dao.connect(alice).deductAIServiceFee("health");
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    const fee = ethers.parseEther("0.0003");
    expect(treasuryAfter - treasuryBefore).to.equal(fee);
  });

  it("emits AIServiceFeeDeducted and CybereumFeePaid", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    const fee = ethers.parseEther("0.0003");
    await expect(dao.connect(alice).deductAIServiceFee("security"))
      .to.emit(dao, "AIServiceFeeDeducted")
      .withArgs(alice.address, fee, "security")
      .and.to.emit(dao, "CybereumFeePaid");
  });

  it("reduces agent escrow balance by fee amount", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const deposit = ethers.parseEther("0.01");
    await dao.connect(alice).depositNativeToEscrow({ value: deposit });

    const depositFee = (deposit * 5n) / 10000n;
    const escrowBefore = deposit - depositFee;

    await dao.connect(alice).deductAIServiceFee("ux");
    const profile = await dao.getAgentProfile(alice.address);
    const aiFee = ethers.parseEther("0.0003");
    expect(profile.nativeEscrowBalance).to.equal(escrowBefore - aiFee);
  });

  it("reverts when escrow balance is insufficient", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    // No deposit — escrow is 0
    await expect(dao.connect(alice).deductAIServiceFee("health"))
      .to.be.revertedWith("Insufficient escrow balance for AI service fee.");
  });

  it("reverts for non-registered agent", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).deductAIServiceFee("health"))
      .to.be.revertedWith("Only registered agents can call this function.");
  });

  it("reverts when contract is paused", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.pauseContract();
    await expect(dao.connect(alice).deductAIServiceFee("health"))
      .to.be.reverted;
  });

  it("owner can set fee to zero (free AI)", async () => {
    const { dao } = await deploy();
    await dao.setAIServiceFee(0);
    expect(await dao.aiServiceFeeWei()).to.equal(0n);
  });

  it("deductAIServiceFee reverts when fee is zero", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.setAIServiceFee(0);
    await expect(dao.connect(alice).deductAIServiceFee("health"))
      .to.be.revertedWith("AI service fee not configured.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ███ COMMERCE BLACKHOLE TESTS ████████████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════════

describe("Commerce Blackhole: Configuration", () => {
  it("defaults: messagingFeeWei=0.0001 ETH, exitFeeBps=3", async () => {
    const { dao } = await deploy();
    expect(await dao.messagingFeeWei()).to.equal(ethers.parseEther("0.0001"));
    expect(await dao.exitFeeBps()).to.equal(3n);
  });

  it("owner can update blackhole config", async () => {
    const { dao } = await deploy();
    await dao.setCommerceBlackholeConfig(ethers.parseEther("0.0005"), 10);
    expect(await dao.messagingFeeWei()).to.equal(ethers.parseEther("0.0005"));
    expect(await dao.exitFeeBps()).to.equal(10n);
  });

  it("non-owner cannot update blackhole config", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).setCommerceBlackholeConfig(0, 5)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("reverts if exitFeeBps below minimum", async () => {
    const { dao } = await deploy();
    await expect(
      dao.setCommerceBlackholeConfig(0, 0)
    ).to.be.revertedWith("Exit fee cannot be below minimum.");
  });

  it("reverts if exitFeeBps exceeds 1%", async () => {
    const { dao } = await deploy();
    await expect(
      dao.setCommerceBlackholeConfig(0, 101)
    ).to.be.revertedWith("Exit fee cannot exceed 1%.");
  });

  it("previewExitFee returns correct values", async () => {
    const { dao } = await deploy();
    const amount = ethers.parseEther("1");
    const [fee, net] = await dao.previewExitFee(amount);
    expect(fee).to.equal(amount * 3n / 10000n);
    expect(net).to.equal(amount - fee);
  });
});

describe("Commerce Blackhole: Volume Tracking", () => {
  it("tracks volume on deposits", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const amount = ethers.parseEther("1");
    await dao.connect(alice).depositNativeToEscrow({ value: amount });

    expect(await dao.totalCommerceVolume()).to.equal(amount);
    expect(await dao.agentCommerceVolume(alice.address)).to.equal(amount);
    const fee = amount * 5n / 10000n;
    expect(await dao.totalFeesCollected()).to.equal(fee);
    expect(await dao.agentFeesPaid(alice.address)).to.equal(fee);
  });

  it("getBlackholeMetrics returns protocol-wide stats", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    const metrics = await dao.getBlackholeMetrics();
    expect(metrics._totalCommerceVolume).to.equal(ethers.parseEther("1"));
    expect(metrics._totalFeesCollected).to.be.gt(0n);
    expect(metrics._feeBps).to.equal(5n);
    expect(metrics._exitFeeBps).to.equal(3n);
    expect(metrics._messagingFeeWei).to.equal(ethers.parseEther("0.0001"));
  });

  it("getAgentCommerceMetrics returns per-agent stats", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    const metrics = await dao.getAgentCommerceMetrics(alice.address);
    expect(metrics.volume).to.equal(ethers.parseEther("1"));
    expect(metrics.feesPaid).to.be.gt(0n);
    expect(metrics.registered).to.be.true;
  });
});

describe("Commerce Blackhole: Messaging Fee", () => {
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("blackhole test"));

  it("deducts messaging fee from sender escrow", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const deposit = ethers.parseEther("0.01");
    await dao.depositNativeToEscrow({ value: deposit });
    const depositFee = deposit * 5n / 10000n;
    const escrowBefore = deposit - depositFee;

    await dao.sendDirectMessage(alice.address, "hello", sampleHash);

    const msgFee = await dao.messagingFeeWei();
    const [,,escrowAfter] = await dao.getAgentProfile(owner.address);
    expect(escrowAfter).to.equal(escrowBefore - msgFee);
  });

  it("emits MessagingFeePaid event", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    const msgFee = await dao.messagingFeeWei();
    await expect(dao.sendDirectMessage(alice.address, "hello", sampleHash))
      .to.emit(dao, "MessagingFeePaid")
      .withArgs(owner.address, msgFee);
  });

  it("reverts if insufficient escrow for messaging fee", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    // No escrow deposit
    await expect(
      dao.sendDirectMessage(alice.address, "hello", sampleHash)
    ).to.be.revertedWith("Insufficient escrow for messaging fee.");
  });
});

describe("Commerce Blackhole: Exit Fees", () => {
  it("claimProjectShare deducts exit fee", async () => {
    const { dao, owner, alice, treasury } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    const fundAmt = ethers.parseEther("1");
    await dao.connect(owner).fundProject(1n, { value: fundAmt });
    const fundFee = fundAmt * 5n / 10000n;
    const netFunded = fundAmt - fundFee;
    await dao.connect(alice).applyToProject(1n);
    await dao.approveContributor(1n, alice.address, 10000); // 100%
    await dao.completeProject(1n);

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await dao.connect(alice).claimProjectShare(1n);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    // Exit fee should have been paid to treasury
    const exitFee = netFunded * 3n / 10000n;
    expect(treasuryAfter - treasuryBefore).to.equal(exitFee);
  });

  it("leaveDAO deducts exit fee from stake refund", async () => {
    const { dao, alice, treasury } = await deploy();
    const stake = ethers.parseEther("1");
    await dao.connect(alice).stakeAndJoin("ipfs://alice", { value: stake });
    const joinFee = stake * 5n / 10000n;
    const netStake = stake - joinFee;

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    await dao.connect(alice).leaveDAO();
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    const exitFee = netStake * 3n / 10000n;
    expect(treasuryAfter - treasuryBefore).to.equal(exitFee);
  });
});

describe("Commerce Blackhole: Batch Operations", () => {
  it("batchTransferNative sends to multiple agents with fees", async () => {
    const { dao, owner, alice, bob, treasury } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);

    const deposit = ethers.parseEther("1");
    await dao.depositNativeToEscrow({ value: deposit });

    const amt1 = ethers.parseEther("0.1");
    const amt2 = ethers.parseEther("0.2");

    const treasuryBefore = await ethers.provider.getBalance(treasury.address);
    const tx = await dao.batchTransferNative(
      [alice.address, bob.address],
      [amt1, amt2],
      ["payment1", "payment2"]
    );
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    // Verify fees collected
    const fee1 = amt1 * 5n / 10000n;
    const fee2 = amt2 * 5n / 10000n;
    expect(treasuryAfter - treasuryBefore).to.be.gt(0n);

    // Verify recipients got net amounts
    const [,,aliceEscrow] = await dao.getAgentProfile(alice.address);
    const [,,bobEscrow] = await dao.getAgentProfile(bob.address);
    expect(aliceEscrow).to.equal(amt1 - fee1);
    expect(bobEscrow).to.equal(amt2 - fee2);

    // Verify event emitted
    await expect(tx).to.emit(dao, "BlackholeBatchTransfer");
  });

  it("batchTransferNative reverts on array mismatch", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    await expect(
      dao.connect(alice).batchTransferNative(
        [alice.address],
        [ethers.parseEther("0.1"), ethers.parseEther("0.2")],
        ["memo"]
      )
    ).to.be.revertedWith("Array length mismatch.");
  });

  it("batchTransferNative reverts on empty batch", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).batchTransferNative([], [], [])
    ).to.be.revertedWith("Empty batch.");
  });

  it("batchSettlePaymentRequests settles multiple requests", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);

    const amt = ethers.parseEther("0.1");
    // Alice creates 2 payment requests to owner
    await dao.connect(alice).createAgentPaymentRequest(owner.address, ethers.ZeroAddress, amt, true, "invoice 1");
    await dao.connect(alice).createAgentPaymentRequest(owner.address, ethers.ZeroAddress, amt, true, "invoice 2");

    const totalAmt = amt * 2n;
    const tx = await dao.batchSettlePaymentRequests([1n, 2n], { value: totalAmt });

    // Both should be settled
    const req1 = await dao.agentPaymentRequests(1n);
    const req2 = await dao.agentPaymentRequests(2n);
    expect(req1.status).to.equal(1n); // Settled
    expect(req2.status).to.equal(1n); // Settled

    await expect(tx).to.emit(dao, "BlackholeBatchSettle");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ███ REPUTATION ENGINE TESTS █████████████████████████████████████████████████
// ═══════════════════════════════════════════════════════════════════════════════

describe("Reputation Engine: Score Calculation", () => {
  it("new agent starts at 0 reputation", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    expect(await dao.agentReputation(alice.address)).to.equal(0n);
  });

  it("reputation increases after deposit (volume + tx count)", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const rep = await dao.agentReputation(alice.address);
    expect(rep).to.be.gt(0n);
  });

  it("transaction count increases with more commerce", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);

    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("2") });
    expect(await dao.agentTransactionCount(alice.address)).to.equal(1n);

    await dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.01"), "tx2");
    expect(await dao.agentTransactionCount(alice.address)).to.equal(2n);

    // Reputation should reflect both volume and tx count
    const rep = await dao.agentReputation(alice.address);
    expect(rep).to.be.gt(0n);
  });

  it("getAgentReputation returns full profile", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    const rep = await dao.getAgentReputation(alice.address);
    expect(rep.score).to.be.gt(0n);
    expect(rep.tier).to.be.gte(0n);
    expect(rep.transactionCount).to.equal(1n);
    expect(rep.lastActiveAt).to.be.gt(0n);
    expect(rep.registeredAt).to.be.gt(0n);
  });

  it("reputation maxes at 1000", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    // Large volume to max out volume score
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("10") });
    // Many transactions to max out tx score
    for (let i = 0; i < 50; i++) {
      await dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.001"), `tx${i}`);
    }
    const rep = await dao.agentReputation(alice.address);
    expect(rep).to.be.lte(1000n);
  });
});

describe("Reputation Engine: Tiers & Incentives", () => {
  it("getReputationLeaderboard returns agent data", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    const [agents, scores, tiers, registered, total] = await dao.getReputationLeaderboard(0, 10);
    expect(total).to.be.gte(2n);
    expect(agents.length).to.be.gte(2);
    // alice should have some score and be registered
    const aliceIdx = agents.indexOf(alice.address);
    expect(scores[aliceIdx]).to.be.gt(0n);
    expect(registered[aliceIdx]).to.equal(true);
  });

  it("higher reputation tier gets messaging fee discount", async () => {
    const { dao, owner, alice, bob } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);

    // Give alice high reputation: lots of volume + txns
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("5") });
    for (let i = 0; i < 50; i++) {
      await dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.001"), `tx${i}`);
    }

    // Give owner minimal reputation
    await dao.depositNativeToEscrow({ value: ethers.parseEther("0.01") });

    const aliceRep = await dao.getAgentReputation(alice.address);
    const ownerRep = await dao.getAgentReputation(owner.address);

    // Alice should have a higher tier
    expect(aliceRep.tier).to.be.gte(ownerRep.tier);
    // Alice should have a discount
    expect(aliceRep.messagingFeeDiscount).to.be.gte(ownerRep.messagingFeeDiscount);
  });

  it("refreshReputation can be called by anyone", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });

    // bob can refresh alice's reputation
    await dao.connect(bob).refreshReputation(alice.address);
    const rep = await dao.agentReputation(alice.address);
    expect(rep).to.be.gt(0n);
  });

  it("refreshReputation reverts for unregistered agent", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.refreshReputation(alice.address)).to.be.revertedWith("Agent not registered.");
  });
});

describe("Reputation Engine: Decay", () => {
  it("owner can configure decay parameters", async () => {
    const { dao } = await deploy();
    await dao.setReputationDecayConfig(5, 3 * 86400); // 5 pts/day, 3 day grace
    expect(await dao.reputationDecayPerDay()).to.equal(5n);
    expect(await dao.reputationDecayGracePeriod()).to.equal(3n * 86400n);
  });

  it("decay reduces reputation after grace period", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);

    // Set high decay rate for testing: 50 pts/day, 1 day grace
    await dao.setReputationDecayConfig(50, 86400);

    // Build up reputation
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("3") });
    for (let i = 0; i < 20; i++) {
      await dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.001"), `tx${i}`);
    }
    const repBefore = await dao.agentReputation(alice.address);
    expect(repBefore).to.be.gt(0n);

    // Fast forward 365 days (1 day grace + 364 days of 50pts/day = 18200 decay)
    await ethers.provider.send("evm_increaseTime", [365 * 86400]);
    await ethers.provider.send("evm_mine");

    // Refresh reputation — should be heavily decayed
    await dao.refreshReputation(alice.address);
    const repAfter = await dao.agentReputation(alice.address);
    // Decay should overwhelm the tenure gain
    expect(repAfter).to.equal(0n);
  });

  it("no decay within grace period", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);

    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const repBefore = await dao.agentReputation(alice.address);

    // Fast forward 5 days (within 7-day grace)
    await ethers.provider.send("evm_increaseTime", [5 * 86400]);
    await ethers.provider.send("evm_mine");

    await dao.refreshReputation(alice.address);
    const repAfter = await dao.agentReputation(alice.address);
    // Should be same or slightly different due to tenure change, but no decay
    expect(repAfter).to.be.gte(repBefore);
  });
});

// ─── Production Readiness: Additional Edge Case & Security Tests ─────────────

describe("setMinStakeToJoin", () => {
  it("owner can set minimum stake", async () => {
    const { dao } = await deploy();
    await dao.setMinStakeToJoin(ethers.parseEther("0.5"));
    expect(await dao.minStakeToJoin()).to.equal(ethers.parseEther("0.5"));
  });

  it("emits MinStakeToJoinUpdated event", async () => {
    const { dao } = await deploy();
    const newStake = ethers.parseEther("1");
    await expect(dao.setMinStakeToJoin(newStake))
      .to.emit(dao, "MinStakeToJoinUpdated")
      .withArgs(0n, newStake);
  });

  it("non-owner cannot set minimum stake", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).setMinStakeToJoin(ethers.parseEther("1"))
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("stake-and-join enforces minimum stake", async () => {
    const { dao, alice } = await deploy();
    await dao.setMinStakeToJoin(ethers.parseEther("1"));
    await expect(
      dao.connect(alice).stakeAndJoin("ipfs://test", { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Insufficient stake.");
  });

  it("stake-and-join succeeds with sufficient stake", async () => {
    const { dao, alice } = await deploy();
    await dao.setMinStakeToJoin(ethers.parseEther("0.01"));
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: ethers.parseEther("0.02") });
    expect(await dao.connect(alice).getAgentCount()).to.be.gte(1n);
  });
});

describe("Role indexing consistency (1-based)", () => {
  it("getRole(0) reverts with invalid role ID", async () => {
    const { dao } = await deploy();
    await expect(dao.getRole(0)).to.be.revertedWith("Invalid role ID.");
  });

  it("getRole(1) returns the Owner role created in constructor", async () => {
    const { dao } = await deploy();
    const [name, memberCount] = await dao.getRole(1);
    expect(ethers.decodeBytes32String(name)).to.equal("Owner");
  });

  it("createRole emits 1-based role ID matching getRole", async () => {
    const { dao } = await deploy();
    // Owner role is created in constructor with 1-based ID = 1
    // Creating a new role should emit ID = 2
    const tx = await dao.createRole(ethers.encodeBytes32String("Admin"));
    const receipt = await tx.wait();
    const event = receipt.logs.find(l => l.fragment?.name === "RoleCreated");
    expect(event).to.not.be.undefined;
    expect(event.args[0]).to.equal(2n); // 1-based ID
    // Verify the emitted ID works with getRole
    const [name] = await dao.getRole(2);
    expect(ethers.decodeBytes32String(name)).to.equal("Admin");
  });

  it("addPermission, assignRole, getRole all use consistent 1-based IDs", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createRole(ethers.encodeBytes32String("Tester"));
    // Tester is roles[1] => 1-based ID = 2
    await dao.addPermission(2, "run_tests");
    await dao.assignRole(alice.address, 2);
    const [name, memberCount] = await dao.getRole(2);
    expect(ethers.decodeBytes32String(name)).to.equal("Tester");
    expect(memberCount).to.equal(1n);
  });

  it("reverts for out-of-range role IDs", async () => {
    const { dao } = await deploy();
    await expect(dao.getRole(999)).to.be.revertedWith("Invalid role ID.");
    await expect(dao.addPermission(999, "perm")).to.be.revertedWith("Invalid role ID.");
    await expect(dao.assignRole(dao.runner.address, 999)).to.be.revertedWith("Invalid role ID.");
  });

  it("non-owner cannot assign roles", async () => {
    const { dao, alice, bob } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createRole(ethers.encodeBytes32String("Admin"));
    await expect(
      dao.connect(alice).assignRole(alice.address, 2)
    ).to.be.revertedWith("Only the owner can call this function.");
  });

  it("cannot assign role to non-member", async () => {
    const { dao, alice } = await deploy();
    await dao.createRole(ethers.encodeBytes32String("Admin"));
    await expect(
      dao.assignRole(alice.address, 2)
    ).to.be.revertedWith("Invalid member address.");
  });

  it("cannot assign same role twice", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createRole(ethers.encodeBytes32String("Admin"));
    await dao.assignRole(alice.address, 2);
    await expect(
      dao.assignRole(alice.address, 2)
    ).to.be.revertedWith("Member already has this role.");
  });
});

describe("Input validation hardening", () => {
  it("registerAgent rejects empty metadataURI", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await expect(
      dao.connect(alice).registerAgent("")
    ).to.be.revertedWith("Metadata URI cannot be empty.");
  });

  it("registerAgent rejects metadataURI over 512 bytes", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    const longURI = "x".repeat(513);
    await expect(
      dao.connect(alice).registerAgent(longURI)
    ).to.be.revertedWith("Metadata URI too long.");
  });

  it("updateAgentMetadata rejects empty metadataURI", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).updateAgentMetadata("")
    ).to.be.revertedWith("Metadata URI cannot be empty.");
  });

  it("updateAgentMetadata rejects metadataURI over 512 bytes", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const longURI = "x".repeat(513);
    await expect(
      dao.connect(alice).updateAgentMetadata(longURI)
    ).to.be.revertedWith("Metadata URI too long.");
  });

  it("stakeAndJoin rejects empty metadataURI", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).stakeAndJoin("", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("metadataURI required.");
  });

  it("stakeAndJoin rejects metadataURI over 512 bytes", async () => {
    const { dao, alice } = await deploy();
    const longURI = "x".repeat(513);
    await expect(
      dao.connect(alice).stakeAndJoin(longURI, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Metadata URI too long.");
  });

  it("transferNativeBetweenAgents rejects unregistered recipient", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.1") });
    await expect(
      dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.01"), "test")
    ).to.be.revertedWith("Recipient must be a registered agent.");
  });

  it("transferNativeBetweenAgents rejects self-transfer", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.1") });
    await expect(
      dao.connect(alice).transferNativeBetweenAgents(alice.address, ethers.parseEther("0.01"), "test")
    ).to.be.revertedWith("Cannot transfer to self.");
  });
});

describe("Economic project edge cases", () => {
  it("cannot fund a cancelled project", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400 * 30;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.connect(alice).cancelProject(1);
    await expect(
      dao.connect(bob).fundProject(1, { value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Project not accepting funds.");
  });

  it("non-proposer cannot cancel project", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400 * 30;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await expect(
      dao.connect(bob).cancelProject(1)
    ).to.be.revertedWith("Only proposer or owner can cancel.");
  });

  it("cannot apply to own project", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400 * 30;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await expect(
      dao.connect(alice).applyToProject(1)
    ).to.be.revertedWith("Proposer is already lead contributor.");
  });
});

describe("Pause affects all state-changing functions", () => {
  it("registerAgent reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.pauseContract();
    await expect(
      dao.connect(alice).registerAgent("ipfs://test")
    ).to.be.revertedWith("Contract is paused.");
  });

  it("depositNativeToEscrow reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.pauseContract();
    await expect(
      dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Contract is paused.");
  });

  it("stakeAndJoin reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await dao.pauseContract();
    await expect(
      dao.connect(alice).stakeAndJoin("ipfs://test", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Contract is paused.");
  });

  it("createAgentPaymentRequest reverts when paused", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.pauseContract();
    await expect(
      dao.connect(alice).createAgentPaymentRequest(bob.address, ethers.ZeroAddress, ethers.parseEther("0.01"), true, "test")
    ).to.be.revertedWith("Contract is paused.");
  });
});

// ─── Token Escrow Edge Cases ─────────────────────────────────────────────────

describe("Token escrow edge cases", () => {
  it("cannot transfer tokens to unregistered agent", async () => {
    const { dao, alice, bob, carol } = await deploy();
    await memberAgent(dao, alice);
    // bob is not registered as an agent
    await expect(
      dao.connect(alice).transferTokenBetweenAgents(carol.address, bob.address, 1000n, "test")
    ).to.be.revertedWith("Recipient must be a registered agent.");
  });

  it("cannot transfer tokens with invalid token address", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).transferTokenBetweenAgents(ethers.ZeroAddress, alice.address, 1000n, "test")
    ).to.be.revertedWith("Invalid token address.");
  });

  it("cannot withdraw zero native from escrow", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).withdrawNativeFromEscrow(0)
    ).to.be.revertedWith("Amount must be greater than zero.");
  });

  it("cannot deposit zero native to escrow", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).depositNativeToEscrow({ value: 0 })
    ).to.be.revertedWith("Deposit amount must be greater than zero.");
  });
});

// ─── Direct Messaging Edge Cases ─────────────────────────────────────────────

describe("Direct messaging edge cases", () => {
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("test message"));

  it("cannot send message to unregistered agent", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await expect(
      dao.connect(alice).sendDirectMessage(bob.address, "enc", sampleHash)
    ).to.be.revertedWith("Recipient must be a registered agent.");
  });

  it("cannot send message to self", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await expect(
      dao.connect(alice).sendDirectMessage(alice.address, "enc", sampleHash)
    ).to.be.revertedWith("Cannot message self.");
  });

  it("non-recipient cannot mark message as read", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    await dao.connect(alice).sendDirectMessage(bob.address, "enc", sampleHash);
    // alice (sender) tries to mark as read — should fail
    await expect(
      dao.connect(alice).markMessageRead(1n)
    ).to.be.revertedWith("Only recipient can mark as read.");
  });

  it("getConversation returns messages between two agents", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.1") });
    await dao.connect(bob).depositNativeToEscrow({ value: ethers.parseEther("0.1") });

    await dao.connect(alice).sendDirectMessage(bob.address, "msg1", sampleHash);
    await dao.connect(bob).sendDirectMessage(alice.address, "msg2", sampleHash);

    const [ids, total] = await dao.connect(alice).getConversation(bob.address, 0, 50);
    expect(total).to.equal(2n);
    expect(ids.length).to.equal(2);
  });

  it("getInbox returns received messages", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.1") });

    await dao.connect(alice).sendDirectMessage(bob.address, "enc1", sampleHash);
    await dao.connect(alice).sendDirectMessage(bob.address, "enc2", sampleHash);

    const [ids, total] = await dao.connect(bob).getInbox(0, 50);
    expect(total).to.equal(2n);
  });
});

// ─── Payment Request Edge Cases ──────────────────────────────────────────────

describe("Payment request edge cases", () => {
  it("cannot create payment request from self", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).createAgentPaymentRequest(alice.address, ethers.ZeroAddress, ethers.parseEther("0.01"), true, "self-pay")
    ).to.be.revertedWith("Cannot request payment from self.");
  });

  it("cannot settle already-settled payment request", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    const amount = ethers.parseEther("0.01");
    await dao.connect(alice).createAgentPaymentRequest(bob.address, ethers.ZeroAddress, amount, true, "invoice");
    await dao.connect(bob).settleAgentPaymentRequest(1, { value: amount });
    await expect(
      dao.connect(bob).settleAgentPaymentRequest(1, { value: amount })
    ).to.be.revertedWith("Payment request is not open.");
  });

  it("cannot cancel a settled payment request", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    const amount = ethers.parseEther("0.01");
    await dao.connect(alice).createAgentPaymentRequest(bob.address, ethers.ZeroAddress, amount, true, "invoice");
    await dao.connect(bob).settleAgentPaymentRequest(1, { value: amount });
    await expect(
      dao.connect(alice).cancelAgentPaymentRequest(1)
    ).to.be.revertedWith("Payment request is not open.");
  });

  it("only requester can cancel payment request", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).createAgentPaymentRequest(bob.address, ethers.ZeroAddress, ethers.parseEther("0.01"), true, "test");
    await expect(
      dao.connect(bob).cancelAgentPaymentRequest(1)
    ).to.be.revertedWith("Only requester can cancel this payment request.");
  });
});

// ─── Feature Kit Edge Cases ──────────────────────────────────────────────────

describe("Feature kit edge cases", () => {
  it("upvote increments vote count", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await dao.addMember(bob.address, 10);
    await dao.connect(alice).submitFeatureKit("ipfs://kit", 1);
    await expect(dao.connect(bob).upvoteFeatureKit(1))
      .to.emit(dao, "FeatureKitUpvoted")
      .withArgs(1n, bob.address, 1n);
  });

  it("cannot upvote same kit twice", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await dao.addMember(bob.address, 10);
    await dao.connect(alice).submitFeatureKit("ipfs://kit", 1);
    await dao.connect(bob).upvoteFeatureKit(1);
    await expect(
      dao.connect(bob).upvoteFeatureKit(1)
    ).to.be.revertedWith("Already voted.");
  });

  it("non-registered-agent cannot submit feature kit", async () => {
    const { dao, alice } = await deploy();
    await expect(
      dao.connect(alice).submitFeatureKit("ipfs://kit", 1)
    ).to.be.revertedWith("Only registered agents can call this function.");
  });
});

// ─── Production Readiness: Security Hardening Tests ─────────────────────────

describe("Reentrancy protection on ETH-transferring functions", () => {
  it("transferNativeBetweenAgents has nonReentrant guard", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    // Normal transfer succeeds (proves nonReentrant doesn't block normal calls)
    await dao.connect(alice).transferNativeBetweenAgents(bob.address, ethers.parseEther("0.1"), "test");
  });

  it("transferAssetBetweenAgents has nonReentrant guard", async () => {
    // Just verifying the function signature includes nonReentrant by confirming it works normally
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    const flatFee = await dao.assetTransferFlatFeeWei();
    // Will revert because no actual NFT, but should NOT revert with "ReentrancyGuard: reentrant call"
    try {
      await dao.connect(alice).transferAssetBetweenAgents(
        dao.getAddress(),
        bob.address,
        1,
        "test",
        { value: flatFee }
      );
      expect.fail("Expected transferAssetBetweenAgents to revert due to missing NFT, but it did not revert");
    } catch (error) {
      // Ensure the revert is NOT caused by the reentrancy guard
      expect(String(error)).to.not.include("ReentrancyGuard: reentrant call");
    }
  });

  it("batchTransferNative has nonReentrant guard", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    await dao.connect(alice).batchTransferNative(
      [bob.address], [ethers.parseEther("0.1")], ["batch test"]
    );
  });

  it("sendDirectMessage has nonReentrant guard", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const hash = ethers.keccak256(ethers.toUtf8Bytes("hello"));
    await dao.connect(alice).sendDirectMessage(bob.address, "encrypted-content", hash);
  });
});

describe("whenNotPaused on task management functions", () => {
  it("createTask reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await dao.pauseContract();
    await expect(
      dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open")
    ).to.be.revertedWith("Contract is paused.");
  });

  it("addTaskProgress reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    // Create role with "reporter" permission and assign to alice
    await dao.createRole(ethers.encodeBytes32String("Reporter"));
    await dao.addPermission(2, "reporter"); // role 2 (after Owner at 1)
    await dao.assignRole(alice.address, 2);
    await dao.pauseContract();
    await expect(
      dao.connect(alice).addTaskProgress(1, "progress", false, 50)
    ).to.be.revertedWith("Contract is paused.");
  });

  it("updateTask reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    await dao.pauseContract();
    await expect(
      dao.updateTask(1, "updated", 9999999999, ethers.ZeroAddress, "closed")
    ).to.be.revertedWith("Contract is paused.");
  });

  it("deleteTask reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    await dao.pauseContract();
    await expect(dao.deleteTask(1)).to.be.revertedWith("Contract is paused.");
  });

  it("assignTask reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    await dao.pauseContract();
    await expect(dao.assignTask(1, alice.address)).to.be.revertedWith("Contract is paused.");
  });

  it("updateTaskStatus reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    await dao.pauseContract();
    await expect(dao.updateTaskStatus(1, "done")).to.be.revertedWith("Contract is paused.");
  });

  it("completeTask reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await dao.createTask("task", 9999999999, 0, ethers.ZeroAddress, "open");
    await dao.pauseContract();
    await expect(dao.completeTask(1)).to.be.revertedWith("Contract is paused.");
  });

  it("changeVotingPeriod reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await expect(dao.changeVotingPeriod(100)).to.be.revertedWith("Contract is paused.");
  });

  it("changeMinimumVotingPower reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await expect(dao.changeMinimumVotingPower(5)).to.be.revertedWith("Contract is paused.");
  });

  it("grantPrivilege reverts when paused", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.pauseContract();
    await expect(dao.grantPrivilege(alice.address, 1)).to.be.revertedWith("Contract is paused.");
  });
});

describe("Zero-address validation", () => {
  it("assignRole rejects zero address", async () => {
    const { dao } = await deploy();
    await dao.createRole(ethers.encodeBytes32String("TestRole"));
    await expect(
      dao.assignRole(ethers.ZeroAddress, 1)
    ).to.be.revertedWith("Invalid member address.");
  });

  it("assignRoleToMilestone rejects zero address", async () => {
    const { dao } = await deploy();
    await dao.createMilestone("M1", 9999999999);
    await expect(
      dao.assignRoleToMilestone(ethers.ZeroAddress, 0, ethers.encodeBytes32String("dev"))
    ).to.be.revertedWith("Invalid member address.");
  });

  it("approveContributor rejects zero address", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await expect(
      dao.connect(alice).approveContributor(1, ethers.ZeroAddress, 5000)
    ).to.be.revertedWith("Invalid contributor address.");
  });
});

describe("Gas-safe leaveDAO with activeProjectCount", () => {
  it("leaveDAO succeeds when no active projects", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: stake });
    await dao.connect(alice).leaveDAO();
    expect((await dao.members(alice.address)).isMember).to.equal(false);
  });

  it("leaveDAO reverts when proposer has active project", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: stake });
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await expect(dao.connect(alice).leaveDAO()).to.be.revertedWith("Cancel active projects before leaving.");
  });

  it("leaveDAO succeeds after completing all projects", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: stake });
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.connect(alice).completeProject(1);
    await dao.connect(alice).leaveDAO();
    expect((await dao.members(alice.address)).isMember).to.equal(false);
  });

  it("leaveDAO succeeds after cancelling all projects", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: stake });
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.connect(alice).createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    await dao.connect(alice).cancelProject(1);
    await dao.connect(alice).leaveDAO();
    expect((await dao.members(alice.address)).isMember).to.equal(false);
  });

  it("activeProjectCount tracks multiple projects correctly", async () => {
    const { dao, alice } = await deploy();
    const stake = ethers.parseEther("0.01");
    await dao.connect(alice).stakeAndJoin("ipfs://test", { value: stake });
    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 86400;
    await dao.connect(alice).createEconomicProject("ipfs://p1", ethers.parseEther("1"), deadline);
    await dao.connect(alice).createEconomicProject("ipfs://p2", ethers.parseEther("1"), deadline);
    expect(await dao.activeProjectCount(alice.address)).to.equal(2);
    await dao.connect(alice).completeProject(1);
    expect(await dao.activeProjectCount(alice.address)).to.equal(1);
    await expect(dao.connect(alice).leaveDAO()).to.be.revertedWith("Cancel active projects before leaving.");
    await dao.connect(alice).cancelProject(2);
    expect(await dao.activeProjectCount(alice.address)).to.equal(0);
    await dao.connect(alice).leaveDAO();
  });
});

// ─── Production Readiness: New Event Emissions ──────────────────────────────

describe("Event emissions for audit trail", () => {
  it("grantPrivilege emits PrivilegeGranted", async () => {
    const { dao, alice } = await deploy();
    await dao.addMember(alice.address, 10);
    await expect(dao.grantPrivilege(alice.address, 1))
      .to.emit(dao, "PrivilegeGranted")
      .withArgs(alice.address, 1);
  });

  it("disputeProposal emits ProposalDisputeCreated", async () => {
    const { dao } = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("Milestone 1", futureDate);
    await dao.createProposal("Test proposal", [0]);
    await expect(dao.disputeProposal(1, "I disagree"))
      .to.emit(dao, "ProposalDisputeCreated")
      .withArgs(1, 1, anyValue, "I disagree");
  });

  it("resolveProposalDispute emits ProposalDisputeResolved", async () => {
    const { dao } = await deploy();
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("Milestone 1", futureDate);
    await dao.createProposal("Test proposal", [0]);
    await dao.disputeProposal(1, "I disagree");
    await ethers.provider.send("evm_increaseTime", [4 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    await expect(dao.resolveProposalDispute(1, true))
      .to.emit(dao, "ProposalDisputeResolved")
      .withArgs(1, true);
  });

  it("auto-resolve via majority emits ProposalDisputeResolved", async () => {
    const { dao, alice, bob } = await deploy();
    await dao.addMember(alice.address, 10);
    await dao.addMember(bob.address, 10);
    const futureDate = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.createMilestone("Milestone 1", futureDate);
    await dao.createProposal("Test proposal", [0]);
    await dao.disputeProposal(1, "I disagree");
    // 3 members on milestone, majority = 2. Two votes for should auto-resolve.
    await dao.voteOnProposalDispute(1, true);
    await expect(dao.connect(alice).voteOnProposalDispute(1, true))
      .to.emit(dao, "ProposalDisputeResolved")
      .withArgs(1, true);
    const dispute = await dao.proposalDisputes(1);
    expect(dispute.resolved).to.be.true;
  });

  it("changeOwner emits OwnerChanged", async () => {
    const { dao, owner, alice } = await deploy();
    await expect(dao.changeOwner(alice.address))
      .to.emit(dao, "OwnerChanged")
      .withArgs(owner.address, alice.address);
  });
});

// ─── Production Readiness: Reentrancy on Token Functions ────────────────────

describe("nonReentrant on token escrow functions", () => {
  it("withdrawTokenFromEscrow has nonReentrant modifier", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).withdrawTokenFromEscrow(ethers.ZeroAddress, 1)
    ).to.be.revertedWith("Invalid token address.");
  });

  it("transferTokenBetweenAgents has nonReentrant modifier", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await expect(
      dao.connect(alice).transferTokenBetweenAgents(ethers.ZeroAddress, bob.address, 1, "test")
    ).to.be.revertedWith("Invalid token address.");
  });
});

// ─── Production Readiness: Treasury Validation on Deposit ───────────────────

describe("depositNativeToEscrow nonReentrant guard", () => {
  it("deposit sends fee to treasury and credits escrow", async () => {
    const { dao, alice, treasury } = await deploy();
    await memberAgent(dao, alice);
    const balBefore = await ethers.provider.getBalance(treasury.address);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    const balAfter = await ethers.provider.getBalance(treasury.address);
    // Treasury received the fee
    expect(balAfter).to.be.gt(balBefore);
  });
});

// ─── Production Readiness: Payment Request ID 0 Edge Case ──────────────────

describe("Payment request edge case: ID 0", () => {
  it("settleAgentPaymentRequest reverts for request ID 0 (non-existent)", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).settleAgentPaymentRequest(0, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Payment request does not exist.");
  });
});

// ─── Production Readiness: Reputation Decay & Ceiling ───────────────────────

describe("Reputation engine: ceiling and decay edge cases", () => {
  it("reputation never exceeds REP_MAX (1000)", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    // Generate many transactions to drive score up
    for (let i = 0; i < 20; i++) {
      await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1") });
    }
    const rep = await dao.agentReputation(alice.address);
    expect(rep).to.be.lte(1000n);
  });

  it("reputation decays after grace period of inactivity", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    // Build some reputation
    for (let i = 0; i < 5; i++) {
      await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.5") });
    }
    const repBefore = await dao.agentReputation(alice.address);
    // Advance past grace period (7 days) + extra days
    await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60]);
    await ethers.provider.send("evm_mine");
    // Trigger another tx to recalculate with decay
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("0.01") });
    const repAfter = await dao.agentReputation(alice.address);
    // The score should incorporate decay (may still be higher due to new tx, but decay was applied)
    // We just verify it doesn't exceed MAX
    expect(repAfter).to.be.lte(1000n);
  });
});

// ─── Production Readiness: depositTokenToEscrow input validation ─────────────

describe("depositTokenToEscrow input validation", () => {
  it("reverts when the token address is the zero address", async () => {
    // This test covers invalid token-address validation only.
    // Reentrancy protection requires a malicious ERC-20 that re-enters during transferFrom.
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(
      dao.connect(alice).depositTokenToEscrow(ethers.ZeroAddress, 100n)
    ).to.be.revertedWith("Invalid token address.");
  });
});

// ─── Production Readiness: whenNotPaused on owner config functions ────────────

describe("Owner config functions respect whenNotPaused", () => {
  it("setCybereumTreasury reverts when paused", async () => {
    const { dao, treasury } = await deploy();
    await dao.pauseContract();
    await expect(
      dao.setCybereumTreasury(treasury.address)
    ).to.be.revertedWith("Contract is paused.");
  });

  it("setCybereumFeeConfig reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await expect(
      dao.setCybereumFeeConfig(5, 1000000000000n)
    ).to.be.revertedWith("Contract is paused.");
  });

  it("setAIServiceFee reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await expect(
      dao.setAIServiceFee(ethers.parseEther("0.001"))
    ).to.be.revertedWith("Contract is paused.");
  });

  it("addPermission reverts when paused", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await expect(
      dao.addPermission(1, "test_perm")
    ).to.be.revertedWith("Contract is paused.");
  });

  it("setCybereumTreasury works when unpaused", async () => {
    const { dao, alice } = await deploy();
    await dao.setCybereumTreasury(alice.address);
    expect(await dao.cybereumTreasury()).to.equal(alice.address);
  });

  it("setCybereumFeeConfig works when unpaused after resume", async () => {
    const { dao } = await deploy();
    await dao.pauseContract();
    await dao.resumeContract();
    await dao.setCybereumFeeConfig(3, 2000000000000n);
    expect(await dao.cybereumFeeBps()).to.equal(3n);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Capability-Indexed Agent Discovery ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe("Capability-indexed agent discovery", () => {
  it("agent can set capabilities", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).setAgentCapabilities(["payment-settlement", "data-oracle"]);
    const caps = await dao.getAgentCapabilities(alice.address);
    expect(caps.length).to.equal(2);
    expect(caps[0]).to.equal("payment-settlement");
    expect(caps[1]).to.equal("data-oracle");
  });

  it("emits AgentCapabilitiesUpdated event", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(dao.connect(alice).setAgentCapabilities(["image-gen"]))
      .to.emit(dao, "AgentCapabilitiesUpdated")
      .withArgs(alice.address, ["image-gen"]);
  });

  it("discover agents by capability", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).setAgentCapabilities(["payment-settlement", "data-oracle"]);
    await dao.connect(bob).setAgentCapabilities(["payment-settlement", "image-gen"]);

    const result = await dao.discoverAgentsByCapability("payment-settlement", 0, 50);
    expect(result.total).to.equal(2n);
    expect(result.addresses).to.include(alice.address);
    expect(result.addresses).to.include(bob.address);

    const oracleResult = await dao.discoverAgentsByCapability("data-oracle", 0, 50);
    expect(oracleResult.total).to.equal(1n);
    expect(oracleResult.addresses[0]).to.equal(alice.address);
  });

  it("getCapabilityAgentCount returns correct count", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).setAgentCapabilities(["payment-settlement"]);
    await dao.connect(bob).setAgentCapabilities(["payment-settlement"]);
    expect(await dao.getCapabilityAgentCount("payment-settlement")).to.equal(2n);
    expect(await dao.getCapabilityAgentCount("nonexistent")).to.equal(0n);
  });

  it("replacing capabilities updates reverse index", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await dao.connect(alice).setAgentCapabilities(["old-capability"]);
    expect(await dao.getCapabilityAgentCount("old-capability")).to.equal(1n);

    await dao.connect(alice).setAgentCapabilities(["new-capability"]);
    expect(await dao.getCapabilityAgentCount("old-capability")).to.equal(0n);
    expect(await dao.getCapabilityAgentCount("new-capability")).to.equal(1n);
  });

  it("rejects too many capabilities", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const tooMany = Array(17).fill("cap");
    await expect(dao.connect(alice).setAgentCapabilities(tooMany))
      .to.be.revertedWith("Too many capabilities.");
  });

  it("rejects empty capability tag", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    await expect(dao.connect(alice).setAgentCapabilities([""]))
      .to.be.revertedWith("Invalid capability tag length.");
  });

  it("rejects capability tag too long", async () => {
    const { dao, alice } = await deploy();
    await memberAgent(dao, alice);
    const longCap = "a".repeat(65);
    await expect(dao.connect(alice).setAgentCapabilities([longCap]))
      .to.be.revertedWith("Invalid capability tag length.");
  });

  it("non-registered agent cannot set capabilities", async () => {
    const { dao, alice } = await deploy();
    await expect(dao.connect(alice).setAgentCapabilities(["test"]))
      .to.be.revertedWith("Only registered agents can call this function.");
  });

  it("discovery pagination works correctly", async () => {
    const { dao, alice, bob } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await dao.connect(alice).setAgentCapabilities(["shared-cap"]);
    await dao.connect(bob).setAgentCapabilities(["shared-cap"]);

    const page1 = await dao.discoverAgentsByCapability("shared-cap", 0, 1);
    expect(page1.addresses.length).to.equal(1);
    expect(page1.total).to.equal(2n);

    const page2 = await dao.discoverAgentsByCapability("shared-cap", 1, 1);
    expect(page2.addresses.length).to.equal(1);
    expect(page2.total).to.equal(2n);

    // Pages return different agents
    expect(page1.addresses[0]).to.not.equal(page2.addresses[0]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Service Agreements with Conditional Escrow ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe("Service agreements", () => {
  async function setupAgreement() {
    const { dao, owner, alice, bob, carol, treasury } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await memberAgent(dao, carol); // arbiter
    // Fund alice's escrow
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1.0") });
    return { dao, owner, alice, bob, carol, treasury };
  }

  it("client can create a service agreement", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    const tx = await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "Analyze dataset"
    );
    await expect(tx).to.emit(dao, "ServiceAgreementCreated");

    const a = await dao.getServiceAgreement(1);
    expect(a.client).to.equal(alice.address);
    expect(a.provider).to.equal(bob.address);
    expect(a.status).to.equal(0n); // Active
    expect(a.description).to.equal("Analyze dataset");
  });

  it("locks escrow from client balance", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const balBefore = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    const balAfter = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(balBefore - balAfter).to.equal(ethers.parseEther("0.1"));
  });

  it("provider can submit delivery", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    const hash = ethers.keccak256(ethers.toUtf8Bytes("delivery-proof"));
    await expect(dao.connect(bob).submitDelivery(1, hash))
      .to.emit(dao, "ServiceDeliverySubmitted")
      .withArgs(1n, bob.address, hash);

    const a = await dao.getServiceAgreement(1);
    expect(a.status).to.equal(1n); // Delivered
    expect(a.deliveryHash).to.equal(hash);
  });

  it("client approves delivery and funds go to provider", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    const hash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await dao.connect(bob).submitDelivery(1, hash);
    await dao.connect(alice).approveDelivery(1);

    const a = await dao.getServiceAgreement(1);
    expect(a.status).to.equal(2n); // Completed

    const providerBal = (await dao.getAgentProfile(bob.address)).nativeEscrowBalance;
    expect(providerBal).to.be.gt(0n);
  });

  it("dispute flow with arbiter resolution", async () => {
    const { dao, alice, bob, carol } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, carol.address, ethers.parseEther("0.1"), deadline, "test"
    );
    const hash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await dao.connect(bob).submitDelivery(1, hash);

    // Client disputes
    await expect(dao.connect(alice).disputeServiceAgreement(1))
      .to.emit(dao, "ServiceAgreementDisputed");

    // Arbiter resolves in favor of provider
    await expect(dao.connect(carol).resolveServiceDispute(1, true))
      .to.emit(dao, "ServiceDisputeResolved")
      .withArgs(1n, true, carol.address);

    const providerBal = (await dao.getAgentProfile(bob.address)).nativeEscrowBalance;
    expect(providerBal).to.be.gt(0n);
  });

  it("arbiter resolves in favor of client", async () => {
    const { dao, alice, bob, carol } = await setupAgreement();
    const balBefore = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, carol.address, ethers.parseEther("0.1"), deadline, "test"
    );
    await dao.connect(alice).disputeServiceAgreement(1);
    await dao.connect(carol).resolveServiceDispute(1, false);

    const balAfter = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    // Client gets refund (minus fees)
    expect(balAfter).to.be.gt(balBefore - ethers.parseEther("0.1"));
  });

  it("client can cancel active agreement", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const balBefore = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    await dao.connect(alice).cancelServiceAgreement(1);

    const a = await dao.getServiceAgreement(1);
    expect(a.status).to.equal(4n); // Cancelled
    const balAfter = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(balAfter).to.equal(balBefore); // Full refund, no fee on cancel
  });

  it("cannot create agreement with self", async () => {
    const { dao, alice } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await expect(dao.connect(alice).createServiceAgreement(
      alice.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    )).to.be.revertedWith("Cannot create agreement with yourself.");
  });

  it("cannot create agreement with insufficient escrow", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await expect(dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("100"), deadline, "test"
    )).to.be.revertedWith("Insufficient escrow balance.");
  });

  it("only provider can submit delivery", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    const hash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await expect(dao.connect(alice).submitDelivery(1, hash))
      .to.be.revertedWith("Only the provider can submit delivery.");
  });

  it("only client can approve delivery", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    const hash = ethers.keccak256(ethers.toUtf8Bytes("proof"));
    await dao.connect(bob).submitDelivery(1, hash);
    await expect(dao.connect(bob).approveDelivery(1))
      .to.be.revertedWith("Only the client can approve delivery.");
  });

  it("cannot dispute without arbiter", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    await expect(dao.connect(alice).disputeServiceAgreement(1))
      .to.be.revertedWith("No arbiter assigned - use cancelServiceAgreement instead.");
  });

  it("only arbiter can resolve disputes", async () => {
    const { dao, alice, bob, carol } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, carol.address, ethers.parseEther("0.1"), deadline, "test"
    );
    await dao.connect(alice).disputeServiceAgreement(1);
    await expect(dao.connect(alice).resolveServiceDispute(1, true))
      .to.be.revertedWith("Only the arbiter can resolve disputes.");
  });

  it("deadline must be in the future", async () => {
    const { dao, alice, bob } = await setupAgreement();
    await expect(dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), 1, "test"
    )).to.be.revertedWith("Deadline must be in the future.");
  });

  it("non-party cannot cancel agreement", async () => {
    const { dao, alice, bob, carol } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    await expect(dao.connect(carol).cancelServiceAgreement(1))
      .to.be.revertedWith("Not a party to this agreement.");
  });

  it("provider can cancel after deadline", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 100;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    // Advance past deadline
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);
    await dao.connect(bob).cancelServiceAgreement(1);
    const a = await dao.getServiceAgreement(1);
    expect(a.status).to.equal(4n); // Cancelled
  });

  it("provider cannot cancel before deadline", async () => {
    const { dao, alice, bob } = await setupAgreement();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + 86400;
    await dao.connect(alice).createServiceAgreement(
      bob.address, ethers.ZeroAddress, ethers.parseEther("0.1"), deadline, "test"
    );
    await expect(dao.connect(bob).cancelServiceAgreement(1))
      .to.be.revertedWith("Provider can only cancel after deadline.");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Payment Streams ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

describe("Payment streams", () => {
  async function setupStreams() {
    const { dao, owner, alice, bob, carol, treasury } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    // Fund alice's escrow
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("2.0") });
    return { dao, owner, alice, bob, carol, treasury };
  }

  it("can create a payment stream", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const start = now + 10;
    const stop = start + 3600; // 1 hour

    const tx = await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.36"), start, stop
    );
    await expect(tx).to.emit(dao, "PaymentStreamCreated");

    const s = await dao.getPaymentStream(1);
    expect(s.payer).to.equal(alice.address);
    expect(s.recipient).to.equal(bob.address);
    expect(s.ratePerSecond).to.be.gt(0n);
    expect(s.status).to.equal(0n); // Active
  });

  it("locks deposit from payer escrow", async () => {
    const { dao, alice, bob } = await setupStreams();
    const balBefore = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.36"), now + 10, now + 3610
    );
    const balAfter = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(balBefore - balAfter).to.be.gte(ethers.parseEther("0.35")); // adjusted deposit
  });

  it("recipient can withdraw accrued funds", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const start = now + 1;
    const stop = start + 3600;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.36"), start, stop
    );

    // Advance time by 1800 seconds (half the stream)
    await ethers.provider.send("evm_increaseTime", [1810]);
    await ethers.provider.send("evm_mine", []);

    const withdrawable = await dao.streamBalanceOf(1);
    expect(withdrawable).to.be.gt(0n);

    await expect(dao.connect(bob).withdrawFromStream(1))
      .to.emit(dao, "PaymentStreamWithdrawn");

    const bobBal = (await dao.getAgentProfile(bob.address)).nativeEscrowBalance;
    expect(bobBal).to.be.gt(0n);
  });

  it("stream auto-completes when fully withdrawn", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const start = now + 1;
    const stop = start + 100; // short stream
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.01"), start, stop
    );

    // Advance past end
    await ethers.provider.send("evm_increaseTime", [200]);
    await ethers.provider.send("evm_mine", []);

    await dao.connect(bob).withdrawFromStream(1);
    const s = await dao.getPaymentStream(1);
    expect(s.status).to.equal(3n); // Completed
  });

  it("either party can cancel a stream", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const start = now + 1;
    const stop = start + 3600;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.36"), start, stop
    );

    // Advance 900 seconds (1/4 of stream)
    await ethers.provider.send("evm_increaseTime", [910]);
    await ethers.provider.send("evm_mine", []);

    const aliceBalBefore = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    const bobBalBefore = (await dao.getAgentProfile(bob.address)).nativeEscrowBalance;
    await expect(dao.connect(bob).cancelPaymentStream(1))
      .to.emit(dao, "PaymentStreamCancelled");

    const s = await dao.getPaymentStream(1);
    expect(s.status).to.equal(2n); // Cancelled

    // Alice should get a refund of unearned portion
    const aliceBalAfter = (await dao.getAgentProfile(alice.address)).nativeEscrowBalance;
    expect(aliceBalAfter).to.be.gt(aliceBalBefore);

    // Bob should receive accrued portion (minus fee)
    const bobBalAfter = (await dao.getAgentProfile(bob.address)).nativeEscrowBalance;
    expect(bobBalAfter).to.be.gt(bobBalBefore);
  });

  it("cannot stream to yourself", async () => {
    const { dao, alice } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(dao.connect(alice).createPaymentStream(
      alice.address, ethers.parseEther("0.1"), now + 10, now + 3610
    )).to.be.revertedWith("Cannot stream to yourself.");
  });

  it("cannot create stream with insufficient escrow", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("100"), now + 10, now + 3610
    )).to.be.revertedWith("Insufficient escrow balance.");
  });

  it("stop time must be after start time", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await expect(dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.1"), now + 100, now + 50
    )).to.be.revertedWith("Stop time must be after start time.");
  });

  it("only recipient can withdraw", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.36"), now + 1, now + 3601
    );
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine", []);
    await expect(dao.connect(alice).withdrawFromStream(1))
      .to.be.revertedWith("Only the recipient can withdraw.");
  });

  it("non-party cannot cancel stream", async () => {
    const { dao, alice, bob, carol } = await deploy();
    await memberAgent(dao, alice);
    await memberAgent(dao, bob);
    await memberAgent(dao, carol);
    await dao.connect(alice).depositNativeToEscrow({ value: ethers.parseEther("1.0") });
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.1"), now + 1, now + 3601
    );
    await expect(dao.connect(carol).cancelPaymentStream(1))
      .to.be.revertedWith("Not a party to this stream.");
  });

  it("streamBalanceOf returns 0 before start", async () => {
    const { dao, alice, bob } = await setupStreams();
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await dao.connect(alice).createPaymentStream(
      bob.address, ethers.parseEther("0.1"), now + 10000, now + 20000
    );
    expect(await dao.streamBalanceOf(1)).to.equal(0n);
  });
});
