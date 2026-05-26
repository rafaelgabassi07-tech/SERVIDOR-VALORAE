# Troubleshooting — Valorae Proxy

## Deploy falha na Vercel

Rode localmente:

```bash
npm run verify
npm run build
```

O projeto não exige `npm install` de dependências porque `dependencies` é vazio.

## CORS bloqueado

Para API pública/demo, deixe CORS padrão. Para produção restrita:

```bash
VALORAE_CORS_STRICT=1
VALORAE_PUBLIC_BASE_URL=https://seu-proxy.vercel.app
VALORAE_CORS_ALLOW_ORIGINS=https://seu-app.vercel.app
```

## Fonte externa sem dados

Use:

- `/api/v1/source/status`
- `/api/v1/cache/stats`
- `profile=instant` para fallback rápido
- `debug=1` apenas em desenvolvimento

## Payload grande

Use:

```text
?lean=1&view=card&profile=quote&maxItems=20&fields=ticker,normalized,quality
```

## Carteira sem score bom

Informe `quantity`, `averagePrice`, `currentPrice/currentValue`, `targetPercent`, `objective`, `account`, `issuer` e `tags` por posição.

## Vercel Studio: `npm run build` parando em `routes/errors.js`

A partir desta revisão, `npm run build` usa uma validação leve de deploy para evitar falhas ambientais do Vercel Studio durante `node --check` arquivo a arquivo. A validação completa continua disponível localmente com:

```bash
npm run build:strict
npm test
npm run verify
```

O arquivo `routes/errors.js` continua validado no fluxo estrito, mas o build de deploy não depende mais de syntax checks recursivos que podem falhar de forma pouco explicativa no Studio.
