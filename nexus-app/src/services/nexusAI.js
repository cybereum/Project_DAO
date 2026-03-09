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

async function safeFetch(path, options = {}) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
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

  /**
   * Run a full analysis in the given mode.
   * @param {'health'|'security'|'ux'|'growth'} mode
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
   * @param {'health'|'security'|'ux'|'growth'} mode
   * @param {(text: string) => void} onChunk
   * @returns {Promise<string>}
   */
  async analyseStream(mode = 'health', onChunk) {
    let raw = '';
    try {
      const res = await fetch(`${BASE_URL}/api/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, stream: true }),
      });

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
