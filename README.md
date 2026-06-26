# Valorae Proxy v122 — sincronizado com onboarding cinematográfico

Pacote pronto para Vercel/AI Studio, com arquivos diretamente na raiz.

- Core: `21.12.0`
- Patch: `21.12.175-br-date-final-audit-v145`

## Mudanças desta rodada

- Sincronização de release/metadata com o APK v122.
- Sem alteração funcional de endpoints.
- Relatório único na raiz: `RELATORIO_VALORAE_PROXY.md`.


## Checkpoint v127 — Apresentação vertical 3D

- Patch: `21.12.175-br-date-final-audit-v145`
- Sincronização com APK `2026.06.24.9` / versionCode `26062409`.
- Sem alteração funcional de contrato no Proxy; atualização apenas de release/metadata para manter APK e Proxy alinhados.


## Checkpoint v144 — datas brasileiras de exibição (2026-06-26)
- Proxy: `21.12.175-br-date-final-audit-v145`.
- Adicionados formatBrDate/formatBrDateTime em lib/core/dates.js para campos de exibição.
- Notícias incluem publishedAtDisplay/displayDate em pt-BR, mantendo publishedAt/timestamp para ordenação e cache.
- Itens visíveis da Análise usam DD/MM/AAAA em proventos; sincronização Supabase não teve colunas/tipos alterados.
