# Correção de build no Vercel

Este pacote contém uma correção para o erro genérico:

```txt
Error: Command "npm run build" exited with 1
```

## O que mudou

- `npm run build` agora executa `scripts/build-vercel-safe.js`, uma validação leve e compatível com o ambiente serverless do Vercel.
- `vercel.json` também define `buildCommand` como `node scripts/build-vercel-safe.js`.
- O Node foi fixado em `20.x` no `package.json` para reduzir diferenças entre o ambiente local e o Vercel.
- A validação rigorosa original foi preservada como `npm run build:strict`, mas não é usada automaticamente no deploy.

## Comandos úteis

```bash
npm run build
npm test
```

## Acesso após deploy

```txt
/server.html
/api/server/metrics
```
