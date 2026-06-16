import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const router = fs.readFileSync('routes/_router.js', 'utf8');
const analysisBuilder = fs.readFileSync('lib/analysis/analysis-page-response.js', 'utf8');
const analysisScreen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
const client = readOptionalApkFile('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt');
const models = readOptionalApkFile('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyModels.kt');

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

assertOptionalMatch(client, /suspend fun getAnalysisPage/);
assertOptionalMatch(client, /"\/api\/v1\/analysis"/);
assertOptionalMatch(client, /toAnalysisPageResponse/);
assertOptionalMatch(models, /data class ValoraeAnalysisPageResponse/);

assertOptionalMatch(analysisScreen, /fun AnalysisScreen/);
assertOptionalMatch(analysisScreen, /getAnalysisPage/);
assertOptionalMatch(analysisScreen, /AssetSummarySection/);
assertOptionalMatch(analysisScreen, /FundamentalIndicatorsSection/);
assertOptionalMatch(analysisScreen, /AnalysisPageResponse/);
assertOptionalDoesNotMatch(analysisScreen, /quoteOverview|assetSummary solto|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage|AssetSummaryCard|fundamentalIndicatorsSection\(/);

console.log('Analysis unique contract test OK.');
