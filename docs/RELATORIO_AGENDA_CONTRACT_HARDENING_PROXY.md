# Relatório — Hardening do contrato Agenda de Dividendos — VALORAE Proxy

## Objetivo

Auditar, corrigir e reforçar a integração do VALORAE Proxy com o APK VALORAE para a página/modal **Agenda de Dividendos**, focando na robustez e normalização do contrato dos endpoints de dividendos do portfólio e ativos individuais sem quebrar compatibilidade retroativa.

## Arquivos alterados

1. `routes/portfolio/dividends.js`
2. `routes/portfolio/next-dividends.js`
3. `routes/asset/dividends.js`
4. `routes/asset/next-dividend.js`
5. `test/investidor10-dividend-agenda-contract-hardening.test.js` (Novo arquivo de teste)

## Endpoints revisados

- `/api/v1/portfolio/dividends`
- `/api/v1/portfolio/next-dividends`
- `/api/v1/asset/dividends`
- `/api/v1/asset/next-dividend`

## Fontes do Investidor10 usadas

Foram mantidas e validadas as fontes canônicas de scraping dentro de `lib/market/investidor10-dividend-agenda.js`:
- `https://investidor10.com.br/acoes/dividendos/`
- `https://investidor10.com.br/fiis/dividendos/`
- Além das páginas canônicas extraídas via histórico do próprio ativo ex: `https://investidor10.com.br/acoes/petr4/`

## Aliases retornados

O contrato foi consolidado para que sempre sejam entregues os aliases garantindo que, por mais que as necessidades do app mudem com o decorrer de diferentes versões, uma key compatível estará presente na raiz.

### Na raiz do JSON os aliases de listas
- `events`
- `items`
- `dividends`
- `dividendos`
- `proventos`
- `historico`
- `history`
- `agendaEvents`: Contém todos os eventos deduplicados mesclando histórico e próximos.
- `upcomingEvents`: Apenas pagamentos previstos ou futuros.
- `historyEvents`: Apenas pagamentos históricos.

### Na raiz, aliases de contagem
- `upcomingCount`
- `historyCount`
- `count`
- `totalCount`

## Wrappers suportados
Os endpoints suportam requisições tanto com múltiplos `tickers=` separados por vírgula no GET, como via `POST` fornecendo object parameters em root, incluindo a validação nativa que o proxy traz no parâmetro array `positions` (contendo object positions por ticker, quantity etc.). O Engine VALORAE subjacente é capaz de consumir via GET ou POST normalmente.

## Regras de normalização de datas

A extração garante que tanto strings `1/6/26`, `01/06/26` ou `01/06/2026` sejam corretamente consumidos. 
- Foi adicionada uma detecção inteligente para `parseBRDate` transformando short year (YY) para século `20YY`.
- Formato final do parser interno é `DD/MM/YYYY` e `YYYY-MM-DD` exportado nativamente para os campos `dataComIso` e `paymentDateIso`. Se a data não existir, a string será tratada condicionalmente omitindo a prop.
- Não existem descartes bruscos ou deduções estatísticas que alterem a data original do Investidor10.

## Regras de normalização de valores

Toda string retornada (ex: `R$0,35` / `R$ 0.35`) pela página do ativo ou agenda passa pelo processo contínuo de normalização contendo:
- Conversão explícita para Numeral e output com os novos aliases compatíves `valor`, `value`, `amount`, e `valuePerShare`.
- Formato string garantido: `valueFormatted: R$ 0,35`.
- Moeda baseada garantida: `currency: BRL`.

## Regras de deduplicação

Foi implementado um pipeline de merge em todos os endpoints:
```js
const merged = [...agendaEvents, ...historicoEvents].filter((e, idx, arr) => 
  arr.findIndex(x => [x.ticker, x.dateCom, x.paymentDate, x.type, x.valuePerShare].join('|') === 
                     [e.ticker, e.dateCom, e.paymentDate, e.type, e.valuePerShare].join('|')) === idx
);
```
Isso garante a retenção de proventos justapostos em datas idênticas, mas afasta cópias clonadas que venham simultaneamente do "Histórico" (Página do Ativo) e "Agenda" (Página listagem unificada) ou vice-versa, sem perder pagamentos genuínos idênticos no dia.

## Diferenças entre agendaEvents, upcomingEvents e historyEvents

A função nativa `splitDividendEvents` separa a linha do tempo tomando o tempo atual (Meia noite UTC today):
- `upcomingEvents`: Tudo que tem `paymentDate >= today`. Se o ativo não contiver Payment (em branco) mas tiver `dateCom >= today`, o evento será retido como upcoming.
- `historyEvents`: Somente eventos antigos.
- `agendaEvents`: O array completo, sempre com a lista de upcoming unshiftada acima da história (`upcomingEvents.concat(historyEvents)`).

## Testes executados

Rodamos a suite unificada do Valorae-Proxy para garantir a estabilidade do contrato de endpoints (`npx node scripts/run-all-tests.js`). Foi adicionado `investidor10-dividend-agenda-contract-hardening.test.js` à pasta de testes. A regressão e os novos testes de contrato operam 100% ok, abrangendo:
- agenda de ações
- agenda de fiis
- histórico e portfólio
- Endpoints assets

## Versão Final

No arquivo `package.json`, versão reportada como core Version `21.12.0` retendo a estabilidade retroativa de release, e `releasePatch` operando sob `21.12.63-valorae-i10-dividend-agenda-sync`.
