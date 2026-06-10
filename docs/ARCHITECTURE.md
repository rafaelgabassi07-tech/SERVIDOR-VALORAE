# Arquitetura VALORAE Proxy v21.13.1

O Proxy foi auditado depois da reconstrução para manter a simplicidade sem perder contratos necessários ao APK.

## Contrato principal

```text
/api/v1/mobile/portfolio-sync
```

Esse endpoint reúne análise, histórico, IPCA, proventos e rankings opcionais. Blocos opcionais são controlados por flags `includeAnalysis`, `includeHistory`, `includeIpca`, `includeDividends` e `includeRankings`.

## Correções da auditoria v21.13.1

- `/asset/history` não reaproveita mais histórico de carteira; agora responde como contrato de histórico do ativo.
- `/dividends/batch` com carteira vazia não baixa agenda pública inteira.
- Parser de agenda limita cada ticker ao seu próprio segmento para evitar trocar valores entre cards compactos.
- Blocos remotos do contrato mobile são avaliados de forma isolada, evitando que erro em IPCA/proventos derrube análise local.
- O monitor continua leve e aponta para as rotas reais do contrato.
