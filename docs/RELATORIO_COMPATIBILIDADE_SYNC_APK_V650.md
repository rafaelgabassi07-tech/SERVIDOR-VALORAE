# Proxy 21.12.404 — compatibilidade financeira APK v650

APK pareado: `2026.08.09.13`.

## Alteração
- `pairedVersion` e `maxTestedVersion` avançam para `2026.08.09.13`.
- `minSupportedVersion` permanece inalterada.
- `valorae-financial-sync-v2`, `download_financial_data`, `upload_transactions` e `upload_dividends` permanecem inalterados.

## Objetivo
Impedir que o APK v650 receba `APK_VERSION_NOT_TESTED` ao executar `Sincronizar agora`, preservando a restauração de transações e dividendos do Supabase.

## Teste dirigido
`test/apk-v650-financial-sync-compatibility.test.js` chama `/api/v1/sync` com `x-valorae-app-version: 2026.08.09.13` e falha caso a rota responda `426` ou `APK_VERSION_NOT_TESTED`.
