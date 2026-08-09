# Checkpoint v168 — Carteira sem duplicidade por ticker canônico

Data: 2026-07-02
Release Proxy: `21.12.198-portfolio-dedupe-sync-v168`

## Objetivo

Impedir que ativos da Carteira voltem duplicados após importação, restauração de nuvem ou sincronização Supabase, especialmente quando a mesma posição aparece como `KLBN4`, `KLBN4.SA`, `BVMF:KLBN4` ou lote fracionário `KLBN4F`.

## Ajustes aplicados

- Normalização única de tickers no sync de transações: remove prefixos BVMF/BMFBOVESPA/B3, sufixos `.SA`/`-SA`, sufixo `SA` colado e lote fracionário `F`.
- Deduplicação por `client_tx_id` antes de gravar transações no Supabase em `upsert_transactions`.
- Mesma deduplicação aplicada em `replace_transactions_for_symbols`, evitando duplicidade no fluxo Excel B3 + manual + nuvem.
- Restauração (`get_transactions`) passa a devolver `symbol`, `ticker`, `client_tx_id` e `clientTxId` canônicos para o APK.
- Mantido o contrato de sync existente, sem quebrar chamadas antigas do app.

## Compatibilidade APK

Este checkpoint acompanha o APK v282, que reforça a deduplicação local com índice único por símbolo e migração Room 8→9.
