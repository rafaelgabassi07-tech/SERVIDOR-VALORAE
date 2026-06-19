# RELATÓRIO — Proxy v78

- Data: 2026-06-18
- Patch: `21.12.143-apk-proxy-sync-contract-v78`

## Mudança principal

Adicionado suporte a `POST /api/sync?action=replace_transactions_for_symbols` para sincronização fiel do Histórico do APK.

A ação recebe `symbols` e `transactions`, remove do Supabase apenas as transações dos tickers informados e regrava as transações atuais desses mesmos tickers. Isso mantém o Supabase consistente quando o usuário edita, exclui, reimporta ou reclassifica operações no APK.

## Validação

- `node scripts/check-syntax.js`: OK.
- `npm test`: 57 arquivos de teste, 0 falhas.
- Novo teste: `test/supabase-replace-transactions-v78.test.js`.
