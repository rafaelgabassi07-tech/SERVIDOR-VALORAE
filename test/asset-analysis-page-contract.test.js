import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
const appOfficialView = fs.readFileSync('lib/quality/app-official-view.js', 'utf8');
const analysisScreen = fs.readFileSync('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt', 'utf8');

assert.match(engine, /21\.12\.101-analysis-hybrid-statusinvest-primary/);
assert.match(engine, /analysis-v3-statusinvest-primary-investidor10-layout-no-synthetic-values/);
assert.match(engine, /assetAnalysisPage/);
assert.match(engine, /assetSummary/);
assert.match(engine, /Resumo do Ativo/);
assert.match(engine, /Resumo do FII/);
assert.match(engine, /resetBuildSummaryRows/);
assert.match(engine, /resetBuildFundamentalRows/);
assert.match(engine, /STOCK_FUNDAMENTAL_INDICATOR_FIELDS/);
assert.match(engine, /stockFundamentalIndicators/);
assert.match(engine, /StatusInvestAnalysisPrimary/);
assert.match(engine, /sourcePriority: \['StatusInvest', 'Investidor10', 'YahooChart'\]/);
assert.match(engine, /'Cotação'.*'Variação \(12M\)'.*'P\/L'.*'P\/VP'.*'DY'/s);
assert.match(appOfficialView, /assetAnalysisPage: p\.assetAnalysisPage/);
assert.match(appOfficialView, /stableRootOrder: \['assetAnalysisPage'/);
assert.match(engine, /P\/Receita \(PSR\)/);
assert.match(engine, /CAGR Receitas 5 anos/);
assert.doesNotMatch(engine, /synthetic fallback|fake chart|mock chart/i);

assert.match(analysisScreen, /fun AnalysisScreen/);
assert.match(analysisScreen, /@Composable\nprivate fun AssetSummaryCard/);
assert.match(analysisScreen, /AssetSummaryCard/);
assert.match(analysisScreen, /FundamentalIndicatorsCard/);
assert.match(analysisScreen, /fundamentalIndicatorsSection/);
assert.match(analysisScreen, /summarySection/);
assert.match(analysisScreen, /assetSummary/);
assert.match(analysisScreen, /summaryHeroRows/);
assert.match(analysisScreen, /fallbackSummaryRows/);
assert.match(analysisScreen, /fallbackFundamentalIndicatorRows/);
assert.match(analysisScreen, /inverseSurface/);
assert.doesNotMatch(analysisScreen, /Investidor10AnalysisMapCard|AnalysisRoadmapCard|AssetAnalysisOverviewCard/);

console.log('Asset analysis reset contract test OK.');
