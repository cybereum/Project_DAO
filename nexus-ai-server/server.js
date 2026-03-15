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
const FEEDBACK_STORE_PATH = path.join(__dirname, 'data', 'feedback-memory.json');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const ALLOWED_OUTCOMES = new Set(['adopted', 'successful', 'rejected', 'noisy']);

const DEFAULT_FEEDBACK_STORE = {
  sourceWeights: {
    human: 1,
    ai: 0.9,
  },
  outcomes: {},
  items: [],
};

async function loadFeedbackStore() {
  try {
    const raw = await fs.readFile(FEEDBACK_STORE_PATH, 'utf-8');
    return { ...DEFAULT_FEEDBACK_STORE, ...JSON.parse(raw) };
  } catch {
    await fs.mkdir(path.dirname(FEEDBACK_STORE_PATH), { recursive: true });
    await fs.writeFile(FEEDBACK_STORE_PATH, JSON.stringify(DEFAULT_FEEDBACK_STORE, null, 2), 'utf-8');
    return { ...DEFAULT_FEEDBACK_STORE };
  }
}

async function saveFeedbackStore(store) {
  await fs.mkdir(path.dirname(FEEDBACK_STORE_PATH), { recursive: true });
  await fs.writeFile(FEEDBACK_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function qualityFilter(item) {
  const text = `${item.title || ''} ${item.description || ''}`.trim();
  if (item.flagged === true) return { include: false, reason: 'flagged' };
  if (text.length < 20) return { include: false, reason: 'too-short' };
  if (!item.category) return { include: false, reason: 'missing-category' };
  return { include: true, reason: 'valid' };
}

function computeRank(item, sourceWeight = 1) {
  const confidence = Math.min(Math.max(Number(item.confidence ?? 0.6), 0), 1);
  const severityWeight = { critical: 1.3, high: 1.1, medium: 1, low: 0.7 }[item.severity] || 1;
  const votes = Number(item.votes ?? 0);
  const ageHours = Math.max(0, (Date.now() - new Date(item.createdAt || Date.now()).getTime()) / 36e5);
  const freshness = 1 / (1 + ageHours / 48);
  const score = (confidence * severityWeight * sourceWeight * 100 * freshness) + (votes * 4);
  return Number(score.toFixed(2));
}

function normaliseFeedback(input = {}) {
  return {
    id: input.id || `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sourceType: input.sourceType === 'ai' ? 'ai' : 'human',
    author: input.author || 'anonymous',
    title: input.title || 'Untitled feedback',
    description: input.description || '',
    category: input.category || '',
    severity: input.severity || 'medium',
    confidence: input.confidence,
    votes: input.votes,
    flagged: input.flagged,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

function buildFeedbackInsights(store) {
  const considered = [];
  const filteredOut = [];
  for (const item of store.items) {
    const decision = qualityFilter(item);
    if (!decision.include) {
      filteredOut.push({ id: item.id, reason: decision.reason, sourceType: item.sourceType, title: item.title });
      continue;
    }
    const sourceWeight = store.sourceWeights[item.sourceType] ?? 1;
    const rankScore = computeRank(item, sourceWeight);
    considered.push({ ...item, sourceWeight, rankScore });
  }

  const ranked = considered.sort((a, b) => b.rankScore - a.rankScore).map((item, index) => ({
    rank: index + 1,
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    category: item.category,
    severity: item.severity,
    confidence: item.confidence ?? 0.6,
    votes: item.votes ?? 0,
    sourceWeight: item.sourceWeight,
    rankScore: item.rankScore,
    description: item.description,
    createdAt: item.createdAt,
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalReceived: store.items.length,
    considered: considered.length,
    filteredOut,
    ranked,
    sourceWeights: store.sourceWeights,
  };
}

// ─── File reader (safe — only allows known paths) ─────────────────────────

const ALLOWED_PATHS = [
  'contracts/Project_DAO.sol',
  'nexus-app/src/store/appStore.jsx',
  'nexus-app/src/pages/AgentEconomy.jsx',
  'nexus-app/src/pages/FeatureKits.jsx',
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

  /**
   * Triage — analyse agent-submitted feature kits from the chain (passed in the
   * request body as `kits[]`) and return a ranked, de-duplicated implementation
   * queue with AI impact/feasibility/effort scoring.
   */
  triage: {
    label: 'Feature Kit Triage',
    files: ['FULL_IMPLEMENTATION_PLAN.md', 'CLAUDE.md'],
    systemPrompt: `You are the NexusAI triage engine for Project_DAO.
Your job is to evaluate a list of agent-submitted feature kits and produce a ranked, de-duplicated implementation queue.
Scoring criteria:
  - impact:      0-10  (user / protocol value delivered)
  - feasibility: 0-10  (ease of implementation given the existing codebase)
  - effort:      S|M|L|XL (t-shirt size relative to the Project_DAO codebase)
  - composite:   (impact × feasibility) / effortNum   where effortNum = S→1, M→2, L→4, XL→8
Detect semantic duplicates and merge them into a single entry (list all submitters).
Cross-check each kit against the implementation plan — mark it "planned" if already tracked.
Return ONLY a JSON object — no markdown, no explanation outside the JSON.`,
    userTemplate: (files, kits) => `You have access to the implementation plan and protocol description below.
Evaluate these ${kits.length} agent-submitted feature kits and return JSON matching this schema exactly:
{
  "triageRunAt": "<ISO timestamp>",
  "totalSubmitted": <number>,
  "duplicatesCollapsed": <number>,
  "ranked": [
    {
      "rank": <1-based integer>,
      "ids": [<kit IDs merged into this entry>],
      "submitters": ["<address>"],
      "title": "<canonical title>",
      "description": "<merged description>",
      "priority": "critical"|"high"|"medium"|"low",
      "impact": <0-10>,
      "feasibility": <0-10>,
      "effort": "S"|"M"|"L"|"XL",
      "composite": <number, 2dp>,
      "alreadyPlanned": <boolean>,
      "planReference": "<section in FULL_IMPLEMENTATION_PLAN.md or null>",
      "recommendation": "implement-now"|"queue"|"defer"|"reject",
      "rationale": "<1-2 sentence reasoning>"
    }
  ],
  "summary": "<3 sentence executive summary of the batch>"
}

Feature kits to triage:
${JSON.stringify(kits, null, 2)}

Implementation plan + protocol context:
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

  /** Feedback synthesis for human + AI suggestions */
  feedback: {
    label: 'Feedback Synthesis',
    files: ['FULL_IMPLEMENTATION_PLAN.md', 'CLAUDE.md'],
    systemPrompt: `You are NexusAI's continuous self-improvement planner.
You receive ranked, filtered feedback from human and AI contributors.
Generate a practical implementation backlog with the highest-value actions first.
Return ONLY JSON — no markdown.`,
    userTemplate: (files, _kits, feedbackInsights = null) => `Use the feedback insight payload below and produce JSON with this exact schema:
{
  "summary": "<2 sentence summary>",
  "topActions": [
    {
      "rank": <number>,
      "title": "<action title>",
      "owner": "frontend"|"backend"|"protocol"|"ops",
      "priority": "critical"|"high"|"medium"|"low",
      "whyNow": "<reason>",
      "dependsOn": ["<optional dependency>"]
    }
  ],
  "selfImprovementRules": ["<rule to improve future triage quality>"]
}

Feedback insights:
${JSON.stringify(feedbackInsights || {}, null, 2)}

Plan + protocol context:
${files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`,
  },
};

// ─── /api/analyse — main analysis endpoint ───────────────────────────────

app.post('/api/analyse', async (req, res) => {
  const { mode = 'health', stream: doStream = false, kits = [] } = req.body;
  const modeConfig = ANALYSIS_MODES[mode];
  if (!modeConfig) {
    return res.status(400).json({ error: `Unknown mode: ${mode}. Valid: ${Object.keys(ANALYSIS_MODES).join(', ')}` });
  }

  if (mode === 'triage' && (!Array.isArray(kits) || kits.length === 0)) {
    return res.status(400).json({ error: 'triage mode requires a non-empty kits[] array in the request body.' });
  }

  const files = await readSourceFiles(modeConfig.files);
  if (!files.length) {
    return res.status(500).json({ error: 'Could not read source files.' });
  }

  const feedbackInsights = mode === 'feedback' ? buildFeedbackInsights(await loadFeedbackStore()) : null;
  const userContent = mode === 'triage'
    ? modeConfig.userTemplate(files, kits)
    : mode === 'feedback'
      ? modeConfig.userTemplate(files, kits, feedbackInsights)
      : modeConfig.userTemplate(files);

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
        feedbackInsights,
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
  try {
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
        content: `Apply this patch to the file:

PATCH:
${patch}

CURRENT FILE (${filePath}):
${currentContent}`,
      }],
    });

    const updatedContent = response.content.find(b => b.type === 'text')?.text || '';
    if (!updatedContent) {
      return res.status(500).json({ error: 'Claude returned empty content.' });
    }

    await fs.writeFile(path.join(REPO_ROOT, filePath), updatedContent, 'utf-8');
    res.json({ success: true, filePath, message: `Applied patch to ${filePath}` });
  } catch (err) {
    console.error('Apply suggestion error:', err);
    res.status(500).json({ error: err.message || 'Failed to apply suggestion.' });
  }
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

// ─── Feedback memory endpoints (consider, filter, rank, self-improve) ───

app.post('/api/feedback', async (req, res) => {
  try {
    const payload = normaliseFeedback(req.body || {});
    const store = await loadFeedbackStore();
    store.items.push(payload);
    await saveFeedbackStore(store);
    const insights = buildFeedbackInsights(store);
    res.status(201).json({ saved: true, item: payload, insights });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save feedback.' });
  }
});

app.get('/api/feedback', async (_req, res) => {
  try {
    const store = await loadFeedbackStore();
    res.json(buildFeedbackInsights(store));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to read feedback.' });
  }
});

app.post('/api/feedback/outcome', async (req, res) => {
  try {
    const { feedbackId, outcome } = req.body || {};
    if (!feedbackId || !outcome) {
      return res.status(400).json({ error: 'feedbackId and outcome are required.' });
    }
    if (!ALLOWED_OUTCOMES.has(outcome)) {
      return res.status(400).json({ error: `Invalid outcome: ${outcome}. Valid outcomes: ${Array.from(ALLOWED_OUTCOMES).join(', ')}` });
    }

    const store = await loadFeedbackStore();
    const item = store.items.find((x) => x.id === feedbackId);
    if (!item) return res.status(404).json({ error: 'Feedback item not found.' });

    const source = item.sourceType;
    const current = store.sourceWeights[source] ?? 1;
    const deltaMap = { adopted: 0.08, successful: 0.05, rejected: -0.06, noisy: -0.1 };
    const delta = deltaMap[outcome] ?? 0;
    store.sourceWeights[source] = Number(Math.min(1.5, Math.max(0.3, current + delta)).toFixed(2));
    store.outcomes[feedbackId] = {
      outcome,
      sourceType: source,
      recordedAt: new Date().toISOString(),
    };

    await saveFeedbackStore(store);
    res.json({ updated: true, sourceType: source, newWeight: store.sourceWeights[source], insights: buildFeedbackInsights(store) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update feedback outcome.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => {
  console.log(`NexusAI server listening on http://localhost:${PORT}`);
  console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'set ✓' : 'NOT SET ✗');
});
