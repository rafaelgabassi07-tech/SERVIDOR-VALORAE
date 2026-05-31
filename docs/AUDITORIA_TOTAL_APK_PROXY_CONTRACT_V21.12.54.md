# Auditoria total APK/Proxy — VALORAE Proxy v21.12.54

Data: 2026-05-30

## Objetivo

Garantir que o APK VALORAE receba os dados oficiais do VALORAE Proxy sem perda de informações quando o Proxy entregar `appPayload` e `appMobileSnapshot` como raízes principais do contrato `view=app`.

## Correções aplicadas

- `view=app` agora mantém `appPayload` e `appMobileSnapshot` como contrato oficial do app.
- O Proxy também espelha, de forma segura, `normalized` e `results` para compatibilidade com parsers Android existentes.
- Adicionados aliases Android para preço, variação, DY, P/VP, P/L, ROE, ROIC, margens, liquidez, patrimônio líquido, valor patrimonial por cota, cotistas, cotas emitidas, vacância e dividendos.
- `legacyAppCompat` declara explicitamente as raízes espelhadas para auditoria e diagnóstico.
- `payloadViewProfile` informa que `results` bruto continua removido do contrato público, mas `results` compatível foi espelhado para o APK.
- `metadata.json`, Monitor, manifesto PWA, readiness, integração e métricas foram sincronizados para `21.12.54-total-apk-proxy-contract`.
- Removidos artefatos de build/teste indevidos no topo do Proxy, incluindo arquivos Gradle, scripts soltos e restos de patch, preservando compatibilidade com Vercel Free.
- Adicionado teste regressivo `test/apk-total-contract-v21-12-54.test.js`.

## Validações executadas

- `node scripts/audit-route-contract.js`
- `node scripts/preflight-free-only.js`
- `node scripts/typecheck-free.js`
- `node test/launch-hardening-v21-12-25.test.js`
- `node test/apk-total-contract-v21-12-54.test.js`
- `node test/full-project-audit-v21-12-39.test.js`
- Suite histórica do Proxy executada em grupos; os grupos até `v21.12.33` e os grupos finais `v21.12.35` até `v21.12.54` passaram. A execução monolítica `npm test` no ambiente atual ficou presa/expirou após `personal-launch-polish-v21-12-33`, mas os testes seguintes passaram quando executados em bloco separado.

## Observação

O arquivo central `lib/Valorae-engine.js` não foi desmembrado.
