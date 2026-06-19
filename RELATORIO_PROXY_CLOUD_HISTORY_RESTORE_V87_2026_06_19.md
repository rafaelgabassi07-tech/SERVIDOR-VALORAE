# VALORAE Proxy v87 — Histórico em nuvem e compatibilidade transaction_date

Data: 2026-06-19

## Versão

- Core: `21.12.0`
- Patch: `21.12.150-cloud-history-restore-v87`

## Correções aplicadas

- Mantido suporte a `get_transactions`, `upsert_transactions` e `replace_transactions_for_symbols` para o Histórico da Carteira.
- Escrita de transações ganhou fallback para `transaction_date` quando o Supabase estiver com schema legado ou divergente:
  - tenta salvar como `bigint` em milissegundos, conforme SQL atual;
  - se o banco reclamar de campo date/time/timestamptz, reenvia em ISO UTC.
- Resposta de escrita informa `transactionDateMode` quando aplicável.
- `get_transactions` normaliza `importedAt` mesmo quando `transaction_date` vier como ISO.

## Validação

- `node scripts/check-syntax.js` OK.
- `npm test` OK.
- Resultado: 64 arquivos de teste, 0 falhas.
- Novo teste: `test/supabase-cloud-history-v87.test.js`.
