# Compatibilidade APK v630 — Análise / ticker de mercado

- APK pareado: `2026.08.08.08` (v630)
- Proxy público: `21.12.404`
- Release patch: `21.12.404-account-profile-v413`
- Ecossistema: `valorae-ecosystem-2026.08.05.04-p404`

## Alteração

O endpoint existente `/api/v1/market/indices` passa a expor `tickerItems` na ordem `USD, IFIX, IDIV, SMLL, CDI, IPCA, IBOV, IVVB11`, preservando `indices` para compatibilidade.

USD/índices/IVVB11 usam as fontes de mercado já existentes. CDI e IPCA reutilizam séries oficiais do Banco Central. Não há fallback sintético.

## APK

A home da Análise apresenta o ticker em carrossel infinito, mantém o último snapshot enquanto atualiza e não altera o modal do ativo nem o contrato dos rankings.
