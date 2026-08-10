# Compatibilidade financeira APK v649

APK pareado: `2026.08.09.12` (v649).

## Causa da falha
A rota `/sync` bloqueia versões acima de `maxTestedVersion`. O Proxy v647 permanecia em `2026.08.09.10`, então o APK v649 era recusado com `426 / APK_VERSION_NOT_TESTED` antes de executar `download_financial_data`.

## Correção
- `pairedVersion`: `2026.08.09.12`;
- `maxTestedVersion`: `2026.08.09.12`;
- `minSupportedVersion` preservada;
- sem alteração em `download_financial_data`, `upload_transactions`, `upload_dividends`, tabelas ou RPCs do Supabase.

## Validação
A v649 passa como `PAIRED`, v647 continua `SUPPORTED` e v650 é rejeitada quando `allowFuture=false`.
