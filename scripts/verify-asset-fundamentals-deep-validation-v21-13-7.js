process.env.VALORAE_DISABLE_EXTERNAL = '1';
import { RELEASE } from '../lib/core/release.js';
import { buildAssetDetails, getAssetHistory, _test } from '../lib/sources/asset-details.js';
import { routeManifest } from '../routes/_router.js';
if (RELEASE.version !== '21.13.7') throw new Error(`Versão inesperada: ${RELEASE.version}`);
const routes = routeManifest().routes;
for (const route of ['/asset','/asset/history','/asset/fundamentals','/mobile/portfolio-sync']) {
  if (!routes.includes(route)) throw new Error(`Rota ausente: ${route}`);
}
const details = await buildAssetDetails({ ticker: 'PETR4', timeoutMs: 10, range: '1Y' });
if (details.ticker !== 'PETR4') throw new Error('Asset details ticker inválido');
if (!details.assetChartBundle || details.results?.assetChartBundle?.ticker !== 'PETR4') throw new Error('assetChartBundle ausente');
if (!Array.isArray(details.assetChartBundle.priceHistory)) throw new Error('priceHistory não é array');

const merged = _test.mergeFundamentalSnapshots(
  { status: 'OK', indicators: { pvp: 1.1 }, indicatorCards: [{ label: 'P/VP', value: 1.1, display: '1,10' }], profile: { sector: 'Teste' }, diagnostics: [] },
  { status: 'OK', indicators: { roe: 12.3, valorDeMercado: 1000 }, indicatorCards: [{ label: 'ROE', value: 12.3, display: '12,30%' }], financialSeries: { revenueProfit: [{ label: '2024', year: '2024', netRevenue: 100, netProfit: 10 }] }, diagnostics: [] }
);
if (merged.indicatorCards.length < 2 || !merged.financialSeries.revenueProfit?.length) throw new Error('Contrato enriquecido de fundamentos inválido');

const hist = await getAssetHistory({ ticker: 'PETR4', timeoutMs: 10, range: '1Y' });
if (hist.ticker !== 'PETR4' || !Array.isArray(hist.points)) throw new Error('Histórico do ativo inválido');
console.log('VALORAE Proxy asset fundamentals deep validation v21.13.7 OK');
