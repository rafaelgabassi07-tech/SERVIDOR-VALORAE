# Relatório — Análise clean mobile v47

Data: 2026-06-16  
Proxy: `21.12.131-analysis-clean-mobile-v47`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1`

## Objetivo

Continuar as melhorias da página **Análise** com foco em mobile, limpeza visual, listas e gráficos, sem inventar informações e sem alterar o contrato real do Proxy.

## Ajustes feitos no APK

1. **Menos containers e cards**
   - As categorias principais deixaram de usar um card pesado para cada bloco.
   - Agora usam estrutura mais plana, com título, subtítulo e divisórias discretas.
   - O objetivo é manter a separação por categoria sem deixar a tela com aparência empilhada/poluída.

2. **Listas mais legíveis**
   - Listas genéricas agora agrupam por categoria (`group`) quando isso melhora a leitura.
   - Linhas aceitam até duas linhas no rótulo e no valor para evitar corte agressivo no mobile.
   - Valores zerados/sem utilidade continuam filtrados quando aplicável.

3. **Gráficos mais leves**
   - Removidos os quatro mini-cards que apareciam abaixo de cada gráfico.
   - A leitura foi substituída por uma linha compacta com período, último valor e variação.
   - Isso reduz poluição visual em telas pequenas.

4. **Comparação com índices**
   - O gráfico `asset_vs_indices` mantém até 7 séries visíveis.
   - As cores passam a ser estáveis por benchmark:
     - Ativo: cor principal do app
     - IBOV: azul
     - IFIX: verde
     - CDI: laranja
     - IPCA: roxo
     - SMLL: teal
     - IDIV: vermelho
   - A legenda agora não depende da ordem de chegada das séries para manter a identidade visual.

5. **Perfil e detalhes de FII mais limpos**
   - Perfil da empresa/fundo deixou de empilhar pequenos tiles para cada detalhe.
   - Detalhes de FII usam grupos com divisórias simples, não cartões internos repetidos.

## Ajustes no Proxy

- Não houve alteração de extração/captura de dados nesta rodada.
- O contrato `/api/v1/analysis` foi preservado.
- O Proxy foi atualizado para o checkpoint `21.12.131-analysis-clean-mobile-v47` para manter release, auditoria e pacote alinhados com o APK.
- Nenhum fallback simulado, valor inventado ou dado sintético foi adicionado.

## Validação executada

Proxy:

- `npm run check` — OK, 228 arquivos JS verificados
- `npm test -- --runInBand` — OK, 45 arquivos de teste, 0 falhas
- `npm run typecheck` — OK
- `npm run audit:version` — OK
- `npm run audit:identity` — OK
- `npm run smoke` — OK
- `npm run verify` — OK

APK:

- JSONs validados:
  - `changelog.json`
  - `version.json`
  - `update.json`
  - `app/src/main/assets/valorae_changelog.json`
  - `metadata.json`
- `AnalysisScreen.kt` revisado estaticamente.
- Validação simples de balanceamento de chaves, parênteses e colchetes executada.
- O pacote não possui `gradlew`, então não foi possível executar build Android completo neste ambiente.

## Resultado

A página Análise ficou mais plana, mais organizada por categorias e mais confortável para mobile, preservando o contrato real do Proxy e bloqueando qualquer uso de informação inventada/simulada.
