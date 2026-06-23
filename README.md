# Valorae Proxy v115 — Contrato APK+Proxy endurecido

Pacote pronto para Vercel/AI Studio, com arquivos na raiz.

- Core: `21.12.0`
- Patch: `21.12.159-apk-proxy-contract-hardening-v115`

Principais mudanças do v115:

- Release pública, metadata, PWA, service worker e auditoria de versão sincronizados em `21.12.159`.
- Contratos existentes de Análise, sugestões setoriais e comparadores preservados para o APK v114.
- Compatibilidade mantida com `/api/v1/analysis` e `/api/v1/assets?peerOf=...`, usados pela página de Análise e pelo modal de Comparação.
- Nenhum fallback simulado foi adicionado para índices, pares ou cotações; o APK apenas reorganiza e exibe os dados reais com mais robustez.

Histórico anterior mantido:

- `/api/sync` confirma uso de `valorae_transactions`, `valorae_dividend_events`, `valorae_user_snapshots`, `valorae_sync_clients` e `valorae_sync_backups`.
- Escritas confirmadas de Histórico, snapshots e proventos são espelhadas em `valorae_sync_backups`.
- Actions: `upsert_sync_backup` e `get_sync_backups`.
- Diagnóstico testa também a tabela de backups.
- SQL `supabase/003_valorae_cloud_primary_tables_v88.sql` prepara/ajusta tabelas de nuvem.

## Checkpoint v103 — Comparação decision metadata

Patch interno: `21.12.153-analysis-comparison-decision-v103`.

- `/api/v1/assets?peerOf=...` sinaliza `comparisonMode`, `comparisonConfidence`, `peerQuality` e `comparisonContract` para apoiar o modal de Comparação do APK.
- Normalização de peerGroup evita mistura entre bancos, seguradoras, infraestrutura de mercado e segmentos de FIIs.
- Teste `analysis-comparison-decision-v103.test.js` cobre pares fortes e pares apenas informativos.
