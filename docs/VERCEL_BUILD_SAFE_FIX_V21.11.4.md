# Correção de build Vercel — v21.11.7

## Problema

O deploy podia falhar no Vercel com a mensagem genérica:

```txt
Error: Command "node scripts/build-free.js" exited with 1
```

O `build-free.js` executa uma validação estrita e várias auditorias de release. Isso é útil localmente, mas é mais rígido e mais sensível a diferenças do ambiente de build do Vercel.

## Correção

A versão v21.11.7 passa a usar no deploy:

```txt
node scripts/build-vercel-safe.js
```

Esse script valida o essencial para Vercel Free:

- arquivos obrigatórios do runtime;
- sintaxe dos JS de `api`, `routes` e `lib`;
- presença do dashboard;
- presença do Engine;
- ausência de etapa de build pesada;
- compatibilidade serverless gratuita.

## Scripts

```json
{
  "build": "node scripts/build-vercel-safe.js",
  "build:strict": "node scripts/build-free.js",
  "vercel-build": "node scripts/build-vercel-safe.js"
}
```

## Uso recomendado

Para deploy no Vercel:

```bash
npm run build
```

Para auditoria local completa:

```bash
npm run build:strict
npm run verify
```

## Garantias preservadas

- Sem Redis, banco, KV, WebSocket, filas, cron ou serviços pagos.
- `lib/Valorae-engine.js` continua como núcleo central.
- `/api/server/metrics` continua isolado da telemetria real.
- O Service Worker não cacheia `/api`.
- Dashboard, PWA, métricas, scraping e módulos do Engine foram preservados.
