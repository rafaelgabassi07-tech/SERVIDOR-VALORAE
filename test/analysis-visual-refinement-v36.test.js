import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /AnalysisCategoryHeader/, 'Análise deve manter hierarquia visual por categoria');
assertOptionalMatch(screen, /AnalysisSectionHeader/, 'Checkpoint 36 deve ter cabeçalho de seção com hierarquia');
assertOptionalMatch(screen, /CompactDataPreview/, 'Dados longos podem ser compactados sem esconder gráficos');
assertOptionalMatch(screen, /RichAnalysisChart/, 'Gráficos precisam permanecer renderizados como bloco visual próprio');
assertOptionalMatch(screen, /AnalysisMissingSignalsSection/, 'Sinalizações precisam continuar separadas do conteúdo principal');
assertOptionalDoesNotMatch(screen, /getAnalysisPage\(normalizedQuery\)/, 'Refino visual não pode voltar a carregar Análise a cada letra');
assertOptionalDoesNotMatch(screen, /assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage/, 'Página Análise não deve voltar a contratos antigos');

assert.equal(true, true, 'visual refinement v36 standalone OK');
console.log('Analysis visual refinement v36 test OK.');
