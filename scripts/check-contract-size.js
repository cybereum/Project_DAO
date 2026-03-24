const hre = require("hardhat");

const EIP170_RUNTIME_LIMIT_BYTES = 24_576;
const TARGET = (process.env.CONTRACT_SIZE_TARGET || "l2").toLowerCase();
const SHOULD_FAIL = process.env.STRICT_CONTRACT_SIZE === "true" || TARGET === "l1";

async function main() {
  const artifact = await hre.artifacts.readArtifact("Project_DAO");
  const deployedBytecode = artifact.deployedBytecode.replace(/^0x/, "");
  const sizeBytes = deployedBytecode.length / 2;
  const delta = sizeBytes - EIP170_RUNTIME_LIMIT_BYTES;

  console.log(`[contract-size] Project_DAO deployed runtime size: ${sizeBytes.toLocaleString()} bytes`);
  console.log(`[contract-size] EIP-170 limit: ${EIP170_RUNTIME_LIMIT_BYTES.toLocaleString()} bytes`);

  if (sizeBytes > EIP170_RUNTIME_LIMIT_BYTES) {
    console.warn(
      `[contract-size] WARNING: runtime exceeds the L1 limit by ${delta.toLocaleString()} bytes. ` +
      `Prefer Base / Base Sepolia / another L2 unless you split the contract.`
    );

    if (SHOULD_FAIL) {
      throw new Error("Project_DAO exceeds the EIP-170 runtime size limit for L1 deployment.");
    }
    return;
  }

  console.log("[contract-size] OK: runtime fits within the EIP-170 limit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
