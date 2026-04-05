# Token Standards

> ERC-20, ERC-721, ERC-1155 and their roles in the agent economy.

---

## ERC-20: Fungible Tokens

- **EIP**: [EIP-20](https://eips.ethereum.org/EIPS/eip-20) (2015)
- **Use**: Currencies, stablecoins, governance tokens, utility tokens
- **Key functions**: `transfer`, `transferFrom`, `approve`, `allowance`, `balanceOf`
- **In Project_DAO**: Agent token escrow (`depositTokenToEscrow`, `transferTokenBetweenAgents`)

### Security Notes
- `approve` race condition: use `increaseAllowance`/`decreaseAllowance` (OpenZeppelin)
- Malicious tokens can have reentrancy in `transfer` — always use `nonReentrant`
- Some tokens don't return `bool` from `transfer` (USDT) — use SafeERC20

## ERC-721: Non-Fungible Tokens

- **EIP**: [EIP-721](https://eips.ethereum.org/EIPS/eip-721) (2018)
- **Use**: Unique assets, certificates, credentials, property deeds
- **Key functions**: `transferFrom`, `safeTransferFrom`, `approve`, `ownerOf`, `tokenURI`
- **In Project_DAO**: Asset tokenization (`AssetNFT.sol`), agent asset transfers with flat fee

### Metadata
- `tokenURI()` returns a URL to JSON metadata (name, description, image)
- Typically stored on IPFS or Arweave for immutability

## ERC-1155: Multi-Token Standard

- **EIP**: [EIP-1155](https://eips.ethereum.org/EIPS/eip-1155) (2019)
- **Use**: Batch operations, mixed fungible + non-fungible in single contract
- **Key functions**: `safeTransferFrom`, `safeBatchTransferFrom`, `balanceOf`, `balanceOfBatch`
- **In Project_DAO**: Not currently used — potential future addition for batch agent transfers

## Comparison

| Feature | ERC-20 | ERC-721 | ERC-1155 |
|---|---|---|---|
| Fungibility | Fungible | Non-fungible | Both |
| Batch transfers | No | No | Yes |
| Gas efficiency | Moderate | High per token | Low per batch |
| Metadata | Optional | Standard (tokenURI) | Standard (uri) |
| Use in escrow | Amount-based | Token ID-based | Both |

## Emerging Standards

- **ERC-4626**: Tokenized vault standard (yield-bearing tokens)
- **ERC-6551**: Token-bound accounts (NFTs that own assets)
- **ERC-7579**: Minimal modular smart accounts

---

## Backlinks

- [../../protocol/contract-reference.md](../../protocol/contract-reference.md) — Token functions in Project_DAO
- [escrow-patterns.md](escrow-patterns.md) — Escrow for different token types
- [../references/eip-standards.md](../references/eip-standards.md) — Full EIP reference
- [../references/openzeppelin-library.md](../references/openzeppelin-library.md) — OZ implementations

---
*Last updated: 2026-04-05*
