# Auditoria de Telemetria Isolada — v21.10.4

## Problema encontrado
O dashboard `/server.html` atualiza os gráficos consultando `/api/server/metrics`. Essa consulta interna estava entrando na mesma camada de métricas usada para tráfego real, contaminando:

- Requisições
- Respostas
- Status HTTP
- Rotas mais usadas
- Eventos recentes
- Clientes recentes
- Cache vs fonte, principalmente com `unknown`

## Correção aplicada
A rota `/api/server/metrics` passou a ser classificada como telemetria interna. Ela continua respondendo normalmente para o painel, mas não é registrada nos contadores operacionais do proxy.

## Regras novas
- `/api/server/metrics` não incrementa `requests`.
- `/api/server/metrics` não incrementa `responses`.
- `/api/server/metrics` não entra em Status HTTP.
- `/api/server/metrics` não entra em Rotas.
- `/api/server/metrics` não entra em Eventos.
- `/api/server/metrics` não entra em Cache/Fonte.
- Endpoints reais, como `/api/health`, `/api/asset`, `/api/assets` e `/api/portfolio/*`, continuam sendo medidos.

## Cache vs fonte
Valores `unknown` não são mais adicionados ao gráfico de cache/fonte. O painel agora mostra somente respostas com classificação real de cache ou fonte, evitando leitura enganosa.

## Teste criado
Foi adicionado o script:

```bash
npm run audit:self-telemetry
```

Ele chama `/api/server/metrics` várias vezes e confirma que os contadores continuam zerados. Em seguida chama `/api/health` e confirma que uma rota real é contabilizada corretamente.

## Validação local real
Também foi testado com servidor local:

1. Cinco chamadas para `/api/server/metrics`.
2. Snapshot continuou com `requests = 0`, `responses = 0`, Status HTTP vazio, Cache/Fonte vazio.
3. Uma chamada para `/api/health`.
4. Snapshot passou para `requests = 1`, `responses = 1`, Status HTTP 200 e rota `/api/health`.

## Limitação conhecida
As métricas permanecem em memória por instância serverless para manter o projeto gratuito no Vercel. Ao fazer novo deploy, escalar ou esfriar a função, os contadores podem reiniciar.
