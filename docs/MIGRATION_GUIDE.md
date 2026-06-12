# MIGRATION_GUIDE

## v21.4/v21.5 para v21.12.0

As URLs públicas continuam válidas. Internamente, o projeto usa apenas uma Function física no Vercel:

- `/api` → `api/router.js`
- `/api/*` → `api/router.js`

Handlers que antes ficavam em `api/*.js` agora ficam em `routes/`. Código compartilhado fica em `lib/`.

## Prefixos

- `/api/v1/asset?ticker=PETR4` mantém payload direto.
- `/api/v2/asset?ticker=PETR4` ativa envelope v2.
- Aliases legados como `/api/ativo`, `/api/ativos`, `/api/ranking`, `/api/carteira` continuam roteados internamente.

## Views e profiles

A partir da v21.12.0, os aliases documentados passam a funcionar de verdade:

```text
view=quote|card|wallet|detail|analysis
profile=quote|card|wallet|analysis
```

Eles são mapeados para os modos internos `compact|standard|full` e `fast|standard|deep|portfolio`.

## `/api/sync`

A URL `/api/sync` agora é roteada para o handler real de sincronização Supabase quando as variáveis existem no Vercel.

- `GET /api/sync?action=health` mostra se as variáveis foram detectadas.
- `GET /api/sync?action=diagnostics` testa conexão real com Supabase e tabelas.
- Sem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`, ações de leitura/escrita retornam `SUPABASE_NOT_CONFIGURED`.

O projeto continua sem dependência `@supabase/supabase-js`; a integração usa `fetch` nativo e REST do Supabase para manter a árvore simples no AI Studio.
