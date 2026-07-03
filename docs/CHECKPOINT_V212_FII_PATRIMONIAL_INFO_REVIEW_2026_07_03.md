# Checkpoint v212 — Revisão do valor patrimonial no modal de FIIs

- Contrato mantido: `26.asset-modal.fii.v19`.
- Paridade com APK v331.
- Revisão focada em acabamento visual e exposição das ajudas patrimoniais já presentes no payload.
- Mantidos os parsers de `patrimonialInfo`, barras, cards e `segmentAverage`.

Validações:
- `node --check lib/analysis/fii-modal-contract.js`
- `npm run check:syntax`
- `node test/fii-modal-patrimonial-info-v211.test.js`
- `npm test`
- `npm run audit:version`
