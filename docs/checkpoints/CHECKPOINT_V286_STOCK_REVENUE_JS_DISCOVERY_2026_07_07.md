# Checkpoint v286 — Receita de ações por descoberta JS/API

## Objetivo
Auditar a origem dos gráficos de Regiões e Negócios do Investidor10 para ações, cobrindo o caso em que o HTML público mostra apenas títulos/anos e os valores reais vêm de payloads dinâmicos.

## Alterações Proxy
- Contrato de ação atualizado para `26.asset-modal.stock.v53`.
- Descoberta de scripts/bundles JS do Investidor10 a partir do HTML da página.
- Varredura de URLs `/api/` relacionadas a receita, região/geografia/localidade e negócio/segmento/produto dentro do HTML e dos scripts.
- Resolução de templates com `companyId`, `tickerId`, `ticker`, `symbol`, `slug` e interpolação JS.
- Novos diagnósticos `stockRevenueJsDiscovery` e `stockRevenueJsBundle`.
- Aliases ampliados para `nomeRegiao`, `percentualReceita`, `valorReceita`, `nomeProduto`, `receitaPercentual`, `receitaValor` e variações.

## Validação
- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-revenue-js-discovery-v286.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
