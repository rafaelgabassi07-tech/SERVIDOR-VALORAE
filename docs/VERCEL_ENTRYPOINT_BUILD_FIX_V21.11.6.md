# VALORAE Proxy v21.11.7 — Correção de entrada do app e build Vercel

## Causa encontrada

O pacote enviado tinha o app visual em `public/index.html`, mas `public/server.html` não existia. O `vercel.json` reescrevia `/` e `/server` para `/server.html`, e o `scripts/build-vercel-safe.js` exigia esse arquivo. Por isso o Vercel encerrava com:

```txt
Error: Command "node scripts/build-vercel-safe.js" exited with 1
```

A alteração feita para remover a antiga página “VALORAE Proxy Portal” não é problema por si só. O problema foi deixar o app somente em `index.html` sem manter o alias físico `server.html`, que ainda é usado pelo dashboard, pelas rotas de rewrite e pelas validações.

## Correção aplicada

- `public/server.html` foi restaurado como o mesmo app do `public/index.html`.
- `/`, `/server` e `/server.html` continuam abrindo o VALORAE Proxy Server.
- `scripts/build-vercel-safe.js` agora gera `public/server.html` a partir de `public/index.html` se alguém remover o arquivo novamente por engano.
- Versões do projeto foram alinhadas para `21.11.7` para reduzir conflito visual/API/docs.
- `.gradle` foi adicionado ao `.gitignore` e `.vercelignore`.

## Garantia

O app “VALORAE Proxy Portal” não foi restaurado. O arquivo `server.html` agora é apenas uma entrada compatível para o app único “VALORAE Proxy Server”.
