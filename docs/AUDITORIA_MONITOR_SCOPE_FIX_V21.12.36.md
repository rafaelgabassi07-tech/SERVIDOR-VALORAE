# Auditoria v21.12.36 — Monitor Scope Fix

## Problema observado

Ao abrir o monitor, a interface exibia:

> Não consegui ler /api/server/metrics: state is not defined. Exibindo último snapshot local, se existir.

## Causa raiz

O endpoint `/api/server/metrics` não era a causa principal. Em teste local ele respondia `200 OK` com JSON válido.

A falha vinha do painel: helpers visuais adicionados depois da closure principal, especialmente `updateFilterOptions()` e handlers do seletor customizado, tentavam acessar `state` e `applyFilters` diretamente. Esses símbolos existem apenas dentro da closure principal do monitor. Quando `render()` recebia o JSON de métricas e chamava `updateFilterOptions()`, o navegador levantava `ReferenceError: state is not defined`.

Como o `refresh()` envolve tanto `api()` quanto `render()` no mesmo `try/catch`, a UI interpretava o erro de renderização como se fosse falha de leitura de `/api/server/metrics`. Por isso a mensagem era tecnicamente enganosa.

## Correção aplicada

- Criada ponte estreita e explícita:
  - `window.valoraeMonitorState = state`
  - `window.valoraeMonitorApplyFilters = applyFilters`
- `updateFilterOptions()` agora obtém o estado por `window.valoraeMonitorState`.
- O handler do seletor customizado chama `window.valoraeMonitorApplyFilters()` quando disponível.
- `public/index.html` e `public/server.html` foram mantidos espelhados.
- `lib/Valorae-engine.js` permaneceu intacto como núcleo central.

## Validações executadas

- `npm run check` — PASS
- `npm run smoke` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `npm run build:strict` — PASS
- `npm run typecheck` — PASS
- `npm run audit:routes` — PASS
- `npm run audit:release` — PASS

## Veredito

A mensagem recorrente `state is not defined` foi corrigida. O monitor deve abrir sem falso erro em `/api/server/metrics`. O feed ainda pode aparecer sem tráfego real até que uma rota de dados, como `/api/v1/asset?ticker=PETR4&view=app`, seja consumida pelo app ou pelo botão de teste do próprio monitor.
