# 2026-06-18 — Checkpoint v82 — Comparação setorial com compatibilidade explícita

- `/api/v1/assets` aceita `peerOf`, `sameSectorOf`, `baseTicker` e `compareWith` para o comparador da página Análise.
- Quando `peerOf` é enviado, a rota retorna apenas sugestões com o mesmo `peerGroup` do ativo-base.
- Quando `compareWith` também é enviado, a resposta inclui `compatibility` com `samePeerGroup`, `baseKnown`, `targetKnown`, `base`, `target` e mensagem legível.
- Respostas setoriais usam `searchPolicy=analysis_same_sector_suggestions_v83` e `strictSameSector=true`.
- O contrato não simula preço, variação ou recomendação; ele só fornece metadados para orientar a comparação visual no APK.

## 2026-06-16 — Checkpoint 30 — DRE, Balanço e Fluxo de Caixa

- `/api/v1/analysis` mantém `AnalysisPageResponse` (`26.analysis.v2`).
- A seção `financial_statements` passa a normalizar demonstrativos reais: DRE, Balanço e Fluxo de Caixa.
- DRE cobre Receita líquida, Lucro bruto, EBIT, EBITDA e Lucro líquido.
- Balanço cobre Ativos, Passivos, Patrimônio líquido, Dívida bruta, Dívida líquida e Caixa.
- Fluxo de Caixa cobre Fluxo operacional, Fluxo de investimento e Fluxo de financiamento.
- A seção envia `items[]` para tabela e `charts[]` apenas quando há séries numéricas reais com pelo menos dois períodos.
- Não há HTML, iframe, imagem externa, índice ou valor simulado.
- Patch: `21.12.110-analysis-financial-statements-v30`.


## 2026-06-16 — Checkpoint 29 — Histórico de Indicadores completo

- `/api/v1/analysis` mantém `AnalysisPageResponse` (`26.analysis.v2`).
- `historical_indicators` passa a normalizar históricos reais de Ações e FIIs em tabela e gráficos estruturados.
- Ações: P/L, P/VP, DY, ROE, ROIC, margens, dívida, liquidez e crescimento de receita/lucro.
- FIIs: P/VP, DY, vacância, valor patrimonial por cota, rendimento por cota, cotistas e liquidez.
- Gráficos históricos só são emitidos com dois ou mais pontos reais. Sem HTML, iframe, WebView, imagem externa ou simulação.

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


## Contrato Supabase Sync

A sincronização opcional com Supabase fica na rota única:

```text
/api/sync
```

Ações aceitas:

```text
health
diagnostics
auth_check
register_client
upsert_snapshot
get_snapshot
upsert_snapshots
get_snapshots
upsert_transactions
replace_transactions_for_symbols
get_transactions
upsert_dividend_events
get_dividend_events
delete_user_data
```

Teste de configuração:

```text
GET /api/sync?action=health
```

Teste de funcionamento real com Supabase:

```text
GET /api/sync?action=diagnostics
```

`diagnostics` tenta acessar as tabelas configuradas e retorna `ok: true` somente quando URL, chave e tabelas estão acessíveis.

Validação da sessão usada pelo APK antes de enviar pendências locais:

```text
GET /api/sync?action=auth_check
Authorization: Bearer <access_token_supabase>
```

`auth_check` retorna `authenticated: true` quando o token do APK pertence ao mesmo projeto Supabase configurado no Proxy. Se retornar `SUPABASE_BEARER_INVALID`, o APK e o Proxy provavelmente estão apontando para projetos Supabase diferentes ou a sessão expirou e o usuário precisa entrar novamente.


O endpoint `diagnostics` agora também publica a lista `capabilities` no topo da resposta e dentro de `supabase.capabilities`. Isso permite que o APK diferencie “tabelas Supabase acessíveis” de “contrato /api/sync incompleto”.

Para snapshots, o Proxy aceita modo individual e em lote:

```text
upsert_snapshot / get_snapshot
upsert_snapshots / get_snapshots
```

O modo em lote é o contrato preferido pelo APK para reduzir chamadas repetidas ao abrir telas.


Headers aceitos pelo Android/APK para sincronização local:

```text
Authorization
X-Valorae-User-Id
X-Valorae-Device-Id
X-Valorae-Client-Secret
X-Valorae-Sync-Token
```

O Proxy não envia a service role key para o APK. A chave fica apenas no ambiente do Vercel.


### replace_transactions_for_symbols

Substitui o Histórico remoto somente dos tickers enviados em `symbols`. Use depois de edição, exclusão, restauração ou reimportação no APK para manter a tabela `valorae_transactions` consistente com o Room local sem apagar outros ativos do usuário.


## Snapshot schema v85

Se o Supabase retornar `Could not find the cache_scope column`, execute `supabase/002_valorae_snapshot_cache_columns_v85.sql`. O Proxy v85 também possui fallback de compatibilidade para não bloquear a fila offline-first enquanto a migração não é aplicada.


## Snapshot timestamp normalization v86

O Proxy normaliza `expires_at`, `source_updated_at` e `updated_at` recebidos como ISO, Unix segundos, Unix milissegundos ou data brasileira simples antes de gravar em campos `timestamptz` do Supabase. Isso corrige erros como `date/time field value out of range: "1781844563444"`.
