# Correção da sincronização de proventos — 2026-07-25

O endpoint `upsert_dividend_events` continua usando a RPC `valorae_sync_upsert_dividends`.

A validação foi ajustada para aceitar eventos oficiais que possuam ticker e pelo menos uma data conhecida, mesmo quando a fonte ainda não publicou valor por cota ou montante estimado. Previsões locais continuam bloqueadas.

A resposta agora separa:

- `acceptedCount`;
- `ignoredLocalProjections`;
- `ignoredInvalid`.

Nenhuma variável adicional de ambiente é necessária.
