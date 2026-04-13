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
import { FONTS } from '../config/designTokens.js';

export default function RichText({ specs, lineHeight = 28, className = '', gapFont, ariaLabel }) {
  const { ref, lines, height } = useRichInlineLayout(specs, lineHeight, {
    gapFont: gapFont ?? FONTS.body,
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

