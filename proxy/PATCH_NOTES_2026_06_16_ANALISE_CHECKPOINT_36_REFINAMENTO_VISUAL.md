# Checkpoint 36 — Refinamento visual final da página Análise

Data: 2026-06-16
Patch: `21.12.120-analysis-visual-refinement-v36`

## Objetivo

Reduzir poluição visual da página Análise, melhorar hierarquia mobile e preservar o contrato único `/api/v1/analysis`.

## Alterações

- Mapa visual compacto dos blocos da Análise.
- Cabeçalhos com fonte, quantidade de itens e quantidade de gráficos.
- Recolhimento inteligente de seções longas com prévia compacta.
- Sinalizações reduzidas para formato mais discreto.
- Busca inteligente revisada sem voltar a consultar `/api/v1/analysis` a cada letra.

## Garantias

- Sem HTML, iframe, WebView, imagem externa ou dado simulado.
- Sem retorno aos contratos antigos da Análise.
- `versionCode` e `versionName` do APK mantidos.
