# Relatório de auditoria e correções — VALORAE v21.12.38

Data: 2026-05-29  
Base auditada: `valorae-proxy-v21.12.37-proxy-output-filter-restore.zip`  
Entrega gerada: `21.12.38-failure-audit-hardening`  
Escopo: somente VALORAE como Proxy híbrido + API + App/Monitor Web.

## Veredito executivo

O projeto está **aprovado para lançamento pessoal**, com as falhas confirmadas no relatório v21.12.37 corrigidas no pacote v21.12.38.

Não encontrei bloqueador local depois das correções. O único cuidado restante continua sendo operacional: publicar na Vercel, configurar variáveis e validar no domínio real, porque as fontes financeiras públicas podem responder parcial, bloquear ou atrasar.

## Falhas do MD e status após correção

| Item | Status v21.12.38 | Correção aplicada |
|---|---:|---|
| Auditorias legadas quebradas | Corrigido | Restaurados marcadores compatíveis ocultos no HTML atual: `X-Valorae-Telemetry`, `densityToggleBtn`, `anomalyChart`, `engineCoreChart`, `engineCoreList`, `HTML family hit` e demais marcadores esperados. |
| `/api/scrape` retornando 500 | Corrigido | Validação agora lança erros com `status` e `code`: URL ausente `400 MISSING_TARGET_URL`, protocolo HTTP `400 INVALID_TARGET_URL_PROTOCOL`, domínio não permitido `403 SCRAPE_HOST_NOT_ALLOWED`. |
| Financeiro `PARTIAL` sem orientação | Corrigido parcialmente/operacional | `PARTIAL` foi preservado, mas agora payloads financeiros recebem `partialDataGuidance` com ação para manter snapshot anterior, renderizar campos disponíveis e consultar `/api/v1/source/status`. |
| Versão inconsistente | Corrigido por separação explícita | `package.version` permanece como contrato/core `21.12.0`; `metadata.version` agora também é `21.12.0`; patch público fica em `releasePatch: 21.12.38-failure-audit-hardening`. |
| Artefatos Gradle | Corrigido | Removidos `.gradle`, `build.gradle` e `settings.gradle` do pacote final do proxy. |
| Capability Gemini no metadata | Corrigido | `metadata.majorCapabilities` agora é `[]`; auditoria free-only também verifica capabilities proibidas. |
| `/api/router?path=` local | Corrigido | `server.js` agora reescreve `/api/router?path=server/metrics` para `/api/server/metrics` em ambiente local. |

## Correções técnicas feitas

### 1. Scrape com erro didático

Arquivos ajustados:

- `lib/Valorae-engine.js`
- `lib/scrape/scrape-input.js`
- `routes/scrape.js`

Resultados validados localmente:

| Rota | Resultado esperado | Resultado obtido |
|---|---:|---:|
| `/api/scrape` | 400 | `400 MISSING_TARGET_URL` |
| `/api/scrape?url=http://example.com` | 400 | `400 INVALID_TARGET_URL_PROTOCOL` |
| `/api/scrape?url=https://example.com` | 403 | `403 SCRAPE_HOST_NOT_ALLOWED` |

### 2. PARTIAL financeiro com orientação para o app

Adicionado:

- `lib/quality/partial-data-guidance.js`

Integrado em:

- `routes/asset.js`
- `routes/asset/_group.js`

Agora, quando `/api/asset` ou `/api/v1/asset/profile` retornarem `PARTIAL`, o payload inclui:

```json
{
  "partialDataGuidance": {
    "state": "PARTIAL_SOURCE_DATA",
    "appAction": "keep_previous_snapshot_and_render_available_fields",
    "canReplacePreviousSnapshot": false,
    "shouldShowPartialBanner": true,
    "diagnostics": {
      "sourceStatusEndpoint": "/api/v1/source/status"
    }
  }
}
```

Isso não transforma fonte pública instável em fonte garantida, mas evita tela vazia e orienta o app a preservar o último snapshot bom.

### 3. Limpeza free-only

- Removido `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` do `metadata.json`.
- `scripts/preflight-free-only.js` agora falha se capabilities pagas/externas reaparecerem no metadata.
- Removidos arquivos Gradle do pacote proxy.
- Gerado `package-lock.json` sem dependências externas.
- `npm audit --omit=dev`: 0 vulnerabilidades.

### 4. Compatibilidade local do router

`server.js` agora trata a rota local:

```text
/api/router?path=server/metrics
```

como:

```text
/api/server/metrics
```

Resultado local validado: `200`.

## Testes executados

| Validação | Resultado |
|---|---:|
| `npm run check` | PASS |
| `npm test` | PASS |
| `npm run build` | PASS |
| `npm run build:strict` | PASS |
| `npm run typecheck` | PASS |
| `npm run smoke` | PASS |
| `npm run audit:complete-polish` | PASS |
| `npm run audit:visual-polish` | PASS |
| `npm run audit:engine-core` | PASS |
| `npm run audit:engine-modules` | PASS |
| `npm run audit:free` | PASS |
| `npm run audit:version` | PASS |
| `npm run audit:routes` | PASS |
| `npm run audit:release` | PASS |
| `npm run audit:engine-performance` | PASS |
| `npm run bench:scrape` | PASS |
| `npm audit --omit=dev` | PASS, 0 vulnerabilidades |

Observação: ao gerar o `package-lock.json`, o ambiente da ferramenta estava em Node 22, enquanto o projeto declara Node 20.x. Isso gerou apenas um aviso de engine no `npm install --package-lock-only`; não é falha do projeto. A configuração correta para Vercel continua sendo Node 20.x.

## Benchmark HTTP local v21.12.38

| Caso | Status | Código/status payload | Média | P95 | Partial guidance |
|---|---:|---|---:|---:|---:|
| `ready` | 200 | READY | 2.916 ms | 2.802 ms | não |
| `metrics` | 200 | — | 2.295 ms | 2.995 ms | não |
| `router-query-metrics` | 200 | — | 1.833 ms | 2.144 ms | não |
| `scrape-missing-url` | 400 | MISSING_TARGET_URL | 2.431 ms | 2.03 ms | não |
| `scrape-http-protocol` | 400 | INVALID_TARGET_URL_PROTOCOL | 1.558 ms | 1.699 ms | não |
| `scrape-host-not-allowed` | 403 | SCRAPE_HOST_NOT_ALLOWED | 1.529 ms | 1.744 ms | não |
| `asset-petr4-fast` | 200 | PARTIAL | 475.418 ms | 3.547 ms | sim |
| `asset-profile-petr4-fast` | 200 | PARTIAL | 1007.886 ms | 4.358 ms | sim |

## Benchmark nativo de scraping

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| `fast-selectors-single-pass` | 1.282 ms | 1.126 ms | 1.852 ms |
| `custom-selectors-css-lite` | 1.92 ms | 1.75 ms | 2.805 ms |
| `signature-result-key` | 0.022 ms | 0.016 ms | 0.032 ms |
| `signature-fetch-key` | 0.006 ms | 0.004 ms | 0.008 ms |

## O que ainda falta para lançamento

1. Publicar na Vercel usando o pacote v21.12.38.
2. Confirmar variáveis essenciais:

```env
VALORAE_PUBLIC_BASE_URL=https://seu-deploy.vercel.app
PUBLIC_BASE_URL=https://seu-deploy.vercel.app
VALORAE_PERSONAL_MODE=true
VALORAE_DEFAULT_ASSET_VIEW=app
VALORAE_DEFAULT_ASSETS_VIEW=app
```

3. Validar no domínio final:

```text
/api/v1/ready
/api/server/metrics
/api/router?path=server/metrics
/api/v1/source/status
/api/v1/asset?ticker=PETR4&view=app&profile=fast
/api/v1/asset/profile?ticker=PETR4&profile=fast
/api/scrape
/server.html
```

## Conclusão

A v21.12.38 está mais madura que a v21.12.37 para lançamento pessoal. Ela corrige os erros reais que poderiam gerar confusão em benchmark, remove ruído de pacote, melhora a clareza de `PARTIAL` financeiro e transforma falhas de scrape em respostas HTTP corretas e úteis.

**Veredito:** aprovado para lançamento pessoal após validação pós-deploy.
