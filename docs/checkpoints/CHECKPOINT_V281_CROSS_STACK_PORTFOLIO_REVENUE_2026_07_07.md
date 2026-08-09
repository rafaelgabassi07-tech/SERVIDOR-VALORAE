# Proxy v281 — Revisão cruzada APK + Proxy: carteira, cotações, logotipos e receitas

Data: 2026-07-07  
Patch: `21.12.310-cross-stack-portfolio-revenue-v281`

## Escopo

Este checkpoint revisa as solicitações abertas a partir do bloco de 12h47 tratando APK e Proxy juntos. O objetivo foi deixar o Proxy responsável por entregar contratos mais estáveis, em vez de depender apenas de tolerância no parser do APK.

## Alterações no Proxy

- `lib/portfolio/history.js` preserva `currentPrice` nas posições normalizadas.
- O histórico da carteira ancora o último ponto com o valor calculado a partir da cotação atual recebida pelo APK.
- Quando o histórico remoto não retorna pontos suficientes, o Proxy devolve uma série fallback baseada em valor aplicado e valor atual, evitando gráfico vazio.
- A resposta informa `remotePointCount` e `fallbackUsed` para diagnóstico controlado.
- O contrato do modal de ação expõe aliases canônicos `stockRevenueByRegion` e `stockRevenueByBusiness`, além de `revenueByRegion` e `revenueByBusiness`, reduzindo divergência entre Proxy e APK.

## Validação

- `node --check lib/portfolio/history.js`
- `node --check lib/analysis/stock-modal-contract.js`
- Testes adicionados:
  - `test/portfolio-history-current-price-v281.test.js`
  - `test/stock-revenue-contract-aliases-v281.test.js`
