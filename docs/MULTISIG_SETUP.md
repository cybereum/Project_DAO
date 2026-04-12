# Multisig Setup: Gnosis Safe as Contract Owner

## Why Multisig

A single EOA owner is a single point of failure. If the private key is compromised, an attacker gains full control: they can change the treasury address, pause the contract, add/remove members, and modify fees. If the key is lost, the contract becomes unrecoverable. A multisig requires multiple independent signers to approve any owner action, eliminating both risks.

## Recommended Configuration

- **Signers:** 5 (geographically and organizationally distributed)
- **Threshold:** 3-of-5 (majority required to execute any transaction)
- **Signer devices:** Hardware wallets (Ledger/Trezor) strongly recommended for all signers
- **No single entity** should control more than one signer key

## Step 1: Create the Gnosis Safe

1. Go to [app.safe.global](https://app.safe.global)
2. Connect a wallet and select the target network (e.g., Base)
3. Click **Create New Safe**
4. Add all 5 signer addresses
5. Set the confirmation threshold to **3**
6. Fund the Safe with a small amount of ETH for gas
7. Record the Safe address (checksummed)

## Step 2: Transfer Contract Ownership

Prerequisites:
- The current EOA owner's private key is available as `DEPLOYER_PRIVATE_KEY` in the environment
- The contract is deployed and its address is known

Run the transfer script:

```bash
SAFE_ADDRESS=0xYourSafeAddress \
CONTRACT_ADDRESS=0xYourContractAddress \
npx hardhat run scripts/transfer-ownership-to-safe.js --network base
```

The script will:
1. Validate both addresses (checksum + contract code at Safe address)
2. Display current owner and proposed new owner
3. Ask for confirmation (pass `--confirm` to skip the prompt in CI)
4. Call `changeOwner()` and verify the result on-chain

After this, the EOA can no longer call any `onlyOwner` function.

## Step 3: Queue Owner Transactions via Safe

All `onlyOwner` calls now require multisig approval. To execute one:

1. Open your Safe at [app.safe.global](https://app.safe.global)
2. Go to **New Transaction > Contract Interaction**
3. Paste the Project_DAO contract address
4. Load the ABI (from `artifacts/contracts/Project_DAO.sol/Project_DAO.json`)
5. Select the function (e.g., `queueSetTreasury`, `addMember`, `pauseContract`)
6. Fill in parameters and click **Submit**
7. Other signers review and confirm until threshold (3) is met
8. Any signer executes the approved transaction

### Timelocked Operations

Treasury and fee changes use a two-step timelock pattern (default 24-hour delay):

1. **Queue** via Safe: call `queueSetTreasury(newAddress)` or `queueSetFeeConfig(feeBps, flatFee)`
   - Requires 3-of-5 Safe approval
   - Starts a 24-hour countdown on-chain
2. **Wait** the delay period (24 hours minimum, configurable up to 30 days)
3. **Execute** via Safe: call `executeSetTreasury(newAddress)` or `executeSetFeeConfig(feeBps, flatFee)`
   - Requires another 3-of-5 Safe approval
   - Must execute before the grace period expires (48 hours after ready)

This means sensitive changes require **two rounds of multisig approval** separated by at least 24 hours -- giving the community time to react to queued changes.

## Emergency Procedures

### If signers are unavailable

- With 3-of-5 threshold, losing access to 2 signers still allows operations. Losing 3 means the contract owner functions are permanently locked.
- **Mitigation:** Each signer should have a documented recovery procedure for their hardware wallet (seed phrase in secure storage, separate from the device).
- Consider designating 1-2 backup signers who can be rotated in via `swapOwner` on the Safe before an emergency occurs.

### If the contract must be paused immediately

1. Any signer initiates `pauseContract()` via the Safe
2. Alert other signers through pre-agreed channels (group chat, on-call rotation)
3. 3 signers confirm as quickly as possible
4. Once confirmed, any signer executes

Since pausing is time-sensitive, keep a pre-signed batch transaction template ready in the Safe's transaction builder.

### Signer rotation

If a signer is compromised or leaves the organization:

1. Use the Safe's `swapOwner` function to replace them (3-of-5 approval required)
2. The compromised signer cannot unilaterally act since threshold is 3
3. Update internal documentation with the new signer list

## Checklist

- [ ] Safe created on target network with 3-of-5 threshold
- [ ] All 5 signers confirmed they can access and sign
- [ ] Safe funded with ETH for gas
- [ ] Ownership transferred via `transfer-ownership-to-safe.js`
- [ ] Verified `owner()` returns the Safe address
- [ ] Test transaction executed through Safe (e.g., `addMember`)
- [ ] Old EOA key secured or destroyed
- [ ] Signer recovery procedures documented and stored securely
