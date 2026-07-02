# Proxy v177 — Auditoria curada de fontes, apresentação e contrato visual

Nova rodada focada no Investidor10, contrato público enviado ao APK e proteção contra vazamento de dados brutos/técnicos em modais.

## Correções aplicadas

- Reforçado o extrator de apresentação de ações para preservar mais de uma frase real do bloco “Sobre a empresa”.
- Adicionada preservação do bloco “Informações Adicionais” da ação em parágrafos curados de apresentação.
- Mantida extração de informações de FIIs como razão social, mandato, segmento, taxa, DY atual, DY médio, valor patrimonial por cota e P/VP patrimonial.
- O contrato mobile público agora remove chaves técnicas/brutas como rawJson, rawHtml, diagnostics, sourceDiagnostics, legacyField, extractionPolicy, sourceTrace, apiStatus, groupedRoles, _coverage e _source_integrity.
- Gráficos multi-série continuam alinhados por período para evitar falha visual em gráficos com mais de duas informações.
- Adicionado teste regressivo v177 para apresentação PETR4/HGLG11, gráficos alinhados e contrato sem vazamento técnico.

## Validação

- npm run build
- npm run check:syntax
- npm test
- npm run audit:version
- npm run verify

## Resultado

- 81 arquivos de teste executados.
- failures=0.
- Release alinhada: 21.12.207-curated-source-contract-audit-v177.
