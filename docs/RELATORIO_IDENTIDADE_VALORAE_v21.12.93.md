# Relatório — Identidade e contrato nativo VALORAE Proxy

**Proxy:** VALORAE Proxy v21.12.93
**APK esperado:** VALORAE v2.0.65

## Objetivo

Remover nomes externos do ecossistema, manter a originalidade VALORAE e continuar a simplificação do fluxo APK ↔ Proxy.

## Contrato público

```json
{
  "contract": {
    "name": "valorae-mobile-portfolio-sync",
    "version": "21.12.93",
    "style": "valorae-single-request-cache-first"
  }
}
```

## Correções

- Release pública atualizada para `21.12.93-valorae-native-contract-polish`.
- `routes/portfolio/insights-bundle.js` agora usa estilo nativo `valorae-single-request-cache-first`.
- Service worker, PWA, monitor e metadados públicos alinhados para v21.12.93.
- Removidos relatórios/logs gerados antigos que expunham nomes externos.
- Novos validadores nativos:
  - `scripts/verify-valorae-native-contract-v21-12-93.js`
  - `scripts/smoke-mobile-portfolio-contract-v21-12-93.js`

## Validação esperada

```bash
npm run check
npm test
npm run build
npm run smoke
node scripts/verify-valorae-native-contract-v21-12-93.js
node scripts/smoke-mobile-portfolio-contract-v21-12-93.js
```
