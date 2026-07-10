# Proxy v305 — Preview fast, cache completo e contexto isolado

## Resultado

Release `21.12.337-asset-modal-fast-cache-context-v305`, pareada ao APK v469.

## Correções

- O stage `fast` usa espera suave para Investidor10, histórico de cotação e logo. Ao atingir o orçamento de preview, o contrato continua sem bloquear; a Promise original não é cancelada e pode aquecer o cache compartilhado pelo `full`.
- Ação e FII aplicam a mesma política de preview e mantêm o deadline global como proteção final.
- Cache `full` útil passa a ter precedência sobre cache `fast` parcial ainda válido.
- `requestId` e `requestedStage` são recontextualizados depois do coalescing, evitando vazamento de metadados entre consumidores simultâneos.
- A lógica de utilidade do payload foi alinhada às seções de entrega: comparadores, posição acionária, demonstrativos, payout, comunicados e distribuições também impedem descarte de contrato útil.
- Valores ausentes não são mais convertidos por coerção em `R$ 0,00`/`0,00%`, reprovação de checklist, provento ou comparador zerado; um payload formado apenas por zeros sintéticos não recebe qualidade nem cache.

## Desempenho

- O preview deixa de esperar a tentativa completa de hosts alternativos do Yahoo ou o orçamento de 6,5 s da origem fundamentalista.
- O aquecimento de origem e o coalescing continuam ativos, evitando trocar velocidade por duplicação de scraping.
- Reaberturas aproveitam primeiro o contrato `full` já pronto.

## Compatibilidade

- Gateway `/api/v1/asset/modal` permanece na versão `26.asset-modal.gateway.v1`.
- Delivery permanece no schema v2.
- Rotas tipadas antigas continuam disponíveis.
- Nenhum fallback financeiro estático foi adicionado.

## Validação executada

- `npm run verify`: build Vercel-safe, 368 arquivos JS, 177 arquivos de teste, 0 falhas e auditoria de versão aprovada.
- `node test/asset-modal-fast-cache-context-v305.test.js`: aprovado.
- Smoke offline de PETR4, TAEE11 e MXRF11: famílias corretas, requestId individual, sem coerção de zero e sem cache de payload vazio.
- Validadores do APK v469 e parser sintático Kotlin: aprovados.
- ZIP final validado separadamente no empacotamento.
