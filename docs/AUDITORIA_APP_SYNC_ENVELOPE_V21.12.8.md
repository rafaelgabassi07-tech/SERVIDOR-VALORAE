# Auditoria v21.12.8 — App Sync Envelope

## Objetivo

Adicionar uma camada final de sincronização para o APK/Web decidir, sem inferência frágil no cliente, se deve substituir o snapshot local, mesclar dados parciais, manter o último snapshot bom ou mostrar estado vazio controlado.

## Arquivos alterados

- `lib/quality/app-sync-envelope.js`
- `lib/Valorae-engine.js`
- `routes/fields.js`
- `routes/openapi.js`
- `lib/engine/Valorae-engine-types.ts`
- `package.json`
- `test/app-sync-envelope-v21-12-8.test.js`

## Novo campo

`appSyncEnvelope`

### Blocos principais

- `identity`: `syncKey`, `payloadHash`, `appPayloadHash` e `dataContractHash`.
- `decision`: ação recomendada para cache/snapshot local.
- `firstPaint`: caminhos mínimos para primeira renderização segura.
- `hydration`: ordem de hidratação incremental e caminhos lazy.
- `transport`: diagnóstico de cache, fonte e tamanho aproximado do payload.
- `polling`: TTL recomendado e condições de retry.

## Ações possíveis

- `replace_snapshot`
- `merge_with_previous_snapshot`
- `render_without_replacing_snapshot`
- `keep_previous_show_stale_badge`
- `keep_previous_show_empty_state`

## Ganho para o app

O app não precisa mais deduzir sozinho se um retorno parcial deve apagar dados antigos. Ele pode ler `appSyncEnvelope.decision.action` e `appSyncEnvelope.identity.payloadHash` antes de atualizar a UI/cache local.

## Compatibilidade

A mudança é aditiva. Nenhum campo anterior foi removido. O núcleo `lib/Valorae-engine.js` foi preservado e apenas chama o novo módulo auxiliar.
