# Correção definitiva do gerenciador de pacotes no Vercel

## Erro observado

`Command "pnpm install" exited with 1`

O pacote também já havia registrado anteriormente:

`ERR_PNPM_OUTDATED_LOCKFILE: Cannot install with frozen-lockfile because pnpm-lock.yaml is not up to date with package.json`

## Causa confirmada

O projeto ainda continha simultaneamente `pnpm-lock.yaml` e `package-lock.json`, apesar de o `package.json` declarar `packageManager: npm@10.9.2` e de a documentação anterior afirmar que o lockfile do PNPM havia sido removido.

A presença de `pnpm-lock.yaml` fazia o Vercel detectar PNPM e executar `pnpm install`, criando uma configuração contraditória com o contrato npm do projeto.

## Correção aplicada

- removido `pnpm-lock.yaml`;
- mantido `package-lock.json` como único lockfile;
- mantido `packageManager: npm@10.9.2` no `package.json`;
- definido `installCommand: npm ci` no `vercel.json` para impedir autodetecção incorreta;
- incluído o schema oficial do `vercel.json`;
- atualizado o teste de regressão para exigir configuração npm-only e rejeitar lockfiles concorrentes;
- conferidas `dependencies`, `devDependencies` e `optionalDependencies` entre `package.json` e `package-lock.json`.

## Validação

- build seguro do Vercel: aprovado;
- sintaxe JavaScript: 525 arquivos aprovados;
- estabilidade do `package-lock.json` com `npm install --package-lock-only --offline`: aprovada, sem alterações;
- teste de consistência npm-only: aprovado;
- suíte sem dependências instaladas: 182 aprovados, 107 bloqueados por `cheerio`/`undici`, 0 falhas;
- auditorias de versão e alcançabilidade: aprovadas;
- arquivos JSON de configuração: válidos.

A execução integral de `npm ci` neste ambiente foi impedida por erro HTTP 503 do registro interno de pacotes usado pela sandbox, não por inconsistência do projeto. O lockfile foi validado sem alteração por resolução offline de metadados.

O próximo deploy deverá executar `npm ci`, sem tentar `pnpm install`.
