# Patch Notes — 2026-06-16 — Checkpoint 37: Auditoria final da Análise

Patch: `21.12.121-analysis-final-audit-v37`

## Objetivo
Encerrar a rodada da página Análise com auditoria final de contrato, renderização, fontes, estados de erro/parcial e preservação dos modais antigos.

## Validações adicionadas
- Ticker inexistente não gera dado falso, não marca resposta como OK e mostra sinalizações discretas.
- Resposta parcial com resumo real deixa apenas a seção correspondente como pronta e não gera sinalização pendente indevida.
- `fii_details` aparece somente para FIIs e não aparece para ações.
- Comparadores exigem séries reais, fonte explícita e períodos alinhados.
- Comparador com flag `simulated`, `synthetic`, `fake`, `proxyTickerUsed`, `mocked` ou equivalente dentro de `series[]`/`points[]` é descartado.
- Gráficos temporais não voltam para `bar`/`bar_line`.
- `Lucro x Cotação` permanece `multi_line`.
- APK permanece com Canvas nativo: `drawLine` para séries e `drawArc` para composições.

## Regras preservadas
- Página Análise usa somente `/api/v1/analysis` para carregar dados completos.
- Contrato: `AnalysisPageResponse`.
- `contractVersion = 26.analysis.v2`.
- Sem HTML, iframe, WebView, imagem externa ou dado simulado.
- Contratos antigos preservados para outros modais, mas não usados pela tela Análise.

## Testes
- Novo teste: `test/analysis-final-audit-v37.test.js`.
- Auditorias de versão e identidade continuam obrigatórias.
