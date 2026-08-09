# Checkpoint 356 — Modal sequence and asset news v324

Data: 2026-07-12

## Objetivo

Parear o Proxy ao APK v504 e entregar notícias relacionadas ao ticker para a seção final dos modais de Ação e FII.

## Contrato

A rota `/api/v1/news` aceita `assetOnly=true` (aliases `strictAsset` e `assetNewsOnly`). Nesse modo, o produtor não executa fallback amplo de mercado e exige correspondência com o ticker, nome ou aliases significativos do ativo. Uma resposta vazia é preferível a conteúdo irrelevante.

## Resiliência

- O cache inclui o modo `assetOnly` na chave.
- Chamadas legadas continuam com o comportamento geral anterior.
- A resposta e `appPolicy` expõem `assetOnly` para diagnóstico.
- Nenhuma notícia sintética é criada.

## Pareamento

APK v504 / `2026.07.12.06`; protocolo móvel `2026.07.10.10`; asset modal delivery v3.

## Validação adicional

- `news-asset-only-v324.test.js` comprova filtragem estrita e ausência de fallback amplo.
- `asset-modal-sequence-news-v324.test.js` valida a ordem exata dos 23 blocos de Ação e 17 blocos de FII contra o APK pareado.
