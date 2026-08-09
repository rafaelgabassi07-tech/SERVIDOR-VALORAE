# Auditoria — Checkpoint 35 — Busca inteligente da Análise

Data: 2026-06-16

## Base

- APK base: revisão de fidelidade dos gráficos após Checkpoint 34
- Proxy base: `21.12.118-analysis-chart-source-fidelity-review`
- Patch novo: `21.12.119-analysis-intelligent-search-v35`

## Verificações

- A Análise continua consumindo dados completos somente por `/api/v1/analysis`.
- Sugestões leves usam `/api/v1/assets` com `searchMode=analysis` e `suggest=true`.
- O APK não chama mais `getAnalysisPage(normalizedQuery)` durante digitação.
- O carregamento do contrato único ocorre apenas por `submittedTicker`, após toque na sugestão ou confirmação do teclado.
- A busca por nome e segmento foi validada no Proxy com `buildAssetSuggestions`.
- Sugestões não enviam preço nem variação simulados.

## Resultado

- `npm run check`: aprovado.
- `npm test`: aprovado com 35 arquivos de teste e 0 falhas.
- `npm run audit:version`: aprovado.
- `npm run audit:identity`: aprovado.

## Limitação

Gradle do APK não foi executado porque o ambiente não possui Gradle e o pacote não contém wrapper completo executável/jar. A validação foi estática em Kotlin/JSON.
