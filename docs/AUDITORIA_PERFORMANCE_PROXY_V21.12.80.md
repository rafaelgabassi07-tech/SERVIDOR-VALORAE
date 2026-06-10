# VALORAE Proxy v21.12.80 — Auditoria de desempenho e estabilidade mobile

## Objetivo
Reduzir latência percebida pelo APK e impedir que rotas pesadas bloqueiem a experiência do usuário.

## Gargalos encontrados
1. `/portfolio/dividends` executava fundamentos e agenda em sequência, aumentando o tempo total.
2. `/portfolio/analyze` não tinha deadline global próprio.
3. `/assets` precisava manter contrato de resposta parcial dentro do orçamento mobile.
4. O APK precisava receber partial/stale rápido, não aguardar captura completa.

## Correções aplicadas
- `/portfolio/dividends` roda batch de ativos e agenda em paralelo.
- `/portfolio/analyze` ganhou `withRouteDeadline`.
- Rotas críticas retornam payload parcial em vez de deixar o APK preso.
- Mantido cache-control stale-while-revalidate nas rotas móveis.
- Mantida limpeza de previsões locais na sincronização de dividendos.

## Resultado esperado
- Menor tempo em carteiras com muitos ativos.
- Melhor resposta da Agenda de Dividendos.
- Insights menos dependente de rotas completas.
- Menor risco de timeout visual no app.

## Validação
- `npm run check`: OK.
- `npm run build`: OK.
