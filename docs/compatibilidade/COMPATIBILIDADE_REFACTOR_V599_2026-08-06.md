# Compatibilidade do Proxy com o APK v599

O Proxy VALORAE `21.12.404` declara pareamento testado com o APK `2026.08.06.13` (`versionCode 26080613`).

## Escopo

A v599 retira da camada visual cálculos de Patrimônio e Retorno, montagem de solicitações, acesso ao mercado, preferências, arquivos, perfil, compartilhamento e atualização. O Proxy não recebeu alteração funcional porque o contrato externo permaneceu estável.

Continuam inalterados:

- `POST /api/sync`;
- `POST /api/v1/mobile/alerts`;
- `valorae-financial-sync-v2`;
- protocolo móvel `2026.07.10.10`;
- nomes, tipos e semântica dos campos financeiros;
- `clientTxId`, tombstones, idempotência, retries e conflitos `409`;
- SQL mínimo, cache, rate limit e contrato p404.

Somente a versão pareada e o limite máximo testado foram avançados para `2026.08.06.13`. O rollback do APK não exige alteração de banco ou Proxy.
