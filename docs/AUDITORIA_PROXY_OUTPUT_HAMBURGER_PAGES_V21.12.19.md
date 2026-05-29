# Auditoria v21.12.19 — Página-servidor com menu hambúrguer lateral

## Objetivo

Transformar a página visual do Valorae Proxy Output Server em uma experiência mais próxima de um painel de servidor, com páginas acomodadas em menu hambúrguer lateral e leitura mais organizada de tudo que sai do proxy para apps/usuários.

## Melhorias aplicadas

- Recriação de `public/server.html` e `public/index.html` com layout de shell responsivo.
- Menu hambúrguer lateral com páginas internas:
  - Visão geral
  - Feed de saída
  - Gráficos
  - Rotas e apps
  - Pipeline
  - Diagnóstico
- Melhor adaptação mobile/desktop:
  - drawer lateral no desktop;
  - menu off-canvas em tablets/celulares;
  - overlay de fechamento;
  - cards e tabelas reorganizados em telas menores.
- Feed de saída agora possui filtros por:
  - rota/ticker/app/canal;
  - família de status HTTP;
  - raiz de payload (`appPayload`, `appMobileSnapshot`, `chartSeries`, `normalized`);
  - ordenação por recente, bytes ou latência.
- Função `refresh()` reforçada:
  - timeout com `AbortController`;
  - modo pausado;
  - fallback para último snapshot salvo em `localStorage`;
  - atualização silenciosa para polling.
- Função `probe()` reforçada:
  - cria uma chamada real em `/api/asset`;
  - usa canal `proxy-output-probe` para aparecer no feed;
  - salva último ativo bom em `localStorage`;
  - mostra diagnóstico de raízes retornadas.
- Novas ferramentas do painel:
  - pausar/retomar polling;
  - exportar JSON atual;
  - exportar feed em CSV;
  - limpar filtros.

## Compatibilidade

- Sem dependências novas.
- Compatível com Vercel Free.
- Sem banco, Redis, KV ou WebSocket.
- `index.html` continua espelhando `server.html`.
- Mantidos textos/contratos esperados por testes anteriores: `proxyOutputMonitor`, `outputFeed`, `routeOutputs`, `Gerar saída teste`, `proxy-output-probe`, `/api/server/metrics`, `/api/asset`, `appMobileSnapshot`, `appPayload` e `chartSeries`.

## Arquivos alterados

- `public/server.html`
- `public/index.html`
- `package.json`
- `metadata.json`
- `docs/CHANGELOG.md`
- `test/proxy-output-hamburger-pages-v21-12-19.test.js`

## Validação

- Teste novo: `node test/proxy-output-hamburger-pages-v21-12-19.test.js`
- A página permanece abaixo do limite de peso dos testes de Vercel/mobile.
