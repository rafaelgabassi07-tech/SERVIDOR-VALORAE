# RELATÓRIO — Análise source full resilience v53

Data: 2026-06-16  
Checkpoint: v53  
Proxy: `21.12.136-analysis-source-full-resilience-v53`  
APK: `versionCode = 26061401`, `versionName = 2026.06.14.1`

## Objetivo

Ampliar a cobertura real da página **Análise** para ações e FIIs, aproveitando mais dados do Investidor10 e do StatusInvest sem transformar a tela em um painel técnico poluído.

## Ajustes no Proxy

- Adicionado roteamento de **Preço justo e modelos** para ações, aceitando dados de Graham/Bazin quando a fonte disponibilizar.
- Adicionada seção **Comparativos da fonte**, aproveitando comparações de indicadores com setor, subsetor e segmento.
- Adicionada seção **Índices e participação**, incluindo participação em IFIX/IBOV e outros índices quando a fonte enviar dado real.
- Ampliada a captura de FIIs no StatusInvest:
  - DY CAGR 3/5 anos;
  - Valor CAGR 3/5 anos;
  - rendimento médio 24M;
  - participação no IFIX;
  - contábil ampliado, incluindo custos, liquidez, imóveis, fundos, valores mobiliários, debêntures, certificados e participações.
- Ampliada a extração HTML/API com fallbacks sem `eval`, sem WebView e sem dado sintético.
- Mantida a regra real-only: se a fonte não enviar o dado, o Proxy não fabrica nem simula.

## Ajustes no APK

- A página Análise passou a reconhecer as novas seções:
  - `valuation_models`;
  - `source_comparatives`;
  - `indices_events`.
- As novas seções foram distribuídas em categorias já existentes para manter a página limpa.
- Seções longas continuam recolhíveis, exibindo prévia curta para o usuário final.
- Nenhuma informação técnica de pendência volta para a UI principal.

## Validação

Proxy validado com:

- `npm run check` — OK
- `npm test` — OK, 50 arquivos de teste, 0 falhas
- `npm run verify` — OK
- `npm run audit:version` — OK

APK: não foi possível executar build Android completo neste ambiente porque o pacote não inclui `gradlew` e não há Gradle/SDK Android disponível aqui. A alteração foi limitada à organização de seções e metadata/changelog, mantendo `versionCode` e `versionName` sem bump.

## Observação honesta sobre “extração perfeita”

O checkpoint aumenta a robustez e reduz fragilidade com múltiplos caminhos HTML/API/canonical, mas nenhuma extração de sites terceiros pode ser garantida como perfeita para sempre. Investidor10 e StatusInvest podem alterar HTML, nomes de campos, endpoints ou aplicar bloqueios. O Proxy agora está mais resiliente, mas deve continuar com testes regressivos e monitoramento.
