# Compatibilidade da refatoração v602 — CP6.5 Configurações

## Par homologado

- APK: `2026.08.06.16` — checkpoint `v602-refactor-cp6-settings`.
- Proxy: `21.12.404` — patch `21.12.404-account-profile-v413`.
- Protocolo móvel: `2026.07.10.10`.
- Contrato financeiro: `valorae-financial-sync-v2`.
- Ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

A v602 reorganiza a feature Configurações e promove o tone de notificações internas para `ui.shared`. O Proxy não recebe alteração funcional: endpoints, payloads, SQL, autenticação, idempotência, tombstones, conflitos e política de retry permanecem inalterados.

## Janela

- Mínimo suportado: `2026.07.30.01`.
- Pareado e máximo homologado: `2026.08.06.16`.
