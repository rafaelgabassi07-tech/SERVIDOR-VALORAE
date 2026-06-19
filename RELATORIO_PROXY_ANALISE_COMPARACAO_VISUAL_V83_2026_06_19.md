# Relatório — Proxy v83 — Análise: Comparação visual

## Versão

- Core: 21.12.0
- Patch: 21.12.146-analysis-comparison-visual-v83

## Melhorias aplicadas

- `/api/v1/assets?peerOf=...` mantém `strictSameSector=true` e `searchPolicy=analysis_same_sector_suggestions_v83`.
- Sugestões setoriais incluem `displayLabel`, `visualGroupLabel` e `uiRole=sector_peer_card` para apoiar UI em cartões.
- Resposta geral inclui `uiPolicy` e `visualHints` para orientar apresentação mobile, estado vazio e aviso de comparação manual.
- Preservado o comportamento sem simular preço, variação ou recomendação.

## Validação executada

- `node scripts/check-syntax.js` OK.
- `npm test` OK: 60 arquivos de teste, 0 falhas.
- Novo teste: `test/analysis-comparison-visual-v83.test.js`.
