# RELATÓRIO VALORAE PROXY

## 2026-06-26 — v142 — Notícias diárias e ordem cronológica

- **Proxy:** 21.12.174-br-date-display-v144
- **APK relacionado:** 2026.06.26.03 / versionCode 26062603

### Auditoria
- O endpoint de notícias priorizava relevância antes da data no motor `fetchGoogleNews`, quebrando a regra de notícia mais nova no topo.
- O cache do feed não tinha chave diária explícita e podia servir lista antiga dentro da janela stale.
- A rota `/api/v1/news` não normalizava a ordem final antes de responder ao APK.

### Correções
- `lib/Valorae-engine.js` passou a ordenar por `publishedAt/pubDate/timestamp` descendente antes de usar relevância como desempate.
- A chave do cache de notícias agora inclui o dia (`yyyy-MM-dd`), evitando reaproveitamento indevido entre dias.
- `routes/news.js` aplica ordenação final por data e reduziu cache HTTP para `max-age=30`.
- `lib/sources/news.js` aceita refresh/nocache com sufixo `_fresh`, evitando cache interno quando o APK exige atualização.

### Validação
- `npm run check` executado com sucesso.
- `node --check` executado nos arquivos alterados de notícias.

---

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
- Proxy: `21.12.174-br-date-display-v144`

### Objetivo
Sincronizar metadata/release com o APK v125. Não houve mudança funcional de contrato.

### Validação
- `npm run audit:version`
- `npm run check`
- `npm test`


## v127 — Sincronização com apresentação vertical 3D

- Data: 2026-06-24
- Proxy: `21.12.174-br-date-display-v144`
- APK pareado: `2026.06.24.9` / `26062409`

### Escopo
Sincronização de release, metadados, README, service worker e auditoria de versão para acompanhar o APK v127. Não houve alteração funcional de endpoints ou contratos.


---

## Checkpoint v127 — Polimento textual e visual da apresentação (2026-06-24)

**Proxy:** 21.12.174-br-date-display-v144

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

**Proxy:** 21.12.174-br-date-display-v144

### Objetivo
Sincronizar metadados e versão com o APK v128, que remove termos técnicos da apresentação e refina a narrativa visual do onboarding.

### Alterações
- Release/patch atualizado para `21.12.174-br-date-display-v144`.
- README, metadata, manifest, service worker e auditoria de versão sincronizados.
- Sem alteração funcional de endpoints, contratos ou parsers.

### Validação
- `npm run audit:version`: OK.
- `npm run check`: OK.
- `npm test`: OK.
- Relatório único mantido na raiz.


## Checkpoint v144 — datas brasileiras de exibição (2026-06-26)
- Proxy: `21.12.174-br-date-display-v144`.
- Adicionados formatBrDate/formatBrDateTime em lib/core/dates.js para campos de exibição.
- Notícias incluem publishedAtDisplay/displayDate em pt-BR, mantendo publishedAt/timestamp para ordenação e cache.
- Itens visíveis da Análise usam DD/MM/AAAA em proventos; sincronização Supabase não teve colunas/tipos alterados.


## 2026-06-26 — v145 — Revisão final de datas brasileiras

- **Proxy:** 21.12.175-br-date-final-audit-v145
- **Objetivo:** confirmar se nada ficou sem conversão visual após o v144.

### Correção aplicada
- `normalizeDate` agora aceita `AAAA/MM/DD` e `AAAA.MM.DD`, além de `AAAA-MM-DD`.
- `formatBrDate`/`formatBrDateTime` passam a converter esses formatos para `DD/MM/AAAA` corretamente.
- Nenhum campo técnico do Supabase foi alterado.

### Validação
- `npm run check`: OK.
- `npm run audit:version`: OK.
- `npm run test`: OK.
