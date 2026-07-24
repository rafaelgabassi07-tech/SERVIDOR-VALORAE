# RELATÓRIO — Proxy v146 Correção de escala monetária

**Release:** `21.12.176-analysis-value-scale-v146`  
**Public version:** `21.12.176`

## Correção aplicada

O Proxy agora preserva escala monetária ao extrair campos usados pela página Análise e pelos modais. Isso corrige casos em que `Patrimônio líquido`, `Liquidez média diária`, `Valor de mercado`, `Valor da firma` e métricas similares chegavam sem `Milhões`/`Bilhões`, fazendo o APK exibir `R$ 445,19` em vez de `R$ 445,19 mi` ou equivalente.

## Arquivos alterados

- `lib/sources/asset-details.js`
- `lib/analysis/analysis-page-response.js`
- `metadata.json`
- `package.json`
- `docs/ANALYSIS_VALUE_SCALE_PROXY_V146.md`

## Validação

- `node --check` executado nos arquivos JS alterados.
- Sem alteração em Supabase, sync, SQL, schema, tabelas, autenticação ou payloads de carteira.

## Testes executados após ajuste

- `node --check lib/sources/asset-details.js`
- `node --check lib/analysis/analysis-page-response.js`
- `npm run check`: 255 arquivos JS verificados
- `npm run test`: 70 arquivos de teste, 0 falhas

## Observação sobre formato final

Quando a fonte traz escala explícita, como `R$ 854,70 Bilhões`, o contrato final compacta para leitura mobile como `R$ 854,70 bi`. Quando a fonte traz valor cheio, como `R$ 45.000.000,00`, o contrato mantém valor parseável e o APK pode compactar na interface conforme necessário.
