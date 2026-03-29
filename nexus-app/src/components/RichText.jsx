/**
 * RichText — Renders mixed inline content (text runs, chips, code spans, links)
 * using Pretext's reflow-free layout engine.
 *
 * Inspired by chenglou/pretext rich-note demo. Text wraps at word boundaries;
 * chips/badges are atomic and never break. Layout is pure arithmetic — resize
 * triggers ~0.01ms recompute, not browser reflow.
 *
 * Accessibility:
 *   - Hidden <span> provides full plain-text to screen readers
 *   - Visual layout is aria-hidden (absolute-positioned lines aren't navigable)
 *   - Chip elements include role="status" for semantic meaning
 *
 * Usage:
 *   <RichText
 *     specs={[
 *       { kind: 'text', text: 'Ship ', font: BODY_FONT },
 *       { kind: 'chip', label: '@maya', font: CHIP_FONT, className: 'chip--mention', chromeWidth: 22 },
 *       { kind: 'text', text: ' card once ', font: BODY_FONT },
 *       { kind: 'text', text: 'pre-wrap', font: CODE_FONT, className: 'rich-code' },
 *     ]}
 *     lineHeight={28}
 *   />
 */

import { useMemo } from 'react';
import { useRichInlineLayout } from '../lib/usePretext.js';
import { specsToPlainText } from '../lib/pretext.js';

// Default NEXUS fonts matching index.css
const BODY_FONT = '400 14px Roboto, system-ui, sans-serif';

export default function RichText({ specs, lineHeight = 28, className = '', gapFont, ariaLabel }) {
  const { ref, lines, height } = useRichInlineLayout(specs, lineHeight, {
    gapFont: gapFont ?? BODY_FONT,
  });

  // Build accessible plain-text for screen readers
  const plainText = useMemo(() => specs?.length ? specsToPlainText(specs) : '', [specs]);

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ height: height || undefined, minHeight: lineHeight }}
      role="text"
      aria-label={ariaLabel ?? plainText}
    >
      {/* Screen-reader-only: full plain text in natural reading order */}
      <span className="sr-only">{plainText}</span>

      {/* Visual layout: absolutely-positioned lines — hidden from assistive tech */}
      <div aria-hidden="true">
        {lines.map((line, li) => (
          <div
            key={li}
            className="absolute left-0 flex items-baseline flex-nowrap"
            style={{ top: li * lineHeight }}
          >
            {line.fragments.map((frag, fi) => (
              <span
                key={fi}
                className={`inline-block whitespace-pre ${frag.className ?? ''}`}
                style={frag.leadingGap > 0 ? { marginLeft: frag.leadingGap } : undefined}
              >
                {frag.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pre-built chip/badge styles matching NEXUS design language
// ---------------------------------------------------------------------------

const chipBase = 'inline-flex items-center px-2.5 min-h-[22px] rounded-full text-xs font-bold whitespace-nowrap border';

export const CHIP_STYLES = {
  status:   `${chipBase} bg-nexus-cyan/10 text-nexus-cyan border-nexus-cyan/20`,
  success:  `${chipBase} bg-nexus-green/10 text-nexus-green border-nexus-green/20`,
  warning:  `${chipBase} bg-nexus-amber/10 text-nexus-amber border-nexus-amber/20`,
  danger:   `${chipBase} bg-nexus-red/10 text-nexus-red border-nexus-red/20`,
  info:     `${chipBase} bg-nexus-purple/10 text-nexus-purple border-nexus-purple/20`,
  neutral:  `${chipBase} bg-white/5 text-nexus-text-dim border-nexus-border`,
  mention:  `${chipBase} bg-nexus-cyan/15 text-nexus-cyan border-nexus-cyan/25`,
};

export const RICH_TEXT_STYLES = {
  code: 'px-1.5 py-0.5 rounded-md bg-white/8 font-mono text-xs text-nexus-text',
  link: 'text-nexus-cyan underline underline-offset-2 decoration-1',
  bold: 'font-semibold text-nexus-text',
  dim: 'text-nexus-text-dim',
};

// ---------------------------------------------------------------------------
// Helper: build specs from a simple markup DSL
// ---------------------------------------------------------------------------

/**
 * Parse simple inline markup into specs array.
 * Supports: `code`, **bold**, [link], {chip:tone:label}
 *
 * Example:
 *   parseRichSpecs("Ship `pre-wrap` for {chip:status:blocked} by **vertical text**")
 *
 * @param {string} markup
 * @param {{ bodyFont?: string, codeFont?: string, chipFont?: string }} [fonts]
 * @returns {Array<import('../lib/pretext.js').InlineSpec|import('../lib/pretext.js').ChipSpec>}
 */
export function parseRichSpecs(markup, fonts) {
  const bodyFont = fonts?.bodyFont ?? '400 14px Roboto, system-ui, sans-serif';
  const codeFont = fonts?.codeFont ?? '500 12px ui-monospace, monospace';
  const chipFont = fonts?.chipFont ?? '700 11px Roboto, system-ui, sans-serif';

  const specs = [];
  // Regex: `code`, **bold**, {chip:tone:label}, or plain text
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\{chip:(\w+):([^}]+)\}|([^`*{]+)/g;
  let match;

  while ((match = pattern.exec(markup)) !== null) {
    if (match[1] !== undefined) {
      // `code`
      specs.push({ kind: 'text', text: match[1], font: codeFont, className: RICH_TEXT_STYLES.code, chromeWidth: 12 });
    } else if (match[2] !== undefined) {
      // **bold**
      specs.push({ kind: 'text', text: match[2], font: bodyFont, className: RICH_TEXT_STYLES.bold });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      // {chip:tone:label}
      const tone = match[3];
      const label = match[4];
      specs.push({ kind: 'chip', label, font: chipFont, className: CHIP_STYLES[tone] ?? CHIP_STYLES.neutral, chromeWidth: 22 });
    } else if (match[5] !== undefined) {
      // plain text
      specs.push({ kind: 'text', text: match[5], font: bodyFont });
    }
  }

  return specs;
}
