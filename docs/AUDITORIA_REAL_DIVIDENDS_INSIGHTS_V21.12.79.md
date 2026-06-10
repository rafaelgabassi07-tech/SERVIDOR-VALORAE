# VALORAE Proxy v21.12.79 — Proventos reais e limpeza de projeções locais

## Correções aplicadas

- `/api/sync` ignora eventos de provento marcados como previsão/estimativa local.
- Ao sincronizar proventos, o Proxy limpa registros locais antigos do usuário antes de gravar dados reais.
- A rota mantém gravação somente para eventos com ticker, data e valor.
- Patch interno atualizado para `21.12.79-real-dividends-insights`.

## Objetivo

Impedir que o Supabase seja contaminado por projeções locais do APK e manter a base de dados com eventos reais vindos do Proxy/fontes externas.
