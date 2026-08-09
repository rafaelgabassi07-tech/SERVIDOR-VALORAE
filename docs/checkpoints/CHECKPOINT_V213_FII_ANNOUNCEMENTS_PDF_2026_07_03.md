# Checkpoint v213 — Comunicados e PDFs no modal de FIIs

- Contrato: `26.asset-modal.fii.v20`.
- Novo objeto `announcements` no contrato do modal único de FII.
- Captura da seção `COMUNICADOS DO {TICKER}` do Investidor10.
- Campos principais: título, tipo, data, URL oficial, `documentUrl`, `pdfUrl`, tipo de documento e label do botão.
- Fallback: quando o Investidor10 não expõe PDF direto, o APK abre o link oficial do comunicado.
- Pareado com APK v332.
