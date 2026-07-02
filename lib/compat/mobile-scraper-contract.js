import { parseFinancialNumber } from '../normalizers/numbers.js';
import { classifyTicker as classifyCoreTicker } from '../core/tickers.js';

export const VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION = '21.13.15-mobile-investidor10-chart-fidelity-contract';

const KNOWN_B3_UNITS = new Set(['ALUP11','BPAC11','BRBI11','ENGI11','KLBN11','SANB11','SAPR11','TAEE11','TIET11','CESP11','AESB11','CPLE11','EQTL11','IGTI11','RNEW11']);
const KNOWN_B3_ETFS = new Set(['BOVA11','BOVV11','SMAL11','IVVB11','HASH11','QBTC11','BITH11','ETHE11','GOLD11','FIND11','DIVO11','ECOO11','PIBB11','SPXI11','XFIX11','MATB11','NASD11','TECK11','WRLD11','ACWI11','GENB11','MILL11','SHOT11','U30B11','USAL11','B5P211','IMAB11','IRFM11']);

function hasValue(value) {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function compactKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getPath(obj, path) {
  return String(path || '').split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function presentNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'object' && !Array.isArray(value)) return presentNumber(value.value ?? value.raw ?? value.number ?? value.amount ?? value.display ?? value.formatted);
  const parsed = parseFinancialNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scalarValue(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  return value.display ?? value.value ?? value.raw ?? value.formatted ?? null;
}

function displayValue(value, fallback = '-') {
  const scalar = scalarValue(value);
  if (scalar == null || scalar === '') return fallback;
  const text = String(scalar).trim();
  return text || fallback;
}

function firstPresent(...values) {
  for (const value of values) if (hasValue(value)) return value;
  return undefined;
}

function pickMetric(payload, canonicalKey, aliases = []) {
  const results = payload?.results || {};
  const normalized = payload?.normalized || {};
  const canonical = payload?.appPayload?.metrics?.canonical || {};
  const roots = [canonical, normalized, results, results.indicadores || {}, results.indicadoresFundamentalistas || {}, results.cotacao || {}, results.dividendos || {}, results.valorPatrimonial || {}, results.informacoesEmpresa || {}];
  const keys = [canonicalKey, ...aliases].filter(Boolean);
  for (const root of roots) {
    for (const key of keys) {
      const value = root?.[key];
      if (hasValue(scalarValue(value))) return scalarValue(value);
    }
  }
  return null;
}

function normalizeTicker(payload = {}) {
  return String(payload.ticker || payload.symbol || payload.results?.ticker || '').trim().toUpperCase();
}

function normalizeAssetClass(payload = {}) {
  const ticker = normalizeTicker(payload);
  const raw = String(payload.type || payload.assetType || payload.asset_type || payload.assetClass || payload.asset_class || payload.classe_ativo || payload.tipo_ativo || payload.results?.type || payload.results?.assetType || payload.results?.asset_type || payload.results?.assetClass || payload.results?.asset_class || payload.results?.classe_ativo || payload.results?.tipo_ativo || '').toUpperCase();
  const url = String(payload.url || payload.results?.url || payload.results?.sourceUrl || payload.sourceUrl || '').toLowerCase();
  if (url.includes('/acoes/')) return 'acao';
  if (url.includes('/fiis/')) return raw.includes('FIAGRO') ? 'fiagro' : 'fii';
  if (url.includes('/fiagros/')) return 'fiagro';
  if (url.includes('/etfs/')) return 'etf';
  if (url.includes('/bdrs/')) return 'bdr';
  if (url.includes('/stocks/') || url.includes('/reits/')) return 'stock';
  if (raw.includes('ETF')) return 'etf';
  if (raw.includes('BDR')) return 'bdr';
  if (raw.includes('STOCK') || raw.includes('REIT')) return 'stock';
  if (raw.includes('FIAGRO')) return 'fiagro';
  if (raw.includes('FII') || raw.includes('FUNDO IMOB')) return 'fii';
  if (raw.includes('ACAO') || raw.includes('AÇÃO') || raw.includes('STOCK') || raw.includes('UNIT')) return 'acao';
  const coreKind = classifyCoreTicker(ticker);
  if (coreKind === 'ACAO_UNIT') return 'acao';
  if (coreKind === 'ETF') return 'etf';
  if (coreKind === 'BDR') return 'bdr';
  if (KNOWN_B3_UNITS.has(ticker)) return 'acao';
  if (KNOWN_B3_ETFS.has(ticker)) return 'etf';
  if (/^[A-Z]{4}3[0-9]$/.test(ticker)) return 'bdr';
  if (/11$/.test(ticker)) return 'fii';
  return 'acao';
}

function normalizeAssetType(payload = {}) {
  const assetClass = normalizeAssetClass(payload);
  // O APK atual só ramifica de forma segura entre acao/fii. Classes negociadas na B3 que
  // não são FII ficam em modo acao para não ocultar telas por causa de um tipo inesperado.
  return assetClass === 'fii' || assetClass === 'fiagro' ? 'fii' : 'acao';
}

function periodFrom(value, fallback = '') {
  const raw = String(value ?? fallback ?? '').trim();
  if (!raw) return null;
  return raw.match(/(19|20)\d{2}/)?.[0] || raw;
}

function quarterFrom(point = {}) {
  const raw = point.quarter ?? point.trimestre ?? point.quarterLabel ?? point.period ?? point.periodo ?? point.label ?? '';
  const m = String(raw || '').match(/(?:^|\D)([1-4])\s*(?:T|TRI|Q|º\s*TRI)/i);
  return m ? Number(m[1]) : (point.quarter || point.trimestre || point.quarterLabel || null);
}

function normalizeFinancialPoint(point = {}, fallbackIndex = 0) {
  if (Array.isArray(point)) {
    const year = periodFrom(point[0], `P${fallbackIndex + 1}`);
    return {
      year,
      quarter: null,
      label: String(point[0] || year || `P${fallbackIndex + 1}`),
      net_revenue: presentNumber(point[1]),
      net_profit: presentNumber(point[2]),
      gross_profit: presentNumber(point[3]),
      cost: presentNumber(point[4]),
      ebitda: presentNumber(point[5]),
      ebit: presentNumber(point[6]),
    };
  }
  const year = periodFrom(point.year || point.ano || point.label || point.period || point.periodo, null);
  const quarter = quarterFrom(point);
  return {
    year,
    quarter,
    label: point.label || point.period || point.periodo || [year, quarter].filter(Boolean).join(' ') || null,
    net_revenue: presentNumber(point.netRevenue ?? point.receitaLiquida ?? point.receita_liquida ?? point.revenue ?? point.net_revenue ?? point.receita),
    net_profit: presentNumber(point.netProfit ?? point.lucroLiquido ?? point.lucro_liquido ?? point.profit ?? point.net_profit ?? point.lucro),
    gross_profit: presentNumber(point.grossProfit ?? point.lucroBruto ?? point.gross_profit),
    cost: presentNumber(point.cost ?? point.custo),
    ebitda: presentNumber(point.ebitda),
    ebit: presentNumber(point.ebit),
    operating_cash_flow: presentNumber(point.operatingCashFlow ?? point.operating_cash_flow ?? point.fluxoCaixaOperacional ?? point.fluxo_caixa_operacional),
    free_cash_flow: presentNumber(point.freeCashFlow ?? point.free_cash_flow ?? point.fluxoCaixaLivre ?? point.fluxo_caixa_livre ?? point.fcf),
    capex: presentNumber(point.capex ?? point.investimentos ?? point.investimento),
    cash_flow: presentNumber(point.cashFlow ?? point.cash_flow ?? point.fluxoCaixa ?? point.fluxo_caixa),
  };
}

function financialPointHasValue(point = {}) {
  return Object.entries(point).some(([key, value]) => !['year', 'quarter', 'label'].includes(key) && value !== null && value !== undefined && value !== '');
}

function buildReceitasLucros(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.revenueProfit,
    payload.results?.chartsFinanceiros?.receitasLucros,
    payload.results?.sections?.demonstrativos?.receitasLucros,
    payload.appPayload?.charts?.financialCharts?.receitasLucros,
  ];
  for (const source of sources) {
    const list = asArray(source).map((item, i) => normalizeFinancialPoint(item, i)).filter(financialPointHasValue);
    if (list.length) return list;
  }
  return [];
}

function normalizeProfitQuotePoint(point = {}, fallbackYear = '') {
  if (Array.isArray(point)) {
    const year = periodFrom(point[0], fallbackYear);
    return { year, net_profit: presentNumber(point[1]), quotation: presentNumber(point[2]) };
  }
  const year = periodFrom(point.year || point.ano || point.label || point.period || point.periodo, fallbackYear);
  return {
    year,
    net_profit: presentNumber(point.profit ?? point.netProfit ?? point.net_profit ?? point.lucro ?? point.lucroLiquido ?? point.lucro_liquido ?? point.resultado),
    quotation: presentNumber(point.quote ?? point.quotation ?? point.cotacao ?? point.price ?? point.preco ?? point.valor ?? point.close),
  };
}

function buildLucroCotacao(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.profitVsQuote,
    payload.results?.chartsFinanceiros?.lucroCotacao,
    payload.results?.sections?.demonstrativos?.lucroCotacao,
    payload.appPayload?.charts?.financialCharts?.lucroCotacao,
  ];
  for (const source of sources) {
    if (!hasValue(source)) continue;
    const out = {};
    if (Array.isArray(source)) {
      for (const point of source) {
        const normalized = normalizeProfitQuotePoint(point);
        if (!normalized.year) continue;
        out[normalized.year] = normalized;
      }
    } else if (source && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        const normalized = value && typeof value === 'object' && !Array.isArray(value)
          ? normalizeProfitQuotePoint(value, key)
          : normalizeProfitQuotePoint({ value, cotacao: value }, key);
        if (!normalized.year) continue;
        out[normalized.year] = normalized;
      }
    }
    if (Object.keys(out).length) return out;
  }
  return {};
}

function buildEvolucaoPatrimonio(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.equityEvolution,
    canonical.financial?.balanceSheet,
    payload.results?.chartsFinanceiros?.evolucaoPatrimonio,
    payload.results?.sections?.demonstrativos?.evolucaoPatrimonio,
    payload.appPayload?.charts?.financialCharts?.evolucaoPatrimonio,
  ];
  for (const source of sources) {
    const list = asArray(source).map((point, index) => {
      if (Array.isArray(point)) {
        const year = periodFrom(point[0], `P${index + 1}`);
        return {
          year,
          label: String(point[0] || year || `P${index + 1}`),
          net_worth: presentNumber(point[1]),
          net_revenue: presentNumber(point[2]),
          net_profit: presentNumber(point[3]),
          total_assets: presentNumber(point[4]),
          total_liabilities: presentNumber(point[5]),
        };
      }
      const year = periodFrom(point.year || point.ano || point.label || point.period || point.periodo, null);
      return {
        year,
        label: point.label || point.period || point.periodo || year,
        net_worth: presentNumber(point.netWorth ?? point.patrimonioLiquido ?? point.patrimonio_liquido ?? point.net_worth ?? point.equity),
        net_revenue: presentNumber(point.netRevenue ?? point.receitaLiquida ?? point.net_revenue),
        net_profit: presentNumber(point.netProfit ?? point.lucroLiquido ?? point.net_profit),
        total_assets: presentNumber(point.totalAssets ?? point.ativoTotal ?? point.ativo_total ?? point.assets ?? point.total_assets),
        total_liabilities: presentNumber(point.totalLiabilities ?? point.passivoTotal ?? point.passivo_total ?? point.liabilities ?? point.total_liabilities),
      };
    }).filter(financialPointHasValue);
    if (list.length) return list;
  }
  return [];
}

function buildPayout(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.payoutHistory,
    payload.results?.chartsFinanceiros?.payoutHistorico,
    payload.results?.payoutHistory,
    payload.results?.sections?.demonstrativos?.payoutHistorico,
    payload.appPayload?.charts?.financialCharts?.payoutHistorico,
  ];
  for (const source of sources) {
    const list = asArray(source).map((point, index) => {
      if (Array.isArray(point)) {
        const year = periodFrom(point[0], `P${index + 1}`);
        const payout = presentNumber(point[1]);
        const dy = presentNumber(point[2]);
        return { year, label: String(point[0] || year || `P${index + 1}`), payout, payout_company: payout, dy, dy_ticker: dy };
      }
      const year = periodFrom(point.year || point.ano || point.label || point.period || point.periodo, null);
      const payout = presentNumber(point.value ?? point.valor ?? point.payout ?? point.percent ?? point.percentage ?? point.payout_company);
      const dy = presentNumber(point.dy ?? point.dividendYield ?? point.dividend_yield ?? point.dy_ticker);
      return {
        year,
        label: point.label || point.period || point.periodo || year,
        payout,
        payout_company: payout,
        dy,
        dy_ticker: dy,
      };
    }).filter(financialPointHasValue);
    if (list.length) return list;
  }
  return [];
}


function buildIncomeStatement(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.incomeStatement,
    payload.results?.chartsFinanceiros?.resultados,
    payload.results?.chartsFinanceiros?.incomeStatement,
    payload.results?.sections?.demonstrativos?.resultados,
    payload.results?.sections?.demonstrativos?.incomeStatement,
  ];
  for (const source of sources) {
    const list = asArray(source).map((item, i) => normalizeFinancialPoint(item, i)).filter(financialPointHasValue);
    if (list.length) return list;
  }
  return [];
}

function buildCashFlowStatement(canonical = {}, payload = {}) {
  const sources = [
    canonical.financial?.cashFlowStatement,
    payload.results?.chartsFinanceiros?.fluxoCaixa,
    payload.results?.chartsFinanceiros?.cashFlow,
    payload.results?.chartsFinanceiros?.cashFlowStatement,
    payload.results?.sections?.demonstrativos?.fluxoCaixa,
    payload.results?.sections?.demonstrativos?.cashFlow,
  ];
  for (const source of sources) {
    const list = asArray(source).map((item, i) => normalizeFinancialPoint(item, i)).filter(financialPointHasValue);
    if (list.length) return list;
  }
  return [];
}

function buildFinancialCharts(canonical = {}, payload = {}) {
  const receitas_lucros = buildReceitasLucros(canonical, payload);
  const lucro_cotacao = buildLucroCotacao(canonical, payload);
  const evolucao_patrimonio = buildEvolucaoPatrimonio(canonical, payload);
  const payout = buildPayout(canonical, payload);
  const resultados = buildIncomeStatement(canonical, payload);
  const fluxo_caixa = buildCashFlowStatement(canonical, payload);
  const charts = { receitas_lucros: sortChartPoints(receitas_lucros), lucro_cotacao, evolucao_patrimonio: sortChartPoints(evolucao_patrimonio), payout: sortChartPoints(payout), resultados: sortChartPoints(resultados), fluxo_caixa: sortChartPoints(fluxo_caixa) };
  charts.receitasLucros = charts.receitas_lucros;
  charts.lucroCotacao = charts.lucro_cotacao;
  charts.evolucaoPatrimonio = charts.evolucao_patrimonio;
  charts.payoutHistorico = charts.payout;
  charts.resultadosDetalhados = charts.resultados;
  charts.fluxoCaixa = charts.fluxo_caixa;
  return charts;
}

function normalizeDateLabel(point = {}, fallbackIndex = 0) {
  const raw = point.date || point.data || point.period || point.periodo || point.label || point.x || point.year || point.ano || '';
  if (raw) return String(raw);
  return `P${fallbackIndex + 1}`;
}

function normalizeSeriesPoint(item, fallbackIndex = 0) {
  if (Array.isArray(item)) return { date: normalizeDateLabel({ label: item[0] }, fallbackIndex), profitability: presentNumber(item[1]) ?? 0 };
  if (item && typeof item === 'object') {
    return {
      date: normalizeDateLabel(item, fallbackIndex),
      profitability: presentNumber(item.profitability ?? item.rentabilidade ?? item.valuePercent ?? item.value ?? item.y ?? item.percentual) ?? 0,
    };
  }
  return { date: `P${fallbackIndex + 1}`, profitability: presentNumber(item) ?? 0 };
}

function seriesFromComparison(series = []) {
  return asArray(series).map(item => {
    const points = asArray(item.points || item.data || item.values).map(normalizeSeriesPoint);
    return points.length ? { label: item.name || item.label || item.key || 'Índice', points } : null;
  }).filter(Boolean);
}

function normalizeIndexComparison(value) {
  const out = [];
  const visit = (node, fallbackLabel = '', depth = 0) => {
    if (depth > 5 || !hasValue(node)) return;
    if (Array.isArray(node)) {
      const looksLikePointList = node.some(item => Array.isArray(item) || (item && typeof item === 'object' && !Array.isArray(item) && (item.date || item.data || item.period || item.periodo || item.label || item.x)));
      if (looksLikePointList && fallbackLabel) {
        const points = node.map(normalizeSeriesPoint).filter(p => p.date && p.profitability !== null && p.profitability !== undefined);
        if (points.length) out.push({ label: fallbackLabel, points });
        return;
      }
      node.forEach((item, i) => visit(item, fallbackLabel || `Índice ${i + 1}`, depth + 1));
      return;
    }
    if (node && typeof node === 'object') {
      const label = String(node.name || node.label || node.key || node.ticker || node.symbol || fallbackLabel || 'Índice');
      const rawPoints = node.points || node.data || node.values || node.series;
      if (Array.isArray(rawPoints)) {
        const points = rawPoints.map(normalizeSeriesPoint).filter(p => p.date && p.profitability !== null && p.profitability !== undefined);
        if (points.length) out.push({ label, points });
        return;
      }
      for (const [key, val] of Object.entries(node)) {
        if (Array.isArray(val)) visit(val, key, depth + 1);
      }
    }
  };
  visit(value);
  const seen = new Set();
  return out.filter(item => {
    const k = `${compactKey(item.label)}:${item.points.map(p => `${p.date}:${p.profitability}`).join('|')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 12);
}

function buildRentabilidadeChart(canonical = {}, payload = {}) {
  const raw = firstPresent(
    payload.results?.rentabilidadeChart,
    payload.results?.sections?.rentabilidadeChart,
    payload.results?.profitability,
    payload.appPayload?.charts?.financialCharts?.rentabilidade
  );
  if (raw?.profitabilities && Array.isArray(raw.profitabilities)) return raw;

  const profitability = canonical.profitability;
  if (profitability?.nominal?.length || profitability?.real?.length) {
    const nominal = asArray(profitability.nominal).map((item, i) => ({ date: item.period || item.label || `P${i + 1}`, profitability: presentNumber(item.valuePercent ?? item.value ?? item.raw) ?? 0 }));
    const real = asArray(profitability.real).map((item, i) => ({ date: item.period || item.label || nominal[i]?.date || `P${i + 1}`, profitability: presentNumber(item.valuePercent ?? item.value ?? item.raw) ?? 0 }));
    const series = [nominal, real].filter(x => x.length);
    return {
      lastProfitability: nominal.at(-1)?.profitability ?? real.at(-1)?.profitability ?? null,
      legend: series.length === 2 ? ['Rentabilidade', 'Rentabilidade real'] : ['Rentabilidade'],
      profitabilities: series,
      periods: profitability.periods || nominal.map(x => x.date),
      source: 'Investidor10.canonical.profitability',
    };
  }

  const comparisonSeries = normalizeIndexComparison(canonical.indexComparison || payload.results?.indexComparison || payload.results?.comparacaoIndices || []);
  if (comparisonSeries.length) {
    return {
      lastProfitability: comparisonSeries[0].points.at(-1)?.profitability ?? null,
      legend: comparisonSeries.map(x => x.label),
      profitabilities: comparisonSeries.map(x => x.points),
      source: 'Investidor10.canonical.indexComparison',
    };
  }
  return null;
}

function normalizeBreakdownEntryValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const n = presentNumber(value.value ?? value.valor ?? value.percent ?? value.percentage ?? value.valuePercent ?? value.y ?? value.amount);
    return { ...value, value: n ?? value.value ?? 0 };
  }
  return { value: presentNumber(value) ?? 0 };
}

function normalizeBreakdownArray(list = []) {
  const out = {};
  asArray(list).forEach((item, index) => {
    if (Array.isArray(item)) {
      const name = String(item[0] || `Item ${index + 1}`);
      out[name] = normalizeBreakdownEntryValue(item[1]);
      return;
    }
    if (item && typeof item === 'object') {
      const name = String(item.name || item.label || item.segment || item.segmento || item.region || item.regiao || item.região || item.country || item.pais || item.key || `Item ${index + 1}`);
      out[name] = normalizeBreakdownEntryValue(item);
      return;
    }
    out[`Item ${index + 1}`] = normalizeBreakdownEntryValue(item);
  });
  return out;
}


function normalizeHighchartsBreakdown(value = {}) {
  const categories = asArray(value.categories || value.periods || value.periodos || value.years || value.anos || value.xAxis?.categories).map(String).filter(Boolean);
  const defaultYear = String(value.year || value.ano || value.period || value.periodo || categories.at(-1) || 'Atual');
  const out = {};
  for (const serie of asArray(value.series)) {
    if (!serie || typeof serie !== 'object') continue;
    const name = String(serie.name || serie.label || serie.key || serie.segment || serie.segmento || serie.region || serie.regiao || `Item ${Object.keys(out).length + 1}`);
    const data = asArray(serie.data || serie.values || serie.points);
    if (!data.length && hasValue(serie.value ?? serie.valor ?? serie.y)) {
      out[defaultYear] = out[defaultYear] || {};
      out[defaultYear][name] = normalizeBreakdownEntryValue(serie.value ?? serie.valor ?? serie.y);
      continue;
    }
    data.forEach((point, index) => {
      const year = String(categories[index] || point?.year || point?.ano || point?.period || point?.periodo || point?.label || point?.x || defaultYear);
      const rawValue = Array.isArray(point) ? point[1] : (point?.value ?? point?.valor ?? point?.y ?? point?.amount ?? point);
      out[year] = out[year] || {};
      out[year][name] = normalizeBreakdownEntryValue(rawValue);
    });
  }
  return Object.keys(out).length ? out : null;
}

function normalizeRevenueBreakdown(value) {
  if (!hasValue(value)) return null;
  if (Array.isArray(value)) return { Atual: normalizeBreakdownArray(value) };
  if (value && typeof value === 'object') {
    if (Array.isArray(value.series) && value.series.some(item => item && typeof item === 'object' && !Array.isArray(item) && (item.data || item.values || item.points || item.name || item.label))) {
      const highcharts = normalizeHighchartsBreakdown(value);
      if (highcharts) return highcharts;
    }
    if (Array.isArray(value.labels) && Array.isArray(value.series)) {
      const year = value.year || value.ano || value.period || value.periodo || 'Atual';
      const out = {};
      value.labels.forEach((label, index) => { out[String(label)] = normalizeBreakdownEntryValue(value.series[index]); });
      return { [year]: out };
    }
    if (Array.isArray(value.data) || Array.isArray(value.items) || Array.isArray(value.values)) {
      return { [value.year || value.ano || value.period || value.periodo || 'Atual']: normalizeBreakdownArray(value.data || value.items || value.values) };
    }
    const out = {};
    for (const [year, yearData] of Object.entries(value)) {
      if (Array.isArray(yearData)) out[year] = normalizeBreakdownArray(yearData);
      else if (yearData && typeof yearData === 'object') {
        if (Array.isArray(yearData.data) || Array.isArray(yearData.items) || Array.isArray(yearData.values)) out[year] = normalizeBreakdownArray(yearData.data || yearData.items || yearData.values);
        else out[year] = Object.fromEntries(Object.entries(yearData).map(([name, val]) => [name, normalizeBreakdownEntryValue(val)]));
      } else out[year] = { [year]: normalizeBreakdownEntryValue(yearData) };
    }
    return Object.keys(out).length ? out : null;
  }
  return null;
}

function normalizeInfoMap(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function infoValue(info = {}, ...labels) {
  const entries = Object.entries(info || {});
  const wanted = labels.map(compactKey);
  for (const [key, value] of entries) {
    if (wanted.includes(compactKey(key))) return scalarValue(value);
  }
  return null;
}

function normalizePortfolioAssetItem(item, fallbackName = '') {
  if (Array.isArray(item)) {
    return {
      nome: String(item[0] || fallbackName || 'Ativo'),
      valor: item[1] ?? null,
      percentual: item[2] ?? null,
    };
  }
  if (item && typeof item === 'object') {
    const nome = item.nome || item.name || item.label || item.ativo || item.asset || item.tipo || item.classe || fallbackName || 'Ativo';
    const abl = item.abl ?? item.area_bruta_locavel ?? item.areaBrutaLocavel ?? item.area ?? item.area_locavel ?? item.areaLocavel ?? null;
    return {
      nome,
      tipo: item.tipo || item.type || item.classe || item.category || item.segmento || item.segment || null,
      estado: item.estado || item.uf || item.state || null,
      valor: item.valor ?? item.value ?? item.amount ?? null,
      percentual: item.percentual ?? item.percent ?? item.percentage ?? item.valuePercent ?? null,
      area_bruta_locavel: abl,
      abl,
      ...item,
      nome,
      abl,
    };
  }
  return { nome: fallbackName || String(item || 'Ativo'), valor: item };
}

function normalizePhysicalAssets(value) {
  if (!hasValue(value)) return [];
  if (Array.isArray(value)) return value.map((item, i) => normalizePortfolioAssetItem(item, `Ativo ${i + 1}`)).filter(Boolean);
  for (const key of ['items', 'data', 'properties', 'assets', 'ativos', 'carteira', 'portfolio', 'distribuicao', 'distribution']) {
    if (Array.isArray(value?.[key])) return value[key].map((item, i) => normalizePortfolioAssetItem(item, `Ativo ${i + 1}`)).filter(Boolean);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([key, val]) => normalizePortfolioAssetItem(val, key)).filter(Boolean);
  }
  return [];
}


function normalizeMetricMap(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = presentNumber(raw);
    out[key] = n === null ? scalarValue(raw) : n;
  }
  return out;
}

function normalizeComparableRow(item = {}, fallbackTicker = '') {
  if (Array.isArray(item)) {
    const ticker = String(item[0] || fallbackTicker || '').trim().toUpperCase();
    return ticker ? { ticker, dy: displayValue(item[1]), pvp: displayValue(item[2]), patrimonio: displayValue(item[3]), tipo: displayValue(item[4]), segmento: displayValue(item[5]) } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const ticker = String(item.ticker || item.symbol || item.codigo || item.ativo || item.fii || item.name || fallbackTicker || '').trim().toUpperCase();
  if (!/^(?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2})$/.test(ticker)) return null;
  return {
    ticker,
    nome: item.nome || item.name || item.razaoSocial || null,
    pl: displayValue(item.pl ?? item.p_l ?? item.priceEarnings),
    pvp: displayValue(item.pvp ?? item.p_vp ?? item.pVp),
    roe: displayValue(item.roe),
    dy: displayValue(item.dy ?? item.dividendYield ?? item.dividend_yield),
    val_mercado: displayValue(item.val_mercado ?? item.valorMercado ?? item.marketCap),
    margem_liquida: displayValue(item.margem_liquida ?? item.margemLiquida ?? item.netMargin),
    patrimonio: displayValue(item.patrimonio ?? item.patrimonioLiquido ?? item.valorPatrimonial ?? item.netWorth),
    tipo: displayValue(item.tipo ?? item.tipo_fundo ?? item.type),
    segmento: displayValue(item.segmento ?? item.segment),
  };
}

function normalizePeerComparison(value) {
  if (!hasValue(value)) return [];
  const candidates = [];
  const visit = (node, fallback = '', depth = 0) => {
    if (depth > 5 || !hasValue(node)) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${fallback}_${i + 1}`, depth + 1));
      return;
    }
    if (node && typeof node === 'object') {
      const directRow = normalizeComparableRow(node, fallback);
      const seriesRow = peerRowFromSeriesLike(node);
      const row = seriesRow ? { ...(directRow || {}), ...seriesRow } : directRow;
      if (row) candidates.push(row);
      for (const key of ['data','items','rows','result','results','payload','comparacao','comparador','table','series','values','points']) {
        if (node[key] !== undefined) visit(node[key], fallback, depth + 1);
      }
      // Some APIs return an object keyed by ticker.
      for (const [key, val] of Object.entries(node)) {
        if (/^(?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2})$/i.test(key) && val && typeof val === 'object') visit({ ...val, ticker: key }, key, depth + 1);
      }
    }
  };
  visit(value);
  const seen = new Set();
  return candidates.filter(row => {
    if (seen.has(row.ticker)) return false;
    seen.add(row.ticker);
    return true;
  }).slice(0, 24);
}

function sortChartPoints(list = []) {
  return asArray(list).sort((a, b) => String(a.year || a.label || '').localeCompare(String(b.year || b.label || ''), 'pt-BR', { numeric: true }));
}

const MOBILE_TECHNICAL_KEY_PATTERN = /^(?:_.*|raw|raw_.*|raw[A-Z].*|html|markup|selector|selectors|script|scripts|debug|diagnostics?|sourceDiagnostics|consumerDiagnostics|traceId|requestId|stack|stacktrace|exception|providerPayload|payloadPreview|rawPreview|legacyField|extractionPolicy|policy|sourceVersion|sourceTrace|apiStatus|groupedRoles|ids|discoveredApiUrls)$/;

function isTechnicalMobileKey(key = '') {
  const raw = String(key || '').trim();
  if (!raw) return false;
  if (MOBILE_TECHNICAL_KEY_PATTERN.test(raw)) return true;
  const compact = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return [
    'rawjson','rawhtml','rawdata','payloadraw','payloadpreview','rawpreview','sourcediagnostics',
    'consumerdiagnostics','debugpayload','debugdata','legacyfield','extractionpolicy','sourceversion',
    'sourcetrace','apistatus','groupedroles','discoveredapiurls','providerpayload','selectorpath'
  ].includes(compact);
}

function sanitizeForMobile(value, depth = 0) {
  if (depth > 12) return null;
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(item => sanitizeForMobile(item, depth + 1)).filter(item => item !== undefined);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (isTechnicalMobileKey(key)) continue;
      const v = sanitizeForMobile(child, depth + 1);
      if (v !== undefined) out[key] = v;
    }
    return out;
  }
  if (typeof value === 'string') {
    const clean = value.trim();
    if (/^(?:\{|\[).*(?:\}|\])$/.test(clean) && clean.length > 80) return undefined;
    if (/\b(?:raw json|payload|selector|stacktrace|debug|trace id|request id)\b/i.test(clean)) return undefined;
  }
  return value;
}

function normalizeDividendDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (!br) return raw;
  let year = Number(br[3]);
  if (br[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
  return `${String(year).padStart(4, '0')}-${String(br[2]).padStart(2, '0')}-${String(br[1]).padStart(2, '0')}`;
}

function normalizeDividendHistory(value) {
  const source = value?.historico || value?.history || value?.items || value?.data || value;
  return asArray(source).map((item, index) => {
    if (Array.isArray(item)) {
      return {
        dataCom: normalizeDividendDate(item[0]),
        paymentDate: normalizeDividendDate(item[1]),
        value: presentNumber(item[2]),
        type: item[3] || 'PROVENTO',
        label: item[4] || null,
      };
    }
    if (item && typeof item === 'object') {
      const dataCom = normalizeDividendDate(item.dataCom ?? item.comDate ?? item.dateCom ?? item.recordDate ?? item.data_base ?? item.dataBase ?? item.date ?? item.data);
      const paymentDate = normalizeDividendDate(item.dataPagamento ?? item.paymentDate ?? item.payDate ?? item.pgto ?? item.pagamento);
      const valueNum = presentNumber(item.valor ?? item.value ?? item.amount ?? item.provento ?? item.rendimento ?? item.dividend);
      return {
        dataCom,
        paymentDate,
        value: valueNum,
        type: item.tipo || item.type || item.rawType || item.eventType || 'PROVENTO',
        rawType: item.rawType || item.tipo || item.type || null,
        label: item.label || item.period || item.periodo || `Provento ${index + 1}`,
        ...item,
        dataCom,
        paymentDate,
        value: valueNum,
      };
    }
    return null;
  }).filter(item => item && (item.dataCom || item.paymentDate || item.value !== null));
}

function normalizeDistribution12m(value) {
  return asArray(value?.items || value?.data || value).map((item, index) => {
    if (Array.isArray(item)) {
      return { period: String(item[0] || `P${index + 1}`), yieldPercent: presentNumber(item[1]), amount: presentNumber(item[2]) };
    }
    if (item && typeof item === 'object') {
      const period = item.period || item.periodo || item.label || item.date || item.data || `P${index + 1}`;
      const yieldPercent = presentNumber(item.yieldPercent ?? item.dividendYield ?? item.dy ?? item.yield ?? item.percent ?? item.percentage ?? item.valuePercent);
      const amount = presentNumber(item.amount ?? item.valor ?? item.value ?? item.total ?? item.rendimento);
      return { ...item, period: String(period), yieldPercent, amount };
    }
    return { period: `P${index + 1}`, yieldPercent: presentNumber(item), amount: null };
  }).filter(item => item && (item.yieldPercent !== null || item.amount !== null));
}

function normalizeDividendYieldHistory(value) {
  const source = value?.items || value?.data || value?.history || value;
  return asArray(source).map((item, index) => {
    if (Array.isArray(item)) return { date: normalizeDateLabel({ label: item[0] }, index), dy: presentNumber(item[1]) };
    if (item && typeof item === 'object') {
      return {
        date: normalizeDateLabel(item, index),
        dy: presentNumber(item.dy ?? item.dividendYield ?? item.yieldPercent ?? item.valuePercent ?? item.value ?? item.y),
        amount: presentNumber(item.amount ?? item.valor ?? item.total),
        ...item,
      };
    }
    return { date: `P${index + 1}`, dy: presentNumber(item) };
  }).filter(item => item && item.date && item.dy !== null);
}

function normalizePeerPointKey(label = '') {
  const key = compactKey(label);
  if (key === 'dy' || key.includes('dividendyield') || key === 'yield') return 'dy';
  if (key === 'pvp' || key === 'pvp' || key.includes('pvp') || key.includes('pvp')) return 'pvp';
  if (key === 'pl' || key.includes('pl')) return 'pl';
  if (key === 'roe') return 'roe';
  if (key.includes('valormercado') || key.includes('valmercado') || key.includes('marketcap')) return 'val_mercado';
  if (key.includes('margemliquida') || key.includes('netmargin')) return 'margem_liquida';
  if (key.includes('patrimonio') || key.includes('networth')) return 'patrimonio';
  if (key.includes('tipo')) return 'tipo';
  if (key.includes('segment')) return 'segmento';
  return '';
}

function peerRowFromSeriesLike(node = {}) {
  const ticker = String(node.ticker || node.symbol || node.name || node.label || node.key || '').trim().toUpperCase();
  if (!/^(?:[A-Z]{4}[0-9]{1,2}[A-Z]?|[A-Z0-9]{3,6}[0-9]{1,2})$/.test(ticker)) return null;
  const row = { ticker };
  for (const point of asArray(node.points || node.data || node.values)) {
    if (Array.isArray(point)) {
      const field = normalizePeerPointKey(point[0]);
      if (field) row[field] = displayValue(point[1]);
    } else if (point && typeof point === 'object') {
      const field = normalizePeerPointKey(point.label || point.name || point.key || point.metric || point.indicador);
      if (field) row[field] = displayValue(point.value ?? point.valor ?? point.y ?? point.amount ?? point.raw);
    }
  }
  return Object.keys(row).length > 1 ? row : { ticker };
}

function buildFiiAssetDistribution(canonical = {}, results = {}) {
  return normalizePhysicalAssets(firstPresent(
    canonical.fii?.assetDistribution,
    canonical.fii?.fundAssetDistribution,
    canonical.fii?.assetAllocation,
    canonical.fii?.creditAssets,
    results.distribuicaoAtivosFundo,
    results.distribuicao_ativos_fundo,
    results.distribuicaoAtivos,
    results.assetDistribution,
    results.ativosFundo,
    results.fiiAssetDistribution
  ));
}

function isYearLike(value) {
  return /^(?:19|20)\d{2}$/.test(String(value || '').trim());
}

function normalizeHistoricalIndicators(value) {
  if (!hasValue(value)) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const colunasRaw = asArray(value.colunas || value.columns || value.headers).map(String).filter(Boolean);
    const linhasRaw = asArray(value.linhas || value.rows || value.data || value.items);
    const alreadyAppRows = linhasRaw.every(row => row && typeof row === 'object' && !Array.isArray(row) && row.indicador && row.valores && typeof row.valores === 'object');
    if (colunasRaw.length && linhasRaw.length && alreadyAppRows) return { colunas: colunasRaw, linhas: linhasRaw };

    if (colunasRaw.length && linhasRaw.length && Array.isArray(linhasRaw[0])) {
      const firstHeader = compactKey(colunasRaw[0]);
      const firstColumnLooksPeriod = ['ano', 'data', 'periodo', 'period'].includes(firstHeader) || linhasRaw.some(row => isYearLike(row?.[0]));
      if (firstColumnLooksPeriod) {
        const periods = linhasRaw.map(row => String(row?.[0] || '')).filter(Boolean);
        const indicadores = colunasRaw.slice(1);
        const linhas = indicadores.map((indicador, idx) => ({
          indicador,
          valores: Object.fromEntries(linhasRaw.map(row => [String(row?.[0] || ''), row?.[idx + 1] ?? '-']).filter(([period]) => period)),
        })).filter(row => Object.keys(row.valores).length);
        return { colunas: periods, linhas };
      }
      const periods = colunasRaw.slice(1);
      const linhas = linhasRaw.map(row => ({
        indicador: String(row?.[0] || ''),
        valores: Object.fromEntries(periods.map((period, idx) => [period, row?.[idx + 1] ?? '-'])),
      })).filter(row => row.indicador);
      return { colunas: periods, linhas };
    }

    if (linhasRaw.length && typeof linhasRaw[0] === 'object' && !Array.isArray(linhasRaw[0])) {
      const periodKeys = ['year', 'ano', 'date', 'data', 'period', 'periodo', 'label'];
      const periods = linhasRaw.map(row => String(periodKeys.map(k => row?.[k]).find(Boolean) || '')).filter(Boolean);
      const metricKeys = [...new Set(linhasRaw.flatMap(row => Object.keys(row || {}).filter(k => !periodKeys.includes(k))))];
      if (periods.length && metricKeys.length) {
        const linhas = metricKeys.map(key => ({
          indicador: key,
          valores: Object.fromEntries(linhasRaw.map((row, i) => [periods[i], row?.[key] ?? '-'])),
        }));
        return { colunas: periods, linhas };
      }
    }

    const yearEntries = Object.entries(value).filter(([key, val]) => isYearLike(key) && val && typeof val === 'object');
    if (yearEntries.length) {
      const colunas = yearEntries.map(([year]) => year).sort();
      const metricKeys = [...new Set(yearEntries.flatMap(([, metrics]) => Object.keys(metrics || {})))];
      const linhas = metricKeys.map(metric => ({
        indicador: metric,
        valores: Object.fromEntries(colunas.map(year => [year, value[year]?.[metric] ?? '-'])),
      }));
      return { colunas, linhas };
    }
  }
  return value;
}


const INVESTIDOR10_CHART_UI_PRESETS = {
  cotacao: { ranges: ['1D','7D','30D','6M','YTD','1A','5A','10A','15A','Personalizado'], currency: ['Reais','Dólares','Euro'], priceModes: ['Cotação padrão','Cotação ajustada'] },
  performance: { ranges: ['1 mês','3 meses','1 ano','2 anos','5 anos','10 anos'], series: ['rentabilidade','rentabilidade real'] },
  comparison: { ranges: ['2A','5A','10A'], note: 'O valor considera o reinvestimento dos dividendos quando a origem informar essa regra.' },
  statements: { periodicity: ['Anual','Trimestral'], ranges: ['5A','10A','MAX'] },
  detailedStatements: { periodicity: ['Anual','Trimestral','1º Trimestre','2º Trimestre','3º Trimestre','4º Trimestre'], modes: ['Valores simples','Valores detalhados','Valores AV%','Valores AH%','Valores AV% + AH%'], ranges: ['Último ano','2 anos','5 anos','10 anos','15 anos'] },
  dividends: { periodicity: ['Mensal','Anual'], ranges: ['1A','5A','MAX'] },
  indicators: { ranges: ['5A','10A'] },
  properties: { aggregation: ['Estado','Imóvel','Área bruta locável'] },
  fundAssets: { years: ['Atual'] },
};

function chartPoint(x, y, extra = {}) {
  if (x == null || x === '') return null;
  const n = presentNumber(y);
  if (n === null) return null;
  return { x: String(x), y: n, ...extra };
}

function cleanPoints(points = []) {
  return asArray(points).filter(point => point && point.x != null && point.y !== null && point.y !== undefined && Number.isFinite(point.y));
}

function chartDataCount(chart = {}) {
  if (Array.isArray(chart.series) && chart.series.length) return chart.series.reduce((sum, serie) => sum + cleanPoints(serie.points).length, 0);
  if (Array.isArray(chart.points) && chart.points.length) return cleanPoints(chart.points).length;
  if (Array.isArray(chart.rows) && chart.rows.length) return chart.rows.length;
  if (Array.isArray(chart.items) && chart.items.length) return chart.items.length;
  return 0;
}

function makeChart({ id, sourceTitle, chartType, legacyField, unit = '', yAxis = '', xAxis = 'Período', controls = {}, series = [], points = [], rows = [], items = [], sourceStatus = 'captured', note = '' }) {
  const chart = {
    id,
    sourceTitle,
    title: sourceTitle,
    chartType,
    legacyField,
    xAxis,
    yAxis,
    unit,
    controls,
    series: asArray(series).map(serie => ({ ...serie, points: cleanPoints(serie.points) })).filter(serie => cleanPoints(serie.points).length),
    points: cleanPoints(points),
    rows: asArray(rows).filter(Boolean),
    items: asArray(items).filter(Boolean),
    sourceStatus,
    note,
  };
  chart.dataCount = chartDataCount(chart);
  chart.renderable = chart.dataCount > 0;
  if (!chart.renderable && sourceStatus === 'captured') chart.sourceStatus = 'empty_or_not_exposed_by_source';
  return chart;
}

function seriesFromField(list = [], field, label, unit = '', displayKey = '') {
  const points = asArray(list).map((point, index) => chartPoint(point?.label || point?.year || point?.period || point?.date || `P${index + 1}`, point?.[field], displayKey && point?.[displayKey] != null ? { display: point[displayKey] } : {}));
  return { key: field, label, unit, points };
}

function seriesFromIndexComparison(list = []) {
  return asArray(list).map((serie, serieIndex) => ({
    key: compactKey(serie.label || serie.name || `indice_${serieIndex + 1}`) || `indice_${serieIndex + 1}`,
    label: String(serie.label || serie.name || `Índice ${serieIndex + 1}`),
    unit: '%',
    points: asArray(serie.points).map((point, index) => chartPoint(point.date || point.label || point.period || point.x || `P${index + 1}`, point.profitability ?? point.value ?? point.y)),
  }));
}

function flattenBreakdownToCharts(value, { idPrefix, titlePrefix, legacyField, chartType = 'donut_by_period', unit = '%' } = {}) {
  const charts = [];
  if (!hasValue(value) || !value || typeof value !== 'object') return charts;
  for (const [period, map] of Object.entries(value)) {
    const points = Object.entries(map || {}).map(([name, entry]) => chartPoint(name, entry?.value ?? entry?.valor ?? entry?.percent ?? entry, { period: String(period), label: name }));
    charts.push(makeChart({
      id: `${idPrefix}_${compactKey(period) || 'atual'}`,
      sourceTitle: `${titlePrefix} ${period}`.trim(),
      chartType,
      legacyField,
      unit,
      yAxis: unit === '%' ? 'Participação' : 'Valor',
      xAxis: 'Categoria',
      points,
      controls: { years: [String(period)] },
    }));
  }
  return charts;
}

function buildChartCatalog(contract = {}, canonical = {}, payload = {}) {
  const results = payload.results || {};
  const cf = contract.charts_financeiros || {};
  const charts = [];
  const priceSource = firstPresent(canonical.priceHistory, canonical.price_history, results.priceHistory, results.historicoCotacao, results.cotacaoHistorica, payload.appPayload?.charts?.priceHistory);
  charts.push(makeChart({
    id: 'cotacao',
    sourceTitle: `Cotação ${contract.ticker || ''}`.trim(),
    chartType: 'line_price_history',
    legacyField: 'price_history',
    unit: 'BRL',
    yAxis: 'Preço',
    controls: INVESTIDOR10_CHART_UI_PRESETS.cotacao,
    series: [{ key: 'price', label: 'Cotação', unit: 'BRL', points: asArray(priceSource?.points || priceSource?.data || priceSource).map((point, index) => chartPoint(point?.date || point?.data || point?.label || point?.x || `P${index + 1}`, point?.close ?? point?.price ?? point?.preco ?? point?.value ?? point?.y ?? point)) }],
    sourceStatus: hasValue(priceSource) ? 'captured' : 'visible_but_uses_separate_quote_flow',
    note: 'Mantido separado quando a página expõe a área de cotação, mas o endpoint de fundamentos não recebe a série histórica completa.'
  }));

  if (contract.rentabilidade_chart?.profitabilities?.length) {
    const legends = asArray(contract.rentabilidade_chart.legend);
    charts.push(makeChart({
      id: 'rentabilidade',
      sourceTitle: 'Rentabilidade nominal e real',
      chartType: 'bar_grouped_period_return',
      legacyField: 'rentabilidade_chart.profitabilities',
      unit: '%',
      yAxis: 'Rentabilidade',
      controls: INVESTIDOR10_CHART_UI_PRESETS.performance,
      series: asArray(contract.rentabilidade_chart.profitabilities).map((serie, serieIndex) => ({
        key: compactKey(legends[serieIndex] || `serie_${serieIndex + 1}`),
        label: legends[serieIndex] || (serieIndex === 0 ? 'Rentabilidade' : `Série ${serieIndex + 1}`),
        unit: '%',
        points: asArray(serie).map((point, index) => chartPoint(point.date || point.period || point.label || `P${index + 1}`, point.profitability ?? point.value ?? point.y)),
      })),
    }));
  }

  if (asArray(contract.comparacao_indices).length) {
    charts.push(makeChart({
      id: 'comparacao_indices',
      sourceTitle: `Comparação de ${contract.ticker || 'ativo'} com índices`,
      chartType: 'line_multi_index_comparison',
      legacyField: 'comparacao_indices',
      unit: '%',
      yAxis: 'Rentabilidade acumulada',
      controls: INVESTIDOR10_CHART_UI_PRESETS.comparison,
      series: seriesFromIndexComparison(contract.comparacao_indices),
    }));
  }


  if (asArray(cf.resultados).length) {
    charts.push(makeChart({
      id: 'resultados',
      sourceTitle: `${contract.nome || contract.ticker || 'Ativo'} resultados`.trim(),
      chartType: 'table_or_column_detailed_income_statement',
      legacyField: 'charts_financeiros.resultados',
      unit: 'BRL',
      yAxis: 'Valor',
      controls: INVESTIDOR10_CHART_UI_PRESETS.detailedStatements,
      series: [
        seriesFromField(cf.resultados, 'net_revenue', 'Receita líquida', 'BRL'),
        seriesFromField(cf.resultados, 'net_profit', 'Lucro líquido', 'BRL'),
        seriesFromField(cf.resultados, 'gross_profit', 'Lucro bruto', 'BRL'),
        seriesFromField(cf.resultados, 'ebitda', 'EBITDA', 'BRL'),
        seriesFromField(cf.resultados, 'ebit', 'EBIT', 'BRL'),
      ],
      rows: cf.resultados,
    }));
  }

  if (asArray(cf.fluxo_caixa).length) {
    charts.push(makeChart({
      id: 'fluxo_caixa',
      sourceTitle: `${contract.nome || contract.ticker || 'Ativo'} fluxo de caixa`.trim(),
      chartType: 'table_or_column_cash_flow_statement',
      legacyField: 'charts_financeiros.fluxo_caixa',
      unit: 'BRL',
      yAxis: 'Valor',
      controls: INVESTIDOR10_CHART_UI_PRESETS.detailedStatements,
      series: [
        seriesFromField(cf.fluxo_caixa, 'operating_cash_flow', 'Fluxo de caixa operacional', 'BRL'),
        seriesFromField(cf.fluxo_caixa, 'free_cash_flow', 'Fluxo de caixa livre', 'BRL'),
        seriesFromField(cf.fluxo_caixa, 'capex', 'CAPEX', 'BRL'),
        seriesFromField(cf.fluxo_caixa, 'cash_flow', 'Fluxo de caixa', 'BRL'),
      ],
      rows: cf.fluxo_caixa,
    }));
  }

  if (asArray(cf.receitas_lucros).length) {
    charts.push(makeChart({
      id: 'receitas_lucros',
      sourceTitle: 'Receitas e Lucros',
      chartType: 'column_multi_financial_statement',
      legacyField: 'charts_financeiros.receitas_lucros',
      unit: 'BRL',
      yAxis: 'Valor',
      controls: INVESTIDOR10_CHART_UI_PRESETS.statements,
      series: [
        seriesFromField(cf.receitas_lucros, 'net_revenue', 'Receita líquida', 'BRL'),
        seriesFromField(cf.receitas_lucros, 'net_profit', 'Lucro líquido', 'BRL'),
        seriesFromField(cf.receitas_lucros, 'gross_profit', 'Lucro bruto', 'BRL'),
        seriesFromField(cf.receitas_lucros, 'ebitda', 'EBITDA', 'BRL'),
        seriesFromField(cf.receitas_lucros, 'ebit', 'EBIT', 'BRL'),
      ],
    }));
  }

  if (hasValue(cf.lucro_cotacao)) {
    const points = Object.entries(cf.lucro_cotacao || {}).map(([period, point]) => ({ period, ...point }));
    charts.push(makeChart({
      id: 'lucro_cotacao',
      sourceTitle: `Lucro x Cotação ${contract.ticker || ''}`.trim(),
      chartType: 'combo_dual_axis_profit_quote',
      legacyField: 'charts_financeiros.lucro_cotacao',
      controls: INVESTIDOR10_CHART_UI_PRESETS.statements,
      series: [
        seriesFromField(points, 'net_profit', 'Lucro líquido', 'BRL'),
        seriesFromField(points, 'quotation', 'Cotação', 'BRL'),
      ],
    }));
  }

  if (asArray(cf.evolucao_patrimonio).length) {
    charts.push(makeChart({
      id: 'evolucao_patrimonio',
      sourceTitle: `Evolução do patrimônio${contract.nome ? ` - ${contract.nome}` : ''}`,
      chartType: 'column_multi_balance_sheet',
      legacyField: 'charts_financeiros.evolucao_patrimonio',
      unit: 'BRL',
      yAxis: 'Valor',
      controls: INVESTIDOR10_CHART_UI_PRESETS.statements,
      series: [
        seriesFromField(cf.evolucao_patrimonio, 'net_worth', 'Patrimônio líquido', 'BRL'),
        seriesFromField(cf.evolucao_patrimonio, 'total_assets', 'Ativos', 'BRL'),
        seriesFromField(cf.evolucao_patrimonio, 'total_liabilities', 'Passivos', 'BRL'),
      ],
    }));
  }

  if (asArray(cf.payout).length) {
    charts.push(makeChart({
      id: 'payout',
      sourceTitle: `Payout ${contract.ticker || ''}`.trim(),
      chartType: 'line_or_column_payout',
      legacyField: 'charts_financeiros.payout',
      unit: '%',
      yAxis: 'Payout',
      controls: INVESTIDOR10_CHART_UI_PRESETS.indicators,
      series: [seriesFromField(cf.payout, 'payout', 'Payout', '%'), seriesFromField(cf.payout, 'dy', 'Dividend yield', '%')],
    }));
  }

  if (contract.historico_indicadores?.colunas?.length && contract.historico_indicadores?.linhas?.length) {
    charts.push(makeChart({
      id: 'historico_indicadores',
      sourceTitle: contract.tipo_ativo === 'fii' ? 'Histórico de indicadores fundamentalistas' : 'Histórico de indicadores fundamentalistas',
      chartType: 'table_time_series_indicators',
      legacyField: 'historico_indicadores',
      controls: INVESTIDOR10_CHART_UI_PRESETS.indicators,
      rows: contract.historico_indicadores.linhas,
      sourceStatus: 'captured',
    }));
  }

  if (asArray(contract.distribuicoes_12m).length) {
    charts.push(makeChart({
      id: 'distribuicoes_12m',
      sourceTitle: 'Distribuições nos últimos 12 meses',
      chartType: 'bar_distribution_yield_amount',
      legacyField: 'distribuicoes_12m',
      controls: { periods: ['1 mês','3 meses','6 meses','12 meses'] },
      series: [
        { key: 'yieldPercent', label: 'Yield', unit: '%', points: contract.distribuicoes_12m.map((p, i) => chartPoint(p.period || p.label || `P${i + 1}`, p.yieldPercent)) },
        { key: 'amount', label: 'Valor por cota', unit: 'BRL', points: contract.distribuicoes_12m.map((p, i) => chartPoint(p.period || p.label || `P${i + 1}`, p.amount)) },
      ],
    }));
  }

  if (asArray(contract.dividend_yield_history).length) {
    charts.push(makeChart({
      id: 'dividend_yield_history',
      sourceTitle: `Dividend Yield ${contract.ticker || ''}`.trim(),
      chartType: 'line_or_column_dividend_yield',
      legacyField: 'dividend_yield_history',
      unit: '%',
      yAxis: 'Dividend yield',
      controls: INVESTIDOR10_CHART_UI_PRESETS.dividends,
      series: [{ key: 'dy', label: 'Dividend Yield', unit: '%', points: contract.dividend_yield_history.map((p, i) => chartPoint(p.date || p.year || p.label || `P${i + 1}`, p.dy ?? p.value)) }],
    }));
  }

  if (asArray(contract.dividend_history).length) {
    charts.push(makeChart({
      id: 'dividend_history',
      sourceTitle: `${contract.ticker || 'Ativo'} dividendos`.trim(),
      chartType: 'column_dividends_paid',
      legacyField: 'dividend_history',
      unit: 'BRL',
      yAxis: 'Valor pago',
      controls: INVESTIDOR10_CHART_UI_PRESETS.dividends,
      series: [{ key: 'value', label: 'Dividendos pagos', unit: 'BRL', points: contract.dividend_history.map((p, i) => chartPoint(p.paymentDate || p.dataCom || p.date || p.label || `P${i + 1}`, p.value ?? p.amount ?? p.valor)) }],
      rows: contract.dividend_history,
    }));
  }

  charts.push(...flattenBreakdownToCharts(contract.revenue_geography, { idPrefix: 'revenue_geography', titlePrefix: 'Regiões onde gera receita', legacyField: 'revenue_geography' }));
  charts.push(...flattenBreakdownToCharts(contract.revenue_segment, { idPrefix: 'revenue_segment', titlePrefix: 'Negócios que geram receita', legacyField: 'revenue_segment' }));

  if (asArray(contract.imoveis).length) {
    charts.push(makeChart({
      id: 'lista_imoveis',
      sourceTitle: 'Lista de Imóveis',
      chartType: 'property_list_with_abl',
      legacyField: 'imoveis',
      controls: INVESTIDOR10_CHART_UI_PRESETS.properties,
      items: contract.imoveis,
      sourceStatus: 'captured',
    }));
  }

  if (asArray(contract.distribuicao_ativos_fundo).length) {
    charts.push(makeChart({
      id: 'distribuicao_ativos_fundo',
      sourceTitle: 'Distribuição de ativos do fundo',
      chartType: 'donut_fund_asset_distribution',
      legacyField: 'distribuicao_ativos_fundo',
      unit: '%',
      yAxis: 'Participação',
      controls: INVESTIDOR10_CHART_UI_PRESETS.fundAssets,
      points: contract.distribuicao_ativos_fundo.map((p, i) => chartPoint(p.nome || p.name || p.tipo || p.label || `Item ${i + 1}`, p.value ?? p.valor ?? p.percent ?? p.percentage, { type: p.type || p.tipo || null })),
      items: contract.distribuicao_ativos_fundo,
    }));
  }

  const order = ['cotacao','rentabilidade','comparacao_indices','historico_indicadores','distribuicoes_12m','dividend_yield_history','dividend_history','receitas_lucros','resultados','fluxo_caixa','lucro_cotacao','evolucao_patrimonio','payout','revenue_geography','revenue_segment','lista_imoveis','distribuicao_ativos_fundo'];
  const sorted = charts.sort((a, b) => {
    const ia = order.findIndex(prefix => a.id === prefix || a.id.startsWith(`${prefix}_`));
    const ib = order.findIndex(prefix => b.id === prefix || b.id.startsWith(`${prefix}_`));
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return sorted;
}

function buildChartFidelity(contract = {}, canonical = {}) {
  const charts = asArray(contract.graficos_i10);
  const coverageChecks = asArray(canonical.coverage?.checks);
  const presentVisible = coverageChecks.filter(x => x.presentInHtml).map(x => ({ key: x.key, title: x.title, captured: Boolean(x.captured), status: x.status }));
  return {
    version: VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION,
    policy: 'replicate-investidor10-visible-chart-blocks-without-synthetic-series',
    chartCount: charts.length,
    renderableCount: charts.filter(x => x.renderable).length,
    emptyCount: charts.filter(x => !x.renderable).length,
    visibleSourceBlocks: presentVisible,
    renderableIds: charts.filter(x => x.renderable).map(x => x.id),
    emptyIds: charts.filter(x => !x.renderable).map(x => x.id),
    sourceCoverage: canonical.coverage?.summary || null,
  };
}


function attachMobileAliases(contract) {
  contract.status = contract.ticker ? 'OK' : 'EMPTY';
  contract.ok = contract.status === 'OK';
  contract.source_url = contract.source_url || contract.url || null;
  contract.historicoIndicadores = contract.historico_indicadores;
  contract.chartsFinanceiros = contract.charts_financeiros;
  contract.revenueGeography = contract.revenue_geography;
  contract.revenueSegment = contract.revenue_segment;
  contract.comparacaoIndices = contract.comparacao_indices;
  contract.distribuicoes12m = contract.distribuicoes_12m;
  contract.dividendYieldHistory = contract.dividend_yield_history;
  contract.dividendHistory = contract.dividend_history;
  contract.distribuicaoAtivosFundo = contract.distribuicao_ativos_fundo;
  contract.graficosI10 = contract.graficos_i10;
  contract.graficos = contract.graficos_i10;
  contract.chartManifest = contract.chart_manifest;
  contract.chartFidelity = contract.chart_fidelity;
  return contract;
}

function buildCoverage(contract) {
  const cf = contract.charts_financeiros || {};
  return {
    version: VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION,
    route: '/api/scraper',
    ticker: contract.ticker,
    tipo_ativo: contract.tipo_ativo,
    classe_ativo: contract.classe_ativo,
    chartBlocks: {
      rentabilidade_chart: Boolean(contract.rentabilidade_chart?.profitabilities?.length),
      revenue_geography: hasValue(contract.revenue_geography),
      revenue_segment: hasValue(contract.revenue_segment),
      charts_financeiros: {
        receitas_lucros: asArray(cf.receitas_lucros).length,
        lucro_cotacao: Object.keys(cf.lucro_cotacao || {}).length,
        evolucao_patrimonio: asArray(cf.evolucao_patrimonio).length,
        payout: asArray(cf.payout).length,
        resultados: asArray(cf.resultados).length,
        fluxo_caixa: asArray(cf.fluxo_caixa).length,
      },
      historico_indicadores: hasValue(contract.historico_indicadores),
      distribuicoes_12m: asArray(contract.distribuicoes_12m).length,
      dividend_yield_history: asArray(contract.dividend_yield_history).length,
      dividend_history: asArray(contract.dividend_history).length,
      imoveis: asArray(contract.imoveis).length,
      distribuicao_ativos_fundo: asArray(contract.distribuicao_ativos_fundo).length,
      comparacao: asArray(contract.comparacao).length,
      comparacao_indices: asArray(contract.comparacao_indices).length,
      graficos_i10: { total: asArray(contract.graficos_i10).length, renderable: asArray(contract.graficos_i10).filter(chart => chart?.renderable).length },
    },
  };
}

export function buildMobileScraperAssetContract(payload = {}) {
  const results = payload.results || {};
  const canonical = results.assetChartsCanonical || payload.assetChartsCanonical || results.sections?.assetChartsCanonical || {};
  const fiiInfo = normalizeInfoMap(canonical.fii?.info || results.informacoesFii || results.sections?.fiiInfo || results.sections?.informacoesFii);
  const classeAtivo = normalizeAssetClass(payload);
  const tipoAtivo = normalizeAssetType(payload);
  const contract = {
    ticker: normalizeTicker(payload),
    symbol: normalizeTicker(payload),
    nome: results.nome || results.name || payload.name || normalizeTicker(payload),
    nome_longo: results.nomeLongo || results.nome_longo || results.razaoSocial || results.nome || results.name || payload.name || normalizeTicker(payload),
    tipo_ativo: tipoAtivo,
    tipo: tipoAtivo,
    classe_ativo: classeAtivo,
    logo_url: results.logoUrl || results.logo_url || payload.logoUrl || payload.logo_url || null,
    url: results.url || results.sourceUrl || payload.url || payload.sourceUrl || null,
    source_url: results.sourceUrl || results.url || payload.sourceUrl || payload.url || null,
    advanced_metrics: normalizeMetricMap(results.advancedMetrics || results.advanced_metrics || results.sections?.indicadoresAvancados || payload.appPayload?.metrics?.advanced),
    sobre: results.sobre || results.descricao || results.assetDescription || results.profilePresentation?.summary || results.assetPresentation?.summary || canonical.presentation?.summary || canonical.profilePresentation?.summary || canonical.company?.presentation?.summary || canonical.fii?.presentation?.summary || results.about || null,
    apresentacao: results.profilePresentation || results.assetPresentation || canonical.presentation || canonical.profilePresentation || canonical.company?.presentation || canonical.fii?.presentation || null,

    preco_atual: pickMetric(payload, 'precoAtual', ['price', 'currentPrice', 'cotacao', 'valorAtual']),
    dy: pickMetric(payload, 'dividendYield', ['dy', 'dividend_yield', 'yield', 'dividendYield12m']),
    pvp: pickMetric(payload, 'pvp', ['p_vp', 'pVp', 'priceToBook']),
    pl: pickMetric(payload, 'pl', ['p_l', 'pL', 'priceEarnings']),
    roe: pickMetric(payload, 'roe', ['returnOnEquity']),
    roa: pickMetric(payload, 'roa', ['returnOnAssets']),
    roic: pickMetric(payload, 'roic', ['returnOnInvestedCapital']),
    lpa: pickMetric(payload, 'lpa', ['eps', 'lucroPorAcao']),
    margem_liquida: pickMetric(payload, 'margemLiquida', ['netMargin', 'margem_liquida']),
    margem_bruta: pickMetric(payload, 'margemBruta', ['grossMargin', 'margem_bruta']),
    margem_ebit: pickMetric(payload, 'margemEbit', ['ebitMargin', 'margem_ebit']),
    liq_corrente: pickMetric(payload, 'liquidezCorrente', ['liqCorrente', 'currentRatio']),
    divida_liquida_ebitda: pickMetric(payload, 'dividaLiquidaEbitda', ['netDebtEbitda', 'dlEbitda']),
    divida_liquida_pl: pickMetric(payload, 'dividaLiquidaPl', ['netDebtEquity', 'dlPl']),
    ev_ebitda: pickMetric(payload, 'evEbitda', ['ev_ebitda']),
    payout: pickMetric(payload, 'payout', ['payoutRatio']),
    cagr_receita_5a: pickMetric(payload, 'cagrReceita5a', ['cagrReceitas5a', 'cagr_receita_5a']),
    cagr_lucros_5a: pickMetric(payload, 'cagrLucros5a', ['cagr_lucros_5a']),
    val_mercado: pickMetric(payload, 'valorDeMercado', ['marketCap', 'marketValue', 'valorMercado']),
    liquidez: pickMetric(payload, 'liquidezMediaDiaria', ['dailyLiquidity', 'liquidezDiaria', 'liquidez']),
    variacao_12m: pickMetric(payload, 'variacao12m', ['change12m', 'yearChange', 'variacaoAno']),
    vp_cota: pickMetric(payload, 'valorPatrimonialCota', ['vpCota', 'bookValuePerShare']),

    segmento: pickMetric(payload, 'segmento', ['segment']) || infoValue(fiiInfo, 'SEGMENTO'),
    tipo_fundo: pickMetric(payload, 'tipoFundo', ['tipo_fundo']) || infoValue(fiiInfo, 'TIPO DE FUNDO'),
    vacancia: pickMetric(payload, 'vacanciaFisica', ['vacancia', 'physicalVacancy']) || infoValue(fiiInfo, 'VACÂNCIA'),
    ultimo_rendimento: pickMetric(payload, 'ultimoRendimento', ['lastDividend', 'lastIncome', 'ultimoProvento']) || infoValue(fiiInfo, 'ÚLTIMO RENDIMENTO'),
    patrimonio_liquido: pickMetric(payload, 'patrimonioLiquido', ['netWorth', 'patrimonio']) || infoValue(fiiInfo, 'VALOR PATRIMONIAL', 'Patrimônio Líquido'),
    cnpj: pickMetric(payload, 'cnpj') || infoValue(fiiInfo, 'CNPJ'),
    num_cotistas: pickMetric(payload, 'numCotistas', ['numeroCotistas']) || infoValue(fiiInfo, 'NUMERO DE COTISTAS'),
    tipo_gestao: pickMetric(payload, 'tipoGestao', ['tipo_gestao']) || infoValue(fiiInfo, 'TIPO DE GESTÃO'),
    prazo_duracao: pickMetric(payload, 'prazoDuracao', ['prazo_duracao']) || infoValue(fiiInfo, 'PRAZO DE DURAÇÃO'),
    taxa_adm: pickMetric(payload, 'taxaAdministracao', ['taxaAdm', 'taxa_adm']) || infoValue(fiiInfo, 'TAXA DE ADMINISTRAÇÃO'),
    mandato: pickMetric(payload, 'mandato') || infoValue(fiiInfo, 'MANDATO'),
    publico_alvo: pickMetric(payload, 'publicoAlvo', ['publico_alvo']) || infoValue(fiiInfo, 'PÚBLICO-ALVO'),
    cotas_emitidas: pickMetric(payload, 'cotasEmitidas', ['cotas_emitidas']) || infoValue(fiiInfo, 'COTAS EMITIDAS'),

    rentabilidade_chart: buildRentabilidadeChart(canonical, payload),
    revenue_geography: normalizeRevenueBreakdown(firstPresent(canonical.revenueGeography, canonical.revenueByRegion, payload.appPayload?.charts?.revenueGeography, results.revenueGeography, results.regioesReceita)),
    revenue_segment: normalizeRevenueBreakdown(firstPresent(canonical.revenueSegment, canonical.revenueByBusiness, payload.appPayload?.charts?.revenueSegment, results.revenueSegment, results.negociosReceita)),
    charts_financeiros: buildFinancialCharts(canonical, payload),
    comparacao: normalizePeerComparison(firstPresent(canonical.fii?.peerComparison, canonical.company?.peerComparison, canonical.peerComparison, results.peerComparison, results.comparadorFiis, results.comparadorAcoes, results.comparacaoPares, results.sections?.comparadorFiis, results.sections?.comparadorAcoes, results.sections?.comparacaoPares, results.comparacao)),
    comparacao_indices: normalizeIndexComparison(firstPresent(canonical.indexComparison, results.indexComparison, results.comparacaoIndices) || []),
    historico_indicadores: normalizeHistoricalIndicators(firstPresent(canonical.fundamentalIndicatorHistory, canonical.company?.fundamentalIndicatorHistory, canonical.fii?.fundamentalIndicatorHistory, results.historicoIndicadoresFii, results.historico_indicadores, results.historicoIndicadores)) || null,
    distribuicoes_12m: normalizeDistribution12m(firstPresent(canonical.fii?.distribution12m, results.distribuicoes12m) || []),
    dividend_yield_history: normalizeDividendYieldHistory(firstPresent(canonical.fii?.dividendYieldHistory, canonical.dividendYieldHistory, results.dividendYieldHistory) || []),
    dividend_history: normalizeDividendHistory(firstPresent(canonical.fii?.dividendHistory, canonical.dividendHistory, results.historicoDividendos, results.dividendos?.historico) || []),
    distribuicao_ativos_fundo: buildFiiAssetDistribution(canonical, results),
    imoveis: firstPresent(normalizePhysicalAssets(firstPresent(canonical.fii?.physicalAssets, results.imoveis, results.listaImoveis, results.physicalAssets)), buildFiiAssetDistribution(canonical, results)) || [],
    checklist_buy_hold: results.checklistBuyHold || results.checklist_buy_hold || results.sections?.checklistBuyHold || null,
  };
  contract.graficos_i10 = buildChartCatalog(contract, canonical, payload);
  contract.chart_manifest = contract.graficos_i10.map(chart => ({ id: chart.id, title: chart.title, sourceTitle: chart.sourceTitle, chartType: chart.chartType, legacyField: chart.legacyField, renderable: chart.renderable, dataCount: chart.dataCount, sourceStatus: chart.sourceStatus }));
  contract.chart_fidelity = buildChartFidelity(contract, canonical);
  attachMobileAliases(contract);
  contract._contract = VALORAE_MOBILE_SCRAPER_CONTRACT_VERSION;
  contract._coverage = buildCoverage(contract);
  contract._source_integrity = {
    policy: 'no-synthetic-chart-data',
    normalizedForAndroidApk: true,
    stableContract: true,
    emptyMeansSourceUnavailable: true,
    generatedAt: new Date().toISOString(),
  };
  return sanitizeForMobile(contract);
}

