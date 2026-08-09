# Auditoria de eventos Proxy → APK — 2026-07-26

Fonte analisada: `valorae-proxy-events-2026-07-26T03-14-51-542Z.csv`.

## Evidências

- 14 eventos no total.
- `/api/sync`: 5 respostas HTTP 200 com 91.431 bytes e 5 respostas HTTP 400 com 308 bytes.
- Cada HTTP 400 ocorreu imediatamente após um HTTP 200 da mesma rota.
- O fluxo Android chama `get_transactions` e, na sequência, `get_dividend_events`.
- O tamanho estável de 91.431 bytes confirma que a leitura do Histórico remoto está retornando dados.
- O erro sistemático seguinte é compatível com a leitura de proventos em schema Supabase legado.
- `/api/v1/asset/modal`: fast entre 1.315–2.475 ms; full entre 14.992–15.441 ms. Não houve erro HTTP, mas o full permanece pesado, com 502–521 KB.

## Correções

- `get_dividend_events` não depende mais de `payment_date` ou `category` como colunas físicas; normalização, filtro e ordenação passam a ocorrer após a leitura.
- Uma falha exclusiva da consulta pelo e-mail legado não invalida uma consulta válida pelo UUID atual.
- A consulta principal pelo UUID continua obrigatória: erros reais do armazenamento atual não são ocultados.
- O monitor e o CSV agora registram `syncAction`, `errorCode` e `retryable`, eliminando a ambiguidade dos próximos diagnósticos.

## Validação

- Build Vercel: aprovado.
- Sintaxe: 509 arquivos JavaScript aprovados.
- Teste novo de schema legado/UUID: aprovado.
- Teste de identidade mista: aprovado.
- Teste de restauração após login: aprovado.
- Suíte completa: 167 aprovados, 107 bloqueados por dependências ausentes (`cheerio`/`undici`), 0 falhas.
- Auditoria de versão: aprovada.
