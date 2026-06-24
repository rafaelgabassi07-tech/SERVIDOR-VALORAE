# RELATÓRIO VALORAE PROXY

Este é o relatório único e reutilizável do Proxy. Novos checkpoints devem ser adicionados neste mesmo arquivo, evitando vários relatórios soltos na raiz.

## 2026-06-24 — Onboarding executivo nativo sem 3D

- **Proxy:** 21.12.165-native-executive-onboarding-v121
- **Checkpoint:** native-executive-onboarding-v121
- **APK relacionado:** 2026.06.24.4

### Alteração
Sincronização de release/metadata para acompanhar o APK v121. Não houve alteração funcional de contrato, endpoint ou fonte nesta rodada.

### Validação
- Metadados e auditoria de versão sincronizados.
- Testes do Proxy mantidos como validação de regressão.


---

## Checkpoint v122 — Sincronização do onboarding cinematográfico

- **Data:** 2026-06-24
- **Proxy:** 21.12.167-cinematic-designer-polish-v123
- **APK relacionado:** 2026.06.24.6

### Objetivo
Manter o Proxy alinhado ao checkpoint do APK sem alterar endpoints ou contratos funcionais.

### Alterações
- metadata/release sincronizados.
- `package.json`, `lib/core/release.js`, `lib/release/current.js`, `service-worker` e auditoria de versão atualizados.
- Relatórios antigos removidos da raiz; mantido apenas `RELATORIO_VALORAE_PROXY.md`.


---

## 2026-06-24 — v123 — Sincronização de release

- **Proxy:** 21.12.167-cinematic-designer-polish-v123
- **APK relacionado:** 2026.06.24.6

### Alterações
- Sem mudança funcional de endpoint nesta rodada.
- Release, metadata, package e auditoria de versão sincronizados com o refinamento visual do APK.


## Onboarding Carbon Lux com fundo neutro — v124 — 2026-06-24

- APK: `2026.06.24.7` / `versionCode 26062407`
- Proxy: `21.12.168-cinematic-carbon-lux-background-v124`
- Checkpoint: `cinematic-carbon-lux-background-v124`

### Resumo
Checkpoint v124 inova o visual do onboarding cinematográfico com identidade Carbon Lux: fundo preto/grafite, superfícies branco-gelo, amarelo como único destaque e redução de cores saturadas para uma apresentação mais sofisticada.

### Alterações
- Fundo do onboarding redesenhado para paleta neutra em preto, grafite, cinza, branco-gelo e amarelo, removendo a sensação de aurora colorida.
- Layers SVG de patrimônio, Data COM futura, proventos, mercado, grid e mockup foram neutralizados para preto/cinza/branco/amarelo.
- Canvas interno da cena cinematográfica foi ajustado para luz de estúdio, sombras mais profundas e ausência de verde/azul/vermelho como elementos principais.
- Textos e chips foram reescritos para linguagem Carbon Lux, com aparência mais institucional e premium.
- Scroll continua controlando zoom, escala, câmera, paralaxe e transições, mas com menor ruído cromático e rotação mais discreta.
- Prompts de direção visual atualizados para orientar fundo neutro, luz dourada, profundidade realista e finalização visual sem excesso de cor.
- Relatórios únicos preservados: RELATORIO_VALORAE_APK.md e RELATORIO_VALORAE_PROXY.md.

### Validações planejadas
- Checagem de sintaxe dos scripts do onboarding.
- Auditoria de versão do Proxy.
- Testes do Proxy.
- Validação de ZIP com arquivos na raiz.


---

## 2026-06-24 — v125 — Sincronização Editorial Studio

### Versão
- Proxy: `21.12.172-presentation-copy-polish-v128`

### Objetivo
Sincronizar metadata/release com o APK v125. Não houve mudança funcional de contrato.

### Validação
- `npm run audit:version`
- `npm run check`
- `npm test`


## v127 — Sincronização com apresentação vertical 3D

- Data: 2026-06-24
- Proxy: `21.12.172-presentation-copy-polish-v128`
- APK pareado: `2026.06.24.9` / `26062409`

### Escopo
Sincronização de release, metadados, README, service worker e auditoria de versão para acompanhar o APK v127. Não houve alteração funcional de endpoints ou contratos.


---

## Checkpoint v127 — Polimento textual e visual da apresentação (2026-06-24)

**Proxy:** 21.12.172-presentation-copy-polish-v128

### Objetivo
Validar e preservar eventos de Data COM futura anunciada para que o APK consiga mostrar a oportunidade antes da data de corte.

### Ajustes aplicados
- Checkpoint sincronizado com APK v127.
- Adicionado teste `dividend-agenda-future-datecom-visibility-v127.test.js`.
- O teste confirma evento com `dateCom` futura, `paymentDate` vazio e posição em carteira entrando em `officialUpcomingEvents` e `portfolioUpcoming`.

### Validações
- `npm run audit:version`: OK.
- `npm run check`: OK.
- `npm test`: OK, 70 arquivos, 0 falhas.

## Checkpoint v128 — Sincronização do polimento da apresentação (2026-06-24)

**Proxy:** 21.12.172-presentation-copy-polish-v128

### Objetivo
Sincronizar metadados e versão com o APK v128, que remove termos técnicos da apresentação e refina a narrativa visual do onboarding.

### Alterações
- Release/patch atualizado para `21.12.172-presentation-copy-polish-v128`.
- README, metadata, manifest, service worker e auditoria de versão sincronizados.
- Sem alteração funcional de endpoints, contratos ou parsers.

### Validação
- `npm run audit:version`: OK.
- `npm run check`: OK.
- `npm test`: OK.
- Relatório único mantido na raiz.
