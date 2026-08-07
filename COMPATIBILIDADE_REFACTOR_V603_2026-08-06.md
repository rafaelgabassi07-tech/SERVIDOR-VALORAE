# Compatibilidade da refatoração v603 — CP6.6 Carteira

## Par homologado

- APK: `2026.08.06.17` — checkpoint `v603-refactor-cp6-portfolio`.
- Proxy: `21.12.404` — patch `21.12.404-account-profile-v413`.
- Protocolo móvel: `2026.07.10.10`.
- Contrato financeiro: `valorae-financial-sync-v2`.
- Ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

A v603 reorganiza o shell, a Home, Ativos, Histórico, Dashboard, Patrimônio, Retorno e proventos entre `app.portfolio`, `feature.portfolio` e componentes compartilhados. O Proxy não recebe alteração funcional: endpoints, payloads, SQL, autenticação, idempotência, tombstones, conflitos e política de retry permanecem inalterados.

Os testes cross-stack foram atualizados apenas para inspecionar os caminhos físicos reais da v603. Nenhum campo, rota ou critério financeiro foi relaxado.

## Janela

- Mínimo suportado: `2026.07.30.01`.
- Pareado e máximo homologado: `2026.08.06.17`.
- Primeira versão futura não homologada: `2026.08.06.18`.
