# API Contract — VALORAE Proxy Mobile

## Rota compatível com APK

```text
POST /api/scraper
```

Payload mínimo:

```json
{
  "mode": "fundamentos",
  "ticker": "HGLG11"
}
```

Aliases aceitos para ativo:

```text
ticker, symbol, ativo, codigo, code, papel, slug, asset, query, q, url
```

Aliases aceitos para modo `fundamentos`:

```text
fundamentos, asset
```

## Envelope de resposta

A rota compatível mantém o formato esperado pelo APK:

```json
{
  "json": {},
  "_src": "valorae-compat",
  "contract": "..."
}
```

O payload principal sempre fica em `json`.

## Campos principais para tela de ativo

```text
ticker
nome
tipo_ativo
classe_ativo
source_url
cotacao
rentabilidade_chart
comparacao
comparacao_indices
charts_financeiros
historico_indicadores
distribuicoes_12m
dividend_yield_history
dividend_history
imoveis
distribuicao_ativos_fundo
graficos_i10
chart_manifest
chart_fidelity
_coverage
```

## Contrato gráfico canônico

`graficos_i10` é uma lista de gráficos/tabelas/listas visuais extraídas do ativo.

Cada item segue o formato:

```json
{
  "id": "receitas_lucros",
  "title": "Receitas e Lucros",
  "chartType": "bar_line",
  "legacyField": "charts_financeiros.receitas_lucros",
  "renderable": true,
  "dataCount": 5,
  "points": []
}
```

`chart_manifest` é uma versão leve para a UI decidir rapidamente o que renderizar:

```json
{
  "id": "lista_imoveis",
  "title": "Lista de Imóveis",
  "chartType": "property_list_with_abl",
  "legacyField": "imoveis",
  "renderable": true,
  "dataCount": 10,
  "sourceStatus": "captured"
}
```

## Regras de fidelidade

- O Proxy não cria série sintética para preencher gráfico ausente.
- `renderable: false` indica ausência segura de dados renderizáveis.
- `rentabilidade` e `comparacao_indices` são blocos separados.
- `comparacao` representa tabela de pares por ticker.
- `imoveis` representa imóveis físicos.
- `distribuicao_ativos_fundo` representa composição de ativos em FIIs de papel/híbridos.

## Aliases mobile

O Proxy mantém campos em `snake_case` e aliases em `camelCase`:

```text
graficos_i10 -> graficosI10, graficos
chart_manifest -> chartManifest
chart_fidelity -> chartFidelity
charts_financeiros -> chartsFinanceiros
historico_indicadores -> historicoIndicadores
comparacao_indices -> comparacaoIndices
distribuicoes_12m -> distribuicoes12m
dividend_yield_history -> dividendYieldHistory
dividend_history -> dividendHistory
distribuicao_ativos_fundo -> distribuicaoAtivosFundo
```

## Falhas controladas

Quando a origem muda ou um bloco não está disponível, a resposta deve continuar válida para o APK. A UI deve tratar:

```text
chart_manifest[].renderable === false
```

como “dados indisponíveis no momento”.
