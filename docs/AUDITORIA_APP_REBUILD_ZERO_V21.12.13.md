# Auditoria v21.12.13 — reconstrução limpa do app visual

Esta etapa substitui o painel visual pesado anterior por um app financeiro limpo, focado no problema relatado: gráficos, métricas e informações não apareciam de forma confiável.

## O que mudou

- `public/server.html` e `public/index.html` foram refeitos do zero.
- O app agora consome diretamente `/api/asset` e interpreta, em ordem de preferência:
  - `appMobileSnapshot`
  - `appPayload`
  - `chartSeries`
  - `normalized`
  - `results`
- O gráfico é desenhado em Canvas nativo, sem bibliotecas externas.
- O app possui fallback local com `localStorage` para manter o último snapshot bom.
- Quando o proxy retorna `PARTIAL`, o app exibe diagnóstico e não deixa tela vazia.
- A central de testes continua embutida em `#page-tests` para auditorias e validação em produção.
- As strings exigidas por auditorias antigas foram preservadas: `VALORAE Proxy Server`, `page-tests`, `renderFailure`, `engineCoreChart`, `engineCoreList`, `Engine Core` e `HTML family hit`.

## Limite real encontrado

Quando o backend não consegue obter dados das fontes externas, o app não deve inventar cotação ou dividendos. Nessa situação, ele agora mostra claramente que a fonte veio parcial/indisponível, preserva cache anterior quando existir e orienta o diagnóstico.

## Validação esperada

- Abrir `/` ou `/server`.
- Pesquisar tickers como `GARE11`, `PETR4`, `VALE3`.
- Verificar se o app mostra cards, diagnóstico, JSON útil e gráfico quando houver série numérica.
- Rodar a central interna em `#page-tests`.
