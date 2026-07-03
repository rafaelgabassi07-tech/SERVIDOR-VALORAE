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
