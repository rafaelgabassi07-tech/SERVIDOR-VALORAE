# Auditoria v21.12.4 — Consumer Source Diagnostics

## Objetivo

Evitar telas vazias no APK/Web quando o proxy recebeu dados parciais, fonte bloqueada, cache stale ou payload com formatos diferentes. Esta etapa adiciona um mapa explícito de consumo para o app, sem desmembrar `lib/Valorae-engine.js`.

## Arquivos alterados

- `lib/quality/consumer-diagnostics.js`
- `lib/Valorae-engine.js`
- `lib/quality/data-quality.js`
- `routes/fields.js`
- `routes/openapi.js`
- `test/consumer-diagnostics-v21-12-4.test.js`
- `package.json`

## Novo campo de payload

`consumerDiagnostics` passa a ser entregue pelo engine com:

- `captureScore`: pontuação de 0 a 100 para indicar se o app tem dados suficientes para renderizar.
- `sourceAttempts`: resumo das fontes tentadas, bloqueios, falhas, HTML captado e tentativas por provedor.
- `dataMap`: chaves brutas, seções, campos normalizados, séries de gráficos e estados de painel.
- `priorityPaths`: caminhos preferenciais por painel, com `availablePaths` e `missingPaths`.
- `appContract`: contrato de fallback para o APK/Web não apagar dashboard quando apenas parte dos dados chegar.
- `recommendations`: mensagens práticas para UI/proxy em cenários de bloqueio, cache ou payload parcial.

## Correção de confiabilidade de fonte

`buildSourceReliabilityMatrix` agora interpreta corretamente os estados reais vindos do circuit breaker:

- `healthy`
- `degraded`
- `cooldown`
- `untested`

Também foi corrigida a divergência entre `BCB` no catálogo e `BancoCentral` no snapshot de provedores.

## Impacto no app

A ordem recomendada de consumo agora é:

1. `panelReadiness`
2. `consumerDiagnostics.priorityPaths`
3. `chartSeries.series`
4. `normalized`
5. `results`
6. `warnings`

Com isso, o app consegue saber o que renderizar, o que esconder, onde fazer fallback e quando exibir aviso de dados parciais.

## Validações

Executadas com sucesso:

```bash
node test/consumer-diagnostics-v21-12-4.test.js
npm run check
npm test
npm run audit:vercel-api
npm run audit:dashboard-live
npm run audit:live-endpoints
npm run audit:single-app
npm run build
```
