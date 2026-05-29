# Auditoria funcional das páginas do VALORAE Proxy Monitor — v21.12.35

Data: 2026-05-29  
Pacote auditado: `valorae-proxy (9).zip`  
Versão gerada: `21.12.35-monitor-data-fill`  
Contrato público do engine preservado: `VALORAE_ENGINE_VERSION = 21.12.0`

## Veredito

O projeto **continua apto para lançamento pessoal**, mas a sua observação estava correta: a experiência do monitor ainda tinha lacunas visuais importantes. O backend e os contratos estavam funcionando, porém algumas páginas pareciam vazias porque a UI não buscava os endpoints certos automaticamente e porque a telemetria real começa vazia por design.

A versão `v21.12.35-monitor-data-fill` corrige esse ponto de uso prático. Agora o monitor abre com informações de integração e diagnóstico sem exigir que você clique primeiro em vários botões.

## Causa do problema percebido

1. **`Integração e guia` era majoritariamente estática.** A página mostrava listas internas fixas, mas não consumia de fato `/api/v1/integration/manifest`, `/sdk`, `/prompts`, readiness e status das fontes.
2. **`Benchmark e diagnóstico` só preenchia depois de clique manual.** Em uma instância nova, isso passava a impressão de que a página estava quebrada.
3. **O monitor não deve contar o próprio polling como tráfego real.** `/api/server/metrics`, readiness, source status e agora integração são telemetria interna. Por isso, em deploy novo, o feed fica vazio até um app ou o botão “Gerar saída teste” chamar uma rota de dados como `/api/v1/asset`.
4. **Histórico de telemetria é em memória por instância serverless.** No Vercel Free, sem banco/KV/Redis, a memória pode resetar e instâncias diferentes podem não compartilhar histórico. Isso é esperado pelo desenho gratuito do projeto.
5. **Dados financeiros podem aparecer PARTIAL quando fontes públicas falham.** No teste local, `/api/v1/asset?ticker=PETR4&view=app&profile=fast` respondeu, mas veio `status=PARTIAL`, com fonte degradada/cooldown. A UI está funcionando, mas os campos de cotação/dividendos/fundamentos dependem das fontes externas no ambiente real da Vercel.

## Correções aplicadas

- Página **Integração e guia** agora carrega dados vivos de:
  - `/api/v1/integration/manifest`
  - `/api/v1/integration/sdk`
  - `/api/v1/integration/prompts`
  - `/api/v1/release/readiness`
  - `/api/source/status`
- Página **Benchmark e diagnóstico** agora executa automaticamente:
  - health check dos endpoints principais;
  - benchmark quick via `/api/server/tests?mode=quick`.
- Corrigido bug real no SDK JS gerado por `/api/v1/integration/sdk`: antes podia sair `replace(//$/, '')`; agora sai corretamente `replace(/\/$/, '')`.
- Endpoints de integração e readiness usados pelo próprio painel foram classificados como telemetria interna, evitando poluir `proxyOutputMonitor.outputFeed`.
- `public/index.html` e `public/server.html` foram mantidos espelhados.
- Service worker e manifest PWA atualizados para `21.12.35`.
- Novo teste de regressão: `test/monitor-data-fill-v21-12-35.test.js`.

## Auditoria por página

| Página | Resultado antes | Resultado após v21.12.35 | Status |
|---|---|---|---|
| Centro de comando | KPIs existiam, mas instância nova parecia vazia por falta de tráfego real. | Continua separando tráfego real de telemetria interna e mostra estado “sem tráfego externo ainda”. | OK |
| Saída do proxy | Feed vazio em instância nova; isso era esperado, mas pouco claro. | Integração/diagnóstico não inflam feed; chamadas reais de `/api/asset` aparecem com rota, app, canal, status, bytes e roots. | OK |
| Performance e Vercel | Dependia de eventos reais para gráficos; runtime local/Vercel aparecia parcialmente. | Continua correto; gráficos aparecem após tráfego real. Estado local/Vercel fica explícito. | OK com tráfego |
| Qualidade dos dados | Campos dependiam do último payload real; sem evento ficavam com “—”. | Mantém comportamento correto; qualidade só deve refletir payload real, não polling interno. | OK com tráfego |
| Integração e guia | Conteúdo principalmente estático, sem ler manifesto/SDK/prompts vivos. | Agora lê os endpoints reais e mostra manifesto, prompts, SDK, readiness e fontes. | Corrigido |
| Benchmark e diagnóstico | Resultado e benchmark ficavam vazios até clique manual. | Health check e benchmark quick rodam automaticamente uma vez ao abrir o monitor. | Corrigido |

## Testes executados

| Comando / validação | Resultado |
|---|---:|
| `npm run check` | PASS — 242 arquivos JS |
| `npm run build` | PASS |
| `npm run build:strict` | PASS |
| `npm run typecheck` | PASS |
| `npm run smoke` | PASS |
| `npm test` | PASS — incluindo `monitor-data-fill-v21-12-35` |
| `npm run audit:functions` | PASS |
| `npm run audit:free` | PASS |
| `npm run audit:version` | PASS |
| `npm run audit:routes` | PASS |
| `npm run audit:release` | PASS |
| `npm run audit:minutiae` | PASS |
| `npm run audit:recommended` | PASS |
| `npm run audit:final` | PASS |
| `npm run audit:engine-performance` | PASS |
| `npm run bench:scrape` | PASS |
| Sintaxe do script inline da UI | PASS |

Observação: `npm run verify` foi testado, mas por ser um agregador longo que chama a suíte completa novamente, excedeu o limite de execução da ferramenta nesta sessão. Os comandos que ele agrega foram executados separadamente e passaram.

## Benchmark de endpoints/páginas

Fonte: `reports/benchmark-monitor-pages-v21.12.35.json`  
Base local: `http://127.0.0.1:3000`  
Nota: `p95 calculado como ceil(0.95*n), com n=5 por endpoint; para amostra curta, p95 equivale ao pior caso observado.`

| Caso | Endpoint | Status | Média | P95 | Bytes |
|---|---|---:|---:|---:|---:|
| server.html | `/server.html` | 200 | 8.38 ms | 28.9 ms | 60781 |
| ready | `/api/ready` | 200 | 2.5 ms | 2.66 ms | 719 |
| release-readiness | `/api/v1/release/readiness` | 200 | 4.72 ms | 6.59 ms | 4888 |
| source-status | `/api/source/status` | 200 | 3.49 ms | 4.39 ms | 7409 |
| integration-manifest | `/api/v1/integration/manifest` | 200 | 2.17 ms | 2.46 ms | 4012 |
| integration-sdk | `/api/v1/integration/sdk` | 200 | 2.18 ms | 2.46 ms | 3770 |
| integration-prompts | `/api/v1/integration/prompts` | 200 | 2.2 ms | 2.77 ms | 2057 |
| server-metrics | `/api/server/metrics` | 200 | 4.69 ms | 5.71 ms | 107951 |
| server-tests-quick | `/api/server/tests?mode=quick` | 200 | 50.14 ms | 53.38 ms | 18243 |
| asset-petr4-app | `/api/v1/asset?ticker=PETR4&view=app&profile=fast` | 200 | 5.14 ms | 6.18 ms | 31658 |
| engine-performance-petr4 | `/api/v1/engine/performance?ticker=PETR4&view=app&profile=fast` | 200 | 3.58 ms | 4.12 ms | 7174 |

## O que ainda pode aparecer sem informação após o deploy

Não é mais esperado que **Integração e guia** ou **Benchmark e diagnóstico** fiquem vazios. Porém estas áreas ainda podem mostrar avisos legítimos:

- **Feed de saída vazio:** significa que nenhum app/rota de dados passou por aquela mesma instância do proxy. Gere `/api/v1/asset?ticker=PETR4&view=app` ou use o botão “Gerar saída teste”.
- **Cotação/dividendos/fundamentos vazios:** significa que as fontes externas não entregaram dados naquele momento. O payload ainda vem seguro como `PARTIAL`, mas o app deve preservar o último snapshot bom.
- **Vercel local/indefinido:** aparece em teste local. Em produção, deve mostrar host/região quando a requisição realmente passar pela Vercel.
- **Histórico some depois de um tempo:** esperado no modo gratuito sem persistência externa.

## Checklist de lançamento hoje

Configure no Vercel:

```env
VALORAE_PUBLIC_BASE_URL=https://seu-deploy.vercel.app
PUBLIC_BASE_URL=https://seu-deploy.vercel.app
VALORAE_PERSONAL_MODE=true
VALORAE_DEFAULT_ASSET_VIEW=app
VALORAE_DEFAULT_ASSETS_VIEW=app
```

Depois valide no domínio publicado:

```text
/server.html#integration
/server.html#diagnostics
/api/server/metrics
/api/server/tests?mode=quick
/api/v1/integration/manifest
/api/v1/integration/sdk
/api/v1/integration/prompts
/api/v1/asset?ticker=PETR4&view=app&profile=fast
/api/v1/engine/performance?ticker=PETR4&view=app&profile=fast
```

## Conclusão

A versão `v21.12.35-monitor-data-fill` é a recomendada para publicar. Ela corrige o problema prático que você percebeu: o app agora se comporta mais como um monitor real do proxy e deixa claro quando não há tráfego real, quando a API está viva e quando os dados financeiros estão parciais por fonte externa.

Para uso pessoal hoje: **aprovado**, com a ressalva de validar fontes reais e tráfego no domínio Vercel final.
