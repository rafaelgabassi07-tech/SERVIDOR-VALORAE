# Auditoria v21.12.24 — Efficiency, precision and ecosystem monitor

## Objetivo

Evoluir o ecossistema Valorae sem desmembrar `lib/Valorae-engine.js`, priorizando eficiência, performance, confiabilidade e precisão. A interface também foi aprimorada para funcionar como monitor profissional e documentação viva do Proxy.

## Engine

- Novo módulo auxiliar: `lib/quality/engine-efficiency.js`.
- Novo campo de payload: `engineEfficiency`.
- Novo modo debug/full: `engineModuleTree`.
- `resolveEngineAssemblyPlan` agora usa memoização simples por view/perfil/contrato/debug.
- `_fetchAtivoUncached` reutiliza um único snapshot de runtime stats na montagem da resposta.
- `metrics.engineOptimizations` indica:
  - `assemblyPlanMemoized`
  - `singleRuntimeStatsSnapshot`
  - `viewAwareChartSeriesBudget`
  - `singlePassResultCachePacking`

## Precisão e confiabilidade

`engineEfficiency` mede:

- campos financeiros normalizados;
- unidades detectadas: moeda, percentual, múltiplo, número e desconhecido;
- outliers defensivos em preço, percentuais e múltiplos;
- tentativas de fonte, fontes OK e bloqueios;
- score de eficiência, precisão, confiabilidade e score geral;
- entrega de séries, pontos, raízes app e decisão de sincronização.

## Monitor Web

Novas páginas no menu lateral:

- Prompts prontos para IA;
- Funcionalidades;
- Tecnologias e funcionamento;
- Árvore de módulos.

A página preserva:

- `proxyOutputMonitor.outputFeed[]` como fonte fiel do feed;
- páginas com duas explicações claras;
- menu lateral por categorias;
- benchmark/sonda fora do cabeçalho;
- tons verde/cinza e cabeçalho compacto.

## Compatibilidade

- Sem banco, Redis, KV, cron, WebSocket ou dependência paga.
- Compatível com Vercel Free e GitHub.
- Contrato público mantido: `VALORAE_ENGINE_VERSION = 21.12.0`.
