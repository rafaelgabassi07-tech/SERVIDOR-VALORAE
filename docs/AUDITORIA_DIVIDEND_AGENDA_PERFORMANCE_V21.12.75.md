# VALORAE Proxy v21.12.75 — Agenda de dividendos e performance mobile

## Escopo

Correção de performance e confiabilidade nas rotas usadas pelas telas de:

- Evolução de proventos;
- Agenda de dividendos;
- Rentabilidade vs IPCA+;
- histórico/analytics de carteira.

## Causa raiz encontrada

A busca da agenda do Investidor10 montava páginas por fonte e mês. Com carteiras grandes, históricos longos e deadlines mobile, a fila podia gastar orçamento buscando páginas antigas antes de cobrir corretamente mês atual, meses futuros e os dois tipos de ativo: ações e FIIs.

Além disso, `startDate` podia expandir a janela histórica para muitos meses mesmo quando o cliente já tinha enviado uma janela compacta, aumentando muito o volume de páginas.

## Alterações aplicadas

### 1. Janela histórica explícita respeitada

Quando o APK envia `historyMonths`, `monthsBack`, `pastMonths` ou `backMonths`, o Proxy respeita esse limite e não expande automaticamente pelo `startDate` da carteira.

### 2. Priorização mês atual/futuro

A agenda agora prioriza:

1. mês atual;
2. próximos meses;
3. histórico depois.

Isso melhora a utilidade da resposta parcial sob deadline.

### 3. Intercalação ações + FIIs

A fila alterna fontes por mês, evitando que uma classe monopolize o deadline. Isso ajuda a corrigir agendas que exibiam apenas FIIs e não ações.

### 4. Truncamento seguro de carteiras grandes

A rota `/api/v1/portfolio/dividends` deixou de rejeitar automaticamente mais de 30 tickers. Quando recebe mais do que o limite operacional, processa o lote móvel possível e retorna warning/partial em vez de HTTP 400.

### 5. Deadlines mobile

As rotas de histórico e próximos dividendos usam deadline de rota e retornam payload parcial seguro quando necessário, permitindo que o APK use cache/fallback local sem travar.

## Resultado esperado

- Menor latência para carteiras grandes.
- Respostas parciais úteis em vez de erro duro.
- Agenda com maior chance de conter ações e FIIs.
- Evita expansão histórica excessiva em mobile.
