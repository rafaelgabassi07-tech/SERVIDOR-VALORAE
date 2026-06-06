# RELATÓRIO — Revisão final dos gráficos Investidor10 · VALORAE Proxy v21.12.62

## Objetivo
Revisar o fluxo de captura dos gráficos reais do Investidor10 para ações e FIIs e reforçar o contrato consumido pelo APK VALORAE.

## Arquivos principais alterados
- `lib/market/investidor10-chart-extractor.js`
- `lib/Valorae-engine.js`

## Correções aplicadas
1. Mantido o extrator canônico de gráficos do Investidor10.
2. Adicionado `financial.equityEvolution` separado de `financial.balanceSheet`.
3. `financial.balanceSheet` permanece dedicado ao gráfico **Balanço Patrimonial: Ativo / PL / Passivo**.
4. `financial.equityEvolution` passa a alimentar o gráfico **Evolução Patrimonial**.
5. O `Valorae-engine.js` agora encaminha `equityEvolution/evolucaoPatrimonio` separadamente de `balanceSheet/balancoPatrimonial`.
6. O manifesto `assetChartsCoverage` foi reforçado com listas diretas:
   - `requiredCaptured`
   - `requiredMissing`
   - `notApplicable`
   - `warnings`
7. Nenhum fallback sintético foi adicionado. O Proxy continua marcando lacunas em cobertura quando não encontra série real suficiente.

## Contrato reforçado
O Proxy deve continuar entregando:

```text
assetChartsCanonical
assetChartsCoverage
```

Com blocos principais:

```text
profitability.nominal
profitability.real
indexComparison
commodityComparison
financial.revenueProfit
financial.profitVsQuote
financial.equityEvolution
financial.balanceSheet
financial.payoutHistory
dividends
fii.distribution12m
fii.dividendYieldHistory
fii.peerComparison
fii.fundamentalIndicatorHistory
fii.physicalAssets
```

## Validação executada

```text
npm run check
Checked 289 JS files
```

```text
VALORAE_TEST_TIMEOUT_MS=20000 npm test
VALORAE test runner: 90 arquivos executados; falhas=0; lentos=nenhum
```

## Observação
A versão interna de release foi mantida em `21.12.62-valorae-i10-complete-asset-charts` porque a suíte de testes do projeto valida explicitamente esse identificador de release.
