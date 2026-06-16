import assert from 'node:assert/strict';
import fs from 'node:fs';

const router = fs.readFileSync('routes/_router.js', 'utf8');
const analysisBuilder = fs.readFileSync('lib/analysis/analysis-page-response.js', 'utf8');
const analysisScreen = fs.readFileSync('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt', 'utf8');
const client = fs.readFileSync('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt', 'utf8');
const models = fs.readFileSync('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyModels.kt', 'utf8');

assert.match(router, /path === '\/analysis'/);
assert.match(router, /buildAnalysisPageResponse/);
assert.match(router, /'\/analysis'/);
assert.match(analysisBuilder, /contractVersion: CONTRACT_VERSION/);
assert.match(analysisBuilder, /AnalysisPageResponse/);
assert.match(analysisBuilder, /summary/);
assert.match(analysisBuilder, /fundamental_indicators/);
assert.match(analysisBuilder, /P\/Receita \(PSR\)/);
assert.match(analysisBuilder, /CAGR Receitas 5 anos/);
assert.doesNotMatch(analysisBuilder, /synthetic fallback|fake chart|mock chart/i);

assert.match(client, /suspend fun getAnalysisPage/);
assert.match(client, /"\/api\/v1\/analysis"/);
assert.match(client, /toAnalysisPageResponse/);
assert.match(models, /data class ValoraeAnalysisPageResponse/);

assert.match(analysisScreen, /fun AnalysisScreen/);
assert.match(analysisScreen, /getAnalysisPage/);
assert.match(analysisScreen, /AssetSummarySection/);
assert.match(analysisScreen, /FundamentalIndicatorsSection/);
assert.match(analysisScreen, /AnalysisPageResponse/);
assert.doesNotMatch(analysisScreen, /quoteOverview|assetSummary solto|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage|AssetSummaryCard|fundamentalIndicatorsSection\(/);

console.log('Analysis unique contract test OK.');
