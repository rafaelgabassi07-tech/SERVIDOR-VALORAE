# VALORAE Proxy v21.12.76 — Ponte opcional Supabase

## Objetivo
Adicionar compatibilidade com Supabase sem transformar o Proxy em dependência paga e sem quebrar o modo Vercel/GitHub gratuito.

## Novo comportamento da rota `/api/sync`
A rota antiga estava desativada. Agora ela funciona como ponte segura opcional para o Supabase.

Ações suportadas:

- `GET /api/sync?action=health`
- `POST /api/sync` com `action=upsert_snapshot`
- `GET /api/sync?action=get_snapshot&userId=...&domain=...&snapshotKey=...`

## Variáveis de ambiente

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
VALORAE_SUPABASE_SYNC_TOKEN=token-longo-aleatorio
VALORAE_SUPABASE_SNAPSHOT_TABLE=valorae_user_snapshots
VALORAE_RATE_LIMIT_SYNC_MAX=45
```

## Segurança

- Escritas e leituras via Proxy exigem `x-valorae-sync-token` quando o Supabase está configurado.
- A chave `service_role` fica apenas no backend/Vercel.
- O APK pode usar a ponte sem receber chaves secretas.
- Sem variáveis de Supabase, `/api/sync?action=health` responde com diagnóstico e as operações retornam `SUPABASE_NOT_CONFIGURED`.

## Schema
Incluído em:

```text
supabase/001_valorae_snapshots.sql
```

## Compatibilidade
- Não adiciona dependências npm.
- Usa `fetch` nativo do Node 20.
- Mantém `package.version` como core `21.12.0` e `releasePatch` como `21.12.76-supabase-sync`.
