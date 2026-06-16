## 2026-06-16 — 21.12.128-analysis-source-routing-real-only-v44

Patch: `21.12.128-analysis-source-routing-real-only-v44`

- Nova auditoria minuciosa da extração HTML/API usada pela página Análise.
- BOVA11 agora roteia como ETF para caminhos reais `/etfs/`; AAPL34 agora roteia como BDR para caminhos reais `/bdrs/`.
- ETFs deixam de receber/sinalizar seções não aplicáveis de FII ou empresa, evitando falso erro no APK.
- Histórico de payout, histórico de dividend yield e demonstrativos financeiros deixam de aceitar valores derivados sem série/período real.
- Sem dados simulados, inventados ou preenchidos por rótulos artificiais como `P1`, `P2` ou `Atual`.

## 2026-06-16 — 21.12.127-analysis-html-extraction-real-only-v43

Patch: `21.12.127-analysis-html-extraction-real-only-v43`

- Reforçada a extração HTML da rota real `/api/v1/analysis` usada pelo APK.
- Corrigida a leitura de JSON aninhado em scripts do Investidor10, incluindo `datasets` internos de gráficos.
- Adicionada descoberta deduplicada de APIs reais de gráficos presentes no HTML da fonte.
- Bloqueada a criação de DRE, Balanço, Fluxo de Caixa e Lucro x Cotação a partir de indicadores pontuais ou snapshots sem série/tabela real.
- Removidos preenchimentos genéricos de descrição, setor, subsetor e segmento quando a fonte não envia esses campos.
- Adicionados testes regressivos específicos para impedir retorno das falhas.

## 2026-06-16 — 21.12.125-analysis-source-coverage-v41

Patch: `21.12.125-analysis-source-coverage-v41`

- Melhorada a extração de DRE, Balanço e Fluxo de Caixa por vários anos.
- Melhorada a leitura de negócios e regiões de receita a partir de estruturas reais de gráficos.
- Gráficos históricos só são enviados quando há série real suficiente.
- Mantida a política de não simular valores ausentes.

## 2026-06-16 — 21.12.123 — Análise por categorias e gráficos sempre visíveis

Patch: `21.12.123-analysis-clean-categories-visible-charts-v39`

- Extração ampliada para receita por negócio/região.
- Suporte à página Análise limpa, com gráficos sempre visíveis no APK.
- Sem valores sintéticos: quando a fonte não fornece percentual real, o gráfico não é criado.

## 2026-06-16 — 21.12.122 — Revisão estrutural da página Análise

Patch: `21.12.122-analysis-page-rework-v38`

### Objetivo
Corrigir a página Análise para deixar de exibir informações técnicas/cruas ao usuário final e melhorar a fidelidade visual dos gráficos por tipo de dado.

### Mudanças
- Remove contagens técnicas como "pontos" dos itens de gráficos; o contrato passa a entregar período e último valor como leitura útil.
- Gráficos periódicos/discretos, como proventos, DY, payout, receitas/lucros, evolução patrimonial e demonstrativos, passam a ser classificados como barras ou barras agrupadas quando isso melhora a interpretação.
- Cotação histórica permanece em linha por representar evolução contínua.
- Comparadores de índices mantêm séries reais alinhadas e passam a poder gerar um gráfico agrupado "ativo x índices" quando há período comum suficiente.
- Campos financeiros zerados em "Sobre a empresa" deixam de ser tratados como dado válido.
- Seções sem fonte suficiente usam mensagem neutra de usuário final; termos técnicos como Proxy EMPTY não devem vazar para o APK.
- Balanço por período continua bloqueado quando não houver série real com pelo menos dois períodos.

### Regras preservadas
- Sem dado sintético.
- Sem HTML, iframe, WebView ou imagem externa.
- Página Análise segue no contrato `AnalysisPageResponse` em `/api/v1/analysis`.

## 2026-06-16 — 21.12.121 — Checkpoint 37: Auditoria final da Análise

- Revisão final do contrato único `/api/v1/analysis` com `AnalysisPageResponse` e `contractVersion = 26.analysis.v2`.
- Testes adicionados para ticker inexistente, resposta parcial, FIIs completos, comparadores com fonte simulada aninhada e gráficos alinhados por período real.
- Confirmado que gráficos temporais seguem como `line`/`multi_line` e composições seguem como `donut_composition` ou composição percentual.
- Confirmado que `missingSignals` não aponta seções que já têm `items[]` ou `charts[]` reais.
- Validado que o APK mantém busca inteligente por `submittedTicker` e não chama `/api/v1/analysis` a cada letra.
- Novo teste regressivo: `analysis-final-audit-v37.test.js`.

## 2026-06-16 — 21.12.120 — Checkpoint 36: Refinamento visual final da Análise

- A página Análise ganhou mapa visual compacto dos blocos recebidos pelo contrato único.
- Seções longas, como Histórico de Indicadores, Demonstrativos e FIIs completos, agora podem ser recolhidas com prévia curta.
- Cabeçalhos das seções mostram fonte, quantidade de itens e quantidade de gráficos, reduzindo ruído visual.
- Sinalizações foram reduzidas e mantidas discretas para não competir com dados reais.
- A busca inteligente do Checkpoint 35 foi revisada e mantida: `/api/v1/analysis` só carrega após confirmação/toque em sugestão.
- Novo teste regressivo: `analysis-visual-refinement-v36.test.js`.

## 2026-06-16 — 21.12.119 — Checkpoint 35: Busca inteligente da Análise

- `/api/v1/assets` ganhou política `analysis_intelligent_search_v35` para sugestões por ticker, nome e segmento.
- Sugestões retornam sem preço/variação simulados, com `rank`, `match` e fonte `VALORAE_CATALOG`.
- O APK separa sugestões de carregamento: `/api/v1/analysis` só é chamado após confirmação ou toque em sugestão.
- Adicionados últimos pesquisados, favoritos/carteira priorizados, debounce de 360 ms e estado sem resultado.
- Novo teste regressivo: `analysis-intelligent-search-v35.test.js`.

## 2026-06-16 — 21.12.118 — Revisão de fidelidade dos gráficos da Análise

Revisão específica para garantir que os gráficos da página Análise sejam fiéis à fonte e ao tipo de dado recebido.

- Comparadores `multi_line` agora só são montados quando ativo e índice/par têm pelo menos dois períodos reais em comum.
- `Lucro x Cotação` passa a ser classificado como `multi_line`, preservando as duas séries no APK.
- Distribuições de ativos de FIIs rejeitam percentuais inválidos, zerados ou acima de 100%.
- Novo teste `analysis-chart-source-fidelity-v34-review.test.js` cobre fonte explícita, pontos numéricos, alinhamento de períodos e composições.
- Mantido contrato único `/api/v1/analysis`, sem HTML, WebView, iframe, imagem externa ou dado simulado.

## 2026-06-16 — 21.12.117 — Checkpoint 34: FIIs completos na Análise

- Implementada seção `fii_details` no contrato único `/api/v1/analysis` para consolidar dados específicos de FIIs.
- Normalizados cadastro, gestão, rendimentos, P/VP, valor patrimonial, vacância, cotistas, cotas emitidas, imóveis, distribuição de ativos e FIIs relacionados.
- Gráficos específicos de FIIs continuam em linha/composição real, sem retornar a barras temporais.
- Comparadores de FIIs seguem bloqueando séries simuladas e exigindo dados reais alinhados.
- Testes do Proxy passaram com 33 test files e failures=0.

## 2026-06-16 — 21.12.116 — Revisão global dos Checkpoints 27 a 33 da Análise

- Corrigido `npm test` do Proxy para funcionar também quando o pacote Proxy é extraído sozinho, sem depender de uma pasta APK irmã.
- Reforçado `dualSeriesChart` para aceitar gráficos `multi_line` somente quando as duas séries tiverem pelo menos dois períodos em comum.
- Atualizada política de fontes do `AnalysisPageResponse` para explicitar StatusInvest/Investidor10, Yahoo Finance, B3 e BCB conforme o tipo de dado.
- Mantido contrato único `/api/v1/analysis`, `AnalysisPageResponse` e `contractVersion = 26.analysis.v2`.
- Sem alteração de `versionCode`/`versionName` do APK.

## 2026-06-16 — 21.12.115 — Revisão do Checkpoint 33: Comparadores da Análise

- Revisada fielmente a seção `comparisons` do `/api/v1/analysis`.
- Mantido `AnalysisPageResponse` (`26.analysis.v2`) e gráficos `multi_line` para ativo x índice/par.
- Reforçada a proteção contra comparadores falsos: agora flags `simulated`, `synthetic`, `fake`, `proxyTickerUsed`, `reconstructedFromYahooSnapshot` e textos de fallback falso são bloqueados também dentro de `series[]` e `points[]`, não só no comparador raiz.
- Pares semelhantes com `proxyTickerUsed`, ETF/proxy ticker ou fonte simulada são descartados.
- `npm run check` e `npm test` passaram com 32 arquivos de teste e 0 falhas.

## 2026-06-16 — 21.12.114 — Checkpoint 33: Comparadores da Análise

- A seção `comparisons` do `/api/v1/analysis` passa a normalizar comparadores reais como `multi_line`.
- Ativo x índice exige duas séries alinhadas: série do ativo e série do índice/par, com pelo menos 2 pontos cada.
- IBOV, IFIX, CDI e IPCA só aparecem quando houver fonte confiável; SMLL/IDIV ficam suportados quando vierem de fonte real já conhecida.
- Rejeitados índice simulado, proxy ticker, ETF substituto, próprio ticker como par e comparador sem série do ativo.
- O APK ganhou bloco visual próprio para Comparadores, preservando Canvas de linhas e sem barras para séries temporais.
- Teste regressivo: `analysis-comparators-v33.test.js`.

## 2026-06-16 — 21.12.112 — Revisão dos gráficos da Análise

- Corrigida a classificação visual dos gráficos do contrato `/api/v1/analysis`.
- Séries temporais de proventos, receitas/lucros, evolução patrimonial, payout e demonstrativos passam a sair como `line`/`multi_line`, não `bar`/`bar_line`.
- Distribuições, como ativos de FIIs e receitas por negócio/região, passam a sair como `donut_composition`.
- O APK foi ajustado para desenhar linhas nativas no Canvas e composições via arco/donut, sem `drawRoundRect` para séries temporais.
- Adicionado teste regressivo `analysis-chart-rendering-v31-review.test.js`.
- Sem HTML, iframe, WebView, imagem externa ou dados simulados.


## 2026-06-16 — 21.12.111 — Checkpoint 31: Sobre Empresa/Fundo na Análise

- A seção `company_profile` passa a normalizar descrição e cadastro real de empresas e FIIs.
- Empresas: setor, subsetor, segmento, CNPJ, site, atividade principal, governança, tag along, free float, número de ações, valor de mercado e patrimônio líquido.
- FIIs: razão social, CNPJ, administrador, gestor, segmento, tipo de fundo, mandato, tipo de gestão, prazo, taxa de administração e público-alvo.
- Mantido `/api/v1/analysis` como contrato único da página Análise, sem HTML ou dados simulados.

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

# VALORAE Proxy

Core público: 21.12.0  
Patch interno: 21.12.108-analysis-real-charts-v28-review


Proxy enxuto para integração mobile do VALORAE, pronto para ser anexado diretamente na árvore do AI Studio.

## Entrada principal para APK Android

```text
POST /api/scraper
```

Payload recomendado:

```json
{
  "mode": "fundamentos",
  "ticker": "BBAS3"
}
```

Resposta compatível com o APK:

```json
{
  "json": {
    "ticker": "BBAS3",
    "tipo_ativo": "acao",
    "classe_ativo": "acao",
    "graficos_i10": [],
    "chart_manifest": []
  }
}
```

O Proxy aceita aliases comuns como `ticker`, `symbol`, `ativo`, `codigo`, `papel`, `slug`, URL do Investidor10 ou texto contendo o ticker.

## Checkpoint 28 — Gráficos reais da Análise

### Revisão do Checkpoint 28 — validação dos gráficos

- Comparadores não usam o próprio ticker como índice falso.
- `Lucro x Cotação` só é emitido quando houver cotação e lucro reais em pelo menos dois períodos.
- `charts[].series[].points[]` continua sendo o único formato aceito para gráficos da Análise.


A página Análise usa o endpoint exclusivo `/api/v1/analysis` e o contrato `AnalysisPageResponse`. Para gráficos, o Proxy envia somente JSON estruturado em `sections[].charts[].series[].points`; o APK renderiza nativamente em Canvas.

Gráficos aceitos quando houver dados reais: cotação histórica, histórico de proventos/rendimentos, Dividend Yield histórico, Receitas e Lucros, Lucro x Cotação, Evolução Patrimonial, Payout histórico, valor patrimonial de FIIs, distribuição de ativos de FIIs e comparadores em seção própria.

Não há HTML, iframe, imagem de site ou simulação de IBOV, IFIX, CDI, IPCA ou valores ausentes.

## Gráficos do Investidor10 para o APK

O contrato mobile entrega campos legados e catálogo gráfico canônico:

- `graficos_i10` / `graficosI10` / `graficos`
- `chart_manifest` / `chartManifest`
- `chart_fidelity` / `chartFidelity`
- `rentabilidade_chart`
- `comparacao` e `comparacao_indices`
- `charts_financeiros`
- `historico_indicadores`
- `distribuicoes_12m`
- `dividend_yield_history`
- `dividend_history`
- `imoveis`
- `distribuicao_ativos_fundo`

Quando um bloco visual existe, mas a série não foi capturada com segurança, o catálogo marca `renderable: false` em vez de inventar dados.

## Rotas úteis

- `GET /api/v1/health`
- `GET /api/v1/manifest`
- `POST /api/scraper`
- `POST /api/v1/mobile/portfolio-sync`
- `POST /api/v1/dividends/batch`
- `GET /api/v1/asset/history`
- `GET /api/v1/asset/dividends`
- `GET /server.html`


## Supabase pelo Proxy

O Proxy possui sincronização Supabase opcional em:

```text
GET  /api/sync?action=health
GET  /api/sync?action=diagnostics
POST /api/sync?action=register_client
POST /api/sync?action=upsert_snapshot
POST /api/sync?action=upsert_transactions
POST /api/sync?action=upsert_dividend_events
GET  /api/sync?action=get_snapshot
GET  /api/sync?action=get_transactions
GET  /api/sync?action=get_dividend_events
DELETE /api/sync?action=delete_user_data
```

No Vercel, configure no mínimo:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Depois do deploy, teste de verdade com:

```text
https://SEU-PROXY.vercel.app/api/sync?action=diagnostics
```

`health` só informa se as variáveis existem. `diagnostics` consulta as tabelas reais e mostra se o Proxy consegue conversar com o Supabase sem expor chaves.

## Validação local

```bash
npm test
npm run check
npm run typecheck
npm run smoke
npm run audit:identity
```

## Política de manutenção

Este pacote foi limpo para manter somente código, testes e documentação operacional. Relatórios históricos, auditorias antigas e dumps de mudança foram removidos para reduzir peso e facilitar manutenção.

## Compatibilidade histórica mantida

O pacote mantém compatibilidade operacional com os marcos v21.12.26, v21.12.31, v21.12.32 e v21.12.35, incluindo `/api/v1/release/readiness`, uso pessoal e pessoas próximas, monitor com 7 áreas principais e contrato mobile para APK.


## Alinhamento APK `/api/sync` — 2026-06-13

Esta versão do Proxy publica `capabilities` em `/api/sync?action=health` e `/api/sync?action=diagnostics`, para o APK diferenciar claramente:

- Supabase configurado e tabelas acessíveis;
- contrato `/api/sync` anunciado pelo servidor;
- ações em lote disponíveis para cache-first.

Capacidades anunciadas:

```text
health, diagnostics, register_client,
upsert_snapshot, get_snapshot,
upsert_snapshots, get_snapshots,
upsert_transactions, get_transactions,
upsert_dividend_events, get_dividend_events,
delete_user_data
```

O APK deve preferir `get_snapshots` e `upsert_snapshots` quando precisar buscar/salvar vários snapshots de uma tela.

### Portfolio Returns

O Proxy expõe `POST /api/v1/portfolio/returns` para o modal Retorno do APK. O contrato consolida histórico real da carteira, transações, proventos recebidos e benchmarks como CDI, IPCA, IBOV e IFIX em uma única resposta para o app.

### Checkpoint 32 — Negócios e Regiões de Receita

Patch: `21.12.113-analysis-revenue-breakdown-v32`.

A rota `/api/v1/analysis` mantém o contrato `AnalysisPageResponse` e passa a preencher a seção `revenue_breakdown` quando houver percentuais reais de receita por negócio, região ou mercado interno/externo. O Proxy não cria percentuais sintéticos: se a fonte não entregar dados válidos, a seção permanece vazia e sinalizada.


## 2026-06-16 — Análise por categorias e receita ampliada

- Patch `21.12.123-analysis-clean-categories-visible-charts-v39`.
- Extração de receita por negócio/região ampliada para reconhecer mais formatos estruturados.
- Mantida política de não sintetizar valores: sem percentual real, a seção permanece indisponível para gráfico.
