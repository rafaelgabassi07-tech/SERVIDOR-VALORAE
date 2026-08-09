# Checkpoint v170 — Auditoria longa e hardening APK+Proxy

Data: 2026-07-02  
Release Proxy: `21.12.200-deep-audit-hardening-v170`  
Compatível com APK: `v284-deep-audit-hardening-proxy`

## Foco

Auditoria extensa de APK + Proxy, procurando melhorias além dos sintomas já reportados. A rodada cobre normalização, sincronização, histórico Yahoo, proventos, higiene de release e testes regressivos.

## Correções aplicadas no Proxy

- Alinhado `canonicalizeTicker` do engine com o normalizador central de tickers.
- Alinhado `canonicalTicker` do Yahoo para não montar símbolos inválidos quando recebe `BVMF:`, `B3:`, `.SA`, `-SA`, `SA` colado ou lote fracionário `F`.
- Normalização de proventos no sync agora afeta `ticker`, `symbol`, payload e `event_key`.
- Removido backup `analysis-page-response.js.bak` do pacote final.
- Build passa a bloquear artefatos temporários/de backup em release.
- Adicionados scripts `check:syntax`, `test`, `audit:version` e `verify`.
- Adicionado teste de regressão `sync-dividend-ticker-normalization-v170.test.js`.

## Validação esperada

- `node scripts/check-syntax.js`
- `npm run build`
- `node scripts/run-tests.js`
- `node scripts/audit-version-consistency.js`
- `node scripts/audit-version.js`
