# Checkpoint 374 / v342 — Formal schema validation

## Objetivo
Formalizar os contratos críticos com JSON Schema Draft 2020-12 e impedir que respostas estruturalmente inválidas substituam o último payload válido consumido pelo APK.

## Implementação
- Ajv 8.20.0 em modo estrito e `allErrors`.
- Schemas aditivos, com `additionalProperties: true`, sem remoção, coerção ou defaults.
- Guardião `guard-last-good` integrado ao store do Checkpoint 106.
- Validação de requisições em `shadow` por padrão.
- Metadado `contractSchemaValidation` oculto da interface e excluído do ETag financeiro.
- Endpoint `/api/v1/contract/formal-schemas`.

## Rollback
- `VALORAE_FORMAL_SCHEMA_VALIDATION_ENABLED=0`
- `VALORAE_FORMAL_SCHEMA_MODE=shadow`
- `VALORAE_FORMAL_REQUEST_SCHEMA_MODE=shadow`

## Compatibilidade
Nenhum campo financeiro, lista, série, unidade ou nome de contrato foi removido. O APK v522 interpreta apenas o manifesto e preserva o snapshot anterior quando a validação formal indicar risco.

## Validação final
- Build Vercel aprovado.
- 440 arquivos JavaScript verificados.
- 227 arquivos de teste aprovados.
- 30 testes APK↔Proxy aprovados.
- 52 checkpoints do APK aprovados.
