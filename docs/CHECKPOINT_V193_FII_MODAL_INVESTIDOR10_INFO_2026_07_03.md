# Checkpoint v193 — Informações Investidor10 no modal único de FIIs

- `/api/v1/asset/fii-modal` evolui para `26.asset-modal.fii.v2`.
- Mantém cotação, gráfico e rentabilidade nominal pelo Yahoo Finance Chart API.
- Mantém rentabilidade real por IPCA BCB quando disponível.
- Mantém StatusInvest e fallbacks legados descartados dentro do modal único.
- Adiciona bloco `information` / `infoSections` com dados oficiais do Investidor10 para FIIs: Razão Social, CNPJ, Público-alvo, Mandato, Segmento, Tipo de fundo, Prazo de duração, Tipo de gestão, Taxa de administração, Vacância, Número de cotistas, Cotas emitidas, Valor patrimonial por cota, Valor patrimonial e Último rendimento.
- Parser dedicado aceita variações com e sem acento e não fabrica valores ausentes.
