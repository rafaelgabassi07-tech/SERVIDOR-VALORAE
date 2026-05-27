# Valorae Proxy v21.5.13 — Launch Ready

Versão consolidada para lançamento no GitHub/Vercel free-only.

## Ajustes finais aplicados

- Nome público preservado como **Valorae Proxy**.
- `.env.example` seguro restaurado e mantido fora de segredos reais.
- `.gitignore` e `.vercelignore` ajustados para não bloquear `.env.example`.
- `package-lock.json` corrigido para formato válido sem dependências externas.
- `vercel.json` reforçado com `Cache-Control: no-store` para `/` e `/index.html`, reduzindo conflito com cache de versões antigas do app.
- Dashboard com saneamento de estado local: remove chaves antigas `valorae-*` incompatíveis, preservando apenas o tema claro/escuro válido.
- Service workers e caches antigos do mesmo origin são desregistrados quando relacionados ao Valorae/Proxy, evitando tela preta causada por app antigo sobreposto.
- Observability validada como extensão do Proxy, medindo metadados reais de `/api/*` sem armazenar corpo de resposta nem IP bruto.

## Validações finais

- `npm run build`
- `npm run check`
- `npm test`
- `npm run smoke`
- `npm run verify`
- `npm run build:strict`
- `npm run audit:observability`

## Observação operacional

As métricas são mantidas em memória para preservar o modelo free-only. Em Vercel/serverless, elas podem ser efêmeras e por instância. Para histórico persistente de longo prazo seria necessário storage externo, que não foi adicionado para manter o projeto simples, gratuito e sem recursos pagos.
