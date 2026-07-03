# Proxy v188 — Limpeza automática de artefatos temporários no Vercel

Correção focada no erro persistente do Vercel:

```text
Artefatos temporários/de backup não devem ir para release: lib/analysis/analysis-page-response.js.bak
```

## Mudanças

- `scripts/build-vercel-safe.js` agora remove automaticamente arquivos `.bak`, `.tmp`, `.orig`, sufixo `~` e `.DS_Store` antes da validação final.
- A validação continua existindo depois da limpeza para bloquear qualquer artefato que não possa ser removido.
- `.gitignore` e `.vercelignore` agora também bloqueiam `.bak`, `.tmp`, `.orig` e `*~`.
- `package-lock.json` alinhado ao core `21.12.0` e Node `24.x`.
- Runtime Vercel mantido em Node.js 24.x.

## Impacto

Se o contexto de build do Vercel ainda carregar um arquivo antigo como `lib/analysis/analysis-page-response.js.bak`, o próprio build remove esse arquivo antes da checagem e não falha mais por esse motivo.
