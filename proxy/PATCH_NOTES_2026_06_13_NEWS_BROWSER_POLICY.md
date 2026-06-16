# Valorae Proxy — correções 2026-06-13

## Ajustes aplicados
- /api/v1/news agora aceita symbols/tickers/assets em lote e usa o primeiro ticker como principal, mantendo os demais como aliases.
- Resposta de notícias agora explicita openPolicy para abertura do link original no navegador.
- Itens de notícia incluem url/originalUrl, openInBrowser=true e inAppReader=false.
- Extração de corpo completo fica desativada por padrão no fluxo legado de notícias, alinhando o Proxy ao app sem leitor nativo.
- Patch interno atualizado para 21.12.94-notification-news-browser-routing.

## Validação executada
- npm run check
- npm test
