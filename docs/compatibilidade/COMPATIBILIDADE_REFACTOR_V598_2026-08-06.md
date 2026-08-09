# Compatibilidade do Proxy com o APK v598

O Proxy VALORAE `21.12.404` declara pareamento testado com o APK `2026.08.06.12` (`versionCode 26080612`).

## Escopo do checkpoint

A v598 separa aquisição, classificação, persistência, agendamento e apresentação das notificações no APK. O Proxy não precisou de alteração funcional porque o contrato externo permaneceu estável.

## Contratos preservados

- `/api/sync` e `valorae-financial-sync-v2`;
- `/api/v1/mobile/alerts` e o bundle consolidado de alertas;
- protocolo móvel `2026.07.10.10`;
- headers de compatibilidade;
- payloads, aliases, tombstones, idempotência e conflitos `409`;
- contrato de ecossistema `valorae-ecosystem-2026.08.05.04-p404`.

## Alteração no Proxy

Somente a versão pareada e o limite máximo testado foram avançados para `2026.08.06.12`. Não houve mudança em rota, parser, serializador, SQL, cache, rate limit ou regra financeira.
