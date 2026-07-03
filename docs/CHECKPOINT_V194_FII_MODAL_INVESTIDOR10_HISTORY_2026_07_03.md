# Checkpoint v194 — Histórico de indicadores Investidor10 no modal único de FIIs

- `/api/v1/asset/fii-modal` evolui para `26.asset-modal.fii.v3`.
- O modal único passa a usar o Investidor10 como fonte dos cards rápidos, rentabilidade, informações cadastrais e histórico de indicadores fundamentalistas dos FIIs.
- `historicalIndicators` adiciona colunas, linhas e valores para renderização da tabela mobile: Valor de Mercado, P/VP, Dividend Yield, Liquidez Diária, Valor Patrimonial, Val. Patrimonial p/ Cota, Vacância, Número de Cotistas e Cotas Emitidas quando a fonte retornar.
- StatusInvest, Fundamentus e fallback legado seguem bloqueados no modal único.
- A cotação em tempo real segue isolada em Yahoo conforme etapa anterior, sem alimentar fundamentos.
