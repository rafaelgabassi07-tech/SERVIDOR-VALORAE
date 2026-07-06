# VALORAE Proxy — stock historical indicators layout v258

Core: `21.12.0`
Patch: `21.12.287-stock-historical-indicators-layout-v258`
Contrato de ação: `26.asset-modal.stock.v39`

Correção pareada do **Histórico de Indicadores Fundamentalistas** do modal de ação.

## Ajustes principais

- Remove `description`, `descrição`, `help`, `tooltip`, notas e outros metadados da grade histórica.
- Mantém como colunas somente `Atual` e anos válidos, evitando que textos de apoio apareçam dentro da tabela.
- Quando o REST do Investidor10 entrega uma tabela longa, cria automaticamente tabelas `5y` e `10y` com anos ordenados.
- Mantém política sem fallback PETR4/GGRC11, sem mock e sem dado simulado.

## Validação

- `node --check lib/analysis/stock-modal-contract.js`
- `node test/stock-modal-historical-indicators-rest-i10-v256.test.js`
- `npm test`
- `npm run audit:version`
- `unzip -t` do ZIP final
