# Auditoria completa com foco em correções — VALORAE v21.12.39

Data: 2026-05-29 17:00 BRT  
Escopo: projeto completo do VALORAE Proxy híbrido + API + App/Monitor Web.  
Base auditada: v21.12.38 failure-audit-hardening.
Entrega gerada: `21.12.39-full-project-audit-hardening`.

## Veredito

O projeto está aprovado para lançamento pessoal hoje após deploy e validação no domínio real da Vercel.

Não encontrei bloqueador técnico local depois das correções finais. Os principais riscos restantes são operacionais e externos: fontes financeiras públicas podem retornar dados parciais, e o histórico do monitor continua sendo em memória por instância no Vercel Free.

## Correções aplicadas nesta rodada

1. Sincronização da release atual em `metadata.json`, `package.json`, `public/manifest.webmanifest`, `public/service-worker.js`, `public/index.html`, `public/server.html`, `/api/server/metrics`, `/api/v1/integration/manifest` e `/api/v1/release/readiness`.
2. Atualização do cache PWA para `valorae-proxy-server-v21-12-39`, reduzindo risco de o navegador manter shell antigo da v21.12.37/v21.12.38 após o deploy.
3. Limpeza de resíduos de patch/build no topo do ZIP: `fix_modal.cjs`, `update.cjs`, `update_menu.cjs`, `head.html`, `formatted.css`, `ui-styles.css` e `test.js` não são mais enviados.
4. Correção dos testes legados que rejeitavam versões posteriores da família 21.12.x como falso negativo.
5. Inclusão do teste `test/full-project-audit-v21-12-39.test.js` para travar regressões de release sync, PWA, metadata, resíduos locais, capability paga e manifesto de integração.
6. Preservação de marcador não visual de compatibilidade para `21.12.37-proxy-output-filter-restore`, sem alterar a UI.
7. Atualização do `docs/CHANGELOG.md` com a entrada v21.12.39.
8. Enriquecimento dos erros esperados do `/api/scrape` com `expectedValidationError`, `hint`, `example` e `benchmarkMeaning`, para o benchmark não classificar validação segura como falha interna.
9. Preservação do núcleo `lib/Valorae-engine.js` como arquivo central, sem desmembramento.

## Esclarecimento sobre `/api/scrape` retornando 400

Esses dois casos são intencionais e corretos:

| Caso | Status esperado | Código | Motivo |
|---|---:|---|---|
| `/api/scrape` sem URL | 400 | `MISSING_TARGET_URL` | O endpoint precisa de `url=` para saber qual página buscar. |
| `/api/scrape?url=http://...` | 400 | `INVALID_TARGET_URL_PROTOCOL` | O proxy aceita somente `https://` para reduzir risco de SSRF, tráfego inseguro e comportamento inesperado. |
| `/api/scrape?url=https://example.com` | 403 | `SCRAPE_HOST_NOT_ALLOWED` | Domínio fora da allowlist. |

Antes, esses casos podiam aparecer como `500 INTERNAL_ERROR`, o que era bug. Agora são respostas didáticas de validação e incluem `expectedValidationError: true`. Em benchmark, devem ser classificados como `expected validation error`, não como falha do proxy.

Exemplo correto para scraping permitido:

```text
/api/scrape?url=https://investidor10.com.br/acoes/petr4/&selector=h1&timeoutMs=1500
```

## Validações executadas

| Comando | Resultado |
|---|---:|
| `npm run check` | PASS — 247 arquivos JS validados |
| `npm test` | PASS — suíte comportamental completa |
| `npm run build` | PASS |
| `npm run build:strict` | PASS |
| `npm run typecheck` | PASS |
| `npm run smoke` | PASS |
| `npm run audit:complete-polish` | PASS |
| `npm run audit:visual-polish` | PASS |
| `npm run audit:engine-core` | PASS |
| `npm run audit:engine-modules` | PASS |
| `npm run audit:engine-performance` | PASS |
| `npm run audit:free` | PASS |
| `npm run audit:version` | PASS |
| `npm run audit:routes` | PASS — 68 rotas internas, 1 Function física |
| `npm run audit:release` | PASS |
| `npm run audit:minutiae` | PASS |
| `npm run audit:recommended` | PASS |
| `npm run audit:final` | PASS |
| `npm run bench:scrape` | PASS |
| `npm audit --omit=dev` | PASS — 0 vulnerabilidades |

Observação: `npm run verify` foi iniciado, mas a ferramenta interrompeu por limite de tempo durante a repetição da suíte longa. Os blocos internos do `verify` foram executados separadamente e passaram.

## Benchmark nativo local

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| `fast-selectors-single-pass` | 1.092 ms | 0.948 ms | 1.784 ms |
| `custom-selectors-css-lite` | 1.686 ms | 1.598 ms | 2.011 ms |
| `signature-result-key` | 0.017 ms | 0.013 ms | 0.023 ms |
| `signature-fetch-key` | 0.005 ms | 0.003 ms | 0.007 ms |

## Benchmark HTTP local

Arquivo gerado: `reports/benchmark-full-project-v21.12.39.json`.

| Endpoint/caso | Status | Código/estado | Esperado? | Mediana | P95 |
|---|---:|---|---:|---:|---:|
| `/api/v1/ready` | 200 | READY | não | 2.198 ms | 2.742 ms |
| `/api/server/metrics` | 200 | OK | não | 1.895 ms | 3.467 ms |
| `/api/router?path=server/metrics` | 200 | OK | não | 1.799 ms | 1.839 ms |
| `/api/v1/integration/manifest` | 200 | OK | não | 1.382 ms | 1.495 ms |
| `/api/v1/release/readiness` | 200 | controlled-ready | não | 1.568 ms | 1.800 ms |
| `/api/v1/source/status` | 200 | OK | não | 1.480 ms | 1.848 ms |
| `/api/server/tests?mode=quick` | 200 | OK | não | 32.834 ms | 39.709 ms |
| `/api/scrape` | 400 | MISSING_TARGET_URL | sim | 1.694 ms | 2.164 ms |
| `/api/scrape?url=http://example.com` | 400 | INVALID_TARGET_URL_PROTOCOL | sim | 1.555 ms | 1.779 ms |
| `/api/scrape?url=https://example.com` | 403 | SCRAPE_HOST_NOT_ALLOWED | sim | 1.598 ms | 1.836 ms |
| `/api/asset?ticker=PETR4&view=app&profile=fast&timeoutMs=500` | 200 | PARTIAL esperado quando fonte externa falha | não | 2.758 ms | 4.271 ms |

O `avgMs` de `/api/asset` ficou artificialmente alto por causa da primeira chamada fria/fonte externa; a mediana e o P95 após cache são mais representativos para o uso local.

## Higiene do pacote

- Sem `build.gradle`, `settings.gradle` ou `.gradle`.
- Sem capability Gemini no `metadata.json`.
- Sem dependências obrigatórias pagas.
- Sem Redis/KV/banco/storage externo obrigatório.
- Service Worker não intercepta `/api`.
- `public/index.html` e `public/server.html` continuam espelhados.
- `package.version` permanece `21.12.0` como contrato/core; `releasePatch` identifica `21.12.39-full-project-audit-hardening`.

## Itens que ainda exigem atenção após deploy

1. Validar no domínio real da Vercel:
   - `/api/v1/ready`
   - `/api/v1/release/readiness`
   - `/api/server/metrics`
   - `/api/router?path=server/metrics`
   - `/api/v1/integration/manifest`
   - `/api/v1/source/status`
   - `/api/asset?ticker=PETR4&view=app&profile=fast`
   - `/server.html`
2. Confirmar que o navegador carregou o Service Worker novo `valorae-proxy-server-v21-12-39`; se necessário, limpar cache do navegador depois do deploy.
3. Se compartilhar com outras pessoas, ativar client keys leves via variáveis de ambiente.
4. Tratar `PARTIAL` financeiro no app como estado degradado, não falha fatal, mantendo último snapshot bom.

## Conclusão

A v21.12.39 é a melhor versão para publicação hoje. Ela corrige inconsistências de release, endurece a auditoria final, limpa o pacote, preserva compatibilidade dos filtros/monitor e transforma os `400` do `/api/scrape` em validação esperada e documentada.
