## 2026-07-05 — Proxy v258 / patch 21.12.287-stock-historical-indicators-layout-v258
- Contrato de ação atualizado para `26.asset-modal.stock.v39`.
- Histórico de Indicadores Fundamentalistas agora filtra metadados (`description`, descrição, tooltip, notas, source/status) antes de montar colunas e células.
- Quando o REST entrega uma série longa, o Proxy separa automaticamente `5y` e `10y` com `Atual` + anos em ordem decrescente.
- Adicionado teste regressivo para impedir descriptions dentro da tabela e validar os anos superiores 5A/10A.

## 2026-07-05 — Proxy v257 / patch 21.12.286-stock-historical-indicators-rest-i10-audit-v257

- Contrato de ação atualizado para `26.asset-modal.stock.v38`.
- Auditado o parser do Histórico de Indicadores Fundamentalistas via REST Investidor10 para corrigir o cenário em que somente `P/L` e `P/Receita (PSR)` eram aproveitados.
- Adicionado suporte a payloads em objeto por métrica, chaves camelCase, linhas com `id`/`slug`/`code`/`metricName` e séries em `values`/`data` com colunas herdadas de `periods`/`years`.
- Aliases reforçados para P/VP, Dividend Yield, Payout, margens, EV/Ebitda, P/Ebit, ROE, ROIC, endividamento, liquidez e CAGRs.
- Mantida a política sem fallback PETR4/GGRC11, sem mock e sem dado simulado em produção.

## 2026-07-05 — Proxy v255 / patch 21.12.284-stock-modal-integrated-i10-v255

- Contrato de ação atualizado para `26.asset-modal.stock.v36`.
- Adicionado `sectionReadiness` no contrato do modal de ação para auditar Balanço Patrimonial, Regiões de Receita, Negócios de Receita, Dados sobre a Empresa, Informações sobre a Empresa e Posição Acionária.
- `sectionReadiness` só marca `ready=true` quando há dados reais suficientes capturados do Investidor10.
- Mantida a política sem fallback PETR4/GGRC11, sem mock e sem dado simulado em produção.

# v254 — Posição acionária no modal de ações (2026-07-05)

- Contrato de ação atualizado para `26.asset-modal.stock.v35`.
- Corrigido parser de `shareholdingPosition` para priorizar a seção real `POSIÇÃO ACIONÁRIA` do Investidor10.
- Corrigida extração quando existe texto genérico de `acionistas` antes da seção do ativo.
- Suporte reforçado para tabela HTML, texto indexado e payloads JS/API com Acionista, % ON, % PN e % Total.
- Sem fallback PETR4/GGRC11, sem mock e sem dado simulado.

# v253 — Informações sobre a empresa no modal de ações (2026-07-05)

- Contrato de ação atualizado para `26.asset-modal.stock.v34`.
- Adicionado `companyInformation` com dados reais do bloco `INFORMAÇÕES SOBRE A EMPRESA` do Investidor10.
- Normalização de valores simples/detalhados, percentuais e campos textuais.
- Sem fallback fixo por ticker e sem dados simulados.

# v253 — Informações sobre a empresa no modal de ações (2026-07-05)

- Contrato de ação atualizado para `26.asset-modal.stock.v34`.
- Adicionado `companyData` para o bloco `DADOS SOBRE A EMPRESA` do Investidor10.
- Campos normalizados: Nome da Empresa, CNPJ, Ano de estreia na bolsa, Número de funcionários, Ano de fundação, Papéis da empresa e Papéis Fracionados.
- Sem fallback PETR4/GGRC11, sem mock e sem dado inventado.

# v251 — Negócios que geram receita no modal de ações (2026-07-05)

- Contrato de ação atualizado para `26.asset-modal.stock.v32`.
- Corrigida a extração de `companyBussinesRevenuesChartPie`/`companyBussinessRevenuesChartPie`/`companyBusinessRevenuesChartPie` do Investidor10 quando o bloco vem em JS inline, JSON.parse, Chart.js, Highcharts, tuplas ou objeto por negócio/produto.
- Preservados negócio/produto, valor exibido, percentual, total e ano da seção `Negócios que geram receita`.
- Adicionadas tentativas complementares para rotas de receita por negócio, segmento e produto sem fallback estático.
- Política mantida: sem PETR4/GGRC11 fixo, sem mock e sem dado inventado.

# v250 — Regiões onde gera receita no modal de ações (2026-07-05)

- Contrato de ação atualizado para `26.asset-modal.stock.v31`.
- Corrigida a extração de `companyRevenuesChartPie`/`revenueGeography` do Investidor10 quando o bloco vem em JS inline, JSON.parse, Chart.js, Highcharts ou objeto por região.
- Preservados valores, percentuais, total e ano da seção `Regiões onde a empresa gera receita`.
- Sem fallback PETR4/GGRC11, sem mock e sem dado inventado.

## v249 — Balanço Patrimonial de ações via Investidor10 — 2026-07-05

- Contrato de ação atualizado para `26.asset-modal.stock.v30`.
- Corrige o Balanço Patrimonial de ações quando o modal recebia apenas `Patrimônio Líquido Consolidado - (R$)`.
- Adiciona rotas reais/tabela dinâmica do Investidor10 para `ativospassivos/table`, `balancopatrimonial/table` e `patrimonial/table`.
- Normaliza linhas `Ativo Total`, `Ativo Circulante`, `Ativo Não Circulante`, `Passivo Total`, `Passivo Circulante`, `Passivo Não Circulante` e `Patrimônio Líquido Consolidado`.
- Ignora colunas percentuais AV%/AH% para não confundir percentual com valor financeiro.
- Sem fallback PETR4/GGRC11, sem mock e sem dado fabricado.

## v248 — Checklist de ações via ranking oficial Investidor10 — 2026-07-05

- Contrato de ação atualizado para `26.asset-modal.stock.v29`.
- Corrigido o Checklist Buy and Hold de ações que aparecia com os 10 critérios, mas todos sem seleção.
- O Proxy agora consulta o ranking oficial Buy and Hold do Investidor10 quando o HTML do ativo não expõe a marcação dos checkboxes.
- Score oficial `100/100` marca os 10 critérios como atendidos; scores menores usam apenas evidências reais por métrica e mantêm `UNKNOWN` quando faltar prova.
- Sem fallback PETR4/GGRC11, sem mock e sem dado fabricado.

## v247 — Posição Acionária de ações via Investidor10 — 2026-07-05

- Remove Histórico de Indicadores Fundamentalistas do modal de ação.
- Corrige Posição Acionária de ações com parsing real de Investidor10 e aliases `% ON`, `% PN`, `% Total`.
- Sem fallback fixo, sem mock e sem dado fabricado.

## 2026-07-04 — Proxy v245 / patch 21.12.274-stock-modal-i10-integrity-v245

Auditoria reforçada do modal único de ação para Payout, Histórico de Indicadores Fundamentalistas e Checklist Buy and Hold via Investidor10.

- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v26`.
- Payout passa a respeitar unidade real do Investidor10 em séries dedicadas, diferencia Últ 12M de anos fechados e não converte ausência de lucro em zero.
- Histórico de Indicadores Fundamentalistas combina HTML, canônico e payloads de API do Investidor10, preservando 5A/10A, ordenação de períodos e percentuais reais.
- Checklist passa a capturar o status item a item sem vazar ícones/classes de linhas vizinhas e sem encerrar a seção antes dos 10 critérios.
- Sem PETR4 fixo, sem GGRC11, sem mock e sem fabricação de dados; ausência real fica `EMPTY`/`UNKNOWN`.

## 2026-07-04 — Proxy v243 / patch 21.12.272-stock-historical-indicators-investidor10-v243

- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v24`.
- Corrigido o Histórico de Indicadores Fundamentalistas de ações: a tabela 5A/10A do Investidor10 agora é normalizada quando vier como `columns/data`, `rows/linhas`, `categories/series` ou objeto por indicador.
- Adicionado parser HTML oficial como segunda leitura quando a página já trouxer a seção renderizada.
- Sem fallback, sem PETR4 fixo, sem GGRC11 fixo e sem valores fabricados; ausência da fonte real permanece `EMPTY`.

## 2026-07-04 — Proxy v242 / patch 21.12.271-stock-checklist-investidor10-v242

Correção pontual do checklist Buy and Hold do modal único de ação via Investidor10.

- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v23`.
- Corrigido o delimitador da seção: a palavra **Dividendos** dentro do critério “Empresa pagou +5% de dividendos/ano nos últimos 5 anos” não encerra mais o bloco.
- O checklist de ações passa a retornar os 10 critérios públicos exibidos no Investidor10 quando a fonte entrega a seção completa.
- Removida a derivação/simulação de status por métricas locais: aprovado/reprovado/desconhecido só vem da marcação real do HTML do Investidor10.
- Mantida a regra: sem fallback estático de PETR4, GGRC11 ou dados de exemplo; ausências ficam `EMPTY`/`UNKNOWN`.

## 2026-07-04 — Proxy v235 / patch 21.12.265-analysis-search-audit-v235

Auditoria e otimização da página Análise e da busca inteligente pareada ao APK v354.

- `/api/v1/assets?q=...&suggest=true&searchMode=analysis` agora força sugestão leve, inclusive quando `q` já é ticker completo como PETR4.
- Contrato de sugestões declara `suggestionOnly` e `debounceRecommendedMs=320`, alinhando APK e Proxy.
- Mantidos contratos de `/api/v1/analysis`, `/api/v1/asset/fii-modal` e `/api/v1/asset/stock-modal` sem alterações visuais ou de JSON dos modais.
- Adicionado teste de regressão para garantir que ticker exato em modo sugestão não cai no batch pesado de `/assets`.

## 2026-07-04 — Proxy v234 / patch 21.12.264-stock-modal-data-integrity-v234

- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v17`.
- Corrigida a origem da cotação do cabeçalho e de `Sobre o ativo`: o Proxy prioriza Yahoo Finance do ticker visualizado e só usa Investidor10 quando estiver escopado corretamente ao ativo.
- Variação 12M ganha fallback por histórico Yahoo 1Y, além das fontes já existentes no Investidor10/retornos.
- Radar de Dividendos Inteligente passa a carregar contagem, anos observados e score por mês para data com e pagamento, sem alterar o layout do APK.
- Comparador de ações ganha fallback por catálogo setorial restrito ao mesmo grupo/segmento quando a tabela do Investidor10 não vier no HTML.
- Regiões/negócios de receita e posição acionária receberam parsers adicionais para JSON/HTML do Investidor10; referências PETR4 continuam limitadas apenas ao ticker PETR4.
- Pacote final mantém padrão AI Studio com arquivos diretamente na raiz.

## 2026-07-04 — Proxy v233 / patch 21.12.263-asset-modal-contract-refactor-v233

- Entrega pareada ao APK v352 para a refatoração segura da camada técnica dos modais.
- Contrato de FII permanece isolado em `lib/analysis/fii-modal-contract.js` e endpoint `/api/v1/asset/fii-modal`.
- Contrato de ação permanece isolado em `lib/analysis/stock-modal-contract.js` e endpoint `/api/v1/asset/stock-modal`.
- Sem alteração de scraping, formato de resposta ou nomes de campos JSON; o objetivo é registrar compatibilidade e versionamento conjunto.
- Pacote final mantém padrão AI Studio com arquivos diretamente na raiz.

## 2026-07-04 — Proxy v232 / patch 21.12.262-stock-modal-action-fixes-v232
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v16`.
- Corrigidos logotipo e bloco **Sobre a empresa** para não manter PETR4/Petrobras fixos em ativos diferentes.
- Reforçada a variação 12M com extração do Investidor10 e fallback por retorno anual quando disponível.
- Radar de Dividendos Inteligente, Payout, Comparador de ações e comparação com índices foram revisados no contrato do modal.
- Hidratadas APIs internas do Investidor10 para regiões/negócios de receita, posição acionária, receitas e lucros, lucro x cotação, histórico de indicadores, resultados e evolução patrimonial.
- Mantido Yahoo direto para IFIX.SA, IDIV.SA e SMLL.SA.

## 2026-07-04 — Proxy v231 / patch 21.12.261-asset-modal-accordions-v231
- Entrega pareada ao APK v350 para organização visual dos modais de FIIs e ações com acordeões.
- Contratos e scraping permanecem compatíveis com o Proxy v230/v229; sem mudança em fontes de dados.
- Mantém versionamento pareado APK + Proxy para upload no AI Studio.


## 2026-07-04 — Proxy v230 / patch 21.12.260-asset-modal-design-unified-v230
- Entrega pareada ao APK v349 para padronização visual dos modais de ativos.
- Contratos e fontes de dados permanecem compatíveis com o Proxy v229.
- Sem alteração de scraping; rodada focada em manter versionamento conjunto APK + Proxy.


## 2026-07-04 — Proxy v229 / patch 21.12.259-stock-modal-indices-pies-radar-scroll-v229
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v15`.
- Revisada a comparação de ações com índices: IFIX.SA, SMLL.SA e IDIV.SA continuam via Yahoo direto e agora recebem série de segurança apenas quando a série real vier vazia.
- Removido o bloco visual de comparação com Brent do modal único de ação.
- Radar de Dividendos Inteligente passa a expor diagnóstico de origem a partir de `dividendHistory.events` do Investidor10.

## 2026-07-04 — Proxy v228 / patch 21.12.258-stock-modal-action-audit-fixes-v228
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v14`.
- Corrigidos cards rápidos de ações com fallback dos indicadores fundamentalistas quando o bloco superior do Investidor10 não vier no HTML estático.
- Reforçados histórico de indicadores fundamentalistas, payout, comparador de ações, comparação com índices, comparação com Brent, logo da empresa, regiões/negócios de receita, receitas e lucros e lucro x cotação.
- Mantido Yahoo direto para IFIX.SA, IDIV.SA e SMLL.SA e adicionada proteção para retorno vazio em comparações.


## 2026-07-03 — Proxy v227 / patch 21.12.257-stock-modal-balance-announcements-v227
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v13`.
- Adicionado `balanceSheetStatement` com a seção **Balanço Patrimonial Petrobras**.
- Adicionado `announcements` com **Comunicados do PETR4**, links Abrir/PDF e paginação.
- Comunicados combinam a página principal do ativo com a rota pública `/communications/ticker/{TICKER}/?page=...`.
- Mantidos todos os blocos anteriores do modal único de ação.


## 2026-07-03 — Proxy v226 / patch 21.12.256-stock-modal-results-equity-v226
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v11`.
- Adicionado `resultsStatement` com a tabela Resultados Petrobras/ação: Receita Líquida, Custos, Lucro Bruto, Lucro Líquido, EBITDA, EBIT, Imposto, Dívidas, Margens, ROE e ROIC.
- Adicionado `equityEvolutionChart` com Patrimônio, Receita Líquida e Lucro Líquido, filtros 5A/10A/MAX.
- Mantidos todos os blocos anteriores do modal único de ação.


## 2026-07-03 — Proxy v225 / patch 21.12.255-stock-modal-financial-charts-v225
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v10`.
- Adicionado `revenueProfitChart` com Receita Líquida e Lucro Líquido para o bloco **Receitas e Lucros**.
- Adicionado `profitQuoteChart` com Lucro Líquido e Cotação para o bloco **Lucro x Cotação**.
- Mantidos os blocos anteriores do modal único de ação e a política Investidor10-first.


## 2026-07-03 — Proxy v224 / patch 21.12.254-stock-modal-shareholding-v224
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v9`.
- Adicionado `shareholdingPosition` com a tabela de Posição acionária: Acionista, % ON, % PN e % Total.
- Parser busca a seção `POSIÇÃO ACIONÁRIA` no HTML/canônico do Investidor10 e mantém fallback PETR4 quando a tabela for entregue como imagem.
- Mantidas as seções anteriores do modal único de ações e a política Yahoo restrita a cotação/comparações.


## 2026-07-03 — Proxy v223 / patch 21.12.253-stock-modal-company-revenue-v223
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v8`.
- Adicionado `companyProfile` com a seção Sobre a empresa, histórico e informações adicionais da ação.
- Adicionados `revenueByRegion` e `revenueByBusiness` com ano, total, valores e percentuais de participação.
- Mantidos comparador de ações, comparação com índices, Brent, radar de dividendos, payout, histórico de dividendos, checklist, indicadores e rentabilidade.


## 2026-07-03 — Proxy v222 / patch 21.12.252-stock-modal-comparisons-v222
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v7`.
- Adicionado `peerComparison` com Comparador de Ações do Investidor10.
- Adicionado `indexComparison` para PETR4/ação versus IBOV, IFIX, CDI, IPCA, SMLL, IDIV e IVVB11.
- IFIX, IDIV e SMLL usam Yahoo Finance direto (`IFIX.SA`, `IDIV.SA`, `SMLL.SA`), reaproveitando a base do modal de FIIs.
- Adicionado `commodityComparison` para comparar a ação com Petróleo Brent (`BZ=F`).


## 2026-07-03 — Proxy v221 / patch 21.12.251-stock-modal-radar-payout-v221
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v6`.
- Adicionado `dividendRadar` com Radar de Dividendos Inteligente, meses por Data Com/Data Pagamento e botão de radar completo.
- Adicionado `payoutChart` com Lucro Líquido, Payout e Dividend Yield, além de filtros 5A/10A/MAX.
- Mantidos checklist vertical, histórico de dividendos, indicadores, histórico de indicadores, cotação e rentabilidade do modal único de ações.


## 2026-07-03 — Proxy v220 / patch 21.12.250-stock-modal-dividends-v220
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v5`.
- Adicionado `dividendHistory` ao modal único de ações com Histórico de Dividendos do Investidor10.
- O payload agora entrega DY atual, DY médio em 5 anos, séries anuais de Dividend Yield/Dividendos e tabela de proventos com tipo, data com, pagamento e valor.
- Mantidos checklist vertical, indicadores completos, histórico de indicadores, rentabilidade e gráfico de cotação.


## 2026-07-03 — Proxy v219 / patch 21.12.249-stock-modal-checklist-v219
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v4`.
- Adicionado `checklist` ao modal único de ações com o Checklist do Investidor Buy and Hold do Investidor10.
- Checklist entrega 10 critérios, contadores `passed/failed/unknown`, textos de ajuda e disclaimer para renderização vertical no APK.
- Preservados indicadores completos, histórico de indicadores, cotação, rentabilidade e política Yahoo apenas para preço/gráfico.


## 2026-07-03 — Proxy v218 / patch 21.12.248-stock-modal-fundamentals-complete-v218
- Reforçada a seção `fundamentalIndicators` do modal único de ações com a grade completa da referência PETR4/Investidor10.
- Mantidos todos os 31 indicadores: P/L, PSR, P/VP, Dividend Yield, Payout, margens, EVs, P/Ebits, P/Ativo, P/Cap.Giro, P/Ativo Circ. Líq., VPA, LPA, Giro Ativos, ROE, ROIC, ROA, dívidas, estrutura patrimonial, liquidez corrente e CAGRs 5 anos.
- Teste de contrato confirma `expected=31` e impede regressão por omissão de indicador.
- Yahoo continua restrito a cotação/gráfico; fundamentos seguem Investidor10-first.


## 2026-07-03 — Proxy v217 / patch 21.12.247-stock-modal-historical-indicators-v217
- Contrato `/api/v1/asset/stock-modal` evoluído para `26.asset-modal.stock.v3`.
- Adicionado `historicalIndicators` ao modal único de ações com tabela histórica de indicadores fundamentalistas.
- Estrutura pronta para períodos `5y` / `10y` via `periods`, `selectedPeriod` e `tablesByPeriod`.
- Mantidos cards rápidos, gráfico Yahoo, rentabilidade nominal/real e indicadores fundamentalistas do checkpoint anterior.


## 21.12.246-stock-modal-fundamentals-v216 — 2026-07-03

- Evolui o contrato do modal único de ações para `26.asset-modal.stock.v2`.
- Adiciona a seção `fundamentalIndicators` com a grade/lista de indicadores fundamentalistas de ações do Investidor10.
- Agrupa indicadores por valuation, margens, rentabilidade, endividamento e crescimento, mantendo o seletor inicial `Sem comparativos`.

## 21.12.245-stock-modal-start-v215 — 2026-07-03

- Inicia o modal único de ações pelo contrato `26.asset-modal.stock.v1`.
- Adiciona `/api/v1/asset/stock-modal` com aliases `/asset/action-modal` e `/acao/modal`.
- Implementa cards rápidos de ações conforme referência PETR4/Investidor10: Cotação, Variação 12M, P/L, P/VP e DY.
- Implementa bloco Rentabilidade nominal/real de 1 mês a 10 anos com Investidor10 e fallback Yahoo + IPCA.
- Adiciona teste regressivo `stock-modal-contract-v215.test.js`.

## v214 — Auditoria do modal único de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v21`.
- Corrige o Checklist Buy and Hold para funcionar mesmo quando o ativo não está comprado na carteira, usando a seção pública do Investidor10 ou fallback derivado das métricas do próprio modal.
- Comunicados passam a combinar a página principal do FII com a rota pública `/communications/fii/{TICKER}/`.
- Links intermediários `/fiis/link_comunicado/{TICKER}/{ID}/` são reconhecidos como documentos/PDFs e recebem `buttonLabel: Abrir PDF`.
- Parser limpa `Data de Divulgação` do título e preserva a data correta em `dateDisplay`.
- `fetchText` preserva `contentType` e `finalUrl` para detecção robusta de PDF após redirecionamento.
- Adiciona testes regressivos `fii-modal-checklist-independent-v214.test.js` e `fii-modal-announcements-routes-v214.test.js`.

## v213 — Comunicados e PDFs no modal de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v20`.
- Adiciona `announcements` com Comunicados do FII, título, data, tipo, link oficial e `pdfUrl` quando o documento direto for PDF.
- Parser captura a seção `COMUNICADOS DO {TICKER}` do Investidor10 e mantém fallback para abrir a página oficial quando o PDF direto não estiver exposto.
- APK v332 renderiza lista paginada com botão **Abrir PDF/Abrir** usando navegador/visualizador externo seguro.
- Adiciona teste regressivo `fii-modal-announcements-v213.test.js`.

## v212 — Revisão de valor patrimonial no modal de FIIs — 2026-07-03

- Mantém o contrato `26.asset-modal.fii.v19` estável para preservar compatibilidade.
- Documenta a revisão APK v331: ajuda nas barras patrimoniais e visual sólido em Média do tipo e segmento.
- Reexecutados `node --check`, `npm run check:syntax`, teste patrimonial e suíte completa.

## v211 — Valor patrimonial e média do segmento no modal de FIIs — 2026-07-03

- Evolui o contrato para 26.asset-modal.fii.v19.
- Adiciona `patrimonialInfo` com barras de valor patrimonial/cota e valor da cota, cards de cotas, P/VP e patrimônio total.
- Adiciona Média do tipo e segmento com comparações de P/VP, DY (12M), Valor Patrimonial e Val. Patrimonial p/ Cota.
- Adiciona teste regressivo `fii-modal-patrimonial-info-v211.test.js`.

## v210 — Comparação com índices alinhada à página Retorno — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v18`.
- Corrige IFIX, SMLL e IDIV no gráfico **Comparação com índices** ao reutilizar `getAssetHistory`, a mesma camada de histórico usada pela página **Retorno**.
- Mantém Yahoo direto nos símbolos `IFIX.SA`, `SMLL.SA` e `IDIV.SA` como prioridade; quando o Yahoo entrega apenas snapshot, usa o normalizador já validado na página Retorno para desenhar linha e gerar a simulação de R$ 1.000,00.
- Adiciona `selectorOptions` ao contrato para garantir seletores fixos de IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11 no APK.
- Adiciona teste regressivo `fii-modal-return-index-reuse-v210.test.js`.

## v209 — Correção Dividend Yield/Dividendos no modal de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v17`.
- Corrige a captura das seções `DIVIDEND YIELD {TICKER}` e `{TICKER} DIVIDENDOS` do Investidor10 quando os dados dinâmicos não vêm no JSON/API.
- A tabela passa a preencher Tipo, Data Com, Pagamento e Valor; os eventos alimentam os gráficos mensal/anual e a tabela paginada no APK.
- Corrige leitura da data de pagamento no extractor do Investidor10 para evitar linha sem pagamento.

## v207 — Lista de imóveis no modal de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v15`.
- Adiciona `propertyPortfolio` com estados, quantidade de imóveis, participação e lista de imóveis do Investidor10.
- Implementa parser dedicado da seção `LISTA DE IMÓVEIS`, encerrando antes de comunicados/históricos para não misturar conteúdos.
- Mantém todos os blocos anteriores do modal: Sobre o fundo, Dividend Yield/Dividendos, distribuições 12M, checklist, comparação com índices e comparador de FIIs.

## v206 — Sobre o fundo no modal de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v14`.
- Adiciona `aboutFund` com o bloco **SOBRE A {TICKER}** do Investidor10.
- O parser captura subtópicos: Sobre o fundo, Estratégia e composição, Diversificação e exposição, Estrutura do fundo e taxas e Informações adicionais.
- O bloco preserva parágrafos e lista de ativos/locatários quando o Investidor10 expõe a lista no HTML.


## v203 — Distribuições 12M no modal de FIIs — 2026-07-03

- Evolui o contrato do modal único de FII para `26.asset-modal.fii.v11`.
- Adiciona `distributions12m` com Yield 1M/3M/6M/12M e valor pago por cota do Investidor10.
- Mantém fallback HTML direto para a seção “Distribuições nos últimos 12 meses”.

## v200 — Correção do comparador com outros FIIs (2026-07-03)

- Evoluído o contrato do modal de FII para `26.asset-modal.fii.v8`.
- Investigado o motivo do aviso "Comparador com outros FIIs ainda não foi retornado": o HTML estático do Investidor10 para GGRC11 contém o cabeçalho **COMPARANDO COM OUTROS FIIS**, mas não contém as linhas da tabela renderizada.
- Adicionado fallback controlado que usa a seção **FIIs Relacionados** do próprio Investidor10 e enriquece os pares por suas páginas individuais para preencher Dividend Yield, P/VP, Valor Patrimonial, Tipo e Segmento.
- Mantido o parsing da tabela original quando o Investidor10 devolver as linhas completas no HTML.
- Adicionado teste regressivo `fii-modal-peer-related-fallback-v200.test.js`.

## v199 — Comparação completa com índices no modal de FIIs (2026-07-03)
- `/api/v1/asset/fii-modal` evoluiu para `26.asset-modal.fii.v7`.
- O bloco **Comparação com índices** passa a entregar ativo + IFIX + CDI + IPCA + IBOV + SMLL + IDIV + IVVB11.
- CDI e IPCA usam Banco Central SGS; ativo, IBOV, IVVB11 e os índices Yahoo usam Yahoo Finance Chart API, mantendo IFIX/IDIV/SMLL sem fallback Investidor10/B3/ETF/proxy.
- O contrato agora envia `itemsByPeriod` e `seriesByPeriod` completos para 2A, 5A e 10A, permitindo que o APK desenhe as linhas e monte os cards de simulação por benchmark.


## v199 — Comparação completa com índices no modal de FIIs (2026-07-03)

- `/api/v1/asset/fii-modal` evoluiu para `26.asset-modal.fii.v7`.
- Adicionado bloco `peerComparison` com a tabela Investidor10 **Comparando com outros FIIs**.
- O contrato envia FII, Dividend Yield, P/VP, Valor Patrimonial, Tipo e Segmento.
- O filtro informativo padrão é **Mesmo tipo e segmento**.
- Destaques automáticos indicam maior DY, menor P/VP válido e maior Valor Patrimonial.

## v197 — Correção de visibilidade da comparação com índices no modal único de FIIs — 2026-07-03

- Corrigido o caso em que o bloco "Comparação com índices" podia não aparecer no modal único de FIIs quando o Yahoo retornava histórico parcial ou vazio para algum período.
- Contrato `/api/v1/asset/fii-modal` atualizado para `26.asset-modal.fii.v5`; o bloco `comparison` permanece presente mesmo em estado parcial.
- IFIX, IDIV e SMLL passam a ser buscados explicitamente pelos símbolos diretos `IFIX.SA`, `IDIV.SA` e `SMLL.SA` também nas cotações rápidas.
- O Proxy tenta intervalos alternativos do próprio Yahoo para 2A/5A/10A antes de devolver estado parcial.
- APK v316 renderiza o card da comparação sempre, exibindo mensagem clara quando o histórico do Yahoo ainda está incompleto.

## v196 — Comparação IFIX/IDIV/SMLL no modal único de FIIs — 2026-07-03

- Evoluído `/api/v1/asset/fii-modal` para contrato `26.asset-modal.fii.v4`.
- Adicionado bloco `comparison` para FIIs com séries 2A/5A/10A e simulação de R$ 1.000,00 no estilo Investidor10.
- IFIX, IDIV e SMLL passam a usar somente Yahoo Finance Chart API com símbolos diretos `IFIX.SA`, `IDIV.SA` e `SMLL.SA`.
- Corrigida a extração dos cards superiores do modal de FII: cotação, DY 12M, P/VP, liquidez diária e variação 12M.
- Adicionados fallbacks controlados: cotação/variação pelo Yahoo e DY/PVP/liquidez pelo histórico de indicadores do Investidor10 quando o bloco superior vier incompleto.
- StatusInvest, Fundamentus, ETF substituto ou ticker proxy permanecem descartados no modal único de FIIs.

## v195 — Roteamento universal para o modal único do ativo — 2026-07-03

- APK v314 deixa de carregar `AnalysisPageResponse` pela página Análise quando o usuário busca ou seleciona um ticker.
- Busca principal, sugestões, rankings, categorias e subpáginas da Análise passam a abrir `AssetDetailsModal`.
- Tickers clicáveis em notícias da Home e da aba Notícias também abrem o modal único.
- Adicionada auditoria `analysis-universal-modal-v195.test.js` para evitar retorno do fluxo antigo.
- `/api/v1/analysis` permanece compatível no Proxy, mas os detalhes do ativo devem evoluir no modal único.

## v194 — Histórico de indicadores Investidor10 no modal único de FIIs — 2026-07-03

- Evoluído `/api/v1/asset/fii-modal` para contrato `26.asset-modal.fii.v3`.
- Cards rápidos de FII passam a ser extraídos do bloco inicial do Investidor10: cotação, DY 12M, P/VP, liquidez diária e variação 12M.
- Rentabilidade nominal e real do bloco “Rentabilidade” passa a vir do Investidor10, sem BCB/IPCA no modal.
- Adicionado `historicalIndicators` com colunas e linhas do histórico de indicadores fundamentalistas do Investidor10.
- StatusInvest, Fundamentus e fallbacks legados permanecem descartados dentro do modal único do ativo.


## v193 — Informações Investidor10 no modal único de FIIs — 2026-07-03

- Revisado `/api/v1/asset/fii-modal` para contrato `26.asset-modal.fii.v2`.
- Incluído bloco de informações oficiais do Investidor10 para FIIs, sem reativar StatusInvest nem fallback legado.
- Mantidos gráfico/cotação/rentabilidade nominal por Yahoo e rentabilidade real por IPCA BCB.

# v185 — Qualidade estrita de gráficos e captura contínua

Release date: 2026-07-02  
Core version: 21.12.0  
Public version: 21.12.218  
Patch: `21.12.218-vercel-temp-artifact-prune-v188`

Proxy v185 continua a auditoria de captura, bloqueia gráfico de cotação com ponto único, adiciona sourceCaptureMap/criticalMissingSectionIds ao dataQuality e reforça a política de gráficos reais para APK e modais.

## v188 — Vercel temp artifact prune

- Corrige erro persistente no Vercel causado por `lib/analysis/analysis-page-response.js.bak` presente no contexto de build.
- Build seguro agora remove artefatos temporários antes de validar a release.
- `.gitignore`, `.vercelignore` e `package-lock.json` alinhados.


## Alterações
- Bloqueio de gráfico de cotação com ponto único no contrato da Análise.
- `dataQuality` ampliado com mapa de captura por seção e lista de seções críticas ausentes.
- Política estrita para gráficos reais reforçada antes do payload chegar no APK.
- Teste v185 cobrindo ausência de gráfico sintético de cotação e presença de auditoria de captura.

## Validação
- `npm run verify`
- `node scripts/check-syntax.js`

## v186 — Auditoria de desempenho e otimização de rota

Proxy v186 reduz trabalho duplicado na rota /api/v1/analysis com cache LRU curto, coalescing de requisições iguais e preservação do contrato estrito de gráficos reais para melhorar abertura da Análise e dos modais no APK.

- Cache curto da rota /api/v1/analysis para reduzir abertura repetida de ativos e modais.
- Coalescing de requisições simultâneas iguais para evitar múltiplos scrapes/normalizações da mesma fonte.
- Política estrita de gráficos reais preservada.
