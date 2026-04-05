# Raw Intake

> Landing zone for new source material before it's compiled into the knowledge base.

---

## How Raw Intake Works

This directory is the **ingestion pipeline** for the knowledge base. New source material — articles, papers, repo links, datasets, notes — lands here first, then gets processed by an LLM into the appropriate knowledge base section.

### Workflow

```
1. Drop source material into raw/ (or add a reference below)
2. LLM reads and summarizes the material
3. LLM identifies which knowledge base section(s) it belongs to
4. LLM creates or updates articles in the relevant section
5. LLM updates the section's _index.md
6. Source entry below is marked as "processed"
```

### File Formats

- `.md` files — articles, notes, web clips (use Obsidian Web Clipper or similar)
- `.pdf` files — papers, reports (LLM reads via PDF tool)
- `.json` files — structured data, API responses
- `.png` / `.jpg` — diagrams, screenshots (LLM reads via image tool)
- URLs — add to the intake log below for LLM to fetch

---

## Intake Log

> Add new sources here. LLM agents process them into the knowledge base.

| # | Source | Type | Status | Processed into |
|---|---|---|---|---|
| — | *No items yet* | — | — | — |

### Status Values
- **new**: Just added, not yet reviewed
- **reviewing**: LLM is reading and analyzing
- **processed**: Content compiled into knowledge base articles
- **skipped**: Reviewed but not relevant enough to include

---

## Suggested Sources to Ingest

These are high-value sources that would strengthen the knowledge base:

### Smart Contract Security
- Trail of Bits "Building Secure Smart Contracts" guide
- Consensys "Smart Contract Best Practices"
- Rekt.news post-mortems (reentrancy, flash loan attacks)

### Agent Economy
- Autonolas documentation and whitepaper
- Fetch.ai DeltaV architecture docs
- "Cooperative AI" research papers (DeepMind, OpenAI)

### DAO Governance
- Vitalik Buterin's "Moving beyond coin voting governance" (2021)
- Elinor Ostrom's "Governing the Commons" (key chapters)
- a16z "Governance Minimization" framework

### L2 & Scaling
- L2Beat comparison data and risk frameworks
- Optimism Bedrock architecture specification
- EIP-4844 (proto-danksharding) impact on L2 costs

### Formal Verification
- Certora documentation and tutorial rules
- Runtime Verification's Solidity formal verification papers
- HEVM symbolic execution documentation

---

## Tips for Ingestion

- **Web articles**: Use Obsidian Web Clipper to save as .md with images
- **Papers**: Save PDF, note key sections and relevance in intake log
- **Repos**: Note the repo URL and which specific files/patterns are relevant
- **Keep raw/ lean**: Once processed, source material can be archived or deleted
- **Tag relevance**: Note which knowledge base section the source maps to

---
*Last updated: 2026-04-05*
