# VALORAE Proxy v21.12.65 — Agenda de Dividendos Investidor10

## Escopo
Correção profunda da integração entre VALORAE Proxy e APK para:
- `/api/v1/portfolio/next-dividends`
- `/api/v1/portfolio/dividends`
- `/api/v1/asset/dividends`
- `/api/v1/asset/next-dividend`

## Problema encontrado
O HTML/texto atual do Investidor10 pode renderizar cartões de agenda no formato:

`15/06/26 Dividendos Dividendos R$ 0,62 FATN11 ... Data Com 05/06/26 Pgto 15/06/26`

O parser anterior priorizava padrões onde o ticker aparecia antes do valor. Quando o valor aparecia antes do ticker, os eventos públicos das páginas de ações/FIIs não eram convertidos em `events`, `upcomingEvents` e `historyEvents`, causando tela vazia no APK.

## Correções aplicadas
- Parser adicional para layout `data/tipo/valor/ticker/Data Com/Pgto`.
- Validação para impedir falso positivo cruzando cartões HTML onde o próximo ticker aparece após o `R$` de outro ativo.
- Normalização preservada: `ticker`, `symbol`, `codigo`, `dateCom`, `dataCom`, `paymentDate`, `dataPagamento`, `valuePerShare`, `valor`, `type`, `tipo`, `status`, `assetClass`, `source`.
- Consulta de agenda agora busca ações e FIIs quando `assetClass` não é explícito, evitando perder ações units terminadas em `11` e FIIs classificados por heurística.
- Release, monitor, manifesto e service worker atualizados para `21.12.65-valorae-i10-dividend-agenda-parser-boundary-fix`.

## Validação
- `node --check lib/market/investidor10-dividend-agenda.js`: OK.
- Teste manual do parser com layout atual do Investidor10: capturou FATN11/BIME11 com datas e valores corretos.
- `npm test -- --runInBand`: 91 arquivos executados, falhas=0.

## Contrato esperado para o APK
O APK deve consumir `upcomingEvents` para agenda futura e `historyEvents`/`events` filtrados por data para evolução histórica. O Proxy mantém aliases redundantes para compatibilidade: `events`, `dividends`, `dividendos`, `proventos`, `agendaEvents`, `upcomingEvents`, `historyEvents`.
