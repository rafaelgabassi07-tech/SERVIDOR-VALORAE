# Checkpoint v192 — Modal único de FIIs com Yahoo

- Criado o contrato `/api/v1/asset/fii-modal` para iniciar a reconstrução real do modal único pelo universo de Fundos Imobiliários.
- O contrato retorna cards rápidos de cotação, DY 12M, P/VP, liquidez diária e variação em 12 meses.
- O gráfico de cotação e as janelas de rentabilidade nominal usam Yahoo Finance Chart API por ticker B3 direto (`GGRC11.SA`, etc.).
- A rentabilidade real usa IPCA BCB SGS 433 quando disponível.
- StatusInvest, Investidor10 e fallbacks legados permanecem descartados para o modal único.
- Mantido endpoint independente para não religar o antigo modal da Análise.
