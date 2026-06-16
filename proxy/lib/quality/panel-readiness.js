import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_PANEL_READINESS_VERSION = '21.12.3-panel-data-readiness';

function get(obj, path) {
  return String(path).split('.').reduce((acc, key) => acc == null ? undefined : acc[key], obj);
}

function present(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function numberLike(value) {
  return parseFinancialNumber(value, { maxAbs: 1e15 }) !== null;
}

function hasAny(payload, paths = []) {
  return paths.some(path => present(get(payload, path)));
}

function countPresent(payload, paths = []) {
  return paths.filter(path => present(get(payload, path))).length;
}

function normalizePercent(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

const PANEL_SPECS = {
  quote: {
    label: 'Cotação',
    paths: ['results.precoAtual', 'results.cotacao.precoAtual', 'results.price', 'normalized.precoAtual.value'],
    required: 1,
    consumerHint: 'Exibir preço atual/cotação no topo do painel.',
  },
  fundamentals: {
    label: 'Fundamentos',
    pathsByType: {
      FII: ['results.dividendYield', 'results.pvp', 'results.valorPatrimonialCota', 'results.patrimonioLiquido', 'results.ultimoRendimento', 'normalized.dividendYield.value', 'normalized.pvp.value'],
      DEFAULT: ['results.dividendYield', 'results.pl', 'results.pvp', 'results.roe', 'results.valorDeMercado', 'normalized.dividendYield.value', 'normalized.pl.value'],
    },
    required: 3,
    consumerHint: 'Montar cards de indicadores; sinalizar campos ausentes em vez de quebrar a tela.',
  },
  dividends: {
    label: 'Dividendos/Rendimentos',
    paths: ['results.dividendos', 'results.dividendos.historico', 'results.historicoDividendos', 'results.ultimoRendimento', 'dividendStats'],
    required: 1,
    consumerHint: 'Popular histórico e resumo de proventos quando houver pontos suficientes.',
  },
  charts: {
    label: 'Gráficos',
    paths: ['chartSeries.series', 'chartReadiness.topSeries', 'results.historicoIndicadores', 'results.historicoDividendos'],
    required: 1,
    consumerHint: 'Usar chartSeries.series como fonte preferencial já normalizada para o app.',
  },
  news: {
    label: 'Notícias',
    paths: ['news', 'newsStatus'],
    required: 1,
    consumerHint: 'Renderizar notícias apenas quando newsStatus.ok=true ou houver itens.',
  },
  sourceTrace: {
    label: 'Fonte/Cache',
    paths: ['sourceReport', 'sourceReliability', 'metrics.sourcesTried', 'cacheStatus'],
    required: 1,
    consumerHint: 'Mostrar diagnóstico de fonte/cache no painel técnico ou modo debug.',
  },
};

function specPaths(spec, type) {
  if (spec.pathsByType) return spec.pathsByType[type] || spec.pathsByType.DEFAULT || [];
  return spec.paths || [];
}

function buildPanel(specKey, spec, payload) {
  const type = String(payload.type || 'DEFAULT').toUpperCase();
  const paths = specPaths(spec, type);
  const presentCount = countPresent(payload, paths);
  const required = Math.max(1, Number(spec.required || 1));
  const complete = presentCount >= required;
  const percent = normalizePercent((presentCount / Math.max(required, paths.length || required)) * 100);
  const missingPaths = paths.filter(path => !present(get(payload, path))).slice(0, 8);
  return {
    key: specKey,
    label: spec.label,
    ready: complete,
    completenessPercent: complete ? Math.max(percent, 70) : percent,
    presentSignals: presentCount,
    expectedSignals: paths.length,
    minimumSignals: required,
    missingPaths,
    consumerHint: spec.consumerHint,
  };
}

function detectValueGaps(payload = {}) {
  const type = String(payload.type || '').toUpperCase();
  const results = payload.results || {};
  const normalized = payload.normalized || {};
  const gaps = [];
  const critical = type === 'FII'
    ? ['dividendYield', 'pvp', 'valorPatrimonialCota', 'patrimonioLiquido', 'ultimoRendimento']
    : ['precoAtual', 'dividendYield', 'pl', 'pvp', 'roe', 'valorDeMercado'];
  for (const key of critical) {
    const value = normalized?.[key]?.value ?? results?.[key] ?? results?.indicadores?.[key];
    if (!present(value)) gaps.push({ field: key, severity: 'missing', message: `Campo crítico ausente: ${key}` });
    else if (typeof value !== 'object' && !numberLike(value)) gaps.push({ field: key, severity: 'format', message: `Campo crítico não numérico: ${key}` });
  }
  return gaps.slice(0, 12);
}

function deriveConsumerContract(payload, panels, gaps) {
  const chartSeries = payload.chartSeries?.series || [];
  const bestChart = chartSeries[0];
  return {
    preferredChartPath: 'chartSeries.series',
    preferredMetricsPath: 'normalized',
    preferredRawPath: 'results',
    bestChartKey: bestChart?.key || null,
    bestChartPointCount: bestChart?.pointCount || 0,
    canRenderDashboard: panels.some(p => p.key === 'quote' && p.ready) || panels.filter(p => p.ready).length >= 2,
    canRenderCharts: panels.some(p => p.key === 'charts' && p.ready),
    shouldShowPartialBanner: Boolean(payload.partial || payload.status === 'PARTIAL' || gaps.some(g => g.severity === 'missing')),
    safeFallbackText: payload.partial ? 'Dados parciais: algumas fontes não retornaram todos os campos.' : 'Dados recebidos com contrato normalizado.',
  };
}

export function buildPanelReadiness(payload = {}) {
  const panels = Object.entries(PANEL_SPECS).map(([key, spec]) => buildPanel(key, spec, payload));
  const readyPanels = panels.filter(p => p.ready).length;
  const avgCompleteness = panels.length ? Math.round(panels.reduce((sum, p) => sum + p.completenessPercent, 0) / panels.length) : 0;
  const gaps = detectValueGaps(payload);
  const hardWarnings = Array.isArray(payload.warnings) ? payload.warnings.length : 0;
  const score = normalizePercent(avgCompleteness * 0.62 + (readyPanels / Math.max(1, panels.length)) * 28 + (payload.chartReadiness?.ready ? 10 : 0) - gaps.length * 3 - hardWarnings * 1.2);
  return {
    version: VALORAE_PANEL_READINESS_VERSION,
    ready: score >= 55 && readyPanels >= 2,
    score,
    grade: score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D',
    readyPanels,
    totalPanels: panels.length,
    panels,
    gaps,
    consumerContract: deriveConsumerContract(payload, panels, gaps),
    recommendations: [
      ...(payload.chartReadiness?.ready ? [] : ['Priorize chartSeries normalizado ou histórico de dividendos/indicadores para liberar gráficos confiáveis.']),
      ...(gaps.length ? ['Não ocultar erro no app: exibir banner de dados parciais e campos ausentes por painel.'] : []),
      ...(payload.sourceReport?.primarySource ? [] : ['Sem fonte primária clara; revisar sourceReport e sourcesTried.']),
    ].slice(0, 6),
  };
}
