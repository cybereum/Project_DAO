/**
 * Design tokens — the single source of truth for typography, layout, and
 * content constraints used across NEXUS components.
 *
 * Values here match schemas/display-constraints.json exactly.
 * Agents consume the JSON schema; the app imports this module.
 * If you change a value here, update the schema too.
 */

// ---------------------------------------------------------------------------
// Typography — CSS font shorthands + metrics
// ---------------------------------------------------------------------------

export const FONTS = Object.freeze({
  body:      '400 14px Roboto, system-ui, -apple-system, sans-serif',
  bodySmall: '400 12px Roboto, system-ui, sans-serif',
  heading:   '600 18px Orbitron, Roboto, sans-serif',
  mono:      '500 12px ui-monospace, Menlo, monospace',
  chip:      '700 11px Roboto, system-ui, sans-serif',
});

export const LINE_HEIGHTS = Object.freeze({
  body:      22,
  bodySmall: 18,
  heading:   26,
  mono:      18,
  chip:      16,
});

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const LAYOUT = Object.freeze({
  cardMaxWidth:       560,
  sidebarExpanded:    240,
  sidebarCollapsed:   64,
  mainContentPadding: 24,
  cardPadding:        20,
  chipChromeWidth:    22,
  chipHeight:         22,
  lineGap:            4,
  cardGap:            16,
  virtualListOverscan:   5,
  virtualListThreshold: 20,
});

// ---------------------------------------------------------------------------
// Content limits (recommended maxima for each content type)
// ---------------------------------------------------------------------------

export const CONTENT_LIMITS = Object.freeze({
  agentName:            { maxLength: 256, maxDisplayWidth: 300 },
  agentDescription:     { maxLength: 2048, maxBytes: 2048, maxLines: 3, maxDisplayWidth: 500 },
  paymentDescription:   { maxLength: 256, maxDisplayWidth: 400 },
  projectName:          { maxLength: 80, maxDisplayWidth: 350 },
  projectDescription:   { maxLength: 500, maxLines: 2, maxDisplayWidth: 400 },
  directMessage:        { maxLength: 2000, maxDisplayWidth: 360 },
  transferMemo:         { maxLength: 128, maxDisplayWidth: 300 },
  proposalDescription:  { maxLength: 1000, maxDisplayWidth: 500 },
  featureKitRationale:  { maxLength: 500, maxDisplayWidth: 450 },
});
