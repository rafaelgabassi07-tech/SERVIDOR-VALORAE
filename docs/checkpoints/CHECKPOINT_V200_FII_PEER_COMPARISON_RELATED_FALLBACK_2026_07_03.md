# Checkpoint v200 — Correção do comparador com outros FIIs

Proxy public version: 21.12.230  
Release patch: 21.12.230-fii-peer-comparison-related-fallback-v200

## Diagnóstico

A página do Investidor10 para GGRC11 traz o título **COMPARANDO COM OUTROS FIIS** e os filtros da tabela, mas no HTML estático retornado ao Proxy aparecem apenas cabeçalhos da tabela. As linhas vistas no navegador são renderizadas dinamicamente, por isso o parser anterior concluía `rows: []` e o APK exibia a mensagem de indisponibilidade.

## Correção

- Contrato atualizado para `26.asset-modal.fii.v8`.
- O parser direto da tabela continua ativo para quando o HTML vier completo.
- Quando a tabela vier sem linhas, o Proxy passa a montar `peerComparison` usando **FIIs Relacionados** do próprio Investidor10.
- Para cada par relacionado, o Proxy tenta enriquecer os dados pela página individual do FII no Investidor10, preenchendo Valor Patrimonial, Tipo e Segmento.
- O bloco não volta mais vazio quando houver pares relacionados disponíveis.

## Validação

- `node --check lib/analysis/fii-modal-contract.js`
- `node test/fii-modal-peer-comparison-v198.test.js`
- `node test/fii-modal-peer-related-fallback-v200.test.js`
- `npm run check:syntax`
- `npm test`
- `npm run audit:version`
