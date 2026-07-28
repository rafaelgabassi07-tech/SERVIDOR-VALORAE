import assert from 'node:assert/strict';
import { routeManifest, _test } from '../routes/_router.js';

const manifest = routeManifest();
assert.ok(manifest.routes.includes('/mobile/alerts'));
assert.deepEqual(_test.routeMethods('/mobile/alerts'), ['POST']);

const empty = await _test.buildMobileAlerts({
  includeQuotes: false,
  includeDividends: false,
  includeNews: false,
  symbols: ['PETR4'],
});
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.endpoint, 'mobile-alerts');
assert.deepEqual(empty.blockStatus, { quotes: 'SKIPPED', dividends: 'SKIPPED', news: 'SKIPPED' });
assert.deepEqual(empty.quotes, []);
assert.equal(empty.dividends, null);
assert.deepEqual(empty.news, []);

const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../routes/_router.js', import.meta.url), 'utf8'));
assert.match(source, /includeFundamentals:\s*false/);
assert.match(source, /refresh:\s*false/);
assert.match(source, /nocache:\s*false/);
assert.match(source, /Promise\.allSettled/);
assert.match(source, /positions: Array\.isArray\(payload\.positions\)/);
assert.match(source, /assetOnly:\s*true/);
assert.match(source, /historyMonths:\s*Math\.min\(180, Math\.max\(0,/);
assert.match(source, /source:\s*requestSource/);
const alertsSource = source.slice(source.indexOf('async function buildMobileAlerts'), source.indexOf('function comparisonPointsFromHistory'));
assert.doesNotMatch(alertsSource, /getNews\(\{\s*\.\.\.payload/s, 'notícias não devem receber o payload financeiro completo');
console.log('mobile alerts on-demand v397 OK');
