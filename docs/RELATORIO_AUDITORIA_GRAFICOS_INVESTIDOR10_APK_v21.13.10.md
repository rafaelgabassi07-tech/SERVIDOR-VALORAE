# Relatório de auditoria — gráficos Investidor10 para APK

Versão: 21.13.10-mobile-scraper-investidor10-charts

## Objetivo

Revisar se o Valorae Proxy entrega ao APK os blocos de gráficos e fundamentos extraídos de páginas de ações e FIIs do Investidor10, mantendo um contrato simples, resiliente e próprio.

## Páginas e classes revisadas

- Ação: BBAS3 — rentabilidade, receitas e lucros, lucro x cotação, evolução patrimonial, payout, dividendos e indicadores.
- FII de tijolo: HGLG11 — informações do fundo, lista de imóveis, distribuições 12 meses, histórico de indicadores e comparação com índices/outros FIIs.
- FII de papel: KNCR11 — tipo de fundo, mandato, segmento, vacância, cotistas, VP/cota, último rendimento e histórico de indicadores.
- FII de tijolo com segmento híbrido: KNRI11 — listado como fundo de tijolo com segmento híbrido nas páginas de tipo.

## Problemas encontrados

1. O APK chama `POST /api/scraper` com `mode: fundamentos`, mas o roteador principal não executava o handler completo para essa rota.
2. O endpoint de compatibilidade devolvia o payload completo do motor, não o contrato plano esperado pela interface mobile.
3. Os gráficos financeiros canônicos estavam fortes, mas não eram espelhados nos nomes legados consumidos pelo APK:
   - `charts_financeiros.receitas_lucros`
   - `charts_financeiros.lucro_cotacao`
   - `charts_financeiros.evolucao_patrimonio`
   - `charts_financeiros.payout`
4. O gráfico de rentabilidade precisava sair em `rentabilidade_chart.profitabilities[]`, com pontos `{ date, profitability }` e `legend[]`.
5. FIIs precisavam expor campos planos como `tipo_fundo`, `segmento`, `vacancia`, `ultimo_rendimento`, `historico_indicadores`, `distribuicoes_12m` e `imoveis`.

## Implementação

- Novo adaptador próprio: `lib/compat/mobile-scraper-contract.js`.
- Roteamento real de `/api/scraper`, `/api/scraper4` e `/api/compat/scraper4` para o handler compatível.
- `mode: fundamentos` agora usa captura completa, APIs internas do Investidor10, HTML de apoio e normalização mobile.
- O retorno mantém o envelope `{ json: ... }`, preservando o comportamento esperado pelo APK.
- O contrato inclui `_coverage` para o app ou monitor identificar quais blocos chegaram preenchidos sem fabricar dados.

## Blocos entregues ao APK

### Ações

- `tipo_ativo = "acao"`
- `rentabilidade_chart`
- `revenue_geography`
- `revenue_segment`
- `charts_financeiros.receitas_lucros`
- `charts_financeiros.lucro_cotacao`
- `charts_financeiros.evolucao_patrimonio`
- `charts_financeiros.payout`
- Indicadores planos: `dy`, `pvp`, `pl`, `roe`, `roa`, `roic`, margens, dívida, payout, CAGR, valor de mercado e liquidez.

### FIIs

- `tipo_ativo = "fii"`
- `tipo_fundo`
- `segmento`
- `mandato`
- `vacancia`
- `num_cotistas`
- `vp_cota`
- `ultimo_rendimento`
- `historico_indicadores`
- `distribuicoes_12m`
- `dividend_yield_history`
- `dividend_history`
- `imoveis`
- `comparacao`

## Validações

- `npm test`: 109 test files; failures=0.
- `npm run check`: sintaxe OK.
- `npm run typecheck`: OK.
- `npm run audit:identity`: 0 ocorrências externas.
- `npm run smoke`: OK.

## Decisão de robustez

O Valorae Proxy agora mantém dois níveis de contrato:

1. Contrato canônico interno para evoluir o motor sem quebrar o produto.
2. Contrato plano mobile para o APK renderizar as telas atuais sem adaptação frágil.

Nenhum dado é inventado. Quando uma série não aparece no HTML ou nas APIs internas, o Proxy mantém o bloco vazio e registra cobertura explícita em `_coverage`.
