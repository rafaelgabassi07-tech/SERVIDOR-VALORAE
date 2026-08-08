# Compatibilidade APK v627 × Proxy 21.12.404

- APK pareado: `2026.08.08.05` (v627).
- Proxy público: `21.12.404`.
- Endpoint de Agenda: `POST /api/v1/dividends/batch` (sem mudança de schema).
- Recovery: `home-agenda-recovery-v4-complete`, com `includeAllFutureAnnounced=true`.
- Se a resposta principal for parcial, o APK divide a carteira em lotes de até 24 tickers e concede orçamento próprio a cada lote, com até 3 lotes concorrentes por onda.
- A coleta StatusInvest une a página pública visível e o endpoint JSON por ticker (`completenessMode=true`).
- O filtro inicial da Agenda no APK passa a ser `Todos`, portanto anúncios além de 12 meses não ficam ocultos por padrão.
- A identidade econômica preserva parcelas legítimas com Data COM, data de pagamento e valor distintos.
- APKs até v626 permanecem dentro da janela backward-compatible.
