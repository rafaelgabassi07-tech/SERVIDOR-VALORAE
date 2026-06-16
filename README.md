# VALORAE Proxy

Core público: 21.12.0  
Patch interno: 21.12.97-analysis-full-fundamentals-contract


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
