# 2026-06-14 — Retorno: IFIX, IDIV e SMLL somente via Yahoo

## Objetivo
Atender à regra de fonte única para os índices IFIX, IDIV e SMLL no contrato de Retorno do APK Valorae.

## Correções no Proxy
- IFIX, IDIV e SMLL agora retornam exclusivamente pela Yahoo Finance Chart API.
- Símbolos mantidos:
  - IFIX → `IFIX.SA`
  - IDIV → `IDIV.SA`
  - SMLL → `SMLL.SA`
- O fluxo desses três índices não chama mais B3, Mais Retorno ou Investidor10 como fallback.
- O endpoint de snapshot `/api/v1/market/indices` também evita B3 fallback para IFIX, IDIV e SMLL.
- Quando o Yahoo retorna apenas snapshot, o contrato usa somente `regularMarketPrice` e `chartPreviousClose`/`previousClose` do próprio Yahoo para montar uma comparação mínima, sem ETF, sem proxyTicker e sem fonte externa.

## Validação
- `npm run check`: OK.
- `npm test`: OK, 19 arquivos de teste, 0 falhas.
- Adicionado teste Yahoo-only para garantir que Mais Retorno e Investidor10 não sejam chamados nesses índices.
