# Auditoria e implementação v21.12.27 — Investidor10 Asset Class Contracts

## Objetivo

Transformar a análise das páginas de Ação e FII do Investidor10 em melhorias concretas no VALORAE Engine, sem desmembrar `lib/Valorae-engine.js` e mantendo compatibilidade com Vercel Free, Web e APK.

## Implementações principais

### 1. Contrato especializado por classe de ativo

Novo módulo:

```text
lib/quality/asset-class-contract.js
```

Nova raiz no payload do Engine:

```text
assetClassContract
```

O contrato separa:

- Ação como empresa: perfil, cotação, valuation, rentabilidade, dívida, dividendos, demonstrações e pares.
- FII como fundo imobiliário: perfil, rendimentos, patrimonial, portfólio, vacância, cotistas, comunicados, checklist e pares.

### 2. Confiança por campo

Cada campo relevante recebe:

```text
value
display
unit
source
confidence
path
crossChecked
```

Isso permite que o app explique se um dado veio de `normalized`, `results`, `appPayload`, seção do HTML ou fallback.

### 3. Normalização ampliada

`lib/normalizers/universal.js` ganhou aliases para campos comuns das páginas de Ação/FII:

- P/L, P/Receita, P/VP, EV/EBITDA, EV/EBIT, VPA, LPA.
- ROE, ROIC, ROA, margens, payout, CAGR.
- dívida bruta, dívida líquida, caixa, ativos, ativo circulante.
- free float, tag along, segmento de listagem.
- cotistas, cotas emitidas, taxa de administração, tipo de fundo, mandato, gestão, público-alvo.
- vacância física/financeira, valor patrimonial, ABL, imóveis e patrimônio total.

### 4. Endpoints especializados

Novos endpoints de Ação:

```text
/api/v1/asset/profile
/api/v1/asset/valuation
/api/v1/asset/profitability
/api/v1/asset/debt
/api/v1/asset/statements
/api/v1/asset/peers
/api/v1/asset/source-map
```

Novos endpoints de FII:

```text
/api/v1/fii/profile
/api/v1/fii/income
/api/v1/fii/patrimonial
/api/v1/fii/portfolio
/api/v1/fii/vacancy
/api/v1/fii/communications
/api/v1/fii/checklist
```

### 5. Monitor profissional atualizado

`public/server.html` e `public/index.html` ganharam páginas em **Dados Financeiros**:

- Contrato Ação/FII.
- Páginas de Ação.
- Páginas de FII.
- Fonte por campo.

O monitor agora reconhece sinais de saída:

```text
hasAssetClassContract
assetClassScore
assetClassState
assetClassGroups
assetClassFields
```

### 6. OpenAPI e catálogo de campos

Atualizados:

```text
routes/openapi.js
routes/fields.js
```

Inclui novos endpoints, nova raiz `assetClassContract`, campos normalizados e mapas de integração.

## Como o app deve consumir

Para tela principal:

```text
GET /api/v1/asset?ticker=PETR4&view=app
```

Para auditoria de campo:

```text
GET /api/v1/asset/source-map?ticker=PETR4
```

Para tela específica de ação:

```text
GET /api/v1/asset/valuation?ticker=PETR4
GET /api/v1/asset/profitability?ticker=PETR4
GET /api/v1/asset/debt?ticker=PETR4
```

Para tela específica de FII:

```text
GET /api/v1/fii/income?ticker=HGLG11
GET /api/v1/fii/patrimonial?ticker=HGLG11
GET /api/v1/fii/portfolio?ticker=HGLG11
GET /api/v1/fii/checklist?ticker=HGLG11
```

## Resultado

O VALORAE Engine deixa de entregar apenas métricas genéricas e passa a entender o contexto do ativo:

```text
Ação = empresa
FII = fundo imobiliário
```

Isso melhora precisão, organização de painéis, rastreabilidade e estabilidade do app quando as fontes retornam dados parciais.
