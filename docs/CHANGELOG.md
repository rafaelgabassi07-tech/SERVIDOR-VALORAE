# Changelog

## v21.11.4 — Vercel Build Safe Fix

- Corrige falha genérica no Vercel ao substituir o build de deploy por `scripts/build-vercel-safe.js`.
- Mantém `scripts/build-free.js` como build estrito/local em `npm run build:strict`.
- Atualiza `vercel.json` para usar o build seguro do Vercel diretamente.
- Adiciona documentação de diagnóstico para `Command "node scripts/build-free.js" exited with 1`.
- Preserva Engine, dashboard, PWA, métricas e compatibilidade com Vercel gratuito.


## v21.11.4 — Engine Performance & Precision

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

## v21.11.4 — Mature Final Release Free

- Adiciona `fieldWarnings` para `fields`/`dataFields` inválidos ou inexistentes, sem vazar payload completo quando todos os campos solicitados são inválidos.
- Endurece `scrapeUrl` customizado: agora precisa apontar exatamente para `/api/scrape`, evitando caminhos parecidos.
- Restringe token admin via query em produção; só funciona com override explícito `VALORAE_ADMIN_ALLOW_QUERY_TOKEN_IN_PRODUCTION=1`.
- Corrige `securityRuntimeStats.rateLimit` para diferenciar `disabledRequested` e `disabledEffective`.
- Usa `isReadLikeMethod` no limite de body, preservando semântica correta para `GET` e `HEAD`.
- Adiciona `npm run audit:final` e teste comportamental v21.11.4.

- Implementa somente melhorias recomendadas/viáveis da auditoria de 190 itens.
- Adiciona `/api/v1/env`, `/api/v1/schema` e `/api/v1/source/status`.
- Adiciona CORS strict opcional, limites de URL/query e proteção contra rate-limit desligado acidentalmente em produção.
- Adiciona `dataQualityMatrix`, `sourceReliability`, `healthScore`, `incomeStabilityScore` e `dividendCoverage`.
- Adiciona fixtures extras de Investidor10/Yahoo/Google News para regressão de parser/source drift.
- Adiciona `.nvmrc`, `.env.example`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `docs/ENVIRONMENT.md`, `docs/TROUBLESHOOTING.md`, `docs/ARCHITECTURE.md` e `docs/QUALITY_MATRIX.md`.
- Mantém 2 Functions físicas, zero dependências obrigatórias e política free-only.

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
- Mantém 2 Functions físicas, zero dependências obrigatórias e cache memory-only.

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

- Consolida o deploy Vercel em duas Functions físicas: `api/index.js` e `api/[...path].js`.
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

## v21.11.4 - Otimização profunda Scraper/API

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
