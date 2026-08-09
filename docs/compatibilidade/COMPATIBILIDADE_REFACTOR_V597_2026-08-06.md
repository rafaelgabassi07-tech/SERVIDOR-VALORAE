# Compatibilidade da refatoração CP3 v597

O Proxy VALORAE `21.12.404` declara pareamento testado com o APK `2026.08.06.11` (`versionCode 26080611`).

## Escopo

A v597 decompõe o `PortfolioViewModel` em casos de uso e gateways injetáveis. A mudança é interna ao APK e não altera o contrato público do Proxy.

Permanecem idênticos:

- endpoint `/api/sync`;
- contrato `valorae-financial-sync-v2`;
- protocolo móvel `2026.07.10.10`;
- contrato de ecossistema `valorae-ecosystem-2026.08.05.04-p404`;
- nomes, tipos e aliases dos campos financeiros;
- idempotência, tombstones, retries, claims e conflitos `409`;
- janela mínima retrocompatível iniciada em `2026.07.30.01`.

## Homologação

A janela máxima testada e a versão pareada passam para `2026.08.06.11`. Nenhuma rota, parser, serializador, banco remoto ou regra financeira foi modificada no Proxy.
