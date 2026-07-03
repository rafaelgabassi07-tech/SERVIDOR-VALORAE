import assert from 'node:assert/strict';
import { buildAssetSuggestions } from '../routes/assets.js';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const byName = buildAssetSuggestions('Banco do Brasil', 10);
assert.ok(byName.some(item => item.symbol === 'BBAS3'), 'busca por nome deve sugerir BBAS3 para Banco do Brasil');
assert.ok(byName.every(item => item.suggestion === true), 'sugestões não devem simular cotação');
assert.ok(byName.every(item => item.price === null && item.variationPercent === null), 'sugestões devem retornar sem preço/variação simulados');
assert.ok(byName.every(item => item.searchPolicy === 'analysis_intelligent_search_v35'), 'sugestões devem declarar política de busca inteligente');

const bySegment = buildAssetSuggestions('logistica', 10);
assert.ok(bySegment.some(item => item.symbol === 'HGLG11'), 'busca por segmento sem acento deve encontrar FIIs de logística');
assert.ok(bySegment.some(item => item.match === 'segment'), 'busca por segmento deve declarar match=segment');

const tooShort = buildAssetSuggestions('b', 10);
assert.deepEqual(tooShort, [], 'Proxy não deve sugerir com menos de 2 caracteres');

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
const client = readOptionalApkFile('../apk/app/src/main/java/com/example/data/proxy/ValoraeProxyClient.kt');
assertOptionalMatch(screen, /submittedTicker/, 'APK deve separar texto digitado do ticker efetivamente consultado');
assertOptionalMatch(screen, /recent_tickers/, 'APK deve persistir últimos pesquisados da Análise');
assertOptionalMatch(screen, /delay\(360\)/, 'APK deve aplicar debounce antes de consultar sugestões');
assertOptionalMatch(client, /searchMode" to "analysis"/, 'APK deve pedir sugestões em modo de busca da Análise');
assertOptionalMatch(client, /suggest" to "true"/, 'APK deve usar endpoint de sugestões sem capturar análise completa');
assertOptionalDoesNotMatch(screen, /getAnalysisPage\(normalizedQuery\)/, 'APK não deve carregar /api/v1/analysis automaticamente a cada ticker digitado');
assertOptionalDoesNotMatch(screen, /getAnalysisPage/, 'APK não deve carregar /api/v1/analysis pela página Análise; busca abre o modal único');
assertOptionalMatch(screen, /openAssetAnalysisModal\(target, \"Busca da Análise\"\)/, 'Busca confirmada deve abrir o modal único do ativo');
assertOptionalMatch(screen, /onSuggestionSelect = \{ openAssetAnalysisModal\(it, \"Sugestão da busca\"\) \}/, 'Sugestões da busca devem abrir o modal único');

console.log('Analysis intelligent search v35 test OK.');
