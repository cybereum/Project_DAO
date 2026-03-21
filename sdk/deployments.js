/**
 * Canonical deployment registry for Project_DAO.
 *
 * Exported as a plain ESM module so it can be imported without Node-specific
 * APIs (createRequire / require) — this ensures compatibility with Node.js,
 * Deno, Bun, and all modern bundlers.
 *
 * AI agents use this file to auto-discover the contract address for their
 * target chain via AgentClient.discover().
 *
 * Update this file after deploying to a new network.
 */
export const deployments = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  _description:
    'Canonical deployment registry for Project_DAO. AI agents use this file to discover the contract address for their target chain. Fetch this file from the repository or IPFS to auto-configure.',
  _updated: '2026-03-21',
  networks: {
    '8453': {
      name: 'Base',
      contractAddress: '',
      explorerUrl: 'https://basescan.org',
      status: 'pending-deployment',
      rpcHints: [
        'https://mainnet.base.org',
        'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
        'https://base.meowrpc.com',
      ],
    },
    '84532': {
      name: 'Base Sepolia (testnet)',
      contractAddress: '',
      explorerUrl: 'https://sepolia.basescan.org',
      status: 'pending-deployment',
      rpcHints: [
        'https://sepolia.base.org',
        'https://base-sepolia.g.alchemy.com/v2/YOUR_KEY',
      ],
    },
    '1': {
      name: 'Ethereum Mainnet',
      contractAddress: '',
      explorerUrl: 'https://etherscan.io',
      status: 'pending-deployment',
      rpcHints: [
        'https://eth.llamarpc.com',
        'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
      ],
    },
    '11155111': {
      name: 'Sepolia (testnet)',
      contractAddress: '',
      explorerUrl: 'https://sepolia.etherscan.io',
      status: 'pending-deployment',
      rpcHints: [
        'https://rpc.sepolia.org',
        'https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY',
      ],
    },
  },
};
