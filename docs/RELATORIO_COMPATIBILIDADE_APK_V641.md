# Proxy 21.12.404 — compatibilidade APK v641

APK pareado: `2026.08.09.04`.

A versão pública do Proxy permanece `21.12.404`. Não foram criadas novas rotas. A mudança de runtime relacionada à v641 está restrita ao hardening da faixa `/api/v1/market/indices`: ordem canônica dos oito itens, validação dos símbolos configurados e status de CDI/IPCA condicionado à presença de valor numérico real. O contrato de rankings semantic-v2 da v640 permanece inalterado.

Toda documentação gerada nesta release permanece em `docs/`.

## Resultado executado

- Teste específico v641 da faixa: aprovado.
- Teste dos oito itens da faixa: aprovado.
- `npm run build`: aprovado.
- Sintaxe: 438 arquivos JavaScript aprovados.
- Auditoria de versão: aprovada.
- Suíte completa: 282 testes, 178 aprovados, 100 bloqueados por dependências opcionais e as mesmas 4 falhas históricas presentes na baseline anterior; nenhuma falha nova.
