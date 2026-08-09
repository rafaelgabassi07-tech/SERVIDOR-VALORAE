# Hotfix Checkpoint 378 — sincronização do pnpm-lock no Vercel

Data: 2026-07-15  
Release funcional preservada: `21.12.378-final-decomposition-v346`

## Falha corrigida

O `package.json` declarava `undici` em `dependencies`, mas o importador raiz do `pnpm-lock.yaml` ainda continha somente `ajv` e `cheerio`. O pacote `undici@7.28.0` já existia nas seções `packages` e `snapshots`, portanto a falha era restrita ao vínculo do importador raiz.

O Vercel executa `pnpm install` com lockfile congelado e interrompia o deploy com `ERR_PNPM_OUTDATED_LOCKFILE` antes do build.

## Correção

- Adicionado `undici` ao importador raiz do `pnpm-lock.yaml` com o mesmo specifier de `package.json` e a resolução `7.28.0` já registrada no lockfile.
- `package-lock.json` foi preservado e confirmado como sincronizado.
- Adicionado teste de consistência entre `package.json`, `package-lock.json` e o importador raiz do `pnpm-lock.yaml`.
- Nenhuma rota, contrato, fonte, cache, variável de ambiente ou comportamento financeiro foi alterado.

## Evidências

- Validação estrutural dos dois lockfiles aprovada.
- Teste `test/vercel-lockfile-consistency-v346.test.js` aprovado.
- Build Vercel seguro aprovado.
- Sintaxe dos arquivos JavaScript aprovada.
