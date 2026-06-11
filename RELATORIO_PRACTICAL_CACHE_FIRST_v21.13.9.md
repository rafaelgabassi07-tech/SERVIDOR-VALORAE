# VALORAE Proxy v21.13.9 — Fluxo prático cache-first

## Objetivo

Simplificar o ecossistema VALORAE seguindo a filosofia prática observada no AeroScrape + Vesto: caminho crítico curto, contrato leve, cache primeiro e rotas dedicadas para dados caros.

## Alterações principais

- Novo endpoint `/api/v1/mobile/practical-sync`.
- `mobile/practical-sync` chama `buildMobilePortfolioSync` com `practicalMode=true`.
- Dividendos deixam de ser buscados dentro do bundle prático; são deferidos para `/api/v1/dividends/batch`.
- O contrato passa a expor `dataPolicy`, `deferredBlocks` e `nextActions` para deixar claro o que foi carregado agora e o que deve ser buscado por tela.
- Timeouts práticos adicionados para análise, histórico, IPCA e rankings, evitando que uma fonte lenta bloqueie o sync mobile.
- Manifesto e monitor incluem a rota prática como rota primária.
- Versão atualizada para `21.13.9-practical-cache-first-flow`.

## Estratégia resultante

```text
APK abre tela
  ↓
Renderiza snapshot/cache local
  ↓
/api/v1/mobile/practical-sync carrega blocos leves
  ↓
/api/v1/dividends/batch carrega agenda/evolução por rota dedicada
  ↓
Blocos pesados atualizam em background ou por tela
```

## Validações

- `npm test`: 15 arquivos de teste / 0 falhas.
- `npm run audit:version`: OK.
- `npm run verify`: OK.
- `npm run check`: 41 arquivos JS verificados.
- `npm run build`: OK para Vercel.
- `npm run smoke`: OK.
