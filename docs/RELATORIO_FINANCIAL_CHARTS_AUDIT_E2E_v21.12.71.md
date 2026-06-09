# VALORAE Proxy v21.12.72 — Auditoria E2E dos Gráficos Financeiros

## Problema auditado
Os gráficos das abas **Desempenho & Índices** e **Finanças & Balanço** continuavam vazios ou parciais no APK, mesmo após correções anteriores.

## Causas encontradas
1. O contrato `chartfast` era rápido demais e podia não completar as APIs internas do Investidor10 para DRE, Lucro x Cotação, Balanço, Payout, Comparação com Índices e faturamento por região/negócio.
2. O normalizador financeiro usava a primeira fonte não vazia. Se a primeira fonte tinha apenas PL, ela impedia o uso de outra fonte posterior com Ativo/Passivo.
3. O parser de séries aceitava arrays diretos como valor escalar, gerando ponto artificial `P1` a partir de arrays como `ativo: [990, 1200]`.
4. A descoberta de IDs do Investidor10 era restrita a poucos nomes (`companyId`, `tickerId`) e podia ignorar variações como `company_id`, `idCompany`, `ticker_id`, `stockId`, etc.
5. Faturamento por região/negócio não tinha papéis próprios no classificador de payloads, ficando dependente apenas de embeds específicos.

## Correções aplicadas
- Novo perfil `chartdeep`/`financial-charts`, voltado a gráficos financeiros completos sem notícias e sem complemento StatusInvest.
- Extração de IDs do Investidor10 ampliada em `lib/market/investidor10-chart-extractor.js` e `lib/Valorae-engine.js`.
- Normalização financeira passou a mesclar fontes, não apenas escolher a primeira.
- Lucro x Cotação agora mescla fontes parciais de cotação e lucro.
- Payout Histórico passou a mesclar todas as fontes disponíveis.
- Balanço/Evolução Patrimonial agora preservam Ativo, PL e Passivo quando vêm em fontes separadas.
- Faturamento por região/negócio ganhou classificação própria: `revenueRegion` e `revenueBusiness`.
- Testes atualizados para aceitar a release `21.12.72`.

## Validação
Comando executado:

```bash
node --check lib/market/investidor10-chart-extractor.js
node --check lib/Valorae-engine.js
node --check lib/performance/profile.js
node scripts/audit-version-consistency.js
npm test -- --runInBand
```

Resultado:

```text
VALORAE test runner: 91 arquivos executados; falhas=0; lentos=nenhum
```

## Versão
- Core: `21.12.0`
- Release: `21.12.72-valorae-final-ui-charts-news-backup-fix`
