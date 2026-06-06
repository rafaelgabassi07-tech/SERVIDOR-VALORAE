import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ValoraeEngine, runValoraeSelfTest } from '../lib/Valorae-engine.js';
import { parseFinancialNumber, numberNormalizerStats } from '../lib/normalizers/numbers.js';
import { buildAssetIndicatorTaxonomy, analyzeAssetIndicatorCoverage, buildIndicatorEndpointView } from '../lib/quality/asset-indicator-taxonomy.js';
import { buildEngineMaturityBooster } from '../lib/quality/engine-maturity-booster.js';
import { routeManifest } from '../routes/_router.js';
import { VALORAE_SERVER_METRICS_VERSION } from '../lib/observability/server-metrics.js';

assert.equal(parseFinancialNumber('R$ 4,2 bi'), 4200000000);
assert.equal(parseFinancialNumber('R$ 8,5 mi'), 8500000);
assert.ok(numberNormalizerStats().version.includes('21.12.28'));
assert.ok(numberNormalizerStats().cache.enabled);

const stockTaxonomy = buildAssetIndicatorTaxonomy('ACAO');
const fiiTaxonomy = buildAssetIndicatorTaxonomy('FII');
assert.ok(stockTaxonomy.summary.fields >= 30);
assert.ok(fiiTaxonomy.summary.fields >= 30);
assert.ok(stockTaxonomy.groups.some(g => g.key === 'valuation'));
assert.ok(fiiTaxonomy.groups.some(g => g.key === 'vacancy'));

const payload = {
  ticker: 'PETR4',
  type: 'ACAO',
  status: 'PARTIAL',
  partial: true,
  normalized: {
    precoAtual: { value: 38.2, display: 'R$ 38,20', unit: 'BRL' },
    dividendYield: { value: 8.4, display: '8,4%', unit: '%' },
    pvp: { value: 1.25, display: '1,25', unit: 'ratio' },
    pl: { value: 6.8, display: '6,8', unit: 'ratio' },
  },
  appPayload: { metrics: { canonical: { precoAtual: { value: 38.2 }, dividendYield: { value: 8.4 }, pvp: { value: 1.25 }, pl: { value: 6.8 } } } },
  chartSeries: { series: [{ key: 'price', points: [{ x: '2024-01', y: 30 }, { x: '2024-02', y: 31 }] }] },
  appMobileSnapshot: { snapshotHash: 'abc' },
  appSyncEnvelope: { decision: 'render_without_replacing_snapshot' },
  appResponseIntegrity: { ok: true, renderSafe: true, cacheSafe: true },
  metrics: { generatedAt: '2026-05-29T00:00:00.000Z', sourcesTried: [{ provider: 'Investidor10', ok: true, status: 200 }] },
};
payload.assetIndicatorCoverage = analyzeAssetIndicatorCoverage(payload);
const view = buildIndicatorEndpointView(payload);
assert.equal(view.ticker, 'PETR4');
assert.ok(view.coverage.summary.present >= 4);
assert.ok(view.nextBestEndpoints.includes('/api/v1/asset/valuation'));

const maturity = buildEngineMaturityBooster(payload, { resolvedView: 'app', mode: 'app-production-optimized' }, {}, { view: 'app' });
assert.ok(/21\.12\.(28|29|30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|58|59|60|61|62|63|64|65)/.test(maturity.version));
assert.ok(maturity.scores.overall >= 60);
assert.equal(maturity.processingPlan.paidDependencies, false);

const self = runValoraeSelfTest();
assert.ok(self.checks.some(c => c.name === 'indicator-taxonomy-module' && c.ok));
assert.ok(self.checks.some(c => c.name === 'engine-maturity-booster-module' && c.ok));

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/asset/indicators'));
assert.ok(manifest.routes.includes('/fii/indicators'));
assert.ok(manifest.routes.includes('/engine/maturity'));
assert.match(VALORAE_SERVER_METRICS_VERSION, /^21\.12\.(30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|50|51|52|54|55|56|57|58|59|60|61|62|63|64|65)-/);

const html = fs.readFileSync('public/server.html', 'utf8');
assert.ok(html.includes('Maturidade do Engine'));
assert.ok(html.includes('Taxonomia de indicadores'));
assert.ok(html.includes('Performance e processamento'));
assert.ok(html.includes('renderEngineMaturity'));

console.log('engine-performance-maturity-v21-12-28 ok');
