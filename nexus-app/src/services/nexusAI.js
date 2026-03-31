/**
 * nexusAI.js — Frontend client for the NexusAI self-improvement server.
 *
 * The server URL is read from VITE_NEXUS_AI_URL (default: http://localhost:3737).
 * If the env var is not set the service degrades gracefully — all calls return
 * a { error, offline: true } object so the UI can show a "server not running"
 * state without crashing.
 *
 * Usage:
 *   import { nexusAI } from '../services/nexusAI';
 *   const result = await nexusAI.analyse('health');
 *   const modes  = await nexusAI.getModes();
 */

const BASE_URL = (import.meta.env.VITE_NEXUS_AI_URL || 'http://localhost:3737').replace(/\/$/, '');

// Block HTTP in production — wallet addresses and payment hashes must not be sent unencrypted
const _isInsecureProduction = import.meta.env.PROD && BASE_URL.startsWith('http://') && !BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1');

let _wallet = '';

async function safeFetch(path, options = {}) {
  if (_isInsecureProduction) {
    return { error: 'NexusAI requires HTTPS in production. Set VITE_NEXUS_AI_URL to an https:// endpoint.', insecure: true };
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-wallet-address': _wallet,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { error: body.error || `HTTP ${res.status}` };
    }
    return await res.json();
  } catch (err) {
    if (err?.message?.includes('fetch') || err?.message?.includes('network') || err?.code === 'ECONNREFUSED') {
      return { error: 'NexusAI server is offline. Run: cd nexus-ai-server && npm start', offline: true };
    }
    return { error: err.message || 'Unknown error' };
  }
}

export const nexusAI = {
  /**
   * Store wallet address for subsequent API calls.
   * @param {string} addr
   */
  setWallet(addr) {
    _wallet = (addr || '').toLowerCase();
  },

  /**
   * Fetch usage / quota info for a wallet.
   * @param {string} [walletAddress]
   * @returns {{ freeTierRemaining, requiresPayment, ... } | { error }}
   */
  async getUsage(walletAddress) {
    return safeFetch(`/api/usage?wallet=${walletAddress || _wallet || ''}`);
  },

  /**
   * Check if the server is reachable.
   * @returns {{ ok: boolean, error?: string }}
   */
  async ping() {
    return safeFetch('/api/health');
  },

  /**
   * List available analysis modes.
   * @returns {Array<{ id, label, files }>}
   */
  async getModes() {
    return safeFetch('/api/modes');
  },

  /** Fetch live tech signals aggregated by the NexusAI server. */
  async getTechSignals() {
    return safeFetch('/api/tech-signals');
  },

  /**
   * Run a full analysis in the given mode.
   * @param {'health'|'security'|'ux'|'growth'|'feedback'} mode
   * @returns {{ mode, label, model, filesAnalysed, result, usage } | { error }}
   */
  async analyse(mode = 'health') {
    return safeFetch('/api/analyse', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  /**
   * Stream an analysis, calling onChunk(text) for each token.
   * Resolves with the final raw JSON string when complete.
   * @param {'health'|'security'|'ux'|'growth'|'feedback'} mode
   * @param {(text: string) => void} onChunk
   * @returns {Promise<string>}
   */
  async analyseStream(mode = 'health', onChunk, { paymentTxHash } = {}) {
    if (_isInsecureProduction) {
      return JSON.stringify({ error: 'NexusAI requires HTTPS in production. Set VITE_NEXUS_AI_URL to an https:// endpoint.' });
    }
    let raw = '';
    try {
      const headers = { 'Content-Type': 'application/json', 'x-wallet-address': _wallet };
      if (paymentTxHash) headers['x-payment-tx'] = paymentTxHash;
      const res = await fetch(`${BASE_URL}/api/analyse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mode, stream: true }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return JSON.stringify({ error: body.error || `HTTP ${res.status}` });
      }
      if (!res.body) {
        return JSON.stringify({ error: 'Streaming response body is unavailable.' });
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) { onChunk?.(parsed.text); raw += parsed.text; }
            if (parsed.done) raw = parsed.raw;
          } catch { /* partial line */ }
        }
      }
    } catch (err) {
      return JSON.stringify({ error: err.message || 'Stream failed' });
    }
    return raw;
  },

  /**
   * Run AI triage on an array of feature kits.
   * Deduplicates, cross-checks the plan, and returns a ranked queue.
   * @param {Array<{id, title, description, priority, voteCount}>} kits
   * @returns {{ ranked[], summary, totalSubmitted, duplicatesCollapsed } | { error }}
   */
  async triage(kits = []) {
    return safeFetch('/api/analyse', {
      method: 'POST',
      body: JSON.stringify({ mode: 'triage', kits }),
    }).then(data => data?.result ?? data);
  },

  /**
   * Save one feedback item from a human or AI contributor.
   * @param {{sourceType:'human'|'ai', title:string, description:string, category:string, severity?:string, confidence?:number, votes?:number}} item
   */
  async submitFeedback(item) {
    return safeFetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  /** Fetch ranked feedback insights. */
  async getFeedbackInsights() {
    return safeFetch('/api/feedback');
  },

  /**
   * Register real-world outcome so source weighting can self-improve.
   * @param {string} feedbackId
   * @param {'adopted'|'successful'|'rejected'|'noisy'} outcome
   */
  async recordFeedbackOutcome(feedbackId, outcome) {
    return safeFetch('/api/feedback/outcome', {
      method: 'POST',
      body: JSON.stringify({ feedbackId, outcome }),
    });
  },

  /**
   * Apply a suggestion patch to a file via the server.
   * @param {string} filePath  Repo-relative path (must be in server allowlist)
   * @param {string} patch     Unified diff string from a suggestion
   */
  async applySuggestion(filePath, patch) {
    return safeFetch('/api/apply-suggestion', {
      method: 'POST',
      body: JSON.stringify({ filePath, patch }),
    });
  },
};
