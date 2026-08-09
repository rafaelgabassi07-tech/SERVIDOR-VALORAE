# Proxy v146 — Correção de escala monetária da Análise

## Problema

A extração de alguns campos monetários capturava apenas `R$ 445,19` e descartava o sufixo `Milhões`/`Bilhões`. Isso fazia o APK exibir valores de grande porte como valores unitários em reais.

## Correção

- `firstDisplayValueAfterLabel` agora preserva sufixos de escala em valores monetários e numéricos.
- `profileDisplay`, `contextDisplay` e `displayByUnit` priorizam valores com escala explícita.
- Campos zerados de faixa de preço e liquidez deixam de ser tratados como valor final.
- Variações de preço impossíveis, abaixo de -100%, são suprimidas.

## Escopo

Sem alteração em contratos de sincronização, Supabase, SQL, autenticação ou rotas de carteira.
