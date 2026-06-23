# Valorae Proxy v109 — Release, testes e sync de proventos

Pacote pronto para Vercel/AI Studio, com arquivos na raiz.

- Core: `21.12.0`
- Patch: `21.12.157-release-tests-sync-hardening-v109`

Principais mudanças do v109:

- Release pública, metadata, PWA, service worker e auditoria de versão sincronizados em `21.12.157`.
- Testes do contrato da página Análise restaurados sem voltar a contratos antigos.
- Sync de proventos preserva Data COM explícita, Data EX, COM estimada e fonte da elegibilidade no payload cloud-first.
- `.env.example` do APK passa a usar placeholders para Supabase e versão cliente atualizada.

Histórico anterior mantido:

- `/api/sync` confirma uso de `valorae_transactions`, `valorae_dividend_events`, `valorae_user_snapshots`, `valorae_sync_clients` e `valorae_sync_backups`.
- Escritas confirmadas de Histórico, snapshots e proventos agora são espelhadas em `valorae_sync_backups`.
- Novas actions: `upsert_sync_backup` e `get_sync_backups`.
- Diagnóstico passa a testar também a tabela de backups.
- Incluído SQL `supabase/003_valorae_cloud_primary_tables_v88.sql` para preparar/ajustar todas as tabelas de nuvem.

## Checkpoint v103 — Comparação decision metadata

Patch interno: `21.12.153-analysis-comparison-decision-v103`.

- `/api/v1/assets?peerOf=...` agora sinaliza `comparisonMode`, `comparisonConfidence`, `peerQuality` e `comparisonContract` para apoiar o modal de Comparação do APK.
- Normalização de peerGroup revisada para evitar mistura entre bancos, seguradoras, infraestrutura de mercado e segmentos de FIIs.
- Teste `analysis-comparison-decision-v103.test.js` cobre pares fortes e pares apenas informativos.

