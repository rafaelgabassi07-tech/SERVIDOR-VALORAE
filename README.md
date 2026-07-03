# VALORAE Proxy — v195

Core version: 21.12.0  
Public version: 21.12.225  
Patch: `21.12.225-universal-asset-modal-routing-v195`  
Checkpoint: `universal-asset-modal-routing-v195`

## v195 — Roteamento universal para o modal único do ativo

Proxy v195 acompanha o APK v314 com auditoria de roteamento: a página Análise deixa de carregar detalhes próprios de ativos no APK, e buscas, sugestões, rankings, subpáginas e tickers de notícias passam a abrir o `AssetDetailsModal` único. `/api/v1/analysis` permanece compatível para contratos legados, mas não é mais a superfície de detalhes acionada pela busca da Análise no APK.

### Correções principais
- Busca confirmada na Análise abre o modal único.
- Sugestões, rankings e listas da Análise abrem o modal único.
- Tickers de notícias da Home e aba Notícias abrem o modal único.
- Teste dedicado `analysis-universal-modal-v195.test.js`.

# VALORAE Proxy — v185

Core version: 21.12.0  
Public version: 21.12.218  
Patch: `21.12.218-vercel-temp-artifact-prune-v188`  
Checkpoint: `vercel-temp-artifact-prune-v188`

## v185 — Qualidade estrita de gráficos e captura contínua

Proxy v185 continua a auditoria de captura, bloqueia gráfico de cotação com ponto único, adiciona sourceCaptureMap/criticalMissingSectionIds ao dataQuality e reforça a política de gráficos reais para APK e modais.

### Correções principais
- Bloqueia gráfico de cotação quando só existe um ponto derivado do preço atual.
- Mantém gráficos temporais apenas com pontos suficientes; composições/categorias continuam preservando ordem da fonte.
- `dataQuality` agora expõe `sourceCaptureMap`, `criticalMissingSectionIds`, `strictChartPolicyOk` e `appActionHints`.
- `sourceCoverage` marca seções críticas para facilitar auditoria APK ↔ Proxy.
- Novo teste de regressão: `analysis-quality-strict-charts-v185.test.js`.

## v186 — Auditoria de desempenho e otimização de rota

Proxy v186 reduz trabalho duplicado na rota /api/v1/analysis com cache LRU curto, coalescing de requisições iguais e preservação do contrato estrito de gráficos reais para melhorar abertura da Análise e dos modais no APK.

- Cache curto da rota /api/v1/analysis para reduzir abertura repetida de ativos e modais.
- Coalescing de requisições simultâneas iguais para evitar múltiplos scrapes/normalizações da mesma fonte.
- Política estrita de gráficos reais preservada.
