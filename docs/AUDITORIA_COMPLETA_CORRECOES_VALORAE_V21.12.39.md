# Auditoria completa com foco em correções — VALORAE v21.12.39

Data: 2026-05-29 17:00 BRT  
Escopo: projeto completo do VALORAE Proxy híbrido + API + App/Monitor Web.  
Base auditada: v21.12.38 failure-audit-hardening.
Entrega gerada: `21.12.40-extraction-completion-speed`.

## Veredito

O projeto está aprovado para lançamento pessoal hoje após deploy e validação no domínio real da Vercel.

Não encontrei bloqueador técnico local depois das correções finais. Os principais riscos restantes são operacionais e externos: fontes financeiras públicas podem retornar dados parciais, e o histórico do monitor continua sendo em memória por instância no Vercel Free.

## Correções aplicadas nesta rodada

1. Sincronização da release atual em `metadata.json`, `package.json`, `public/manifest.webmanifest`, `public/service-worker.js`, `public/index.html`, `public/server.html`, `/api/server/metrics`, `/api/v1/integration/manifest` e `/api/v1/release/readiness`.
2. Atualização do cache PWA para `valorae-proxy-server-v21-12-40`, reduzindo risco de o navegador manter shell antigo da v21.12.37/v21.12.38 após o deploy.
3. Limpeza de resíduos de patch/build no topo do ZIP: `fix_modal.cjs`, `update.cjs`, `update_menu.cjs`, `head.html`, `formatted.css`, `ui-styles.css` e `test.js` não são mais enviados.
4. Correção dos testes legados que rejeitavam versões posteriores da família 21.12.x como falso negativo.
5. Inclusão do teste `test/full-project-audit-v21-12-39.test.js` para travar regressões de release sync, PWA, metadata, resíduos locais, capability paga e manifesto de integração.
6. Preservação de marcador não visual de compatibilidade para `21.12.37-proxy-output-filter-restore`, sem alterar a UI.
7. Atualização do `docs/CHANGELOG.md` com a entrada v21.12.39.
8. Preservação do núcleo `lib/Valorae-engine.js` como arquivo central, sem desmembramento.

## Esclarecimento sobre `/api/scrape` retornando 400

Esses dois casos são intencionais e corretos:

| Caso | Status esperado | Código | Motivo |
|---|---:|---|---|
| `/api/scrape` sem URL | 400 | `MISSING_TARGET_URL` | O endpoint precisa de `url=` para saber qual página buscar. |
| `/api/scrape?url=http://...` | 400 | `INVALID_TARGET_URL_PROTOCOL` | O proxy aceita somente `https://` para reduzir risco de SSRF, tráfego inseguro e comportamento inesperado. |
| `/api/scrape?url=https://example.com` | 403 | `SCRAPE_HOST_NOT_ALLOWED` | Domínio fora da allowlist. |

Antes, esses casos podiam aparecer como `500 INTERNAL_ERROR`, o que era bug. Agora são respostas didáticas de validação. Em benchmark, devem ser classificados como `expected validation error`, não como falha do proxy.

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
| `fast-selectors-single-pass` | 1.095 ms | 0.960 ms | 1.750 ms |
| `custom-selectors-css-lite` | 1.660 ms | 1.575 ms | 2.285 ms |
| `signature-result-key` | 0.018 ms | 0.014 ms | 0.026 ms |
| `signature-fetch-key` | 0.006 ms | 0.005 ms | 0.007 ms |

## Benchmark HTTP local

Arquivo gerado: `reports/benchmark-full-project-v21.12.39.json`.

| Endpoint/caso | Status | Código/estado | Mediana | P95 |
|---|---:|---|---:|---:|
| `/api/v1/ready` | 200 | READY | 2.110 ms | 3.999 ms |
| `/api/server/metrics` | 200 | OK | 2.157 ms | 8.637 ms |
| `/api/router?path=server/metrics` | 200 | OK | 1.807 ms | 2.483 ms |
| `/api/v1/integration/manifest` | 200 | OK | 1.339 ms | 2.162 ms |
| `/api/v1/release/readiness` | 200 | controlled-ready | 1.629 ms | 2.033 ms |
| `/api/v1/source/status` | 200 | OK | 1.481 ms | 1.881 ms |
| `/api/server/tests?mode=quick` | 200 | OK | 32.292 ms | 34.274 ms |
| `/api/scrape` | 400 | MISSING_TARGET_URL | 1.636 ms | 2.020 ms |
| `/api/scrape?url=http://example.com` | 400 | INVALID_TARGET_URL_PROTOCOL | 1.535 ms | 1.786 ms |
| `/api/scrape?url=https://example.com` | 403 | SCRAPE_HOST_NOT_ALLOWED | 1.449 ms | 1.682 ms |
| `/api/asset?ticker=PETR4&view=app&profile=fast&timeoutMs=500` | 200 | PARTIAL esperado quando fonte externa falha | 3.350 ms | 3.784 ms |

O `avgMs` de `/api/asset` ficou artificialmente alto por causa da primeira chamada fria/fonte externa; a mediana e o P95 após cache são mais representativos para o uso local.

## Higiene do pacote

- Sem `build.gradle`, `settings.gradle` ou `.gradle`.
- Sem capability Gemini no `metadata.json`.
- Sem dependências obrigatórias pagas.
- Sem Redis/KV/banco/storage externo obrigatório.
- Service Worker não intercepta `/api`.
- `public/index.html` e `public/server.html` continuam espelhados.
- `package.version` permanece `21.12.0` como contrato/core; `releasePatch` identifica `21.12.40-extraction-completion-speed`.

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
2. Confirmar que o navegador carregou o Service Worker novo `valorae-proxy-server-v21-12-40`; se necessário, limpar cache do navegador depois do deploy.
3. Se compartilhar com outras pessoas, ativar client keys leves via variáveis de ambiente.
4. Tratar `PARTIAL` financeiro no app como estado degradado, não falha fatal, mantendo último snapshot bom.

## Conclusão

A v21.12.39 é a melhor versão para publicação hoje. Ela corrige inconsistências de release, endurece a auditoria final, limpa o pacote, preserva compatibilidade dos filtros/monitor e transforma os `400` do `/api/scrape` em validação esperada e documentada.
