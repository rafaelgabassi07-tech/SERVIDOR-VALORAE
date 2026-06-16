// Guardião de consistência financeira v21.12.29.
// Objetivo: detectar valores impossíveis/suspeitos antes do app substituir cache ou renderizar painéis.
// Não remove dados; sinaliza com severidade, caminhos e recomendações para manter rastreabilidade.

export const VALORAE_FIELD_CONSISTENCY_GUARD_VERSION = '21.12.29-field-consistency-guard';

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function arr(v) { return Array.isArray(v) ? v : []; }
function keys(v) { return isObject(v) ? Object.keys(v) : []; }
function clamp(n, min = 0, max = 100) { return Math.max(min, Math.min(max, Math.round(Number(n) || 0))); }
function unwrap(v) { return isObject(v) && ('value' in v || 'display' in v) ? (v.value ?? v.display) : v; }
function numberValue(v) {
  const raw = unwrap(v);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (raw == null || typeof raw === 'object') return null;
  const normalized = String(raw).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
function pathIssue(path, field, value, severity, reason, recommendation) {
  return { path, field, value: unwrap(value), severity, reason, recommendation };
}

const RULES = [
  { re: /^(precoAtual|price|currentPrice|valorPatrimonialCota|lastDividend|ultimoRendimento)$/i, min: 0, max: 1000000, kind: 'money_positive', label: 'Valor monetário positivo' },
  { re: /^(valorDeMercado|marketCap|valorDeFirma|enterpriseValue|patrimonioLiquido|equity|ativosTotais|assets|divida|dividaBruta|dividaLiquida|cash|disponibilidade|liquidezMediaDiaria|dailyLiquidity|valorPatrimonialTotal)$/i, min: -1e13, max: 1e15, kind: 'money_scale', label: 'Escala monetária plausível' },
  { re: /(dy|yield|dividend|payout|roe|roic|roa|margem|margin|cagr|vacancia|vacancy|freeFloat|tagAlong)/i, min: -500, max: 1500, kind: 'percent', label: 'Percentual plausível' },
  { re: /^(pl|psr|pvp|p_vp|evEbitda|evEbit|vpa|lpa|assetTurnover|liquidezCorrente|currentLiquidity|netDebtEbitda|netDebtEbit|grossDebtEquity|netDebtEquity)$/i, min: -10000, max: 10000, kind: 'ratio', label: 'Múltiplo/razão plausível' },
  { re: /(cotistas|shareholders|cotasEmitidas|issuedShares|propertiesCount|quantidadeImoveis|funcionarios|employees)/i, min: 0, max: 1e12, kind: 'count', label: 'Contagem plausível' },
  { re: /(abl|area|m2|grossLeasableArea)/i, min: 0, max: 1e9, kind: 'area', label: 'Área plausível' },
];

function ruleFor(field = '') { return RULES.find(r => r.re.test(String(field || ''))); }
function collectCandidateFields(payload = {}) {
  const out = [];
  const pushObj = (base, obj) => {
    for (const [k, v] of Object.entries(obj || {})) out.push({ field: k, path: `${base}.${k}`, value: v });
  };
  pushObj('normalized', payload.normalized || {});
  pushObj('appPayload.metrics.canonical', payload.appPayload?.metrics?.canonical || {});
  pushObj('appMobileSnapshot.metrics', payload.appMobileSnapshot?.metrics || {});
  const contractFields = payload.assetClassContract?.fields || payload.assetClassContract?.fieldConfidence || {};
  pushObj('assetClassContract.fields', contractFields);
  for (const group of Object.values(payload.assetClassContract?.groups || {})) {
    for (const [field, value] of Object.entries(group?.fields || {})) out.push({ field, path: `assetClassContract.groups.${group?.title || 'group'}.${field}`, value });
  }
  for (const group of arr(payload.assetIndicatorCoverage?.groups)) {
    for (const f of arr(group.fields)) out.push({ field: f.key, path: `assetIndicatorCoverage.groups.${group.key}.${f.key}`, value: f.value });
  }
  return out.filter(x => x.field && x.value !== undefined && x.value !== null && x.field !== '_meta');
}

function duplicateValueDrift(candidates = []) {
  const byField = new Map();
  for (const c of candidates) {
    const n = numberValue(c.value);
    if (n === null) continue;
    const key = String(c.field || '').toLowerCase();
    if (!byField.has(key)) byField.set(key, []);
    byField.get(key).push({ ...c, n });
  }
  const issues = [];
  for (const [field, items] of byField.entries()) {
    if (items.length < 2) continue;
    const nums = items.map(i => i.n).filter(Number.isFinite);
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max > 0 && min >= 0 && max / Math.max(1e-9, min) > 1000) {
      issues.push(pathIssue(items[0].path, field, `${min}..${max}`, 'warn', 'same_field_scale_drift', 'Verifique se alguma fonte entregou valor em escala diferente, como milhões/bilhões ou percentual já dividido.'));
    }
  }
  return issues;
}

export function buildFieldConsistencyGuard(payload = {}) {
  const candidates = collectCandidateFields(payload);
  const issues = [];
  let checked = 0;
  for (const item of candidates) {
    const rule = ruleFor(item.field);
    if (!rule) continue;
    const n = numberValue(item.value);
    if (n === null) continue;
    checked += 1;
    if (n < rule.min || n > rule.max) {
      issues.push(pathIssue(item.path, item.field, n, Math.abs(n) > Math.abs(rule.max) * 8 ? 'error' : 'warn', `${rule.kind}_out_of_range`, `${rule.label}: esperado entre ${rule.min} e ${rule.max}. Mantenha o campo, mas marque como suspeito no app/monitor.`));
    }
    if (/pvp|p_vp/i.test(item.field) && payload.type === 'FII' && n > 20) {
      issues.push(pathIssue(item.path, item.field, n, 'warn', 'fii_pvp_extreme', 'P/VP de FII muito alto; confirme se o valor veio como percentual ou se a fonte mudou o layout.'));
    }
    if (/dy|yield/i.test(item.field) && n > 200) {
      issues.push(pathIssue(item.path, item.field, n, 'warn', 'yield_extreme', 'Yield acima do normal; confirme se a fonte retornou valor acumulado, percentual ou texto concatenado.'));
    }
  }
  issues.push(...duplicateValueDrift(candidates));
  const errors = issues.filter(i => i.severity === 'error').length;
  const warns = issues.filter(i => i.severity === 'warn').length;
  const score = clamp(100 - errors * 18 - warns * 6 - Math.max(0, 10 - checked) * 1.5);
  return {
    version: VALORAE_FIELD_CONSISTENCY_GUARD_VERSION,
    generatedAt: payload.metrics?.generatedAt || new Date().toISOString(),
    ticker: payload.ticker,
    type: payload.type,
    checkedFields: checked,
    candidateFields: candidates.length,
    score,
    state: score >= 90 ? 'clean' : score >= 75 ? 'attention' : score >= 55 ? 'review_required' : 'unsafe_for_auto_replace',
    issueCounts: { total: issues.length, errors, warnings: warns },
    issues: issues.slice(0, 60),
    appPolicy: {
      renderAllowed: score >= 55,
      replaceSnapshotAllowed: score >= 70 && errors === 0,
      showDataQualityBadge: issues.length > 0,
      recommendedBadge: errors ? 'dados_em_revisao' : warns ? 'dados_suspeitos' : 'dados_consistentes',
    },
    monitorHint: 'Use este bloco para revelar campos plausíveis, suspeitos ou fora de escala sem descartar rastreabilidade do payload original.',
  };
}
