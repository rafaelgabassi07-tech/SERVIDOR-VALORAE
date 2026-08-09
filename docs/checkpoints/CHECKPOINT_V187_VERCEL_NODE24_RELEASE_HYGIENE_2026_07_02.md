# Proxy v187 — Compatibilidade Vercel Node 24 e higiene de release

- Atualiza package.json para engines.node = 24.x, removendo o aviso/depreciação do Vercel.
- Mantém build-vercel-safe bloqueando .bak, .tmp, .orig, ~ e .DS_Store.
- Confirma que a release final não contém lib/analysis/analysis-page-response.js.bak nem outros artefatos temporários.
- Mantém a rota /api/v1/analysis compatível com os ajustes do APK v307.
