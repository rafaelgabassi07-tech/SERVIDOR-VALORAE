# Proxy 21.12.404 × APK v646 — ticker de mercado

## Escopo
Correção da origem de dados da market tape da página Análise para USD, IFIX, IDIV, SMLL, CDI, IPCA, IBOV e IVVB11.

## Alterações
- `/api/v1/market/indices` usa um snapshot dedicado aos instrumentos realmente exibidos.
- BOVA11, SMAL11 e DIVO11 deixam de fazer parte do hot path da market tape.
- IBOV, IFIX, IDIV e SMLL consultam em paralelo a fonte direta usada pelos comparadores e Yahoo; a observação direta válida tem prioridade.
- CDI/IPCA continuam sendo obtidos pelas fontes macroeconômicas existentes.
- Snapshot `PARTIAL` não substitui cache completo anterior.
- `refresh`, `nocache` e `forceRefresh` passam a efetivamente ignorar o cache na rota.
- Compatibilidade pareada: `2026.08.09.09`.

## Teste específico
`test/analysis-market-ticker-v646.test.js` simula as fontes externas e exige oito itens numéricos em ordem canônica. Também falha se o endpoint consultar BOVA11, SMAL11 ou DIVO11 e verifica os IDs diretos 1/22/8/6 usados pelo comparador para IBOV/IFIX/IDIV/SMLL.

## Resultado final dos testes
- Build Vercel: aprovado.
- Sintaxe: 444 arquivos JS aprovados.
- Auditoria de versão: aprovada.
- Teste específico v646: aprovado.
- Suíte completa: 288 arquivos; 184 aprovados; 100 bloqueados por dependências opcionais ausentes; mesmas 4 falhas históricas da v645; zero falha nova.
