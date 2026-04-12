// scripts/transfer-ownership-to-safe.js
// Transfer Project_DAO ownership to a Gnosis Safe multisig.
//
// Usage:
//   SAFE_ADDRESS=0x... CONTRACT_ADDRESS=0x... npx hardhat run scripts/transfer-ownership-to-safe.js --network <network>
//   Add --confirm as a trailing arg to skip the interactive prompt.

const hre = require("hardhat");
const { ethers } = hre;
const readline = require("readline");

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!safeAddress) throw new Error("SAFE_ADDRESS env var is required.");
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS env var is required.");

  // Validate checksummed addresses
  let safeParsed, contractParsed;
  try { safeParsed = ethers.getAddress(safeAddress); } catch {
    throw new Error(`SAFE_ADDRESS is not a valid checksummed address: ${safeAddress}`);
  }
  try { contractParsed = ethers.getAddress(contractAddress); } catch {
    throw new Error(`CONTRACT_ADDRESS is not a valid checksummed address: ${contractAddress}`);
  }

  // Verify Safe is a contract, not an EOA
  const code = await ethers.provider.getCode(safeParsed);
  if (code === "0x") {
    throw new Error(`No contract code at SAFE_ADDRESS (${safeParsed}). Is this an EOA?`);
  }

  // Attach to deployed contract. Library linking is required by the factory
  // even for attach() — we use zero addresses since attach() only builds the
  // ABI interface; actual library addresses are baked into the on-chain bytecode.
  const libNames = ["PKILib", "TrustLib", "FeatureKitLib", "MessagingLib",
    "EconomicProjectLib", "ServiceAgreementLib", "PaymentStreamLib", "TimelockLib"];
  const libraries = Object.fromEntries(libNames.map(n => [n, ethers.ZeroAddress]));
  const Factory = await ethers.getContractFactory("Project_DAO", { libraries });
  const dao = Factory.attach(contractParsed);

  const [signer] = await ethers.getSigners();
  const currentOwner = await dao.owner();
  console.log("Contract:      ", contractParsed);
  console.log("Current owner: ", currentOwner);
  console.log("New owner (Safe):", safeParsed);
  console.log("Signer:        ", signer.address);

  if (currentOwner !== signer.address) {
    throw new Error(`Signer (${signer.address}) is not the current owner (${currentOwner}).`);
  }
  if (currentOwner === safeParsed) {
    throw new Error("Safe is already the owner.");
  }

  // Confirmation gate
  const autoConfirm = process.argv.includes("--confirm");
  if (!autoConfirm) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(r => rl.question("Transfer ownership? (yes/no): ", r));
    rl.close();
    if (answer.trim().toLowerCase() !== "yes") { console.log("Aborted."); return; }
  }

  console.log("Queuing ownership transfer (24h timelock)...");
  const queueTx = await dao.queueChangeOwner(safeParsed);
  await queueTx.wait();
  console.log("Ownership transfer queued. Must wait timelock delay before executing.");
  console.log("After the delay, run:");
  console.log(`  SAFE_ADDRESS=${safeParsed} npx hardhat run scripts/execute-ownership-transfer.js --network <network>`);
  console.log("\nOr execute manually:");
  console.log(`  await dao.executeChangeOwner("${safeParsed}")`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
