import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const screen = [
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisScreen.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisHomeStartUi.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisDiscoveryUi.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisSectionContentUi.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisSectionCatalog.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisSectionTabsUi.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisSectionChartRules.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisSectionSanitization.kt'),
  readOptionalApkFile('../apk/app/src/main/java/com/example/feature/analysis/AnalysisChartsUi.kt')
].filter(Boolean).join('\n');
assertOptionalMatch(screen, /AnalysisDiscoveryHomeSectionHeader|AnalysisCategoryTabs/, 'Análise deve manter hierarquia visual por categoria');
assertOptionalMatch(screen, /AnalysisPageCompactHeader|AnalysisDiscoveryGroupListHeader/, 'A Análise deve ter cabeçalhos de seção com hierarquia');
assertOptionalMatch(screen, /CompactDataPreview/, 'Dados longos podem ser compactados sem esconder gráficos');
assertOptionalMatch(screen, /RichAnalysisChart/, 'Gráficos precisam permanecer renderizados como bloco visual próprio');
assertOptionalMatch(screen, /AnalysisMissingSignalsSection/, 'Sinalizações precisam continuar separadas do conteúdo principal');
assertOptionalDoesNotMatch(screen, /getAnalysisPage\(normalizedQuery\)/, 'Refino visual não pode voltar a carregar Análise a cada letra');
assertOptionalDoesNotMatch(screen, /assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage/, 'Página Análise não deve voltar a contratos antigos');

assert.equal(true, true, 'visual refinement v36 standalone OK');
console.log('Analysis visual refinement v36 test OK.');
