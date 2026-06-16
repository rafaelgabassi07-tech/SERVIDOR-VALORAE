# 2026-06-15 — Patch 21.12.96 — Contrato fiel da página Análise

## Objetivo
Preparar o Proxy para alimentar a página **Análise** do APK com um mapa fiel das seções que o Investidor10 apresenta para Ações e FIIs.

## Princípios
- Não fabricar valores ausentes.
- Manter status explícito quando uma seção existe no Investidor10, mas a série ainda depende de captura dinâmica.
- Entregar um contrato mobile organizado para o APK renderizar todas as seções sem acoplar a tela ao HTML do site.

## Alterações principais
- Adicionado `assetAnalysisPage` ao payload de ativo.
- O contrato lista todas as seções esperadas para Ações e FIIs.
- Cada seção informa `status`, `itemCount`, `source`, `kind`, `required`, `reason` e `previewRows`.
- O contrato é espelhado em `assetAnalysisPage`, `results.assetAnalysisPage`, `results.sections.assetAnalysisPage`, `appPayload.assetAnalysisPage` e `appMobileSnapshot.assetAnalysisPage`.

## Política de dados
- `captured`: dados reais disponíveis no contrato.
- `visible_without_series_yet`: bloco identificado como existente no Investidor10, mas ainda sem série estruturada capturada.
- `pending_or_not_visible`: seção prevista para o tipo de ativo, aguardando fonte real.

## Consumo no APK
O APK deve renderizar todas as seções recebidas, exibindo estado pendente quando não houver dados reais.
