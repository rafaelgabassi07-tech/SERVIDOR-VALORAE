# RELATÓRIO — Proxy sync pendências Supabase v84 — 2026-06-19

## Diagnóstico

O Proxy já tinha `/api/sync` para snapshots e operações, mas não existia uma ação leve para o APK confirmar se a sessão Supabase do usuário era aceita pelo mesmo projeto Supabase configurado no Vercel.

Isso dificultava identificar se as pendências locais eram causadas por:

- Proxy sem `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY`.
- APK sem sessão Supabase ativa.
- Token expirado/inválido.
- APK usando um projeto Supabase e Proxy usando outro.

## Correções no Proxy

- Adicionada ação `auth_check` em `/api/sync`.
- `auth_check` retorna `authenticated: true` quando o Bearer do APK é aceito pelo Supabase configurado no Proxy.
- `auth_check` retorna mensagens acionáveis quando falta token, falta configuração ou o token não pertence ao Supabase do Proxy.
- Escritas com Bearer inválido agora retornam `SUPABASE_BEARER_INVALID` em vez de cair em erro genérico de identidade local.
- Capabilities e OpenAPI atualizados com `auth_check`.

## Versão

- Core: `21.12.0`
- Patch: `21.12.147-sync-pending-diagnostics-v84`

## Validação

- `node scripts/check-syntax.js` OK.
- `npm test` OK.
- Resultado: 61 arquivos de teste, 0 falhas.
- Novo teste: `test/supabase-auth-check-v84.test.js`.
