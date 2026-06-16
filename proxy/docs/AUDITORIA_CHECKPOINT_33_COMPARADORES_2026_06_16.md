# Auditoria — Checkpoint 33 — Comparadores da Análise

Data: 2026-06-16  
Proxy patch original: `21.12.114-analysis-comparators-v33`
Proxy patch revisado: `21.12.115-analysis-comparators-v33-review`  
Contrato: `/api/v1/analysis` → `AnalysisPageResponse` (`26.analysis.v2`)

## Objetivo

Implementar comparadores reais na página Análise, sem reutilizar contratos antigos da tela Retorno e sem criar índices falsos.

## Implementado no Proxy

- A seção `comparisons` agora normaliza gráficos de comparação como `multi_line`.
- Comparadores aceitos: `IBOV`, `IFIX`, `CDI`, `IPCA`, com suporte opcional a `SMLL` e `IDIV` quando uma fonte real já os fornecer.
- O fluxo de índice reaproveita a política de fontes já consolidada no modal Retorno: Yahoo/B3 para índices de mercado e Banco Central/SGS para CDI/IPCA quando disponível.
- A comparação só é emitida quando existem pelo menos duas séries reais alinhadas: a série do ativo e a série do índice/par.
- Séries de índice sem a série do ativo são rejeitadas para não fingir “ativo x índice”.
- São rejeitados `simulated`, `synthetic`, `fake`, `proxyTickerUsed`, ETF/proxy ticker e próprio ticker como comparador.
- Pares semelhantes são aceitos como item/tabela quando há ticker diferente do ativo e fonte real; gráficos de par exigem série do ativo e série do par.

## Implementado no APK

- `AnalysisScreen.kt` ganhou bloco específico `ComparisonAnalysisBlock`.
- Comparadores são agrupados em:
  - Ativo x índice;
  - Séries recebidas;
  - Ações/FIIs semelhantes;
  - Outros comparadores.
- Gráficos são renderizados pelo mesmo Canvas nativo de linhas reais, sem barras para série temporal.
- Não há HTML, iframe, WebView ou imagem externa.

## Validação

- `npm run check`: passou.
- `npm test`: passou com 32 arquivos de teste e 0 falhas.
- Teste novo: `analysis-comparators-v33.test.js`.
- O teste cobre rejeição de índice falso, proxy ticker, série simulada, próprio ativo como par e comparador de índice sem série do ativo.

## APK

- `versionCode`: `26061401` mantido.
- `versionName`: `2026.06.14.1` mantido.
- Gradle não foi executado por ausência de wrapper completo/gradle no ambiente; validação estática Kotlin foi feita.


## Revisão adicional — 2026-06-16

A revisão fiel do Checkpoint 33 confirmou que o fluxo principal estava correto, mas reforçou uma proteção importante: comparadores falsos agora também são rejeitados quando as flags aparecem dentro de `series[]`, `points[]` ou pares semelhantes, e não apenas no objeto raiz do comparador.

Validação após revisão:

- `npm run check`: passou.
- `npm test`: passou com 32 arquivos de teste e 0 falhas.
- Teste `analysis-comparators-v33.test.js` ampliado para cobrir flags simuladas aninhadas.
