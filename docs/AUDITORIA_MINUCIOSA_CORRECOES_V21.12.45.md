# VALORAE Proxy v21.12.45 — Auditoria minuciosa com foco em correções

Base auditada: `v21.12.44-stale-budget-performance-boost`  
Entrega gerada: `v21.12.45-final-audit-corrections`  
Data: 2026-05-29

## Veredito

O projeto está aprovado para lançamento pessoal. A auditoria não encontrou bloqueador técnico local depois das correções aplicadas nesta rodada.

A v21.12.44 já estava saudável em testes, build, auditorias, benchmarks e segurança free-only. A auditoria minuciosa encontrou um problema funcional de acabamento em `/api/assets` com tickers duplicados e inconsistências menores de rótulos/relatórios de release. Esses pontos foram corrigidos na v21.12.45.

## Correção funcional principal

### `/api/assets` perdia duplicatas antes de chegar ao engine

Problema identificado:

```text
/api/v1/assets?tickers=PETR4,VALE3,PETR4&view=app&profile=portfolio&timeoutMs=800
```

Na v21.12.44, a rota removia duplicatas antes de chamar `fetchAtivosBatch`. Isso fazia o payload voltar com apenas 2 posições, apesar de o app ter pedido 3. Para carteiras/listas isso é ruim, porque a ordem e a quantidade podem representar posições reais da interface.

Correção aplicada:

- A rota `/api/assets` agora preserva a lista válida original, incluindo duplicatas.
- O engine continua fazendo dedupe interno de extração, então não busca o mesmo ticker repetidas vezes.
- O payload final volta com a quantidade e a ordem solicitada.

Resultado validado:

```json
{
  "count": 3,
  "stats": {
    "requested": 3,
    "uniqueRequested": 2,
    "deduped": 1
  },
  "tickers": ["PETR4", "VALE3", "PETR4"]
}
```

## Correções de harmonia e release

- Sincronizei release para `21.12.45-final-audit-corrections` em metadata, package, PWA, service worker, monitor, readiness, OpenAPI, integração e métricas.
- Atualizei o cache PWA para `valorae-proxy-server-v21-12-45`.
- Corrigi rótulos que ainda descreviam a v21.12.44 como `performance harmony` em locais que agora representam a rodada de auditoria final.
- Adicionei scripts de benchmark dedicados para a família v21.12.45.
- Adicionei o teste `final-audit-corrections-v21-12-45.test.js`.
- Limpei relatórios gerados antigos v21.12.44 da pasta `reports`, mantendo os relatórios de benchmark da entrega atual.

## Testes executados

Todos passaram:

- `npm run check` — 259 arquivos JS validados.
- `npm test` — 73 testes/arquivos de teste executados.
- `npm run build`.
- `npm run build:strict`.
- `npm run typecheck`.
- `npm run smoke`.
- `npm run audit:complete-polish`.
- `npm run audit:visual-polish`.
- `npm run audit:engine-core`.
- `npm run audit:engine-modules`.
- `npm run audit:engine-performance`.
- `npm run audit:routes`.
- `npm run audit:release`.
- `npm run audit:free`.
- `npm run audit:version`.
- `npm run audit:minutiae`.
- `npm run audit:recommended`.
- `npm run audit:final`.
- `npm run bench:scrape`.
- `npm run bench:turbo`.
- `npm run bench:stale-budget`.
- `npm audit --omit=dev` — 0 vulnerabilidades.

Observação: `npm run verify` é um agregador longo. Ele foi iniciado, mas excedeu o tempo útil durante a repetição de `npm test`. Os blocos internos dele foram executados separadamente e passaram.

## Smoke HTTP local

| Rota | Status | Média local |
|---|---:|---:|
| `/` | 200 | 11.444 ms |
| `/server.html` | 200 | 3.083 ms |
| `/api/v1/ready` | 200 | 6.612 ms |
| `/api/server/metrics` | 200 | 5.820 ms |
| `/api/router?path=server/metrics` | 200 | 4.577 ms |
| `/api/v1/integration/manifest` | 200 | 2.800 ms |
| `/api/v1/release/readiness` | 200 | 3.672 ms |
| `/api/scrape` sem URL | 400 esperado | 5.987 ms |
| `/api/scrape` com HTTP | 400 esperado | 3.050 ms |
| `/api/scrape` domínio fora da allowlist | 403 esperado | 2.833 ms |
| `/api/v1/asset` fast com `timeoutMs=500` | 200 | 20.031 ms |
| `/api/v1/asset` turbo com `timeoutMs=500` | 200 | 7.546 ms |
| `/api/v1/assets` portfolio com duplicata | 200 | 13.034 ms |

Os `400`/`403` do `/api/scrape` continuam corretos e representam bloqueios de segurança, não falha do proxy.

## Benchmarks

### `npm run bench:scrape`

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.345 ms | 1.177 ms | 1.988 ms |
| custom-selectors-css-lite | 2.247 ms | 2.151 ms | 2.893 ms |
| signature-result-key | 0.023 ms | 0.018 ms | 0.031 ms |
| signature-fetch-key | 0.007 ms | 0.004 ms | 0.008 ms |

### `npm run bench:turbo`

| Caso | Média | Mediana | P95 | Resultado |
|---|---:|---:|---:|---|
| turbo-complement-no-result-cache | 24.659 ms | 20.663 ms | 30.842 ms | OK, `partial=false`, score 86 |
| turbo-result-cache-hit | 0.670 ms | 0.590 ms | 1.368 ms | OK, `partial=false`, score 86 |

Cache hit rate: 96.15%.

### `npm run bench:stale-budget`

| Caso | Média | Mediana | P95 | Resultado |
|---|---:|---:|---:|---|
| cold-fresh-fill | 95.745 ms | 95.745 ms | 95.745 ms | OK |
| stale-while-revalidate-low-latency | 1.875 ms | 0.662 ms | 12.786 ms | OK |

Chamadas à fonte durante o stale benchmark: 0.

## Coisas que ainda podem ser melhoradas futuramente

Não são bloqueadores de lançamento, mas são próximos pontos de evolução:

1. **Payload de `/api/assets` em carteira ainda pode ser reduzido mais.** Mesmo com `view=app`, múltiplos ativos podem gerar payload grande quando há muitos diagnósticos por ativo. Para carteiras grandes, uma futura `view=portfolio-lite` poderia entregar só campos essenciais.
2. **`PARTIAL` ainda pode ocorrer quando fontes externas falham.** A arquitetura está correta: não inventa dados, usa snapshot/cache quando disponível e informa diagnóstico. Eliminar 100% de `PARTIAL` exigiria uma fonte financeira estável/oficial, o que não faz parte da política free-only atual.
3. **Histórico do Monitor segue em memória por instância.** Para uso pessoal isso é aceitável. Histórico global persistente exigiria armazenamento externo opcional.

## Conclusão

Use a versão `v21.12.45-final-audit-corrections` para o próximo deploy.

Ela preserva as melhorias de desempenho da v21.12.44, corrige o comportamento de `/api/assets` com duplicatas, harmoniza o Monitor com o ecossistema VALORAE e mantém o projeto compatível com Vercel Free, sem banco, Redis, KV, WebSocket ou dependências pagas.
