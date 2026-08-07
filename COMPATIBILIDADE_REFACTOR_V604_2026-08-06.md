# Compatibilidade da refatoração v604 — CP6.7 Componentes compartilhados

## Par homologado

- APK: `2026.08.06.18` — checkpoint `v604-refactor-cp6-shared`.
- Proxy: `21.12.404` — patch `21.12.404-account-profile-v413`.
- Protocolo móvel: `2026.07.10.10`.
- Contrato financeiro: `valorae-financial-sync-v2`.
- Ecossistema: `valorae-ecosystem-2026.08.05.04-p404`.

A v604 elimina o pacote raiz `com.example.ui`, consolida componentes reutilizáveis em `ui.shared`, `ui.shared.asset`, `ui.shared.chart` e `ui.shared.news`, e move os ViewModels remanescentes para a camada de aplicação. O Proxy não recebe alteração funcional: endpoints, payloads, SQL, autenticação, idempotência, tombstones, conflitos e política de retry permanecem inalterados.

Os testes cross-stack foram atualizados apenas quando necessário para inspecionar os caminhos físicos reais da v604. Nenhum campo, rota ou critério financeiro foi relaxado.

## Janela

- Mínimo suportado: `2026.07.30.01`.
- Pareado e máximo homologado: `2026.08.06.18`.
- Primeira versão futura não homologada: `2026.08.06.19`.
