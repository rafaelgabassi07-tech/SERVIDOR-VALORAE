# Servidor local Node — Valorae Proxy

Este pacote também pode rodar como app servidor HTTP Node, sem Express e sem dependências externas.

## Rodar localmente

```bash
npm install
npm start
```

Por padrão, o servidor sobe em:

```text
http://localhost:3000
```

Variáveis opcionais:

```bash
PORT=3000
HOST=0.0.0.0
VALORAE_SERVER_MAX_BODY_BYTES=1048576
```

## Rotas

- Interface pública: `http://localhost:3000/`
- Inspector: `http://localhost:3000/inspector.html`
- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Asset: `http://localhost:3000/api/asset?ticker=PETR4&view=quote`

## Deploy Vercel gratuito

O servidor local não altera o modo serverless. O deploy na Vercel continua usando somente:

```text
api/index.js
api/[...path].js
```

O núcleo `lib/Valorae-engine.js` permanece preservado como engine central.
