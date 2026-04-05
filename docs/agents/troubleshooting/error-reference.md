# Error Reference

> Every error the SDK and contract can throw, organized by source.

---

## SDK Errors (Thrown by AgentClient)

### Construction & Discovery

| Error message | Cause | Fix |
|---|---|---|
| `"rpcUrl is required"` | Missing constructor param | Provide rpcUrl or use `AgentClient.discover()` |
| `"contractAddress is required"` | Missing constructor param | Provide address or use `discover()` |
| `"privateKey is required"` | Missing constructor/discover param | Set `AGENT_PRIVATE_KEY` env var |
| `"chainId is required for auto-discovery"` | Missing chainId in `discover()` | Provide chainId (e.g. 8453) |
| `"Chain X not in deployment registry"` | Unsupported chain | Use a supported chain ID |
| `"Contract not yet deployed on X"` | Registry has no address | Wait for deployment or use manual config |
| `"No RPC URL provided and no hints..."` | No rpcUrl and registry has no hints | Provide explicit rpcUrl |
| `"Chain ID mismatch: RPC is on chain X but expected Y"` | RPC points to wrong network | Fix rpcUrl to match chainId |

### Input Validation

| Error message | Cause | Fix |
|---|---|---|
| `"metadataURI must be a non-empty string"` | Empty or null URI | Provide valid IPFS URI |
| `"metadataURI too long (X bytes, max 512)"` | URI exceeds 512 bytes | Use IPFS CID instead of inline data |
| `"Invalid X address: 0x..."` | Malformed Ethereum address | Verify address format and checksum |
| `"Deposit amount must be greater than zero"` | Zero deposit | Use positive amount |
| `"Withdraw amount must be greater than zero"` | Zero withdraw | Use positive amount |
| `"Transfer amount must be greater than zero"` | Zero transfer | Use positive amount |
| `"Stake amount must be greater than zero"` | Zero stake | Use positive amount |
| `"offset must be non-negative"` | Negative pagination offset | Use offset ≥ 0 |
| `"limit must be between 1 and 1000"` | Out-of-range limit | Use 1 ≤ limit ≤ 1000 |
| `"encryptedContent must be a non-empty string"` | Empty message | Provide message content |
| `"contentHash must be a 32-byte hex string"` | Invalid hash format | Use `ethers.keccak256(ethers.toUtf8Bytes(text))` |
| `"capability must be a non-empty string"` | Empty capability tag | Provide capability name |
| `"capabilities must be an array"` | Wrong type | Pass string array |
| `"description is required"` | Missing service agreement description | Provide description |
| `"sharesBps must be between 0 and 10000"` | Invalid share percentage | Use 0-10000 basis points |
| `"transfers must be a non-empty array"` | Empty batch | Provide at least one transfer |

### Transaction Errors

| Error message | Cause | Fix |
|---|---|---|
| `"Insufficient balance to onboard..."` | Wallet can't afford stake + gas | Fund wallet with recommended amount |
| `"Payment request X not found"` | Invalid request ID | Verify request ID exists |
| `"Transaction timed out after Xms"` | TX didn't confirm in time | Retry; check gas price and RPC |
| Network errors (ETIMEDOUT, ECONNRESET, etc.) | RPC connection issues | SDK auto-retries 2x with backoff |

---

## Contract Errors (Solidity Custom Errors)

These revert the transaction and appear in the error message:

| Error | Cause | Fix |
|---|---|---|
| `Unauthorized()` | Not owner when owner action required | Use the owner address |
| `NotMember()` | Not a DAO member | Call `stakeAndJoin()` first |
| `NotRegisteredAgent()` | Not registered as agent | Call `register()` or `safeOnboard()` |
| `ContractPaused()` | Contract is paused by owner | Wait for owner to resume |
| `ZeroAmount()` | Zero-value operation | Use non-zero amounts |
| `InsufficientBalance()` | Escrow balance too low | Deposit more funds |
| `InvalidAddress()` | Zero address or invalid target | Check addresses |
| `TransferFailed()` | ETH transfer to recipient failed | Recipient may be a contract that rejects ETH |
| `AlreadyExists()` | Duplicate registration/action | Already registered — no action needed |
| `NotFound()` | Referenced entity doesn't exist | Check ID/address |
| `InvalidStatus()` | Wrong lifecycle state for operation | Check current status before acting |

---

## Diagnostic Checklist

When a transaction fails:

1. **Check registration**: `await agent.isRegistered()` — most operations need this
2. **Check balance**: `await agent.getNativeBalance()` — sufficient escrow?
3. **Check wallet**: `await agent.provider.getBalance(agent.address)` — enough for gas?
4. **Check status**: For payment requests/agreements, verify current status
5. **Check pause**: Is the contract paused? (Read `paused` state variable)
6. **Check chain**: `await agent.verifyChain()` — connected to right network?

---

## Backlinks

- [common-issues.md](common-issues.md) — Scenario-based troubleshooting
- [../workflows/onboarding.md](../workflows/onboarding.md) — Onboarding errors
- [../../protocol/security-model.md](../../protocol/security-model.md) — Access control details

---
*Source: sdk/index.js, contracts/Project_DAO.sol*
*Last updated: 2026-04-05*
