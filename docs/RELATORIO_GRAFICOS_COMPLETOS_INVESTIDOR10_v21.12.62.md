# RELATÓRIO — Gráficos completos Investidor10 · VALORAE Proxy v21.12.62

## Objetivo

Revisar novamente as páginas de ação e FII no Investidor10 e reforçar o Proxy para capturar todos os blocos visíveis de gráficos/informações sem criar dados artificiais.

## Páginas usadas como referência

- Ação: `PETR4` em `/acoes/petr4/`.
- FII: `HGLG11` em `/fiis/hglg11/`.

## Blocos observados em ação

- Cotação/histórico de preço.
- Rentabilidade nominal por período.
- Rentabilidade real por período.
- Histórico de indicadores.
- Comparação com índices.
- Comparação com commodity/setor, quando presente, como Petróleo Brent.
- Informações sobre a empresa.
- Regiões/negócios que geram receita.
- Receitas e Lucros.
- Lucro x Cotação.
- Resultados/demonstrativos.
- Evolução do Patrimônio.
- Balanço Patrimonial.
- Payout histórico.
- Dividendos/proventos.

## Blocos observados em FII

- Cotação/histórico de preço.
- Rentabilidade nominal por período.
- Rentabilidade real por período.
- Informações do fundo.
- Histórico de indicadores fundamentalistas.
- Comparação com índices.
- Comparação com outros FIIs, quando presente.
- Distribuições nos últimos 12 meses.
- Dividend Yield histórico.
- Histórico de dividendos/distribuições.
- Informações adicionais do fundo.
- Lista/distribuição de imóveis/ativos, quando disponível.

## Correções no Proxy

- `lib/market/investidor10-chart-extractor.js` reforçado.
- Novo contrato canônico `assetChartsCanonical` ampliado.
- Novo manifesto de cobertura `assetChartsCoverage` com status por bloco:
  - `captured`;
  - `visible_without_series_yet`;
  - `not_visible_for_asset`.
- Classificação de payloads internos por papel do gráfico, não apenas por nome de campo.
- Captura adicional para FII:
  - `fii.distribution12m`;
  - `fii.info`;
  - `fii.peerComparison`;
  - `fii.fundamentalIndicatorHistory`;
  - `fii.dividendYieldHistory`;
  - `fii.dividendHistory`;
  - `fii.physicalAssets`.
- Captura adicional para ações:
  - `company.info`;
  - `financial.revenueProfit`;
  - `financial.profitVsQuote`;
  - `financial.balanceSheet`;
  - `financial.payoutHistory`;
  - `indexComparison`;
  - `commodityComparison`.
- O Proxy não inventa séries: quando o bloco existe no HTML mas a API interna não devolve pontos suficientes, o bloco fica marcado em `assetChartsCoverage.requiredMissing`.

## Integração no engine

- `Valorae-engine.js` continua como núcleo central.
- O engine agora expõe os blocos canônicos também em aliases compatíveis com o APK:
  - `sections.assetChartsCanonical`;
  - `sections.assetChartsCoverage`;
  - `sections.comparacaoIndices`;
  - `sections.comparacaoCommodity`;
  - `sections.demonstrativos`;
  - `sections.distribuicoes12m`;
  - `sections.informacoesFundo`;
  - `sections.informacoesEmpresa`;
  - `sections.comparadorFiis`;
  - `sections.dividendYieldHistory`;
  - `sections.listaImoveis`.

## Validação

```bash
npm run check
```

Resultado:

```text
Checked 289 JS files
```

```bash
VALORAE_TEST_TIMEOUT_MS=20000 npm test
```

Resultado:

```text
VALORAE test runner: 90 arquivos executados; falhas=0; lentos=nenhum
```

## Limitação honesta

No ambiente local desta execução não houve DNS/rede para rodar scraping HTTP ao vivo pelo Node. A verificação pública das páginas foi feita via navegador/ferramenta web, e os testes locais validam contrato, sintaxe e normalização com fixtures/payloads.
