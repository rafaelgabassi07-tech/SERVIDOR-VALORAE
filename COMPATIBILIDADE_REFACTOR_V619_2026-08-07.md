# Compatibilidade APK–Proxy — v619 / 2026-08-07

- Proxy público: `21.12.404`
- Core: `21.12.0`
- APK pareado/máximo homologado: `2026.08.07.10`
- APK mínimo: `2026.07.30.01`
- primeira versão futura não homologada: `2026.08.07.11`
- protocolo móvel: `2026.07.10.10`
- contrato: `valorae-mobile-portfolio-sync`
- sync financeiro: `valorae-financial-sync-v2`
- rota canônica de sincronização: `/api/sync`

O CP18 não altera `api/`, `routes/`, payloads, SQL financeiro ou protocolo. A página pública foi alinhada ao par atual e o audit de consistência passou a verificar APK, contrato e rota canônica.
