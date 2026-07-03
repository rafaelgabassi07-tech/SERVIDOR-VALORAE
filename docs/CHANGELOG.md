
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
