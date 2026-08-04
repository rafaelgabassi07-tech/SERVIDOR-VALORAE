# Correção do monitor — árvore estática APK → Proxy

Data: 2026-08-04

## Causa

A seção “Árvore completa do fluxo APK ↔ Proxy” dependia de JavaScript para criar nós, arestas, filtros, zoom e modal de detalhes. O HTML inicial continha apenas contêineres vazios. Quando o script não era carregado ou inicializado, o fluxo não aparecia. Isso também contradizia a descrição do próprio monitor como documento estático sem JavaScript.

## Correção

- Removido o canvas interativo e o arquivo `public/ecosystem-flow-map.js`.
- CSP alterada para `script-src 'none'` e mantida com `connect-src 'none'`.
- Criada árvore HTML permanente com origem Android, decisão local/remota, gateway, 17 endpoints, fontes, cache, fallback, resposta e falhas.
- Todas as informações ficam visíveis sem clique, busca, zoom, modal, telemetria ou rede.
- Layout responsivo para desktop e dispositivos móveis, com tema claro/escuro.
- Identificador do monitor atualizado para `static-flow-v402`.

## Escopo

Nenhuma rota, contrato financeiro, banco, regra de sincronização ou lógica do Proxy foi modificada.
