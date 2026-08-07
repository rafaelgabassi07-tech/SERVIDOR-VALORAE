# Compatibilidade da refatoração v607 — 2026-08-06

- APK: `2026.08.06.21` — checkpoint `v607-refactor-cp7-analysis`;
- Proxy: `21.12.404` — patch `21.12.404-account-profile-v413`;
- protocolo móvel: `2026.07.10.10`;
- contrato financeiro: `valorae-financial-sync-v2`;
- máximo homologado: `2026.08.06.21`;
- primeira versão futura não homologada: `2026.08.06.23`.

O CP7.3 altera somente a organização física da feature Análise. Rotas `/api/sync` e `/api/v1/mobile/alerts`, payloads, SQL, idempotência, tombstones, claims, retries e conflitos `409` permanecem inalterados.
