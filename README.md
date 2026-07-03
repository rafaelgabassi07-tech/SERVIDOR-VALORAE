# VALORAE Proxy — v200 — Correção do comparador com outros FIIs

Core: 21.12.0  
Public version: 21.12.230  
Patch: `21.12.230-fii-peer-comparison-related-fallback-v200`  
Checkpoint: `fii-peer-comparison-related-fallback-v200`

Proxy v200 acompanha o APK v319: o modal único de FIIs corrige o bloco **Comparando com outros FIIs**. Quando o Investidor10 retorna no HTML estático apenas o cabeçalho da tabela renderizada, o Proxy reconstrói o comparador a partir de **FIIs Relacionados** e enriquece os pares pelas páginas individuais do próprio Investidor10.
