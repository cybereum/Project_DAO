const WORLD_BANK_GDP_URL = 'https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?format=json';

const DEFAULT_ANNUAL_LOSS = 2.6e12;

function pickLatestValue(records = []) {
  const withValue = records.find((row) => typeof row?.value === 'number' && Number.isFinite(row.value));
  return withValue || null;
}

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchLiveGovernanceMetrics() {
  try {
    const data = await fetchJsonWithTimeout(WORLD_BANK_GDP_URL);
    const records = Array.isArray(data) ? data[1] : [];
    const latest = pickLatestValue(records);

    if (!latest) throw new Error('No GDP value available.');

    const globalGdp = Number(latest.value);
    const annualCorruptionLoss = globalGdp * 0.05;
    const corruptionPerSecond = annualCorruptionLoss / 31_536_000;

    return {
      annualCorruptionLoss,
      corruptionPerSecond,
      gdpYear: String(latest.date),
      source: 'World Bank API',
      isLive: true,
    };
  } catch {
    return {
      annualCorruptionLoss: DEFAULT_ANNUAL_LOSS,
      corruptionPerSecond: DEFAULT_ANNUAL_LOSS / 31_536_000,
      gdpYear: 'Model fallback',
      source: 'Fallback estimate',
      isLive: false,
    };
  }
}
