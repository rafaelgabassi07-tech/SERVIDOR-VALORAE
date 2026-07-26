# VALORAE — Correção da regressão de restauração do Histórico

Data: 2026-07-26

## Causa

A leitura combinada de transações passou a consultar simultaneamente o UUID atual do Supabase Auth e o e-mail verificado usado por versões antigas do APK. Em instalações onde `valorae_transactions.user_id` é do tipo UUID, a consulta adicional por e-mail é inválida e o PostgREST retorna `22P02`.

O erro da identidade legada derrubava também a consulta válida pelo UUID. O APK recebia a falha em `get_transactions` e mostrava apenas “Não foi possível ler o Histórico salvo na nuvem agora”.

## Correção

- a leitura válida pelo UUID não é mais descartada quando apenas a identidade legada é incompatível;
- contas com `user_id text` continuam combinando UUID e e-mail legado;
- contas com `user_id uuid` ignoram somente o fallback impossível por e-mail;
- o mesmo tratamento defensivo foi aplicado ao fallback de snapshots;
- a resposta informa `legacyIdentitySkipped` e `legacyIdentityError` para diagnóstico;
- teste regressivo reproduz `22P02` no e-mail e confirma restauração pelo UUID.

## Validação

- teste UUID + fallback legado inválido: aprovado;
- teste de conta mista UUID + e-mail: aprovado;
- teste de restauração pós-login: aprovado;
- build Vercel: aprovado;
- sintaxe: 510 arquivos JavaScript;
- suíte: 168 aprovados, 0 falhas, 107 bloqueados por dependências ausentes (`cheerio`/`undici`).
