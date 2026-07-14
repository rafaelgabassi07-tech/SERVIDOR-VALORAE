# Proxy 21.12.364 / v332 — Variação mensal, logotipos oficiais e índices do Retorno

## Alterações

- Série mensal mantém timestamps reais e usa carry por custo contábil somente na componente sem cotação, marcada como parcial.
- Série intradiária continua estrita e descarta instantes sem cobertura integral.
- `/api/v1/asset/logo` pode ser consumida pelo Coil sem expor a chave privada do Proxy.
- Demais rotas permanecem protegidas pela autenticação global.
- Benchmarks usam a profundidade da janela exibida, não a profundidade ampla do histórico da carteira.
- Aliases de SMLL e IDIV são deduplicados.

## Pareamento

- APK v512 / Checkpoint 102
- Mobile protocol `2026.07.10.10`
- Portfolio history `v332`

## Validação final

- Build Vercel aprovado.
- 411 arquivos JavaScript verificados sintaticamente.
- 214 arquivos de teste do Proxy aprovados, sem falhas.
- 23 testes cross-stack APK↔Proxy aprovados, sem falhas.
- A rota pública de logo mantém autenticação obrigatória nas rotas de dados, além de rate limit, método e validação de ticker.
