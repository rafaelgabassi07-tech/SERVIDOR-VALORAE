# RELATÓRIO — Auditoria completa APK VALORAE v1.1.8 + VALORAE Proxy v21.12.56

Data: 2026-05-30  
Escopo: compatibilidade integral entre o APK VALORAE e o VALORAE Proxy, execução dos testes existentes, benchmarks existentes, verificação de funções do app que recebem dados e correções encontradas durante a auditoria.

## Resultado executivo

A auditoria encontrou e corrigiu problemas de manutenção que poderiam causar regressões futuras, mesmo com a integração funcional já existente:

1. A suíte `npm test` do Proxy não executava todos os testes `.test.js` existentes; os testes mais novos de contrato APK/Proxy podiam ficar fora da validação padrão.
2. Alguns testes antigos do Proxy estavam travados em releases específicas, especialmente `21.12.54`, e falhavam falsamente contra a release atual.
3. Um teste de HEAD usava `/api/v1/asset`, rota mais cara e dependente de caminho de dados, podendo atrasar/travar a suíte. Foi convertido para uma rota leve local.
4. Faltava um teste explícito no Proxy garantindo que as 57 rotas `/api` chamadas pelo APK continuem cobertas pelo roteador.
5. O APK ainda tinha verificadores internos presos à versão `1.1.7`; foram atualizados para a entrega `1.1.8`.
6. Foi adicionado um novo verificador do APK para auditar todos os receptores de dados do Proxy, raízes JSON, parsers, blocos opcionais, headers, diagnóstico, biometria e navegação.

## Versões entregues

- APK VALORAE: `versionCode = 11`, `versionName = "1.1.8"`.
- VALORAE Proxy: `releasePatch = "21.12.56-full-audit-benchmark-apk-compat"`.
- `package.version` do Proxy permanece `21.12.0`, mantendo o core público estável.

## Funções do APK auditadas no recebimento de informações

Foram revisadas as funções principais de recebimento/parsing do `B3NetworkService.kt`:

- `fetchAssetDataFromProxy`
- `fetchAssetData`
- `fetchAssetsData`
- `mapProxyAsset`
- `fetchHistoricalChart`
- `fetchAssetChartBundle`
- `fetchProxyComparisonSeries`
- `fetchAssetDividendEvents`
- `fetchNews`
- `fetchPortfolioAnalysis`
- `fetchMarketRankings`
- `fetchPortfolioRankings`
- `fetchLiveStockRankings`
- `fetchStockFundamentalRankings`
- `fetchFiiFundamentalRankings`
- `fetchPortfolioHistory`
- `fetchIpcaSeries`
- `fetchNextDividends`
- `fetchAssetProxyCapabilities`
- `fetchPortfolioProxyCapabilities`
- `checkReady`
- `fetchReleaseReadiness`
- `fetchSourceStatus`
- `fetchServerMetrics`
- `fetchIntegrationManifest`
- `fetchObservability`
- `fetchFields`
- `fetchOpenApi`
- `fetchProxyDiagnosticsSummary`

## Contrato JSON validado

O APK continua lendo corretamente as raízes e espelhos do Proxy:

- `appPayload`
- `appMobileSnapshot`
- `assetClassContract`
- `assetIndicatorCoverage`
- `legacyAppCompat`
- `results`
- `normalized`
- `data.*`

Também foi confirmado que o APK não descarta payloads opcionais apenas por conterem `error`/`warning`, desde que venham marcados com `appPolicy.optionalBlock`, `reliability.optionalBlock` ou endpoint opcional como `asset-history`/`news`.

## Endpoints APK x Proxy

O APK declara 57 caminhos `/api`. Foi criado o teste regressivo:

- `test/apk-consumer-endpoints-v21-12-56.test.js`

Resultado: 57/57 endpoints do APK estão cobertos pelo roteador do Proxy. Nenhuma rota ausente foi encontrada.

## Correções realizadas no Proxy

1. Adicionado `scripts/run-all-tests.js` para executar dinamicamente todos os testes `.test.js`.
2. Atualizado `npm test` para usar o runner dinâmico.
3. Adicionado `scripts/run-all-benchmarks.js` e `npm run bench:all` para rodar todos os benchmarks `benchmark*.js`.
4. Atualizados testes legados para validar a release atual sem perder checks históricos.
5. Corrigido teste `v21-5-11-final-minute-audit` para usar rota HEAD leve/local em vez de rota de ativo mais cara.
6. Atualizados metadados, manifest PWA, service worker, readiness, observabilidade e manifesto de integração para `21.12.56-full-audit-benchmark-apk-compat`.
7. Adicionado teste de cobertura das rotas consumidas pelo APK.

## Correções realizadas no APK

1. Atualizada versão do app para `1.1.8` / `versionCode 11`.
2. Atualizado `update.json` local para `1.1.8` / `latestVersionCode 11`.
3. Adicionado `scripts/verify_valorae_full_proxy_receivers_v118.py`.
4. Atualizados verificadores presos em `1.1.7`.
5. Atualizado o verificador de recomendações para não sugerir que a UI técnica Proxy+ está na barra inferior; os blocos técnicos permanecem desacoplados da navegação principal.

## Testes executados no Proxy

- `npm test`: 86 arquivos executados, 0 falhas.
- `npm run check`: 284 arquivos JS verificados.
- `node scripts/audit-route-contract.js`: OK.
- `node scripts/preflight-free-only.js`: OK.
- `node scripts/typecheck-free.js`: OK.
- `node scripts/build-vercel-safe.js`: OK.
- `node scripts/audit-release-readiness.js`: OK.
- `node scripts/audit-minutiae.js`: OK.
- `node scripts/audit-recommended-improvements.js`: OK.
- `node scripts/audit-final-maturity.js`: OK.

## Benchmarks executados no Proxy

`npm run bench:all`: 17 benchmarks executados, 0 falhas.

Inclui benchmarks de:

- confiabilidade canônica;
- extração turbo;
- notícias;
- pós-benchmark/hardening;
- scrape;
- stale-budget/latência/cache.

## Verificadores executados no APK

Executados e aprovados individualmente:

- `verify_valorae_continuous_optimization.py`
- `verify_valorae_deep_final_audit.py`
- `verify_valorae_deep_logic_pages_v116.py`
- `verify_valorae_final_consolidation.py`
- `verify_valorae_full_app_functionality.py`
- `verify_valorae_full_proxy_receivers_v118.py`
- `verify_valorae_insights_logic.py`
- `verify_valorae_loading_optimization.py`
- `verify_valorae_navigation_diagnostics_biometric_v117.py`
- `verify_valorae_optional_blocks_proxy_contract.py`
- `verify_valorae_proxy_capabilities.py`
- `verify_valorae_proxy_integration.py`
- `verify_valorae_proxy_recommendations.py`
- `verify_valorae_slow_data_performance.py`

## Smoke test local de rotas do Proxy

Rotas testadas localmente por dispatch interno:

- `/api/v1/ready` — 200
- `/api/v1/integration/manifest` — 200
- `/api/v1/source/status` — 200
- `/api/v1/asset/history?ticker=PETR4&range=1M` — 200
- `/api/v1/news?ticker=PETR4&limit=3` — 200 com bloco opcional seguro quando fonte externa indisponível

## Limitação do ambiente

O build Gradle completo do APK não pôde ser executado porque o wrapper tentou baixar `gradle-9.3.1-bin.zip` de `services.gradle.org`, mas este ambiente não possui DNS/acesso externo. Erro observado: `UnknownHostException: services.gradle.org`.

A validação foi feita por auditoria estática, verificadores internos do APK, testes do Proxy, benchmarks, smoke tests locais e validação cruzada de rotas/contrato.

## Conclusão

A integração APK/Proxy está mais robusta que a entrega anterior. O APK v1.1.8 continua consumindo o Proxy como backend central, sem scraping direto e sem dependências pagas. O Proxy v21.12.56 agora valida todos os testes existentes dinamicamente, executa todos os benchmarks existentes por comando único e possui teste regressivo específico para garantir que todas as rotas usadas pelo APK continuam disponíveis.
