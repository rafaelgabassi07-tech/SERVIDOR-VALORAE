# VALORAE Proxy / Engine v21.12.32 — Launch Performance Optimizer

O VALORAE Engine é um **Proxy + Engine de normalização + API + Monitor de saída** para uso pessoal e pessoas próximas. Ele foi desenhado para rodar em GitHub/Vercel gratuito, sem banco obrigatório, Redis/KV, storage externo, cron pago ou WebSocket.

> Contrato público do núcleo preservado: `VALORAE_ENGINE_VERSION = 21.12.0`. Patch interno de release preservado: `21.12.30-final-personal-launch-cleanup`. Patch visual atual: `21.12.31-monitor-experience-redesign`. Patch de performance atual: `21.12.32-launch-performance-optimizer`.

## Objetivo desta versão

Esta rodada aprofunda a maturidade operacional do VALORAE para uso pessoal e pessoas próximas: adiciona profiler de runtime por etapa, gate final de lançamento pessoal, endpoint dedicado de performance e sincronização do contrato `view=app`, mantendo simplicidade, Vercel Free e compatibilidade com Web/APK.



### Novidades v21.12.32

- Novo `engineRuntimeProfiler`: mede fontes, fallbacks, pós-processamento, notícias, montagem base, contratos, guardrails e view aplicada.
- Novo `engineLaunchGate`: consolida runtime, maturidade, integridade, consistência, orçamento de payload e plano de ação em uma decisão simples para o app.
- Novo endpoint `/api/v1/engine/performance?ticker=PETR4&view=app` para localizar gargalos antes de liberar telas no Web/APK.
- `view=app` agora preserva `engineRuntimeProfiler` e `engineLaunchGate` em formato compacto.
- `/api/server/metrics` passa a detectar `engineRuntimeScore`, `engineLaunchGateScore`, decisão do gate e payloads prontos para uso pessoal.
- Manifesto de integração atualizado para orientar apps a verificar `engineLaunchGate.decision` antes de substituir cache local.


### Novidades v21.12.31

- Monitor Proxy reformulado em **6 áreas principais**: Centro de comando, Saída do proxy, Performance e Vercel, Qualidade dos dados, Integração e guia, Benchmark e diagnóstico.
- Redução de páginas visíveis e consolidação de informações antes espalhadas em várias telas.
- Cabeçalho mais compacto, menu lateral mais limpo, hierarquia visual mais profissional e cards/gráficos com menos poluição.
- Feed de saída preservado como fonte fiel: cada resposta do proxy continua mostrando rota, app, canal, status, bytes, roots, métricas, gráficos, dividendos e preview.
- Páginas antigas continuam suportadas por aliases de hash para não quebrar atalhos: `#overview`, `#feed`, `#vercel`, `#maturity`, `#manifest`, `#tests` etc.
- Integração, prompts para IA, funcionalidades, tecnologias e árvore de módulos foram condensados em uma página única de guia.


### Novidades v21.12.30

- Limpeza final para lançamento pessoal controlado: `npm run audit:release` passa junto com build, smoke, typecheck e auditorias free/Vercel.
- `.gitignore` adicionado para impedir envio de `.env`, `.vercel`, builds, caches e material local de assinatura.
- `public/index.html` agora aponta explicitamente `/api/ready` e `/api/v1/release/readiness`.
- `view=app` virou o padrão real para `/api/asset` e `/api/assets` quando nenhuma view é informada.
- Monitor, metadata, manifest, service worker e readiness pessoal sincronizados com o patch `21.12.30-final-personal-launch-cleanup`.
- Mensagem operacional recomendada: para uso pessoal/pessoas próximas, mantenha `VALORAE_PERSONAL_MODE=true`, configure `VALORAE_PUBLIC_BASE_URL` e use client keys se compartilhar fora de rede confiável.

### Novidades v21.12.29

- Novo `fieldConsistencyGuard` no payload: detecta valores financeiros suspeitos, percentuais fora de escala, P/VP extremo e divergências sem apagar rastreabilidade.
- Novo `payloadBudget`: mede peso aproximado por raiz, sugere `view=app`, `compact`, `standard` ou `full` conforme uso e ajuda a reduzir latência no APK/Web.
- Novo `assetActionPlan`: transforma cobertura, precisão, integridade e cache em decisão simples para o app renderizar, manter snapshot ou mostrar aviso.
- Novos endpoints:
  - `/api/v1/asset/quality?ticker=PETR4`
  - `/api/v1/asset/action-plan?ticker=PETR4`
  - `/api/v1/integration/manifest`
- Monitor ganhou páginas novas: **Consistência de campos**, **Orçamento de payload**, **Plano de ação** e **Manifesto de integração**.
- `/api/server/metrics` agora detecta e distribui sinais de consistência, orçamento e decisão de ação no `proxyOutputMonitor.outputFeed[]`.
- `view=app` passa a incluir, de forma compacta, `fieldConsistencyGuard`, `payloadBudget` e `assetActionPlan`.

### Novidades v21.12.28

- Nova taxonomia oficial de indicadores por classe de ativo em `assetIndicatorCoverage`.
- Novo auditor `engineMaturityBooster` com scores de performance, precisão, confiabilidade e sincronização do app.
- Novos endpoints:
  - `/api/v1/asset/indicators?ticker=PETR4`
  - `/api/v1/fii/indicators?ticker=HGLG11`
  - `/api/v1/engine/maturity?ticker=PETR4`
- Parser numérico com LRU interno para acelerar leituras repetidas de valores brasileiros como `R$ 4,2 bi`, `8,5 mi` e `9,87%`.
- Monitor profissional com páginas novas: **Maturidade do Engine**, **Performance e processamento** e **Taxonomia de indicadores**.
- `view=app` continua sendo a integração recomendada para Web/APK; `full/debug` fica reservado para auditoria.

### Novidades v21.12.27

- Novo `assetClassContract` no payload do Engine, com grupos especializados por classe de ativo.
- Ações agora são organizadas como empresa: perfil, cotação, valuation, rentabilidade, dívida, dividendos, demonstrações e pares.
- FIIs agora são organizados como fundo imobiliário: perfil, rendimentos, patrimonial, portfólio, vacância, cotistas, comunicados e checklist.
- Novo mapa `fieldConfidence` por campo: valor, unidade, fonte, path, confiança e cross-check.
- Novos endpoints de Ação:
  - `/api/v1/asset/profile`
  - `/api/v1/asset/valuation`
  - `/api/v1/asset/profitability`
  - `/api/v1/asset/debt`
  - `/api/v1/asset/statements`
  - `/api/v1/asset/peers`
  - `/api/v1/asset/source-map`
- Novos endpoints de FII:
  - `/api/v1/fii/profile`
  - `/api/v1/fii/income`
  - `/api/v1/fii/patrimonial`
  - `/api/v1/fii/portfolio`
  - `/api/v1/fii/vacancy`
  - `/api/v1/fii/communications`
  - `/api/v1/fii/checklist`
- Normalizador universal ampliado para nomes heterogêneos de indicadores, fundamentos, vacância, patrimônio, cotistas, ABL, dívida, margens e CAGR.
- Monitor visual ganhou páginas de dados financeiros: contrato Ação/FII, páginas de Ação, páginas de FII e fonte por campo.

### Mantido da v21.12.26

- Endpoint de maturidade pessoal: `/api/v1/release/readiness`.
- Alias: `/api/v1/personal/readiness`.
- `/api/server/metrics` agora inclui `personalReleaseReadiness`.
- `/api/v1/source/status` também expõe `personalReleaseReadiness`.
- Monitor visual ganhou página **Maturidade pessoal**.
- Versão interna do monitor corrigida para `21.12.26-personal-maturity-monitor`.
- `README`, `metadata`, `manifest`, `.env.example`, OpenAPI e Fields sincronizados.
- `VALORAE_DEFAULT_ASSET_VIEW` e `VALORAE_DEFAULT_ASSETS_VIEW` permitem escolher payload padrão sem quebrar compatibilidade.
- SDK/prompts apontam para o novo checklist de maturidade.

## Como integrar no Web/APK

Use o contrato oficial:

```text
GET /api/v1/asset?ticker=PETR4&view=app
```

Fluxo recomendado no app:

1. Renderize primeiro `appMobileSnapshot`.
2. Hidrate a tela com `appPayload`.
3. Use `appSyncEnvelope` para decidir cache/snapshot.
4. Use `appResponseIntegrity` para evitar tela vazia ou dados regressivos.
5. Nunca apague o último snapshot bom quando `status=PARTIAL`, `renderSafe=false` ou `cacheSafe=false`.

Headers recomendados para o monitor:

```text
x-valorae-app: Meu App
x-valorae-channel: android|web|watchlist|portfolio
x-valorae-app-version: 1.0.0
x-valorae-build: debug|release
```

## Endpoints principais

```text
/api/v1/asset?ticker=PETR4&view=app
/api/v1/assets?tickers=PETR4,GARE11&view=app
/api/v1/asset/coverage?ticker=PETR4
/api/v1/asset/fundamentals?ticker=PETR4
/api/v1/asset/source-map?ticker=PETR4
/api/v1/asset/valuation?ticker=PETR4
/api/v1/fii/income?ticker=HGLG11
/api/v1/fii/patrimonial?ticker=HGLG11
/api/v1/fii/checklist?ticker=HGLG11
/api/v1/source/status
/api/v1/release/readiness
/api/v1/integration/sdk
/api/v1/integration/prompts
/api/server/metrics
/server.html
```

## Segurança para uso pessoal

Por padrão, o projeto pode rodar aberto para rede confiável. Para compartilhar fora do seu círculo próximo, configure chaves:

```env
VALORAE_CLIENT_KEYS=meu-app:minha-chave-forte
VALORAE_REQUIRE_CLIENT_AUTH=1
```

O app deve enviar:

```text
x-valorae-app-id: meu-app
x-valorae-client-key: minha-chave-forte
```

Também existe assinatura HMAC opcional via `x-valorae-signature` + `x-valorae-timestamp`.

## Variáveis úteis

```env
VALORAE_PUBLIC_BASE_URL=https://servidor-valorae.vercel.app
VALORAE_PERSONAL_MODE=true
VALORAE_DEFAULT_ASSET_VIEW=app
VALORAE_DEFAULT_ASSETS_VIEW=app
VALORAE_CLIENT_KEYS=
VALORAE_REQUIRE_CLIENT_AUTH=false
```

Se quiser compatibilidade máxima com debug antigo, deixe `VALORAE_DEFAULT_ASSET_VIEW` vazio e peça `view=app` explicitamente nos apps.

## Monitor do proxy

Abra:

```text
/server.html
```

O painel mostra o que sai do proxy para os apps/usuários via:

```text
proxyOutputMonitor.outputFeed[]
```

Cada item mostra rota, app, canal, status, bytes, latência, raízes do JSON, métricas, gráficos, dividendos e preview limitado do payload entregue.

Limitação honesta: no Vercel Free, o histórico do monitor é em memória por instância serverless. Se a função esfriar ou outra instância atender, o histórico pode reiniciar. Isso é aceitável para uso pessoal, mas não é telemetria comercial persistente.

## Validação local

```bash
npm run check
npm test
npm run build
npm run audit:free
npm run audit:version
npm run typecheck
npm run smoke
```

Teste novo desta rodada:

```bash
node test/investidor10-class-contract-v21-12-27.test.js
node test/engine-performance-maturity-v21-12-28.test.js
node test/operational-resilience-suite-v21-12-29.test.js
node test/final-personal-launch-cleanup-v21-12-30.test.js
node test/personal-maturity-v21-12-26.test.js
```

## Classificação atual

Para o objetivo real — uso pessoal e pessoas próximas — o projeto está em **Release Candidate maduro com fundamentos mais profundos**. A maior evolução desta versão é estrutural: o Engine deixa de tratar todos os ativos como uma massa genérica e passa a entregar contratos coerentes para Ação e FII.
