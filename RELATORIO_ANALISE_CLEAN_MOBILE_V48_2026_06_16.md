# Relatório técnico — Valorae Análise Clean Mobile v48

Data: 2026-06-16  
Checkpoint: `analysis-clean-mobile-v48`  
Proxy: `21.12.132-analysis-clean-mobile-v48`  
APK: changelog atualizado, sem alteração de `versionCode`/`versionName`

## Objetivo da revisão

Revisar e aprimorar a página **Análise** com foco exclusivo nos pontos reportados:

1. gráfico de **comparações de ações e FIIs com índices**;
2. lista de **indicadores fundamentalistas**;
3. visual do **resumo do ativo**;
4. remoção do bloco técnico **“Análise do ativo: leitura organizada por categorias”**;
5. investigação do card vazio **“Valor da Firma”** dentro de **Sobre a empresa**.

A regra mantida nesta revisão foi: **não criar dado inventado, simulado ou derivado como se fosse informação real da fonte**.

---

## Checkpoint 1 — Comparações de ações e FIIs com índices

### Problema encontrado

O gráfico da Análise não estava usando uma experiência equivalente ao gráfico funcional da página/modal de **Retorno**. Além disso, a visualização da Análise podia perder comparadores quando havia muitas séries.

### Correções aplicadas

No Proxy:

- Mantida a origem real das séries.
- Ampliado o conjunto de comparadores aceitos para:
  - ativo analisado;
  - IBOV;
  - IFIX;
  - CDI;
  - IPCA;
  - SMLL;
  - IDIV;
  - IVVB11.
- Corrigido o limite do gráfico combinado para preservar o ativo + 7 índices quando as séries reais existem e estão alinhadas.
- Adicionado `IVVB11` como benchmark direto por símbolo real `IVVB11.SA`.

No APK:

- O gráfico `asset_vs_indices` passou a usar componente próprio, inspirado no comportamento do gráfico de Retorno:
  - linhas múltiplas;
  - legenda visível;
  - cores estáveis por índice;
  - seleção por toque/arraste;
  - marcador vertical do ponto selecionado;
  - leitura compacta dos valores selecionados.
- O limite visual para comparação com índices foi ampliado para 8 séries.

### Resultado

A comparação com índices ficou mais próxima do gráfico de Retorno, sem transformar a tela em um painel pesado. Quando um índice não chega com série real suficiente, ele não é inventado.

---

## Checkpoint 2 — Lista de indicadores fundamentalistas

### Problema encontrado

A lista estava visualmente pesada, com aparência de grade/cards, pouco confortável para mobile e com leitura fracionada.

### Correções aplicadas no APK

A seção `fundamental_indicators` agora usa uma lista agrupada por categorias:

- Valuation;
- Rentabilidade;
- Dividendos;
- Endividamento e liquidez;
- Outros indicadores.

Cada indicador passou a ser exibido em linha compacta com:

- nome do indicador;
- valor em destaque;
- categoria em chip discreto;
- divisórias leves entre linhas.

### Resultado

A leitura ficou mais limpa, vertical e adequada para celular, sem excesso de containers.

---

## Checkpoint 3 — Resumo do ativo

### Problema encontrado

O resumo ainda tinha visual muito fragmentado e podia exibir informações com pouca hierarquia.

### Correções aplicadas no APK

- Criado resumo com destaques principais em pílulas visuais.
- Priorização dos principais campos: preço, variação, valor de mercado, dividend yield, P/L, P/VP e patrimônio quando disponíveis.
- Campos secundários ficam em linhas limpas, com menos peso visual.
- Valores vazios, traços e zeros inválidos são filtrados antes de renderizar.

### Resultado

O resumo agora funciona como abertura da análise, com leitura rápida e menos poluição.

---

## Checkpoint 4 — Remoção de card técnico

### Problema encontrado

O bloco **“Análise do ativo: leitura organizada por categorias”** era uma explicação técnica da organização interna da tela e não deveria aparecer para o usuário final.

### Correção aplicada

- Removida a chamada desse bloco na tela integrada da Análise.
- A organização por categorias permanece internamente, mas sem exibir mensagem técnica ao usuário.

### Resultado

A página fica mais natural, sem linguagem de implementação.

---

## Checkpoint 5 — Card vazio “Valor da Firma” em Sobre a empresa

### Problema encontrado

A fonte pode informar esse campo como **“Valor de firma”**, enquanto a interface usa o rótulo mais natural **“Valor da firma”**. O mapeamento anterior não era robusto o bastante para capturar todos os aliases e podia gerar item sem valor.

### Informação que deveria chegar

O campo corresponde ao **Valor da Firma / Enterprise Value**, exibido na área de informações da empresa junto de Valor de Mercado, Patrimônio Líquido, Ativos, Dívida Bruta e Dívida Líquida.

### Correções aplicadas no Proxy

- `company_profile` passou a considerar também `assetChartsCanonical.info` como fonte para Sobre a empresa.
- O alias do campo passou a aceitar:
  - `valorFirma`;
  - `valor da firma`;
  - `valor de firma`;
  - `enterpriseValue`;
  - `ev`.
- A normalização agora ignora aliases vazios e continua procurando em nomes normalizados.
- A formatação extrai o primeiro valor monetário legível quando a fonte traz versão simples + versão detalhada no mesmo bloco.
- Foi adicionado teste regressivo para impedir retorno do card vazio.

### Correções aplicadas no APK

- O bloco Sobre a empresa filtra valores vazios, traços e zeros inválidos antes de renderizar.
- Se o Proxy não enviar valor real, o card não aparece.

### Resultado

Quando a fonte trouxer Valor de firma, a tela exibe **Valor da firma** preenchido. Quando a fonte não trouxer valor válido, o app não mostra card vazio.

---

## Testes e validações executadas

### Proxy

- `npm run check` — OK, 229 arquivos JS verificados.
- `npm test -- --runInBand` — OK, 46 arquivos de teste, 0 falhas.
- `npm run typecheck` — OK.
- `npm run audit:version` — OK.
- `npm run audit:identity` — OK, 0 ocorrências externas proibidas.
- `npm run smoke` — OK.
- `npm run verify` — OK.

### APK

- JSONs validados:
  - `changelog.json`;
  - `app/src/main/assets/valorae_changelog.json`;
  - `version.json`;
  - `update.json`;
  - `metadata.json`.
- `AnalysisScreen.kt` revisado estaticamente.
- Balanceamento estrutural de chaves/parênteses validado.

Observação: o pacote APK não contém `gradlew`; por isso, não foi possível executar build Android completo neste ambiente.

---

## Versionamento

### Proxy

`21.12.132-analysis-clean-mobile-v48`

### APK

Mantido:

- `versionCode = 26061401`
- `versionName = 2026.06.14.1`

Changelog atualizado com entrada de 2026-06-16.

---

## Conclusão

A revisão v48 corrigiu os problemas visuais e funcionais apontados na página **Análise**, especialmente o gráfico de comparação com índices e o card vazio **Valor da firma**. A tela ficou menos técnica, mais limpa e mais adequada para mobile, preservando a regra de não exibir dado inventado ou simulado.
