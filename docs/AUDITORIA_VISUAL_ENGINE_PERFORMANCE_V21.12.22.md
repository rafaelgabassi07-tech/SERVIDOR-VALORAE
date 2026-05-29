# Auditoria v21.12.22 — Polimento visual e desempenho do Valorae Engine

## Objetivo

Reduzir a poluição visual do monitor, diminuir o cabeçalho, organizar melhor as páginas e verificar pontos seguros de ganho de desempenho no `lib/Valorae-engine.js` sem dividir ou remover o núcleo central.

## Interface

- Cabeçalho reduzido para aproximadamente 58px em desktop, removendo excesso visual.
- Menu lateral mantido por categorias, com páginas mais limpas e explicações curtas.
- Cards, tabelas, filtros e gráficos receberam espaçamentos menores e hierarquia visual mais sóbria.
- Paleta consolidada em tons de verde e cinza.
- Logotipo permanece alinhado à proposta de proxy/fluxo/distribuição.
- O teste de ticker permanece apenas na página de benchmark, não no cabeçalho.
- Foi adicionada pausa automática de polling quando a aba fica invisível, reduzindo custo no navegador.

## Engine

O `Valorae-engine.js` foi preservado como núcleo central. As alterações foram pontuais e seguras:

- Removida duplicação de helper interno `safeText`.
- Adicionado empacotamento de cache de resultado em passagem única (`single-json-pass`): clona e mede bytes usando a mesma serialização, reduzindo trabalho duplicado antes de gravar no cache final.
- Adicionado orçamento de séries de gráficos por perfil/view:
  - `instant`: até 4 séries.
  - `compact/mobile/watchlist/list` e perfis `fast/portfolio`: até 6 séries.
  - `standard`: até 8 séries.
  - `deep`: até 12 séries.
- O payload passa a registrar `metrics.engineOptimizations` e `performance.optimizations`, facilitando auditoria nos painéis.

## Por que isso melhora desempenho

A maior latência continua dependendo de rede e fontes públicas, mas a etapa local agora evita trabalho redundante no cache e reduz processamento/memória para views mobile/compactas. Isso melhora a velocidade em respostas quentes, listas, watchlists e primeira pintura mobile.

## Limites honestos

No Vercel Free, o processamento continua limitado pelo runtime serverless e pela telemetria em memória da instância atual. A melhoria aumenta eficiência local e reduz peso, mas não cria banco, fila, workers persistentes ou processamento paralelo externo.
