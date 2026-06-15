# VALORAE Proxy — Patch de análise de ativos e sugestões

Data: 2026-06-15  
Patch interno: `21.12.95-analysis-assets-suggestions`

## Objetivo

Preparar o Proxy para alimentar a página **Análise** do APK com sugestões inteligentes de ticker e dados consumíveis pelo app sem simular informação de mercado.

## Alterações principais

- A rota `/assets` aceita `q`, `search` ou `query` para busca parcial por ticker.
- Prefixos como `BBA` agora retornam sugestões, por exemplo `BBAS3`, sem tentar buscar cotação inexistente.
- Sugestões retornam `price: null` e `variationPercent: null` quando não houve consulta real, evitando ticker falso ou preço simulado.
- Tickers completos continuam seguindo o fluxo real de busca pelo motor do Proxy.
- Foi adicionado teste em `test/routes-audit.test.js` para garantir que `/assets?q=BBA` retorna sugestões.

## Contrato esperado para o APK

A página Análise consome:

- `/api/v1/assets?q=<prefixo>` para sugestões;
- `/api/v1/asset?symbol=<ticker>&view=app` para detalhes do ativo.

O APK foi preparado para ler campos de `appPayload` e `appMobileSnapshot`, incluindo quote, métricas, gráficos, proventos, descrição e status de fonte.

## Validação

- `node --check routes/assets.js` passou.
- `node --check scripts/audit-version.js` passou.
- `node test/routes-audit.test.js` passou.
