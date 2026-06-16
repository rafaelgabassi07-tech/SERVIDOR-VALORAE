import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
const analysisScreen = fs.readFileSync('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt', 'utf8');

assert.match(engine, /21\.12\.99-analysis-reset-clean-summary/);
assert.match(engine, /analysis-reset-v1-real-values-only-no-legacy-analysis-renderer-no-synthetic-values/);
assert.match(engine, /assetAnalysisPage/);
assert.match(engine, /assetSummary/);
assert.match(engine, /Resumo do Ativo/);
assert.match(engine, /Resumo do FII/);
assert.match(engine, /resetBuildSummaryRows/);
assert.match(engine, /resetBuildFundamentalRows/);
assert.doesNotMatch(engine, /synthetic fallback|fake chart|mock chart/i);

assert.match(analysisScreen, /fun AnalysisScreen/);
assert.match(analysisScreen, /AssetSummaryCard/);
assert.match(analysisScreen, /summarySection/);
assert.match(analysisScreen, /assetSummary/);
assert.doesNotMatch(analysisScreen, /Investidor10AnalysisMapCard|AnalysisRoadmapCard|AssetAnalysisOverviewCard/);

console.log('Asset analysis reset contract test OK.');
