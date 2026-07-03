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
