# Proxy 21.12.404 × APK v647

## Escopo

A v647 altera apenas organização visual e estado de scroll na feature Análise do APK. O runtime financeiro do Proxy permanece igual ao entregue na v646.

## Alteração de runtime no Proxy

Somente `pairedVersion` e `maxTestedVersion` avançam para `2026.08.09.10`. Nenhuma rota, fonte de mercado, parser, cache, payload ou regra financeira foi alterada.

## Validação

- APK `2026.08.09.10`: `PAIRED`.
- APK `2026.08.09.09`: continua `SUPPORTED`.
- APK `2026.08.09.11`: rejeitado quando `allowFuture=false`.
- `npm run build`: aprovado.
- Sintaxe: 445 arquivos JavaScript aprovados.
- Auditoria de versão: aprovada.
- Suíte histórica: 289 testes; 185 aprovados, 100 bloqueados por dependências opcionais (`cheerio`/`undici`) e as mesmas 4 falhas históricas da baseline, sem falha nova da v647.
