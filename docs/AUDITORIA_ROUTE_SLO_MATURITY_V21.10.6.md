# Auditoria Route/SLO Maturity v21.10.6

Esta versão continua a evolução da v21.10.5 preservando a arquitetura serverless gratuita e o `Valorae-engine.js` como núcleo central.

## Melhorias aplicadas

- Métricas por rota agora incluem p50, p95 e p99 de latência.
- Cada rota mantém mapa resumido de status HTTP observados.
- Cada rota mantém cache/fonte mais frequentes quando declarados.
- Métricas globais agora expõem alvo SLO de disponibilidade, alvo SLO de p95 e orçamento de erro consumido.
- Painel passou a mostrar orçamento SLO e tempo desde o último tráfego real.
- Diagnóstico passou a explicar quando o painel está aberto mas não há tráfego externo real.
- Respostas sem corpo, como HEAD/204/304, são contabilizadas em `bodylessResponses`.
- Limpezas defensivas de requisições antigas em voo agora incrementam `staleActiveCleanups`.
- Service Worker atualizado para cache v21.10.6.

## Correção preventiva

O endpoint `/api/server/metrics` continua isolado. Chamadas do próprio painel não entram em:

- requisições;
- respostas;
- status HTTP;
- rotas;
- cache/fonte;
- eventos;
- clientes.

## Novo teste

```bash
npm run audit:route-slo
```

O teste valida isolamento da telemetria, contagem real de `/api/asset`, status 304 sem corpo, p95 por rota, mapa de status por rota e readiness de SLO.
