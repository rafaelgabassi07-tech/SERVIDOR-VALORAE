# Compatibilidade da refatoração CP1/CP2 v596

O Proxy VALORAE `21.12.404` declara pareamento testado com o APK `2026.08.06.10` (`versionCode 26080610`).

## Escopo do pareamento

A v596 separa fisicamente os DAOs de ativos, transações e outbox, cria repositórios especializados e mantém uma fachada temporária de compatibilidade. A alteração não modifica o contrato público do Proxy.

Permanecem invariáveis:

- rota `/api/sync`;
- protocolo móvel `2026.07.10.10`;
- contrato financeiro `valorae-financial-sync-v2`;
- contrato de ecossistema `valorae-ecosystem-2026.08.05.04-p404`;
- nomes e tipos dos campos dos payloads financeiros;
- semântica de `clientTxId`, tombstones, idempotência, retry, claim e conflitos `409`;
- versão pública do Proxy `21.12.404`.

A mudança no Proxy limita-se à janela de compatibilidade declarada, aos testes de pareamento e à documentação de homologação do APK v596.
