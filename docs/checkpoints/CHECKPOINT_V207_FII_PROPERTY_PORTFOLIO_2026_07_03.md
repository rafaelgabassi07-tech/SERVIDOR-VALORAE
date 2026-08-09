# Checkpoint v207 — Lista de imóveis no modal de FIIs

- Evolui `/api/v1/asset/fii-modal` para o contrato `26.asset-modal.fii.v15`.
- Adiciona o objeto `propertyPortfolio`.
- Parser dedicado para a seção **LISTA DE IMÓVEIS** do Investidor10.
- Extrai distribuição por estado: UF, estado, quantidade e participação.
- Extrai lista de imóveis: nome, estado/UF e área bruta locável.
- A captura encerra antes de Comunicados/Históricos para evitar mistura de seções.

Validações: `node --check`, `npm run check:syntax`, `node test/fii-modal-property-portfolio-v207.test.js`, `npm test`, `npm run audit:version`.
