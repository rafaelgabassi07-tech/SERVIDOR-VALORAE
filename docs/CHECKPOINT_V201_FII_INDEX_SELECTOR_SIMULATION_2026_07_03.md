# Checkpoint v201 — Seletores e simulação na comparação com índices

## Escopo
- Endpoint `/api/v1/asset/fii-modal`.
- Contrato `26.asset-modal.fii.v9`.

## Mudanças
- Mantém ativo, IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11 no comparador.
- Adiciona `selectorPolicy` e `defaultSelectedCodes` ao contrato.
- Gera itens de simulação a partir das mesmas séries históricas disponíveis para o gráfico.
- Preserva Yahoo Finance Chart API direto para `IFIX.SA`, `SMLL.SA` e `IDIV.SA`.

## Diagnóstico
`indexQuotes` representa snapshot diário. A frase “Se você tivesse investido R$ 1.000,00” depende de histórico acumulado por período. A correção evita confundir essas camadas e alinha os cards aos seletores do APK.
