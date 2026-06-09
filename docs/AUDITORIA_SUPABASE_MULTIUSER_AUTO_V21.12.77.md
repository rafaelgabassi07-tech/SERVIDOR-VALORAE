# VALORAE Proxy 21.12.77 — Supabase multiusuário automático

## Objetivo
Permitir que o APK distribuído sincronize snapshots no Supabase sem distribuir um token global para usuários finais.

## Alterações principais
- `/api/sync` agora suporta `register_client`.
- O Proxy cria/atualiza registros em `valorae_sync_clients`.
- Cada cliente é validado por `user_id + client_secret` enviado pelo APK via HTTPS.
- O Proxy armazena apenas `client_secret_hash`, nunca o segredo bruto.
- `upsert_snapshot` e `get_snapshot` validam o cliente e forçam isolamento por `user_id`.
- `delete_user_data` foi adicionado para remoção futura de dados do usuário.
- `VALORAE_SUPABASE_SYNC_TOKEN` virou modo legado/opcional para testes técnicos, não requisito de usuário final.

## Variáveis necessárias no Vercel do Proxy
```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SECRETA_DO_SUPABASE
VALORAE_SUPABASE_SNAPSHOT_TABLE=valorae_user_snapshots
VALORAE_SUPABASE_CLIENTS_TABLE=valorae_sync_clients
```

Opcional:
```env
VALORAE_SUPABASE_CLIENT_SECRET_PEPPER=string-longa-opcional
VALORAE_RATE_LIMIT_SYNC_MAX=60
```

## SQL
Atualizado `supabase/001_valorae_snapshots.sql` para criar:
- `valorae_sync_clients`;
- `valorae_user_snapshots`;
- índices;
- RLS ativo sem políticas públicas.

## Compatibilidade
- Mantém `health`, `upsert_snapshot` e `get_snapshot`.
- Adiciona `register_client` e `delete_user_data`.
- Compatível com plano gratuito desde que o volume de snapshots seja controlado.
