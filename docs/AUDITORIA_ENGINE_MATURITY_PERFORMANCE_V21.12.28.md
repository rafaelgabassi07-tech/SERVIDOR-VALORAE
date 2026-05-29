# Auditoria v21.12.28 — Engine Maturity Performance Suite

Esta rodada amadurece o ecossistema VALORAE Engine para uso pessoal e pessoas próximas, sem adicionar recursos pagos.

## Implementações principais

- `assetIndicatorCoverage`: matriz de indicadores por classe de ativo.
- `engineMaturityBooster`: auditoria de performance, precisão, confiabilidade e appSync.
- Cache LRU no normalizador numérico central.
- Endpoints novos: `/api/v1/asset/indicators`, `/api/v1/fii/indicators`, `/api/v1/engine/maturity`.
- Monitor com páginas dedicadas para maturidade, performance e taxonomia.

## Benefícios práticos

- O app sabe quais campos críticos ainda faltam antes de renderizar páginas detalhadas.
- O monitor consegue mostrar a maturidade real dos payloads que saem do proxy.
- A normalização de números brasileiros fica mais rápida em payloads repetitivos.
- A integração Web/APK continua simples com `view=app`.

## Compatibilidade

- Mantido `VALORAE_ENGINE_VERSION = 21.12.0`.
- Mantido `lib/Valorae-engine.js` como núcleo central.
- Sem banco, Redis, KV, WebSocket ou dependências pagas.

## Validação recomendada

```bash
npm run check
node test/engine-performance-maturity-v21-12-28.test.js
npm test
npm run build
npm run smoke
npm run audit:free
npm run audit:version
```
