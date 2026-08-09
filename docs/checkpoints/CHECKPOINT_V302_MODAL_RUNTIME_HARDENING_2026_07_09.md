# Proxy v302 — Hardening dos modais progressivos

## Resultado
Proxy v302 aprofunda a auditoria APK+Proxy: o fast stage deixa de executar blocos pesados, o runtime reaproveita full cacheado quando seguro e novos testes impedem regressão de timeout/cache.

## Alterações
- Runtime reaproveita cache full válido quando a UI pede fast equivalente.
- Stock fast stage evita canonical/parsers pesados e deixa histórico, receitas, posição acionária, comunicados e gráficos financeiros para full.
- FII fast stage deixa histórico, vacância e comunicados para full.
- Teste `asset-modal-runtime-hardening-v302.test.js` cobre a regressão.

## Validação
- npm test: 174 arquivos, 0 falhas.
- npm run verify.
