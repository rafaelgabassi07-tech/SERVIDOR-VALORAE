import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
const home = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/PortfolioHomeUi.kt');
const portfolio = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/PortfolioScreen.kt');

assertOptionalMatch(screen, /fun openAssetAnalysisModal/, 'AnalysisScreen deve centralizar abertura no modal único');
assertOptionalMatch(screen, /openAssetAnalysisModal\(target, \"Busca da Análise\"\)/, 'Busca por teclado deve abrir modal único');
assertOptionalMatch(screen, /on(?:SuggestionSelect|SelectSuggestion)\s*=\s*(?:\{ openAssetAnalysisModal\(it, \"Sugestão da busca\"\) \}|analysisActions\.onSelectSuggestion)/, 'Sugestões da busca devem abrir modal único');
assertOptionalMatch(screen, /on(?:TickerSelect|SelectCategoryTicker)\s*=\s*(?:\{ openAssetAnalysisModal\(it, \"Ativo da categoria\"\) \}|analysisActions\.onSelectCategoryTicker)/, 'Ranking/categorias da Análise devem abrir modal único');
assertOptionalMatch(screen, /openAssetAnalysisModal\(ticker, group\.analysisDiscoveryShortTitle\(\)\)/, 'Subpáginas/listas da Análise devem abrir modal único');
assertOptionalMatch(screen, /AssetDetailsModal\(/, 'Modal compartilhado precisa ser o AssetDetailsModal');
assertOptionalDoesNotMatch(screen, /ValoraeProxyClient\.getAnalysisPage/, 'Página Análise não pode buscar detalhes completos de ativo');
assertOptionalDoesNotMatch(screen, /requestAnalysis/, 'Fluxo antigo requestAnalysis deve permanecer removido');
assertOptionalMatch(home, /onTickerClick = \{ ticker -> activeAssetForSharedModal = ticker\.toHomeSharedAssetDetailsModalAsset\(assets\) \}/, 'Tickers em notícias da Home devem abrir modal único');
assertOptionalMatch(portfolio, /onTickerClick = \{ ticker -> activeNewsAssetForModal = ticker\.toNewsModalAsset\(assets\) \}/, 'Tickers da aba Notícias devem abrir modal único');
assertOptionalMatch(portfolio, /AssetDetailsModal\(/, 'Aba Notícias deve usar o modal único');

console.log('Analysis universal modal v195 test OK.');
