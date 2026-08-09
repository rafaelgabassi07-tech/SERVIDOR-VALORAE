# Checkpoint 352 — Família segura, comunicados e comparação temporal

**Proxy público:** `21.12.352`  
**Patch:** `21.12.352-asset-modal-family-announcements-index-alignment-v320`  
**APK pareado:** v499 / `2026.07.12.01`  
**Protocolo móvel:** `2026.07.10.10`

## Correções

### Classificação e isolamento por família

A família explícita enviada pelo APK passa a prevalecer em tickers ambíguos. O catálogo de UNITs conhecidas continua protegendo ativos como `TAEE11`, enquanto uma solicitação `ACAO_UNIT` para ticker não catalogado não é automaticamente convertida em FII apenas pelo sufixo `11`.

O APK inclui a família nas chaves de cache e single-flight e rejeita respostas incompatíveis. Isso elimina a possibilidade de um snapshot de FII preencher o modal de Ação para o mesmo ticker.

### Comunicados

`announcements` passa a integrar as seções críticas de Ação e FII e pode ser solicitado isoladamente por `requiredSections`. Os produtores continuam específicos para cada família e resultados válidos são preservados em snapshots incrementais.

### Comparação com índices

`indexComparison` também integra a recuperação dirigida. Os períodos são iniciados em paralelo e uma recuperação específica aguarda o produtor necessário, sem reconstruir dezenas de seções não relacionadas.

O novo módulo `lib/analysis/asset-index-comparison.js`:

1. ordena os pontos pelo timestamp;
2. remove timestamps duplicados;
3. encontra a interseção temporal real das séries;
4. corta cada série para essa janela;
5. rebasa os retornos em zero no primeiro ponto real retido.

Não há interpolação nem criação de observações sintéticas.

## Evidência

O teste v320 cobre:

- `ABCD11` solicitado como Ação UNIT permanecendo `stock`;
- `TAEE11` permanecendo UNIT mesmo diante de hint conflitante;
- FII explícito permanecendo `fii`;
- comunicados e comparação presentes nas seções críticas;
- recuperação direcionada dos dois blocos;
- cache recusando contratos incompletos;
- alinhamento e rebasing de séries com frequências diferentes.

A suíte geral, build Vercel, auditoria de versão, sintaxe e testes cross-stack são gates obrigatórios da entrega.
