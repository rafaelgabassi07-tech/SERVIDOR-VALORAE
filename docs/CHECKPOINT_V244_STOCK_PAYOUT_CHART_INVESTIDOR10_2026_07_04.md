# Checkpoint v244 — Gráfico de Payout de ações via Investidor10

Data: 2026-07-04
Proxy: `21.12.273-stock-payout-chart-investidor10-v244`
Contrato: `26.asset-modal.stock.v25`
APK pareado: `v363`

## Correção

O gráfico **Payout de ações** do modal único passou a priorizar o payload dedicado do Investidor10 para a seção de Payout, em vez de montar o gráfico apenas por derivação de indicadores históricos e lucro anual.

Campos normalizados por período:

- `netIncome` / **Lucro Líquido**
- `payoutPercent` / **Payout**
- `dividendYieldPercent` / **Dividend Yield**

## Robustez adicionada

O parser agora aceita variações reais de payload usadas em gráficos:

- `series` + `categories` / `xAxis.categories`
- `datasets`
- `rows` / `linhas`
- arrays por período
- objetos por ano/período
- nomes em português e inglês para Lucro Líquido, Payout e Dividend Yield

Também foi corrigida a leitura de números financeiros brutos com separador brasileiro, por exemplo:

- `36.700.000.000` => `36_700_000_000`

## Política de dados

- Sem fallback PETR4.
- Sem fallback GGRC11.
- Sem mock no payload de produção.
- Sem fabricar pontos, anos, Lucro Líquido, Payout ou Dividend Yield.
- Quando a fonte real não entregar dados, o bloco permanece `EMPTY`.

## Testes adicionados

- `test/stock-modal-payout-chart-investidor10-v244.test.js`

Coberturas principais:

- payload `series/categories` com 2022, 2023, 2024, 2025 e Últ 12M;
- `Lucro Líquido` em B;
- `Payout` percentual;
- `Dividend Yield` percentual;
- fallback de preenchimento apenas a partir de outros blocos reais do Investidor10 quando a série dedicada não possuir um campo;
- formato `rows` com `36.700.000.000`.
