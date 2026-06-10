process.env.VALORAE_DISABLE_EXTERNAL = '1';
import { RELEASE } from '../lib/core/release.js';
import { buildAssetDetails, getAssetHistory } from '../lib/sources/asset-details.js';
import { routeManifest } from '../routes/_router.js';
if (RELEASE.version !== '21.13.5') throw new Error(`Versão inesperada: ${RELEASE.version}`);
const routes = routeManifest().routes;
for (const route of ['/asset','/asset/history','/asset/fundamentals','/mobile/portfolio-sync']) {
  if (!routes.includes(route)) throw new Error(`Rota ausente: ${route}`);
}
const details = await buildAssetDetails({ ticker: 'PETR4', timeoutMs: 10, range: '1Y' });
if (details.ticker !== 'PETR4') throw new Error('Asset details ticker inválido');
if (!details.assetChartBundle || details.results?.assetChartBundle?.ticker !== 'PETR4') throw new Error('assetChartBundle ausente');
if (!Array.isArray(details.assetChartBundle.priceHistory)) throw new Error('priceHistory não é array');
const hist = await getAssetHistory({ ticker: 'PETR4', timeoutMs: 10, range: '1Y' });
if (hist.ticker !== 'PETR4' || !Array.isArray(hist.points)) throw new Error('Histórico do ativo inválido');
console.log('VALORAE Proxy asset analysis/detail v21.13.5 OK');
