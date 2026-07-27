# Correção do lockfile do Vercel

## Erro corrigido

`ERR_PNPM_OUTDATED_LOCKFILE: Cannot install with frozen-lockfile because pnpm-lock.yaml is not up to date with package.json`

## Causa

O projeto continha simultaneamente `pnpm-lock.yaml` e `package-lock.json`. O Vercel selecionou PNPM por causa do arquivo `pnpm-lock.yaml`, embora o contrato de dependências atualmente validado esteja no `package-lock.json`.

## Correção

- removido `pnpm-lock.yaml`;
- mantido `package-lock.json` como único lockfile;
- definido `packageManager: npm@10.9.2` no `package.json`;
- dependências, dependências opcionais e dependências de desenvolvimento conferidas entre `package.json` e `package-lock.json`;
- build seguro do Vercel e validação de sintaxe executados.

O Vercel deverá usar `npm install`/`npm ci`, sem tentar `pnpm install --frozen-lockfile`.
