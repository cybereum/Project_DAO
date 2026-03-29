import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  estimateCharWidth,
  estimateLines,
  truncateText,
  validateDescriptionLength,
  formatDescription,
} from '../pretext.js';

// ---------------------------------------------------------------------------
// estimateCharWidth
// ---------------------------------------------------------------------------

describe('estimateCharWidth', () => {
  it('returns proportional width for standard fonts', () => {
    const w = estimateCharWidth('400 14px Roboto, sans-serif');
    assert.equal(w, 7.5);
  });

  it('returns monospace width for monospace fonts', () => {
    const w = estimateCharWidth('500 14px ui-monospace, Menlo, monospace');
    assert.equal(w, 8.4);
  });

  it('returns condensed width for condensed fonts', () => {
    const w = estimateCharWidth('400 14px Roboto Condensed, sans-serif');
    assert.equal(w, 6.8);
  });

  it('scales with font size', () => {
    const w14 = estimateCharWidth('400 14px Roboto, sans-serif');
    const w28 = estimateCharWidth('400 28px Roboto, sans-serif');
    assert.equal(w28, w14 * 2);
  });

  it('defaults to 14px when no size found', () => {
    const w = estimateCharWidth('Roboto, sans-serif');
    assert.equal(w, 7.5); // proportional at 14px
  });
});

// ---------------------------------------------------------------------------
// estimateLines
// ---------------------------------------------------------------------------

describe('estimateLines', () => {
  it('returns 0 lines for empty text', () => {
    assert.equal(estimateLines('').lineCount, 0);
    assert.equal(estimateLines(null).lineCount, 0);
    assert.equal(estimateLines(undefined).lineCount, 0);
  });

  it('returns 1 line for short text', () => {
    assert.equal(estimateLines('hello', { maxWidth: 500 }).lineCount, 1);
  });

  it('counts hard newlines', () => {
    assert.equal(estimateLines('line1\nline2\nline3').lineCount, 3);
  });

  it('counts multiple consecutive newlines', () => {
    assert.equal(estimateLines('a\n\nb').lineCount, 3);
  });

  it('wraps long text without spaces', () => {
    const longWord = 'a'.repeat(200);
    // At 7.5px/char and 500px width => ~66 chars/line
    // 200 chars => should still be 1 line (no word-break splitting in this heuristic)
    const result = estimateLines(longWord, { maxWidth: 500 });
    // Single word never breaks in word-wrap heuristic, counts as 1 line
    assert.equal(result.lineCount, 1);
  });

  it('wraps long text with spaces', () => {
    // ~66 chars per line at default width
    const words = Array(20).fill('hello').join(' '); // 20 words, ~120 chars
    const result = estimateLines(words, { maxWidth: 500 });
    assert.ok(result.lineCount >= 2, `Expected >=2 lines, got ${result.lineCount}`);
  });

  it('estimatedHeight works correctly', () => {
    const { estimatedHeight, lineCount } = estimateLines('hello');
    assert.equal(estimatedHeight(22), lineCount * 22);
  });

  it('handles unicode/emoji', () => {
    const emoji = 'Hello world! 🎉🎊✨ This is a test.';
    const result = estimateLines(emoji, { maxWidth: 500 });
    assert.ok(result.lineCount >= 1);
  });
});

// ---------------------------------------------------------------------------
// truncateText
// ---------------------------------------------------------------------------

describe('truncateText', () => {
  it('returns empty for empty input', () => {
    const r = truncateText('');
    assert.equal(r.text, '');
    assert.equal(r.truncated, false);
  });

  it('returns original text when under maxChars', () => {
    const r = truncateText('hello world', { maxChars: 100 });
    assert.equal(r.text, 'hello world');
    assert.equal(r.truncated, false);
  });

  it('truncates at word boundary with maxChars', () => {
    const r = truncateText('hello beautiful world', { maxChars: 15 });
    assert.equal(r.truncated, true);
    assert.ok(!r.text.includes('world'), 'Should not contain "world"');
    assert.ok(r.text.endsWith('…'), 'Should end with ellipsis');
  });

  it('uses custom ellipsis', () => {
    const r = truncateText('hello beautiful world', { maxChars: 10, ellipsis: '...' });
    assert.ok(r.text.endsWith('...'));
  });

  it('truncates by maxLines', () => {
    const longText = Array(50).fill('word').join(' ');
    const r = truncateText(longText, { maxLines: 1, maxWidth: 100 });
    assert.equal(r.truncated, true);
    assert.ok(r.text.length < longText.length);
  });

  it('does not truncate short text by maxLines', () => {
    const r = truncateText('hello', { maxLines: 3, maxWidth: 500 });
    assert.equal(r.truncated, false);
    assert.equal(r.text, 'hello');
  });

  it('returns original if no constraints', () => {
    const r = truncateText('hello world');
    assert.equal(r.text, 'hello world');
    assert.equal(r.truncated, false);
  });
});

// ---------------------------------------------------------------------------
// validateDescriptionLength
// ---------------------------------------------------------------------------

describe('validateDescriptionLength', () => {
  it('fails on empty description', () => {
    const r = validateDescriptionLength('');
    assert.equal(r.valid, false);
    assert.ok(r.issues.length > 0);
  });

  it('passes for short description', () => {
    const r = validateDescriptionLength('A simple agent.');
    assert.equal(r.valid, true);
    assert.equal(r.issues.length, 0);
  });

  it('fails when byte limit exceeded', () => {
    const longDesc = 'a'.repeat(3000);
    const r = validateDescriptionLength(longDesc, { maxBytes: 2048 });
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.includes('bytes')));
  });

  it('reports correct byte length for multibyte chars', () => {
    const emoji = '🎉'.repeat(100); // Each emoji is 4 bytes
    const r = validateDescriptionLength(emoji, { maxBytes: 200 });
    assert.equal(r.byteLength, 400);
    assert.equal(r.valid, false);
  });

  it('fails when line count exceeded', () => {
    const manyLines = Array(20).fill('This is a line of text.').join('\n');
    const r = validateDescriptionLength(manyLines, { maxLines: 5 });
    assert.equal(r.valid, false);
    assert.ok(r.issues.some(i => i.includes('lines')));
  });
});

// ---------------------------------------------------------------------------
// formatDescription
// ---------------------------------------------------------------------------

describe('formatDescription', () => {
  it('returns original for short text', () => {
    assert.equal(formatDescription('Short.'), 'Short.');
  });

  it('truncates long text', () => {
    const long = Array(100).fill('word').join(' ');
    const result = formatDescription(long, { maxLines: 1, maxWidth: 100 });
    assert.ok(result.length < long.length);
    assert.ok(result.endsWith('…'));
  });
});
