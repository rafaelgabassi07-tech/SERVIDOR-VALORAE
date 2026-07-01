## 21.12.186-supabase-transaction-sync-v156

- Corrige o salvamento de lançamentos da Carteira no Supabase quando a tabela remota não aceita o upsert principal por `client_tx_id`.
- Adiciona caminho compatível que remove o escopo afetado e reinsere as transações sem deixar o APK preso em pendência permanente.
- Normaliza tickers de transações com a mesma regra usada no escopo de substituição.

## 21.12.185-news-feed-volume-tags-v155

- Aumenta o volume de notícias suportado pelo endpoint.
- Normaliza tags para que notícias solicitadas por símbolos da carteira sejam exibidas como Carteira no APK.

## 21.12.184-news-search-query-v154
- `/api/v1/news` passa a aceitar `query`/`search` como busca textual livre para a página de Notícias do APK.
- Mantém compatibilidade com `ticker`, `symbol`, `symbols` e `q` quando o termo parece ticker único.
- Resposta inclui `query` e `search` para rastrear a intenção usada na busca.


## 21.12.183 — radar Jan-Dez e logos do ranking — 2026-06-30

- Rankings do Investidor10 passam a expor `logoUrl` e `logo_url` quando a imagem do ativo está disponível no HTML da fonte.
- Cache dos rankings foi invalidado para evitar reaproveitar payload antigo sem logotipo.
- Contrato do Radar de Dividendos permanece com 1 resumo + 12 meses de Data COM + 12 meses de Data Pagamento para o APK renderizar janeiro a dezembro sem desaparecimento.

## 21.12.176-analysis-value-scale-v146 — Correção de escala de valores da Análise

- Preserva sufixos de escala monetária em campos da Análise.
- Evita valores de grande porte aparecendo como pequenos reais unitários no APK.
- Suprime campos zerados/indisponíveis de faixa de preço e liquidez.
- Não altera Supabase, sincronização, SQL ou contratos de carteira.

## 2026-06-18 — 21.12.146-analysis-comparison-visual-v83

- Reforça o contrato de pares setoriais do comparador da página Análise.
- `/api/v1/assets?peerOf=...` passa a devolver `strictSameSector=true` e `searchPolicy=analysis_same_sector_suggestions_v83`.
- `/api/v1/assets?peerOf=PETR4&compareWith=BBAS3` passa a devolver `compatibility`, indicando se o par pertence ao mesmo `peerGroup`.
- Catálogo setorial ampliado para reduzir estados vazios em petróleo/gás, energia e infraestrutura financeira.
- Mantém respostas sem preço/variação simulados e sem recomendação de compra/venda.

## 2026-06-17 — 21.12.142-analysis-modal-curated-carteira-v61

- Atualiza `consumerContract` para `26.analysis.surface.v4`.
- Mantém a página Análise completa e limita os modais da Carteira/rankings aos 9 blocos solicitados.
- Documenta `uiPolicy.modalCuratedSectionIds` para consumo do APK.
- Preserva cotação em tempo real e chart `revenue_profit` para renderização curada nos modais.

## 2026-06-17 — 21.12.141-analysis-unified-realtime-v60

- Unifica a lista de seções prontas entre página Análise, modal de ativo da carteira e modal de ativo dos rankings.
- Adiciona cotação em tempo real ao gráfico `price_history`, preservando série histórica real quando disponível.
- Atualiza `consumerContract` para `26.analysis.surface.v3`, sem cortar informações por superfície.


## 2026-06-16 — 21.12.140-analysis-modals-connected-v57

- Conecta a página Análise aos consumidores reais `portfolio_asset_modal` e `ranking_asset_modal`.
- `/api/v1/analysis` passa a aceitar `surface`/`consumer` e marca a superfície ativa no `consumerContract`.
- Mantém a regra real-only: sem dados simulados, sem diagnóstico técnico na UI final.
- Adiciona teste `analysis-modals-connected-v57.test.js` para carteira e ranking.

## 2026-06-16 — 21.12.135-analysis-source-coverage-v52

Patch: `21.12.135-analysis-source-coverage-v52`

- Ampliada a cobertura real da página Análise para Investidor10 e StatusInvest em ações e FIIs.
- Incluído roteamento de PEG Ratio para ações e histórico/indicadores quando disponível.
- Adicionadas seções limpas para Patrimônio e Contábil do FII e Portfólio do FII no contrato `/api/v1/analysis`.
- Encaminhados `fiiInfo`, lista de imóveis, distribuição por estado, distribuição de ativos, comparação de FIIs e dados patrimoniais capturados de caminhos canonical/sections/results.
- Mantida política real-only: nenhuma informação é simulada quando a fonte não fornece dados.

## 2026-06-16 — 21.12.134-analysis-source-routing-v51

Patch: `21.12.134-analysis-source-routing-v51`

- Corrige o roteamento do Histórico de Indicadores para o contrato da Análise, incluindo `assetChartsCanonical.company.fundamentalIndicatorHistory`, `assetChartsCanonical.fii.fundamentalIndicatorHistory`, `sections.historicoIndicadores` e tabelas reais da fonte.
- Corrige a Posição acionária para aceitar `results.sections.empresa.posicaoAcionaria`, mapas de acionistas, arrays tabulares e extração HTML real do Investidor10.
- Reforça o extractor do Investidor10 para encaminhar `rawJson.historicoIndicadoresFii` ao canonical de FIIs.
- Adiciona teste regressivo v51 garantindo que as duas pendências não entrem em `missingSignals` quando houver dados reais.

## 2026-06-16 — 21.12.133-analysis-solid-units-v50

Patch: `21.12.133-analysis-solid-units-v50`

- Reforça a leitura de valores monetários com unidades da fonte, incluindo mil, milhões, bilhões e trilhões.
- Padroniza DRE e Balanço por período em formato compacto real, sem transformar snapshot pontual em demonstrativo.
- Adiciona teste regressivo para garantir que séries de DRE e Balanço preservem valores em escala correta.

## 2026-06-16 — 21.12.132-analysis-clean-mobile-v48

Patch: `21.12.132-analysis-clean-mobile-v48`

- A comparação da página Análise passa a aceitar ativo + IBOV, IFIX, CDI, IPCA, SMLL, IDIV e IVVB11 quando houver séries reais alinhadas.
- A área Sobre a empresa passa a receber `Valor da firma` a partir das informações reais da fonte, incluindo o bloco `INFORMAÇÕES SOBRE A EMPRESA` do Investidor10.
- Valores monetários duplicados da fonte, como valor simples + valor detalhado, são normalizados para exibição compacta no APK sem inventar informação.
- A regra real-only continua preservada: benchmarks sintéticos/proxy ticker continuam rejeitados.

## 2026-06-16 — 21.12.127 — Auditoria rigorosa da extração HTML da Análise

Patch: `21.12.127-analysis-html-extraction-real-only-v43`

- A rota real `/api/v1/analysis` continua usando extração HTML balanceada para objetos JSON aninhados do Investidor10, incluindo gráficos com `datasets` internos.
- URLs reais de APIs de gráficos descobertas no HTML passam a ser consultadas de forma deduplicada e limitada.
- DRE, Balanço e Fluxo de Caixa ficam bloqueados quando a fonte fornece apenas `financialSummary`/snapshot pontual; demonstrativo exige série, tabela ou gráfico real capturado.
- Descrições, setor, subsetor e segmento genéricos deixam de ser preenchidos quando a fonte não envia texto/classificação real.
- Criados testes regressivos `analysis-investidor10-html-extractor-v42` e `analysis-html-extraction-real-only-v43` cobrindo JSON aninhado, objetos JS-like, bloqueio de demonstrativos sem série real e bloqueio de classificações inventadas.

## 2026-06-16 — 21.12.125 — Análise com cobertura ampliada das fontes reais

Patch: `21.12.125-analysis-source-coverage-v41`

- Ampliada a cobertura da página Análise contra StatusInvest, Investidor10 e referência técnica do referência técnica externa.
- Adicionadas seções normalizadas para mercado/risco/liquidez, posição acionária e checklist de FIIs.
- Corrigida a leitura de demonstrativos financeiros multi-ano por labels/datasets e por mapas de período.
- Mantida a regra: sem dados sintéticos e sem gráficos históricos com apenas um período real.

## 2026-06-16 — 21.12.124 — Análise com fontes reais para demonstrativos e receita

Patch: `21.12.124-analysis-source-extraction-v40`

- DRE, Balanço e Fluxo de Caixa passam a aproveitar tabelas anuais multi-período vindas da fonte.
- Receita por negócio e região passa a aceitar formatos reais de gráficos do Investidor10.
- Gráficos históricos seguem bloqueados quando só há ano atual.

## 2026-06-16 — 21.12.123 — Análise por categorias e gráficos sempre visíveis

Patch: `21.12.123-analysis-clean-categories-visible-charts-v39`

- Página Análise reorganizada por categorias limpas no APK.
- Gráficos deixam de ficar dentro de área recolhível; apenas dados textuais longos podem ser compactados.
- Extração de receita por negócio/região ampliada no Proxy.
- Receita por negócio/região usa barras horizontais quando há percentuais reais.

## 2026-06-16 — 21.12.122 — Revisão estrutural da página Análise

Patch: `21.12.122-analysis-page-rework-v38`

### Objetivo
Corrigir a página Análise para deixar de exibir informações técnicas/cruas ao usuário final e melhorar a fidelidade visual dos gráficos por tipo de dado.

### Mudanças
- Remove contagens técnicas como "pontos" dos itens de gráficos; o contrato passa a entregar período e último valor como leitura útil.
- Gráficos periódicos/discretos, como proventos, DY, payout, receitas/lucros, evolução patrimonial e demonstrativos, passam a ser classificados como barras ou barras agrupadas quando isso melhora a interpretação.
- Cotação histórica permanece em linha por representar evolução contínua.
- Comparadores de índices mantêm séries reais alinhadas e passam a poder gerar um gráfico agrupado "ativo x índices" quando há período comum suficiente.
- Campos financeiros zerados em "Sobre a empresa" deixam de ser tratados como dado válido.
- Seções sem fonte suficiente usam mensagem neutra de usuário final; termos técnicos como Proxy EMPTY não devem vazar para o APK.
- Balanço por período continua bloqueado quando não houver série real com pelo menos dois períodos.

### Regras preservadas
- Sem dado sintético.
- Sem HTML, iframe, WebView ou imagem externa.
- Página Análise segue no contrato `AnalysisPageResponse` em `/api/v1/analysis`.

## 2026-06-16 — 21.12.121 — Checkpoint 37: Auditoria final da Análise

- Revisão final do contrato único `/api/v1/analysis` com `AnalysisPageResponse` e `contractVersion = 26.analysis.v2`.
- Testes adicionados para ticker inexistente, resposta parcial, FIIs completos, comparadores com fonte simulada aninhada e gráficos alinhados por período real.
- Confirmado que gráficos temporais seguem como `line`/`multi_line` e composições seguem como `donut_composition` ou composição percentual.
- Confirmado que `missingSignals` não aponta seções que já têm `items[]` ou `charts[]` reais.
- Validado que o APK mantém busca inteligente por `submittedTicker` e não chama `/api/v1/analysis` a cada letra.
- Novo teste regressivo: `analysis-final-audit-v37.test.js`.

## 2026-06-16 — 21.12.120 — Checkpoint 36: Refinamento visual final da Análise

- A página Análise ganhou mapa visual compacto dos blocos recebidos pelo contrato único.
- Seções longas, como Histórico de Indicadores, Demonstrativos e FIIs completos, agora podem ser recolhidas com prévia curta.
- Cabeçalhos das seções mostram fonte, quantidade de itens e quantidade de gráficos, reduzindo ruído visual.
- Sinalizações foram reduzidas e mantidas discretas para não competir com dados reais.
- A busca inteligente do Checkpoint 35 foi revisada e mantida: `/api/v1/analysis` só carrega após confirmação/toque em sugestão.
- Novo teste regressivo: `analysis-visual-refinement-v36.test.js`.

## 2026-06-16 — 21.12.119 — Checkpoint 35: Busca inteligente da Análise

- `/api/v1/assets` ganhou política `analysis_intelligent_search_v35` para sugestões por ticker, nome e segmento.
- Sugestões retornam sem preço/variação simulados, com `rank`, `match` e fonte `VALORAE_CATALOG`.
- O APK separa sugestões de carregamento: `/api/v1/analysis` só é chamado após confirmação ou toque em sugestão.
- Adicionados últimos pesquisados, favoritos/carteira priorizados, debounce de 360 ms e estado sem resultado.
- Novo teste regressivo: `analysis-intelligent-search-v35.test.js`.

## 2026-06-16 — 21.12.118 — Revisão de fidelidade dos gráficos da Análise

- Comparadores passam a exigir períodos reais comuns entre ativo e índice/par.
- `profit_vs_quote` corrigido para `multi_line`.
- Composições percentuais de FIIs rejeitam percentuais inválidos.
- Novo teste de fidelidade: `analysis-chart-source-fidelity-v34-review.test.js`.

## 2026-06-16 — 21.12.117 — Checkpoint 34: FIIs completos na Análise

- Implementada seção `fii_details` no contrato único `/api/v1/analysis` para consolidar dados específicos de FIIs.
- Normalizados cadastro, gestão, rendimentos, P/VP, valor patrimonial, vacância, cotistas, cotas emitidas, imóveis, distribuição de ativos e FIIs relacionados.
- Gráficos específicos de FIIs continuam em linha/composição real, sem retornar a barras temporais.
- Comparadores de FIIs seguem bloqueando séries simuladas e exigindo dados reais alinhados.
- Testes do Proxy passaram com 33 test files e failures=0.

## 2026-06-16 — 21.12.116 — Revisão global dos Checkpoints 27 a 33 da Análise

- Corrigido `npm test` do Proxy para funcionar também quando o pacote Proxy é extraído sozinho, sem depender de uma pasta APK irmã.
- Reforçado `dualSeriesChart` para aceitar gráficos `multi_line` somente quando as duas séries tiverem pelo menos dois períodos em comum.
- Atualizada política de fontes do `AnalysisPageResponse` para explicitar StatusInvest/Investidor10, Yahoo Finance, B3 e BCB conforme o tipo de dado.
- Mantido contrato único `/api/v1/analysis`, `AnalysisPageResponse` e `contractVersion = 26.analysis.v2`.
- Sem alteração de `versionCode`/`versionName` do APK.

## 2026-06-16 — 21.12.115 — Revisão do Checkpoint 33: Comparadores da Análise

- Revisada fielmente a seção `comparisons` do `/api/v1/analysis`.
- Mantido `AnalysisPageResponse` (`26.analysis.v2`) e gráficos `multi_line` para ativo x índice/par.
- Reforçada a proteção contra comparadores falsos: agora flags `simulated`, `synthetic`, `fake`, `proxyTickerUsed`, `reconstructedFromYahooSnapshot` e textos de fallback falso são bloqueados também dentro de `series[]` e `points[]`, não só no comparador raiz.
- Pares semelhantes com `proxyTickerUsed`, ETF/proxy ticker ou fonte simulada são descartados.
- `npm run check` e `npm test` passaram com 32 arquivos de teste e 0 falhas.

## 2026-06-16 — 21.12.114 — Checkpoint 33: Comparadores da Análise

- A seção `comparisons` do `/api/v1/analysis` passa a normalizar comparadores reais como `multi_line`.
- Ativo x índice exige duas séries alinhadas: série do ativo e série do índice/par, com pelo menos 2 pontos cada.
- IBOV, IFIX, CDI e IPCA só aparecem quando houver fonte confiável; SMLL/IDIV ficam suportados quando vierem de fonte real já conhecida.
- Rejeitados índice simulado, proxy ticker, ETF substituto, próprio ticker como par e comparador sem série do ativo.
- O APK ganhou bloco visual próprio para Comparadores, preservando Canvas de linhas e sem barras para séries temporais.
- Teste regressivo: `analysis-comparators-v33.test.js`.

## 2026-06-16 — 21.12.112 — Revisão dos gráficos da Análise

- Corrigida a classificação visual dos gráficos do contrato `/api/v1/analysis`.
- Séries temporais de proventos, receitas/lucros, evolução patrimonial, payout e demonstrativos passam a sair como `line`/`multi_line`, não `bar`/`bar_line`.
- Distribuições, como ativos de FIIs e receitas por negócio/região, passam a sair como `donut_composition`.
- O APK foi ajustado para desenhar linhas nativas no Canvas e composições via arco/donut, sem `drawRoundRect` para séries temporais.
- Adicionado teste regressivo `analysis-chart-rendering-v31-review.test.js`.
- Sem HTML, iframe, WebView, imagem externa ou dados simulados.


## 2026-06-16 — 21.12.111 — Checkpoint 31: Sobre Empresa/Fundo na Análise

- A seção `company_profile` passa a normalizar descrição e cadastro real de empresas e FIIs.
- Empresas: setor, subsetor, segmento, CNPJ, site, atividade principal, governança, tag along, free float, número de ações, valor de mercado e patrimônio líquido.
- FIIs: razão social, CNPJ, administrador, gestor, segmento, tipo de fundo, mandato, tipo de gestão, prazo, taxa de administração e público-alvo.
- Mantido `/api/v1/analysis` como contrato único da página Análise, sem HTML ou dados simulados.

## 2026-06-16 — Checkpoint 30 — DRE, Balanço e Fluxo de Caixa

- `/api/v1/analysis` mantém `AnalysisPageResponse` (`26.analysis.v2`).
- A seção `financial_statements` passa a normalizar demonstrativos reais: DRE, Balanço e Fluxo de Caixa.
- DRE cobre Receita líquida, Lucro bruto, EBIT, EBITDA e Lucro líquido.
- Balanço cobre Ativos, Passivos, Patrimônio líquido, Dívida bruta, Dívida líquida e Caixa.
- Fluxo de Caixa cobre Fluxo operacional, Fluxo de investimento e Fluxo de financiamento.
- A seção envia `items[]` para tabela e `charts[]` apenas quando há séries numéricas reais com pelo menos dois períodos.
- Não há HTML, iframe, imagem externa, índice ou valor simulado.
- Patch: `21.12.110-analysis-financial-statements-v30`.


## 2026-06-16 — Checkpoint 29 — Histórico de Indicadores completo

- `/api/v1/analysis` mantém `AnalysisPageResponse` (`26.analysis.v2`).
- `historical_indicators` passa a normalizar históricos reais de Ações e FIIs em tabela e gráficos estruturados.
- Ações: P/L, P/VP, DY, ROE, ROIC, margens, dívida, liquidez e crescimento de receita/lucro.
- FIIs: P/VP, DY, vacância, valor patrimonial por cota, rendimento por cota, cotistas e liquidez.
- Gráficos históricos só são emitidos com dois ou mais pontos reais. Sem HTML, iframe, WebView, imagem externa ou simulação.

# 2026-06-16 — Patch 21.12.108-analysis-real-charts-v28-review

- Revisão do Checkpoint 28 após auditoria do fluxo de gráficos.
- Corrigido o risco de o Proxy mostrar o próprio ticker como se fosse comparador de índice. Comparadores agora só aparecem quando houver série real de índice/par enviada pela fonte.
- Corrigida a proteção do gráfico `profit_vs_quote`: ele só renderiza quando houver cotação e lucro reais em ao menos dois períodos; séries zeradas ou mal alinhadas são descartadas.
- Mantido o contrato `/api/v1/analysis` como `AnalysisPageResponse 26.analysis.v2`.
- Teste `analysis-real-charts-v28.test.js` ampliado para cobrir comparador falso e `Lucro x Cotação` inválido.
- Política preservada: sem HTML, iframe, WebView, imagem de site ou valores simulados.

# 2026-06-16 — Patch 21.12.107-analysis-real-charts-v28

- Checkpoint 28 implementa gráficos reais na página Análise usando `charts[].series[].points` do contrato `AnalysisPageResponse`.
- O Proxy passa a expor séries estruturadas adicionais para `dividend_yield_history`, `payout_history`, rendimento mensal de FIIs, valor patrimonial de FIIs e distribuição de ativos do fundo quando a fonte entrega dados reais.
- Comparadores continuam separados em `comparisons` e só aparecem quando há série confiável de índice/ativo semelhante; nenhum IBOV, IFIX, CDI ou IPCA é simulado.
- O APK deixa de renderizar mini-barras simples e passa a desenhar gráficos nativos em Canvas, com barras, linhas, legendas e último ponto.
- Mantida a regra: sem HTML, iframe, WebView, imagem de site ou valores fabricados para a Análise.
- Rotas antigas de patrimônio, retorno, proventos, agenda, detalhes do ativo, equilíbrio e carteira permanecem preservadas.

# 2026-06-15 — Patch 21.12.105-analysis-real-sections-and-charts

- `/api/v1/analysis` evolui para o contrato `26.analysis.v2`.
- Integra ao `AnalysisPageResponse` as seções `historical_indicators`, `financial_statements`, `asset_charts`, `company_profile`, `revenue_breakdown` e `comparisons`.
- Gráficos passam a ser enviados como séries JSON estruturadas em `charts[].series[].points`, sem HTML bruto, WebView ou dados sintéticos.
- As sinalizações discretas continuam ativas, mas agora indicam apenas seções que realmente vieram sem dados suficientes.
- Corrigida a leitura de `companyInfo.descricao`, `setor`, `subsetor` e `segmento` para não serem sobrescritos por campos vazios.
- Rotas antigas de ativos, carteira e modais permanecem preservadas.

# 2026-06-15 — Patch 21.12.103-analysis-unique-contract

- Cria o endpoint exclusivo `/api/v1/analysis` para a página Análise do APK.
- Introduz o contrato único `AnalysisPageResponse`, com seções `summary` e `fundamental_indicators`.
- A Análise passa a ser alimentada por JSON normalizado do Proxy, sem depender de `quoteOverview`, `assetSummary` solto, `appPayload.assetAnalysisPage` ou `appMobileSnapshot.assetAnalysisPage`.
- As rotas antigas de ativo, gráficos, proventos, carteira e modais permanecem intactas para evitar regressão.
- Adiciona teste de contrato que garante 5 itens no Resumo do Ativo e 31 Indicadores Fundamentalistas quando os dados existem.

# 2026-06-15 — 21.12.102 — Análise: resumo completo e visual alinhado

- `assetAnalysisPage` passa para `21.12.102-analysis-summary-visual-contract`.
- O Resumo do Ativo agora usa também a taxonomia dos Indicadores Fundamentalistas para completar P/L, P/VP e DY quando o `assetSummary` vier parcial.
- Reforçados aliases de Variação/Valorização 12M para alimentar corretamente o card de resumo sem usar variação diária indevidamente.
- Mantida a política de não simular valores ausentes.

# 2026-06-15 — 21.12.101 — Análise híbrida StatusInvest + Investidor10

- A página Análise passa a usar StatusInvest como fonte primária para números estruturados quando disponível.
- Investidor10 permanece como referência visual, ordem das seções e complemento para campos específicos.
- `assetAnalysisPage` passa para `21.12.101-analysis-hybrid-statusinvest-primary`.
- Resumo do Ativo prioriza os cinco cards: Cotação, Variação (12M), P/L, P/VP e DY.
- Ampliados aliases de leitura para rótulos do StatusInvest e Investidor10: D.Y, P/SR, M. Bruta, M. EBIT, M. EBITDA, Dív. líquida/PL, PL/Ativos, Liq. corrente e Valorização (12m).
- Sem dados sintéticos: campos ausentes continuam omitidos.
- `view=app` agora preserva `assetAnalysisPage` no topo, em `appPayload` e em `appMobileSnapshot`, evitando payload sem Análise no APK.
- APK adiciona fallback visual para quote/indicadores legados enquanto a captura profunda ainda não trouxe o contrato completo.

# 2026-06-15 — 21.12.100 — Indicadores Fundamentalistas de Ações na Análise

- Implementa a seção oficial `stockFundamentalIndicators` no contrato `assetAnalysisPage`.
- A seção segue a lista de Indicadores Fundamentalistas de Ações exibida no Investidor10: P/L, P/Receita (PSR), P/VP, DY, payout, margens, múltiplos EV, múltiplos de ativo, VPA, LPA, giro, ROE, ROIC, ROA, endividamento, estrutura patrimonial, liquidez e CAGR de 5 anos.
- Corrige a rota `/api/v1/asset` para aceitar `ticker`, `symbol`, `q` ou `query`, evitando que o APK chame o Proxy com parâmetro válido e receba payload sem o ativo.
- Mantém a política de não simular valores ausentes: só são enviados cards com dados reais capturados/normalizados.

# 2026-06-15 — 21.12.99 — Reset limpo da Análise e Resumo funcional

- Reinicia o contrato `assetAnalysisPage` para a página Análise com a versão `21.12.99-analysis-reset-clean-summary`.
- Substitui a lógica anterior de seções por um contrato menor e controlado, começando por `assetSummary`.
- `assetSummary` separa Ações e FIIs e normaliza somente campos reais já presentes no payload do Proxy.
- Mantém a política de não criar valores sintéticos, não simular gráficos e não preencher campos ausentes artificialmente.
- A página Análise do APK deve renderizar o contrato novo e não depender de renderizadores legados de gráficos/mapas.

# 2026-06-15 — 21.12.98 — Resumo do Ativo estruturado na Análise

- `assetAnalysisPage.sections[key=quoteOverview]` agora é montado como resumo estruturado, com linhas normalizadas e prontas para o APK.
- Para Ações, o resumo prioriza ticker, nome, classe, cotação, variação 12M, DY, P/VP, P/L, liquidez, setor, subsetor, segmento, valor de mercado, patrimônio, ROE/ROIC, margem, payout, free float e tag along quando a fonte entrega.
- Para FIIs, o resumo prioriza ticker, nome do fundo, cotação da cota, DY 12M, P/VP, liquidez diária, último rendimento, valor patrimonial por cota, valor patrimonial total, vacância, cotistas, cotas emitidas, segmento, tipo, mandato, gestão, prazo, taxa, público-alvo e CNPJ quando disponíveis.
- Mantém a política `no synthetic values`: o Proxy não cria valores quando o Investidor10 não entrega o campo.
- O contrato continua compatível com `rows` e `previewRows`, mas agora o Resumo do Ativo deixa de depender de objetos genéricos de cotação.

# 2026-06-14 — Retorno: IFIX, IDIV e SMLL somente via Yahoo

- Remove o fallback do Investidor10 para IFIX, IDIV e SMLL no contrato de Retorno.
- Desativa também B3 e Mais Retorno como fallback para estes três índices, mantendo exclusivamente Yahoo Finance Chart API com `IFIX.SA`, `IDIV.SA` e `SMLL.SA`.
- Quando o Yahoo retorna apenas snapshot, o Proxy usa somente `regularMarketPrice` e `chartPreviousClose`/`previousClose` do próprio Yahoo para montar uma comparação mínima, sem ETF, proxyTicker ou fonte alternativa.
- `/api/v1/market/indices` passa a seguir a mesma política Yahoo-only para IFIX, IDIV e SMLL.

# v21.12.60 — Rankings da Home Investidor10 sincronizados ao APK


## 2026-06-14 — Retorno: IFIX, IDIV e SMLL via Yahoo Finance Chart API

- IFIX, IDIV e SMLL passam a usar os símbolos diretos `IFIX.SA`, `IDIV.SA` e `SMLL.SA` na Yahoo Finance Chart API para o histórico/snapshot do modal Retorno.
- B3 e Investidor10 permanecem como fallback de histórico; nenhum ETF, proxyTicker ou ativo substituto é usado para esses índices.
- `/api/v1/asset/history` foi alinhado ao mesmo resolvedor de índices usado pelo contrato `/api/v1/portfolio/returns`.
- Validação local: `npm run check` e `npm test` passaram sem falhas.

- Corrige a fonte padrão de `Maiores Altas` e `Maiores Baixas` para a Home do Investidor10, evitando divergência com páginas dedicadas ou fallback de comparação.
- Adiciona `source=home` em `/api/v1/market/rankings` para o APK VALORAE.
- Desativa fallback de comparação/cesta fixa para rankings ao vivo sem tickers, impedindo ativos fora da Home do Investidor10.
- Parser agora ignora menus/rankings genéricos e exige ticker, preço e variação nos blocos capturados.
- Páginas dedicadas continuam opcionais via `source=dedicated`/`source=pages`.

# v21.12.59 — Rankings Investidor10 próprios e captura completa

- Substitui o mecanismo simples de rankings por um extrator próprio do VALORAE Proxy, baseado nas mesmas páginas que o VALORAE usa no Investidor10: `maiores-altas` e `maiores-baixas`.
- Adiciona fallback para a home do Investidor10 quando as páginas dedicadas falharem, mantendo stale-if-error e sem criar dados sintéticos.
- Entrega aliases compatíveis com o APK VALORAE Carteira: `altas/baixas`, `highs/lows`, `gainers/losers`, `topGainers/topLosers` e `maioresAltas/maioresBaixas`.
- Adiciona `mode=complete`, `strict=1`, `limit` e `minRows` em `/api/v1/market/rankings` para exigir captura com ticker, preço e variação.
- Reforça `/api/v1/asset` e `/api/v1/assets` com `complete=1`/`fullCapture=1`, ativando perfil profundo, HTML completo, APIs internas e complemento StatusInvest para reduzir respostas parciais.
- Adiciona teste regressivo `test/rankings-i10-valorae-mechanism-v21-12-59.test.js`.

## v21.12.51 - Post Benchmark Performance Hardening

## 21.12.52-news-reliability-upgrade

- Reforça `/api/news` e `includeNews=1` para integração segura do APK.
- RSS vazio/malformado agora retorna `ok=false` com `GOOGLE_NEWS_EMPTY`, nunca sucesso falso.
- Adiciona cache/stale de notícias, política `shouldKeepPreviousNews` e `canReplacePreviousNews`.
- Preserva `news` e `newsStatus` no `view=app`.
- Adiciona `test/news-reliability-v21-12-52.test.js` e `npm run bench:news`.

- Implementa response cache serializado para `/api/scrape`, com fast-path `RESULT_RESPONSE_HIT` e retorno quente abaixo de 3 ms no benchmark controlado.
- Adiciona `profile=scrape-fast`, sem gráficos/diagnóstico pesado por padrão, preservando métricas essenciais e payload enxuto.
- Adiciona coalescing de fetch concorrente na rota `/api/scrape`, garantindo 25 chamadas simultâneas idênticas com 1 fetch real no teste regressivo.
- Corrige métricas do `/api/batch-scrape`, separando `logical`, `execution` e `coalescing` para cold/hot cache.
- Limita `extractionCoveragePercent` a 0–100 e adiciona `coverageRatio` para informar excedente sem quebrar semântica de porcentagem.
- Adiciona métricas de rota `validationMs`, `cacheLookupMs`, `engineTimeMs`, `shapeTimeMs`, `serializeTimeMs`, `handlerTotalMs` e `responseBytes`.
- Adiciona `test/post-benchmark-hardening-v21-12-51.test.js` e `npm run bench:post-benchmark`.

- Corrige divergência entre `public/index.html` e `public/server.html`, garantindo uma única experiência do Monitor.
- Remove artefatos Gradle e resíduos de patch do topo do pacote final do proxy.
- Atualiza manifest/service worker para `21.12.51` e cache `valorae-proxy-server-v21-12-51`.
- Adiciona teste regressivo de higiene de pacote e espelhamento HTML.

## v21.12.48 - Monitor Responsive Settings Theme

- Corrige filtros da página Saída do Proxy com dropdown flutuante, quebra de linha e proteção contra corte no viewport.
- Adiciona página Configurações para tema, origem da API, polling e diagnóstico de responsividade.
- Adiciona botão de modo claro/escuro no cabeçalho, com persistência em localStorage e suporte a preferência do sistema.
- Reforça adaptação mobile/tablet/desktop com breakpoints dedicados, drawer e filtros em largura total no celular.
- Substitui ícones simples do menu lateral por ícones SVG lineares.
- Preserva camadas de extração, fontes ricas, gráficos, rankings e dados da v21.12.47.

## v21.12.48 - Canonical Data Reliability Layer

- Adiciona `lib/canonical/cvm-reliability-layer.js` para preencher campos lentos ausentes com política fill-missing-only.
- Preserva Investidor10 e StatusInvest como fontes ricas de gráficos, rankings, dividendos, descrições e indicadores.
- Adiciona raiz `dataReliability` com status por bloco: identity, quote, fundamentals, dividends, charts e rankings.
- Expõe sinais de canonical reliability no Monitor, em `extractionCompleteness` e no manifesto de integração.
- Adiciona `VALORAE_CANONICAL_DATA_ENABLED`, `VALORAE_CANONICAL_SEED_ENABLED` e `VALORAE_CANONICAL_REGISTRY_JSON`.
- Adiciona teste `canonical-reliability-layer-v21-12-48.test.js` e benchmark `bench:canonical`.

## v21.12.45 - Final audit corrections

- Corrige `/api/assets` para preservar duplicatas solicitadas, mantendo ordem e quantidade original no payload entregue ao app.
- Mantém dedupe interno de extração para evitar trabalho repetido quando a carteira/lista contém tickers iguais.
- Harmoniza labels de release no Monitor, OpenAPI, manifestos, readiness, metadata e PWA.
- Preserva melhorias v21.12.44 de stale-while-revalidate, `timeoutMs` propagado e baixa latência.
- Adiciona teste `final-audit-corrections-v21-12-45.test.js`.

## v21.12.44 - Stale budget performance boost

- Corrige `stale-if-error` do cache final: a entrada stale agora sobrevive até `staleUntil` e pode realmente proteger o app quando a fonte falha.
- Adiciona `stale-while-revalidate` para baixa latência, retornando o último payload bom rapidamente enquanto a instância tenta atualização best-effort.
- Propaga `timeoutMs` para Yahoo, Google News, ValoraeScrape, DirectFetch, APIs internas e complementos, evitando chamadas frias longas com orçamento curto.
- Desativa retries e sleeps pesados em `lowLatencyBudget`, reduzindo latência percebida para cards, listas e carteira.
- Aplica orçamento de baixa latência também em `/api/assets`.
- Adiciona `bench:stale-budget`/`bench:latency` e teste regressivo `timeout-performance-guard-v21-12-44`.

## v21.12.42 - Performance harmony boost

- Adiciona hedge StatusInvest para `profile=turbo`/`deep`, reduzindo latência quando a extração principal vem pobre.
- Deduplica tickers repetidos em batch/carteira sem alterar a ordem esperada pelo app.
- Expõe completude, perfil, hedge, snapshot e complementos no Monitor do Proxy.
- Adiciona teste `extraction-performance-harmony-v21-12-42`.

## v21.12.41 - Turbo extraction max

- Adiciona perfil `turbo`/`max` para máxima completude com cache forte.
- Introduz score de completude por campos críticos para reduzir `PARTIAL` falso e acionar fallbacks com mais precisão.
- Aciona StatusInvest como complemento sob demanda quando a extração principal continua pobre.
- Corrige chave do cache final para separar chamadas `complete`, snapshot e complemento de fonte.
- Adiciona teste `extraction-turbo-v21-12-41`.

## v21.12.39 - Full project audit hardening

- Sincroniza release atual em metadata, PWA, Service Worker, painel, métricas e manifesto de integração.
- Atualiza cache PWA para `valorae-proxy-server-v21-12-40` para evitar shell antigo após deploy.
- Limpa resíduos de patch/build do ZIP final e adiciona auditoria regressiva `full-project-audit-v21-12-39`.
- Atualiza auditorias legadas para aceitarem patches posteriores da família 21.12.x sem falso negativo.
- Mantém `/api/scrape` sem URL e com HTTP como `400` esperado e didático, não como falha do proxy.

## v21.12.38 - Failure audit hardening

- Corrige falhas confirmadas no relatório v21.12.37: auditorias legadas, `/api/scrape` didático, dados financeiros `PARTIAL`, metadata free-only, Gradle fora do pacote proxy e router local.
- `/api/scrape` agora retorna `400` para URL ausente/protocolo inválido e `403 SCRAPE_HOST_NOT_ALLOWED` para domínio não permitido.
- Adiciona `lib/quality/partial-data-guidance.js` e injeta `partialDataGuidance` em `/api/asset` e endpoints especializados quando a fonte externa retornar dados parciais.
- `metadata.json` agora separa `coreVersion: 21.12.0` de `releasePatch: 21.12.38-failure-audit-hardening` e não declara capabilities pagas.
- Remove `build.gradle`, `settings.gradle` e `.gradle` do ZIP final do proxy.
- Adiciona teste `failure-audit-v21-12-38.test.js` e benchmark `reports/benchmark-failure-audit-v21.12.38.json`.

# v21.12.37 — Proxy Output Filter Restore

- Restaura opções completas nos botões da página Saída do Proxy: Status HTTP, Raiz do payload e Mais recentes.
- Mantém catálogo fixo de filtros mesmo quando o feed está vazio ou com poucos eventos.
- Soma opções dinâmicas vistas no feed sem apagar as opções base.
- Adiciona filtros por família HTTP, grupos de payload, ordenações avançadas e teste `proxy-output-filters-v21-12-37`.
- Preserva a correção `state is not defined` da v21.12.36 e mantém `public/index.html` espelhado com `public/server.html`.

# v21.12.36 — Monitor Scope Fix

- Corrige falso erro recorrente `Não consegui ler /api/server/metrics: state is not defined`.
- Causa raiz: helper visual de selects/filtros executava fora da closure principal do monitor e tentava ler `state` sem ponte explícita.
- Solução: ponte segura `window.valoraeMonitorState` e `window.valoraeMonitorApplyFilters`; `updateFilterOptions()` passa a usar essa ponte.
- Preserva `lib/Valorae-engine.js`, router único e compatibilidade Vercel Free.

# v21.12.35 — Monitor Data Fill

- Corrige a sensação de páginas vazias no Monitor Proxy sem inflar tráfego real.
- Página **Integração e guia** passa a consumir endpoints reais de manifesto, SDK, prompts, readiness e fontes.
- Página **Benchmark e diagnóstico** passa a executar health check automático dos endpoints do plano e benchmark quick na abertura.
- Corrige SDK JavaScript retornado por `/api/v1/integration/sdk`, preservando `replace(/\/$/, '')`.
- Classifica endpoints de integração como telemetria interna quando usados pelo próprio painel.
- Adiciona teste `monitor-data-fill-v21-12-35.test.js` e auditoria `docs/AUDITORIA_MONITOR_DATA_FILL_V21.12.35.md`.
- Mantém `lib/Valorae-engine.js` como núcleo central e contrato público `VALORAE_ENGINE_VERSION = 21.12.0`.

# v21.12.34 — Audited Launch Candidate

- Corrige marcador legado não visual `Engine Core` no painel para restaurar compatibilidade com auditoria `audit:engine-performance`.
- Mantém `public/index.html` e `public/server.html` espelhados.
- Adiciona auditoria final de lançamento pessoal com resultados de testes, auditorias e benchmarks.
- Adiciona benchmark local de endpoints em `reports/benchmark-endpoints-v21.12.34.json`.
- Mantém contrato público `VALORAE_ENGINE_VERSION = 21.12.0` e compatibilidade com Vercel Free.

# v21.12.33 — Personal Launch Polish

- Refina CORS para integração Web/APK com headers oficiais `x-valorae-*` sem exigir infraestrutura paga.
- Expõe headers operacionais importantes ao navegador: cache, auth mode, bytes, source status, rate limit e versão do engine.
- Endurece `server.js` para validação local com limite de corpo em streaming, erro claro de JSON inválido e headers estáticos de segurança.
- Atualiza `/api/v1/integration/sdk` com timeout, `profile=fast`, headers de versão/build e helper de cache seguro.
- Adiciona auditoria `docs/AUDITORIA_PERSONAL_LAUNCH_POLISH_V21.12.33.md` com diagnóstico de fase final e checklist de lançamento hoje.
- Mantém contrato público `VALORAE_ENGINE_VERSION = 21.12.0` e patch runtime v21.12.32 para compatibilidade.

# v21.12.32 — Launch Performance Optimizer

- Adiciona `engineRuntimeProfiler`, medindo fontes, fallback, montagem de contratos, guardrails, payload/view e gargalos por resposta.
- Adiciona `engineLaunchGate`, gate final para lançamento pessoal com score, decisão, bloqueios, checklist e regras anti-tela-vazia.
- Cria `/api/v1/engine/performance` para auditar runtime e payload por ticker sem ferramentas pagas.
- Atualiza `view=app` para preservar `engineRuntimeProfiler` e `engineLaunchGate` compactos no contrato oficial Web/APK.
- Atualiza `/api/server/metrics`, OpenAPI, Fields, Manifesto de integração, metadata e teste `launch-performance-optimizer-v21-12-32`.
- Mantém `lib/Valorae-engine.js` como núcleo central e preserva `VALORAE_ENGINE_VERSION = 21.12.0`.

# v21.12.31 — Monitor Experience Redesign

- Reformula o Monitor Proxy como cockpit executivo de 7 áreas principais, reduzindo páginas visíveis e poluição visual.
- Consolida páginas antigas em blocos claros: operação, saída, performance/Vercel, qualidade, integração/guia e diagnóstico/benchmark.
- Mantém compatibilidade com hashes antigos por aliases internos, sem expor dezenas de páginas no menu.
- Preserva feed fiel de saída do proxy com rota, app, canal, status, bytes, roots, métricas, gráficos, dividendos e preview do payload.
- Atualiza PWA metadata, service worker, README e teste `monitor-experience-redesign-v21-12-31`.

# v21.12.30 — Final Personal Launch Cleanup

- Corrige a limpeza final para lançamento pessoal controlado: `.gitignore`, marcador explícito de readiness em `public/index.html` e `audit:release` válido.
- Define `view=app` como padrão real de `/api/asset` e `/api/assets`, reduzindo payload e alinhando Web/APK ao contrato oficial.
- Atualiza `VALORAE_SERVER_METRICS_VERSION` para `21.12.30-final-personal-launch-monitor` e readiness pessoal para `21.12.30-final-personal-launch-cleanup`.
- Sincroniza metadata, manifest PWA, service worker, README, OpenAPI/Fields via contratos já existentes e teste `final-personal-launch-cleanup-v21-12-30`.
- Mantém `lib/Valorae-engine.js` como núcleo central e preserva `VALORAE_ENGINE_VERSION = 21.12.0`.

# v21.12.29 — Operational Resilience Suite

- Adiciona `fieldConsistencyGuard` para auditar consistência de campos financeiros, valores fora de escala e sinais suspeitos por payload.
- Adiciona `payloadBudget` para medir peso por raiz e orientar `view=app`, `compact`, `standard` e `full`.
- Adiciona `assetActionPlan` para orientar renderização, cache, banner e próximos endpoints no app.
- Cria endpoints `/api/v1/asset/quality`, `/api/v1/asset/action-plan` e `/api/v1/integration/manifest`.
- Atualiza o monitor com páginas Consistência de campos, Orçamento de payload, Plano de ação e Manifesto de integração.
- Atualiza `/api/server/metrics` para capturar sinais novos em `proxyOutputMonitor.outputFeed[]`.
- Mantém `lib/Valorae-engine.js` como núcleo central e preserva `VALORAE_ENGINE_VERSION = 21.12.0`.


## v21.12.28 — Engine Maturity Performance Suite

- Adicionado `assetIndicatorCoverage`: taxonomia oficial de indicadores por classe de ativo, com campos críticos/importantes/opcionais e cobertura por grupo.
- Adicionado `engineMaturityBooster`: score de performance, precisão, confiabilidade e appSync por payload.
- Criados endpoints `/api/v1/asset/indicators`, `/api/v1/fii/indicators` e `/api/v1/engine/maturity`.
- Adicionado cache LRU no parser numérico central para acelerar normalização repetida de valores brasileiros.
- Monitor do proxy ganhou páginas de Maturidade do Engine, Performance e Taxonomia de Indicadores.
- Telemetria agora detecta `assetIndicatorCoverage` e `engineMaturityBooster` no feed de saída.
- Mantido `lib/Valorae-engine.js` como núcleo central, sem desmembramento.


## 21.12.21 — Proxy Monitor profissional

- Interface totalmente repaginada em tons de verde e cinza.
- Cabeçalho operacional sem teste de ticker.
- Menu hambúrguer lateral organizado por categorias.
- Novas páginas: Centro de comando, Feed, Gráficos, Rotas/apps, Pipeline, Vercel Runtime, Qualidade/cache, Benchmark/testes, Integração e Diagnóstico bruto.
- Cada página recebeu dois blocos explicativos para orientar leitura dos dados.
- Benchmark movido para página própria e ampliado com quick/deep, probes de rede e relatório interpretável.
- Novo logotipo SVG/PWA alinhado à proposta de proxy e distribuição.

## 21.12.20 — Proxy Output Real Capture

- Corrige a causa de o painel mostrar saídas apenas quando a busca de teste era feita dentro do app.
- Rotas de dados agora nunca são ignoradas por `x-valorae-telemetry: dashboard/test/probe`; somente rotas internas/admin são isoladas.
- Garante que cada resposta de dados enviada pelo proxy vire item em `proxyOutputMonitor.outputFeed[]` com rota, app, canal, status, bytes, raízes JSON, métricas, gráficos, dividendos e preview.
- Atualiza logotipo visual e ícones PWA para azul.
- Adiciona `test/proxy-output-real-capture-v21-12-20.test.js` e relatório `docs/AUDITORIA_PROXY_OUTPUT_REAL_CAPTURE_V21.12.20.md`.


## 21.12.19 — Proxy Output Hamburger Pages

- Reorganiza a página-servidor do proxy em menu hambúrguer lateral com páginas internas para visão geral, feed, gráficos, rotas/apps, pipeline e diagnóstico.
- Reforça `refresh()` com timeout, fallback em `localStorage`, modo pausado e polling silencioso.
- Reforça `probe()` para gerar saída real em `/api/asset` com canal `proxy-output-probe` e diagnóstico de raízes retornadas.
- Adiciona filtros do feed por texto, status, raiz de payload e ordenação por recente/bytes/latência.
- Adiciona ferramentas de exportação JSON/CSV e limpeza de filtros.


## 21.12.18 — Proxy Output Server Page

- Refatoração da página web para agir como página-servidor do proxy.
- Novo `proxyOutputMonitor` em `/api/server/metrics`.
- Novo feed `proxyOutputMonitor.outputFeed[]` com respostas que saem do proxy para apps/usuários.
- Matriz `routeOutputs` para rotas que distribuem payloads, métricas, gráficos e dividendos.
- Página mostra payload selecionado, raízes transformadas, app/canal consumidor, Vercel host/região, status, bytes, fonte/cache e preview do JSON entregue.
- Mantida compatibilidade com Vercel Free: sem banco, Redis, KV, WebSocket ou dependência paga.

## v21.12.17 — Careful review Vercel runtime telemetry

- Revisão cuidadosa das mudanças v21.12.x, com correção de dois pontos que podiam deixar painéis sem dados em produção.
- Corrigida a captura de Vercel Runtime: o polling interno de `/api/server/metrics` continua isolado dos contadores de usuários, mas agora registra host, região, país e `x-vercel-id` em `vercelRuntime.observed`.
- Corrigido o dashboard: chamadas internas continuam com `x-valorae-telemetry: dashboard`, mas consultas de dados como `/api/asset` agora usam canal `dashboard-probe` e aparecem nos gráficos/eventos.
- Dashboard passa a ler países/regiões/hosts também de `vercelRuntime.observed`, evitando painel local/zerado quando ainda não há tráfego externo real.
- Novo teste `test/careful-review-vercel-runtime-v21-12-17.test.js`.



## v21.12.16 — Vercel responsive dashboard runtime

- Adicionado painel Vercel Runtime no servidor visual com ambiente, região, host, commit e origem observada.
- `/api/server/metrics` agora expõe `vercelRuntime` e distribuições `vercelRegions`, `vercelHosts` e `vercelCountries`.
- Eventos recentes e `routeDetails` agora incluem host/região para confirmar a instância Vercel que entregou dados aos apps.
- Dashboard web adaptado para mobile, tablet e desktop com novos breakpoints, tabelas roláveis e toolbar responsiva.
- Adicionado controle `API origem`, com suporte a `?apiBase=` e `localStorage`, para resolver casos em que o painel lê uma origem diferente do deploy Vercel correto.
- Novo teste `test/vercel-responsive-dashboard-v21-12-16.test.js`.


## v21.12.15 — Vercel App Harmony

- Adiciona telemetria de apps consumidores e canais usando headers `x-valorae-app`, `x-valorae-app-version`, `x-valorae-channel`, query params e fallback por User-Agent.
- Adiciona `deliveryHarmony` em `/api/server/metrics`, medindo o pipeline Vercel Router → Proxy Capture → Engine Transform → App Contract → Dashboard Visibility.
- Enriquece `routeDetails` com entrega por app/canal, payloads entregues, render/cache safe, métricas, gráficos e dividendos distribuídos.
- Enriquece eventos recentes com app consumidor, canal, decisão de sync, roots e flags de contrato app-safe.
- Atualiza o servidor visual para mostrar Harmonia Vercel ↔ Apps, apps recebendo dados e entrega por rota.
- Adiciona `test/vercel-app-harmony-v21-12-15.test.js`.


## v21.12.14 — Proxy Server Visual Observability

- Recria o app visual como painel de servidor do proxy.
- Adiciona gráficos de fluxo vivo, status HTTP, cache/fonte, latência e Engine Core.
- Adiciona tabela de rotas consumidas por usuários e timeline de eventos recentes.
- Adiciona inspetor de payloads transformados com raízes, sinais e preview limitado.
- Adiciona `payloadIntelligence` em `/api/server/metrics`.
- Captura sinais de payload também em respostas diretas `res.end` quando JSON pequeno.
- Mantém compatibilidade com Vercel Free e router único.


## v21.12.10 - App Response Integrity

- Adiciona `lib/quality/app-response-integrity.js`.
- Adiciona `appResponseIntegrity` ao payload final do engine.
- Valida presença de `appPayload`, `appRenderContract`, `appDataContract`, `appSyncEnvelope` e `appMobileSnapshot`.
- Detecta aliases de métricas quebrados, divergência entre `chartSeries` e `appPayload.charts`, overflow de pontos no snapshot mobile e inconsistências de hash/sync.
- Adiciona `cacheSafe`, `renderSafe`, score final, orçamento de payload e recomendações para manter snapshot anterior.
- Atualiza OpenAPI, catálogo de campos, tipagens e teste dedicado `app-response-integrity-v21-12-10`.

# v21.12.9 — App Mobile Snapshot

- Adicionado `appMobileSnapshot`, raiz compacta para primeira pintura/cache local do APK/Web.
- Snapshot inclui cotação, métricas canônicas, painéis, gráficos amostrados, dividendos, fonte/cache e decisão sync.
- Gráficos do snapshot são limitados para reduzir payload mobile e evitar travamentos em listas/watchlists.
- Contratos de app agora aceitam métricas normalizadas primitivas como fallback defensivo.

# v21.12.5 — App Consumer Blank Shield

- Adicionado `appPayload` no retorno do engine para consumo direto pelo APK/Web.
- Incluídos aliases estáveis de métricas (`price`, `currentPrice`, `dy`, `p_vp`, `marketCap`, etc.).
- Incluído `blankShield` com flags `canRenderDashboard`, `canRenderCharts`, `canRenderDividends` e empty state recomendado.
- Gráficos e dividendos agora têm contratos diretos em `appPayload.charts` e `appPayload.dividends`.
- OpenAPI, catálogo `/api/fields`, tipagens e testes atualizados.

# Changelog

## v21.12.27 — Investidor10 Asset Class Contracts

- Adicionado `assetClassContract` ao payload do Engine.
- Ações agora têm grupos especializados: perfil, cotação, valuation, rentabilidade, dívida, dividendos, demonstrações e pares.
- FIIs agora têm grupos especializados: perfil, rendimentos, patrimonial, portfólio, vacância, cotistas, comunicados, checklist e pares.
- Adicionado `fieldConfidence` por campo com valor, unidade, fonte, path, confiança e cross-check.
- Criados endpoints dedicados de Ação e FII para integração Web/APK.
- Ampliado o normalizador universal para aliases de indicadores financeiros do Investidor10.
- Monitor ganhou páginas: Contrato Ação/FII, Páginas de Ação, Páginas de FII e Fonte por campo.
- `/api/server/metrics` agora detecta `hasAssetClassContract`, `assetClassScore`, `assetClassState`, grupos e campos especializados.
- OpenAPI, Fields, README, metadata, manifest e service worker sincronizados.


## v21.12.0 — Router único Vercel e recuperação de métricas ao vivo

- Substitui a dependência de `api/[...path].js` por uma Function física única `api/router.js`.
- Adiciona rewrites `/api` e `/api/:path*` para `/api/router?path=...`, evitando 404 em rotas internas no Vercel.
- Corrige `/api/server/metrics` para entregar `summary` ao dashboard em produção.
- Corrige `/api/server/tests?mode=quick` para entregar `benchmark`.
- Corrige `/api/v1/ready`, `/api/deploy/status`, `/api/cache/stats` e `/api/source/status` via router único.
- Mantém o VALORAE Proxy Server como app visual único; testes e benchmark ficam dentro de `/server.html#tests`.
- Atualiza logo, PWA cache, versão runtime e auditorias para `21.12.0`.


## v21.12.0 — Vercel API Routes consolidadas

- Consolidou o deploy em apenas `api/router.js` com rewrites `/api` e `/api/:path*`.
- Removeu Functions físicas extras para evitar limite/alerta de consolidação no Vercel Free/Hobby.
- Manteve `/api/server/metrics`, `/api/cache/stats`, `/api/source/status`, `/api/server/tests`, `/api/ready` e `/api/deploy/status` via roteador interno.
- Reforçou `build-vercel-safe.js` para falhar se Functions extras voltarem.
- Atualizou testes, readiness, release audit e dashboard live audit para a arquitetura consolidada.
- Preservou o app único VALORAE Proxy Server e a central interna de Testes e benchmark.

## v21.12.0 — Vercel Build Safe Fix

- Corrige falha genérica no Vercel ao substituir o build de deploy por `scripts/build-vercel-safe.js`.
- Mantém `scripts/build-free.js` como build estrito/local em `npm run build:strict`.
- Atualiza `vercel.json` para usar o build seguro do Vercel diretamente.
- Adiciona documentação de diagnóstico para `Command "node scripts/build-free.js" exited with 1`.
- Preserva Engine, dashboard, PWA, métricas e compatibilidade com Vercel gratuito.


## v21.12.0 — Engine Performance & Precision

- Adicionado normalizador financeiro central em `lib/normalizers/numbers.js`.
- Adicionada política adaptativa do Engine em `lib/resilience/engine-policy.js`.
- Adicionado failure cache curto em `lib/resilience/failure-cache.js`.
- Adicionadas séries normalizadas para gráficos em `lib/quality/chart-series.js`.
- `Valorae-engine.js` agora usa retry budget adaptativo e expõe normalizers/failure cache em runtime stats.
- Fast selectors e custom selectors passaram a usar normalização financeira central e reduzir trabalho repetido.
- `/api/scrape` e `/api/batch-scrape` passaram a incluir `chartSeries` quando há dados suficientes.
- Adicionado teste `engine-performance-precision-v21-11-2`.
- Adicionada auditoria `audit:engine-performance`.


## v21.11.0 — Engine Core Maturity

- Adicionada classificação profunda de erros do Engine.
- Adicionado retry inteligente e leve no DirectFetch.
- Adicionado relatório `precision` e `chartReadiness` em `/api/scrape` e `/api/batch-scrape`.
- Fast selectors passam a suportar `number`, `numeric`, `percent` e `content`.
- `fields=` agora reduz payload de forma real via `lib/http/response-shape.js`.
- `/api/server/metrics` passa a expor `engine` e `engineCore`.
- Dashboard recebe leitura de Engine Core em tempo real.
- Service Worker atualizado para cache `v21.11.0`.
- Compatibilidade Vercel Free preservada, sem dependências pagas ou obrigatórias.

## App Servidor Proxy — Route/SLO Maturity v21.10.6
## v21.10.7 — Complete Operational Polish

- Adicionada página **Qualidade dos Dados** no dashboard.
- Adicionados scores `dataQualityScore`, `contractScore`, `loadScore` e `operationalState`.
- Adicionados p95/p99/máximo de payload e taxas de requisições/respostas por janela.
- Adicionada lista `anomalies` no snapshot de métricas.
- Corrigida medição de bytes para `HEAD`, `204` e `304` também na interceptação profunda por `res.end`.
- Atualizado Service Worker para cache `v21-10-7`.
- Adicionado `npm run audit:complete-polish`.


- Adiciona p50, p95 e p99 por rota no endpoint `/api/server/metrics`.
- Adiciona mapa de status HTTP por rota, cache/fonte predominantes e orçamento de erro SLO.
- Painel passa a exibir orçamento SLO, p95 por rota e tempo desde o último tráfego externo real.
- Atualiza Service Worker para cache v21.10.6, evitando stale visual após novo deploy.
- Adiciona `npm run audit:route-slo` para validar isolamento da telemetria, 304 sem corpo e métricas SLO.
- Mantém `/api/server/metrics` isolado para não inflar requisições, respostas, status, cache/fonte ou eventos.

## App Servidor Proxy — Auditoria completa, Performance e SLO MD3

- Adiciona página **Performance e SLO** ao menu lateral.
- Adiciona janelas 1/5/15 minutos, disponibilidade, taxa de conclusão, bytes de entrada, payload médio e histogramas de latência/payload.
- Adiciona checklist de prontidão do servidor e melhora detalhamento por rota com sucesso, conclusão e payload médio.
- Aprimora o visual MD3 com animações mais suaves, skeleton, filtro de eventos, pausa/retomada e pausa automática quando a aba fica invisível.
- Mantém compatibilidade total com GitHub/Vercel gratuito e sem dependências pagas.

## App Servidor Proxy — Engine e Integração terceiro MD3

- Adiciona página **VALORAE Engine** ao menu lateral, explicando tecnologias, capacidades, contratos e fluxo do proxy.
- Adiciona página **Integração terceiro** com guia, prompt pronto, exemplos e botões de download para APK/Web/backend.
- Cria kit em `/public/downloads` com README, prompt, cliente Web JS, cliente Android Kotlin e contrato JSON.
- Polimento visual geral: Material Design 3 mais limpo, cards maduros, paleta cinza/verde e textos didáticos.


## App Servidor Proxy — Deep Observability MD3

- Reescrita do painel `/server.html` com páginas didáticas, paleta cinza/verde e Material Design 3.
- Métricas ampliadas: Apdex, sucesso, 4xx/5xx, p99, latência máxima, bytes médios, cache por minuto, detalhamento por rota e insights automáticos.
- Interceptação preservada por `sendJson` e `res.end`, mantendo compatibilidade com Vercel gratuito e sem dependências pagas.

# Changelog — Valorae Proxy

## v21.12.0 — Mature Final Release Free

- Adiciona `fieldWarnings` para `fields`/`dataFields` inválidos ou inexistentes, sem vazar payload completo quando todos os campos solicitados são inválidos.
- Endurece `scrapeUrl` customizado: agora precisa apontar exatamente para `/api/scrape`, evitando caminhos parecidos.
- Restringe token admin via query em produção; só funciona com override explícito `VALORAE_ADMIN_ALLOW_QUERY_TOKEN_IN_PRODUCTION=1`.
- Corrige `securityRuntimeStats.rateLimit` para diferenciar `disabledRequested` e `disabledEffective`.
- Usa `isReadLikeMethod` no limite de body, preservando semântica correta para `GET` e `HEAD`.
- Adiciona `npm run audit:final` e teste comportamental v21.12.0.

- Implementa somente melhorias recomendadas/viáveis da auditoria de 190 itens.
- Adiciona `/api/v1/env`, `/api/v1/schema` e `/api/v1/source/status`.
- Adiciona CORS strict opcional, limites de URL/query e proteção contra rate-limit desligado acidentalmente em produção.
- Adiciona `dataQualityMatrix`, `sourceReliability`, `healthScore`, `incomeStabilityScore` e `dividendCoverage`.
- Adiciona fixtures extras de Investidor10/Yahoo/Google News para regressão de parser/source drift.
- Adiciona `.nvmrc`, `.env.example`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/ENVIRONMENT.md`, `docs/TROUBLESHOOTING.md`, `docs/ARCHITECTURE.md` e `docs/QUALITY_MATRIX.md`.
- Mantém 1 Function física, zero dependências obrigatórias e política free-only.

# CHANGELOG

## v21.5.11 — Final Minute Audit Free

- Corrige `HEAD` em rotas `GET` para preservar `req.query`, evitando 400 indevido em URLs como `/api/v1/asset?ticker=PETR4`.
- Corrige normalização de path para remover apenas `/api` ou `/api/`, sem truncar caminhos parecidos como `/apiary`.
- Adiciona `npm run audit:minutiae`, com validação de imports locais, handlers default, HEAD/query, path normalization, versão pública e guardrails finais.
- Ajusta `npm run verify` para verificação rápida de lançamento; `npm run build` permanece como simulação separada do build Vercel.
- Adiciona `/api/v1/ready` para validar prontidão local sem chamadas externas.
- Adiciona `/api/v1/manifest` com capacidades, rotas, aliases e política free-only.
- Substitui `tsc --noEmit` por `scripts/typecheck-free.js`, evitando falha de build em Vercel limpa sem dependência `typescript`.
- Adiciona `npm run audit:release` e inclui essa auditoria no `build` e no `verify`.
- Adiciona documentação de operação, matriz de confiabilidade e checklist de lançamento.
- Atualiza README, página pública, smoke test, OpenAPI e auditorias para lançamento GitHub/Vercel.
- Mantém 1 Function física, zero dependências obrigatórias e cache memory-only.

## v21.5.9 — Portfolio Intelligence & Source Reliability

- Adiciona fixtures leves de fonte para testar parser sem internet.
- Adiciona source drift detection em scrape, batch-scrape e parser resilience.
- Adiciona `/api/v1/cache/stats` com métricas de cache em memória.
- Adiciona `profile=instant`/`profile=ultra` para apps e dashboards de baixa latência.
- Amplia carteira com ranking por posição, narrativa, concentração por objetivo/emissor/tag, projeção de renda passiva e roteiro de rebalanceamento por aporte.

## v21.5.8 — Portfolio Tech Supremacy Free

- Reforça compatibilidade com o Scraper (4), incluindo `fiiList`, `historico_12m` por ticker e lista flat de proventos em `proventos_carteira`.
- Amplia carteira para caixa/renda informada pelo usuário com taxa anual, indexador, vencimento, liquidez, emissor, isenção e objetivo, sem depender de fonte externa paga.
- Adiciona `portfolio.intelligence`: calendário de renda, cobertura de pagadores, liquidez, projeção de objetivos, tax planner educativo, prontidão tecnológica e plano de ação.
- Amplia selectors customizados com `cells`, `number`, `percent`, `data-url` e `attr:*`.
- Atualiza OpenAPI, catálogo de campos, SDK TypeScript e testes comportamentais.

## v21.5.7 — Contract Safety Hardening Free

- Implementa aliases reais de `view`: `quote/card -> compact`, `wallet -> standard`, `detail/analysis -> full`.
- Implementa aliases reais de `profile`: `quote/card -> fast`, `wallet -> portfolio`, `analysis/complete -> deep`, `balanced -> standard`.
- Remove o fallback `Function(...)` do parser JSON; agora o parser usa apenas `JSON.parse` e normalização JS-like segura, sem eval.
- Padroniza `AbortController` com `finally` em fetches de Yahoo Chart e Google News.
- Corrige o SDK TypeScript e o `.d.ts` para `moduleResolution: NodeNext`.
- Reestrutura `/api/openapi` para usar `components.schemas` e parâmetros OpenAPI em formato de objeto.
- Faz `compareAssets` priorizar `normalized.*.value` antes de cair para `results` bruto.
- Deixa ETag menos volátil ao ignorar `requestId`, `generatedAt` e `checkedAt` no hash.
- Retorna `/api/sync` como legado desativado com HTTP `410` na build free-only.
- Amplia catálogo `/api/errors` e `/api/fields` com aliases, erros de contrato e `SYNC_DISABLED_FREE_ONLY`.
- Reforça `audit:free` contra `Function(...)`, `eval(...)` e tecnologias complexas.

## v21.5.6 — Final Review Hardening Free

- Remove CORS amplo de `/api/*` no `vercel.json`; CORS da API fica no runtime.
- Remove a ponte opcional Supabase da rota `/api/sync` para manter free-only puro.
- Corrige texto antigo no OpenAPI.
- Reforça auditorias `audit:free` e `audit:routes`.

## v21.5.5 — Complete Audit Hardening Free

- CORS/preflight mais robusto com headers expostos e `Vary` correto.
- ETag/304 ajustado para listas em `If-None-Match`.
- Router preserva query params repetidos.
- Seletores CSS-lite ampliados: múltiplas classes e atributos existentes.
- Batch scrape deduplica com assinatura mais segura considerando limites de selectors.
- OpenAPI referencia rotas v1 principais.
- Adiciona `npm run audit:routes`.

## v21.5.4 — Audit Corrections Free

- CORS com allowlist multi-origem e `Vary: Origin`.
- Router com fallback de querystring via `req.url`.
- `HEAD` automático para rotas `GET`, `Content-Length` e ETag preservado.
- Selectors customizados com suporte a `>`, atributos/classes sem aspas e `outerHtml`.
- Batch scrape considera `includeHtml` por job na deduplicação.
- Adiciona `audit:version`.

## v21.5.3 — Scraper Compatibility Hardening Free

- Corrige gaps encontrados ao comparar o VALORAE com `scraper (4).js`.
- Adiciona suporte a seletores descendentes simples em `/api/scrape` e `/api/batch-scrape`.
- Amplia extração de atributos com `data-url`, `attr:*`, `row` e `cells`.
- Adiciona deduplicação intra-request no batch scrape.
- Adiciona alias legado `/api/scraper` para `/api/compat/scraper4`.

## v21.5.2 — Router Contract Free

- Consolida o deploy Vercel em uma Function física: `api/router.js` com rewrites `/api` e `/api/:path*`.
- Move handlers para `routes/` e suporte compartilhado para `lib/`.
- Adiciona router interno com aliases legados, prefixos `/api/v1/*` e envelope `/api/v2/*`.
- Reforça `audit:functions`, `audit:free`, smoke tests e validação de build.
- Publica guias em `docs/` e SDKs estáticos TypeScript/Java.

## v21.5.1 — Audit Hardening Free

- Adiciona `/api/fields`, `/api/errors` e inspector estático.
- Endurece Host/X-Forwarded-Host e cache memory-only.

## v21.5.0 — Professional Refinement

- Normalização universal, parser resilience, schema stability, compare intelligence e carteira avançada.

## v21.10.8 - Command Center operacional

- Adiciona runtime pressure, heap/RSS, idade da chamada ativa mais antiga e score operacional da instância.
- Separa telemetria interna em distribuição própria sem inflar tráfego externo.
- Corrige sucesso HTTP para contemplar respostas 3xx/304 como sucesso e manter 304 com 0 bytes.
- Adiciona avgBytesIn por rota, tendências 1m vs 15m, SLO status e orçamento restante.
- Adiciona operations.runbook, slowRoutes, errorRoutes e payloadRoutes no endpoint de métricas.
- Melhora páginas Performance & SLO, Qualidade dos Dados e Diagnóstico Cloud.
- Reforça segurança do servidor local contra path traversal e atualiza cache PWA para v21.10.8.
- Adiciona `npm run audit:command-center`.

## v21.10.9 - Visual polish e inteligência operacional

- Atualizado logotipo VALORAE Proxy Server com visual mais clean e moderno.
- Adicionado controle de densidade visual nas Configurações.
- Corrigida UX de pausa manual vs pausa automática quando a aba fica invisível.
- Adicionados scores de cache, fontes, cobertura de rotas, integridade do painel e estado do tráfego.
- Melhorado readiness, insights e didática para cenários sem tráfego externo real.
- Atualizado Service Worker para cache v21-10-9, mantendo APIs em tempo real fora do cache.

## v21.12.0 - Otimização profunda Scraper/API

- Implementa chave HTML segura com `maxChars`, provider e headers relevantes para evitar cache contaminado.
- Adiciona `scrapeResultCache` com `TtlLruCache` para `/api/scrape` e `/api/batch-scrape`.
- Centraliza normalização e assinatura em `lib/scrape/scrape-input.js`.
- Separa `fetchKey` e `resultKey`, permitindo batch com 1 fetch para mesma URL e seletores diferentes.
- Adiciona fast-path conservador para seletores simples e fallback automático para o extrator robusto.
- Adiciona métricas separadas de fetch, parse, selector, payload e cache.
- Adiciona in-flight dedupe e stale HTML seguro sem prometer background work.
- Adiciona benchmark local/mockado com `npm run bench:scrape`.

## v21.11.1 - Engine modules maturity

- Adiciona cache HTML familiar para reaproveitar HTML maior em pedidos menores sem contaminar cache truncado.
- Evolui circuit breaker por fonte com score, rolling window, latência média, taxa de erro e cooldown dinâmico.
- Amplia classificação de erros para WAF/CAPTCHA/rate limit/manutenção e melhora retry inteligente.
- Adiciona `lib/quality/chart-readiness.js` para medir prontidão real de dados para gráficos.
- Torna `extraction-precision` chart-aware, com confiança e recomendações didáticas.
- Melhora parser numérico dos custom selectors para formatos PT-BR e EN.
- Atualiza painel Engine Core com HTML family hit e score de fontes.
- Adiciona `npm run audit:engine-modules` e teste `engine-core-modules-v21-11-1`.

## v21.12.11 - Mobile safe payload views

- Corrige o modo `view=compact` para não carregar contratos pesados recém-adicionados em listas, cards e primeira pintura mobile.
- Adiciona aliases `mobile`, `snapshot`, `sync`, `watchlist` e `list` aos views públicos.
- Preserva `appMobileSnapshot`, `appSyncEnvelope` e resumo de `appResponseIntegrity` no modo compacto.
- Reduz `appPayload.charts.series` para `seriesPreview` com até 12 pontos por série no modo compacto, mantendo séries completas disponíveis no `view=full`.
- Adiciona `payloadViewProfile` com redução aproximada de bytes, roots removidas e raiz recomendada de primeira renderização.

## v21.12.12 - Field alias normalizer e compact fix

- Adiciona normalização defensiva de aliases financeiros para campos vindos de scrapers/APIs com labels PT-BR/EN-US.
- Reconhece `Preço`, `D.Y`, `P/VP`, `Último Rendimento`, `Patrimônio Líquido`, `Liquidez Média Diária`, `Vacância Física`, `marketCap`, `lastDividend`, `currentPrice` e equivalentes.
- Usa parser financeiro central no fallback bruto do `appPayload`, melhorando leitura de valores como `R$ 4,2 bi`, `R$ 8,5 mi` e `9,87%`.
- Corrige `view=watchlist` e `view=list` para resolverem como `compact`, reduzindo payload em listas e primeira pintura mobile.
- Adiciona teste `field-alias-mobile-compact-v21-12-12`.

## v21.12.13 — clean app rebuild

- Reconstruído `public/server.html` e `public/index.html` do zero.
- Novo dashboard financeiro focado em `/api/asset`, métricas, gráficos canvas, diagnósticos e fallback local.
- Corrige o problema visual de tela vazia quando as fontes retornam payload parcial.
- Mantém compatibilidade com auditorias e Vercel Free.

## v21.12.22 - Visual polish e engine performance

- Reduz altura e poluição visual do cabeçalho do monitor.
- Reorganiza o visual com uma hierarquia mais limpa em verde/cinza.
- Mantém o teste de ticker apenas na página Benchmark e testes.
- Adiciona pausa automática de polling quando a aba está oculta.
- Otimiza o `Valorae-engine.js` com empacotamento de cache em passagem única.
- Adiciona orçamento de séries de gráficos por perfil/view para acelerar respostas compactas/mobile.
- Registra `metrics.engineOptimizations` e `performance.optimizations` para auditoria do engine.
- Adiciona documentação `AUDITORIA_VISUAL_ENGINE_PERFORMANCE_V21.12.22.md`.


## v21.12.23 - Engine assembly sync

- Adiciona plano interno `metrics.engineAssembly` no Valorae Engine.
- Otimiza montagem de payload para `compact/mobile/watchlist/list/fast/portfolio`, evitando contratos pesados que seriam removidos depois.
- Preserva sempre `appPayload`, `appSyncEnvelope`, `appMobileSnapshot` e `appResponseIntegrity` para evitar quebra no app.
- Adiciona contratos leves sincronizados para renderização e diagnóstico em modo mobile.
- Atualiza monitor web para mostrar política de performance e sincronização do engine na página Qualidade e cache.
- Adiciona teste `engine-assembly-sync-v21-12-23`.

## v21.12.24 - Efficiency precision ecosystem

- Adiciona `lib/quality/engine-efficiency.js` com auditoria leve de eficiência, precisão, confiabilidade, entrega e árvore resumida do ecossistema.
- Integra `engineEfficiency` ao payload do Valorae Engine sem desmembrar `lib/Valorae-engine.js`.
- Otimiza o engine com cache memoizado de plano de montagem e snapshot único de runtime stats por resposta.
- Mantém `appPayload`, `appSyncEnvelope`, `appMobileSnapshot` e `appResponseIntegrity` sincronizados para evitar quebras no app.
- Repagina o monitor como documentação viva do proxy, adicionando páginas de Prompts prontos para IA, Funcionalidades, Tecnologias e Árvore de módulos.
- Mantém a página-servidor fiel ao `proxyOutputMonitor.outputFeed[]`, exibindo respostas que saem do proxy para apps/usuários.
- Atualiza catálogo de campos, OpenAPI, PWA cache, metadata e teste de regressão `engine-ecosystem-surprise-v21-12-24`.

## 21.12.25 — Launch hardening

- Adicionado `view=app` como contrato oficial enxuto para Web/APK.
- Adicionados `/api/v1/asset/coverage` e `/api/v1/asset/fundamentals`.
- Adicionados `/api/v1/integration/sdk` e `/api/v1/integration/prompts`.
- Adicionada autenticação leve opcional por app/cliente, sem quebrar deploy aberto.
- Monitor atualizado com página de prontidão de lançamento e instruções de integração.

## v21.12.26 — Personal Maturity Controlled Release

- Adicionado `personalReleaseReadiness` em `/api/server/metrics`.
- Criado `/api/v1/release/readiness` e alias `/api/v1/personal/readiness`.
- Criada página `Maturidade pessoal` no monitor do proxy.
- Atualizado `VALORAE_SERVER_METRICS_VERSION` para `21.12.26-personal-maturity-monitor`.
- README/metadata/manifest/OpenAPI/fields sincronizados para uso pessoal e pessoas próximas.
- Adicionadas variáveis `VALORAE_DEFAULT_ASSET_VIEW` e `VALORAE_DEFAULT_ASSETS_VIEW`.
- Mantido contrato público do engine em `21.12.0` para compatibilidade.



## 21.12.51-post-benchmark-performance-hardening

- Auditoria extrema pré-integração do app de carteira de investimentos.
- Logotipo interno redesenhado e padronizado no cabeçalho, drawer lateral, PWA manifest e ícones PNG.
- Mantém Monitor responsivo, tema claro/escuro, filtros flutuantes, camada canônica e fontes ricas Investidor10/StatusInvest.
- Adiciona teste regressivo `extreme-audit-logo-standard-v21-12-51`.

## 2026-06-14 — Retorno IFIX/IDIV/SMLL Yahoo range compatibility
- Auditada causa de indisponibilidade de IFIX, IDIV e SMLL no modal Retorno: `historyMonths=120` levava a busca Yahoo para `range=10y&interval=1mo`, que pode não retornar pontos suficientes para os índices diretos.
- Proxy agora mantém `IFIX.SA`, `IDIV.SA` e `SMLL.SA`, mas tenta janelas compatíveis (`5y/1wk`, `2y/1d`, `1y/1d`, `6mo/1d`, `3mo/1d`, `1mo/1d`, `5d/1d`, `1d/1d`) antes de declarar vazio.
- `/api/v1/market/indices` passa a incluir IFIX, IDIV e SMLL como snapshots diretos.
- Nenhum ETF, proxyTicker ou simulação foi adicionado.

## 2026-06-15 — Patch 21.12.104 — Analysis dividends and missing signals

- `/api/v1/analysis` mantém o contrato único `AnalysisPageResponse` e evolui para `25.analysis.v1`.
- Foram adicionadas as seções `dividends_summary` e `dividends_history` para proventos/rendimentos por ativo.
- Foram adicionadas `missingSignals` e seções `missing` para apontar discretamente módulos ainda não integrados ao contrato novo.
- Rotas antigas de `/api/v1/asset`, `/api/v1/asset/dividends`, modais e carteira foram preservadas.
- Política mantida: sem HTML bruto no APK e sem dados sintéticos.

## 2026-06-16 — Patch 21.12.106 — Checkpoint 27 Analysis contract audit

- Auditado o contrato único `/api/v1/analysis` para a página Análise.
- Adicionado teste regressivo cobrindo PETR4, BBAS3 e HGLG11 com `AnalysisPageResponse 26.analysis.v2`.
- APK reforçado para não sinalizar como pendente uma seção que contenha `items` ou `charts` reais.
- Parser Android passa a calcular `itemCount` local como `items + charts` quando necessário.
- Fallback de versão do contrato Android alinhado para `26.analysis.v2`.
- Política preservada: sem HTML bruto, sem simulação e sem retornar a `assetSummary`, `quoteOverview`, `assetAnalysisPage`, `appPayload` ou `appMobileSnapshot` na tela Análise.

## 2026-06-16 — 21.12.113-analysis-revenue-breakdown-v32

- Checkpoint 32 da página Análise.
- `revenue_breakdown` passa a normalizar percentuais reais por negócio, região e mercado interno/externo.
- A seção envia `items[]` e `charts[]` com `horizontal_bar_composition`.
- Percentuais inválidos, ausentes, nulos, zerados ou acima de 100 são descartados.
- Sem HTML, iframe, imagem externa ou dado simulado.
- Teste regressivo incluído: `analysis-revenue-breakdown-v32.test.js`.
