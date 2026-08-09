# Proxy v161 — Fundamentos em lote para Descoberta por setores

Data: 2026-07-01

## Escopo

Alinha o Proxy ao APK v265 para que a Descoberta por setores consiga exibir listas limpas com dados fundamentalistas por ativo.

## Alterações

- Criado `lib/market/fundamentus-snapshot.js` para capturar tabelas públicas de ações e FIIs em lote.
- `lib/sources/quotes.js` agora mistura cotação/variação do Yahoo com P/VP e Dividend Yield do snapshot em lote.
- `/api/v1/quotes` agora retorna sempre payload de lote compatível com `assets`, `quotes`, `items` e `results`, mesmo quando recebe um ticker único.
- Campos expostos: `priceDisplay`, `changeDisplay`, `pvp`, `pvpDisplay`, `dividendYield`, `dividendYieldDisplay`, `dy`, `dyDisplay`, `priceToBook`.

## Segurança de dados

- O Proxy não cria P/VP ou DY sintético.
- Quando a fonte externa não entrega um ticker, o campo fica ausente e o APK mostra `—`.

## Arquivos principais

- `lib/market/fundamentus-snapshot.js`
- `lib/sources/quotes.js`
- `routes/_router.js`
- `docs/CHANGELOG.md`
