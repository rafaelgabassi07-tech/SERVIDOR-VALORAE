# VALORAE Proxy — Mobile boot deadline e respostas parciais

## Objetivo
Evitar que rotas pesadas bloqueiem o APK na abertura e permitir que o app preserve cache/snapshot local quando o Proxy exceder o orçamento de tempo.

## Melhorias aplicadas

1. **Utilitário de deadline por rota**
   - Adicionado `withRouteDeadline` em `lib/http/route.js`.
   - Rotas críticas agora podem retornar payload parcial dentro do orçamento mobile.

2. **Assets com deadline mobile**
   - `routes/assets.js` passa a respeitar `routeDeadlineMs`/`deadlineMs`.
   - Em timeout, retorna `partial: true`, `assets: []` e erros por ticker, sem travar o app.

3. **Dividendos/Proventos com orçamento menor**
   - `routes/portfolio/dividends.js` usa deadline parcial para batch de ativos e agenda Investidor10.
   - O endpoint passa a retornar `partial` e `deadlineMs` quando algum bloco excede o limite.

4. **Rankings com fallback parcial**
   - `routes/market/rankings.js` passa a ter deadline para rankings da Home e rankings comparativos.
   - Em timeout, retorna arrays vazios e warnings, permitindo ao APK manter o ranking anterior.

5. **Notícias com timeout padrão**
   - `routes/news.js` agora assume `timeoutMs=3000` quando o cliente não envia valor explícito.

6. **Endpoint de bootstrap mobile**
   - Criado `/api/v1/mobile/bootstrap` e alias `/api/v1/app/bootstrap`.
   - Entrega payload compacto com assets, notícias, cache e diagnósticos em orçamento curto.

## Validação
- `npm run check`: OK, 294 arquivos JS verificados com `node --check`.
- `npm run build`: OK, build serverless seguro para Vercel validado.

## Arquivos principais alterados
- `lib/http/route.js`
- `routes/assets.js`
- `routes/portfolio/dividends.js`
- `routes/market/rankings.js`
- `routes/news.js`
- `routes/mobile/bootstrap.js`
- `routes/_router.js`
