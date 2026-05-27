# Valorae Proxy v21.5.13 — refinamento visual, navegação compacta e PWA

Esta revisão melhora a experiência visual do aplicativo sem alterar o núcleo `lib/Valorae-engine.js`.

## Interface

- Menu lateral reduzido e reorganizado por grupos: Monitoramento, Operação e Ferramentas.
- Paleta lateral mais suave no modo claro e no modo escuro.
- Logo profissional em SVG aplicado no app e nos ícones.
- Cards, gráficos e grids refinados para melhor leitura em desktop, tablet e mobile.
- Menu mobile como drawer compacto, sem ocupar a tela inteira.

## PWA instalável

O app agora inclui:

- `public/manifest.webmanifest`
- `public/sw.js`
- ícones PNG `192x192`, `512x512` e `apple-touch-icon`
- registro de Service Worker no navegador
- botão de instalação na página Configurações quando o navegador disponibiliza o prompt

## Segurança da medição

O Service Worker não intercepta nem cacheia `/api/*`. Dados de observability, health, ready, scraping e endpoints do Proxy continuam sempre vindo da rede, evitando métricas antigas ou cacheadas.

## Cache

- App shell: cache versionado para instalação PWA.
- APIs do Proxy: network-only.
- `sw.js` e `manifest.webmanifest`: `no-cache`.
- `index.html`: continua sem cache agressivo para reduzir conflito após redeploy.
