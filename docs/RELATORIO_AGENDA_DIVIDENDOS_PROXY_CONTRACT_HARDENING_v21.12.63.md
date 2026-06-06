# Relatório — Hardening do contrato Agenda de Dividendos — VALORAE Proxy v21.12.63

## Objetivo

Reforçar o contrato entre VALORAE Proxy e APK VALORAE para a Agenda de Dividendos, sem alterar o núcleo `Valorae-engine.js`.

## Diagnóstico

O Proxy já tinha mecanismo de agenda do Investidor10, mas alguns endpoints de carteira retornavam principalmente `events`, `dividends` e `proventos`. O APK, após refatoração, precisava de aliases explícitos como:

- `agendaEvents`
- `upcomingEvents`
- `historyEvents`

Além disso, a separação entre eventos futuros e históricos precisava ser consistente também em `/api/v1/portfolio/dividends`.

## Arquivos alterados

- `routes/portfolio/dividends.js`
- `routes/asset/dividends.js`
- `metadata.json`
- `package.json`

## Correções aplicadas

### `/api/v1/portfolio/dividends`

Agora retorna também:

- `dividendos`
- `agendaEvents`
- `upcomingEvents`
- `historyEvents`
- `upcomingCount`
- `historyCount`

### Datas

Reforçada leitura de:

- `DD/MM/YY`
- `DD/MM/YYYY`
- `YYYY-MM-DD`

### `/api/v1/asset/dividends`

A separação de eventos futuros/históricos agora aceita também ano curto de dois dígitos.

## Compatibilidade

O identificador `releasePatch` foi mantido como:

```text
21.12.63-valorae-i10-dividend-agenda-sync
```

Isso preserva os testes e contratos existentes do Proxy, mas com hardening adicional de resposta.

## Validação

Executado:

```bash
npm run check
VALORAE_TEST_TIMEOUT_MS=20000 npm test
```

Resultado:

```text
Checked 291 JS files
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```
