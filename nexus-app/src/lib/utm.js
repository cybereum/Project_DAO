/**
 * UTM + Referral Attribution Engine
 *
 * Captures UTM params and referral codes on first visit, persists them
 * through the entire funnel (landing → wallet connect → first tx → lead form).
 * Every lead submission includes the full attribution context.
 */

const SESSION_KEY = 'nexus_attribution';
const REFERRAL_PREFIX = 'ref_';

// ─── Capture & persist ────────────────────────────────────────────────────────

export function captureUTM() {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const utm = {
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    term: params.get('utm_term') || '',
    content: params.get('utm_content') || '',
    ref: params.get('ref') || '',
    landingPath: window.location.pathname,
    landingTs: Date.now(),
    referrer: document.referrer || '',
  };

  // Only save if there's meaningful attribution data, or if none stored yet
  const existing = getAttribution();
  if (!existing || utm.source || utm.campaign || utm.ref) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(utm));
      // Also persist in localStorage for cross-session continuity
      if (!localStorage.getItem(SESSION_KEY)) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(utm));
      }
    } catch {
      // Storage unavailable — no-op
    }
  }
  return utm;
}

export function getAttribution() {
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (session) return JSON.parse(session);
    const local = localStorage.getItem(SESSION_KEY);
    if (local) return JSON.parse(local);
  } catch {
    // no-op
  }
  return null;
}

// ─── Referral link generation ─────────────────────────────────────────────────

export function generateReferralLink(agentAddress, baseUrl = window.location.origin) {
  if (!agentAddress) return baseUrl;
  const code = `${REFERRAL_PREFIX}${agentAddress.slice(2, 10).toLowerCase()}`;
  return `${baseUrl}/?ref=${code}&utm_source=agent_referral&utm_medium=referral&utm_campaign=agent_network`;
}

// ─── Lead submission ──────────────────────────────────────────────────────────

/**
 * Submit a lead (email + metadata) to the configured webhook endpoint.
 * Falls back to console logging in dev (no VITE_LEAD_WEBHOOK set).
 */
export async function submitLead({ email, name = '', persona = '', message = '', walletAddress = '' }) {
  const attribution = getAttribution();
  const webhookUrl = typeof import.meta !== 'undefined'
    ? import.meta.env?.VITE_LEAD_WEBHOOK || ''
    : '';

  const payload = {
    email,
    name,
    persona,
    message,
    walletAddress,
    attribution,
    submittedAt: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
  };

  if (!webhookUrl) {
    // Dev mode: log the lead payload
    console.info('[NEXUS Lead Capture]', payload);
    return { ok: true, dev: true };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok };
  } catch (err) {
    console.error('[NEXUS Lead Webhook Error]', err);
    return { ok: false, error: err.message };
  }
}

// ─── Geo-locale persona hint ──────────────────────────────────────────────────

export function getLocaleHint() {
  if (typeof Intl === 'undefined') return { country: '', language: '' };
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    const language = locale.split('-')[0] || '';
    const country = locale.split('-')[1] || '';
    return { country, language, locale };
  } catch {
    return { country: '', language: '' };
  }
}

// ─── Funnel event markers ─────────────────────────────────────────────────────

const FUNNEL_KEY = 'nexus_funnel';

export function markFunnelStep(step) {
  try {
    const existing = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '{}');
    existing[step] = Date.now();
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(existing));
  } catch {
    // no-op
  }
}

export function getFunnelSteps() {
  try {
    return JSON.parse(localStorage.getItem(FUNNEL_KEY) || '{}');
  } catch {
    return {};
  }
}
