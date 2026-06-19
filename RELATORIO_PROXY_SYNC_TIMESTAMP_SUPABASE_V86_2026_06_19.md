# Valorae Proxy v86 — normalização de timestamp Supabase

## Problema confirmado

O Supabase recusava snapshots quando `source_updated_at`, `updated_at` ou `expires_at` chegavam como número em milissegundos, exemplo:

`1781844563444`

Campos `timestamptz` esperam ISO UTC ou data reconhecível, não um timestamp gigante em texto.

## Correção no Proxy

- `routes/sync.js` adicionou normalização para ISO UTC.
- Aceita Unix em segundos, Unix em milissegundos, ISO e datas brasileiras simples.
- Normaliza `expires_at`, `source_updated_at` e `updated_at` antes do POST no Supabase.
- Mantém fallback v85 para schema antigo sem colunas de cache.

## Versão

- Core: `21.12.0`
- Patch: `21.12.149-sync-timestamp-normalization-v86`

## Validação

- `node scripts/check-syntax.js` OK.
- `npm test` OK.
- Resultado: 63 arquivos de teste, 0 falhas.
- Novo teste: `supabase-snapshot-timestamp-v86.test.js`.
