# Proxy 21.12.365 / v333 — Paridade dos índices da página Retorno

## Causa confirmada

A página Retorno não utilizava a mesma cadeia de fontes dos modais de Ação e FII. Os modais tentavam primeiro a API direta de cotações dos índices, enquanto `/api/v1/portfolio/returns` chamava somente `getAssetHistory`. Para SMLL, IFIX e IDIV essa camada estava configurada como Yahoo-only; quando o Yahoo entregava apenas snapshot ou série vazia, o APK recebia campos nulos e mostrava `aguardando série`.

O teste anterior mascarava a falha porque simulava Yahoo saudável para todos os índices.

## Correção

- `buildPortfolioReturns` tenta primeiro `fetchInvestidor10DirectIndexHistory` para IBOV, SMLL, IFIX e IDIV, exatamente como os modais.
- `getAssetHistory` permanece como contingência.
- As séries são normalizadas, rebaseadas no primeiro mês da carteira e mescladas no contrato principal.
- O diagnóstico expõe provedor, paridade e tentativas por índice.
- O contrato foi promovido para `valorae-portfolio-returns-v2-index-provider-parity`.
- Service Worker e metadados receberam nova versão de cache/release.

## Validação final

- 215 arquivos de teste aprovados, zero falhas.
- 412 arquivos JavaScript verificados sintaticamente.
- Build Vercel e auditoria de versão aprovados.
- 24 testes cross-stack APK↔Proxy aprovados.
- Teste de produção equivalente: Yahoo indisponível, API direta válida, SMLL/IFIX/IDIV com status `OK` e campos mensais preenchidos.
- Teste inverso: API direta vazia e contingência Yahoo válida.

Não há ETF substituto, interpolação, duplicação de snapshot, valor fixo ou curva sintética.
