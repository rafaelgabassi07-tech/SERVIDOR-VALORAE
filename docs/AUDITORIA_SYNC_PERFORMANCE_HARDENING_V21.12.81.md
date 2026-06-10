# VALORAE Proxy v21.12.81 — Sync e estabilidade

## Foco da rodada

Correção incremental sobre o Proxy v21.12.80, principalmente para robustez de Supabase e estabilidade de configuração em produção.

## Correção aplicada

- `SUPABASE_URL` agora é normalizada no Proxy mesmo quando colada com `/rest/v1`, `/auth/v1`, `/storage/v1` ou `/functions/v1`.
- Isso evita chamadas quebradas como `/rest/v1/rest/v1/tabela` quando a variável é configurada errada na Vercel.
- Patch interno atualizado para `21.12.81-sync-performance-hardening`.

## Observação

As rotas principais de performance já estavam em v21.12.80: deadlines, respostas parciais, dividendos oficiais e análise mobile compacta. Esta rodada reforça a tolerância de configuração e evita erro silencioso de Supabase.
