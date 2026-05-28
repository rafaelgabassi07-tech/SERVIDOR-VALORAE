# VALORAE Proxy Server — Engine, Integração e Maturidade Visual

Esta versão adiciona duas áreas importantes ao painel `/server.html`:

1. **VALORAE Engine** — página didática explicando o que o núcleo faz, quais tecnologias usa e quais dados pode entregar.
2. **Integração terceiro** — página com instruções, exemplos, prompt pronto e botões de download para acelerar conexão com APK, Web App ou backend consumidor.

## Página VALORAE Engine

Explica o fluxo operacional:

```txt
Cliente terceiro → /api → Router → VALORAE Engine → JSON normalizado → App consumidor
```

A página documenta:

- contratos JSON;
- tempo real por HTTP polling;
- segurança serverless;
- compatibilidade com rotas legadas;
- dados de ativos, carteiras, rankings, notícias, cache, fonte e diagnóstico;
- observabilidade de latência, status, bytes, rota, método, dispositivo e eventos.

## Página Integração terceiro

Inclui:

- URL base do proxy;
- endpoints principais;
- estados recomendados no app consumidor;
- prompt pronto para IA/codificador;
- exemplo Web;
- botões de download do kit de integração.

Arquivos disponíveis em `/downloads`:

- `README_INTEGRACAO.md`
- `VALORAE_INTEGRATION_PROMPT.md`
- `valorae-client-web.js`
- `valorae-android-kotlin.kt`
- `valorae-api-contract.json`

## Visual

O painel foi polido para um visual mais maduro, limpo e profissional:

- Material Design 3;
- paleta cinza/verde;
- cards maiores e mais respirados;
- navegação por páginas no menu hambúrguer lateral;
- gráficos em Canvas com grade cinza e dados em verde;
- textos didáticos para operação e integração.

## Compatibilidade

A implementação continua compatível com Vercel gratuito:

- sem banco;
- sem Redis;
- sem KV;
- sem WebSocket;
- sem cron;
- sem dependências pagas;
- métricas em memória por instância serverless.
