# VALORAE Proxy Server — Configurações, PWA e identidade

Esta rodada adiciona a camada visual e operacional que faltava para o painel se comportar como um app servidor instalável.

## Incluído

- Página **Configurações** no menu lateral.
- Menu lateral organizado por categorias: Operação, Tráfego do Proxy, Tecnologia e Sistema.
- Tema claro, escuro e automático com persistência em `localStorage`.
- Suporte PWA com `manifest.webmanifest`, `service-worker.js` e ícones 192/512.
- Novo logotipo profissional em `public/assets/valorae-logo.svg`.
- Botões para instalar o app e baixar o logotipo.
- Controle de intervalo de atualização do painel em tempo real.

## Arquivos principais

- `public/server.html`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/assets/valorae-logo.svg`
- `public/assets/valorae-icon-192.png`
- `public/assets/valorae-icon-512.png`
- `server.js`

## Compatibilidade

A implementação continua sem dependências externas, sem banco, sem Redis, sem KV, sem WebSocket e sem recursos pagos. O service worker não intercepta rotas `/api`, para não congelar métricas em tempo real nem interferir no Proxy.
