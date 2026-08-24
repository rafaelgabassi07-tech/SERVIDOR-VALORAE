/**
 * Política pura de fan-out para a recuperação dirigida do modal de Ação.
 *
 * As tarefas já chegam filtradas pelas seções pedidas pelo APK. Esta camada apenas
 * limita endpoints redundantes sem eliminar classes inteiras de dados (payout,
 * receitas por região/negócio, DRE/FC e históricos), que precisam continuar
 * recuperáveis mesmo quando são consideradas "opcionais" no carregamento full.
 */
export const STOCK_TARGETED_RECOVERY_LIMITS = Object.freeze({
  assetTickerRest: 2,
  historicoIndicadores: 4,
  receitasLucros: 2,
  lucroCotacao: 2,
  evolucaoPatrimonio: 2,
  balanceSheetTable: 4,
  resultadoDre: 1,
  fluxoCaixa: 1,
  revenueGeography: 5,
  revenueSegment: 5,
  payoutHistorico: 1,
});

const STOCK_TARGETED_RECOVERY_PRIORITY = Object.freeze([
  'payoutHistorico',
  'resultadoDre',
  'fluxoCaixa',
  'balanceSheetTable',
  'historicoIndicadores',
  'receitasLucros',
  'lucroCotacao',
  'evolucaoPatrimonio',
  'assetTickerRest',
  'revenueGeography',
  'revenueSegment',
]);

/**
 * Seleciona de forma justa endpoints de recuperação. A primeira passagem garante
 * pelo menos uma tentativa por família pedida; as seguintes usam o orçamento
 * específico de cada família. Isso evita que dezenas de candidatos de receita
 * consumam o lote antes de payout ou demonstrativos financeiros.
 */
export function selectTargetedStockRecoveryTasks(tasks = [], { maxTotal = 24 } = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];
  const safeMax = Math.max(1, Math.min(40, Number(maxTotal) || 24));
  const grouped = new Map();
  for (const task of tasks) {
    if (!Array.isArray(task) || task.length < 2) continue;
    const key = String(task[0] || '').trim();
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(task);
    grouped.set(key, list);
  }

  const orderedKeys = [
    ...STOCK_TARGETED_RECOVERY_PRIORITY.filter(key => grouped.has(key)),
    ...[...grouped.keys()].filter(key => !STOCK_TARGETED_RECOVERY_PRIORITY.includes(key)),
  ];
  const selected = [];
  const taken = new Map();

  // Uma tentativa por família primeiro: a recuperação composta não pode deixar
  // nenhuma seção solicitada sem ao menos um endpoint real.
  for (const key of orderedKeys) {
    if (selected.length >= safeMax) break;
    const list = grouped.get(key) || [];
    if (!list.length) continue;
    selected.push(list[0]);
    taken.set(key, 1);
  }

  let progressed = true;
  while (selected.length < safeMax && progressed) {
    progressed = false;
    for (const key of orderedKeys) {
      if (selected.length >= safeMax) break;
      const list = grouped.get(key) || [];
      const count = taken.get(key) || 0;
      const limit = Math.max(1, Number(STOCK_TARGETED_RECOVERY_LIMITS[key] || 1));
      if (count >= limit || count >= list.length) continue;
      selected.push(list[count]);
      taken.set(key, count + 1);
      progressed = true;
    }
  }
  return selected;
}

export const _test = { STOCK_TARGETED_RECOVERY_PRIORITY };
