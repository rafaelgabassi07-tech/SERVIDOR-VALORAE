# Auditoria v21.12.9 — App Mobile Snapshot

## Objetivo

Adicionar uma raiz compacta e estável para o APK/Web renderizar a primeira tela, listas e watchlists sem depender de `results`, HTML bruto, diagnósticos longos ou payloads grandes.

## Melhorias aplicadas

- Novo módulo `lib/quality/app-mobile-snapshot.js`.
- Novo campo `appMobileSnapshot` no payload do engine.
- Snapshot compacto com:
  - `quote` pronto para card de cotação.
  - `metrics` canônicas compactadas.
  - `panels` com estado e completude.
  - `charts` amostrados, limitando até 6 séries e 80 pontos por série.
  - `dividends` resumido com histórico recente.
  - `sync` herdando decisão e hash do `appSyncEnvelope`.
  - `snapshotHash` próprio para cache local e comparação rápida.
- Correção defensiva: contratos de app agora aceitam métricas normalizadas primitivas além do formato `{ value, display, unit }`.

## Impacto no app

O app pode usar `appMobileSnapshot` como raiz preferencial para primeira pintura e depois hidratar detalhes com `appPayload`, `appRenderContract`, `appDataContract` e `results`.

## Validação

- `node test/app-mobile-snapshot-v21-12-9.test.js`
- `npm run check`
- `npm test`
- Auditorias e build padrão do projeto.
