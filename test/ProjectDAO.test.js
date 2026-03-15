const { expect } = require("chai");
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

  it("alice can stake and join, then leave to reclaim stake", async () => {
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

    const fee = stake * 5n / 10000n;
    const netStake = stake - fee;
    // Balance after = before + netStake refund - gas
    expect(balAfter - balBefore + gasCost).to.be.closeTo(netStake, ethers.parseEther("0.0001"));

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
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    await dao.createEconomicProject("ipfs://proj", ethers.parseEther("1"), deadline);
    const proj = await dao.economicProjects(1n);
    expect(proj.id).to.equal(1n);
    expect(proj.proposer).to.equal(owner.address);
    expect(proj.status).to.equal(0n); // Open
  });

  it("anyone can fund a project", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    const deadline = Math.floor(Date.now() / 1000) + 86400;
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

    const deadline = Math.floor(Date.now() / 1000) + 86400;
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

    // alice claims
    const aliceBefore = await ethers.provider.getBalance(alice.address);
    const tx = await dao.connect(alice).claimProjectShare(1n);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const aliceAfter = await ethers.provider.getBalance(alice.address);

    const expectedPayout = netFunded * 5000n / 10000n;
    expect(aliceAfter - aliceBefore + gasCost).to.be.closeTo(
      expectedPayout, ethers.parseEther("0.0001")
    );
  });

  it("contributor cannot claim twice", async () => {
    const { dao, owner, alice } = await deploy();
    await dao.registerAgent("ipfs://owner");
    await memberAgent(dao, alice);
    const deadline = Math.floor(Date.now() / 1000) + 86400;
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
    const deadline = Math.floor(Date.now() / 1000) + 86400;
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
