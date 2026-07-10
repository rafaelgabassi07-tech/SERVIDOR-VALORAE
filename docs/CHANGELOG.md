## 21.12.344 — 2026-07-10 — Protocol negotiation and stale harmony v312

- Pareado ao APK v476 / `versionCode 26071006`.
- Publica protocolo móvel `2026.07.10.6` e delivery schema em respostas normais/performance.
- Define TTL fresco e stale grace específicos para `fast` e `full`.
- Limita runtime e cache da Análise aos valores canônicos do manifesto.
- Adiciona teste cruzado de negociação e semântica de cache.

## 21.12.343 — 2026-07-10 — APK/Proxy cache protocol harmony v311

- Pareado ao APK v475 / `versionCode 26071005`.
- Protocolo móvel, métodos, headers, CORS, requestId e Cache-Control centralizados.
- Correção da seção `information` no quality profile de FIIs.
- Teste cruzado de políticas e compatibilidade.

## 21.12.342 — 2026-07-10 — APK/Proxy contract harmony v310

- Corrige divergência de método `/api/sync` no catálogo móvel.
- Harmoniza headers, TTLs fast/full e metadados de qualidade do delivery.
- Separa `stableForCache` de `completeForDelivery`; cache útil não encerra prematuramente o modal.
- Define metas finais específicas para Ação e FII.
- Adiciona teste cruzado de rotas, métodos e contrato de qualidade.
- Pareado com APK v474 / `versionCode 26071004`.

## 21.12.340 — APK v472 compatibility audit

- Proxy v308 revalida integralmente as rotas e contratos para o APK v472; as mudanças desta rodada são locais ao tema, estado de UI e importação B3 e não alteram o contrato HTTP.
- Rotas de modais, histórico, transações, logos, notícias e sync preservadas.
- Teste autônomo `apk-v472-contract-compatibility-v308.test.js` adicionado.

## 21.12.337 — 2026-07-09 — Asset modal fast/cache/context v305

- Stage `fast` deixa de bloquear em fontes lentas além do orçamento de preview; a captura original continua aquecendo o cache do `full`.
- Cache `full` útil passa a prevalecer sobre `fast` parcial ainda fresco.
- `requestId` e `requestedStage` são isolados por consumidor depois do coalescing.
- Quality gate reconhece comparadores, posição acionária, demonstrativos, payout, comunicados e distribuições.
- Corrige coerção de `null` para zero em cotação, variação, checklist, proventos e comparadores de Ação/FII, impedindo cache de placeholders zerados.
- Adiciona teste cruzado `asset-modal-fast-cache-context-v305.test.js`.
- Pareado com APK v469 / `versionCode 26070918`.

## 21.12.335 — 2026-07-09 — Asset modal delivery contract v2 / v303

- Publica metadados `delivery` aditivos: estágio pedido/entregue, conclusão, completude, seções e retry.
- Corrige cache cross-stage de FIIs entre períodos internos `1M` e `1Y`.
- Aplica deadline defensivo também ao `full`, retornando PARTIAL controlado/stale fallback antes do teto serverless.
- Alinha Ação e FII em `stage`, `mode`, `fullOnly`, `progressive` e deadlines explícitos.
- Adiciona teste cruzado `asset-modal-delivery-cancellation-v303.test.js`; suíte com 175 arquivos e 0 falhas.
- Pareado com APK v467 / `versionCode 26070916`.

## 21.12.334 — 2026-07-09 — Modal runtime hardening v302

- Reaproveita cache full em chamadas fast equivalentes dos modais.
- Reduz peso do stage fast em ações e FIIs sem remover o contrato completo do stage full.
- Adiciona teste `asset-modal-runtime-hardening-v302.test.js`.

## 21.12.333 — v301 asset modal progressive fast/full alignment (2026-07-09)

- Corrige desalinhamento em que o APK voltava a aguardar somente o contrato completo e o Proxy forçava `stage=full` nos modais.
- Reativa abertura progressiva dos modais: `stage=fast` renderiza rapidamente cotação/gráfico/resumo/indicadores básicos e `stage=full` completa os blocos pesados.
- Ação: adia comparadores, REST extras de receita/posição e comunicados/PDFs para o stage completo, reduzindo a chance de timeout percebido.
- FII: passa a respeitar o mesmo contrato `fast/full` para manter alinhamento de runtime.
- Runtime do Proxy separa cache/TTL/deadline por modo e só usa fallback parcial de deadline no stage rápido.
- Adiciona teste `asset-modal-progressive-alignment-v301` cobrindo alinhamento APK + Proxy.
- Pareado com APK v465 / `versionCode 26070914`.

## 21.12.331 — v302 stock modal signed chart visuals (2026-07-09)

- Preserva e audita lucro líquido negativo nos contratos de gráficos de ação.
- Adiciona diagnósticos `negativeNetIncome` para Payout, Receitas e Lucros, Lucro x Cotação e Evolução do Patrimônio.
- Adiciona teste `stock-modal-signed-chart-contract-v302` para impedir regressão que transforme prejuízo em valor positivo.
- Pareado com APK v456.

## 21.12.330 — v301 analysis logo cache optimization (2026-07-09)

- Adiciona cache negativo curto para `/api/v1/asset/logo` quando Yahoo não retorna logo oficial.
- Reduz repetição de chamadas query1/query2 em ativos sem `companyLogoUrl`, acelerando as subpáginas da Análise quando o APK já possui fallback local.
- Preserva cache positivo/stale de logos oficiais e contratos full-only dos modais.
- Adiciona teste `yahoo-logo-negative-cache-v301`.

## 21.12.330 — v301 modal full speed optimization (2026-07-09)

- Mantém os modais de Ação/FII em modo full-only, sem retorno progressivo/PARTIAL para a UI.
- Normaliza a chave de cache do runtime para reutilizar o mesmo contrato entre Carteira, Ranking e Análise.
- Aumenta o TTL seguro do contrato completo dos modais para reduzir recomputação em reaberturas rápidas.
- Paraleliza batches de histórico fundamentalista de ações, candidatos de vacância de FII e resolução limitada de comunicados/PDFs.
- Adiciona teste `asset-modal-speed-full-v300`.

## 21.12.327 — v298 portfolio intraday full coverage (2026-07-09)

- Corrige `/api/v1/portfolio/history` para não emitir pontos intradiários parciais quando nem todos os ativos com posição têm candle no timestamp.
- Alinha a série intradiária ao `currentPrice` recebido do APK quando a divergência é pequena e plausível, evitando salto final no gráfico Preço da carteira.
- Adiciona testes `portfolio-history-intraday-full-coverage-v298` e `portfolio-history-intraday-live-alignment-v298`.

## 21.12.327-portfolio-intraday-full-coverage-v298

- `stock-modal` e `fii-modal` deixam de converter timeout de rota em payload `PARTIAL`; a resposta passa a ser full-only.
- Os wrappers dos modais forçam `stage=full`, `mode=full`, `priority=full` e anulam deadlines progressivos.
- `/portfolio/history` aceita `transactions[]` mesmo sem posições atuais, preservando ativos históricos/vendidos na série.
- O ponto vivo da carteira passa a usar a mesma composição reconstruída por histórico/transações, reduzindo divergência e salto final artificial.
- Validação direcionada: runtime de modal, cache de modal, roteamento/normalização do histórico e histórico com ativo vendido.

## 21.12.325-asset-modal-quality-cache-v296

- Modais de Ação/FII deixam de cachear respostas PARTIAL sem dados úteis.
- Respostas PARTIAL úteis passam a ter TTL interno curto.
- Rotas /asset/stock-modal e /asset/fii-modal usam Cache-Control no-store; o runtime do Proxy continua responsável pelo cache seguro.

## 21.12.324-modal-deadline-disable-external-v295

- `stock-modal` e `fii-modal` passam a ter deadline defensivo, retornando payload parcial em vez de travar sem bytes.
- Yahoo Finance respeita `VALORAE_DISABLE_EXTERNAL=1`, usando cache stale quando disponível e payload `external-disabled` quando não há cache.
- `/assets` expõe `quoteCoverage` e `quoteFailures` para o APK decidir retries com mais segurança.
- Validação: `npm run verify` com 162 testes.

## 21.12.318-quote-history-range-aliases-v289

- Corrige aliases de período do histórico de cotação para filtros 1D/5D/1M/3M/6M/1A/5A/MÁX.
- Adiciona 2Y ao PERIOD_MAP para evitar fallback silencioso para 1Y.
- Mantém Lucro x Cotação v288 e Regiões/Negócios v287.

## 2026-07-07 — Proxy v288 / patch 21.12.317-stock-profit-quote-priority-v288

- Corrigida regressão em **Lucro x Cotação** no modal de ação: `/api/cotacao-lucro/{ticker}/adjusted/` agora entra antes dos candidatos expansivos de Regiões/Negócios.
- Mantida a correção v287 de Regiões e Negócios no formato Vesto/Investidor10 `ano -> categoria -> { value }`.
- Contrato de ação atualizado para `26.asset-modal.stock.v55`.
- Validação cobre a prioridade de `lucroCotacao` antes dos endpoints de receita e a preservação de `profitQuoteChart`.

## 2026-07-07 — Proxy v287 / patch 21.12.316-stock-revenue-vesto-inline-map-v287

- Corrigida a causa raiz dos gráficos de Regiões e Negócios de receita em ações quando o Investidor10 expõe o formato usado pelo Vesto/AeroScrape: `ano -> categoria -> { value }`.
- `value` entre 0 e 100 agora é convertido para `percent`/`percentDisplay`, sem virar valor monetário falso.
- O ano mais recente é escolhido em payloads com múltiplos anos.
- Contrato de ação atualizado para `26.asset-modal.stock.v54`.
- Teste novo: `stock-modal-revenue-vesto-inline-map-v287.test.js`.

## 2026-07-07 — Proxy v286 / patch 21.12.315-stock-revenue-js-discovery-v286

- Corrigida a busca dos gráficos de Regiões e Negócios de receita de ações quando o HTML público mostra apenas títulos/anos e não expõe valores textuais.
- Endpoints por slug/ticker agora são tentados mesmo sem `companyId`, incluindo rotas de região, negócio, segmento, geografia e REST de receitas/charts.
- Adicionada segunda passada de receita após `/api/rest/assets/tickers/{TICKER}` para reaproveitar IDs encontrados no payload REST.
- Contrato de ação atualizado para `26.asset-modal.stock.v53`.
- Teste regressivo `stock-modal-revenue-endpoints-v286.test.js` garante que endpoints por slug e por `companyId` sejam tentados.

## 2026-07-07 — Proxy v284 / patch 21.12.313-stock-revenue-charts-v284

- Reescrita da extração de Regiões e Negócios de receita no modal de ações, com leitura de payloads Highcharts, Chart.js e REST aninhado.
- Normalização reforçada de campos aninhados em custom/meta/payload/props para rótulo, percentual e valor de receita.
- Mantidos aliases canônicos revenueByRegion/revenueByBusiness e stockRevenueByRegion/stockRevenueByBusiness para o APK.
- Adicionados testes `stock-modal-revenue-highcharts-realistic-v284.test.js` e `stock-modal-revenue-rest-nested-custom-v284.test.js`.

## 2026-07-07 — Proxy v283 / patch 21.12.312-portfolio-transaction-inception-v283

- `/api/v1/portfolio/history` passa a aceitar `transactions[]` e montar o Preço da carteira pela composição histórica real.
- O range `MAX` começa na primeira compra informada, evitando curva genérica limitada por fallback.
- Adicionado teste `portfolio-history-transaction-inception-v283.test.js` cobrindo primeira compra e entrada de segundo ativo somente na data correta.

## 2026-07-07 — Proxy v282 / patch 21.12.311-portfolio-intraday-history-v282

- Corrigida a causa raiz do gráfico **Preço da carteira**: o histórico intradiário não é mais agrupado apenas por data.
- `/api/v1/portfolio/history` preserva `timestamp` em 1D/5D e em intervalos de minutos/horas.
- A mesclagem da carteira agora usa buckets por timestamp com forward-fill por posição.
- O ponto de cotação atual não remove mais todos os pontos do mesmo dia; ele substitui apenas ponto intradiário muito próximo ou é anexado ao final.
- Adicionado teste `portfolio-history-intraday-v282.test.js` cobrindo múltiplos pontos Yahoo no mesmo dia sem `CurrentPriceFallback`.

## 2026-07-07 — Proxy v281 / patch 21.12.310-cross-stack-portfolio-revenue-v281

- Histórico da carteira preserva `currentPrice`, ancora o último ponto com a cotação atual e expõe `fallbackUsed` quando precisa sintetizar série mínima.
- Modal de ação expõe aliases `stockRevenueByRegion` e `stockRevenueByBusiness`, mantendo compatibilidade com `revenueByRegion` e `revenueByBusiness`.
- Testes adicionados: `portfolio-history-current-price-v281.test.js` e `stock-revenue-contract-aliases-v281.test.js`.

## 2026-07-06 — Proxy v280 / patch 21.12.309-analysis-subpage-active-tickers-v280

- Adiciona `listingStatus`, `tradingStatus`, `isTradable`, `tradable`, `activeTrading` e `partial` ao contrato de `/api/v1/quotes`.
- `isTradable=true` passa a depender de cotação positiva vinda do retorno de mercado; tickers sem preço ficam como `INACTIVE_OR_UNAVAILABLE` e `partial=true`.
- Permite que o APK oculte ativos históricos/inativos nas subpáginas da Análise sem lista fixa, mock ou dado inventado.
- Teste: `node test/analysis-subpage-trading-status-v280.test.js`.

## 2026-07-06 — Proxy v279 / patch 21.12.308-fii-peer-comparison-related-v279

- Corrige `Comparando com outros FIIs` no modal de FII quando o Investidor10 expõe apenas cabeçalho/filtros da tabela renderizada no HTML capturado.
- Mantém a tabela renderizada como fonte prioritária; se ela vier sem linhas, usa `FIIs Relacionados` da mesma página como fonte real de pares.
- A recuperação lê ticker, DY e P/VP reais e, quando disponível, aplica tipo/segmento extraídos da seção `Média do Tipo e Segmento`.
- Campos ausentes na fonte, como Valor Patrimonial dos relacionados, permanecem como `—` para evitar dado inventado.
- Contrato de FII sobe para `26.asset-modal.fii.v23`.
- Atualizados testes `fii-modal-peer-comparison-v198.test.js` e `fii-modal-peer-related-fallback-v200.test.js`.

## 2026-07-06 — Proxy v277 / patch 21.12.306-stock-revenue-seo-hidden-v277

- Auditoria comparativa de Regiões/Negócios no modal de ação contra o modal de FII.
- Identificado que ações podem expor valores de receita apenas em metadados/atributos/conteúdo indexável enquanto o corpo visível renderiza imagem; FII já chegava em texto/arrays parseáveis.
- Adicionada extração segura de `content`, `alt`, `title`, `aria-label`, `data-*` e fragmentos de scripts contendo Regiões/Negócios ou pares monetários + percentual.
- Ajustado parser textual para aceitar `R$ ... Bilhões. 71%` e evitar vazamento de linhas de Negócios dentro de Regiões em seções SEO curtas.
- Adicionado teste `stock-modal-revenue-seo-hidden-v277.test.js`.

## 2026-07-06 — Proxy v276 / patch 21.12.305-stock-revenue-business-indexed-v276

- Corrigido `revenueByBusiness` do modal de ações para aceitar respostas DataTables/indexadas do Investidor10.
- Normalizador agora interpreta `columns` + `data`/`rows` e linhas como `{0: Negócio, 1: Receita, 2: %}`.
- `revenueByRegion` recebe o mesmo hardening para manter paridade entre Regiões e Negócios.
- Adicionados aliases inline para variações de `companyBussinesRevenueChartPie`/`companyBussinessRevenueChartPie`/`companyBusinessRevenueChart`.
- Adicionado teste `stock-modal-revenue-business-indexed-rows-v276.test.js`.

## 2026-07-06 — Proxy v275 / patch 21.12.304-stock-shareholding-indexed-v275

- Corrige a Posição Acionária do modal de ação quando o Investidor10 retorna `columns`/`data` em formato DataTables ou linhas com chaves numéricas `0`, `1`, `2`, `3`.
- Mantém política estrita: sem fallback de PETR4/GGRC11, sem varredura genérica de página inteira e sem aceitar indicadores/notícias/comentários como acionistas.
- Adiciona regressão `test/stock-modal-shareholding-indexed-rows-v275.test.js`.

## 2026-07-06 — Proxy v274 / patch 21.12.303-stock-historical-indicators-v274

- Checkpoint 2: correção do histórico de indicadores fundamentalistas no modal de ação.
- Parser de ações aceita linhas indexadas/DataTables do Investidor10, onde a métrica vem em `0` e os valores vêm em `1`, `2`, `3` etc.
- Colunas tabulares passam a reconhecer `label`, `name`, `title`, `text`, `key`, `data`, `field` e `value`.
- Adicionado teste `stock-modal-historical-indicators-indexed-rows-v274.test.js`.
- Sem fallback estático ou substituição por PETR4/GGRC11.

## 2026-07-06 — Proxy v273 / patch 21.12.302-portfolio-history-range-v273

- Corrigida a normalização de ranges vindos do APK (`1mo`, `3mo`, `6mo`, `1y`, `5y`, `max`) para evitar queda silenciosa em `1Y`.
- `/api/v1/portfolio/history` fica alinhado aos seletores do gráfico Preço da carteira.
- Adicionado teste `portfolio-history-range-aliases-v273.test.js` cobrindo aliases Yahoo/Compose e aliases em português.

## 2026-07-06 — Proxy v272 / patch 21.12.301-yahoo-asset-logos-v272

- Adiciona resolução canônica de logotipos via Yahoo Finance Quote API.
- Publica `/api/v1/asset/logo` e `/api/v1/asset/yahoo-logo` para consumo direto pelo APK.
- Inclui `logoUrl`/`logoSource` nos contratos dos modais de Ação e FII quando Yahoo retorna imagem.

## 2026-07-06 — Proxy v271 / patch 21.12.300-stock-revenue-charts-amounts-v271

- Corrigida a normalização de `revenueByRegion` e `revenueByBusiness` para aceitar payloads Highcharts/Chart.js com valores monetários absolutos.
- O Proxy agora calcula a participação percentual pelo total da série, preserva `amountDisplay` em R$ e mantém o bloqueio contra campos fundamentalistas/metadata.
- Adicionado teste `stock-modal-revenue-breakdown-amount-charts-v271.test.js` cobrindo charts de região/negócio do Investidor10.

## 2026-07-06 — Proxy v270 / patch 21.12.299-stock-revenue-breakdown-strict-v270

- Contrato do modal de ação atualizado para `26.asset-modal.stock.v49`.
- Corrigida a extração de `revenueByRegion` e `revenueByBusiness` para não aceitar campos fundamentalistas/mercado como `is_active`, `tag_along`, `free_float`, `variation_30_days`, `gross_margin`, `p_l`, `ev_ebitda` e margens.
- Fontes de região e negócio passaram a ser avaliadas de forma separada, evitando contaminação entre os gráficos.
- Quando o Investidor10 não entrega dados reais da distribuição de receitas, o bloco retorna `EMPTY` em vez de montar gráfico falso com metadata.
- Adicionado teste `stock-modal-revenue-breakdown-strict-v270.test.js` reproduzindo o payload poluído do APK e validando casos reais de Petrobras por região/negócio.

## 2026-07-06 — Proxy v269 / patch 21.12.298-stock-historical-indicators-api-audit-v269

- Contrato do modal de ação atualizado para `26.asset-modal.stock.v48`.
- `GET /api/rest/assets/tickers/{TICKER}` passa a ser tratado como fonte prioritária do histórico fundamentalista, com tentativas em maiúsculo/minúsculo e com/sem barra final.
- O normalizador agora varre o envelope `rawJson` completo do Investidor10 para encontrar chaves alternativas de histórico profundamente aninhadas.
- Parser HTML da seção “Histórico de indicadores fundamentalistas” aceita linhas com valores separados por vírgula, ponto e vírgula, barra vertical e quebras de layout.
- Adicionado teste `stock-modal-historical-indicators-api-audit-v269.test.js` cobrindo formatos REST/HTML diferentes para evitar tabela vazia ou limitada a P/L/PSR.

## 2026-07-06 — Proxy v268 / patch 21.12.297-stock-modal-data-integrity-v268

- Contrato do modal de ação atualizado para `26.asset-modal.stock.v47`.
- Posição acionária passa a ser extraída somente da seção/tabelas específicas ou JSON de shareholding, sem fallback de página inteira.
- Filtro estrito bloqueia vazamento de indicadores fundamentalistas/mercado/notícias/textos de comunidade como se fossem acionistas.
- Histórico de indicadores fundamentalistas recebe endpoints e aliases adicionais para reduzir comportamento de funcionar só em um ticker específico.
- Adicionado teste `stock-modal-data-integrity-v268.test.js`.

## 2026-07-06 — Proxy v267 / patch 21.12.296-modal-runtime-freshness-v267

- Runtime de modais atualizado para `26.asset-modal.runtime.v3`.
- Cache stale dos modais deixa de ser resposta direta; após o TTL, o Proxy tenta renovar a fonte real primeiro.
- Stale passa a ser usado apenas como `STALE_FALLBACK` quando a renovação falha, preservando performance sem mascarar dado antigo.
- Diagnóstico público `modalRuntime` não expõe mais chave interna de cache.
- Adicionado teste `modal-runtime-freshness-v267.test.js`.

## 2026-07-06 — Proxy v266 / patch 21.12.295-modal-audit-polish-v266

- `routeManifest()` passa a listar `/asset/fii-modal` e `/fii/modal`, deixando o manifesto público coerente com as rotas dedicadas já atendidas.
- Runtime de modais atualizado para `26.asset-modal.runtime.v2` nos diagnósticos.
- Removida condição GET duplicada em `bodyOrQuery()`.
- Adicionado teste `modal-route-manifest-v266.test.js` para impedir regressão nas rotas dedicadas de Ação/FII.
- Mantida a regra crítica: sem fallback PETR4/GGRC11 e sem dados artificiais em produção.

## 2026-07-06 — Proxy v265 / patch 21.12.294-modal-runtime-performance-v265

- Cria `lib/analysis/asset-modal-runtime.js` para cache curto, coalescing por ticker/família/superfície e diagnóstico de runtime dos modais.
- Atualiza o contrato de ação para `26.asset-modal.stock.v46` e o de FII para `26.asset-modal.fii.v22`.
- Reduz latência do modal de ação ao paralelizar comparação com índices, checklist/ranking e comunicados.
- Reduz latência do modal de FII ao paralelizar histórico de indicadores, vacância e comunicados após a leitura base.
- Mantém a regra crítica: sem fallback PETR4/GGRC11 e sem dados artificiais em produção.

## 2026-07-06 — Proxy v264 / patch 21.12.293-stock-shareholding-strict-v264

- Contrato de ação atualizado para `26.asset-modal.stock.v45`.
- Posição acionária agora só aceita tabelas/containers explícitos de acionistas com `% ON`, `% PN` e `% Total`.
- Rejeita falsos positivos vindos de notícias, comentários, indicadores (`DY`, `ROE`, `P/VP`) e campos genéricos `value`/`valor`.
- Regressão adicionada: `stock-modal-shareholding-strict-i10-v264.test.js`.

## 2026-07-05 — Proxy v263 / patch 21.12.292-stock-revenue-region-shareholding-v263

- Contrato de ação atualizado para `26.asset-modal.stock.v44`.
- Corrige `revenueByRegion` e `revenueByBusiness` para ações quando o REST do Investidor10 entrega valores monetários por ano em vez de percentuais prontos.
- `shareholdingPosition` agora usa também `/api/rest/assets/tickers/{TICKER}` e fontes `shareholdingSources`, sem capturar linhas de indicadores ou receitas como acionistas.
- Mantida política sem fallback PETR4/GGRC11, sem mock e sem WebView.

## 2026-07-05 — Proxy v262 / patch 21.12.291-stock-historical-indicators-rest-long-records-v262

- Contrato de ação atualizado para `26.asset-modal.stock.v43`.
- O resolvedor de IDs agora consulta explicitamente `https://investidor10.com.br/api/rest/assets/tickers/{TICKER}` antes dos endpoints internos, permitindo acionar `/api/balancos/indicadores/table|chart/{companyId}/3650/` mesmo quando o HTML não expõe o ID.
- Corrigido parser do Histórico de Indicadores Fundamentalistas para payload REST em registros longos, exemplo `{ indicador, ano, valor }`, `{ indicator, period, value }` e `{ metricName, fiscalYear, metricValue }`.
- Metadados como `description`, `value`, `valor`, `year/ano`, `source` e campos auxiliares continuam impedidos de virar colunas da tabela.
- Chamada REST do Investidor10 reforçada com `User-Agent` explícito e `Referer` do ativo.
- Mantida a política sem fallback PETR4/GGRC11, sem mock e sem dado simulado.

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
