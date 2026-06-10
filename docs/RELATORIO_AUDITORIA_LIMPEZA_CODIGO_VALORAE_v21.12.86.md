# Relatório técnico — Auditoria de limpeza, correções e higiene de código

**Entrega:** APK VALORAE v2.0.58 + VALORAE Proxy v21.12.86  
**Base preservada:** APK v2.0.57 + Proxy v21.12.85  
**Foco:** limpeza, consistência, correções leves, testes, versionamento, contratos APK ↔ Proxy e redução de risco de regressão.

## 1. Objetivo da rodada

Esta rodada não reescreveu o projeto nem alterou a árvore principal. O objetivo foi fazer uma auditoria de manutenção profunda em cima do estado mais recente do VALORAE, corrigindo sujeiras acumuladas de versões anteriores e deixando o APK e o Proxy mais seguros para novas rodadas de evolução.

A prioridade foi:

1. preservar a compatibilidade com Google AI Studio;
2. manter rotas e caminhos existentes;
3. corrigir divergências de release/manifest/monitor/testes;
4. reduzir ruído de produção;
5. validar o Proxy com suíte completa;
6. registrar claramente o que ainda não pôde ser compilado no APK por limitação de rede do sandbox.

## 2. Diagnóstico encontrado

### 2.1 Proxy passava no check sintático, mas não na suíte completa

Antes da correção, `npm run check` passava, mas `npm test` falhava porque diversos testes legados estavam travados em patches antigos, como `21.12.72`, enquanto o projeto já estava em `21.12.85`.

Isso é perigoso porque cria falsa segurança: o JavaScript é válido, mas a suíte de regressão deixa de validar a release atual.

### 2.2 Release espalhada em muitos lugares

Foram encontradas referências divergentes entre:

- `metadata.json`;
- `package.json`;
- `public/manifest.webmanifest`;
- `public/service-worker.js`;
- `public/index.html`;
- `public/server.html`;
- `lib/observability/server-metrics.js`;
- `routes/integration/manifest.js`;
- `routes/release/readiness.js`;
- testes técnicos.

O monitor público ainda exibia vários marcadores de `21.12.72`, enquanto o pacote já dizia `21.12.85`.

### 2.3 Testes antigos estavam impedindo evolução limpa

Alguns testes não validavam comportamento; validavam uma lista rígida de versões antigas. Isso impedia novas releases de serem verificadas sem quebrar a suíte, mesmo quando o comportamento estava correto.

A correção foi transformar esses testes em validações de contrato atual, por exemplo:

- aceitar `21.12.x` atual;
- exigir formato `releasePatch` válido;
- exigir que o manifesto use fonte única de release;
- continuar verificando rotas, payloads, monitor, PWA e service worker.

### 2.4 APK tinha versão local inconsistente

O APK estava em `2.0.57` no Gradle e metadata, mas `update.json` e `version.json` ainda apontavam para `2.0.55`.

Isso pode causar confusão em atualizações internas, logs, validações e publicação manual.

### 2.5 Log de update em produção

Foi encontrado `android.util.Log.d` em `UpdateManager.kt` sem guarda por `BuildConfig.DEBUG`. Isso não quebrava o app, mas é ruído desnecessário em produção.

## 3. Correções aplicadas no Proxy v21.12.86

### 3.1 Fonte única de release

Criado:

```text
lib/release/current.js
```

Esse arquivo centraliza:

```text
VALORAE_CORE_VERSION
VALORAE_PUBLIC_VERSION
VALORAE_RELEASE_PATCH
VALORAE_RELEASE_LABEL
VALORAE_CACHE_VERSION
VALORAE_RELEASE_DESCRIPTION
```

Com isso, endpoints e métricas deixam de depender de strings soltas em cada arquivo.

### 3.2 Monitor, PWA e service worker alinhados

Atualizados:

- `public/index.html`;
- `public/server.html`;
- `public/manifest.webmanifest`;
- `public/service-worker.js`.

Agora o monitor expõe `21.12.86-code-cleanup-contract-hygiene`, e o cache do service worker usa `valorae-proxy-server-v21-12-86`.

### 3.3 Métricas e endpoints internos alinhados

Atualizados:

- `lib/observability/server-metrics.js`;
- `routes/integration/manifest.js`;
- `routes/release/readiness.js`.

Esses módulos agora importam `VALORAE_RELEASE_PATCH` de `lib/release/current.js`.

### 3.4 Módulos Investidor10 com versão compatível com a release atual

Atualizados:

- `lib/market/investidor10-chart-extractor.js`;
- `lib/market/investidor10-dividend-agenda.js`.

Os módulos continuam com identidade própria no sufixo, mas passam a herdar a release atual.

### 3.5 Testes limpos e atualizados

A suíte foi ajustada para não travar em versões antigas e ainda validar os mesmos contratos técnicos.

Principais arquivos de teste atualizados:

- `test/apk-user-points-v21-12-57.test.js`;
- `test/failure-audit-v21-12-38.test.js`;
- `test/final-audit-corrections-v21-12-48.test.js`;
- `test/full-project-audit-v21-12-39.test.js`;
- `test/investidor10-complete-asset-charts-v21-12-62.test.js`;
- `test/investidor10-dividend-agenda-v21-12-63.test.js`;
- `test/routes-audit.test.js`;
- `test/v21-5-6-final-review-hardening.test.js`;
- `test/engine-performance-maturity-v21-12-28.test.js`;
- `test/extreme-audit-logo-standard-v21-12-49.test.js`;
- `test/extreme-audit-logo-standard-v21-12-50.test.js`;
- `test/monitor-data-fill-v21-12-35.test.js`;
- `test/monitor-experience-redesign-v21-12-31.test.js`;
- `test/operational-resilience-suite-v21-12-29.test.js`;
- `test/personal-maturity-v21-12-26.test.js`;
- `test/proxy-output-real-capture-v21-12-20.test.js`;
- `test/proxy-output-server-page-v21-12-18.test.js`;
- `test/final-personal-launch-cleanup-v21-12-30.test.js`.

## 4. Correções aplicadas no APK v2.0.58

### 4.1 Versionamento consistente

Atualizados:

- `app/build.gradle.kts`;
- `metadata.json`;
- `update.json`;
- `version.json`.

Novo estado:

```text
versionName = 2.0.58
versionCode = 68
releasePatch = 2.0.58-code-cleanup-contract-hygiene
```

### 4.2 Log de atualização protegido por DEBUG

Em `UpdateManager.kt`, o log de manifesto de update agora só roda em builds debug:

```kotlin
if (BuildConfig.DEBUG) {
    android.util.Log.d(...)
}
```

Isso reduz ruído e exposição desnecessária em produção.

### 4.3 Validação estática nova

Criado:

```text
scripts/verify_valorae_cleanup_v2058.py
```

O script valida:

- Gradle em `2.0.58` / `68`;
- `metadata.json` consistente;
- `update.json` consistente;
- `version.json` consistente;
- log de update protegido por `BuildConfig.DEBUG`;
- árvore Android preservada.

## 5. Validações realizadas

### 5.1 Proxy

Executado com sucesso:

```bash
npm run check
npm test
npm run smoke
npm run build
```

Resultados:

```text
npm run check: Checked 297 JS files
npm test: 93 arquivos executados; falhas=0; lentos=nenhum
npm run smoke: Smoke OK
npm run build: Build OK para Vercel
```

Logs incluídos no pacote:

```text
docs/PROXY_CHECK_CLEANUP_v21.12.86.log
docs/PROXY_TEST_CLEANUP_v21.12.86.log
docs/PROXY_SMOKE_CLEANUP_v21.12.86.log
docs/PROXY_BUILD_CLEANUP_v21.12.86.log
```

### 5.2 APK

Executado com sucesso:

```bash
python3 scripts/verify_valorae_cleanup_v2058.py
```

Resultado:

```text
VALORAE APK cleanup v2.0.58 OK
```

Tentativa de Gradle:

```bash
./gradlew test --no-daemon
```

Resultado: bloqueada por `UnknownHostException: services.gradle.org`, a mesma limitação de rede das rodadas anteriores. O log foi preservado em:

```text
app/docs/APK_BUILD_ATTEMPT_CLEANUP_v2.0.58.log
```

## 6. O que não foi alterado

Para preservar compatibilidade:

- não mudei `applicationId`;
- não mudei namespace;
- não renomeei raiz do APK;
- não renomeei raiz do Proxy;
- não removi endpoints antigos;
- não removi scripts legados;
- não alterei a árvore esperada pelo Google AI Studio;
- não reescrevi telas ou ViewModels grandes sem necessidade.

## 7. Resultado final

A rodada fortaleceu a base do projeto sem alterar sua identidade.

O Proxy agora tem suíte completa verde, release centralizada, monitor/PWA/service worker consistentes e contratos internos alinhados.

O APK agora tem versionamento local coerente, menos ruído de log em produção e validação estática própria para impedir nova divergência entre Gradle, metadata e manifestos de atualização.
