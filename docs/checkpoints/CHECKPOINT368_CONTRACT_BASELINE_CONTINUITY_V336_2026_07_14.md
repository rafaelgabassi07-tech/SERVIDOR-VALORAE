# Checkpoint 368 — Contract baseline continuity v336

## Pareamento

- Proxy: `21.12.368-contract-baseline-continuity-v336`
- APK: `2026.07.14.03` / v516
- Baseline: `2026.07.14-checkpoint106-v1`

## Escopo

- Manifesto de contratos atuais.
- Matriz de ativos representativa.
- Snapshots dourados de forma.
- Avaliação de campos obrigatórios.
- Detecção de perda e mudança de tipo.
- Continuidade do último payload compatível por identidade SHA-256.
- Header e metadados consumíveis pelo APK.
- Proteção cliente da página Análise, modal universal, modais tipados, Retorno e Histórico.
- Rejeição de baseline divergente quando existe snapshot anterior compatível.
- Idade do último payload nativo não é renovada por respostas recuperadas.

## Limites intencionais

Este checkpoint não substitui parsers nem fontes. Ele cria o gate de não regressão obrigatório para os próximos checkpoints. O store é local à instância e temporário; persistência distribuída será tratada em checkpoint posterior.

## Validação final

- Build seguro para Vercel aprovado.
- 418 arquivos JavaScript verificados sintaticamente.
- 219 arquivos de teste sem falhas.
- Auditoria de versão aprovada.
- 25 testes APK↔Proxy sem falhas.
- APK pareado: 202 arquivos Kotlin e 46 checkpoints aprovados.
