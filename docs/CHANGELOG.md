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
