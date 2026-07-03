import { VALORAE_RELEASE_PATCH } from '../release/current.js';
import { parseFinancialNumber } from '../normalizers/numbers.js';

export const VALORAE_I10_CHART_EXTRACTOR_VERSION = `${VALORAE_RELEASE_PATCH}-i10-chart-extractor`;

const I10_BASE = 'https://investidor10.com.br';
const PERIOD_ORDER = ['1 mês', '3 meses', '1 ano', '2 anos', '5 anos', '10 anos'];
const CHART_URL_KEYWORDS = /(chart|grafico|gr[aá]fico|cotacao|cota[cç][aã]o|preco|pre[cç]o|lucro|receita|receitaliquida|balancos|balan[cç]os|ativos|passivos|patrimonio|patrim[oô]nio|payout|historico|hist[oó]rico|indicadores|comparador|compare|indices|[íi]ndices|rentabilidade|profitability|fluxo|cashflow|dre|demonstrativo|statement|provento|dividend|yield|rendimento|distribui[cç][aã]o|carteira|vacancia|vac[âa]ncia|imoveis|im[oó]veis|segmento|negocio|neg[oó]cio|regiao|regi[oõ]es)/i;

function text(v = '') { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
function stripTags(html = '') { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function decodeBasic(value = '') {
  return String(value || '')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/\u0026/g, '&')
    .replace(/\u003d/g, '=')
    .replace(/\u002f/gi, '/');
}
function parseNum(v) {
  const n = parseFinancialNumber(v, { maxAbs: 1e16 });
  return n === null || !Number.isFinite(n) ? null : n;
}
function compactKey(v = '') {
  return text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function chartPeriodSortKey(label = '') {
  const raw = text(label).toLowerCase();
  if (!raw) return null;
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  if (['agora', 'hoje', 'atual'].includes(normalized)) return Number.MAX_SAFE_INTEGER - 128;
  let m = normalized.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return Number(m[1]) * 10000 + Math.min(12, Math.max(1, Number(m[2]))) * 100 + Math.min(31, Math.max(1, Number(m[3])));
  m = normalized.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2}|\d{2})\b/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return year * 10000 + Math.min(12, Math.max(1, Number(m[2]))) * 100 + Math.min(31, Math.max(1, Number(m[1])));
  }
  m = normalized.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})\b/);
  if (m) return Number(m[1]) * 10000 + Math.min(12, Math.max(1, Number(m[2]))) * 100 + 1;
  m = normalized.match(/\b([1-4])\s*t\s*[-/]?\s*(20\d{2}|19\d{2})\b/);
  if (m) return Number(m[2]) * 10000 + ((Number(m[1]) - 1) * 3 + 1) * 100 + 1;
  m = normalized.match(/\b(20\d{2}|19\d{2})\s*t\s*([1-4])\b/);
  if (m) return Number(m[1]) * 10000 + ((Number(m[2]) - 1) * 3 + 1) * 100 + 1;
  const months = new Map([
    ['jan', 1], ['janeiro', 1], ['fev', 2], ['fevereiro', 2], ['mar', 3], ['marco', 3],
    ['abr', 4], ['abril', 4], ['mai', 5], ['maio', 5], ['jun', 6], ['junho', 6],
    ['jul', 7], ['julho', 7], ['ago', 8], ['agosto', 8], ['set', 9], ['setembro', 9],
    ['out', 10], ['outubro', 10], ['nov', 11], ['novembro', 11], ['dez', 12], ['dezembro', 12]
  ]);
  m = normalized.match(/\b([a-z]{3,9})[-/ ](20\d{2}|19\d{2})\b/);
  if (m) {
    const month = months.get(m[1]) || months.get(m[1].slice(0, 3));
    if (month) return Number(m[2]) * 10000 + month * 100 + 1;
  }
  m = normalized.match(/\b(20\d{2}|19\d{2})\b/);
  if (m) return Number(m[1]) * 10000 + 101;
  return null;
}

function sortByChartPeriod(points = []) {
  const rows = Array.from(points || []);
  if (rows.length < 2) return rows;
  const keyed = rows.map((point, index) => ({ point, index, key: chartPeriodSortKey(point?.year || point?.label || point?.period || point?.date) }));
  const parsed = keyed.filter(item => item.key !== null).length;
  if (parsed < 2 || keyed.length - parsed > 1) return rows.sort((a, b) => String(a?.year || a?.label).localeCompare(String(b?.year || b?.label), 'pt-BR', { numeric: true }));
  return keyed.sort((a, b) => (a.key ?? Number.MAX_SAFE_INTEGER) - (b.key ?? Number.MAX_SAFE_INTEGER) || a.index - b.index).map(item => item.point);
}


function pickNum(...values) {
  for (const v of values) {
    const n = parseNum(v);
    if (n !== null) return n;
  }
  return null;
}
function firstNum(...values) {
  for (const v of values) {
    const n = parseNum(v);
    if (n !== null && n !== 0) return n;
  }
  return null;
}
function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function arr(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function objectEntries(v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v) : []; }

export function discoverInvestidor10ChartApiUrls(html = '', ticker = '', type = '') {
  const source = String(html || '');
  const raw = [];
  const add = (candidate) => {
    let u = decodeBasic(candidate || '').trim();
    if (!u) return;
    if (u.startsWith('//')) u = `https:${u}`;
    if (u.startsWith('/')) u = `${I10_BASE}${u}`;
    if (!/^https:\/\/investidor10\.com\.br\/api\//i.test(u)) return;
    if (!CHART_URL_KEYWORDS.test(u)) return;
    if (ticker && /cotacao-lucro/i.test(u) && !u.toLowerCase().includes(ticker.toLowerCase())) return;
    raw.push(u);
  };

  const patterns = [
    /["'`]((?:https:\/\/investidor10\.com\.br)?\/api\/[^"'`<>\\]+)["'`]/gi,
    /data-url=["']([^"']*\/api\/[^"']+)["']/gi,
    /url\s*[:=]\s*["'`]([^"'`]*\/api\/[^"'`]+)["'`]/gi,
    /fetch\(["'`]([^"'`]*\/api\/[^"'`]+)["'`]/gi,
    /axios\.get\(["'`]([^"'`]*\/api\/[^"'`]+)["'`]/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source)) && raw.length < 80) add(m[1]);
  }

  // URLs can appear escaped inside JSON strings.
  const escaped = source.match(/(?:https:\\?\/\\?\/investidor10\.com\.br)?\\?\/api\\?\/[^"'`<>\s]+/gi) || [];
  for (const item of escaped.slice(0, 80)) add(item.replace(/\\\//g, '/'));

  const base = I10_BASE;
  const ids = extractInvestidor10ChartIds(html);
  if (type !== 'FII' && ids.companyId) {
    add(`${base}/api/balancos/receitaliquida/chart/${ids.companyId}/3650/false/`);
    add(`${base}/api/balancos/ativospassivos/chart/${ids.companyId}/3650/`);
    add(`${base}/api/balancos/resultado/chart/${ids.companyId}/3650/`);
    add(`${base}/api/balancos/fluxocaixa/chart/${ids.companyId}/3650/`);
    add(`${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/`);
    if (ticker) add(`${base}/api/cotacao-lucro/${ticker.toLowerCase()}/adjusted/`);
    if (ids.tickerId && ticker) add(`${base}/api/acoes/payout-chart/${ids.companyId}/${ids.tickerId}/${ticker.toUpperCase()}/3650`);
  }
  if (type === 'FII' && ids.fiiId) {
    add(`${base}/api/fii/historico-indicadores/${ids.fiiId}/10`);
    add(`${base}/api/fii/comparador/table/${ids.fiiId}/`);
    add(`${base}/api/fii/dividend-yield-chart/${ids.fiiId}/10`);
    add(`${base}/api/fii/distribuicao-ativos/${ids.fiiId}/`);
    add(`${base}/api/fii/lista-imoveis/${ids.fiiId}/`);
  }

  return uniqBy(raw, u => u).slice(0, 24);
}

export function extractInvestidor10ChartIds(html = '') {
  const source = String(html || '');
  const pick = (patterns) => {
    for (const re of patterns) {
      const m = source.match(re);
      if (m?.[1]) return m[1];
    }
    return '';
  };
  const companyId = pick([
    /\/api\/balancos\/receitaliquida\/chart\/(\d+)\//i,
    /\/api\/balancos\/ativospassivos\/chart\/(\d+)\//i,
    /(?:companyId|company_id|companyID|idCompany|empresaId|idEmpresa|company)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:companyId|company_id|companyID|idCompany|empresaId|idEmpresa)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:company|empresa|company-id|empresa-id)-id=["'](\d+)["']/i,
  ]);
  const tickerId = pick([
    /tickerId\s*[:=]\s*['"]?(\d+)['"]?/i,
    /(?:ticker_id|idTicker|stockId|stock_id|acaoId|idAcao|assetId|asset_id)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:tickerId|ticker_id|idTicker|stockId|stock_id|acaoId|idAcao|assetId|asset_id)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:ticker|stock|asset|acao)-id=["'](\d+)["']/i,
    /\/api\/acoes\/payout-chart\/\d+\/(\d+)\//i,
  ]);
  const fiiId = pick([
    /\/api\/fii\/historico-indicadores\/(\d+)\//i,
    /\/api\/fii\/comparador\/table\/(\d+)\//i,
    /(?:fiiId|fii_id|idFii|fundId|fund_id)\s*[:=]\s*['"]?(\d+)['"]?/i,
    /["'](?:fiiId|fii_id|idFii|fundId|fund_id)["']\s*:\s*["']?(\d+)["']?/i,
    /data-(?:fii|fund)-id=["'](\d+)["']/i,
  ]);
  return { companyId, tickerId, fiiId };
}

function extractPercents(slice = '') {
  return [...String(slice || '').matchAll(/([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%/g)]
    .map(m => ({ raw: m[0], value: parseNum(m[0]) }))
    .filter(x => x.value !== null);
}

export function extractProfitabilityFromHtml(html = '') {
  const plain = stripTags(html);
  const idx = plain.search(/Rentabilidade\s+de/i);
  if (idx < 0) return null;
  const endRel = plain.slice(idx + 20).search(/Preço Justo|INDICADORES|INFORMAÇÕES|SOBRE|COMPARAÇÃO|COMPARANDO|Já tem|Carteira Investidor/i);
  const sec = plain.slice(idx, endRel > 0 ? idx + 20 + endRel : idx + 2600).replace(/\s+/g, ' ').trim();
  const lower = sec.toLowerCase();
  const nominalIdx = lower.indexOf('rentabilidade');
  const realIdx = lower.indexOf('rentabilidade real');
  if (nominalIdx < 0) return null;
  const labels = PERIOD_ORDER.filter(p => new RegExp(p.replace('ê', '[êe]'), 'i').test(sec.slice(0, Math.max(realIdx, nominalIdx + 80))));
  const periods = labels.length >= 3 ? labels : PERIOD_ORDER;
  const nominalSlice = sec.slice(nominalIdx, realIdx > nominalIdx ? realIdx : undefined);
  const realSlice = realIdx > 0 ? sec.slice(realIdx) : '';
  const nominalValues = extractPercents(nominalSlice).slice(0, periods.length);
  const realValues = extractPercents(realSlice).slice(0, periods.length);
  const nominal = periods.map((period, i) => nominalValues[i]?.value === undefined ? null : ({ period, label: period, valuePercent: nominalValues[i].value, raw: nominalValues[i].raw, kind: 'nominal' })).filter(Boolean);
  const real = periods.map((period, i) => realValues[i]?.value === undefined ? null : ({ period, label: period, valuePercent: realValues[i].value, raw: realValues[i].raw, kind: 'real' })).filter(Boolean);
  if (!nominal.length && !real.length) return null;
  return { periods, nominal, real, source: 'Investidor10HTML.rentabilidade', sourceVersion: VALORAE_I10_CHART_EXTRACTOR_VERSION };
}

function labelOfPoint(item, fallback = '') {
  if (Array.isArray(item)) return text(item[0] ?? fallback);
  if (item && typeof item === 'object') return text(item.label ?? item.period ?? item.periodo ?? item.year ?? item.ano ?? item.date ?? item.data ?? item.x ?? fallback);
  return text(fallback);
}
function valueOfPoint(item) {
  if (Array.isArray(item)) return pickNum(item[1], item[0]);
  if (item && typeof item === 'object') return pickNum(item.y, item.value, item.valor, item.amount, item.total, item.close, item.price, item.preco);
  return pickNum(item);
}
function categoriesOf(obj) {
  const xAxis = Array.isArray(obj?.xAxis) ? obj.xAxis[0] : obj?.xAxis;
  return arr(obj?.labels || obj?.categories || obj?.years || obj?.periods || obj?.periodos || xAxis?.categories).map(text);
}
function fieldForFinancialSeries(name = '') {
  const key = compactKey(name);
  if (key.includes('receitaliquida') || key === 'receita' || key.includes('receitaoperacional') || key.includes('revenue') || key.includes('faturamento') || key.includes('sales')) return 'netRevenue';
  if (key.includes('lucroliquido') || key === 'lucro' || key.includes('netprofit') || key.includes('profit') || key.includes('earnings')) return 'netProfit';
  if (key.includes('lucrobruto') || key.includes('grossprofit')) return 'grossProfit';
  if (key.includes('custo') || key.includes('cost') || key.includes('cpv')) return 'cost';
  if (key.includes('ebitda')) return 'ebitda';
  if (key.includes('ebit')) return 'ebit';
  if (key.includes('patrimonioliquido') || key === 'patrimonio' || key === 'pl' || key.includes('networth') || key.includes('equity')) return 'netWorth';
  // O Investidor10 frequentemente nomeia a série de balanço apenas como "Ativo".
  // Antes ela não era mapeada, então o APK recebia somente PL e os gráficos ficavam vazios/parciais.
  if (key.includes('ativototal') || key.includes('totalativos') || key === 'ativo' || key === 'ativos' || key.includes('totalassets') || key.includes('assets')) return 'totalAssets';
  if (key.includes('passivototal') || key.includes('totalpassivos') || key === 'passivo' || key === 'passivos' || key.includes('totalliabilities') || key.includes('liabilities')) return 'totalLiabilities';
  if (key.includes('dividabruta') || key.includes('grossdebt') || key.includes('debtgross')) return 'grossDebt';
  if (key.includes('dividaliquida') || key.includes('netdebt') || key.includes('debtnet')) return 'netDebt';
  if (key.includes('disponibilidade') || key === 'caixa' || key.includes('caixaequivalente') || key.includes('cashandequivalents') || key === 'cash') return 'cash';
  if (key.includes('cotacao') || key.includes('preco') || key.includes('price') || key.includes('quote')) return 'quote';
  if (key.includes('payout')) return 'payout';
  if (key.includes('fluxocaixaoperacional') || key.includes('caixaoperacional') || key.includes('operatingcashflow') || key.includes('cashfromoperations')) return 'operatingCashFlow';
  if (key.includes('fluxocaixalivre') || key.includes('freecashflow') || key === 'fcf') return 'freeCashFlow';
  if (key.includes('capex') || key.includes('investimento')) return 'capex';
  if (key.includes('caixa') || key.includes('cashflow') || key.includes('fluxocaixa')) return 'cashFlow';
  return '';
}
function pointBase(label = '', fallbackIndex = 0) {
  const clean = text(label || `P${fallbackIndex + 1}`);
  const y = clean.match(/(20\d{2}|19\d{2})/)?.[1] || clean;
  const q = clean.match(/\b([1-4]T|T[1-4]|Q[1-4])\b/i)?.[1]?.toUpperCase() || '';
  return { label: clean, year: y, quarter: q };
}
function mergePoint(map, label, field, value, index = 0) {
  const n = parseNum(value);
  if (n === null || !field) return;
  const key = text(label || `P${index + 1}`);
  const current = map.get(key) || pointBase(key, index);
  current[field] = n;
  map.set(key, current);
}
function normalizeFinancialChart(raw, preferred = '') {
  const out = new Map();
  const visit = (node, inheritedLabel = '', depth = 0) => {
    if (depth > 5 || node == null) return;
    if (Array.isArray(node)) {
      // Array of series or array of points.
      const maybeSeries = node.some(x => x && typeof x === 'object' && !Array.isArray(x) && (x.data || x.values || x.points || x.series));
      if (maybeSeries) {
        node.forEach((item, i) => visit(item, inheritedLabel || text(item?.name || item?.label || item?.key || `series_${i + 1}`), depth + 1));
        return;
      }
      node.forEach((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const label = labelOfPoint(item, inheritedLabel || `P${i + 1}`);
          const fields = ['netRevenue','netProfit','grossProfit','cost','ebitda','ebit','netWorth','totalAssets','totalLiabilities','grossDebt','netDebt','cash','quote','payout','operatingCashFlow','freeCashFlow','capex','cashFlow'];
          for (const f of fields) mergePoint(out, label, f, valueByAliases(item, financialFieldAliases(f)), i);
          const field = fieldForFinancialSeries(inheritedLabel || item.name || item.label || item.key || preferred);
          if (field && !fields.some(f => valueByAliases(item, financialFieldAliases(f)) !== undefined)) mergePoint(out, label, field, valueOfPoint(item), i);
        } else if (Array.isArray(item)) {
          const label = labelOfPoint(item, inheritedLabel || `P${i + 1}`);
          const field = fieldForFinancialSeries(inheritedLabel || preferred) || preferred;
          mergePoint(out, label, field, valueOfPoint(item), i);
        }
      });
      return;
    }
    if (node && typeof node === 'object') {
      const labels = categoriesOf(node);
      const series = arr(node.series || node.datasets);
      if (series.length) {
        series.forEach((s, sIdx) => {
          const name = text(s?.name || s?.label || s?.title || s?.key || inheritedLabel || `series_${sIdx + 1}`);
          const field = fieldForFinancialSeries(name) || fieldForFinancialSeries(inheritedLabel) || preferred;
          const data = arr(s?.data || s?.values || s?.points);
          data.forEach((item, i) => mergePoint(out, labelOfPoint(item, labels[i] || `P${i + 1}`), field, valueOfPoint(item), i));
        });
      }
      // Named arrays on the same object.
      for (const [k, v] of objectEntries(node)) {
        const field = fieldForFinancialSeries(k);
        if (field && Array.isArray(v)) v.forEach((item, i) => mergePoint(out, labelOfPoint(item, labels[i] || `P${i + 1}`), field, valueOfPoint(item), i));
      }
      const directLabel = labelOfPoint(node, inheritedLabel);
      const directFields = ['netRevenue','netProfit','grossProfit','cost','ebitda','ebit','netWorth','totalAssets','totalLiabilities','grossDebt','netDebt','cash','quote','payout','operatingCashFlow','freeCashFlow','capex','cashFlow'];
      let direct = false;
      for (const f of directFields) {
        const val = valueByAliases(node, financialFieldAliases(f));
        if (val !== undefined && !Array.isArray(val)) { mergePoint(out, directLabel, f, val); direct = true; }
      }
      if (!direct) {
        for (const key of ['data','values','points','items','chart','payload','result','results','response']) {
          if (node[key] !== undefined) visit(node[key], inheritedLabel || text(node.name || node.label || node.key), depth + 1);
        }
      }
      // Year keyed maps: {2024:{...}}
      for (const [k, v] of objectEntries(node)) {
        if (/^(?:20|19)\d{2}$/.test(k) || /^(?:[1-4]T|T[1-4]|Q[1-4])[/ -]?\d{2,4}$/i.test(k)) visit(v, k, depth + 1);
      }
    }
  };
  visit(raw, '', 0);
  return [...out.values()].filter(p => Object.keys(p).some(k => !['label','year','quarter'].includes(k) && Number.isFinite(p[k])));
}
function toSnake(f) { return f.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`); }
function toPt(f) {
  return ({ netRevenue: 'receitaLiquida', netProfit: 'lucroLiquido', grossProfit: 'lucroBruto', netWorth: 'patrimonioLiquido', totalAssets: 'ativos', totalLiabilities: 'passivos', grossDebt: 'dividaBruta', netDebt: 'dividaLiquida', cash: 'disponibilidade', quote: 'cotacao', operatingCashFlow: 'fluxoCaixaOperacional', freeCashFlow: 'fluxoCaixaLivre', cashFlow: 'fluxoCaixa' })[f] || f;
}

function valueByAliases(obj, aliases = []) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of aliases) {
    if (obj[key] !== undefined) return obj[key];
  }
  const normalized = new Map(Object.keys(obj).map(k => [compactKey(k), k]));
  for (const key of aliases) {
    const found = normalized.get(compactKey(key));
    if (found && obj[found] !== undefined) return obj[found];
  }
  return undefined;
}

function financialFieldAliases(f) {
  return ({
    netRevenue: ['netRevenue','net_revenue','revenue','revenues','receitaLiquida','receita_liquida','receita','faturamento','sales'],
    netProfit: ['netProfit','net_profit','profit','profits','lucroLiquido','lucro_liquido','lucro','earnings'],
    grossProfit: ['grossProfit','gross_profit','lucroBruto','lucro_bruto'],
    cost: ['cost','costs','custo','custos','cpv'],
    ebitda: ['ebitda','EBITDA'],
    ebit: ['ebit','EBIT'],
    netWorth: ['netWorth','net_worth','patrimonioLiquido','patrimonio_liquido','patrimonio','pl','equity'],
    totalAssets: ['totalAssets','total_assets','balance_total_assets','ativo','ativos','ativoTotal','totalAtivos','total_ativos','assets','total_assets'],
    totalLiabilities: ['totalLiabilities','total_liabilities','balance_total_liabilities','passivo','passivos','passivoTotal','totalPassivos','total_passivos','liabilities','total_liabilities'],
    grossDebt: ['grossDebt','gross_debt','dividaBruta','dívidaBruta','divida_bruta','dívida_bruta','debtGross'],
    netDebt: ['netDebt','net_debt','dividaLiquida','dívidaLiquida','divida_liquida','dívida_liquida','debtNet'],
    cash: ['cash','cashAndEquivalents','disponibilidade','disponibilidades','caixa','caixaEquivalentes'],
    quote: ['quote','quotation','cotacao','cotação','preco','preço','price'],
    payout: ['payout','payOut','pay_out','percent','percentage','valor','value'],
    operatingCashFlow: ['operatingCashFlow','operating_cash_flow','fluxoCaixaOperacional','fluxo_caixa_operacional','caixaOperacional','cashFromOperations'],
    freeCashFlow: ['freeCashFlow','free_cash_flow','fluxoCaixaLivre','fluxo_caixa_livre','fcf'],
    capex: ['capex','investimentos','investimento','capitalExpenditure'],
    cashFlow: ['cashFlow','cash_flow','fluxoCaixa','fluxo_caixa','caixa'],
  })[f] || [f, toSnake(f), toPt(f)];
}

function normalizeProfitVsQuote(raw) {
  return normalizeFinancialChart(raw, '').map(p => ({ label: p.label, year: p.year, quote: p.quote ?? p.price ?? p.preco ?? null, profit: p.netProfit ?? null })).filter(p => p.quote !== null || p.profit !== null);
}
function normalizePayout(raw) {
  const points = normalizeFinancialChart(raw, 'payout').map(p => ({ label: p.label, year: p.year, value: p.payout ?? p.value ?? null })).filter(p => p.value !== null);
  if (points.length) return points;
  const out = [];
  const visit = (node, depth = 0) => {
    if (depth > 4 || node == null) return;
    if (Array.isArray(node)) node.forEach((item, i) => {
      if (item && typeof item === 'object') {
        const value = firstNum(item.value, item.valor, item.payout, item.percent, item.percentage, item.y);
        const year = text(item.year || item.ano || item.label || item.period || item.x || `P${i + 1}`);
        if (value !== null) out.push({ label: year, year, value });
      } else {
        const value = firstNum(item);
        if (value !== null) out.push({ label: `P${i + 1}`, year: `P${i + 1}`, value });
      }
    });
    else if (typeof node === 'object') for (const v of Object.values(node)) visit(v, depth + 1);
  };
  visit(raw);
  return out;
}

function normalizeComparison(raw, ticker = '') {
  const seriesMap = new Map();
  const addPoint = (name, label, value, idx = 0) => {
    const n = parseNum(value);
    const cleanName = text(name || ticker || 'Ativo').toUpperCase();
    if (!cleanName || n === null) return;
    const s = seriesMap.get(cleanName) || { name: cleanName, points: [] };
    s.points.push({ label: text(label || `P${idx + 1}`), value: n });
    seriesMap.set(cleanName, s);
  };
  const visit = (node, inheritedName = '', depth = 0) => {
    if (depth > 5 || node == null) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const nm = text(item.name || item.label || item.ticker || item.symbol || item.indice || item.index || inheritedName);
          const data = item.points || item.data || item.values || item.items || item.history || item.series;
          if (Array.isArray(data)) visit(data, nm, depth + 1);
          else addPoint(nm || inheritedName, labelOfPoint(item, `P${i + 1}`), firstNum(item.valuePercent, item.percent, item.percentage, item.value, item.valor, item.y), i);
        } else if (Array.isArray(item)) addPoint(inheritedName, item[0], item[1], i);
        else addPoint(inheritedName, `P${i + 1}`, item, i);
      });
      return;
    }
    if (node && typeof node === 'object') {
      const labels = categoriesOf(node);
      const series = arr(node.series || node.datasets || node.comparisons || node.indices);
      if (series.length) {
        series.forEach((s, sIdx) => {
          const nm = text(s?.name || s?.label || s?.ticker || s?.symbol || s?.indice || s?.index || `S${sIdx + 1}`);
          arr(s?.data || s?.points || s?.values || s?.items).forEach((item, i) => addPoint(nm, labelOfPoint(item, labels[i] || `P${i + 1}`), valueOfPoint(item), i));
        });
      }
      for (const [k, v] of objectEntries(node)) {
        if (['series','datasets','comparisons','indices','labels','categories','data','values','points','items','result','results','payload','chart'].includes(k)) continue;
        if (Array.isArray(v)) visit(v, k, depth + 1);
      }
      for (const key of ['data','values','points','items','result','results','payload','chart','comparison','comparacao','indexComparison','comparacaoIndices']) if (node[key] !== undefined) visit(node[key], inheritedName, depth + 1);
    }
  };
  visit(raw, ticker, 0);
  return [...seriesMap.values()].filter(s => s.points.length >= 2);
}


const COMPANY_EXPECTED_CHARTS = [
  { key: 'priceHistory', title: 'Cotação', required: true, html: /COTAÇÃO\s+[A-Z0-9]+/i, aliases: ['cotacao','quote','price','historicoPreco'] },
  { key: 'profitability', title: 'Rentabilidade nominal e real', required: true, html: /Rentabilidade\s+de/i, aliases: ['rentabilidade','profitability','rentabilidadeReal'] },
  { key: 'fundamentalIndicatorHistory', title: 'Histórico de Indicadores', required: false, html: /Histórico de Indicadores/i, aliases: ['historicoIndicadores','indicatorHistory'] },
  { key: 'indexComparison', title: 'Comparação com Índices', required: true, html: /COMPARAÇÃO\s+DE[\s\S]{0,80}COM\s+(?:ÍNDICES|INDICES)/i, aliases: ['comparacaoIndices','indexComparison','indicesComparison'] },
  { key: 'commodityComparison', title: 'Comparação com commodity/setor', required: false, html: /COMPARANDO[\s\S]{0,80}COM/i, aliases: ['comparacaoCommodity','commodityComparison'] },
  { key: 'revenueRegion', title: 'Regiões onde gera receita', required: false, html: /Regiões\s+onde[\s\S]{0,80}gera\s+receita/i, aliases: ['revenueGeography','regioesReceita'] },
  { key: 'revenueBusiness', title: 'Negócios que geram receita', required: false, html: /negócios\s+que\s+geram\s+receita/i, aliases: ['revenueSegment','negociosReceita'] },
  { key: 'revenueProfit', title: 'Receitas e Lucros', required: true, html: /Receitas\s+e\s+Lucros/i, aliases: ['receitasLucros','revenueProfit'] },
  { key: 'incomeStatement', title: 'Resultados', required: false, html: /##\s*resultados|\bresultados\s+[A-Za-zÀ-ÿ]/i, aliases: ['resultados','incomeStatement','dre'] },
  { key: 'cashFlowStatement', title: 'Fluxo de Caixa', required: false, html: /fluxo\s+de\s+caixa/i, aliases: ['fluxoCaixa','cashFlow','cashFlowStatement'] },
  { key: 'profitVsQuote', title: 'Lucro x Cotação', required: true, html: /LUCRO\s+X\s+COTAÇÃO/i, aliases: ['lucroCotacao','profitVsQuote'] },
  { key: 'equityEvolution', title: 'Evolução do Patrimônio', required: true, html: /EVOLUÇÃO\s+DO\s+PATRIMÔNIO/i, aliases: ['evolucaoPatrimonio','equityEvolution'] },
  { key: 'balanceSheet', title: 'Balanço Patrimonial', required: true, html: /BALANÇO\s+PATRIMONIAL/i, aliases: ['balancoPatrimonial','balanceSheet'] },
  { key: 'payoutHistory', title: 'Payout histórico', required: true, html: /Payout\s+de/i, aliases: ['payoutHistorico','payoutHistory'] },
];

const ETF_EXPECTED_CHARTS = [
  { key: 'priceHistory', title: 'Cotação', required: true, html: /COTAÇÃO\s+[A-Z0-9]+/i, aliases: ['cotacao','quote','price','historicoPreco'] },
  { key: 'profitability', title: 'Rentabilidade nominal e real', required: true, html: /Rentabilidade\s+de/i, aliases: ['rentabilidade','profitability','rentabilidadeReal'] },
  { key: 'indexComparison', title: 'Comparação com Índices', required: true, html: /COMPARAÇÃO\s+DE[\s\S]{0,80}COM\s+(?:ÍNDICES|INDICES)/i, aliases: ['comparacaoIndices','indexComparison','indicesComparison'] },
];

const FII_EXPECTED_CHARTS = [
  { key: 'priceHistory', title: 'Cotação', required: true, html: /COTAÇÃO\s+[A-Z0-9]+/i, aliases: ['cotacao','quote','price','historicoPreco'] },
  { key: 'profitability', title: 'Rentabilidade nominal e real', required: true, html: /Rentabilidade\s+de/i, aliases: ['rentabilidade','profitability','rentabilidadeReal'] },
  { key: 'fiiInfo', title: 'Informações do FII', required: true, html: /INFORMAÇÕES\s+SOBRE\s+[A-Z0-9]+/i, aliases: ['informacoesFii','fiiInfo'] },
  { key: 'fundamentalIndicatorHistory', title: 'Histórico de Indicadores Fundamentalistas', required: true, html: /HISTÓRICO\s+DE\s+INDICADORES\s+FUNDAMENTALISTAS/i, aliases: ['historicoIndicadores','indicatorHistory'] },
  { key: 'indexComparison', title: 'Comparação com Índices', required: true, html: /COMPARAÇÃO\s+DE[\s\S]{0,80}COM\s+(?:ÍNDICES|INDICES)/i, aliases: ['comparacaoIndices','indexComparison','indicesComparison'] },
  { key: 'peerComparison', title: 'Comparando com outros FIIs', required: false, html: /COMPARANDO\s+COM\s+OUTROS\s+FIIS/i, aliases: ['comparadorFiis','peerComparison'] },
  { key: 'distribution12m', title: 'Distribuições nos últimos 12 meses', required: true, html: /Distribuições\s+nos\s+últimos\s+12\s+meses/i, aliases: ['distribuicoes12m','distribution12m'] },
  { key: 'dividendYieldHistory', title: 'Dividend Yield histórico', required: true, html: /DIVIDEND\s+YIELD/i, aliases: ['dividendYieldHistory','dyHistory'] },
  { key: 'dividendHistory', title: 'Histórico de dividendos/distribuições', required: true, html: /Dividendos|Rendimentos|Distribuições/i, aliases: ['dividendos','historicoDividendos','dividendHistory'] },
  { key: 'physicalAssets', title: 'Lista/Distribuição de imóveis', required: false, html: /Lista\s+de\s+Imóveis|Área\s+bruta\s+locável/i, aliases: ['imoveis','physicalAssets'] },
  { key: 'fiiAssetDistribution', title: 'Distribuição de ativos do fundo', required: false, html: /distribui(?:ç|c)[aã]o\s+de\s+ativos\s+do\s+fundo/i, aliases: ['distribuicaoAtivosFundo','fiiAssetDistribution','assetDistribution','assetAllocation'] },
];

function extractSectionPresence(html = '', definitions = []) {
  const source = String(html || '');
  return definitions.map(def => {
    const m = source.match(def.html);
    return { key: def.key, title: def.title, required: !!def.required, presentInHtml: !!m, htmlIndex: m ? m.index : -1, aliases: def.aliases || [] };
  });
}

function pointCount(value) {
  if (!value) return 0;
  if (Array.isArray(value)) return value.reduce((acc, item) => acc + pointCount(item), value.length ? 0 : 0);
  if (value && typeof value === 'object') {
    if (Array.isArray(value.points)) return value.points.length;
    if (Array.isArray(value.data)) return value.data.length;
    if (Array.isArray(value.values)) return value.values.length;
    if (Array.isArray(value.items)) return value.items.length;
    return Object.values(value).reduce((acc, v) => acc + pointCount(v), 0);
  }
  return 0;
}

function collectionValues(obj = {}) {
  return Object.entries(obj || {}).map(([key, value]) => ({ key, value }));
}

function classifyRoleFromName(name = '', url = '') {
  const k = compactKey(`${name} ${url}`);
  if (/comparacao|comparison|comparador|indices|ifix|ibov|ipca|cdi|table/.test(k)) return 'indexComparison';
  if (/commodity|commodit|brent|petroleo|ouro|cafe|milho|wti/.test(k)) return 'commodityComparison';
  if (/regiao|regioes|geograph|region|country|pais|receitageograf|revenuegeograph|revenuebyregion/.test(k)) return 'revenueRegion';
  if (/negocios|negocio|business|bussines|segmento|segmentos|revenuebybusiness|revenuesegment/.test(k)) return 'revenueBusiness';
  if (/fluxodecaixa|fluxocaixa|cashflow|cashflowstatement/.test(k)) return 'cashFlowStatement';
  if (/resultado|resultados|dre|incomestatement|demonstrativoresultado|balancosresultado/.test(k)) return 'incomeStatement';
  if (/receitaliquida|receitaslucros|revenueprofit|receita|lucros|receitaliquidachart/.test(k)) return 'revenueProfit';
  if (/cotacaolucro|lucrocotacao|profitvsquote|lucro.*cotacao|cotacao.*lucro/.test(k)) return 'profitVsQuote';
  if (/ativospassivos|ativoepassivo|balanco|balancos|balancesheet|evolucaopatrimonio|patrimonio|patrimonioliquido|ativo|passivo/.test(k)) return 'balanceSheet';
  if (/payout|payoutratio/.test(k)) return 'payoutHistory';
  if (/historic.*indicador|historicoindicador|indicadores|fundamental|indicadoreschart/.test(k)) return 'fundamentalIndicatorHistory';
  if (/fii.*comparador|peer|outrosfiis/.test(k)) return 'peerComparison';
  if (/distribuicao.*ativos.*fundo|distribuicaodeativosdofundo|assetdistribution|assetallocation|fundassetdistribution|carteiraativos|composicaocarteira/.test(k)) return 'fiiAssetDistribution';
  if (/listaimoveis|imoveis|physicalassets|ativosfundo|areabrutalocavel|abl/.test(k)) return 'physicalAssets';
  if (/yield|dyhistory|dividendyield|dividendyieldchart/.test(k)) return 'dividendYieldHistory';
  if (/dividend|dividendo|provento|distribuicao|rendimento|rendimentos/.test(k)) return 'dividendHistory';
  return '';
}

function objectHasKeys(node, keys = [], depth = 0) {
  if (depth > 5 || node == null) return false;
  if (Array.isArray(node)) return node.some(x => objectHasKeys(x, keys, depth + 1));
  if (typeof node === 'object') {
    const own = Object.keys(node).map(compactKey);
    if (keys.some(k => own.some(o => o.includes(k)))) return true;
    return Object.values(node).some(v => objectHasKeys(v, keys, depth + 1));
  }
  return false;
}

function classifyRoleFromData(value) {
  if (objectHasKeys(value, ['regiao', 'region', 'geograph', 'country', 'pais'])) return 'revenueRegion';
  if (objectHasKeys(value, ['negocio', 'business', 'bussines', 'segmento', 'segment'])) return 'revenueBusiness';
  if (objectHasKeys(value, ['fluxocaixa', 'fluxodecaixa', 'cashflow', 'fcf', 'capex'])) return 'cashFlowStatement';
  if (objectHasKeys(value, ['receita', 'revenue', 'lucroliquido', 'netprofit'])) return 'revenueProfit';
  if (objectHasKeys(value, ['cotacao', 'quote', 'preco', 'price']) && objectHasKeys(value, ['lucro', 'profit'])) return 'profitVsQuote';
  if (objectHasKeys(value, ['ativo', 'ativos', 'assets', 'passivo', 'passivos', 'liabilities', 'patrimonioliquido', 'networth'])) return 'balanceSheet';
  if (objectHasKeys(value, ['payout'])) return 'payoutHistory';
  if (objectHasKeys(value, ['ibov', 'ifix', 'ipca', 'cdi', 'indice', 'index'])) return 'indexComparison';
  if (objectHasKeys(value, ['assetdistribution', 'assetallocation', 'distribuicao', 'carteira', 'cri', 'cotas', 'caixa'])) return 'fiiAssetDistribution';
  if (objectHasKeys(value, ['imovel', 'imoveis', 'area', 'abl', 'estado', 'uf'])) return 'physicalAssets';
  if (objectHasKeys(value, ['dividend', 'dividendo', 'rendimento', 'rendimentos', 'provento', 'proventos'])) return 'dividendHistory';
  return '';
}

function roleOfPayload(key = '', value, apiStatus = []) {
  const status = apiStatus.find(s => s.key === key) || {};
  return classifyRoleFromName(key, status.url || '') || classifyRoleFromData(value);
}

function sourcesByRole(apiExtras = {}) {
  const grouped = new Map();
  const add = (role, key, value) => {
    if (!role || value == null) return;
    const list = grouped.get(role) || [];
    list.push({ key, value });
    grouped.set(role, list);
  };
  const apiStatus = apiExtras.apiStatus || [];
  for (const { key, value } of collectionValues(apiExtras.chartsFinanceiros || {})) add(roleOfPayload(key, value, apiStatus), key, value);
  for (const { key, value } of collectionValues(apiExtras.rawJson || {})) add(roleOfPayload(key, value, apiStatus), key, value);
  return grouped;
}

function firstNonEmpty(list, normalizer) {
  for (const item of list || []) {
    const normalized = normalizer(item.value, item.key);
    if (Array.isArray(normalized) && normalized.length) return normalized;
    if (normalized && !Array.isArray(normalized)) return normalized;
  }
  return [];
}

function pointCompleteness(p = {}) {
  return ['netRevenue','netProfit','grossProfit','cost','ebitda','ebit','netWorth','totalAssets','totalLiabilities','grossDebt','netDebt','cash','quote','payout']
    .reduce((sum, key) => sum + (Number.isFinite(p[key]) && p[key] !== 0 ? 1 : 0), 0);
}
function mergeFinancialPointObjects(a = null, b = null) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a, label: a.label || b.label, year: a.year || b.year, quarter: a.quarter || b.quarter };
  for (const key of ['netRevenue','netProfit','grossProfit','cost','ebitda','ebit','netWorth','totalAssets','totalLiabilities','grossDebt','netDebt','cash','quote','payout']) {
    if ((!Number.isFinite(out[key]) || out[key] === 0) && Number.isFinite(b[key]) && b[key] !== 0) out[key] = b[key];
  }
  return out;
}
function mergeFinancialPointLists(lists = []) {
  const map = new Map();
  for (const list of lists) {
    for (const point of list || []) {
      if (!point || !point.label) continue;
      const key = compactKey(point.label) || compactKey(point.year);
      const merged = mergeFinancialPointObjects(map.get(key), point);
      if (merged) map.set(key, merged);
    }
  }
  return sortByChartPeriod([...map.values()]
    .filter(p => pointCompleteness(p) > 0));
}
function mergeFinancialSourceList(list, preferred = '') {
  const normalized = [];
  for (const item of list || []) {
    const parsed = normalizeFinancialChart(item.value, preferred || fieldForFinancialSeries(item.key));
    if (Array.isArray(parsed) && parsed.length) normalized.push(parsed);
  }
  return mergeFinancialPointLists(normalized);
}
function mergeProfitVsQuoteSourceList(list) {
  const map = new Map();
  for (const item of list || []) {
    for (const point of normalizeProfitVsQuote(item.value) || []) {
      const label = text(point.label || point.year);
      if (!label) continue;
      const key = compactKey(label);
      const current = map.get(key) || { label, year: point.year || label, quote: null, profit: null };
      if ((current.quote == null || current.quote === 0) && Number.isFinite(point.quote) && point.quote !== 0) current.quote = point.quote;
      if ((current.profit == null || current.profit === 0) && Number.isFinite(point.profit) && point.profit !== 0) current.profit = point.profit;
      map.set(key, current);
    }
  }
  return sortByChartPeriod([...map.values()]
    .filter(p => (Number.isFinite(p.quote) && p.quote !== 0) || (Number.isFinite(p.profit) && p.profit !== 0))); 
}
function mergePayoutSourceList(list) {
  const map = new Map();
  for (const item of list || []) {
    for (const point of normalizePayout(item.value) || []) {
      const label = text(point.label || point.year);
      const value = parseNum(point.value ?? point.payout ?? point.percent ?? point.percentage);
      if (!label || value === null) continue;
      const key = compactKey(label);
      const current = map.get(key) || { label, year: point.year || label, value };
      if (!Number.isFinite(current.value) || current.value === 0) current.value = value;
      map.set(key, current);
    }
  }
  return sortByChartPeriod([...map.values()].filter(p => Number.isFinite(p.value)));
}
function firstPayload(list = []) {
  for (const item of list || []) if (item?.value) return item.value;
  return null;
}

function normalizeComparisonSources(list = [], ticker = '') {
  const out = [];
  for (const item of list) out.push(...normalizeComparison(item.value, ticker));
  return uniqBy(out, s => `${s.name}:${s.points.map(p => `${p.label}:${p.value}`).join('|')}`);
}

function extractFiiDistribution12mFromHtml(html = '') {
  const plain = stripTags(html);
  const idx = plain.search(/Distribuições\s+nos\s+últimos\s+12\s+meses/i);
  if (idx < 0) return [];
  const sec = plain.slice(idx, idx + 900);
  const re = /YIELD\s+(1\s*MÊS|3\s*MESES|6\s*MESES|12\s*MESES)\s+([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%\s+R\$\s*([\d.,]+)/gi;
  const out = [];
  let m;
  while ((m = re.exec(sec)) && out.length < 8) {
    out.push({ period: text(m[1]).replace(/\s+/g, ' '), yieldPercent: parseNum(`${m[2]}%`), amount: parseNum(m[3]), source: 'Investidor10HTML.distribuicoes12m' });
  }
  return out;
}


function normalizeAreaLabel(raw = '') {
  const value = text(raw).replace(/\s*\.\s*m²/i, ' m²').replace(/\s+/g, ' ').trim();
  return value || null;
}

function extractFiiPhysicalAssetsFromHtml(html = '') {
  const plain = stripTags(html);
  const idx = plain.search(/Lista\s+de\s+Imóveis/i);
  if (idx < 0) return [];
  const endRel = plain.slice(idx + 20).search(/hist[oó]rico\s+da\s+taxa\s+de\s+vac[aâ]ncia|COMUNICADOS|Informações\s+sobre\s+valor\s+patrimonial|Média\s+do\s+Tipo|Notícias\s+sobre|Dúvidas\s+comuns/i);
  const sec = plain.slice(idx, endRel > 0 ? idx + 20 + endRel : idx + 8200).replace(/\s+/g, ' ').trim();
  const out = [];
  const estados = [
    'São Paulo','Minas Gerais','Rio de Janeiro','Pernambuco','Bahia','Goiás','Santa Catarina','Paraná','Ceará','Amazonas','Pará','Espírito Santo','Distrito Federal','Rio Grande do Sul','Mato Grosso','Mato Grosso do Sul','Alagoas','Sergipe','Paraíba','Maranhão','Piauí','Rondônia','Roraima','Tocantins','Acre','Amapá','Rio Grande do Norte'
  ];
  const stateRe = new RegExp(`(?:^|\\s)(${estados.map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s+(\\d{1,4})(?=\\s+[A-ZÀ-Ú]|\\s*$)`, 'gi');
  let sm;
  while ((sm = stateRe.exec(sec)) && out.length < 40) {
    out.push({
      nome: text(sm[1]),
      estado: text(sm[1]),
      quantidade: Number(sm[2]),
      value: Number(sm[2]),
      tipo: 'estado',
      source: 'Investidor10HTML.listaImoveis.estado'
    });
  }
  const propertyPatterns = [
    /(?:^|\s)###\s+([^#]+?)\s+Estado:\s+([^#]+?)\s+Área\s+bruta\s+locável:\s+([^#]+?m²)/gi,
    /(?:^|\s)([A-Z0-9][A-ZÀ-Ú0-9&.,'’\-\s]{2,90}?)\s+Estado:\s+([A-ZÀ-Ú][A-Za-zÀ-ÿ\s]+?)\s+Área\s+bruta\s+locável:\s+([^#]+?m²)/gi,
  ];
  for (const re of propertyPatterns) {
    let m;
    while ((m = re.exec(sec)) && out.length < 160) {
      const nome = text(m[1])
        .replace(/^(Lista de Imóveis\s*)/i, '')
        .replace(/(?:^|\s)(?:São Paulo|Minas Gerais|Rio de Janeiro|Pernambuco|Bahia|Goiás|Santa Catarina|Paraná|Ceará|Amazonas|Pará|Espírito Santo|Distrito Federal|Rio Grande do Sul|Mato Grosso|Mato Grosso do Sul)\s+\d+\s+/gi, '')
        .trim();
      const estado = text(m[2]).replace(/Área\s+bruta\s+locável:.*$/i, '').trim();
      const area = normalizeAreaLabel(m[3]);
      if (!nome || /^Estado$/i.test(nome) || compactKey(nome).length < 3) continue;
      out.push({
        nome,
        estado: estado || null,
        area_bruta_locavel: area,
        tipo: 'imovel',
        source: 'Investidor10HTML.listaImoveis',
      });
    }
    if (out.some(x => x.tipo === 'imovel')) break;
  }
  return uniqBy(out, item => `${compactKey(item.tipo)}:${compactKey(item.nome)}:${compactKey(item.estado)}:${compactKey(item.area_bruta_locavel)}:${item.quantidade || ''}`);
}

function extractFiiAssetDistributionFromHtml(html = '') {
  const plain = stripTags(html);
  const idx = plain.search(/distribui(?:ç|c)[aã]o\s+de\s+ativos\s+do\s+fundo/i);
  if (idx < 0) return [];
  const endRel = plain.slice(idx + 20).search(/Notícias\s+sobre|COMUNICADOS|FIIs\s+Relacionad|Dúvidas\s+comuns|Informações\s+sobre/i);
  const sec = plain.slice(idx, endRel > 0 ? idx + 20 + endRel : idx + 1800).replace(/\s+/g, ' ').trim();
  const out = [];
  const patterns = [
    /(?:^|\s)(CRI|CRIs|FIIs?|Caixa|Cotas?|Im[oó]veis?|Renda\s+Fixa|LCI|Letras|Receb[ií]veis|Outros)\s+([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%/gi,
    /(?:^|\s)([A-Z0-9][A-Za-zÀ-ÿ0-9\s\-/]{2,40}?)\s+([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sec)) && out.length < 40) {
      const nome = text(m[1]).replace(/^##\s*/, '');
      const percentual = parseNum(`${m[2]}%`);
      if (!nome || percentual === null) continue;
      out.push({ nome, percentual, value: percentual, tipo: 'classe_ativo', source: 'Investidor10HTML.distribuicaoAtivosFundo' });
    }
    if (out.length) break;
  }
  return uniqBy(out, item => `${compactKey(item.nome)}:${item.percentual}`);
}

function escapeRegexLiteral(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionFromPlainText(plain = '', startRe, endRe, fallbackLength = 2400) {
  const start = plain.search(startRe);
  if (start < 0) return '';
  const tail = plain.slice(start);
  const end = tail.slice(20).search(endRe);
  return text(end > 0 ? tail.slice(0, 20 + end) : tail.slice(0, fallbackLength));
}

function extractSimpleInfoBlock(html = '', type = '') {
  const plain = stripTags(html);
  const startRe = type === 'FII'
    ? /INFORMAÇÕES\s+SOBRE\s+[A-Z0-9]+/i
    : /(?:DADOS\s+SOBRE\s+A\s+EMPRESA|INFORMAÇÕES\s+SOBRE\s+A\s+EMPRESA)/i;
  const endRe = type === 'FII'
    ? /HISTÓRICO\s+DE|COMPARAÇÃO\s+DE|COMPARANDO\s+COM|Checklist\s+do\s+investidor|Distribuições\s+nos/i
    : /Regiões\s+onde|negócios\s+que|POSIÇÃO\s+ACIONÁRIA|Receitas\s+e\s+Lucros|COMUNICADOS|Notícias\s+sobre/i;
  const sec = sectionFromPlainText(plain, startRe, endRe, 3600);
  if (!sec) return {};
  const known = [
    'Nome da Empresa','Ano de estreia na bolsa','Ano de fundação','Número de funcionários','Nº de Funcionários','Papéis da empresa',
    'Razão Social','CNPJ','PÚBLICO-ALVO','PÚBLICO ALVO','MANDATO','SEGMENTO','TIPO DE FUNDO','PRAZO DE DURAÇÃO','TIPO DE GESTÃO','TAXA DE ADMINISTRAÇÃO','VACÂNCIA','NUMERO DE COTISTAS','NÚMERO DE COTISTAS','COTAS EMITIDAS','VAL. PATRIMONIAL P/ COTA','VALOR PATRIMONIAL','ÚLTIMO RENDIMENTO',
    'Valor de mercado','Valor de firma','Patrimônio Líquido','Nº total de papeis','Nº total de papéis','Ativos','Ativo Circulante','Dívida Bruta','Dívida Líquida','Disponibilidade','Free Float','Tag Along','Liquidez Média Diária'
  ];
  const fields = {};
  const stopMarkers = [...known, 'DADOS SOBRE A EMPRESA', 'INFORMAÇÕES SOBRE A EMPRESA', 'Regiões onde gera receita', 'Receitas e Lucros'];
  const escapedKnown = stopMarkers.map(escapeRegexLiteral).join('|');
  for (const label of known) {
    const re = new RegExp(`${escapeRegexLiteral(label)}\\s+([^]+?)(?=${escapedKnown}|$)`, 'i');
    const m = sec.match(re);
    if (!m) continue;
    const value = text(m[1]).replace(/\s+/g, ' ').replace(/\s+(?:DADOS|INFORMAÇÕES)\s+SOBRE\s+A\s+EMPRESA\s*$/i, '').trim();
    if (value && value.length < 180 && !/^[-—–]+$/.test(value)) fields[label] = value;
  }
  return fields;
}


function splitCuratedSourceSentences(value = '', limit = 4) {
  const protectedText = text(value)
    .replace(/\bS\.A\./gi, 'S A')
    .replace(/\bS\/A\b/gi, 'S A')
    .replace(/\bLtda\./gi, 'Ltda')
    .replace(/\bS\.A\b/gi, 'S A');
  if (!protectedText) return [];
  const rawSentences = protectedText.match(/[^.!?]+[.!?]+/g) || [protectedText];
  return rawSentences
    .map(sentence => text(sentence))
    .map(sentence => sentence.replace(/\bS A\b/g, 'S.A.'))
    .map(sentence => sentence.replace(/^(?:SOBRE\s+A\s+EMPRESA|SOBRE\s+O\s+FUNDO|Informações\s+Adicionais)\s*/i, '').trim())
    .filter(sentence => sentence.length >= 38)
    .filter(sentence => !/recomenda(?:ç|c)[aã]o|preço justo|calculadora|radar de dividendos/i.test(sentence))
    .slice(0, limit);
}

function extractStockAdditionalPresentationParagraphs(plain = '') {
  const sec = sectionFromPlainText(
    plain,
    /Informações\s+Adicionais/i,
    /\*?Isso\s+n[ãa]o\s+[ée]\s+uma\s+recomenda(?:ç|c)[aã]o|DADOS\s+SOBRE\s+A\s+EMPRESA|INFORMAÇÕES\s+SOBRE\s+A\s+EMPRESA/i,
    1400
  );
  const cleaned = sec.replace(/^Informações\s+Adicionais\s*/i, '').trim();
  return splitCuratedSourceSentences(cleaned, 3);
}

function extractFiiNarrativePresentationSections(plain = '', ticker = '') {
  const tk = text(ticker).toUpperCase();
  const sections = [];
  const add = (title, sectionText, limit = 2) => {
    const cleaned = text(sectionText)
      .replace(new RegExp(`^(?:###?\\s*)?${escapeRegexLiteral(title)}\\s*`, 'i'), '')
      .replace(/^Sobre\s+a\s+/i, '')
      .replace(/^Estratégia\s+e\s+composição\s*/i, '')
      .replace(/^Diversificação\s+e\s+exposição\s*/i, '')
      .replace(/^Estrutura\s+do\s+fundo\s+e\s+taxas\s*/i, '')
      .trim();
    const paragraphs = splitCuratedSourceSentences(cleaned, limit);
    if (!paragraphs.length) return;
    sections.push({ title, paragraphs, text: paragraphs.join(' ') });
  };

  const sobre = sectionFromPlainText(
    plain,
    /(?:^|\s)(?:Sobre\s+a\s+|Sobre\s+o\s+fundo\s+)/i,
    /Estratégia\s+e\s+composição|Diversificação\s+e\s+exposição|Estrutura\s+do\s+fundo|Informações\s+Adicionais|Média\s+de\s+avaliações/i,
    1600
  );  add('Sobre o fundo', sobre, 2);

  const strategy = sectionFromPlainText(
    plain,
    /Estratégia\s+e\s+composição/i,
    /Diversificação\s+e\s+exposição|Estrutura\s+do\s+fundo|Informações\s+Adicionais|Média\s+de\s+avaliações/i,
    1800
  );
  add('Estratégia e composição', strategy, 2);

  const diversification = sectionFromPlainText(
    plain,
    /Diversificação\s+e\s+exposição/i,
    /Estrutura\s+do\s+fundo|Informações\s+Adicionais|Média\s+de\s+avaliações/i,
    1200
  );
  add('Diversificação e exposição', diversification, 2);

  const structure = sectionFromPlainText(
    plain,
    /Estrutura\s+do\s+fundo\s+e\s+taxas/i,
    /Informações\s+Adicionais|Média\s+de\s+avaliações|Isso\s+n[ãa]o\s+[ée]\s+uma\s+recomenda/i,
    1200
  );
  add('Estrutura e taxas', structure, 2);

  const additional = sectionFromPlainText(
    plain,
    /Informações\s+Adicionais/i,
    /Média\s+de\s+avaliações|Isso\s+n[ãa]o\s+[ée]\s+uma\s+recomenda|Lista\s+de\s+Imóveis/i,
    1500
  );
  add('Informações adicionais', additional, 2);

  const seen = new Set();
  return sections.map(section => {
    const paragraphs = section.paragraphs.filter(paragraph => {
      const key = compactKey(paragraph);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { ...section, paragraphs, text: paragraphs.join(' ') };
  }).filter(section => section.paragraphs.length).slice(0, 5);
}

function extractFiiSupplementaryInfoFromHtml(html = '', ticker = '') {
  const plain = stripTags(html);
  const out = {};
  const put = (label, value) => {
    const clean = text(value);
    if (label && clean && clean !== '-' && clean !== '--') out[label] = clean;
  };
  const match = (re) => plain.match(re)?.[1];
  put('DY atual', match(/DY\s+atual:\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?%?)/i));
  put('DY médio em 5 anos', match(/DY\s+m[eé]dio\s+em\s+5\s+anos:\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?%?)/i));
  const total12m = plain.match(new RegExp(`${escapeRegexLiteral(text(ticker).toUpperCase())}\\s+pagou\\s+o\\s+total\\s+de\\s+(R\\$\\s*[\\d.,]+)\\s+nos\\s+últimos\\s+12\\s+meses`, 'i')) || plain.match(/pagou\s+o\s+total\s+de\s+(R\$\s*[\d.,]+)\s+nos\s+últimos\s+12\s+meses/i);
  put('Total pago 12 meses', total12m?.[1]);
  const mediaMensal = plain.match(/m[eé]dia\s+mensal\s+de\s+(R\$\s*[\d.,]+)/i);
  put('Média mensal 12 meses', mediaMensal?.[1]);
  const patrimonial = sectionFromPlainText(plain, /Informações\s+sobre\s+valor\s+patrimonial/i, /Notícias\s+sobre|Dúvidas\s+comuns|FIIs\s+Relacionados|Média\s+do\s+Tipo/i, 1200);
  put('Valor patrimonial por cota', patrimonial.match(/VALOR\s+PATRIMONIAL\s+POR\s+COTA\s+(R\$\s*[\d.,]+)/i)?.[1]);
  put('Valor da cota', patrimonial.match(/VALOR\s+DA\s+COTA\s+(R\$\s*[\d.,]+)/i)?.[1]);
  put('Número de cotas', patrimonial.match(/N[ÚU]MERO\s+DE\s+COTAS\s+([\d.,]+\s*(?:Milh(?:ões|oes)|Bilhões|Bilhoes|Mil)?)/i)?.[1]);
  put('P/VP', patrimonial.match(/P\/VP\s+([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i)?.[1]);
  put('Valor patrimonial', patrimonial.match(/VALOR\s+PATRIMONIAL\s+(R\$\s*[\d.,]+\s*(?:Milh(?:ões|oes)|Bilhões|Bilhoes|Trilh(?:ões|oes)|Mil)?)/i)?.[1]);
  return out;
}

function extractAssetPresentationFromHtml(html = '', ticker = '', type = '', info = {}) {
  const plain = stripTags(html);
  const tk = text(ticker).toUpperCase();
  const isFii = type === 'FII';
  const paragraphs = [];
  const narrativeSections = isFii ? extractFiiNarrativePresentationSections(plain, tk) : [];
  if (isFii) {
    for (const section of narrativeSections) {
      for (const value of section.paragraphs) {
        if (!paragraphs.some(existing => compactKey(existing) === compactKey(value))) paragraphs.push(value);
        if (paragraphs.length >= 5) break;
      }
      if (paragraphs.length >= 5) break;
    }
  } else {
    const sobre = sectionFromPlainText(
      plain,
      /SOBRE\s+A\s+EMPRESA/i,
      /Quanto\s+aos\s+seus\s+principais\s+indicadores|DADOS\s+SOBRE\s+A\s+EMPRESA|INFORMAÇÕES\s+SOBRE\s+A\s+EMPRESA|Regiões\s+onde|Receitas\s+e\s+Lucros|COMUNICADOS/i,
      3200
    );
    let cleaned = sobre.replace(/^SOBRE\s+A\s+EMPRESA\s*/i, '').replace(/Quanto\s+aos\s+seus\s+principais\s+indicadores.*$/i, '').trim();
    const duplicatedHeading = cleaned.toUpperCase().lastIndexOf('SOBRE A EMPRESA');
    if (duplicatedHeading >= 0) cleaned = cleaned.slice(duplicatedHeading + 'SOBRE A EMPRESA'.length).trim();
    cleaned = cleaned.split(/Informações\s+Adicionais/i)[0].trim();
    for (const value of splitCuratedSourceSentences(cleaned, 3)) {
      if (!paragraphs.some(existing => compactKey(existing) === compactKey(value))) paragraphs.push(value);
      if (paragraphs.length >= 3) break;
    }
  }
  const fieldHighlights = Object.entries(info || {})
    .map(([label, value]) => ({ label: text(label), value: text(value) }))
    .filter(item => item.label && item.value && item.value.length < 180)
    .slice(0, isFii ? 8 : 6);
  const additionalParagraphs = isFii ? [] : extractStockAdditionalPresentationParagraphs(plain);
  for (const paragraph of additionalParagraphs) {
    if (!paragraphs.some(existing => compactKey(existing) === compactKey(paragraph))) paragraphs.push(paragraph);
  }
  let summary = isFii ? text(paragraphs.slice(0, 2).join(' ')) : text(paragraphs.slice(0, 2).join(' '));
  if (!summary && isFii && fieldHighlights.length) {
    const byNorm = new Map(fieldHighlights.map(item => [compactKey(item.label), item.value]));
    const razao = byNorm.get('razaosocial') || byNorm.get('nomedaempresa') || tk;
    const tipo = byNorm.get('tipodefundo');
    const segmento = byNorm.get('segmento');
    const mandato = byNorm.get('mandato');
    summary = [razao, tipo, segmento ? `segmento ${segmento}` : '', mandato ? `mandato ${mandato}` : '']
      .filter(Boolean)
      .join(' • ');
  }
  if (!summary && fieldHighlights.length) {
    const title = fieldHighlights.find(x => /nome|razão|razao/i.test(x.label))?.value || tk;
    const detail = fieldHighlights.find(x => /fundação|funcion|segmento|setor/i.test(x.label))?.value;
    summary = [title, detail].filter(Boolean).join(' • ');
  }
  if (!summary && !fieldHighlights.length) return null;
  return {
    title: isFii ? `Apresentação do fundo ${tk}` : `Apresentação da empresa ${tk}`,
    summary: text(summary).slice(0, isFii ? 520 : 720),
    paragraphs,
    highlights: fieldHighlights,
    fields: info || {},
    sections: narrativeSections,
    source: paragraphs.length ? 'Investidor10HTML.sobreAtivo' : 'Investidor10HTML.infoAtivo',
    policy: paragraphs.length ? 'literal-profile-paragraphs-from-source' : 'source-field-summary-no-synthetic-market-data'
  };
}


function normalizeI10Date(value = '') {
  const raw = text(value);
  const m = raw.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!m) return '';
  let [, dd, mm, yy] = m;
  let year = Number(yy);
  if (yy.length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
  const month = Number(mm);
  const day = Number(dd);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDividendValue(value = '') {
  const raw = text(value).replace(/^R\$\s*/i, '').trim();
  if (!raw) return null;
  if (/^-?\d{1,3}(?:\.\d{3})*,\d+$/.test(raw) || /^-?\d+,\d+$/.test(raw)) {
    const n = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 1e8) / 1e8 : null;
  }
  if (/^-?\d+\.\d+$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n * 1e8) / 1e8 : null;
  }
  return parseNum(raw);
}

function extractCurrentPriceFromHtml(html = '', ticker = '') {
  const plain = stripTags(html);
  const tk = text(ticker).toUpperCase();
  const aroundTicker = tk ? plain.slice(Math.max(0, plain.toUpperCase().indexOf(tk) - 200), Math.max(0, plain.toUpperCase().indexOf(tk)) + 800) : plain.slice(0, 1200);
  const candidates = [
    aroundTicker.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:[,.][0-9]+)?)(?=\s*(?:Cotação|Cotacao|Atual|P\/L|P\/VP|DY|Dividend))/i)?.[1],
    aroundTicker.match(/(?:Cotação|Cotacao|Preço|Preco)\s*(?:atual)?\s*R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:[,.][0-9]+)?)/i)?.[1],
    plain.match(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})(?=\s*(?:P\/L|P\/VP|DY|Cotação))/i)?.[1]
  ].filter(Boolean);
  for (const c of candidates) {
    const n = parseDividendValue(c);
    if (n !== null && n > 0 && n < 1000000) return n;
  }
  return null;
}

function extractDividendHistoryFromHtml(html = '', ticker = '', type = '') {
  const plain = stripTags(html);
  const upperTicker = text(ticker).toUpperCase();
  const start = plain.search(/Hist[óo]rico\s+de\s+(?:Dividendos|Rendimentos|Proventos)|\b[A-Z0-9]{4,6}\s+DIVIDENDOS\b/i);
  if (start < 0 && !/\bTipo\s+Data\s+Com\s+Pagamento\s+Valor\b/i.test(plain)) return [];
  const base = start >= 0 ? plain.slice(start) : plain;
  const endRel = base.slice(80).search(/Preço\s+Justo|Rentabilidade\s+de|COMPARAÇÃO|COMPARANDO|INDICADORES|Já\s+tem\s+uma\s+carteira|Resumo|Comentários/i);
  const sec = base.slice(0, endRel > 0 ? 80 + endRel : 14000).replace(/\s+/g, ' ').trim();
  const typePattern = '(JSCP|JCP|Dividendos?|Rendimentos?|Amortiza(?:ç|c)[aã]o|Red\\.?\\s*Cap\\.?|Redu(?:ç|c)[aã]o\\s+de\\s+Capital|Bonifica(?:ç|c)[aã]o)';
  const date = '(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})';
  const payment = `(${date}|Provisionad[oa](?:\\s+[A-ZÇÃÕÉÍÓÚa-zçãõéíóú]+){0,3}|A\\s+definir|Não\\s+informado|Nao\\s+informado|-)`;
  const value = '(?:R\\$\\s*)?([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]+|[0-9]+,[0-9]+|[0-9]+\\.[0-9]+)';
  const patterns = [
    new RegExp(`${typePattern}\\s+${date}\\s+${payment}\\s+${value}`, 'gi'),
    new RegExp(`${date}\\s+${typePattern}\\s+${value}\\s+${upperTicker || '[A-Z0-9]{4,6}'}(?:\\s+Data\\s+Com\\s+${date})?(?:\\s+Pgto\\s+${payment})?`, 'gi')
  ];
  const out = [];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(sec)) && out.length < 600) {
      let kind, dataComRaw, payRaw, valueRaw;
      if (m[1] && /^(JSCP|JCP|Dividend|Rendimento|Amort|Red|Bonif)/i.test(m[1])) {
        kind = m[1];
        dataComRaw = m[2];
        payRaw = m[6] || m[3] || '';
        valueRaw = m[m.length - 1];
      } else {
        dataComRaw = m[1]; kind = m[2]; valueRaw = m[3]; payRaw = m[5] || '';
      }
      const valueNum = parseDividendValue(valueRaw);
      const dataCom = normalizeI10Date(dataComRaw);
      const paymentDate = normalizeI10Date(payRaw);
      if (!upperTicker || valueNum === null || !dataCom) continue;
      const provisioned = /provisionad|definir|informad|^-$/i.test(payRaw || '');
      out.push({
        ticker: upperTicker,
        asset: upperTicker,
        symbol: upperTicker,
        assetClass: type === 'FII' ? 'FII' : 'ACAO',
        type: text(kind),
        kind: text(kind),
        value: valueNum,
        valuePerShare: valueNum,
        amountPerShare: valueNum,
        currency: 'BRL',
        dataCom,
        dateCom: dataCom,
        paymentDate,
        payDate: paymentDate,
        paymentRaw: text(payRaw),
        status: paymentDate ? 'confirmado' : (provisioned ? 'provisionado' : 'anunciado'),
        source: 'Investidor10HTML.assetDividendHistory',
        sourceVersion: VALORAE_I10_CHART_EXTRACTOR_VERSION,
      });
    }
  }
  return uniqBy(out, ev => `${ev.ticker}|${ev.assetClass}|${ev.type}|${ev.dataCom}|${ev.paymentDate}|${ev.valuePerShare}`).sort((a,b)=>String(a.paymentDate || a.dataCom).localeCompare(String(b.paymentDate || b.dataCom)));
}

function buildDividendAggregatesFromEvents(events = [], currentPrice = null) {
  const byYear = new Map();
  const byMonth = new Map();
  for (const ev of events || []) {
    const date = ev.paymentDate || ev.dataCom || ev.dateCom || '';
    const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const value = parseDividendValue(ev.valuePerShare ?? ev.value ?? ev.amountPerShare);
    if (!m || value === null) continue;
    const year = m[1];
    const month = `${m[2]}/${m[1]}`;
    byYear.set(year, (byYear.get(year) || 0) + value);
    byMonth.set(month, (byMonth.get(month) || 0) + value);
  }
  const yearly = [...byYear.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([year, total]) => ({ label: 'Anual', year, value: total, display: `R$ ${total.toFixed(4)}`, source: 'Investidor10HTML.assetDividendHistory' }));
  const monthly = [...byMonth.entries()].sort(([a],[b]) => {
    const [ma, ya] = a.split('/'); const [mb, yb] = b.split('/');
    return `${ya}-${ma}`.localeCompare(`${yb}-${mb}`);
  }).map(([period, total]) => ({ label: 'Mensal', period, value: total, display: `R$ ${total.toFixed(4)}`, source: 'Investidor10HTML.assetDividendHistory' }));
  // Não calcular histórico de DY com cotação atual. Esse cálculo é derivado e pode parecer
  // série histórica real no APK. Mantemos apenas somas de proventos extraídas da fonte.
  return { yearly, monthly, dividendYieldHistory: [] };
}

function buildCoverage({ html = '', type = '', available = {}, extras = {} } = {}) {
  const defs = type === 'FII' ? FII_EXPECTED_CHARTS : (type === 'ETF' ? ETF_EXPECTED_CHARTS : COMPANY_EXPECTED_CHARTS);
  const presence = extractSectionPresence(html, defs);
  const checks = presence.map(item => {
    const hasData = Boolean(
      available[item.key] ||
      (item.key === 'profitability' && available.profitability) ||
      (item.key === 'equityEvolution' && available.balanceSheet) ||
      (item.key === 'fundamentalIndicatorHistory' && (extras.historicoIndicadoresFii || available.fundamentalIndicatorHistory)) ||
      (item.key === 'distribution12m' && Array.isArray(extras.fiiDistribution12m) && extras.fiiDistribution12m.length) ||
      (item.key === 'fiiInfo' && extras.info && Object.keys(extras.info).length) ||
      (item.key === 'revenueRegion' && extras.revenueGeography) ||
      (item.key === 'revenueBusiness' && extras.revenueSegment) ||
      (item.key === 'fiiAssetDistribution' && (available.fiiAssetDistribution || pointCount(extras.fiiAssetDistribution))) ||
      (item.key === 'incomeStatement' && available.incomeStatement) ||
      (item.key === 'cashFlowStatement' && available.cashFlowStatement)
    );
    return {
      ...item,
      captured: hasData,
      status: hasData ? 'captured' : (item.presentInHtml ? 'visible_without_series_yet' : 'not_visible_for_asset'),
      reason: hasData ? '' : (item.presentInHtml ? 'Bloco existe no Investidor10; série depende de API interna/HTML dinâmico. O Proxy mantém status explícito e não fabrica dados.' : 'Bloco não foi localizado no HTML recebido para este ativo.'),
    };
  });
  const visible = checks.filter(x => x.presentInHtml).length;
  const captured = checks.filter(x => x.presentInHtml && x.captured).length;
  const requiredCaptured = checks.filter(x => x.required && x.presentInHtml && x.captured).map(x => x.key);
  const requiredMissing = checks
    .filter(x => x.required && x.presentInHtml && !x.captured)
    .map(x => ({ key: x.key, title: x.title, reason: x.reason }));
  const notApplicable = checks.filter(x => !x.presentInHtml && !x.captured).map(x => x.key);
  const warnings = requiredMissing.map(x => `${x.title}: ${x.reason}`);
  return {
    version: VALORAE_I10_CHART_EXTRACTOR_VERSION,
    policy: 'canonical-investidor10-no-synthetic-chart-data',
    requiredCaptured,
    requiredMissing,
    notApplicable,
    warnings,
    summary: { visible, captured, totalExpected: checks.length, requiredCaptured, requiredMissing: requiredMissing.map(x => x.key), notApplicable },
    checks,
  };
}

export function buildInvestidor10CanonicalCharts({ ticker = '', type = '', html = '', apiExtras = {} } = {}) {
  const ids = extractInvestidor10ChartIds(html);
  const discoveredApiUrls = discoverInvestidor10ChartApiUrls(html, ticker, type);
  const profitability = extractProfitabilityFromHtml(html);
  const charts = apiExtras.chartsFinanceiros || {};
  const rawJson = apiExtras.rawJson || {};
  const grouped = sourcesByRole(apiExtras);
  const htmlDividendHistory = extractDividendHistoryFromHtml(html, ticker, type);
  const currentPriceFromHtml = extractCurrentPriceFromHtml(html, ticker);
  const htmlDividendAggregates = buildDividendAggregatesFromEvents(htmlDividendHistory, currentPriceFromHtml);

  const comparisonSources = [
    apiExtras.embedded?.rentabilidadeChart,
    rawJson.comparacaoIndices, rawJson.indexComparison, rawJson.comparadorIndices, rawJson.comparison, rawJson.compare, rawJson.comparadorFiis,
    charts.comparacaoIndices, charts.indexComparison,
    ...(grouped.get('indexComparison') || []).map(x => x.value),
  ].filter(Boolean).map((value, i) => ({ key: `index_${i}`, value }));
  const indexComparison = normalizeComparisonSources(comparisonSources, ticker);
  const commodityComparison = normalizeComparisonSources([...(grouped.get('commodityComparison') || [])], ticker);

  const revenueProfitSources = [
    ...collectionValues({ receitasLucros: charts.receitasLucros, revenueProfit: charts.revenueProfit, rawReceitasLucros: rawJson.receitasLucros, rawRevenueProfit: rawJson.revenueProfit }),
    ...(grouped.get('revenueProfit') || []),
  ].filter(x => x.value);
  const profitVsQuoteSources = [
    ...collectionValues({ lucroCotacao: charts.lucroCotacao, profitVsQuote: charts.profitVsQuote, rawLucroCotacao: rawJson.lucroCotacao, rawProfitVsQuote: rawJson.profitVsQuote }),
    ...(grouped.get('profitVsQuote') || []),
  ].filter(x => x.value);
  const balanceSources = [
    ...collectionValues({ evolucaoPatrimonio: charts.evolucaoPatrimonio, balanceSheet: charts.balanceSheet, balancoPatrimonial: charts.balancoPatrimonial, rawEvolucaoPatrimonio: rawJson.evolucaoPatrimonio, rawBalanceSheet: rawJson.balanceSheet }),
    ...(grouped.get('balanceSheet') || []),
  ].filter(x => x.value);
  const payoutSources = [
    ...collectionValues({ payoutHistorico: charts.payoutHistorico, payoutHistory: charts.payoutHistory, rawPayoutHistorico: rawJson.payoutHistorico, rawPayoutHistory: rawJson.payoutHistory }),
    ...(grouped.get('payoutHistory') || []),
  ].filter(x => x.value);
  const incomeStatementSources = [
    ...collectionValues({ resultados: charts.resultados, incomeStatement: charts.incomeStatement, dre: charts.dre, rawResultados: rawJson.resultados, rawIncomeStatement: rawJson.incomeStatement, rawDre: rawJson.dre }),
    ...(grouped.get('incomeStatement') || []),
  ].filter(x => x.value);
  const cashFlowSources = [
    ...collectionValues({ fluxoCaixa: charts.fluxoCaixa, cashFlow: charts.cashFlow, cashFlowStatement: charts.cashFlowStatement, rawFluxoCaixa: rawJson.fluxoCaixa, rawCashFlow: rawJson.cashFlow, rawCashFlowStatement: rawJson.cashFlowStatement }),
    ...(grouped.get('cashFlowStatement') || []),
  ].filter(x => x.value);

  const equitySources = [
    ...collectionValues({ evolucaoPatrimonio: charts.evolucaoPatrimonio, equityEvolution: charts.equityEvolution, rawEvolucaoPatrimonio: rawJson.evolucaoPatrimonio, rawEquityEvolution: rawJson.equityEvolution }),
    ...(grouped.get('equityEvolution') || []),
  ].filter(x => x.value);
  const balanceSheet = mergeFinancialSourceList(balanceSources, '');
  const equityEvolutionRaw = mergeFinancialSourceList(equitySources, '');
  const equityEvolution = mergeFinancialPointLists([equityEvolutionRaw, balanceSheet]);
  const revenueRegionSources = [
    ...collectionValues({ embeddedRegion: apiExtras.embedded?.revenueGeography, rawRevenueGeography: rawJson.revenueGeography, rawRevenueByRegion: rawJson.revenueByRegion, rawRegioesReceita: rawJson.regioesReceita, chartRevenueGeography: charts.revenueGeography, chartRevenueByRegion: charts.revenueByRegion }),
    ...(grouped.get('revenueRegion') || []),
  ].filter(x => x.value);
  const revenueBusinessSources = [
    ...collectionValues({ embeddedBusiness: apiExtras.embedded?.revenueSegment, rawRevenueSegment: rawJson.revenueSegment, rawRevenueByBusiness: rawJson.revenueByBusiness, rawNegociosReceita: rawJson.negociosReceita, chartRevenueSegment: charts.revenueSegment, chartRevenueByBusiness: charts.revenueByBusiness }),
    ...(grouped.get('revenueBusiness') || []),
  ].filter(x => x.value);
  const revenueGeography = firstPayload(revenueRegionSources);
  const revenueSegment = firstPayload(revenueBusinessSources);
  const financial = {
    revenueProfit: mergeFinancialSourceList(revenueProfitSources, ''),
    profitVsQuote: mergeProfitVsQuoteSourceList(profitVsQuoteSources),
    equityEvolution: equityEvolution.length ? equityEvolution : balanceSheet,
    balanceSheet,
    payoutHistory: mergePayoutSourceList(payoutSources),
    incomeStatement: mergeFinancialSourceList(incomeStatementSources, ''),
    cashFlowStatement: mergeFinancialSourceList(cashFlowSources, ''),
  };

  const fiiDistribution12m = extractFiiDistribution12mFromHtml(html);
  const baseInfo = extractSimpleInfoBlock(html, type);
  const supplementaryInfo = type === 'FII' ? extractFiiSupplementaryInfoFromHtml(html, ticker) : {};
  const info = { ...baseInfo, ...supplementaryInfo };
  const presentation = extractAssetPresentationFromHtml(html, ticker, type, info);
  const fiiPeerComparison = normalizeComparisonSources([
    ...(grouped.get('peerComparison') || []),
    ...collectionValues({ peerComparison: rawJson.peerComparison, comparadorFiis: rawJson.comparadorFiis }).filter(x => x.value),
  ], ticker);
  const fundamentalIndicatorHistory = firstNonEmpty([
    ...collectionValues({
      historicoIndicadoresFii: apiExtras.historicoIndicadoresFii,
      rawHistoricoIndicadoresFii: rawJson.historicoIndicadoresFii,
      rawHistoricoIndicadores: rawJson.historicoIndicadores,
      rawIndicatorHistory: rawJson.indicatorHistory,
      rawHistoricalIndicators: rawJson.historicalIndicators
    }).filter(x => x.value),
    ...(grouped.get('fundamentalIndicatorHistory') || []),
  ], v => v);
  const fiiFundamentalIndicatorHistory = type === 'FII' ? fundamentalIndicatorHistory : null;
  const apiDividendYieldHistory = firstNonEmpty([
    ...collectionValues({ dividendYieldHistory: rawJson.dividendYieldHistory, dyHistory: rawJson.dyHistory }).filter(x => x.value),
    ...(grouped.get('dividendYieldHistory') || []),
  ], v => v);
  const apiDividendHistory = firstNonEmpty([
    ...collectionValues({ dividendHistory: rawJson.dividendHistory, dividendos: rawJson.dividendos, proventos: rawJson.proventos }).filter(x => x.value),
    ...(grouped.get('dividendHistory') || []),
  ], v => v);
  const canonicalDividendHistory = htmlDividendHistory.length ? htmlDividendHistory : apiDividendHistory;
  const canonicalDividendYieldHistory = pointCount(apiDividendYieldHistory) ? apiDividendYieldHistory : [];
  const htmlPhysicalAssets = extractFiiPhysicalAssetsFromHtml(html);
  const htmlAssetDistribution = extractFiiAssetDistributionFromHtml(html);
  const fiiPhysicalAssets = firstNonEmpty([
    ...collectionValues({ physicalAssets: rawJson.physicalAssets, listaImoveis: rawJson.listaImoveis, imoveis: rawJson.imoveis }).filter(x => x.value),
    ...(grouped.get('physicalAssets') || []),
    { key: 'htmlPhysicalAssets', value: htmlPhysicalAssets },
  ], v => v);
  const fiiAssetDistribution = firstNonEmpty([
    ...collectionValues({ distribuicaoAtivosFundo: rawJson.distribuicaoAtivosFundo, distribuicaoAtivos: rawJson.distribuicaoAtivos, assetDistribution: rawJson.assetDistribution, assetAllocation: rawJson.assetAllocation, fundAssetDistribution: rawJson.fundAssetDistribution, ativosFundo: rawJson.ativosFundo }).filter(x => x.value),
    ...(grouped.get('fiiAssetDistribution') || []),
    { key: 'htmlAssetDistribution', value: htmlAssetDistribution },
  ], v => v);
  const available = {
    priceHistory: false,
    profitability: Boolean(profitability?.nominal?.length || profitability?.real?.length),
    indexComparison: indexComparison.length > 0,
    commodityComparison: commodityComparison.length > 0,
    revenueProfit: financial.revenueProfit.length > 0,
    profitVsQuote: financial.profitVsQuote.length > 0,
    balanceSheet: financial.balanceSheet.length > 0,
    equityEvolution: financial.equityEvolution.length > 0,
    payoutHistory: financial.payoutHistory.length > 0,
    incomeStatement: financial.incomeStatement.length > 0,
    cashFlowStatement: financial.cashFlowStatement.length > 0,
    fundamentalIndicatorHistory: Boolean(fundamentalIndicatorHistory || apiExtras.historicoIndicadoresFii || pointCount(fiiFundamentalIndicatorHistory) || (grouped.get('fundamentalIndicatorHistory') || []).length),
    peerComparison: Boolean(fiiPeerComparison.length || (grouped.get('peerComparison') || []).length || rawJson.comparadorFiis),
    distribution12m: fiiDistribution12m.length > 0,
    dividendYieldHistory: Boolean(pointCount(canonicalDividendYieldHistory) || (grouped.get('dividendYieldHistory') || []).length),
    dividendHistory: Boolean((Array.isArray(canonicalDividendHistory) && canonicalDividendHistory.length) || pointCount(canonicalDividendHistory) || (grouped.get('dividendHistory') || []).length),
    physicalAssets: Boolean(pointCount(fiiPhysicalAssets) || htmlPhysicalAssets.length || /Lista\s+de\s+Imóveis|Área\s+bruta\s+locável/i.test(html)),
    fiiAssetDistribution: Boolean(pointCount(fiiAssetDistribution) || htmlAssetDistribution.length || /distribui(?:ç|c)[aã]o\s+de\s+ativos\s+do\s+fundo/i.test(html)),
    fiiInfo: Object.keys(info).length > 0,
    revenueRegion: Boolean(revenueGeography),
    revenueBusiness: Boolean(revenueSegment),
    presentation: Boolean(presentation?.summary),
  };
  const extras = {
    historicoIndicadoresFii: apiExtras.historicoIndicadoresFii,
    fiiDistribution12m,
    fiiPeerComparison,
    fiiFundamentalIndicatorHistory,
    fiiDividendYieldHistory: canonicalDividendYieldHistory,
    fiiDividendHistory: canonicalDividendHistory,
    fiiPhysicalAssets,
    fiiAssetDistribution,
    info,
    supplementaryInfo,
    presentation,
    revenueGeography,
    revenueSegment,
  };
  const coverage = buildCoverage({ html, type, available, extras });
  return {
    version: VALORAE_I10_CHART_EXTRACTOR_VERSION,
    ticker: text(ticker).toUpperCase(),
    type,
    source: 'Investidor10.canonicalCharts',
    extractionPolicy: 'no-synthetic-fallbacks-for-investidor10-charts',
    ids,
    discoveredApiUrls,
    available,
    coverage,
    profitability,
    indexComparison,
    commodityComparison,
    dividendHistory: canonicalDividendHistory,
    dividendMonthly: htmlDividendAggregates.monthly,
    dividendYearly: htmlDividendAggregates.yearly,
    dividendYieldHistory: canonicalDividendYieldHistory,
    currentPriceFromHtml,
    supplementaryInfo,
    presentation,
    profilePresentation: presentation,
    description: presentation?.summary || '',
    financial,
    revenueGeography: revenueGeography || null,
    revenueSegment: revenueSegment || null,
    revenueByRegion: revenueGeography || null,
    revenueByBusiness: revenueSegment || null,
    revenueBreakdowns: {
      geography: revenueGeography || null,
      region: revenueGeography || null,
      byRegion: revenueGeography || null,
      business: revenueSegment || null,
      byBusiness: revenueSegment || null,
      sourceTrace: apiExtras.embedded?.revenueBreakdownSources || null,
    },
    fii: type === 'FII' ? {
      distribution12m: fiiDistribution12m,
      info,
      supplementaryInfo,
      patrimonialSummary: supplementaryInfo,
      presentation,
      profilePresentation: presentation,
      description: presentation?.summary || '',
      peerComparison: fiiPeerComparison,
      fundamentalIndicatorHistory: fiiFundamentalIndicatorHistory,
      dividendYieldHistory: canonicalDividendYieldHistory,
      dividendHistory: canonicalDividendHistory,
      dividendMonthly: htmlDividendAggregates.monthly,
      dividendYearly: htmlDividendAggregates.yearly,
      physicalAssets: fiiPhysicalAssets,
      assetDistribution: fiiAssetDistribution,
    } : undefined,
    company: type !== 'FII' ? { info, presentation, profilePresentation: presentation, description: presentation?.summary || '', fundamentalIndicatorHistory, dividendHistory: canonicalDividendHistory, dividendMonthly: htmlDividendAggregates.monthly, dividendYearly: htmlDividendAggregates.yearly, dividendYieldHistory: canonicalDividendYieldHistory } : undefined,
    sourceDiagnostics: {
      apiStatus: apiExtras.apiStatus || [],
      groupedRoles: Object.fromEntries([...grouped.entries()].map(([k, v]) => [k, v.map(x => x.key)])),
    },
  };
}
