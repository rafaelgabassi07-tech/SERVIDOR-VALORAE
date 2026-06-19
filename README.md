# Valorae Proxy — Checkpoint v86

Correção crítica do envio de snapshots para Supabase quando `source_updated_at`, `updated_at` ou `expires_at` chegam como timestamp numérico em milissegundos.

## Versão

- Core: `21.12.0`
- Patch: `21.12.149-sync-timestamp-normalization-v86`

## Correções

- Converte valores como `1781844563444` para ISO UTC antes de gravar no Supabase.
- Normaliza segundos Unix, milissegundos Unix, ISO e datas brasileiras simples.
- Mantém fallback v85 para tabela `valorae_user_snapshots` em schema antigo.
- Evita pendência local presa por `date/time field value out of range`.

## Uso

Publique este Proxy v86 no Vercel, atualize o APK v86 e toque em **Tentar enviar agora** no app.
