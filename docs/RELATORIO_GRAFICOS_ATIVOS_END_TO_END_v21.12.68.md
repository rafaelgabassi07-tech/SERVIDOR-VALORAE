# RELATÓRIO — Gráficos de Ativos End-to-End v21.12.68

## Objetivo
Corrigir o fluxo completo dos gráficos das telas de **Detalhes do Ativo** e **Análise** no VALORAE, com atenção especial às abas:

- **Desempenho & Índices**
- **Finanças & Balanço**
- **Proventos & Payout**
- **Indicadores**
- **Perfil & Dados**

A correção foi tratada como integração ponta-a-ponta: Investidor10 → Proxy → contrato canônico → APK → gráficos/telas.

## Pesquisa usada como referência
As páginas de ativo do Investidor10 não expõem apenas cotação. Elas mostram blocos reais de:

- Rentabilidade nominal e real em 1 mês, 3 meses, 1 ano, 2 anos, 5 anos e 10 anos.
- Comparação com índices.
- Comparação com commodity/setor quando aplicável.
- Indicadores fundamentalistas.
- Histórico de dividendos/proventos.
- Payout.
- Receitas e Lucros.
- Lucro x Cotação.
- Histórico de Balanço.
- Informações patrimoniais.
- Para FIIs: distribuições dos últimos 12 meses, dividend yield, dividendos, lista de imóveis e métricas patrimoniais.

## Problemas encontrados

1. **O app podia renderizar aba vazia mesmo com dados existentes**
   - Muitos gráficos dependiam de um caminho específico do JSON.
   - Quando o Proxy retornava o mesmo dado em outro alias, o APK ignorava.

2. **As APIs internas do Investidor10 nem sempre aparecem igual para todos os ativos**
   - Alguns dados estão em APIs dinâmicas.
   - Alguns aparecem no HTML.
   - Alguns aparecem em JSON embutido.
   - O Proxy precisava procurar em múltiplas fontes, não em uma única rota rígida.

3. **Proventos históricos por ativo tinham problema de agregação**
   - Datas ISO `yyyy-MM-dd` podiam não ser agregadas corretamente pelo APK.
   - Valores longos como `0,35048636` precisavam preservar casas decimais.

4. **A aba Finanças & Balanço escondia gráfico quando uma série faltava**
   - O gráfico de balanço exigia todas as séries completas.
   - Agora aceita pelo menos duas séries reais entre Ativo, Patrimônio Líquido e Passivo.

5. **A aba Desempenho & Índices precisava separar melhor os blocos**
   - Rentabilidade nominal/real.
   - Comparação com índices.
   - Correlação com commodity quando existir.

## Arquivos principais alterados no Proxy

- `lib/market/investidor10-chart-extractor.js`
- `lib/Valorae-engine.js`
- `routes/release/readiness.js`
- `routes/integration/manifest.js`
- `metadata.json`
- `package.json`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `docs/RELATORIO_GRAFICOS_ATIVOS_END_TO_END_v21.12.68.md`

## Correções técnicas no Proxy

### 1. Novo extrator canônico de gráficos
Foi consolidado o módulo:

```text
lib/market/investidor10-chart-extractor.js
```

Ele gera o bloco:

```json
{
  "assetChartsCanonical": {
    "profitability": {},
    "indexComparison": [],
    "commodityComparison": [],
    "dividendHistory": [],
    "dividendMonthly": [],
    "dividendYearly": [],
    "dividendYieldHistory": [],
    "financial": {
      "revenueProfit": [],
      "profitVsQuote": [],
      "equityEvolution": [],
      "balanceSheet": [],
      "payoutHistory": []
    },
    "fii": {},
    "company": {},
    "coverage": {}
  }
}
```

### 2. Desempenho & Índices
O Proxy agora procura:

- `Rentabilidade de TICKER`
- `Rentabilidade Real`
- `COMPARAÇÃO DE TICKER COM ÍNDICES`
- `COMPARANDO ... COM ...`
- APIs internas descobertas no HTML
- séries vindas de `chartsFinanceiros`, `rawJson`, `appPayload`, `appMobileSnapshot`

### 3. Finanças & Balanço
O Proxy agora tenta capturar e normalizar:

- Receitas e Lucros
- Receita Líquida
- Lucro Líquido
- Lucro Bruto
- Custo
- EBITDA
- EBIT
- Lucro x Cotação
- Evolução do Patrimônio
- Balanço Patrimonial
- Ativo Total
- Patrimônio Líquido
- Passivo Total
- Payout histórico

Também adiciona aliases:

```text
receitasLucros / revenueProfit
lucroCotacao / profitVsQuote
evolucaoPatrimonio / equityEvolution
balancoPatrimonial / balanceSheet
payoutHistorico / payoutHistory
```

### 4. Proventos por ativo
Além da agenda geral, o Proxy agora extrai histórico de proventos dentro da página do ativo, quando disponível.

Preserva eventos como:

```text
JSCP 01/06/2026 20/08/2026 0,35048636
Dividendos 29/05/2026 15/06/2026 1,10000000
```

E gera:

- `dividendHistory`
- `dividendMonthly`
- `dividendYearly`
- `dividendYieldHistory`

### 5. Cobertura explícita
O Proxy passa a informar se cada gráfico está:

- `captured`
- `visible_without_series_yet`
- `not_visible_for_asset`

Isso evita que o APK fique “cego”: se uma seção existe no Investidor10 mas não veio com série suficiente, o app recebe aviso em vez de parecer que bugou.

## Contrato preservado
A correção não removeu aliases antigos. O Proxy continua expondo dados nos caminhos legados e também no contrato canônico novo.

## Validações executadas

```bash
node --check lib/market/investidor10-chart-extractor.js
npm test -- --runInBand
```

Resultado:

```text
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Versão

```text
21.12.68-valorae-i10-asset-charts-end-to-end-fix
```

## Observação importante
O Proxy não fabrica gráfico quando não existe série real suficiente. Quando o Investidor10 só mostra imagem/dados dinâmicos sem pontos capturáveis, o Proxy informa cobertura parcial. Isso é intencional para evitar gráfico bonito com dado falso.
