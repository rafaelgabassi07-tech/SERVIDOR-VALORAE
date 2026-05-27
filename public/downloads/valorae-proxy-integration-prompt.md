# Prompt para IA - Integração Valorae Proxy

Você é uma IA/engenheiro sênior. Implemente a integração do meu app terceiro com o Valorae Proxy.

## Coordenadas de produção

Substitua os placeholders abaixo pela URL real do deploy:

- `VALORAE_PROXY_URL={{VALORAE_PROXY_URL}}/api`
- Header obrigatório: `Accept: application/json`
- Header recomendado/operacional: `X-Valorae-Client-Id: nome-estavel-do-app`
- POST JSON: `Content-Type: application/json`

## Fluxo esperado

App terceiro -> HTTP/fetch -> Valorae Proxy `/api/*` -> `Valorae-engine.js` -> scraping/normalização -> resposta JSON -> app terceiro.

## Endpoints principais

- `GET /api/health`
- `GET /api/ready`
- `GET /api/openapi`
- `GET /api/fields`
- `GET /api/asset?ticker=PETR4&mode=basic&view=compact`
- `GET /api/assets?tickers=PETR4,VALE3`
- `POST /api/portfolio/analyze`
- `GET /api/observability?minutes=60`

## Regras para implementar

1. Crie um client/service dedicado para o Valorae Proxy.
2. Nunca faça scraping direto no app terceiro.
3. Sempre envie `X-Valorae-Client-Id` para aparecer no dashboard.
4. Trate HTTP `>= 400`, `status: PARTIAL`, warnings e campos ausentes.
5. Use timeout, retry leve com backoff e fallback visual.
6. Não exponha segredo real no front-end.
7. Valide a integração nas páginas Teste Real, Tráfego, Clientes, Entrega, Desempenho e Logs.

## Critérios de aceite

A integração deve funcionar em navegador e/ou backend, respeitar CORS, retornar mensagens amigáveis, não depender de recurso pago e permitir rastreamento por `X-Valorae-Client-Id`.
