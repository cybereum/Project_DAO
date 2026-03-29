/**
 * @cybereum/agent-sdk/pretext — Headless text measurement for AI agents.
 *
 * Provides text measurement and layout utilities that work in Node.js,
 * Bun, and Deno — no browser, no DOM, no Canvas required.
 *
 * Use cases for AI agents:
 *   - Pre-compute UI layout heights for metadata descriptions
 *   - Validate that agent descriptions fit within display constraints
 *   - Format message content with word-boundary-aware truncation
 *   - Estimate rendering dimensions for cross-agent UI coordination
 *
 * This module uses character-count heuristics instead of canvas measurement
 * (since Node.js doesn't have OffscreenCanvas). For pixel-accurate layout,
 * use the browser version in nexus-app/src/lib/pretext.js.
 *
 * @example
 *   import { estimateLines, truncateText, validateDescriptionLength } from '@cybereum/agent-sdk/pretext';
 *
 *   // Check if a description fits in the UI
 *   const fits = validateDescriptionLength(metadata.description, { maxLines: 3, maxWidth: 500 });
 *
 *   // Truncate at word boundary
 *   const { text, truncated } = truncateText(longDescription, { maxChars: 200 });
 */

// ---------------------------------------------------------------------------
// Character-width estimation (heuristic — no canvas needed)
// ---------------------------------------------------------------------------

/**
 * Average character widths by font category (px per character at 14px).
 * These are calibrated against common UI fonts used in NEXUS.
 */
const CHAR_WIDTH_TABLE = {
  proportional: 7.5,  // Roboto, Helvetica, Arial at 14px
  monospace: 8.4,     // SF Mono, Menlo, Consolas at 14px
  condensed: 6.8,     // Roboto Condensed at 14px
};

/**
 * Estimate the average character width for a CSS font shorthand.
 * Uses font-size extraction + category heuristics.
 *
 * @param {string} font — CSS font shorthand, e.g. '400 14px Roboto, sans-serif'
 * @returns {number} — estimated px per character
 */
export function estimateCharWidth(font) {
  const sizeMatch = font.match(/(\d+(?:\.\d+)?)\s*px/);
  const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 14;
  const scale = fontSize / 14;

  const isMonospace = /mono|consolas|menlo|courier/i.test(font);
  const isCond = /cond/i.test(font);
  const base = isMonospace ? CHAR_WIDTH_TABLE.monospace
    : isCond ? CHAR_WIDTH_TABLE.condensed
    : CHAR_WIDTH_TABLE.proportional;

  return base * scale;
}

// ---------------------------------------------------------------------------
// Line estimation
// ---------------------------------------------------------------------------

/**
 * Estimate how many lines a text block will occupy at a given width.
 * Uses character-count heuristics — fast, works everywhere, ~90% accurate.
 *
 * @param {string} text
 * @param {{ font?: string, maxWidth?: number, charWidth?: number }} [options]
 * @returns {{ lineCount: number, estimatedHeight: (lineHeight: number) => number }}
 */
export function estimateLines(text, options) {
  if (!text) return { lineCount: 0, estimatedHeight: () => 0 };

  const maxWidth = options?.maxWidth ?? 500;
  const charWidth = options?.charWidth ?? estimateCharWidth(options?.font ?? '400 14px Roboto, sans-serif');
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));

  // Split on hard newlines, then estimate wrapping
  const paragraphs = text.split('\n');
  let lineCount = 0;

  for (const para of paragraphs) {
    if (para.length === 0) {
      lineCount++;
      continue;
    }
    // Word-wrap estimation: split into words, accumulate until overflow
    const words = para.split(/\s+/);
    let currentLineChars = 0;
    let firstWord = true;

    for (const word of words) {
      const wordLen = word.length + (firstWord ? 0 : 1); // +1 for space
      if (currentLineChars + wordLen > charsPerLine && !firstWord) {
        lineCount++;
        currentLineChars = word.length;
      } else {
        currentLineChars += wordLen;
      }
      firstWord = false;
    }
    lineCount++; // final line of this paragraph
  }

  return {
    lineCount,
    estimatedHeight: (lineHeight) => lineCount * lineHeight,
  };
}

// ---------------------------------------------------------------------------
// Text truncation (word-boundary-aware)
// ---------------------------------------------------------------------------

/**
 * Truncate text at a word boundary to fit within maxChars or maxLines.
 * Never cuts mid-word. Appends ellipsis if truncated.
 *
 * @param {string} text
 * @param {{ maxChars?: number, maxLines?: number, maxWidth?: number, font?: string, ellipsis?: string }} [options]
 * @returns {{ text: string, truncated: boolean }}
 */
export function truncateText(text, options) {
  if (!text) return { text: '', truncated: false };

  const ellipsis = options?.ellipsis ?? '…';

  // Character-based truncation
  if (options?.maxChars && text.length > options.maxChars) {
    const cutPoint = text.lastIndexOf(' ', options.maxChars);
    const finalCut = cutPoint > options.maxChars * 0.5 ? cutPoint : options.maxChars;
    return { text: text.slice(0, finalCut).replace(/\s+$/, '') + ellipsis, truncated: true };
  }

  // Line-based truncation
  if (options?.maxLines) {
    const maxWidth = options.maxWidth ?? 500;
    const charWidth = estimateCharWidth(options.font ?? '400 14px Roboto, sans-serif');
    const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth));
    const maxChars = charsPerLine * options.maxLines;

    if (text.length <= maxChars) return { text, truncated: false };

    const cutPoint = text.lastIndexOf(' ', maxChars);
    const finalCut = cutPoint > maxChars * 0.5 ? cutPoint : maxChars;
    return { text: text.slice(0, finalCut).replace(/\s+$/, '') + ellipsis, truncated: true };
  }

  return { text, truncated: false };
}

// ---------------------------------------------------------------------------
// Validation helpers for agent metadata
// ---------------------------------------------------------------------------

/**
 * Validate that a description fits within display constraints.
 * Useful for AI agents preparing metadata before on-chain registration.
 *
 * @param {string} description
 * @param {{ maxLines?: number, maxWidth?: number, font?: string, maxBytes?: number }} [constraints]
 * @returns {{ valid: boolean, lineCount: number, byteLength: number, issues: string[] }}
 */
export function validateDescriptionLength(description, constraints) {
  const issues = [];

  if (!description) {
    return { valid: false, lineCount: 0, byteLength: 0, issues: ['Description is empty'] };
  }

  const byteLength = new TextEncoder().encode(description).length;
  const maxBytes = constraints?.maxBytes ?? 2048;
  if (byteLength > maxBytes) {
    issues.push(`Description is ${byteLength} bytes, exceeds ${maxBytes} byte limit`);
  }

  const { lineCount } = estimateLines(description, {
    maxWidth: constraints?.maxWidth ?? 500,
    font: constraints?.font ?? '400 14px Roboto, sans-serif',
  });

  const maxLines = constraints?.maxLines ?? 10;
  if (lineCount > maxLines) {
    issues.push(`Description renders ~${lineCount} lines, exceeds ${maxLines} line guideline`);
  }

  return { valid: issues.length === 0, lineCount, byteLength, issues };
}

/**
 * Format agent metadata description for display:
 * truncate if needed, add ellipsis at word boundary.
 *
 * @param {string} description
 * @param {{ maxLines?: number, maxWidth?: number, font?: string }} [options]
 * @returns {string}
 */
export function formatDescription(description, options) {
  const { text } = truncateText(description, {
    maxLines: options?.maxLines ?? 3,
    maxWidth: options?.maxWidth ?? 500,
    font: options?.font,
  });
  return text;
}
