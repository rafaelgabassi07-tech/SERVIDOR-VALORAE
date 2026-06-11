import { RELEASE } from '../core/release.js';
import { buildPortfolioAnalysis, buildRealMarketHistory, buildRankings } from '../portfolio/analysis.js';
import { buildMarketMovers } from '../sources/quotes.js';
import { buildDividendsContract } from '../portfolio/dividends-contract.js';
import { getIpcaSeries } from '../sources/ipca.js';

function flag(payload, name, defaultValue) {
  if (payload[name] === undefined || payload[name] === null || payload[name] === '') return defaultValue;
  if (typeof payload[name] === 'boolean') return payload[name];
  return !['0', 'false', 'no', 'off'].includes(String(payload[name]).toLowerCase());
}


function millisFromAny(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? (n > 10_000_000_000 ? n : n * 1000) : 0;
  }
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function monthsFromStartMillis(startMillis = 0) {
  if (!startMillis) return 0;
  const start = new Date(startMillis);
  const now = new Date();
  if (!Number.isFinite(start.getTime()) || start > now) return 0;
  return Math.max(1, (now.getUTCFullYear() - start.getUTCFullYear()) * 12 + (now.getUTCMonth() - start.getUTCMonth()) + 1);
}

function portfolioHistoryMonths(payload = {}) {
  const requested = Number(payload.historyMonths || payload.months || 12);
  const candidates = [payload.startDate, payload.firstPurchaseDate, payload.firstPurchaseAt]
    .map(millisFromAny)
    .filter(Boolean);
  for (const p of Array.isArray(payload.positions) ? payload.positions : []) {
    candidates.push(millisFromAny(p?.firstPurchaseAt || p?.firstPurchaseDate || p?.purchaseDate || p?.date));
  }
  for (const tx of Array.isArray(payload.transactions) ? payload.transactions : []) {
    candidates.push(millisFromAny(tx?.dateMillis || tx?.timestampMillis || tx?.timeMillis || tx?.date || tx?.executedAt || tx?.data));
  }
  const age = monthsFromStartMillis(Math.min(...candidates.filter(Boolean)));
  const safeRequested = Number.isFinite(requested) && requested > 0 ? requested : 12;
  return Math.max(1, Math.min(120, Math.max(safeRequested, age || 0)));
}

async function safeBlock(name, enabled, producer) {
  if (!enabled) return [name, undefined, 'SKIPPED'];
  try {
    const value = await producer();
    return [name, value, value?.status || 'OK'];
  } catch (error) {
    return [name, { status: 'ERROR', error: error?.message || String(error) }, 'ERROR'];
  }
}

async function safeBlockWithTimeout(name, enabled, timeoutMs, producer, timeoutValue = undefined) {
  if (!enabled) return [name, undefined, 'SKIPPED'];
  const limit = Number(timeoutMs || 0);
  if (!Number.isFinite(limit) || limit <= 0) return safeBlock(name, enabled, producer);
  let timer;
  try {
    const timeout = new Promise(resolve => {
      timer = setTimeout(() => resolve([name, timeoutValue ?? { status: 'PARTIAL', points: [], history: [], series: [], events: [], reason: `${name}-deadline-exceeded` }, 'PARTIAL']), limit);
    });
    return await Promise.race([safeBlock(name, enabled, producer), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function buildMobilePortfolioSync(payload = {}) {
  const startedAt = Date.now();
  const includeAnalysis = flag(payload, 'includeAnalysis', true);
  const includeHistory = flag(payload, 'includeHistory', true);
  const includeIpca = flag(payload, 'includeIpca', true);
  const includeDividends = flag(payload, 'includeDividends', true);
  const includeRankings = flag(payload, 'includeRankings', false);

  // O contrato mobile precisa entregar IPCA/histórico mesmo quando a coleta de
  // proventos estiver lenta. Por isso os blocos rodam em paralelo e o histórico
  // não espera a Agenda; se houver proventos confirmados em cache eles continuam
  // vindo no bloco próprio, mas a página Rentabilidade vs IPCA+ não fica bloqueada.
  const historyMonths = portfolioHistoryMonths(payload);
  const normalizedPayload = { ...payload, historyMonths, months: Math.max(Number(payload.months || 0) || 0, historyMonths) };

  const results = await Promise.all([
    safeBlock('analysis', includeAnalysis, () => buildPortfolioAnalysis(normalizedPayload)),
    safeBlock('history', includeHistory, () => buildRealMarketHistory(normalizedPayload)),
    safeBlock('ipca', includeIpca, () => getIpcaSeries(historyMonths)),
    safeBlockWithTimeout('dividends', includeDividends, Number(payload.dividendsDeadlineMs || payload.routeDeadlineMs || (normalizedPayload.mode === 'deep-background' ? 6500 : 2600)), () => buildDividendsContract(normalizedPayload), { status: 'PARTIAL', sourceStatus: 'DEFERRED', events: [], officialEvents: [], portfolioReceived: [], portfolioUpcoming: [], portfolioUpcomingAll: [], portfolioAgenda: [], reason: 'dividends-deferred-to-dedicated-route' }),
    safeBlock('rankings', includeRankings, () => {
      const positions = Array.isArray(payload.positions) ? payload.positions : [];
      const source = String(payload.source || '').toLowerCase();
      if (!positions.length || source === 'home') return buildMarketMovers(payload);
      return buildRankings(payload);
    })
  ]);

  const blocks = {};
  const blockStatus = {};
  for (const [name, value, status] of results) {
    if (value !== undefined) blocks[name] = value;
    blockStatus[name] = status;
  }

  const partial = Object.values(blockStatus).some(v => !['OK', 'SKIPPED', 'EMPTY'].includes(v));
  return {
    status: 'OK',
    endpoint: 'mobile-portfolio-sync',
    source: 'mobile-portfolio-sync',
    bundleVersion: RELEASE.version,
    version: RELEASE.version,
    generatedAt: new Date().toISOString(),
    contract: { name: RELEASE.contract, version: RELEASE.contractVersion, style: 'valorae-single-request-cache-first' },
    requestedBlocks: { includeAnalysis, includeHistory, includeIpca, includeDividends, includeRankings, historyMonths },
    blockStatus,
    partial,
    elapsedMs: Date.now() - startedAt,
    ...blocks,
    portfolioAnalysis: blocks.analysis,
    // Aliases mobile devem ser arrays prontos para o APK; os objetos completos continuam em `history` e `ipca`.
    portfolioHistory: blocks.history?.points || blocks.history?.history || blocks.history?.series || [],
    historyPoints: blocks.history?.points || blocks.history?.history || blocks.history?.series || [],
    ipcaSeries: blocks.ipca?.points || blocks.ipca?.series || blocks.ipca?.items || [],
    ipcaPoints: blocks.ipca?.points || blocks.ipca?.series || blocks.ipca?.items || [],
    dividendEvents: blocks.dividends?.events || [],
    portfolioReceivedDividends: blocks.dividends?.portfolioReceived || [],
    portfolioUpcomingDividends: blocks.dividends?.portfolioUpcoming || [],
    portfolioUpcomingAll: blocks.dividends?.portfolioUpcomingAll || [],
    portfolioAgenda: blocks.dividends?.portfolioAgenda || [],
    officialDividendEvents: blocks.dividends?.officialEvents || [],
    officialFutureEvents: blocks.dividends?.officialFutureEvents || [],
    officialUpcomingEvents: blocks.dividends?.officialUpcomingEvents || [],
    officialAnnouncedEvents: blocks.dividends?.officialAnnouncedEvents || [],
    allOfficialFuturePayments: blocks.dividends?.allOfficialFuturePayments || [],
    portfolioRanking: blocks.rankings?.portfolio || blocks.rankings?.items || [],
    liveMarketRanking: blocks.rankings
  };
}
