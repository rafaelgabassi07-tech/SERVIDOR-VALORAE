# Proxy 21.12.404 × APK v653 — consistência de build

O Proxy público permanece `21.12.404` e passa a declarar `2026.08.11.01` como APK pareado e máximo testado. O protocolo móvel continua `2026.07.10.10`, o contrato de ecossistema permanece `valorae-ecosystem-2026.08.05.04-p404` e o sync financeiro continua `valorae-financial-sync-v2`.

A mudança é deliberadamente limitada à identidade de pareamento. Rotas, tabelas Supabase, payloads financeiros, ticker, liquidez, notícias e notificações não recebem quebra de contrato.

Fingerprint canônico da árvore `app/src/main` pareada: `c36c36b680f185ff`. O APK o envia em `X-Valorae-Source-Fingerprint`; o Proxy o trata como telemetria de consistência (não bloqueante) e devolve o status por header.
