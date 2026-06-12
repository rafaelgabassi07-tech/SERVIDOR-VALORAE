# VALORAE Proxy

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
