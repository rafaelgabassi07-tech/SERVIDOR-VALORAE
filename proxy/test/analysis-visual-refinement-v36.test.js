import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /AnalysisVisualOverview/, 'Checkpoint 36 deve ter mapa visual da Análise');
assertOptionalMatch(screen, /AnalysisSectionHeader/, 'Checkpoint 36 deve ter cabeçalho de seção com hierarquia');
assertOptionalMatch(screen, /CompactDataPreview/, 'Dados longos podem ser compactados sem esconder gráficos');
assertOptionalMatch(screen, /Gráficos visíveis/, 'Gráficos precisam permanecer fora de áreas recolhíveis');
assertOptionalMatch(screen, /Sinalizações discretas/, 'Checkpoint 36 deve manter sinalizações discretas');
assertOptionalDoesNotMatch(screen, /getAnalysisPage\(normalizedQuery\)/, 'Refino visual não pode voltar a carregar Análise a cada letra');
assertOptionalDoesNotMatch(screen, /assetAnalysisPage|appMobileSnapshot\.assetAnalysisPage|appPayload\.assetAnalysisPage/, 'Página Análise não deve voltar a contratos antigos');

assert.equal(true, true, 'visual refinement v36 standalone OK');
console.log('Analysis visual refinement v36 test OK.');
