# VALORAE Proxy v21.12.74 — Auditoria mobile bootstrap safe UI

Data: 2026-06-09
Base auditada: Proxy v21.12.73 mobile boot deadline

## Objetivo

A segunda rodada teve foco em tornar o Proxy mais amigável ao APK mobile cache-first. O objetivo não foi apenas reduzir timeout, mas garantir que a resposta do bootstrap seja segura por bloco: se ativos ou notícias falharem, o endpoint deve retornar uma resposta parcial controlada, com orientação para o app preservar último conteúdo conhecido.

## Pontos encontrados

1. O endpoint `/api/v1/mobile/bootstrap` existia, mas podia ser mais explícito em fallback por bloco.
2. A resposta compacta precisava informar ao APK que blocos como notícias, rankings, diagnósticos e chart bundles são não bloqueantes.
3. Falhas em ativos ou notícias deveriam ser convertidas em payload parcial, não erro geral da rota.
4. O APK precisa saber quando deve manter cache local em vez de limpar tela.

## Melhorias aplicadas

### 1. Fallback por bloco

Foram adicionados fallback explícitos:

- `assetFallback(reason)`
- `newsFallback(reason)`

Cada bloco pode falhar isoladamente sem derrubar a rota inteira.

### 2. Deadline independente para ativos e notícias

O endpoint mantém `withRouteDeadline(...)` por bloco:

- ativos respeitam orçamento próprio dentro do deadline geral;
- notícias usam orçamento menor para não prender a resposta;
- a rota retorna `partial: true` quando algum bloco excede orçamento.

### 3. Hints de UI para o APK

A resposta agora inclui:

```json
{
  "uiHints": {
    "renderPolicy": "cache-first-stale-while-revalidate",
    "emptyStatePolicy": "keep-last-good-content",
    "recommendedAppAction": "render-local-snapshot-and-revalidate-missing-blocks",
    "nonBlockingBlocks": ["news", "rankings", "diagnostics", "chartBundles"]
  }
}
```

Essas hints documentam o contrato esperado: o APK não deve limpar UI quando a resposta é parcial.

### 4. Diagnóstico mais útil

A resposta inclui contadores e avisos:

- `assetCount`
- `newsCount`
- `assetStats`
- `errors`
- `warnings`

Isso ajuda o app e o painel a entenderem se a resposta veio completa, parcial, cacheada ou degradada.

## Arquivos alterados

- `routes/mobile/bootstrap.js`
- `package.json`
- `metadata.json`

## Validação executada

- `node --check routes/mobile/bootstrap.js`: OK.
- `npm run check`: OK.
- `npm run build`: OK.
- Integridade do ZIP final: executada com `unzip -t`.

## Compatibilidade

A rota continua compatível com:

- `/api/v1/mobile/bootstrap`
- `/api/v1/app/bootstrap`

O core público permanece `21.12.0`; esta entrega é identificada como patch interno `21.12.74-mobile-bootstrap-safe-ui`.
