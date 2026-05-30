# Auditoria e otimização — VALORAE v21.12.41 Turbo Extraction Max

## Objetivo

Potencializar ao máximo a extração de dados do VALORAE Proxy mantendo o projeto gratuito, compatível com Vercel Free e preservando `lib/Valorae-engine.js` como núcleo central.

## Principais melhorias aplicadas

1. **Perfil `turbo` / `max`**
   - Novo perfil de performance para chamadas que exigem máxima completude.
   - Ativa HTML completo, APIs internas, Yahoo fallback, complemento adaptativo e complemento StatusInvest sob demanda.
   - Uso recomendado: `/api/v1/asset?ticker=PETR4&view=app&profile=turbo`.

2. **Score de completude por campos críticos**
   - O projeto não decide mais completude apenas por contagem bruta de chaves.
   - Agora mede campos críticos por classe de ativo, como cotação, variação, DY, P/L, P/VP, ROE, ROIC, VP/cota, número de cotistas e descrição.
   - Métrica entregue em `metrics.extractionCompleteness.criticalFields`.

3. **Complemento StatusInvest sob demanda**
   - Quando Investidor10/seletores/Yahoo ainda deixam dados pobres, o motor tenta StatusInvest como complemento curto.
   - O complemento só preenche campos ausentes; não sobrescreve campos bons da fonte principal.
   - Controlável por `statusInvestComplement=0` ou `VALORAE_STATUSINVEST_COMPLEMENT_ENABLED=false`.

4. **Chave de cache corrigida para completude**
   - O cache final agora diferencia chamadas rápidas, completas, com/sem complemento e com/sem snapshot.
   - Evita que uma chamada `fast` incompleta contamine uma chamada `complete/turbo`.

5. **Benchmark turbo adicionado**
   - Novo script `npm run bench:turbo`.
   - Novo arquivo de resultado: `reports/benchmark-extraction-turbo-v21.12.41.json`.

6. **Documentação e configuração**
   - `.env.example` e `docs/ENVIRONMENT.md` documentam variáveis da camada turbo.
   - PWA, Service Worker, metadata, readiness e manifesto foram sincronizados para `21.12.41-turbo-extraction-max`.

## Resultado do benchmark local/mocado

| Caso | Média | Mediana | P95 | Status | Parcial | Score |
|---|---:|---:|---:|---|---|---:|
| turbo-complement-no-result-cache | 26.53 ms | 21.227 ms | 31.558 ms | OK | false | 86 |
| turbo-result-cache-hit | 0.736 ms | 0.648 ms | 0.927 ms | OK | false | 86 |

Benchmark nativo de scraping:

| Caso | Média | Mediana | P95 |
|---|---:|---:|---:|
| fast-selectors-single-pass | 1.493 ms | 1.249 ms | 2.886 ms |
| custom-selectors-css-lite | 2.509 ms | 2.271 ms | 4.161 ms |
| signature-result-key | 0.025 ms | 0.018 ms | 0.035 ms |
| signature-fetch-key | 0.007 ms | 0.004 ms | 0.009 ms |

## Testes executados

Passaram:

- `npm run check`
- `npm test`
- `npm run build`
- `npm run build:strict`
- `npm run typecheck`
- `npm run smoke`
- `npm run audit:complete-polish`
- `npm run audit:visual-polish`
- `npm run audit:engine-core`
- `npm run audit:engine-modules`
- `npm run audit:engine-performance`
- `npm run audit:version`
- `npm run audit:release`
- `npm run audit:routes`
- `npm run audit:free`
- `npm run bench:scrape`
- `npm run bench:turbo`
- `npm audit --omit=dev` — 0 vulnerabilidades

## Observações importantes

- `PARTIAL` ainda pode ocorrer se todas as fontes externas falharem, forem bloqueadas ou mudarem HTML simultaneamente.
- A v21.12.41 reduz `PARTIAL` falso e aumenta a chance de payload completo, mas não inventa dados.
- O complemento StatusInvest é usado como reforço; a fonte principal continua sendo Investidor10 quando disponível.
- O último snapshot bom continua sendo usado apenas para preencher campos ausentes e evitar tela vazia no app.

## Veredito

A versão `21.12.41-turbo-extraction-max` é a mais forte até agora para lançamento pessoal: melhor completude, melhor cache, fallback mais inteligente e benchmark validado.
