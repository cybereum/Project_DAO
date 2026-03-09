/**
 * NexusAI Self-Improvement Server
 *
 * A lightweight Express proxy that:
 *   1. Accepts analysis requests from the NEXUS frontend
 *   2. Reads relevant source files from the Project_DAO repo
 *   3. Calls Claude (claude-opus-4-6 with adaptive thinking) to generate
 *      structured improvement suggestions
 *   4. Returns typed suggestion objects the frontend can render + act on
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... node server.js
 *
 * The NEXUS frontend sets VITE_NEXUS_AI_URL=http://localhost:3737 to connect.
 */

import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ─── File reader (safe — only allows known paths) ─────────────────────────

const ALLOWED_PATHS = [
  'contracts/Project_DAO.sol',
  'nexus-app/src/store/appStore.jsx',
  'nexus-app/src/pages/AgentEconomy.jsx',
  'nexus-app/src/pages/Landing.jsx',
  'nexus-app/src/pages/GlobalPulse.jsx',
  'nexus-app/src/pages/Dashboard.jsx',
  'nexus-app/src/config/contract.js',
  'nexus-app/src/lib/analytics.js',
  'nexus-app/src/lib/utm.js',
  'nexus-app/src/components/Layout.jsx',
  'nexus-app/src/components/SEOHead.jsx',
  'FULL_IMPLEMENTATION_PLAN.md',
  'CLAUDE.md',
];

async function readSourceFiles(targets) {
  const results = [];
  for (const rel of targets) {
    if (!ALLOWED_PATHS.includes(rel)) continue;
    try {
      const content = await fs.readFile(path.join(REPO_ROOT, rel), 'utf-8');
      results.push({ path: rel, content: content.slice(0, 12_000) }); // cap at 12 KB per file
    } catch {
      // file missing or unreadable — skip
    }
  }
  return results;
}

// ─── Analysis modes ───────────────────────────────────────────────────────

const ANALYSIS_MODES = {
  /** Full codebase health scan — suggests prioritised improvements */
  health: {
    label: 'Protocol Health Scan',
    files: [
      'contracts/Project_DAO.sol',
      'nexus-app/src/store/appStore.jsx',
      'nexus-app/src/pages/AgentEconomy.jsx',
      'nexus-app/src/config/contract.js',
      'FULL_IMPLEMENTATION_PLAN.md',
    ],
    systemPrompt: `You are NexusAI, the self-improvement engine for Project_DAO — the on-chain settlement layer for the agent economy.
Your job is to analyse the provided source files and identify concrete, actionable improvements.
Focus on: security vulnerabilities, missing features (especially from the implementation plan), UX friction, gas optimisation, test coverage gaps.
Return ONLY a JSON object — no markdown, no explanation outside the JSON.`,
    userTemplate: (files) => `Analyse these source files and return a JSON object matching this schema exactly:
{
  "score": <0-100 overall health score>,
  "summary": "<2 sentence executive summary>",
  "suggestions": [
    {
      "id": "<unique-slug>",
      "priority": "critical"|"high"|"medium"|"low",
      "category": "security"|"ux"|"feature"|"performance"|"testing"|"docs",
      "title": "<short title>",
      "description": "<1-3 sentence description>",
      "file": "<path/to/file or null>",
      "line": <line number or null>,
      "effort": "1h"|"4h"|"1d"|"3d"|"1w",
      "patch": "<unified diff snippet or null>"
    }
  ],
  "planGaps": ["<gap from FULL_IMPLEMENTATION_PLAN that is not yet implemented>"],
  "newIdeas": ["<net-new idea not in the current plan>"]
}

Source files:
${files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`,
  },

  /** Focused security audit on the Solidity contract */
  security: {
    label: 'Contract Security Audit',
    files: ['contracts/Project_DAO.sol'],
    systemPrompt: `You are a Solidity security auditor. Analyse the contract for vulnerabilities using OWASP Smart Contract Top 10 and SWC Registry patterns.
Return ONLY a JSON object matching the schema provided — no extra text.`,
    userTemplate: (files) => `Audit this Solidity contract and return JSON:
{
  "riskLevel": "critical"|"high"|"medium"|"low",
  "summary": "<2 sentence summary>",
  "findings": [
    {
      "id": "<SWC-xxx or custom>",
      "severity": "critical"|"high"|"medium"|"low"|"info",
      "title": "<finding title>",
      "description": "<detailed description>",
      "line": <line number or null>,
      "recommendation": "<how to fix>",
      "patch": "<unified diff or null>"
    }
  ]
}

${files.map(f => f.content).join('\n')}`,
  },

  /** UX analysis of the Agent Economy page */
  ux: {
    label: 'UX Improvement Analysis',
    files: [
      'nexus-app/src/pages/AgentEconomy.jsx',
      'nexus-app/src/store/appStore.jsx',
    ],
    systemPrompt: `You are a senior product designer and React developer. Analyse the provided React component for UX issues, accessibility gaps, and missing features.
Return ONLY a JSON object — no markdown.`,
    userTemplate: (files) => `Analyse this React UI and return JSON:
{
  "summary": "<2 sentence summary>",
  "issues": [
    {
      "type": "accessibility"|"usability"|"missing-feature"|"error-handling"|"performance",
      "severity": "high"|"medium"|"low",
      "title": "<issue title>",
      "description": "<description>",
      "recommendation": "<how to fix>",
      "effort": "1h"|"4h"|"1d"
    }
  ]
}

${files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`,
  },

  /** Growth — analyse marketing pages and suggest improvements */
  growth: {
    label: 'Growth & Conversion Analysis',
    files: [
      'nexus-app/src/pages/Landing.jsx',
      'nexus-app/src/lib/utm.js',
      'nexus-app/src/lib/analytics.js',
    ],
    systemPrompt: `You are a growth engineer and conversion rate optimisation expert. Analyse the marketing pages and tracking infrastructure.
Return ONLY a JSON object — no markdown.`,
    userTemplate: (files) => `Analyse this marketing and tracking code and return JSON:
{
  "summary": "<2 sentence summary>",
  "conversionScore": <0-100>,
  "suggestions": [
    {
      "area": "copy"|"cta"|"tracking"|"seo"|"funnel"|"social",
      "priority": "high"|"medium"|"low",
      "title": "<suggestion title>",
      "description": "<description>",
      "expectedImpact": "<expected impact on conversions>"
    }
  ]
}

${files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`,
  },
};

// ─── /api/analyse — main analysis endpoint ───────────────────────────────

app.post('/api/analyse', async (req, res) => {
  const { mode = 'health', stream: doStream = false } = req.body;
  const modeConfig = ANALYSIS_MODES[mode];
  if (!modeConfig) {
    return res.status(400).json({ error: `Unknown mode: ${mode}. Valid: ${Object.keys(ANALYSIS_MODES).join(', ')}` });
  }

  const files = await readSourceFiles(modeConfig.files);
  if (!files.length) {
    return res.status(500).json({ error: 'Could not read source files.' });
  }

  const userContent = modeConfig.userTemplate(files);

  try {
    if (doStream) {
      // Streaming SSE for real-time token display
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = client.messages.stream({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: modeConfig.systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }

      const final = await stream.finalMessage();
      const raw = final.content.find(b => b.type === 'text')?.text || '{}';
      res.write(`data: ${JSON.stringify({ done: true, raw })}\n\n`);
      res.end();
    } else {
      const response = await client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        system: modeConfig.systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      });

      const raw = response.content.find(b => b.type === 'text')?.text || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { raw };
      }

      res.json({
        mode,
        label: modeConfig.label,
        model: 'claude-opus-4-6',
        filesAnalysed: files.map(f => f.path),
        result: parsed,
        usage: response.usage,
      });
    }
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: err.message || 'Claude API call failed.' });
  }
});

// ─── /api/apply-suggestion — auto-apply a patch suggestion ───────────────

app.post('/api/apply-suggestion', async (req, res) => {
  const { filePath, patch } = req.body;
  if (!filePath || !patch) {
    return res.status(400).json({ error: 'filePath and patch are required.' });
  }
  if (!ALLOWED_PATHS.includes(filePath)) {
    return res.status(403).json({ error: 'File path not in allowlist.' });
  }

  // Ask Claude to apply the patch precisely to the current file content
  const currentContent = await fs.readFile(path.join(REPO_ROOT, filePath), 'utf-8').catch(() => null);
  if (!currentContent) {
    return res.status(404).json({ error: 'File not found.' });
  }

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: 'You are a precise code editor. Apply the provided patch to the file and return ONLY the complete updated file content with no explanation, no markdown fences, no extra text.',
    messages: [{
      role: 'user',
      content: `Apply this patch to the file:\n\nPATCH:\n${patch}\n\nCURRENT FILE (${filePath}):\n${currentContent}`,
    }],
  });

  const updatedContent = response.content.find(b => b.type === 'text')?.text || '';
  if (!updatedContent) {
    return res.status(500).json({ error: 'Claude returned empty content.' });
  }

  await fs.writeFile(path.join(REPO_ROOT, filePath), updatedContent, 'utf-8');
  res.json({ success: true, filePath, message: `Applied patch to ${filePath}` });
});

// ─── /api/modes — list available analysis modes ───────────────────────────

app.get('/api/modes', (_req, res) => {
  res.json(
    Object.entries(ANALYSIS_MODES).map(([id, m]) => ({
      id,
      label: m.label,
      files: m.files,
    }))
  );
});

// ─── /api/health ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '1.0.0' }));

// ─── Start ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => {
  console.log(`NexusAI server listening on http://localhost:${PORT}`);
  console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'set ✓' : 'NOT SET ✗');
});
