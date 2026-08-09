# Checkpoint v301 — Asset modal progressivo fast/full

## Diagnóstico

A auditoria encontrou desalinhamento crítico entre APK e Proxy: o APK estava abrindo os modais com contrato completo e o Proxy também convertia `stage=fast`/`essential` para `full`. Na prática, o usuário aguardava todas as fontes pesadas do modal de ação antes de ver o primeiro conteúdo, aumentando a chance de timeout percebido.

## Correções

- `asset-modal-runtime.js` passa a diferenciar `fast` e `full` em deadline, cache e coalescing.
- `stock-modal-contract.js` respeita `stage=fast`, usa orçamento menor de timeout e deixa comparadores, histórico longo, comunicados/PDFs e extras REST pesados para o `stage=full`.
- `fii-modal-contract.js` segue o mesmo padrão progressivo para manter paridade com ação.
- `asset-modal-progressive-alignment-v301.test.js` valida o contrato cruzado lendo marcadores do APK e do Proxy, impedindo regressão para full-only.

## Validação

- `npm run build`
- `npm run check:syntax`
- `npm test` — 173 arquivos, 0 falhas
- `npm run audit:version`
- `unzip -t` no ZIP final
