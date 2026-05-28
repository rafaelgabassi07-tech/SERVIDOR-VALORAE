// Política operacional do Engine: decide ordem de provedores, retry budget e quando preferir stale.
// Mantém o Valorae-engine.js como núcleo, mas concentra as heurísticas para ficar auditável.

export const VALORAE_ENGINE_POLICY_VERSION = '21.11.8-engine-policy-adaptive-retry';

function boolEnv(name, fallback = false) {
  const raw = process.env?.[name];
  if (raw == null || raw === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(raw).toLowerCase());
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, Number(n || 0))); }

export function buildEngineProviderPlan({ optionProvider = '', scrapeFirst = true, sourceHealth = {}, directRetries = 1 } = {}) {
  const explicit = String(optionProvider || '').toLowerCase();
  let providers = scrapeFirst ? ['valorae-scrape', 'direct'] : ['direct', 'valorae-scrape'];
  if (explicit === 'direct') providers = ['direct'];
  if (explicit === 'valorae-scrape') providers = ['valorae-scrape'];

  const score = Number(sourceHealth?.score ?? 100);
  const status = String(sourceHealth?.status || '').toLowerCase();
  const unavailable = sourceHealth?.available === false || ['degraded', 'cooldown'].includes(status);
  const stalePreferred = unavailable || score < Number(process.env.VALORAE_ENGINE_STALE_PREFER_SCORE || 45);
  const conservative = score < Number(process.env.VALORAE_ENGINE_CONSERVATIVE_SCORE || 62);

  let retryBudget = clamp(directRetries, 0, 3);
  if (conservative) retryBudget = Math.min(retryBudget, 1);
  if (unavailable) retryBudget = 0;
  if (boolEnv('VALORAE_ENGINE_DISABLE_DIRECT_RETRY', false)) retryBudget = 0;

  return {
    version: VALORAE_ENGINE_POLICY_VERSION,
    providers,
    directRetryBudget: retryBudget,
    stalePreferred,
    conservative,
    sourceScore: score,
    sourceStatus: status || 'unknown',
    reason: unavailable ? 'source_cooldown_or_degraded' : (conservative ? 'low_source_score' : 'normal'),
  };
}
