import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

function extract(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `bloco ausente: ${startMarker}`);
  return source.slice(start, end);
}

function assertOrder(source, markers, label) {
  const positions = markers.map(marker => {
    const position = source.indexOf(marker);
    assert.ok(position >= 0, `${label}: marcador ausente ${marker}`);
    return position;
  });
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), `${label}: ordem divergente`);
}

const modalUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetDetailsModalUi.kt');
const newsUi = readSiblingApkFile('app/src/main/java/com/example/ui/AssetModalNewsUi.kt');
const feedService = readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPublicFeedService.kt');

if (modalUi && newsUi && feedService) {
  const stock = extract(modalUi, 'private fun StockAssetModalReadyContent(', '@Composable\nprivate fun FiiAssetModalReadyContent(');
  const fii = extract(modalUi, 'private fun FiiAssetModalReadyContent(', '@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)');

  assertOrder(stock, [
  'label = "stock_metrics"', 'label = "stock_quote_chart"', 'label = "stock_returns"',
  'label = "stock_fundamentals"', 'label = "stock_historical_indicators"', 'label = "stock_checklist"',
  'label = "stock_dividend_history"', 'label = "stock_dividend_radar"', 'label = "stock_payout"',
  'label = "stock_peers"', 'label = "stock_indices"', 'label = "stock_company_profile"',
  'label = "stock_company_data"', 'label = "stock_company_information"', 'label = "stock_revenue_region"',
  'label = "stock_revenue_business"', 'label = "stock_revenue_profit"', 'label = "stock_profit_quote"',
  'label = "stock_results_statement"', 'label = "stock_equity_evolution"', 'label = "stock_balance_sheet"',
  'label = "stock_announcements"', 'AssetModalNewsSection(ticker = cleanTicker, assetName = newsAssetName)'
], 'Ação');

assertOrder(fii, [
  '"fii_metrics"', '"fii_chart"', '"fii_returns"', '"fii_information"', '"fii_historical_indicators"',
  '"fii_indices"', '"fii_peers"', '"fii_checklist"', '"fii_distributions"', '"fii_dividend_charts"',
  '"fii_about"', '"fii_properties"', '"fii_vacancy"', '"fii_announcements"', '"fii_patrimonial"',
  '"fii_type_segment_average"', 'AssetModalNewsSection(ticker = cleanTicker, assetName = newsAssetName)'
], 'FII');

  assert.ok(newsUi.includes('query = assetName.takeIf'), 'APK deve enviar o nome do ativo como contexto de busca');
  assert.ok(newsUi.includes('assetOnly = true'), 'APK deve solicitar notícias estritas');
  assert.ok(feedService.includes('put("assetOnly", "true")'));
  assert.ok(feedService.includes('put("strictAsset", "true")'));
  assert.ok(feedService.includes('assetOnly=$assetOnly'), 'cache do APK deve segregar modo estrito');
}

const routeSource = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const engineSource = fs.readFileSync(new URL('../lib/Valorae-engine.js', import.meta.url), 'utf8');
assert.ok(routeSource.includes("if (path === '/news')") && routeSource.includes('getNews(payload)'));
assert.ok(engineSource.includes('assetOnly') && engineSource.includes('strictAsset'));
assert.ok(engineSource.includes('matchesStrictAssetNews'));
assert.ok(engineSource.includes('assetOnly=${assetOnly}'));

console.log('asset-modal-sequence-news-v324 ok');
