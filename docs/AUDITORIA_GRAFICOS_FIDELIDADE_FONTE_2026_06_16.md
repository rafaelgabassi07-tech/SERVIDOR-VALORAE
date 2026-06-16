# Auditoria — Fidelidade dos gráficos da Análise — 2026-06-16

## Base auditada

- APK base: `apk_valorae_checkpoint_34_fiis_completos_2026_06_16.zip`
- Proxy base: `valorae_proxy_21_12_117_checkpoint_34_fiis_completos_2026_06_16.zip`
- Patch revisado: `21.12.118-analysis-chart-source-fidelity-review`

## Resultado

A revisão confirmou que a arquitetura geral dos gráficos estava correta, mas foram encontrados pontos de aprimoramento para garantir fidelidade plena à fonte:

1. Comparadores `multi_line` podiam usar séries reais, porém sem exigir períodos em comum. Isso poderia desenhar linhas por posição, e não por data/período real equivalente.
2. `Lucro x Cotação` carregava duas séries, mas ainda estava classificado como `line`; foi corrigido para `multi_line`.
3. Distribuições percentuais de FIIs aceitavam qualquer número finito; agora rejeitam zero, negativos e acima de 100%.

## Correções aplicadas

- Criado alinhamento obrigatório por períodos comuns em comparadores de índices e pares semelhantes.
- Comparadores sem pelo menos dois períodos comuns são descartados.
- `profit_vs_quote` agora sai como `multi_line`.
- Pontos de distribuição percentual de FII agora passam por filtro de validade percentual.
- Criado teste regressivo `analysis-chart-source-fidelity-v34-review.test.js`.

## Validação

- `npm run check`: aprovado.
- `npm test`: aprovado com 34 arquivos de teste e 0 falhas.
- `npm run audit:version`: aprovado.
- `npm run audit:identity`: aprovado.
- APK: validação estática Kotlin e JSON. Gradle não foi executado por falta de wrapper completo/gradle no ambiente.

## Conclusão

Após a revisão, os gráficos ficam mais fiéis às fontes porque:

- séries temporais continuam em linha;
- composições continuam em barras horizontais/donut conforme o caso;
- comparadores só desenham períodos realmente comparáveis;
- dados percentuais inválidos são descartados;
- fontes explícitas são preservadas no contrato.
