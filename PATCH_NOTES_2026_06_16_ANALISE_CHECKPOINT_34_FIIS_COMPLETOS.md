# Patch 21.12.117 — Checkpoint 34: FIIs completos na Análise

Data: 2026-06-16

## Objetivo
Completar a experiência de Fundos Imobiliários na página Análise sem voltar a contratos antigos e sem simular dados ausentes.

## Implementado
- Nova seção `fii_details` no `AnalysisPageResponse` apenas para FIIs.
- Consolidação de informações do fundo: segmento, tipo, mandato, tipo de gestão, administrador, gestor, taxa de administração, público-alvo, CNPJ e prazo.
- Consolidação de indicadores específicos: DY 12M, último rendimento, rendimento por cota, P/VP, valor patrimonial por cota, patrimônio do fundo, vacância, cotistas, cotas emitidas e liquidez diária.
- Inclusão de lista de imóveis quando a fonte entrega dados reais.
- Inclusão de distribuição de ativos do fundo quando a fonte entrega percentuais reais.
- Inclusão de FIIs relacionados quando vierem de comparadores reais e sem próprio ticker.
- Gráficos específicos de FII: rendimento mensal, DY histórico, valor patrimonial, vacância/cotistas quando houver histórico e distribuição de ativos como composição.

## Regras preservadas
- A página Análise continua lendo somente `/api/v1/analysis`.
- Contrato mantido: `AnalysisPageResponse` / `26.analysis.v2`.
- Sem HTML, iframe, WebView, imagem externa ou dado simulado.
- Séries temporais continuam como `line`/`multi_line`; composição de ativos usa `donut_composition`.
- Comparações IFIX/CDI/IPCA continuam exigindo série real alinhada.

## Validação
- `npm run check` passou.
- `npm test` passou com 33 test files e failures=0.
- Novo teste regressivo: `analysis-fii-complete-v34.test.js`.
