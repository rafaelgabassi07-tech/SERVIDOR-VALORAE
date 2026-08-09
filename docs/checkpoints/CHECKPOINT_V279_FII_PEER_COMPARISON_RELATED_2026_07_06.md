# Checkpoint Proxy v279 — Comparando com outros FIIs via FIIs Relacionados reais

Patch: `21.12.308-fii-peer-comparison-related-v279`  
Contrato FII: `26.asset-modal.fii.v23`

## Auditoria

A página atual do Investidor10 pode exibir o bloco `COMPARANDO COM OUTROS FIIS` somente com filtros/cabeçalhos no HTML capturado. As linhas completas da tabela renderizada não aparecem em todos os cenários, enquanto a seção `FIIs Relacionados` permanece disponível com tickers, DY e P/VP reais.

## Correção

- Prioridade preservada: tabela renderizada do comparador, quando houver linhas.
- Recuperação de fonte real: `FIIs Relacionados` da mesma página quando a tabela vier vazia.
- Tipo/segmento são extraídos da seção `Média do Tipo e Segmento` quando disponível.
- Valor Patrimonial dos pares relacionados fica `—` quando a fonte não expõe o valor.
- Sem lista fixa, sem mock e sem substituição por GGRC11.

## Validação

- `node test/fii-modal-peer-comparison-v198.test.js`
- `node test/fii-modal-peer-related-fallback-v200.test.js`
- `npm run build`
- `npm run check:syntax`
- `npm test`
- auditorias de versão
