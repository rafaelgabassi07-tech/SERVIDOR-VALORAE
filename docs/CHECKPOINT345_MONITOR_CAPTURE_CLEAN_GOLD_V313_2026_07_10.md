# Checkpoint 345 — Monitor capture clean Gold v313

## Resultado

O `VALORAE Proxy Monitor` volta a registrar o tráfego externo da instância e a interface volta a executar normalmente. O cockpit foi renovado com superfícies sólidas, paleta Gold Classic e hierarquia visual alinhada ao APK v476.

## Causa raiz

1. `attachProxyMetricsInterceptor` existia, mas não era instalado no roteador central. Respostas fora de helpers instrumentados não viravam eventos.
2. `sendJson` não registrava explicitamente o payload completo, reduzindo a qualidade dos diagnósticos.
3. O JavaScript inline de `public/index.html` e `public/server.html` continha duas strings truncadas; o navegador interrompia o parse de todo o monitor.

## Correções

- Interceptador instalado no início de `dispatchRoute`, antes de CORS, preflight, parsing e handlers.
- Cobertura de `sendJson`, `res.end`, `res.write + res.end`, `HEAD`, `OPTIONS`, erros e fechamento do cliente.
- Deduplicação por requisição preservada com `req.__valoraeMetricsRecorded`.
- Rota HTTP real preservada quando um handler interno tenta registrar um profile curto.
- `requestId`, interceptador, método e content type exibidos no feed.
- Novos indicadores: requisições concluídas, lacuna de captura, saúde da captura e confirmação do interceptador central.
- Polling administrativo continua separado para não criar recursão.
- JavaScript do monitor reconstruído e validado por `node --check`.
- CSS `monitor-valorae.css` adiciona visual sólido Gold Classic, sem gradientes/blur e com responsividade mobile-first.

## Limite operacional explícito

As métricas são mantidas na memória da instância serverless atual. Em produção Vercel, instâncias paralelas podem ter contadores independentes. Uma visão global entre instâncias exigiria persistência externa, que não foi adicionada para preservar a arquitetura Vercel Free atual.

## Compatibilidade

- APK: v476 / protocolo móvel `2026.07.10.6`.
- Proxy: `21.12.345-monitor-capture-clean-gold-v313`.
- Contrato HTTP, rotas, headers, TTLs e delivery schema v2 preservados.
