# Auditoria do App Servidor Proxy — v21.10.1

Esta revisão avaliou o painel servidor, as páginas, a interceptação global do Proxy, os gráficos, o endpoint `/api/server/metrics`, os downloads de integração e o contrato gratuito para GitHub/Vercel.

## Resultado da apuração

O servidor já estava funcional, mas a camada visual e a observabilidade ainda podiam amadurecer em quatro pontos:

1. Faltavam janelas operacionais para leitura de curto prazo: 1, 5 e 15 minutos.
2. Faltavam métricas de SLO para explicar saúde de servidor além de contadores brutos.
3. Faltavam histogramas para entender distribuição de latência e tamanho de payload.
4. A interface podia ganhar uma página própria de performance, filtros de eventos e pausa automática quando a aba fica invisível.

## Melhorias aplicadas

- Nova página **Performance e SLO** no menu lateral.
- Novas métricas derivadas no JSON do servidor:
  - `availabilityPercent`
  - `completionRatePercent`
  - `avgBytesIn`
  - `bytesIn`
  - janelas `oneMinute`, `fiveMinutes`, `fifteenMinutes`
  - histogramas de latência
  - histogramas de payload de saída
  - checklist `readiness`
- Medição de bytes de entrada usando `content-length` quando disponível.
- Amostras de payload de saída para estatística de distribuição.
- Detalhamento por rota com:
  - taxa de sucesso
  - payload médio
  - taxa de conclusão
- Visual MD3 refinado:
  - paleta cinza/verde mais consistente
  - cards mais limpos
  - filtros de eventos
  - pausa/retomada de atualização
  - pausa automática com aba invisível
  - suporte a `prefers-reduced-motion`
  - skeleton inicial em seções de dados
- Mantida a compatibilidade com Vercel gratuito:
  - sem Redis
  - sem KV
  - sem banco
  - sem WebSocket
  - sem cron obrigatório
  - sem dependências externas obrigatórias

## Observações operacionais

As métricas continuam em memória por instância serverless. Isso é intencional para preservar o uso gratuito. Em produção, os contadores podem reiniciar em cold start, troca de instância ou novo deploy.

## Validações executadas

- `npm run check`
- `npm run build`
- `npm test`
- `npm run smoke`
- teste local real com `server.js`, `/server.html`, `/api/health`, `/api/asset?ticker=PETR4` e `/api/server/metrics`

## Conclusão

O app servidor agora cobre monitoramento, didática operacional, integração de terceiros, tecnologia do Engine, diagnóstico, eventos, rotas, dispositivos, performance e SLO sem adicionar tecnologia paga ou incompatível com o Vercel Free.
