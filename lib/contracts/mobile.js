import { RELEASE } from '../core/release.js';
import { buildPortfolioAnalysis, buildHistory, buildRankings } from '../portfolio/analysis.js';
import { buildDividendsContract } from '../portfolio/dividends-contract.js';
import { getIpcaSeries } from '../sources/ipca.js';

function flag(payload, name, defaultValue) {
  if (payload[name] === undefined || payload[name] === null || payload[name] === '') return defaultValue;
  if (typeof payload[name] === 'boolean') return payload[name];
  return !['0', 'false', 'no', 'off'].includes(String(payload[name]).toLowerCase());
}

export async function buildMobilePortfolioSync(payload = {}) {
  const startedAt = Date.now();
  const includeAnalysis = flag(payload, 'includeAnalysis', true);
  const includeHistory = flag(payload, 'includeHistory', true);
  const includeIpca = flag(payload, 'includeIpca', true);
  const includeDividends = flag(payload, 'includeDividends', true);
  const includeRankings = flag(payload, 'includeRankings', false);
  const blocks = {};
  const blockStatus = {};

  if (includeAnalysis) { blocks.analysis = buildPortfolioAnalysis(payload); blockStatus.analysis = blocks.analysis.status; }
  if (includeHistory) { blocks.history = buildHistory(payload); blockStatus.history = blocks.history.status; }
  if (includeIpca) { blocks.ipca = await getIpcaSeries(payload.months || 12); blockStatus.ipca = blocks.ipca.status; }
  if (includeDividends) { blocks.dividends = await buildDividendsContract(payload); blockStatus.dividends = blocks.dividends.status; }
  if (includeRankings) { blocks.rankings = buildRankings(payload); blockStatus.rankings = blocks.rankings.status; }

  const partial = Object.values(blockStatus).some(v => !['OK'].includes(v));
  return {
    status: 'OK',
    endpoint: 'mobile-portfolio-sync',
    source: 'mobile-portfolio-sync',
    bundleVersion: RELEASE.version,
    version: RELEASE.version,
    generatedAt: new Date().toISOString(),
    contract: { name: RELEASE.contract, version: RELEASE.contractVersion, style: 'valorae-single-request-cache-first' },
    requestedBlocks: { includeAnalysis, includeHistory, includeIpca, includeDividends, includeRankings },
    blockStatus,
    partial,
    elapsedMs: Date.now() - startedAt,
    ...blocks,
    portfolioAnalysis: blocks.analysis,
    portfolioHistory: blocks.history,
    ipcaSeries: blocks.ipca,
    dividendEvents: blocks.dividends?.events || [],
    portfolioReceivedDividends: blocks.dividends?.portfolioReceived || [],
    portfolioUpcomingDividends: blocks.dividends?.portfolioUpcoming || [],
    officialDividendEvents: blocks.dividends?.officialEvents || [],
    portfolioRanking: blocks.rankings?.portfolio || []
  };
}
