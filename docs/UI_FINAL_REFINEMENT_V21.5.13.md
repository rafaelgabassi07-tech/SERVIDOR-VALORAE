# Valorae Proxy v21.5.13 — Refinamento final de interface, tecnologia e teste real

Esta revisão separa as responsabilidades do aplicativo visual para evitar páginas misturadas ou elementos decorativos.

## Ajustes aplicados

- A página **Tecnologia** passou a ser uma documentação operacional robusta sobre arquitetura, scraping VALORAE, contrato HTTP/JSON, observability, privacidade, integração de terceiros e limites do modo gratuito.
- A página **Teste Real** permanece dedicada apenas a executar chamadas reais no servidor e exibir os resultados da execução.
- O bloco lateral antigo foi substituído por um painel de runtime do Proxy com métricas reais e uma ação objetiva para executar teste real.
- O rodapé lateral agora abre a página **Configurações**.
- A versão técnica longa da observability deixou de poluir a interface; a UI exibe a versão pública curta, mantendo o identificador técnico apenas no diagnóstico.
- O status “Operacional” no cabeçalho agora é clicável e abre **Infraestrutura**, onde os probes reais de health/ready são exibidos.
- A página **Configurações** permite controlar tema, auto-refresh, intervalo de polling, limpeza de estado local e cópia de diagnóstico JSON.

## Garantias mantidas

- O núcleo `lib/Valorae-engine.js` foi preservado.
- O app continua free-only, sem Redis, KV, banco externo, WebSocket ou dependências pagas.
- Métricas não mensuráveis sem serviços externos continuam exibidas como “não medido”.
- O painel não armazena corpo de request/response nem conteúdo dos arquivos entregues.
