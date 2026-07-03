# Checkpoint v214 — Auditoria do modal único de FIIs

Data: 2026-07-03  
Contrato: `26.asset-modal.fii.v21`  
Proxy patch: `21.12.244-fii-modal-full-audit-v214`

## Correções

- Checklist Buy and Hold deixou de depender de qualquer informação da carteira do usuário.
- Quando o HTML público do Investidor10 não trouxer a seção de checklist completa, o Proxy deriva os critérios a partir das métricas já carregadas no próprio modal: tempo listado, DY médio 5 anos, liquidez diária, cotistas, patrimônio, imóveis e vacância.
- Comunicados passam a ser extraídos tanto da página principal do FII quanto da rota pública `communications/fii/{TICKER}`.
- Links intermediários `/fiis/link_comunicado/{TICKER}/{ID}/` são tratados como documento/PDF oficial mesmo quando não terminam em `.pdf`.
- O parser limpa `Data de Divulgação` do título e preserva a data no campo `dateDisplay`.
- `fetchText` preserva `contentType` e `finalUrl`, permitindo confirmar PDF após redirecionamentos.
- O timeout `fundamentalTimeoutMs` enviado pelo APK passa a ser respeitado no bundle Investidor10.

## Auditoria do modal de FII

- Mantidas as fontes definidas: Investidor10 para fundamentos/informações de FIIs e Yahoo para cotação/comparação.
- Revisados checklist, comunicados, PDF/documentUrl, extração de datas e merge de resultados.
- O contrato segue entregando todos os blocos já existentes do modal único: cards rápidos, rentabilidade, informações, comparação com índices, pares, checklist, distribuições, dividendos, sobre o fundo, imóveis, vacância, valor patrimonial e comunicados.

## Validação

- `node --check lib/sources/fetch.js`
- `node --check lib/analysis/fii-modal-contract.js`
- `npm run check:syntax`
- `node test/fii-modal-buy-hold-checklist-v202.test.js`
- `node test/fii-modal-announcements-v213.test.js`
- `node test/fii-modal-checklist-independent-v214.test.js`
- `node test/fii-modal-announcements-routes-v214.test.js`
