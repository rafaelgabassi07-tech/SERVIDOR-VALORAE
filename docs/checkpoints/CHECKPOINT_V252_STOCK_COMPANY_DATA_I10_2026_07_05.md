# Checkpoint v253 — Informações sobre a empresa no modal de ações

## Escopo

Implementa o checkpoint 4 solicitado para o modal de ação: `Dados sobre a empresa`.

## Fonte

Investidor10, seção pública `DADOS SOBRE A EMPRESA` da página de ação.

## Contrato

- `companyData.id = stock_company_data`
- `companyData.title = Dados sobre a empresa`
- `companyData.facts[]`: Nome da Empresa, CNPJ, Ano de estreia na bolsa, Número de funcionários, Ano de fundação
- `companyData.companyPapers[]`
- `companyData.fractionalPapers[]`

## Política

Sem fallback PETR4/GGRC11, sem mock e sem dado inventado. Quando a seção real não vier, status `EMPTY`.
