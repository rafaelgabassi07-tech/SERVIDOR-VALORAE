# Checkpoint 369 — Field Observability v337

## Objetivo

Rastrear origem, método, confiança, cache, fallback e tempo das informações sem alterar o contrato financeiro consumido pelo APK.

## Política

- Versão: `2026.07.14-checkpoint107-v1`.
- Envelope compacto: no máximo 10 campos de amostra e 6 tempos de fonte.
- Trilha completa: store local LRU de 64 entradas, validade de 15 minutos, consultável por `traceId`.
- Dados excluídos: HTML bruto, corpos de requisição, segredos, tokens e dados pessoais.
- Ordem: o baseline estabiliza o payload antes da observabilidade.
- Interface: `hiddenFromUi=true`; nenhum metadado altera valores financeiros.

## Rotas

`/api/v1/contract/observability` retorna o manifesto ou uma trilha específica quando recebe `traceId`.

## Compatibilidade

O APK v517 envia `X-Valorae-Observability-Accept: field-lineage-v1`, captura os headers e mantém o envelope apenas para diagnóstico.

## Validação final

- Build Vercel aprovado.
- 420 arquivos JavaScript verificados.
- 220 arquivos de teste aprovados.
- 26 testes cross-stack aprovados.
- Medição de referência: 44.092 → 49.789 bytes (+12,92%) em 5,28 ms.
