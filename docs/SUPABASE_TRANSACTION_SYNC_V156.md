# Proxy v156 — Correção de sincronização de transações

release: 21.12.186-supabase-transaction-sync-v156

## O que mudou

- O endpoint `/api/sync` ficou mais tolerante ao salvar lançamentos da Carteira.
- Quando o Supabase não aceita o upsert principal por `client_tx_id`, o Proxy tenta um modo compatível para concluir o salvamento.
- A normalização de tickers no envio de transações foi alinhada ao escopo de substituição do Histórico.

## Validação

- `node --check routes/sync.js` executado com sucesso.
- Alterações focadas no fluxo `replace_transactions_for_symbols` e `upsert_transactions`.
