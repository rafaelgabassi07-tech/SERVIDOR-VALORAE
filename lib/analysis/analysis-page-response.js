import { RELEASE } from '../core/release.js';
import { buildAnalysisConsumerContract, normalizeAnalysisSurfaceId, getAnalysisSurface } from './analysis-surface-contract.js';
import { formatBrDate, normalizeDate } from '../core/dates.js';

const CONTRACT_VERSION = '26.analysis.v2';

const STOCK_INDICATORS = [
  { id: 'pl', label: 'P/L', group: 'Valuation', aliases: ['pl', 'p_l', 'pL', 'P/L'] },
  { id: 'pegRatio', label: 'PEG Ratio', group: 'Valuation', aliases: ['pegRatio', 'peg', 'PEG Ratio', 'PEG'] },
  { id: 'psr', label: 'P/Receita (PSR)', group: 'Valuation', aliases: ['psr', 'pReceitaPsr', 'pReceita', 'P/Receita (PSR)'] },
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'pVP', 'P/VP'] },
  { id: 'dividendYield', label: 'Dividend Yield', group: 'Dividendos', aliases: ['dividendYield', 'dy', 'yield12m', 'Dividend Yield', 'DY'] },
  { id: 'payout', label: 'Payout', group: 'Dividendos', aliases: ['payout', 'Payout'] },
  { id: 'margemLiquida', label: 'Margem Líquida', group: 'Margens', aliases: ['margemLiquida', 'Margem Líquida'] },
  { id: 'margemBruta', label: 'Margem Bruta', group: 'Margens', aliases: ['margemBruta', 'Margem Bruta'] },
  { id: 'margemEbit', label: 'Margem Ebit', group: 'Margens', aliases: ['margemEbit', 'Margem Ebit'] },
  { id: 'margemEbitda', label: 'Margem Ebitda', group: 'Margens', aliases: ['margemEbitda', 'Margem Ebitda'] },
  { id: 'evEbitda', label: 'EV/Ebitda', group: 'Múltiplos', aliases: ['evEbitda', 'EV/Ebitda'] },
  { id: 'evEbit', label: 'EV/Ebit', group: 'Múltiplos', aliases: ['evEbit', 'EV/Ebit'] },
  { id: 'pEbitda', label: 'P/Ebitda', group: 'Múltiplos', aliases: ['pEbitda', 'P/Ebitda'] },
  { id: 'pEbit', label: 'P/Ebit', group: 'Múltiplos', aliases: ['pEbit', 'P/Ebit'] },
  { id: 'pAtivo', label: 'P/Ativo', group: 'Balanço', aliases: ['pAtivo', 'P/Ativo'] },
  { id: 'pCapGiro', label: 'P/Cap.Giro', group: 'Balanço', aliases: ['pCapGiro', 'P/Cap.Giro', 'P/Cap Giro'] },
  { id: 'pAtivoCircLiq', label: 'P/Ativo Circ. Liq.', group: 'Balanço', aliases: ['pAtivoCircLiq', 'P/Ativo Circ. Liq.', 'P/Ativo Circ Liq'] },
  { id: 'vpa', label: 'VPA', group: 'Por ação', aliases: ['vpa', 'VPA'] },
  { id: 'lpa', label: 'LPA', group: 'Por ação', aliases: ['lpa', 'LPA'] },
  { id: 'giroAtivos', label: 'Giro Ativos', group: 'Eficiência', aliases: ['giroAtivos', 'Giro Ativos'] },
  { id: 'roe', label: 'ROE', group: 'Rentabilidade', aliases: ['roe', 'ROE'] },
  { id: 'roic', label: 'ROIC', group: 'Rentabilidade', aliases: ['roic', 'ROIC'] },
  { id: 'roa', label: 'ROA', group: 'Rentabilidade', aliases: ['roa', 'ROA'] },
  { id: 'dividaLiquidaPatrimonio', label: 'Dívida Líquida / Patrimônio', group: 'Dívida', aliases: ['dividaLiquidaPatrimonio', 'Dívida Líquida / Patrimônio'] },
  { id: 'dividaLiquidaEbitda', label: 'Dívida Líquida / Ebitda', group: 'Dívida', aliases: ['dividaLiquidaEbitda', 'Dívida Líquida / Ebitda'] },
  { id: 'dividaLiquidaEbit', label: 'Dívida Líquida / Ebit', group: 'Dívida', aliases: ['dividaLiquidaEbit', 'Dívida Líquida / Ebit'] },
  { id: 'dividaBrutaPatrimonio', label: 'Dívida Bruta / Patrimônio', group: 'Dívida', aliases: ['dividaBrutaPatrimonio', 'Dívida Bruta / Patrimônio'] },
  { id: 'patrimonioAtivos', label: 'Patrimônio / Ativos', group: 'Estrutura', aliases: ['patrimonioAtivos', 'Patrimônio / Ativos'] },
  { id: 'passivosAtivos', label: 'Passivos / Ativos', group: 'Estrutura', aliases: ['passivosAtivos', 'Passivos / Ativos'] },
  { id: 'liquidezCorrente', label: 'Liquidez Corrente', group: 'Liquidez', aliases: ['liquidezCorrente', 'Liquidez Corrente'] },
  { id: 'cagrReceitas5Anos', label: 'CAGR Receitas 5 anos', group: 'Crescimento', aliases: ['cagrReceitas5Anos', 'CAGR Receitas 5 anos'] },
  { id: 'cagrLucros5Anos', label: 'CAGR Lucros 5 anos', group: 'Crescimento', aliases: ['cagrLucros5Anos', 'CAGR Lucros 5 anos'] }
];

const PERCENT_IDS = new Set([
  'dividendYield', 'payout', 'margemLiquida', 'margemBruta', 'margemEbit', 'margemEbitda',
  'roe', 'roic', 'roa', 'patrimonioAtivos', 'passivosAtivos', 'cagrReceitas5Anos', 'cagrLucros5Anos'
]);

const MONEY_IDS = new Set(['vpa', 'lpa']);

const STOCK_HISTORICAL_INDICATORS = [
  { id: 'pl', label: 'P/L', group: 'Valuation', aliases: ['pl', 'p_l', 'p/l', 'preco lucro', 'preço lucro'] },
  { id: 'pegRatio', label: 'PEG Ratio', group: 'Valuation', aliases: ['peg ratio', 'peg'] },
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'p/vp', 'preco valor patrimonial', 'preço valor patrimonial'] },
  { id: 'dividendYield', label: 'Dividend Yield', group: 'Dividendos', unit: '%', aliases: ['dividend yield', 'dy', 'yield', 'dy 12m'] },
  { id: 'roe', label: 'ROE', group: 'Rentabilidade', unit: '%', aliases: ['roe', 'retorno sobre patrimonio', 'retorno sobre patrimônio'] },
  { id: 'roic', label: 'ROIC', group: 'Rentabilidade', unit: '%', aliases: ['roic', 'retorno sobre capital investido'] },
  { id: 'margemLiquida', label: 'Margem Líquida', group: 'Margens', unit: '%', aliases: ['margem liquida', 'margem líquida', 'net margin'] },
  { id: 'margemBruta', label: 'Margem Bruta', group: 'Margens', unit: '%', aliases: ['margem bruta', 'gross margin'] },
  { id: 'margemEbit', label: 'Margem EBIT', group: 'Margens', unit: '%', aliases: ['margem ebit', 'margem operacional'] },
  { id: 'margemEbitda', label: 'Margem EBITDA', group: 'Margens', unit: '%', aliases: ['margem ebitda'] },
  { id: 'dividaLiquidaPatrimonio', label: 'Dívida Líquida / Patrimônio', group: 'Dívida', aliases: ['divida liquida patrimonio', 'dívida líquida patrimônio', 'divida liquida / patrimonio'] },
  { id: 'dividaLiquidaEbitda', label: 'Dívida Líquida / EBITDA', group: 'Dívida', aliases: ['divida liquida ebitda', 'dívida líquida ebitda', 'dl ebitda'] },
  { id: 'liquidezCorrente', label: 'Liquidez Corrente', group: 'Liquidez', aliases: ['liquidez corrente', 'current ratio'] },
  { id: 'cagrReceitas5Anos', label: 'Crescimento de Receita', group: 'Crescimento', unit: '%', aliases: ['cagr receitas 5 anos', 'cagr receita 5 anos', 'crescimento receita', 'crescimento de receita'] },
  { id: 'cagrLucros5Anos', label: 'Crescimento de Lucro', group: 'Crescimento', unit: '%', aliases: ['cagr lucros 5 anos', 'cagr lucro 5 anos', 'crescimento lucro', 'crescimento de lucro'] }
];

const FII_HISTORICAL_INDICATORS = [
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'p/vp'] },
  { id: 'dividendYield', label: 'Dividend Yield', group: 'Rendimentos', unit: '%', aliases: ['dividend yield', 'dy', 'yield', 'dy 12m'] },
  { id: 'vacanciaFisica', label: 'Vacância', group: 'Portfólio', unit: '%', aliases: ['vacancia', 'vacância', 'vacancia fisica', 'vacância física'] },
  { id: 'valorPatrimonialCota', label: 'Valor Patrimonial por Cota', group: 'Patrimônio', unit: 'R$', aliases: ['valor patrimonial por cota', 'vp por cota', 'valor patrimonial cota', 'val patrimonial p cota'] },
  { id: 'rendimentoPorCota', label: 'Rendimento por Cota', group: 'Rendimentos', unit: 'R$', aliases: ['rendimento por cota', 'ultimo rendimento', 'último rendimento', 'rendimento'] },
  { id: 'numeroCotistas', label: 'Número de Cotistas', group: 'Base de cotistas', aliases: ['numero de cotistas', 'número de cotistas', 'cotistas'] },
  { id: 'liquidezMediaDiaria', label: 'Liquidez', group: 'Liquidez', unit: 'R$', aliases: ['liquidez', 'liquidez media diaria', 'liquidez média diária', 'liquidez diaria'] }
];


const FINANCIAL_STATEMENT_GROUPS = [
  {
    id: 'income_statement',
    title: 'DRE',
    aliases: ['incomeStatement', 'dre', 'demonstracaoResultado', 'demonstraçãoResultado', 'resultado', 'resultados', 'statementIncome', 'receitasLucros', 'receitas_lucros', 'receitaLiquidaChart'],
    metrics: [
      { id: 'netRevenue', label: 'Receita líquida', unit: 'R$', aliases: ['netRevenue', 'receitaLiquida', 'receita líquida', 'receita', 'revenue', 'receita operacional liquida'] },
      { id: 'grossProfit', label: 'Lucro bruto', unit: 'R$', aliases: ['grossProfit', 'lucroBruto', 'lucro bruto'] },
      { id: 'ebit', label: 'EBIT', unit: 'R$', aliases: ['ebit', 'lucro operacional', 'resultado operacional'] },
      { id: 'ebitda', label: 'EBITDA', unit: 'R$', aliases: ['ebitda'] },
      { id: 'netProfit', label: 'Lucro líquido', unit: 'R$', aliases: ['netProfit', 'lucroLiquido', 'lucro líquido', 'lucro', 'netIncome', 'profit'] }
    ]
  },
  {
    id: 'balance_sheet',
    title: 'Balanço',
    aliases: ['balanceSheet', 'balancoPatrimonial', 'balançoPatrimonial', 'balanco', 'balanço', 'balance', 'evolucaoPatrimonio', 'evolucao_patrimonio', 'ativosPassivos', 'ativos_passivos'],
    metrics: [
      { id: 'totalAssets', label: 'Ativos', unit: 'R$', aliases: ['totalAssets', 'ativos', 'ativoTotal', 'assets'] },
      { id: 'totalLiabilities', label: 'Passivos', unit: 'R$', aliases: ['totalLiabilities', 'passivos', 'passivoTotal', 'liabilities'] },
      { id: 'netWorth', label: 'Patrimônio líquido', unit: 'R$', aliases: ['netWorth', 'equity', 'patrimonioLiquido', 'patrimônio líquido', 'plContabil'] },
      { id: 'grossDebt', label: 'Dívida bruta', unit: 'R$', aliases: ['grossDebt', 'dividaBruta', 'dívida bruta'] },
      { id: 'netDebt', label: 'Dívida líquida', unit: 'R$', aliases: ['netDebt', 'dividaLiquida', 'dívida líquida'] },
      { id: 'cash', label: 'Caixa', unit: 'R$', aliases: ['cash', 'caixa', 'disponibilidades', 'caixaEquivalentes'] }
    ]
  },
  {
    id: 'cash_flow',
    title: 'Fluxo de Caixa',
    aliases: ['cashFlowStatement', 'fluxoCaixa', 'fluxo de caixa', 'cashFlow', 'fcf', 'fluxosCaixa', 'fluxo_caixa', 'cash_flow'],
    metrics: [
      { id: 'operatingCashFlow', label: 'Fluxo operacional', unit: 'R$', aliases: ['operatingCashFlow', 'fluxoOperacional', 'fluxo operacional', 'caixaOperacional', 'cfo'] },
      { id: 'investingCashFlow', label: 'Fluxo de investimento', unit: 'R$', aliases: ['investingCashFlow', 'fluxoInvestimento', 'fluxo de investimento', 'caixaInvestimento', 'cfi'] },
      { id: 'financingCashFlow', label: 'Fluxo de financiamento', unit: 'R$', aliases: ['financingCashFlow', 'fluxoFinanciamento', 'fluxo de financiamento', 'caixaFinanciamento', 'cff'] }
    ]
  }
];


function cleanText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'object') {
    return cleanText(value.display || value.fmt || value.value || value.raw || value.text || value.label || '');
  }
  return String(value).trim();
}

function norm(value) {
  return cleanText(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\/+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function unitMultiplierFromText(text = '') {
  const normalized = norm(text);
  if (!normalized) return 1;
  if (/\b(trilhao|trilhoes|tri|t)\b/.test(normalized) || /\d\s*(tri|t)$/.test(normalized)) return 1_000_000_000_000;
  if (/\b(bilhao|bilhoes|bi|b)\b/.test(normalized) || /\d\s*(bi|b)$/.test(normalized)) return 1_000_000_000;
  if (/\b(milhao|milhoes|mi|m)\b/.test(normalized) || /\d\s*(mi|m)$/.test(normalized)) return 1_000_000;
  if (/\b(mil|k)\b/.test(normalized) || /\d\s*k$/.test(normalized) || /\d\s*mil$/.test(normalized)) return 1_000;
  return 1;
}

function numberFrom(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value && typeof value === 'object') return numberFrom(value.raw ?? value.value ?? value.valor ?? value.amount ?? value.fmt ?? value.formatted ?? value.display);
  const original = cleanText(value);
  if (!original || original === '--' || original === '-') return undefined;

  const multiplier = unitMultiplierFromText(original);
  let raw = original
    .replace(/R\$/gi, '')
    .replace(/US\$/gi, '')
    .replace(/%/g, '')
    .replace(/trilh(?:a|ã)o(?:es|ões)?|trilh(?:a|ã)o|trilhoes|trilhões|tri|bilh(?:a|ã)o(?:es|ões)?|bilh(?:a|ã)o|bilhoes|bilhões|mi(?:lh(?:a|ã)o(?:es|ões)?|lh(?:a|ã)o)?|milhoes|milhões|milh(?:a|ã)o|mil|[KMBT]/gi, '')
    .trim();
  if (!raw) return undefined;

  // Preserve only the numeric core. This handles source strings such as
  // "R$ 1,25 bilhão", "3.400,8 milhões", "2.5B" and "950 mil".
  const numericMatch = raw.match(/[+-]?\d[\d.\s]*,?\d*|[+-]?\d[\d,\s]*\.?\d*/);
  if (!numericMatch) return undefined;
  raw = numericMatch[0].replace(/\s+/g, '');

  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n * multiplier : undefined;
}

function brl(value) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function decimalDisplay(value, digits = 2) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

function percentDisplay(value) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  const adjusted = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(adjusted)}%`;
}

function rawField(payload, aliases = []) {
  for (const key of aliases) {
    const direct = payload?.[key];
    if (direct !== undefined && direct !== null && cleanText(direct) !== '' && cleanText(direct) !== '0') return direct;
    const indicators = payload?.indicators?.[key] ?? payload?.fundamentals?.[key] ?? payload?.fundamentos?.[key] ?? payload?.indicadoresAvancados?.[key] ?? payload?.results?.[key] ?? payload?.results?.indicadores?.[key] ?? payload?.results?.indicadoresFundamentalistas?.semComparativos?.[key];
    if (indicators !== undefined && indicators !== null && cleanText(indicators) !== '' && cleanText(indicators) !== '0') return indicators;
    const normalized = payload?.normalized?.[key] ?? payload?.appPayload?.metrics?.canonical?.[key] ?? payload?.appMobileSnapshot?.metrics?.[key];
    if (normalized !== undefined && normalized !== null && cleanText(normalized) !== '' && cleanText(normalized) !== '0') return normalized;
  }
  return undefined;
}

function indicatorCards(payload = {}) {
  const cards = [];
  const candidates = [
    payload?.assetChartBundle?.indicatorCards,
    payload?.assetChartsMobile?.indicatorCards,
    payload?.results?.assetChartBundle?.indicatorCards,
    payload?.results?.assetChartsMobile?.indicatorCards,
  ];
  for (const arr of candidates) if (Array.isArray(arr)) cards.push(...arr);
  return cards;
}

function displayFromCard(payload, spec) {
  const wanted = new Set([spec.label, ...(spec.aliases || [])].map(norm));
  for (const card of indicatorCards(payload)) {
    const label = cleanText(card?.label || card?.name || card?.key);
    if (!wanted.has(norm(label))) continue;
    const display = cleanText(card.display || card.valueDisplay || card.value);
    if (display && display !== '0') return { value: display, source: card.source || 'StatusInvest/Investidor10', raw: card.value };
  }
  return null;
}

function displayForSpec(payload, spec) {
  const fromCard = displayFromCard(payload, spec);
  if (fromCard?.value) return fromCard;
  const raw = rawField(payload, spec.aliases || [spec.id]);
  if (raw === undefined) return null;
  const display = MONEY_IDS.has(spec.id) ? brl(raw) : (PERCENT_IDS.has(spec.id) ? percentDisplay(raw) : decimalDisplay(raw));
  return display ? { value: display, source: 'StatusInvest/Investidor10', raw } : null;
}

function computeTwelveMonthVariation(payload = {}) {
  const explicit = rawField(payload, ['variacao12m', 'variation12m', 'change12m', 'valorizacao12m']);
  if (explicit !== undefined) return percentDisplay(explicit);
  const points = payload?.assetChartBundle?.priceHistory || payload?.assetChartsMobile?.priceHistory || payload?.results?.historicoPrecos || payload?.results?.priceHistory || [];
  if (!Array.isArray(points) || points.length < 2) return '';
  const clean = points.map(p => ({ date: p.date || p.timestamp || p.time || '', value: numberFrom(p.close ?? p.price ?? p.value) }))
    .filter(p => p.value !== undefined && p.value > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (clean.length < 2) return '';
  const first = clean[0].value;
  const last = clean[clean.length - 1].value;
  if (!(first > 0) || !(last > 0)) return '';
  return percentDisplay(((last / first) - 1) * 100);
}

function buildSummaryItems(payload = {}, assetType = '') {
  const isFii = String(assetType).toUpperCase() === 'FII';
  const price = brl(payload.currentPrice ?? payload.price ?? payload.precoAtual ?? payload.quote?.price ?? payload.quote?.currentPrice ?? payload.results?.precoAtual);
  const variation12m = computeTwelveMonthVariation(payload);
  const pl = displayForSpec(payload, STOCK_INDICATORS[0])?.value || '';
  const pvp = displayForSpec(payload, STOCK_INDICATORS[2])?.value || '';
  const dy = displayForSpec(payload, STOCK_INDICATORS[3])?.value || '';
  const rows = [
    { id: 'price', label: isFii ? 'Cotação da cota' : 'Cotação', value: price, group: 'Resumo', source: 'VALORAE Proxy' },
    { id: 'variation_12m', label: 'Variação 12M', value: variation12m, group: 'Resumo', source: 'Histórico real do Proxy' },
    ...(isFii ? [] : [{ id: 'pl', label: 'P/L', value: pl, group: 'Valuation', source: 'StatusInvest/Investidor10' }]),
    { id: 'pvp', label: 'P/VP', value: pvp, group: 'Valuation', source: 'StatusInvest/Investidor10' },
    { id: 'dy', label: isFii ? 'DY 12M' : 'DY', value: dy, group: 'Dividendos', source: 'StatusInvest/Investidor10' }
  ];
  return rows.filter(item => cleanText(item.value));
}

function buildFundamentalItems(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() === 'FII') {
    const fiiSpecs = STOCK_INDICATORS.filter(s => ['pvp', 'dividendYield'].includes(s.id));
    return fiiSpecs.map(spec => {
      const found = displayForSpec(payload, spec);
      return found?.value ? { id: spec.id, label: spec.label === 'Dividend Yield' ? 'DY 12M' : spec.label, value: found.value, group: spec.group, source: found.source } : null;
    }).filter(Boolean);
  }
  return STOCK_INDICATORS.map(spec => {
    const found = displayForSpec(payload, spec);
    return found?.value ? { id: spec.id, label: spec.label, value: found.value, group: spec.group, source: found.source } : null;
  }).filter(Boolean);
}


function dateLabel(value = '') {
  const raw = cleanText(value);
  if (!raw) return '';
  const extracted = extractDateCandidate(raw);
  if (!extracted) return '';
  const yearMonth = extracted.match(/^(\d{4})[-/.](\d{1,2})(?![-/.]\d)/);
  if (yearMonth) return `${String(yearMonth[2]).padStart(2, '0')}/${yearMonth[1]}`;
  const monthYear = extracted.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (monthYear) return `${String(monthYear[1]).padStart(2, '0')}/${monthYear[2]}`;
  const iso = normalizeDate(extracted);
  if (iso) return formatBrDate(iso, iso);
  return extracted.slice(0, 10);
}

function extractDateCandidate(value = '') {
  const raw = cleanText(value);
  if (!raw) return '';
  const named = raw.match(/\b\d{1,2}\s+de\s+[a-zçãé]{3,12}\s+de\s+\d{4}\b/i);
  if (named) return named[0];
  const isoFull = raw.match(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/);
  if (isoFull) return isoFull[0];
  const brFull = raw.match(/\b\d{1,2}[-/.]\d{1,2}[-/.](?:\d{2}|\d{4})\b/);
  if (brFull) return brFull[0];
  const isoMonth = raw.match(/\b\d{4}[-/.]\d{1,2}\b/);
  if (isoMonth) return isoMonth[0];
  const brMonth = raw.match(/\b\d{1,2}[-/.]\d{4}\b/);
  if (brMonth) return brMonth[0];
  const yearOnly = raw.match(/\b(?:19|20)\d{2}\b/);
  if (yearOnly) return yearOnly[0];
  return raw;
}

function dividendDateSortKey(value = '') {
  const candidate = extractDateCandidate(value);
  if (!candidate) return '';
  const iso = normalizeDate(candidate);
  if (iso) return iso.replace(/-/g, '');
  let m = candidate.match(/^(\d{4})[-/.](\d{1,2})(?![-/.]\d)/);
  if (m) return `${m[1]}${String(m[2]).padStart(2, '0')}01`;
  m = candidate.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[2]}${String(m[1]).padStart(2, '0')}01`;
  m = candidate.match(/^(?:19|20)\d{2}$/);
  if (m) return `${candidate}0101`;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10).replace(/-/g, '') : '';
}

function moneyPerShare(value) {
  const n = numberFrom(value);
  if (n === undefined || n <= 0) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(n);
}

function dividendEvents(payload = {}) {
  const candidatePaths = [
    'dividends', 'proventos', 'historicoDividendos', 'dividendHistory', 'dividendEvents',
    'events', 'historyEvents', 'upcomingEvents', 'receivedEvents', 'futureEvents',
    'results.dividends', 'results.proventos', 'results.historicoDividendos', 'results.dividendHistory',
    'results.dividendEvents', 'results.events', 'results.historyEvents', 'results.upcomingEvents',
    'results.dividendos', 'results.dividendos.historico', 'results.dividendos.history', 'results.dividendos.events',
    'results.proventos.historico', 'results.proventos.history', 'results.proventos.events',
    'assetChartBundle.dividendEvents', 'assetChartBundle.dividendMonthly', 'assetChartBundle.dividendYearly',
    'assetChartsMobile.dividendEvents', 'assetChartsMobile.dividendMonthly', 'assetChartsMobile.dividendYearly',
    'appMobileSnapshot.assetChartBundle.dividendEvents', 'appMobileSnapshot.assetChartBundle.dividendMonthly',
    'appMobileSnapshot.assetChartsMobile.dividendEvents', 'appMobileSnapshot.assetChartsMobile.dividendMonthly',
    'results.assetChartBundle.dividendEvents', 'results.assetChartBundle.dividendMonthly',
    'results.assetChartsMobile.dividendEvents', 'results.assetChartsMobile.dividendMonthly',
    'sections.dividendos.historico', 'sections.dividendos.history', 'sections.dividendos.events', 'sections.dividendos.canonicalHistory',
    'sections.dividends.history', 'sections.dividends.events', 'sections.dividends.canonicalHistory',
    'results.sections.dividendos.historico', 'results.sections.dividendos.history', 'results.sections.dividendos.events', 'results.sections.dividendos.canonicalHistory',
    'results.sections.dividends.history', 'results.sections.dividends.events', 'results.sections.dividends.canonicalHistory',
    'dividendStats.history', 'results.dividendStats.history'
  ];
  const events = [];
  for (const path of candidatePaths) {
    const candidate = valueAtPath(payload, path);
    const normalized = arrayFrom(candidate);
    if (normalized.length) events.push(...normalized);
  }
  const unique = new Map();
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const amount = numberFrom(
      event.valuePerShare ?? event.grossValuePerShare ?? event.netValuePerShare ??
      event.amount ?? event.value ?? event.valor ?? event.valorProvento ?? event.provento ?? event.rendimento
    );
    const referenceDate = cleanText(
      event.referenceDate || event.period || event.periodo || event.competence || event.competencia ||
      event.month || event.mes || event.label || event.name || event.nome || event.date || event.data
    );
    const paymentDate = cleanText(
      event.paymentDate || event.payDate || event.dataPagamento || event.data_pagamento || event.pagamento ||
      event.pgto || event.dataPgto || event.datePayment || event.payment || event.paidAt || referenceDate ||
      event.date || event.data
    );
    const comDate = cleanText(
      event.dateCom || event.comDate || event.dataCom || event.data_com || event.dataBase || event.baseDate ||
      event.recordDate || event.eligibilityDate || event.exDate || event.dataEx || event.com || event.decisionDate ||
      event.dataAprovacao || event.dataDeclaracao || event.exDividendDate || event.dataExDividendo || referenceDate
    );
    const kind = cleanText(event.dividendType || event.kind || event.type || event.tipo || event.event || event.status || 'Provento') || 'Provento';
    if (!(amount > 0) && !paymentDate && !comDate && !referenceDate) continue;
    const key = [paymentDate || referenceDate, comDate || referenceDate, kind, amount || 0].join('|');
    if (!unique.has(key)) unique.set(key, { ...event, amount, paymentDate, comDate, referenceDate, kind });
  }
  return [...unique.values()].sort((a, b) => {
    const ak = dividendDateSortKey(a.paymentDate || a.comDate || a.referenceDate || a.period || a.month || a.label);
    const bk = dividendDateSortKey(b.paymentDate || b.comDate || b.referenceDate || b.period || b.month || b.label);
    return String(bk || '').localeCompare(String(ak || ''));
  });
}

function buildDividendSummaryItems(payload = {}, assetType = '') {
  const events = dividendEvents(payload);
  if (!events.length) return [];
  const last = events.find(e => Date.parse(e.paymentDate || e.comDate || '') <= Date.now()) || events[0];
  const total12m = events
    .filter(e => {
      const t = Date.parse(e.paymentDate || e.comDate || '');
      return Number.isFinite(t) && t >= Date.now() - 366 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, e) => sum + (numberFrom(e.amount) || 0), 0);
  const dy = displayForSpec(payload, STOCK_INDICATORS[3])?.value || '';
  const rows = [
    { id: 'last_dividend', label: assetType === 'FII' ? 'Último rendimento' : 'Último provento', value: moneyPerShare(last?.amount), group: cleanText(last?.kind) || 'Provento', source: 'StatusInvest proventos' },
    { id: 'last_payment_date', label: 'Último pagamento', value: dateLabel(last?.paymentDate), group: cleanText(last?.kind) || 'Provento', source: 'StatusInvest proventos' },
    { id: 'dy_12m', label: assetType === 'FII' ? 'DY 12M' : 'DY', value: dy, group: 'Dividendos', source: 'StatusInvest/Investidor10' },
    { id: 'paid_12m_per_share', label: 'Pago 12M por cota/ação', value: total12m > 0 ? moneyPerShare(total12m) : '', group: `${events.length} evento(s)`, source: 'StatusInvest proventos' }
  ];
  return rows.filter(item => cleanText(item.value));
}

function buildDividendHistoryItems(payload = {}) {
  return dividendEvents(payload).slice(0, 36).map((event, index) => {
    const reference = dateLabel(event.referenceDate || event.period || event.periodo || event.month || event.mes || event.label);
    const payment = dateLabel(event.paymentDate || event.payDate || event.datePayment || event.dataPagamento || event.date || event.data) || reference;
    const com = dateLabel(event.comDate || event.dateCom || event.dataCom || event.eligibilityDate || event.exDate || event.dataEx);
    const kind = cleanText(event.kind || event.dividendType || event.type || 'Provento') || 'Provento';
    const amount = moneyPerShare(event.amount ?? event.valuePerShare ?? event.grossValuePerShare ?? event.value);
    const labelParts = [payment ? `Pagamento ${payment}` : '', reference ? `Competência ${reference}` : ''].filter(Boolean);
    return amount ? {
      id: `dividend_${index + 1}`,
      label: labelParts.join(' • ') || kind,
      value: amount,
      group: [kind, com ? `Data com ${com}` : '', reference ? `Competência ${reference}` : ''].filter(Boolean).join(' • '),
      source: cleanText(event.source || event.rawProvider || event.provider || 'StatusInvest proventos normalizados')
    } : null;
  }).filter(Boolean);
}

const DIVIDEND_RADAR_MONTHS = [
  { id: 'jan', label: 'Jan', number: 1 },
  { id: 'fev', label: 'Fev', number: 2 },
  { id: 'mar', label: 'Mar', number: 3 },
  { id: 'abr', label: 'Abr', number: 4 },
  { id: 'mai', label: 'Mai', number: 5 },
  { id: 'jun', label: 'Jun', number: 6 },
  { id: 'jul', label: 'Jul', number: 7 },
  { id: 'ago', label: 'Ago', number: 8 },
  { id: 'set', label: 'Set', number: 9 },
  { id: 'out', label: 'Out', number: 10 },
  { id: 'nov', label: 'Nov', number: 11 },
  { id: 'dez', label: 'Dez', number: 12 }
];

const DIVIDEND_RADAR_MONTH_ALIASES = new Map([
  ['jan', 1], ['janeiro', 1], ['january', 1],
  ['fev', 2], ['fevereiro', 2], ['feb', 2], ['february', 2],
  ['mar', 3], ['marco', 3], ['março', 3], ['march', 3],
  ['abr', 4], ['abril', 4], ['apr', 4], ['april', 4],
  ['mai', 5], ['maio', 5], ['may', 5],
  ['jun', 6], ['junho', 6], ['june', 6],
  ['jul', 7], ['julho', 7], ['july', 7],
  ['ago', 8], ['agosto', 8], ['aug', 8], ['august', 8],
  ['set', 9], ['setembro', 9], ['sep', 9], ['sept', 9], ['september', 9],
  ['out', 10], ['outubro', 10], ['oct', 10], ['october', 10],
  ['nov', 11], ['novembro', 11], ['november', 11],
  ['dez', 12], ['dezembro', 12], ['dec', 12], ['december', 12]
]);

function monthNumberFromName(value = '') {
  const normalized = norm(value);
  if (!normalized) return null;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (DIVIDEND_RADAR_MONTH_ALIASES.has(token)) return DIVIDEND_RADAR_MONTH_ALIASES.get(token);
  }
  for (const [name, number] of DIVIDEND_RADAR_MONTH_ALIASES.entries()) {
    if (normalized === name || normalized.startsWith(`${name} `) || normalized.includes(` ${name} `) || normalized.endsWith(` ${name}`)) return number;
  }
  return null;
}

function explicitMonthNumberFromEvent(event = {}) {
  const candidates = [
    event.monthNumber, event.month_number, event.numeroMes, event.mesNumero, event.mes_numero,
    event.monthIndex, event.month_index, event.mesIndex, event.mes_index
  ];
  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n)) {
      const adjusted = n >= 0 && n <= 11 && /index/i.test(String(Object.keys(event).find(k => event[k] === candidate) || '')) ? n + 1 : n;
      if (adjusted >= 1 && adjusted <= 12) return adjusted;
    }
  }
  return null;
}

function monthNumberFromDate(value = '') {
  const raw = cleanText(value);
  if (!raw) return null;
  const named = monthNumberFromName(raw);
  if (named) return named;
  const br = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})/);
  if (br) {
    const month = Number(br[2]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const iso = raw.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})/);
  if (iso) {
    const month = Number(iso[2]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const yearMonth = raw.match(/^(\d{4})[\/.-](\d{1,2})(?:\b|$)/);
  if (yearMonth) {
    const month = Number(yearMonth[2]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const monthYear = raw.match(/^(\d{1,2})[\/.-](\d{4})(?:\b|$)/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    return month >= 1 && month <= 12 ? month : null;
  }
  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).getUTCMonth() + 1;
  return null;
}

function buildDividendRadarItems(payload = {}, assetType = '', ticker = '') {
  if (!supportsDividendRadarAssetType(assetType)) return [];
  const events = dividendEvents(payload);
  const comMonthCounts = new Map();
  const paymentMonthCounts = new Map();
  for (const event of events) {
    const explicitMonth = explicitMonthNumberFromEvent(event);
    const comMonth = monthNumberFromDate(event.comDate || event.dateCom || event.dataCom || event.eligibilityDate || event.exDate || event.recordDate || event.dataBase);
    const paymentMonth = monthNumberFromDate(event.paymentDate || event.payDate || event.dataPagamento || event.pagamento || event.date || event.data || event.referenceDate || event.period || event.periodo || event.label || event.month || event.mes || event.name) || explicitMonth;
    if (comMonth) comMonthCounts.set(comMonth, (comMonthCounts.get(comMonth) || 0) + 1);
    if (paymentMonth) paymentMonthCounts.set(paymentMonth, (paymentMonthCounts.get(paymentMonth) || 0) + 1);
  }
  const items = [];
  const symbol = cleanText(ticker || payload.ticker || payload.symbol).toUpperCase();
  const historyLabel = events.length
    ? `Com base no histórico de proventos${symbol ? ` da ${symbol}` : ''}, o Radar de Dividendos Inteligente projeta quais os possíveis meses de pagamentos de proventos no futuro.`
    : `Ainda não há histórico suficiente de proventos${symbol ? ` da ${symbol}` : ''} para marcar meses prováveis. O radar será preenchido quando o Proxy receber eventos com Data Com ou pagamento.`;
  items.push({
    id: 'radar_summary',
    label: 'Resumo',
    value: historyLabel,
    group: 'Resumo',
    source: 'Investidor10/StatusInvest proventos normalizados'
  });
  for (const month of DIVIDEND_RADAR_MONTHS) {
    const count = comMonthCounts.get(month.number) || 0;
    items.push({
      id: `radar_com_${month.id}`,
      label: month.label,
      value: count > 0 ? `Provável${count > 1 ? ` (${count})` : ''}` : (events.length ? 'Sem padrão' : 'Sem histórico'),
      group: 'Data Com',
      source: count > 0 ? `Histórico de datas-com com ${count} ocorrência(s)` : 'Histórico de datas-com de proventos'
    });
  }
  for (const month of DIVIDEND_RADAR_MONTHS) {
    const count = paymentMonthCounts.get(month.number) || 0;
    items.push({
      id: `radar_pagamento_${month.id}`,
      label: month.label,
      value: count > 0 ? `Provável${count > 1 ? ` (${count})` : ''}` : (events.length ? 'Sem padrão' : 'Sem histórico'),
      group: 'Data Pagamento',
      source: count > 0 ? `Histórico de pagamentos com ${count} ocorrência(s)` : 'Histórico de datas de pagamento de proventos'
    });
  }
  return items;
}


function arrayFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.entries(value).map(([label, raw]) => ({ label, value: raw, raw }));
  return [];
}

function objectFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pickArray(payload = {}, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], payload);
    const arr = arrayFrom(value);
    if (arr.length) return arr;
  }
  return [];
}

function pickObject(payload = {}, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], payload);
    const obj = objectFrom(value);
    if (Object.keys(obj).length) return obj;
  }
  return {};
}

function finiteValue(value) {
  const n = numberFrom(value);
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

function compactDisplay(value) {
  const n = finiteValue(value);
  if (n === undefined) return cleanText(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${decimalDisplay(n / 1_000_000_000, 2)} bi`;
  if (abs >= 1_000_000) return `${decimalDisplay(n / 1_000_000, 2)} mi`;
  if (abs >= 1_000) return `${decimalDisplay(n / 1_000, 2)} mil`;
  return decimalDisplay(n, 2);
}

function chartPoint(row = {}, valueKeys = ['value', 'close', 'price']) {
  const label = chartPointLabel(row);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  return { label: label.slice(0, 24), value, display: cleanText(row.display || row.valueDisplay || row.formatted) || compactDisplay(value) };
}

function chartPointLabel(row = {}) {
  const generic = new Set(['mensal', 'anual', 'mes', 'mês', 'ano', 'periodo', 'período', 'total', 'valor']);
  const label = cleanText(row.label);
  const namedLabel = label && !generic.has(label.toLowerCase()) ? label : '';
  const candidates = [
    row.date, row.data, row.paymentDate, row.payDate, row.datePayment, row.dataPagamento,
    row.referenceDate, row.competence, row.competencia, row.period, row.periodo, row.month, row.mes,
    row.year, row.ano, row.timestamp, row.time, row.x, namedLabel, row.name, row.nome
  ];
  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) return extractDateCandidate(text) || text;
  }
  return label;
}

function displayForIndexedSeries(row = {}, keys = [], fallbackValue) {
  const displayKeys = keys.flatMap(key => [`${key}Display`, `${key}_display`, `${key}Fmt`, `${key}_fmt`]);
  for (const key of displayKeys) {
    const value = cleanText(row?.[key]);
    if (value) return value;
  }
  return compactDisplay(fallbackValue);
}

function indexedDualSeriesChart(id, title, rows = [], source = 'VALORAE Proxy', left = {}, right = {}, options = {}) {
  const normalized = arrayFrom(rows).slice(-14);
  const minPoints = options.minPoints || 2;
  const leftRaw = normalized.map(row => ({ row, point: chartPoint(row, left.valueKeys || ['value', 'price', 'quote']) })).filter(x => x.point);
  const rightRaw = normalized.map(row => ({ row, point: chartPoint(row, right.valueKeys || ['secondaryValue', 'profit', 'lucro']) })).filter(x => x.point);
  const leftByPeriod = new Map(leftRaw.map(x => [x.point.label, x]));
  const rightByPeriod = new Map(rightRaw.map(x => [x.point.label, x]));
  const periods = [...leftByPeriod.keys()].filter(label => rightByPeriod.has(label));
  if (periods.length < minPoints) return null;
  const aligned = periods.map(label => ({ label, left: leftByPeriod.get(label), right: rightByPeriod.get(label) }));
  const baseLeft = aligned.find(item => item.left.point.value !== 0)?.left.point.value;
  const baseRight = aligned.find(item => item.right.point.value !== 0)?.right.point.value;
  if (!Number.isFinite(baseLeft) || !Number.isFinite(baseRight) || baseLeft === 0 || baseRight === 0) return null;
  const leftPoints = aligned.map(item => ({
    label: item.label,
    value: Number(((item.left.point.value / baseLeft) * 100).toFixed(4)),
    display: displayForIndexedSeries(item.left.row, left.valueKeys || ['quote'], item.left.point.value),
    rawValue: item.left.point.value
  }));
  const rightPoints = aligned.map(item => ({
    label: item.label,
    value: Number(((item.right.point.value / baseRight) * 100).toFixed(4)),
    display: displayForIndexedSeries(item.right.row, right.valueKeys || ['profit'], item.right.point.value),
    rawValue: item.right.point.value
  }));
  if (leftPoints.length < minPoints || rightPoints.length < minPoints) return null;
  return {
    id,
    title,
    chartType: 'multi_line',
    source,
    unit: 'base 100',
    scaleHint: 'indexed_base_100_from_real_source_values',
    series: [
      { id: left.id || 'primary', label: left.label || 'Série 1', points: leftPoints },
      { id: right.id || 'secondary', label: right.label || 'Série 2', points: rightPoints }
    ]
  };
}

function normalizePoints(rows = [], valueKeys = ['value', 'close', 'price'], limit = 18) {
  return arrayFrom(rows).map(row => chartPoint(row, valueKeys)).filter(Boolean).slice(-limit);
}

function numericLabelPoint(row = {}, labelKeys = ['label', 'period', 'year', 'date', 'month', 'name'], valueKeys = ['value', 'percent', 'percentage']) {
  const label = labelKeys.map(k => cleanText(row?.[k])).find(Boolean) || cleanText(row?.raw?.label || row?.raw?.name);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  return { label: label.slice(0, 18), value, display: cleanText(row.display) || compactDisplay(value) };
}

function normalizeDistributionPoints(source = {}, valueKeys = ['value', 'percentual', 'percentage', 'valuePercent', 'percent']) {
  const rows = [];
  if (Array.isArray(source)) {
    for (const row of source) rows.push(row);
  } else if (source && typeof source === 'object') {
    for (const [group, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        value.forEach(item => rows.push({ group, ...(item || {}) }));
      } else if (value && typeof value === 'object') {
        for (const [name, raw] of Object.entries(value)) rows.push({ label: name, name, value: raw });
      } else {
        rows.push({ label: group, name: group, value });
      }
    }
  }
  return rows.map(row => numericLabelPoint(row, ['label', 'name', 'nome', 'tipo', 'classe', 'group'], valueKeys)).filter(Boolean);
}

function analysisChart(id, title, chartType, points, source = 'VALORAE Proxy', options = {}) {
  const safePoints = normalizePoints(points, options.valueKeys || ['value', 'close', 'price'], options.limit || 18);
  if (safePoints.length < (options.minPoints || 1)) return null;
  return {
    id,
    title,
    chartType,
    source,
    unit: options.unit || '',
    series: [{ id: options.seriesId || 'value', label: options.seriesLabel || title, points: safePoints }]
  };
}

function dualSeriesChart(id, title, chartType, rows = [], source = 'VALORAE Proxy', left = {}, right = {}, options = {}) {
  const normalized = arrayFrom(rows).slice(-14);
  const minPoints = options.minPoints || 2;
  const leftPoints = normalized.map(row => chartPoint(row, left.valueKeys || ['netRevenue', 'revenue', 'receita', 'value'])).filter(Boolean);
  const rightPoints = normalized.map(row => chartPoint(row, right.valueKeys || ['netProfit', 'profit', 'lucro', 'secondaryValue'])).filter(Boolean);
  const leftPeriods = new Set(leftPoints.map(point => point.label));
  const rightPeriods = new Set(rightPoints.map(point => point.label));
  const commonPeriods = new Set([...leftPeriods].filter(label => rightPeriods.has(label)));
  const alignedLeft = leftPoints.filter(point => commonPeriods.has(point.label));
  const alignedRight = rightPoints.filter(point => commonPeriods.has(point.label));
  if (alignedLeft.length < minPoints || alignedRight.length < minPoints) return null;
  return {
    id,
    title,
    chartType,
    source,
    unit: left.unit || '',
    series: [
      { id: left.id || 'primary', label: left.label || 'Receita', points: alignedLeft },
      { id: right.id || 'secondary', label: right.label || 'Lucro', points: alignedRight }
    ]
  };
}

function chartPeriodLabel(chart = {}) {
  const firstSeries = arrayFrom(chart.series).find(serie => arrayFrom(serie.points).length);
  const points = arrayFrom(firstSeries?.points);
  if (!points.length) return '';
  const first = cleanText(points[0]?.label);
  const last = cleanText(points[points.length - 1]?.label);
  if (!first || !last) return '';
  return first === last ? first : `${first} a ${last}`;
}

function chartLastDisplay(chart = {}) {
  const firstSeries = arrayFrom(chart.series).find(serie => arrayFrom(serie.points).length);
  const last = arrayFrom(firstSeries?.points).slice(-1)[0];
  if (!last) return '';
  return cleanText(last.display) || compactDisplay(last.value);
}

function chartPreviewItems(charts = []) {
  return charts.map(chart => {
    const period = chartPeriodLabel(chart);
    const last = chartLastDisplay(chart);
    const value = [period ? `Período: ${period}` : '', last ? `Último: ${last}` : ''].filter(Boolean).join(' • ');
    return {
      id: chart.id,
      label: chart.title,
      value: value || 'Série real disponível',
      group: chart.source || 'Fonte real',
      source: chart.source || 'Fonte real'
    };
  });
}

function tableItemsFromObject(obj = {}, source = 'VALORAE Proxy', limit = 24) {
  return Object.entries(objectFrom(obj)).map(([key, value]) => {
    const label = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    const display = cleanText(value) || compactDisplay(value);
    return display ? { id: norm(label).replace(/\s+/g, '_'), label, value: display, group: 'Dados capturados', source } : null;
  }).filter(Boolean).slice(0, limit);
}

function historySpecsForAsset(assetType = '') {
  return String(assetType).toUpperCase() === 'FII' ? FII_HISTORICAL_INDICATORS : STOCK_HISTORICAL_INDICATORS;
}

function historySpecForLabel(label = '', specs = STOCK_HISTORICAL_INDICATORS) {
  const wanted = norm(label);
  if (!wanted) return null;
  return specs.find(spec => [spec.id, spec.label, ...(spec.aliases || [])].map(norm).some(alias => alias && (wanted === alias || wanted.includes(alias) || alias.includes(wanted)))) || null;
}

function historyDisplayForSpec(value, spec = {}) {
  const rawDisplay = cleanText(value?.display || value?.formatted || value?.fmt || value?.text);
  if (rawDisplay && rawDisplay !== '-' && rawDisplay !== '--') return rawDisplay;
  const rawValue = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
  if (spec.unit === '%') return percentDisplay(rawValue);
  if (spec.unit === 'R$') return brl(rawValue) || compactDisplay(rawValue);
  return decimalDisplay(rawValue) || cleanText(rawValue);
}

function numericHistoryValue(value, spec = {}) {
  const raw = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value?.display ?? value?.formatted ?? value?.fmt ?? value;
  const n = finiteValue(raw);
  if (n === undefined) return undefined;
  if (spec.unit === '%' && Math.abs(n) <= 1.5 && /0[.,]\d+/.test(cleanText(raw))) return Number((n * 100).toFixed(6));
  return n;
}

function isUsableHistoryDisplay(value = '') {
  const txt = cleanText(value);
  return Boolean(txt && txt !== '-' && txt !== '--' && !/^null|undefined$/i.test(txt));
}

function collectHistoricalIndicatorSources(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const canonical = payload.assetChartsCanonical || payload.results?.assetChartsCanonical || payload.results?.sections?.assetChartsCanonical || {};
  const canonicalCompany = canonical.company || payload.companyChartsCanonical || payload.results?.companyChartsCanonical || {};
  const canonicalFii = canonical.fii || payload.fiiChartsCanonical || payload.results?.fiiChartsCanonical || {};
  const sections = payload.sections || payload.results?.sections || {};
  return [
    { source: 'StatusInvest/Investidor10 histórico', value: payload.historicalIndicators },
    { source: 'Investidor10 histórico de indicadores', value: payload.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: payload.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.historicalIndicators },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: sections.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: sections.historico_indicadores },
    { source: 'Investidor10 histórico de indicadores', value: sections.tables?.indicadores },
    { source: 'Investidor10 histórico de indicadores', value: sections.empresa?.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: sections.fundo?.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: bundle.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: bundle.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: bundle.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: bundle.fiiFundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: canonical.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: canonicalCompany.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: canonicalFii.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.assetChartsCanonical?.company?.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.assetChartsCanonical?.fii?.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.fiiChartsCanonical?.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.companyChartsCanonical?.fundamentalIndicatorHistory }
  ].filter(entry => entry.value !== undefined && entry.value !== null);
}

function addHistoricalIndicatorRecord(records, seen, rawLabel, rawPeriod, rawValue, specs, source = 'StatusInvest/Investidor10') {
  const spec = historySpecForLabel(rawLabel, specs);
  const period = cleanText(rawPeriod || rawValue?.period || rawValue?.year || rawValue?.date || rawValue?.label);
  if (!spec || !period) return;
  const display = historyDisplayForSpec(rawValue, spec);
  if (!isUsableHistoryDisplay(display)) return;
  const numeric = numericHistoryValue(rawValue, spec);
  const key = `${spec.id}|${period}|${display}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  records.push({
    id: spec.id,
    label: spec.label,
    period,
    value: display,
    numeric,
    group: spec.group,
    unit: spec.unit || '',
    source
  });
}

function normalizeHistoricalIndicatorRecords(payload = {}, assetType = '') {
  const specs = historySpecsForAsset(assetType);
  const records = [];
  const seen = new Set();

  const walk = (value, source = 'StatusInvest/Investidor10', inheritedLabel = '') => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, source, inheritedLabel);
      return;
    }
    if (typeof value !== 'object') {
      if (inheritedLabel) addHistoricalIndicatorRecord(records, seen, inheritedLabel, 'Atual', value, specs, source);
      return;
    }

    const columns = Array.isArray(value.colunas) ? value.colunas.map(cleanText).filter(Boolean)
      : Array.isArray(value.columns) ? value.columns.map(cleanText).filter(Boolean)
      : Array.isArray(value.periods) ? value.periods.map(cleanText).filter(Boolean)
      : [];
    const lineRows = Array.isArray(value.linhas) ? value.linhas
      : Array.isArray(value.rows) ? value.rows
      : Array.isArray(value.items) ? value.items
      : null;
    if (lineRows) {
      const rawRows = arrayFrom(lineRows);
      let inferredColumns = columns;
      let rowsToRead = rawRows;
      if (!inferredColumns.length && Array.isArray(rawRows[0]) && rawRows[0].length >= 2) {
        const header = rawRows[0].map(cleanText);
        if (header.slice(1).some(h => /^(19|20)\d{2}$|ano|per[ií]odo|atual|[1-4]T/i.test(h))) {
          inferredColumns = header.slice(1).filter(Boolean);
          rowsToRead = rawRows.slice(1);
        }
      }
      for (const row of rowsToRead) {
        if (Array.isArray(row)) {
          const label = cleanText(row[0] || inheritedLabel);
          const values = row.slice(1);
          if (label && (inferredColumns.length || values.length)) {
            values.forEach((cell, index) => addHistoricalIndicatorRecord(records, seen, label, inferredColumns[index] || `Período ${index + 1}`, cell, specs, source));
          }
          continue;
        }
        const label = cleanText(row?.indicador || row?.indicator || row?.label || row?.name || inheritedLabel);
        const valores = row?.valores || row?.values || row?.periods || row?.data;
        if (valores && typeof valores === 'object' && !Array.isArray(valores)) {
          const periods = inferredColumns.length ? inferredColumns : Object.keys(valores);
          for (const period of periods) addHistoricalIndicatorRecord(records, seen, label, period, valores[period], specs, source);
        } else {
          addHistoricalIndicatorRecord(records, seen, label, row?.period || row?.year || row?.date || row?.label, row?.value ?? row?.valor ?? row?.display, specs, source);
        }
      }
      return;
    }

    const directLabel = cleanText(value.indicador || value.indicator || value.metric || value.name || value.label || inheritedLabel);
    const directPeriod = cleanText(value.period || value.year || value.date || value.month || value.referenceDate);
    if (directLabel && directPeriod && (value.value !== undefined || value.valor !== undefined || value.display !== undefined || value.raw !== undefined)) {
      addHistoricalIndicatorRecord(records, seen, directLabel, directPeriod, value, specs, source);
      return;
    }

    for (const [key, child] of Object.entries(value)) {
      if (['source','updatedAt','generatedAt','metadata','diagnostics','colunas','columns','linhas','rows','items'].includes(key)) continue;
      const nextLabel = historySpecForLabel(key, specs) ? key : inheritedLabel;
      if (Array.isArray(child)) {
        for (const row of child) {
          const period = row?.year || row?.period || row?.date || row?.label || row?.month;
          const rawValue = row?.value ?? row?.valor ?? row?.display ?? row?.raw ?? row;
          addHistoricalIndicatorRecord(records, seen, nextLabel || key, period, rawValue, specs, row?.source || source);
        }
      } else if (child && typeof child === 'object') {
        const childKeys = Object.keys(child);
        const periodLike = childKeys.filter(k => /^(19|20)\d{2}$|atual|último|ultimo|\d{2}\/\d{4}|\d{4}-\d{2}/i.test(k));
        if ((nextLabel || historySpecForLabel(key, specs)) && periodLike.length) {
          for (const period of periodLike) addHistoricalIndicatorRecord(records, seen, nextLabel || key, period, child[period], specs, source);
        } else {
          walk(child, source, nextLabel || key);
        }
      }
    }
  };

  for (const entry of collectHistoricalIndicatorSources(payload)) walk(entry.value, entry.source);

  // Séries confiáveis já capturadas nos gráficos também alimentam a tabela histórica sem inventar valores.
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  for (const item of arrayFrom(bundle.dividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory)) {
    addHistoricalIndicatorRecord(records, seen, 'Dividend Yield', item.year || item.period || item.label || item.date, item, specs, item.source || 'StatusInvest/Investidor10 proventos');
  }
  for (const item of arrayFrom(bundle.payoutHistory || payload.payoutHistory || payload.results?.payoutHistory)) {
    addHistoricalIndicatorRecord(records, seen, 'Payout', item.year || item.period || item.label || item.date, item, specs, item.source || 'StatusInvest/Investidor10');
  }

  const order = new Map(specs.map((spec, index) => [spec.id, index]));
  return records
    .filter(record => isUsableHistoryDisplay(record.value))
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999) || String(b.period).localeCompare(String(a.period)));
}

function buildHistoricalIndicatorItems(payload = {}, assetType = '') {
  return normalizeHistoricalIndicatorRecords(payload, assetType)
    .slice(0, 84)
    .map((record, index) => ({
      id: `hist_${record.id}_${norm(record.period).replace(/\s+/g, '_') || index}`,
      label: `${record.label} • ${record.period}`,
      value: record.value,
      group: record.group,
      source: record.source
    }));
}

function buildHistoricalIndicatorCharts(payload = {}, assetType = '') {
  const records = normalizeHistoricalIndicatorRecords(payload, assetType);
  const specs = historySpecsForAsset(assetType);
  const charts = [];
  for (const spec of specs) {
    const rows = records
      .filter(record => record.id === spec.id && Number.isFinite(record.numeric))
      .map(record => ({ label: record.period, value: record.numeric, display: record.value }));
    const uniquePeriods = new Set(rows.map(row => row.label));
    if (rows.length < 2 || uniquePeriods.size < 2) continue;
    const chart = analysisChart(
      `historical_${spec.id}`,
      `${spec.label} histórico`,
      'line',
      rows.reverse(),
      'StatusInvest/Investidor10 histórico de indicadores',
      { valueKeys: ['value'], minPoints: 2, limit: 12, unit: spec.unit || '' }
    );
    if (chart) charts.push(chart);
    if (charts.length >= 6) break;
  }
  return charts;
}

function allFinancialStatementMetrics() {
  return FINANCIAL_STATEMENT_GROUPS.flatMap(group => group.metrics.map(metric => ({ ...metric, statementId: group.id, statementTitle: group.title })));
}

function financialStatementGroupByAlias(label = '') {
  const wanted = norm(label);
  if (!wanted) return null;
  return FINANCIAL_STATEMENT_GROUPS.find(group => [group.id, group.title, ...(group.aliases || [])].map(norm).some(alias => alias && (wanted === alias || wanted.includes(alias) || alias.includes(wanted)))) || null;
}

function financialStatementGroupByExactAlias(label = '') {
  const wanted = norm(label);
  if (!wanted) return null;
  return FINANCIAL_STATEMENT_GROUPS.find(group => [group.id, group.title, ...(group.aliases || [])].map(norm).some(alias => alias && wanted === alias)) || null;
}

function financialStatementMetricByAlias(label = '', groupHint = null) {
  const wanted = norm(label);
  if (!wanted) return null;
  const groups = groupHint ? [groupHint] : FINANCIAL_STATEMENT_GROUPS;
  for (const group of groups) {
    for (const metric of group.metrics) {
      const aliases = [metric.id, metric.label, ...(metric.aliases || [])].map(norm).filter(Boolean);
      if (aliases.some(alias => wanted === alias || wanted.includes(alias) || alias.includes(wanted))) {
        return { ...metric, statementId: group.id, statementTitle: group.title };
      }
    }
  }
  return null;
}

function valueByAliases(obj = {}, aliases = []) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const alias of aliases) {
    if (!Object.prototype.hasOwnProperty.call(obj, alias)) continue;
    const value = obj[alias];
    if (value !== undefined && value !== null && cleanText(value) !== '') return value;
  }
  const normalizedAliases = aliases.map(norm).filter(Boolean);
  for (const [key, value] of Object.entries(obj)) {
    const normalizedKey = norm(key);
    if (normalizedAliases.some(alias => normalizedKey === alias || normalizedKey.includes(alias) || alias.includes(normalizedKey))) {
      return value;
    }
  }
  return undefined;
}

function statementPeriodFrom(row = {}, fallback = '') {
  const quarter = cleanText(row.quarter || row.trimestre || row.periodType);
  const year = cleanText(row.year || row.ano || row.exercicio || row.exercício);
  if (quarter && year && !String(quarter).includes(year)) return `${quarter} ${year}`.trim();
  return cleanText(row.period || row.periodo || row.label || row.date || row.data || row.referenceDate || row.fimPeriodo || row.dataFim || year || fallback);
}

function looksLikeStatementPeriodKey(key = '') {
  const k = cleanText(key);
  return /^(\d{4}|\d{1,2}T\d{2}|[1-4]T\s*\d{4}|\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/i.test(k);
}

function financialStatementDisplay(value, metric = {}) {
  const rawDisplay = cleanText(value?.display || value?.formatted || value?.fmt || value?.text);
  if (rawDisplay && rawDisplay !== '-' && rawDisplay !== '--') {
    const displayNumeric = finiteValue(rawDisplay);
    if (displayNumeric !== undefined) {
      if (metric.unit === 'R$') return `R$ ${compactDisplay(displayNumeric)}`;
      if (metric.unit === '%') return percentDisplay(displayNumeric);
    }
    return rawDisplay;
  }
  const raw = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
  const n = finiteValue(raw);
  if (n === undefined) return cleanText(raw);
  if (metric.unit === 'R$') return `R$ ${compactDisplay(n)}`;
  if (metric.unit === '%') return percentDisplay(n);
  return decimalDisplay(n);
}

function addFinancialStatementRecord(records, seen, metric, period, value, source = 'StatusInvest/Yahoo fundamentals') {
  if (!metric) return;
  const cleanPeriod = cleanText(period || value?.period || value?.year || value?.date || value?.label || '');
  if (!cleanPeriod) return;
  const numeric = finiteValue(value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value?.display ?? value?.formatted ?? value);
  const display = financialStatementDisplay(value, metric);
  if (!display || display === '-' || display === '--') return;
  const key = `${metric.statementId}|${metric.id}|${cleanPeriod}|${display}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  records.push({
    statementId: metric.statementId,
    statementTitle: metric.statementTitle,
    metricId: metric.id,
    label: metric.label,
    period: cleanPeriod,
    value: display,
    numeric,
    unit: metric.unit || '',
    source
  });
}

function collectFinancialStatementSources(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const canonical = payload.results?.financialChartsCanonical || payload.results?.assetChartsCanonical?.financial || payload.assetChartsCanonical?.financial || {};
  const sections = payload.results?.sections || {};
  return [
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.financialStatements },
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.statements },
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.demonstrativos },
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.results?.financialStatements },
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.results?.statements },
    { source: 'StatusInvest/Yahoo fundamentals', value: payload.results?.demonstrativos },
    // Não usar `financialSummary`/snapshot pontual como demonstrativo. DRE, Balanço
    // e Fluxo de Caixa exigem série/tabela real capturada da fonte; valores atuais
    // ficam no bloco de perfil/resumo para evitar aparência de histórico inventado.
    { source: 'StatusInvest/Yahoo fundamentals', value: sections.demonstrativos },
    { source: 'Investidor10 APIs de balanços', value: payload.chartsFinanceiros || payload.charts_financeiros },
    { source: 'Investidor10 APIs de balanços', value: payload.results?.chartsFinanceiros || payload.results?.charts_financeiros },
    { source: 'Investidor10 APIs de balanços', value: sections.chartsFinanceiros || sections.charts_financeiros },
    { source: 'Investidor10 APIs de balanços', value: payload.apiExtras?.chartsFinanceiros || payload.apiExtras?.rawJson },
    { source: 'Investidor10 APIs de balanços', value: payload.results?.apiExtras?.chartsFinanceiros || payload.results?.apiExtras?.rawJson },
    { source: 'StatusInvest/Investidor10 anual', value: payload.results?.financialChartsCanonical || payload.financialChartsCanonical },
    { source: 'StatusInvest/Investidor10 anual', value: payload.results?.assetChartsCanonical?.financial || payload.assetChartsCanonical?.financial },
    { source: 'Yahoo fundamentals estruturados', value: { incomeStatement: canonical.incomeStatement, balanceSheet: canonical.balanceSheet, cashFlowStatement: canonical.cashFlowStatement } },
    { source: 'VALORAE assetChartBundle', value: { incomeStatement: bundle.incomeStatement || bundle.revenueProfit, balanceSheet: bundle.balanceSheet || bundle.equityEvolution, cashFlowStatement: bundle.cashFlowStatement } }
  ].filter(entry => entry.value !== undefined && entry.value !== null);
}


function looksLikeStatementTableObject(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.some(looksLikeStatementPeriodKey) && keys.some(key => !looksLikeStatementPeriodKey(key));
}

function addFinancialValuesByPeriod(records, seen, metric, values = {}, source = 'StatusInvest/Yahoo fundamentals') {
  if (!metric || !values || typeof values !== 'object' || Array.isArray(values)) return 0;
  let added = 0;
  for (const [periodKey, periodValue] of Object.entries(values)) {
    if (!looksLikeStatementPeriodKey(periodKey)) continue;
    addFinancialStatementRecord(records, seen, metric, periodKey, periodValue, source);
    added += 1;
  }
  return added;
}

function statementMetricLabelFromRow(row = {}) {
  return row.label || row.name || row.metric || row.indicador || row.conta || row.account || row.title || row.description || row.descricao;
}

function collectPeriodKeysFromRecords(records = [], groupId = '', metricId = '') {
  return new Set(records
    .filter(record => (!groupId || record.statementId === groupId) && (!metricId || record.metricId === metricId))
    .map(record => cleanText(record.period))
    .filter(Boolean));
}

function hasMultiPeriodRecords(records = [], groupId = '') {
  return collectPeriodKeysFromRecords(records, groupId).size >= 2;
}


function chartLabelsFromObject(value = {}) {
  const xAxis = Array.isArray(value?.xAxis) ? value.xAxis[0] : value?.xAxis;
  return arrayFrom(value?.labels || value?.categories || value?.years || value?.anos || value?.periods || value?.periodos || xAxis?.categories)
    .map(item => cleanText(item?.label || item?.name || item?.value || item?.raw || item))
    .filter(Boolean);
}

function rawChartPointValue(item) {
  if (Array.isArray(item)) return item[1] ?? item[0];
  if (item && typeof item === 'object') return item.y ?? item.value ?? item.valor ?? item.amount ?? item.total ?? item.raw ?? item.display ?? item.formatted;
  return item;
}

function chartPointLabelFromValue(item, fallback = '') {
  if (Array.isArray(item)) return cleanText(item[0] ?? fallback);
  if (item && typeof item === 'object') return cleanText(item.label || item.name || item.period || item.periodo || item.year || item.ano || item.date || item.data || item.x || fallback);
  return cleanText(fallback);
}

function consumeFinancialChartObject(records, seen, value = {}, source = 'StatusInvest/Yahoo fundamentals', groupHint = null) {
  if (!value || typeof value !== 'object') return 0;
  let added = 0;
  const labels = chartLabelsFromObject(value);
  const seriesList = arrayFrom(value.series || value.datasets || value.dataSeries || value.seriesData);
  if (seriesList.length) {
    for (const serie of seriesList) {
      const name = cleanText(serie.name || serie.label || serie.title || serie.key || serie.id);
      const metric = financialStatementMetricByAlias(name, groupHint);
      if (!metric) continue;
      const data = arrayFrom(serie.data || serie.values || serie.points);
      data.forEach((item, index) => {
        const period = chartPointLabelFromValue(item, labels[index] || '');
        const rawValue = rawChartPointValue(item);
        if (period && rawValue !== undefined && rawValue !== null) {
          addFinancialStatementRecord(records, seen, metric, period, rawValue, source);
          added += 1;
        }
      });
    }
  }
  // Some APIs return named arrays without a `series` wrapper: { receita: [...], lucro: [...], labels:[...] }.
  for (const [key, child] of Object.entries(value)) {
    if (['series','datasets','dataSeries','seriesData','labels','categories','years','anos','periods','periodos','xAxis','source','metadata','apiStatus'].includes(key)) continue;
    const metric = financialStatementMetricByAlias(key, groupHint);
    if (metric && Array.isArray(child)) {
      child.forEach((item, index) => {
        const period = chartPointLabelFromValue(item, labels[index] || '');
        const rawValue = rawChartPointValue(item);
        if (period && rawValue !== undefined && rawValue !== null) {
          addFinancialStatementRecord(records, seen, metric, period, rawValue, source);
          added += 1;
        }
      });
    }
  }
  return added;
}

function normalizeFinancialStatementRecords(payload = {}) {
  const records = [];
  const seen = new Set();

  const consumeRow = (row = {}, source = 'StatusInvest/Yahoo fundamentals', groupHint = null, inheritedPeriod = '') => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 0;
    const period = statementPeriodFrom(row, inheritedPeriod);
    let added = 0;
    const groups = groupHint ? [groupHint] : FINANCIAL_STATEMENT_GROUPS;
    for (const group of groups) {
      for (const metric of group.metrics) {
        const value = valueByAliases(row, [metric.id, metric.label, ...(metric.aliases || [])]);
        if (value !== undefined && value !== null && cleanText(value) !== '') {
          addFinancialStatementRecord(records, seen, { ...metric, statementId: group.id, statementTitle: group.title }, period, value, source);
          added += 1;
        }
      }
    }
    const labelMetric = financialStatementMetricByAlias(statementMetricLabelFromRow(row), groupHint);
    const periodValues = row.valores ?? row.values ?? row.periods ?? row.periodos ?? row.anos ?? row.years ?? row.data;
    if (labelMetric && periodValues && typeof periodValues === 'object' && !Array.isArray(periodValues)) {
      added += addFinancialValuesByPeriod(records, seen, labelMetric, periodValues, source);
    }
    const labelValue = row.value ?? row.valor ?? row.amount ?? row.total ?? row.display;
    if (labelMetric && labelValue !== undefined) {
      addFinancialStatementRecord(records, seen, labelMetric, period, labelValue, source);
      added += 1;
    }
    return added;
  };

  const walk = (value, source = 'StatusInvest/Yahoo fundamentals', groupHint = null, inheritedPeriod = '') => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const directGroup = financialStatementGroupByAlias(item.statement || item.group || item.type || item.kind || '');
          consumeRow(item, source, directGroup || groupHint, inheritedPeriod);
          for (const [key, child] of Object.entries(item)) {
            const nextGroup = financialStatementGroupByAlias(key);
            if (nextGroup) walk(child, source, nextGroup, inheritedPeriod);
          }
        }
      }
      return;
    }
    if (typeof value !== 'object') return;

    consumeFinancialChartObject(records, seen, value, source, groupHint);

    if (looksLikeStatementTableObject(value)) {
      const directMetric = financialStatementMetricByAlias(statementMetricLabelFromRow(value), groupHint);
      if (directMetric) {
        addFinancialValuesByPeriod(records, seen, directMetric, value, source);
      }
    }

    const groupAdded = consumeRow(value, source, groupHint, inheritedPeriod);

    for (const [key, child] of Object.entries(value)) {
      if (child === undefined || child === null) continue;
      const exactKeyGroup = financialStatementGroupByExactAlias(key);
      const keyMetric = financialStatementMetricByAlias(key, groupHint);
      const keyGroup = financialStatementGroupByAlias(key);
      // Prefer exact section aliases for source chart buckets such as `receitasLucros`,
      // `ativosPassivos` and `fluxoCaixa`; prefer metric aliases for names such as
      // `receitaLiquida`, because fuzzy section aliases like `receitaLiquidaChart` must not
      // steal the metric's period/value map.
      if (exactKeyGroup && (!keyMetric || !groupHint)) {
        walk(child, source, exactKeyGroup, inheritedPeriod);
        continue;
      }
      if (keyMetric) {
        if (Array.isArray(child)) {
          for (const row of child) addFinancialStatementRecord(records, seen, keyMetric, statementPeriodFrom(row, inheritedPeriod), row, source);
        } else if (child && typeof child === 'object') {
          const childPeriod = statementPeriodFrom(child, inheritedPeriod);
          const directValue = child.value ?? child.valor ?? child.amount ?? child.raw ?? child.display ?? child.formatted;
          if (directValue !== undefined) addFinancialStatementRecord(records, seen, keyMetric, childPeriod, child, source);
          for (const [periodKey, periodValue] of Object.entries(child)) {
            if (looksLikeStatementPeriodKey(periodKey) || typeof periodValue !== 'object') {
              addFinancialStatementRecord(records, seen, keyMetric, periodKey, periodValue, source);
            }
          }
        } else {
          addFinancialStatementRecord(records, seen, keyMetric, inheritedPeriod, child, source);
        }
        continue;
      }
      if (keyGroup) {
        walk(child, source, keyGroup, inheritedPeriod);
        continue;
      }
      if (looksLikeStatementPeriodKey(key) && child && typeof child === 'object') {
        consumeRow(child, source, groupHint, key);
        continue;
      }
      if (child && typeof child === 'object' && groupAdded === 0) walk(child, source, groupHint, inheritedPeriod);
    }
  };

  for (const entry of collectFinancialStatementSources(payload)) walk(entry.value, entry.source);

  const statementOrder = new Map(FINANCIAL_STATEMENT_GROUPS.map((group, index) => [group.id, index]));
  const metricOrder = new Map(allFinancialStatementMetrics().map((metric, index) => [`${metric.statementId}|${metric.id}`, index]));
  return records
    .filter(record => cleanText(record.value))
    .sort((a, b) => (statementOrder.get(a.statementId) ?? 99) - (statementOrder.get(b.statementId) ?? 99)
      || (metricOrder.get(`${a.statementId}|${a.metricId}`) ?? 999) - (metricOrder.get(`${b.statementId}|${b.metricId}`) ?? 999)
      || String(b.period).localeCompare(String(a.period)));
}

function buildFinancialStatementItems(payload = {}) {
  return normalizeFinancialStatementRecords(payload)
    .slice(0, 120)
    .map((record, index) => ({
      id: `statement_${record.statementId}_${record.metricId}_${norm(record.period).replace(/\s+/g, '_') || index}`,
      label: `${record.statementTitle} • ${record.label} • ${record.period}`,
      value: record.value,
      group: record.statementTitle,
      source: record.source
    }));
}

function alignStatementSeriesByPeriod(series = []) {
  const safeSeries = series
    .map(serie => ({
      ...serie,
      points: arrayFrom(serie.points)
        .filter(point => cleanText(point?.label) && Number.isFinite(point?.value))
        .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }))
    }))
    .filter(serie => serie.points.length >= 2);
  if (!safeSeries.length) return [];

  const periodCounts = new Map();
  for (const serie of safeSeries) {
    const uniqueLabels = new Set(serie.points.map(point => cleanText(point.label)).filter(Boolean));
    for (const label of uniqueLabels) periodCounts.set(label, (periodCounts.get(label) || 0) + 1);
  }
  const preferredPeriods = [...periodCounts.entries()]
    .filter(([, count]) => count >= Math.min(2, safeSeries.length))
    .map(([label]) => label)
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }))
    .slice(-10);
  if (preferredPeriods.length < 2) return safeSeries.slice(0, 1).map(serie => ({ ...serie, points: serie.points.slice(-10) }));

  const preferredSet = new Set(preferredPeriods);
  return safeSeries
    .map(serie => {
      const byLabel = new Map(serie.points.map(point => [cleanText(point.label), point]));
      const points = preferredPeriods.map(label => byLabel.get(label)).filter(Boolean);
      return { ...serie, points };
    })
    .filter(serie => serie.points.length >= 2);
}

function buildFinancialStatementCharts(payload = {}) {
  const records = normalizeFinancialStatementRecords(payload).filter(record => Number.isFinite(record.numeric));
  const charts = [];
  for (const group of FINANCIAL_STATEMENT_GROUPS) {
    const candidateSeries = [];
    for (const metric of group.metrics) {
      const rows = records
        .filter(record => record.statementId === group.id && record.metricId === metric.id)
        .map(record => ({ label: record.period, value: record.numeric, display: record.value }));
      const unique = new Map();
      for (const row of rows) unique.set(row.label, row);
      const points = Array.from(unique.values())
        .sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }))
        .slice(-10);
      if (points.length >= 2) candidateSeries.push({ id: metric.id, label: metric.label, points });
      if (candidateSeries.length >= 3) break;
    }
    const series = alignStatementSeriesByPeriod(candidateSeries).slice(0, 3);
    if (series.length) {
      charts.push({
        id: `${group.id}_statement`,
        title: `${group.title} por período`,
        chartType: 'grouped_bar',
        source: 'StatusInvest/Investidor10/Yahoo fundamentals normalizados pelo Proxy',
        unit: 'R$',
        series
      });
    }
  }
  return charts;
}


function appendRealtimeQuotePoint(rows = [], payload = {}) {
  const baseRows = arrayFrom(rows);
  const quote = payload.quote || payload.cotacao || payload.results?.quote || payload.results?.cotacao || payload.appPayload?.quote || payload.appMobileSnapshot?.quote || {};
  const livePrice = finiteValue(payload.currentPrice ?? payload.price ?? payload.precoAtual ?? quote.currentPrice ?? quote.price ?? quote.regularMarketPrice);
  if (livePrice === undefined || livePrice <= 0) return baseRows;
  const liveLabel = 'Agora';
  const livePoint = {
    label: liveLabel,
    value: livePrice,
    price: livePrice,
    close: livePrice,
    display: brl(livePrice),
    source: 'Yahoo Finance quote em tempo real'
  };
  const last = baseRows[baseRows.length - 1] || {};
  const lastLabel = cleanText(last.label || last.date || last.timestamp || last.period).toLowerCase();
  const lastValue = finiteValue(last.value ?? last.price ?? last.close);
  if (lastLabel === liveLabel.toLowerCase()) return [...baseRows.slice(0, -1), livePoint];
  if (lastValue !== undefined && Math.abs(lastValue - livePrice) < 0.000001 && baseRows.length <= 1) return [...baseRows.slice(0, -1), livePoint];
  return [...baseRows.slice(-23), livePoint];
}

function buildAssetCharts(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const assetType = cleanText(payload.assetClass || payload.type || payload.results?.assetClass || payload.results?.type).toUpperCase();
  const isFii = assetType === 'FII';
  const charts = [];

  const priceRows = appendRealtimeQuotePoint(bundle.priceHistory || payload.historicoPrecos || payload.results?.historicoPrecos, payload);
  const price = analysisChart('price_history', 'Cotação em tempo real', 'line', priceRows, 'Yahoo Finance Chart API + quote em tempo real', { valueKeys: ['close', 'price', 'value'], minPoints: 1, limit: 24, unit: 'R$', seriesLabel: 'Cotação' });
  if (price) charts.push(price);

  const dividends = analysisChart(isFii ? 'fii_monthly_distribution' : 'dividend_history', isFii ? 'Rendimento mensal' : 'Histórico de proventos', 'bar', bundle.dividendMonthly || bundle.fiiDistribution12m || bundle.dividendYearly, 'StatusInvest/Investidor10 proventos', { valueKeys: ['amount', 'value', 'total', 'valuePerShare'], minPoints: 2, limit: 14, unit: 'R$' });
  if (dividends) charts.push(dividends);

  const dyHistory = analysisChart('dividend_yield_history', 'Dividend Yield histórico', 'bar', bundle.dividendYieldHistory || bundle.fiiDividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory, 'StatusInvest/Investidor10 proventos', { valueKeys: ['yieldPercent', 'dividendYield', 'dy', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (dyHistory) charts.push(dyHistory);

  const revenueProfit = dualSeriesChart('revenue_profit', 'Receitas e Lucros', 'grouped_bar', bundle.revenueProfit || payload.statements?.revenueProfit || payload.results?.statements?.revenueProfit, 'StatusInvest/Yahoo fundamentals', { id: 'revenue', label: 'Receita', valueKeys: ['netRevenue', 'revenue', 'receita'] }, { id: 'profit', label: 'Lucro', valueKeys: ['netProfit', 'profit', 'lucro'] });
  if (revenueProfit) charts.push(revenueProfit);

  const profitVsQuoteRows = arrayFrom(bundle.profitVsQuote || payload.statements?.profitVsQuote || payload.results?.statements?.profitVsQuote)
    .filter(row => finiteValue(row?.value ?? row?.price ?? row?.quote) !== undefined && finiteValue(row?.secondaryValue ?? row?.profit ?? row?.lucro) !== undefined)
    .filter(row => Math.abs(finiteValue(row?.secondaryValue ?? row?.profit ?? row?.lucro) || 0) > 0);
  const profitQuote = profitVsQuoteRows.length >= 2
    ? indexedDualSeriesChart('profit_vs_quote', 'Lucro x Cotação', profitVsQuoteRows, 'Investidor10 cotação-lucro / fundamentos reais', { id: 'quote', label: 'Cotação (base 100)', valueKeys: ['value', 'price', 'quote'] }, { id: 'profit', label: 'Lucro (base 100)', valueKeys: ['secondaryValue', 'profit', 'lucro'] })
    : null;
  if (profitQuote) charts.push(profitQuote);

  const equity = analysisChart(isFii ? 'fii_patrimonial_value' : 'equity_evolution', isFii ? 'Valor patrimonial' : 'Evolução patrimonial', 'bar', bundle.equityEvolution || bundle.balanceSheet || bundle.fiiPatrimonialInfo || payload.statements?.balanceSheet || payload.results?.statements?.balanceSheet, 'StatusInvest/Yahoo fundamentals', { valueKeys: ['netWorth', 'equity', 'patrimonioLiquido', 'valorPatrimonial', 'patrimonialValue', 'value'], minPoints: 2, limit: 12, unit: isFii ? 'R$' : '' });
  if (equity) charts.push(equity);

  const payout = analysisChart('payout_history', 'Payout histórico', 'bar', bundle.payoutHistory || payload.payoutHistory || payload.results?.payoutHistory, 'StatusInvest/Investidor10', { valueKeys: ['payout', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (payout) charts.push(payout);

  const assetDistributionPoints = normalizePercentDistributionChartPoints(normalizeDistributionPoints(bundle.fiiAssetDistribution || payload.fiiAssetDistribution || payload.results?.fiiAssetDistribution || payload.results?.distribuicaoAtivosFundo, ['percentual', 'valuePercent', 'percent', 'percentage', 'value']));
  const assetDistribution = analysisChart('fii_asset_distribution', 'Distribuição de ativos do fundo', 'donut_composition', assetDistributionPoints, 'Investidor10/StatusInvest', { valueKeys: ['value'], minPoints: 1, limit: 12, unit: '%' });
  if (isFii && assetDistribution) charts.push(assetDistribution);

  return charts;
}

function firstClean(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return value;
  }
  return undefined;
}

const STOCK_PROFILE_FIELDS = [
  { id: 'sector', label: 'Setor', group: 'Classificação', aliases: ['setor', 'sector', 'setorEconomico'] },
  { id: 'subSector', label: 'Subsetor', group: 'Classificação', aliases: ['subsetor', 'subSector', 'subsector', 'subsetorEconomico'] },
  { id: 'segment', label: 'Segmento', group: 'Classificação', aliases: ['segmento', 'segment', 'segmentoListagem', 'segmentoB3'] },
  { id: 'cnpj', label: 'CNPJ', group: 'Cadastro', aliases: ['cnpj', 'documento'] },
  { id: 'site', label: 'Site', group: 'Cadastro', aliases: ['site', 'website', 'url'] },
  { id: 'mainActivity', label: 'Atividade principal', group: 'Cadastro', aliases: ['atividadePrincipal', 'atividade principal', 'mainActivity', 'businessDescription', 'atividade'] },
  { id: 'governance', label: 'Governança', group: 'Governança', aliases: ['governanca', 'governança', 'governance', 'nivelGovernanca', 'nivel governanca'] },
  { id: 'tagAlong', label: 'Tag along', group: 'Governança', aliases: ['tagAlong', 'tag along', 'tagalong'] },
  { id: 'freeFloat', label: 'Free float', group: 'Governança', aliases: ['freeFloat', 'free float', 'freefloat'] },
  { id: 'shares', label: 'Número de ações', group: 'Mercado', aliases: ['numeroAcoes', 'número de ações', 'acoesEmitidas', 'shares', 'sharesOutstanding'] },
  { id: 'marketCap', label: 'Valor de mercado', group: 'Mercado', aliases: ['valorDeMercado', 'valorMercado', 'valor mercado', 'valor de mercado', 'marketCap', 'marketValue'] },
  { id: 'equity', label: 'Patrimônio líquido', group: 'Mercado', aliases: ['patrimonioLiquido', 'patrimonio liquido', 'patrimônio líquido', 'equity', 'netWorth'] },
  { id: 'enterpriseValue', label: 'Valor da firma', group: 'Mercado', aliases: ['valorDeFirma', 'valorFirma', 'valor firma', 'valor da firma', 'valor de firma', 'enterpriseValue', 'ev'] },
  { id: 'assets', label: 'Ativos', group: 'Balanço', aliases: ['ativos', 'ativosTotais', 'totalAssets', 'assets', 'ativoTotal'] },
  { id: 'grossDebt', label: 'Dívida bruta', group: 'Balanço', aliases: ['dividaBruta', 'dívida bruta', 'grossDebt'] },
  { id: 'netDebt', label: 'Dívida líquida', group: 'Balanço', aliases: ['dividaLiquida', 'dívida líquida', 'netDebt'] },
  { id: 'cash', label: 'Disponibilidade', group: 'Balanço', aliases: ['disponibilidade', 'disponibilidades', 'cash', 'caixa'] },
  { id: 'dailyLiquidity', label: 'Liquidez média diária', group: 'Liquidez', aliases: ['liquidezMediaDiaria', 'liquidez média diária', 'averageDailyLiquidity', 'dailyLiquidity'] }
];

const FII_PROFILE_FIELDS = [
  { id: 'corporateName', label: 'Razão social', group: 'Cadastro', aliases: ['razaoSocial', 'razão social', 'corporateName', 'nomeCompleto'] },
  { id: 'cnpj', label: 'CNPJ', group: 'Cadastro', aliases: ['cnpj', 'documento'] },
  { id: 'administrator', label: 'Administrador', group: 'Gestão', aliases: ['administrador', 'administrator', 'admin'] },
  { id: 'manager', label: 'Gestor', group: 'Gestão', aliases: ['gestor', 'manager', 'gestao', 'gestão'] },
  { id: 'segment', label: 'Segmento', group: 'Classificação', aliases: ['segmento', 'segment', 'segmentoFii'] },
  { id: 'fundType', label: 'Tipo de fundo', group: 'Classificação', aliases: ['tipoFundo', 'tipo de fundo', 'fundType', 'tipo'] },
  { id: 'mandate', label: 'Mandato', group: 'Classificação', aliases: ['mandato', 'mandate'] },
  { id: 'managementType', label: 'Tipo de gestão', group: 'Gestão', aliases: ['tipoGestao', 'tipo de gestão', 'managementType'] },
  { id: 'term', label: 'Prazo', group: 'Cadastro', aliases: ['prazo', 'term', 'duration'] },
  { id: 'adminFee', label: 'Taxa de administração', group: 'Custos', aliases: ['taxaAdministracao', 'taxa de administração', 'adminFee', 'administrationFee'] },
  { id: 'targetAudience', label: 'Público-alvo', group: 'Cadastro', aliases: ['publicoAlvo', 'público-alvo', 'targetAudience'] }
];

const LARGE_MONEY_PROFILE_IDS = new Set(['marketCap', 'equity', 'enterpriseValue', 'assets', 'grossDebt', 'netDebt', 'cash', 'dailyLiquidity']);
const AGGREGATE_MONEY_IDS = new Set([
  ...LARGE_MONEY_PROFILE_IDS,
  'valorDeMercado', 'valorMercado', 'marketCap', 'marketValue',
  'valorDeFirma', 'valorFirma', 'enterpriseValue', 'ev',
  'patrimonioLiquido', 'equity', 'netWorth', 'valorPatrimonialTotal',
  'ativos', 'ativosTotais', 'totalAssets', 'assets',
  'dividaBruta', 'grossDebt', 'dividaLiquida', 'netDebt',
  'disponibilidade', 'disponibilidades', 'cash', 'caixa',
  'liquidezMediaDiaria', 'dailyLiquidity', 'averageDailyLiquidity',
  'totalInvestido', 'bensDireitosImoveis', 'titulosPublicos', 'titulosPrivados',
  'fundosRendaFixa', 'fiiInvestidos', 'fidc', 'cri', 'lci', 'valoresReceber', 'valoresPagar'
]);
const AGGREGATE_MONEY_LABEL_TOKENS = [
  'valor de mercado', 'market cap', 'valor da firma', 'enterprise value',
  'patrimonio liquido', 'patrimônio líquido', 'valor patrimonial total',
  'ativos', 'ativos totais', 'divida bruta', 'dívida bruta', 'divida liquida', 'dívida líquida',
  'disponibilidade', 'disponibilidades', 'caixa', 'liquidez media diaria', 'liquidez média diária',
  'total investido', 'bens e direitos', 'titulos publicos', 'títulos públicos', 'titulos privados', 'títulos privados',
  'fundos renda fixa', 'fiis investidos', 'fidc', 'cri', 'lci', 'valores a receber', 'valores a pagar'
].map(norm);

function hasExplicitMoneyScale(value = '') {
  return /\b(tri(?:lh(?:ã|a)o|lh(?:õ|o)es)?|trilh(?:ã|a)o|trilh(?:õ|o)es|bilh(?:ã|a)o|bilh(?:õ|o)es|bi|milh(?:ã|a)o|milh(?:õ|o)es|mi|mil|[KMBT])\b/i.test(cleanText(value));
}

function aggregateMoneySpec(spec = {}) {
  const id = cleanText(spec.id);
  const label = norm(spec.label || '');
  return AGGREGATE_MONEY_IDS.has(id) || AGGREGATE_MONEY_IDS.has(id.replace(/^[a-z]+_/, '')) || AGGREGATE_MONEY_LABEL_TOKENS.some(token => token && label.includes(token));
}

function rawNumericValue(value) {
  return value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
}

function suppressUnscaledAggregateMoney(value, spec = {}) {
  if (!aggregateMoneySpec(spec)) return false;
  const text = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label || value?.raw || value?.value || value?.valor || value?.amount || value);
  if (hasExplicitMoneyScale(text)) return false;
  const n = finiteValue(rawNumericValue(value));
  return n !== undefined && Math.abs(n) > 0 && Math.abs(n) < 1000;
}

function firstMoneyExpression(value) {
  const raw = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label || value?.value || value?.valor || value?.amount || value?.raw || value);
  if (!raw) return '';
  const scale = '(?:\\btri(?:lh(?:ã|a)o|lh(?:õ|o)es)?\\b(?![A-Za-zÀ-ÿ])|\\btrilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\btrilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bbilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\bbilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bbi\\b(?![A-Za-zÀ-ÿ])|\\bmilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\bmilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bmi\\b(?![A-Za-zÀ-ÿ])|\\bmil\\b(?![A-Za-zÀ-ÿ])|\\b[KMBT]\\b(?![A-Za-zÀ-ÿ]))';
  const money = raw.match(new RegExp(String.raw`R\$\s*[+-]?[\d.]+(?:,\d+)?(?:\s*${scale})?`, 'i'));
  return money ? money[0].replace(/\s+/g, ' ').trim() : '';
}

function compactMoneyExpression(value) {
  const money = firstMoneyExpression(value);
  if (!money) return '';
  const n = finiteValue(money);
  return n === undefined ? money : `R$ ${compactDisplay(n)}`;
}

function compactMoneyDisplay(value) {
  const n = finiteValue(value);
  return n === undefined ? '' : `R$ ${compactDisplay(n)}`;
}

function profileDisplay(value, spec = {}) {
  const display = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label);
  const raw = rawNumericValue(value);
  if (aggregateMoneySpec(spec)) {
    if (suppressUnscaledAggregateMoney(value, spec)) return '';
    const money = firstMoneyExpression(value) || firstMoneyExpression(raw);
    if (money && hasExplicitMoneyScale(money)) return compactMoneyExpression(money) || money;
    const compact = compactMoneyDisplay(raw);
    if (compact) return compact;
    if (money && !suppressUnscaledAggregateMoney(money, spec)) return money;
    return cleanText(raw);
  }
  if (display && display !== '-' && display !== '--') return display;
  if (raw === undefined || raw === null) return '';
  if (spec.id === 'shares') {
    const n = finiteValue(raw);
    return n === undefined ? cleanText(raw) : compactDisplay(n);
  }
  return cleanText(raw);
}

function profileValueByAliases(info = {}, spec = {}) {
  return valueByAliases(info, [spec.id, spec.label, ...(spec.aliases || [])]);
}

function addProfileItem(rows, seen, spec, rawValue, source = 'StatusInvest/Investidor10') {
  const value = profileDisplay(rawValue, spec);
  const numeric = finiteValue(rawNumericValue(rawValue));
  if (numeric === 0 && ['enterpriseValue', 'assets', 'grossDebt', 'netDebt', 'cash', 'dailyLiquidity', 'marketCap', 'equity', 'shares'].includes(spec.id)) return;
  if (!value || value === '-' || value === '--' || /^R\$\s*0([,.]00)?$/.test(value) || /^0([,.]0+)?$/.test(value)) return;
  const key = `${spec.id}|${value}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ id: `profile_${spec.id}`, label: spec.label, value, group: spec.group || 'Cadastro', source });
}

function collectCompanyProfileSources(payload = {}) {
  const results = payload.results || {};
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || results.assetChartBundle || results.assetChartsMobile || {};
  return [
    { source: 'StatusInvest/Investidor10 perfil', value: payload.companyInfo },
    { source: 'StatusInvest/Investidor10 perfil', value: payload.empresa },
    { source: 'StatusInvest/Investidor10 perfil', value: payload.fundo },
    { source: 'StatusInvest/Investidor10 perfil', value: payload.profile },
    { source: 'StatusInvest/Investidor10 perfil', value: payload.fundamentals?.profile },
    { source: 'StatusInvest/Investidor10 perfil', value: results.dadosEmpresa },
    { source: 'StatusInvest/Investidor10 perfil', value: results.informacoesEmpresa },
    { source: 'StatusInvest/Investidor10 perfil', value: results.informacoesFundo },
    { source: 'Investidor10 cadastro', value: results.cadastroEmpresa },
    { source: 'Investidor10 cadastro', value: results.cadastroFundo },
    { source: 'Investidor10 informações da empresa', value: payload.assetChartsCanonical?.info },
    { source: 'Investidor10 informações da empresa', value: results.assetChartsCanonical?.info },
    { source: 'VALORAE assetChartBundle', value: bundle.companyProfile || bundle.fundProfile }
  ].filter(entry => entry.value && typeof entry.value === 'object');
}

function buildCompanyProfileItems(payload = {}, assetType = '') {
  const isFii = String(assetType).toUpperCase() === 'FII';
  const merged = {};
  for (const entry of collectCompanyProfileSources(payload)) Object.assign(merged, objectFrom(entry.value));

  const info = {
    ...merged,
    descricao: firstClean(payload.assetDescription, payload.description, payload.descricao, merged.descricao, merged.description, merged.sobre, merged.resumo),
    setor: firstClean(payload.sector, payload.setor, merged.setor, merged.sector),
    subsetor: firstClean(payload.subSector, payload.subsetor, merged.subsetor, merged.subSector),
    segmento: firstClean(payload.segment, payload.fiiSegment, payload.segmento, merged.segmento, merged.segment),
    cnpj: firstClean(payload.cnpj, merged.cnpj),
    site: firstClean(payload.site, payload.website, merged.site, merged.website),
    valorMercado: firstClean(payload.marketCap, payload.valorDeMercado, payload.valorMercado, merged.valorDeMercado, merged.valorMercado, merged.marketCap),
    patrimonioLiquido: firstClean(payload.equity, payload.netWorth, payload.patrimonioLiquido, merged.patrimonioLiquido, merged.equity, merged.netWorth),
    valorFirma: firstClean(payload.enterpriseValue, payload.valorDeFirma, payload.valorFirma, merged.valorDeFirma, merged.valorFirma, merged.enterpriseValue, payload.ev, merged.ev),
    ativos: firstClean(payload.assets, payload.totalAssets, payload.ativosTotais, payload.ativos, merged.assets, merged.totalAssets, merged.ativosTotais, merged.ativos),
    dividaBruta: firstClean(payload.grossDebt, payload.dividaBruta, merged.grossDebt, merged.dividaBruta),
    dividaLiquida: firstClean(payload.netDebt, payload.dividaLiquida, merged.netDebt, merged.dividaLiquida),
    disponibilidade: firstClean(payload.cash, payload.disponibilidade, payload.disponibilidades, payload.caixa, merged.cash, merged.disponibilidade, merged.disponibilidades, merged.caixa),
    liquidezMediaDiaria: firstClean(payload.dailyLiquidity, payload.liquidezMediaDiaria, merged.dailyLiquidity, merged.liquidezMediaDiaria)
  };

  const rows = [];
  const seen = new Set();
  const description = cleanText(info.descricao);
  if (description) rows.push({ id: 'profile_description', label: isFii ? 'Sobre o fundo' : 'Sobre a empresa', value: description, group: 'Descrição', source: 'StatusInvest/Investidor10 perfil' });

  const specs = isFii ? FII_PROFILE_FIELDS : STOCK_PROFILE_FIELDS;
  for (const spec of specs) {
    const rawValue = profileValueByAliases(info, spec);
    if (rawValue !== undefined && rawValue !== null) addProfileItem(rows, seen, spec, rawValue);
  }

  // Mantém dados cadastrais extras reais, mas sem duplicar os campos oficiais do checkpoint 31.
  const officialLabels = new Set([...specs.flatMap(spec => [spec.label, spec.id, ...(spec.aliases || [])]).map(norm), 'descricao', 'description', 'sobre', 'resumo']);
  for (const item of tableItemsFromObject(info, 'StatusInvest/Investidor10 perfil', 28)) {
    if (officialLabels.has(norm(item.label)) || seen.has(`${item.id}|${item.value}`.toLowerCase())) continue;
    if (suppressUnscaledAggregateMoney(item.value, { id: item.id, label: item.label })) continue;
    if (rows.length >= 28) break;
    rows.push({ ...item, id: `profile_extra_${item.id}`, group: item.group || 'Dados capturados' });
  }
  return rows.slice(0, 32);
}

const REVENUE_BUSINESS_GROUP = 'Negócios que geram receita';
const REVENUE_REGION_GROUP = 'Regiões onde gera receita';

const REVENUE_BUSINESS_PATHS = [
  'assetChartBundle.revenueByBusiness',
  'assetChartsMobile.revenueByBusiness',
  'results.assetChartBundle.revenueByBusiness',
  'results.assetChartsMobile.revenueByBusiness',
  'results.companyChartsCanonical.revenueByBusiness',
  'results.companyChartsCanonical.businessRevenue',
  'results.assetChartsCanonical.revenueByBusiness',
  'results.empresa.negociosReceita',
  'results.empresa.negociosQueGeramReceita',
  'results.empresa.receitaPorNegocio',
  'empresa.negociosReceita',
  'empresa.negociosQueGeramReceita',
  'empresa.receitaPorNegocio',
  'negociosReceita',
  'negociosQueGeramReceita',
  'businessRevenue',
  'revenueByBusiness',
  'receitaPorNegocio',
  'segmentRevenue',
  'segmentsRevenue',
  'receitaPorSegmento',
  'segmentosReceita',
  'businessSegments',
  'operatingSegments',
  'segments',
  'graficos.negociosReceita',
  'graficos.receitaPorNegocio',
  'charts.revenueByBusiness',
  'charts.businessRevenue',
  'charts.segmentRevenue',
  'charts.receitaPorSegmento',
  'revenueSegment',
  'revenue_segment',
  'embedded.revenueSegment',
  'results.embedded.revenueSegment',
  'apiExtras.embedded.revenueSegment',
  'results.apiExtras.embedded.revenueSegment',
  'companyBussinesRevenuesChartPie',
  'companyBusinessRevenuesChartPie',
  'results.revenueSegment',
  'results.revenue_segment',
  'results.assetChartsCanonical.revenueSegment',
  'results.assetChartsCanonical.revenueBreakdowns.business',
  'results.assetChartsCanonical.revenueBreakdowns.segment',
  'results.assetChartsCanonical.revenueBreakdowns.byBusiness',
  'results.sections.empresa.revenueSegment',
  'results.sections.empresa.revenueByBusiness',
  'results.sections.apiRevenueBreakdownSources.business',
  'results.sections.apiRevenueBreakdownSources.segment'
];

const REVENUE_REGION_PATHS = [
  'assetChartBundle.revenueByRegion',
  'assetChartsMobile.revenueByRegion',
  'results.assetChartBundle.revenueByRegion',
  'results.assetChartsMobile.revenueByRegion',
  'results.companyChartsCanonical.revenueByRegion',
  'results.companyChartsCanonical.regionRevenue',
  'results.assetChartsCanonical.revenueByRegion',
  'results.empresa.regioesReceita',
  'results.empresa.regioesOndeGeraReceita',
  'results.empresa.receitaPorRegiao',
  'empresa.regioesReceita',
  'empresa.regioesOndeGeraReceita',
  'empresa.receitaPorRegiao',
  'regioesReceita',
  'regioesOndeGeraReceita',
  'regionRevenue',
  'revenueByRegion',
  'receitaPorRegiao',
  'geographicRevenue',
  'geographyRevenue',
  'mercadoInternoExterno',
  'domesticExternalRevenue',
  'regionalRevenue',
  'geographicSegments',
  'geographySegments',
  'graficos.regioesReceita',
  'graficos.receitaPorRegiao',
  'charts.revenueByRegion',
  'charts.regionRevenue',
  'charts.geographicRevenue',
  'charts.mercadoInternoExterno',
  'revenueGeography',
  'revenue_geography',
  'embedded.revenueGeography',
  'results.embedded.revenueGeography',
  'apiExtras.embedded.revenueGeography',
  'results.apiExtras.embedded.revenueGeography',
  'companyRevenuesChartPie',
  'results.revenueGeography',
  'results.revenue_geography',
  'results.assetChartsCanonical.revenueGeography',
  'results.assetChartsCanonical.revenueBreakdowns.geography',
  'results.assetChartsCanonical.revenueBreakdowns.region',
  'results.assetChartsCanonical.revenueBreakdowns.byRegion',
  'results.sections.empresa.revenueGeography',
  'results.sections.empresa.revenueByRegion',
  'results.sections.apiRevenueBreakdownSources.geography',
  'results.sections.apiRevenueBreakdownSources.region'
];

function valueAtPath(payload = {}, path = '') {
  return path.split('.').reduce((acc, key) => acc?.[key], payload);
}

function normalizeRevenuePercent(rawValue) {
  const text = cleanText(rawValue?.display || rawValue?.formatted || rawValue?.fmt || rawValue?.percentual || rawValue?.percentage || rawValue?.percent || rawValue?.valuePercent || rawValue?.share || rawValue?.value || rawValue?.valor || rawValue);
  const n = finiteValue(rawValue?.percentual ?? rawValue?.percentage ?? rawValue?.percent ?? rawValue?.valuePercent ?? rawValue?.share ?? rawValue?.value ?? rawValue?.valor ?? rawValue?.raw ?? rawValue);
  if (n === undefined || n <= 0) return null;
  const adjusted = Math.abs(n) <= 1.5 && /%|0[.,]\d+/.test(text) ? n * 100 : n;
  if (!Number.isFinite(adjusted) || adjusted <= 0 || adjusted > 100) return null;
  return Number(adjusted.toFixed(4));
}

function revenueDisplay(value) {
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(value)}%`;
}

function revenueLabelFromRow(row = {}, fallback = '') {
  return cleanText(
    row.label || row.name || row.nome || row.segmento || row.segment || row.business || row.negocio ||
    row.region || row.regiao || row.região || row.market || row.mercado || row.geography || row.tipo || fallback
  );
}


function chartLikeRevenueEntries(node = {}) {
  const out = [];
  if (!node || typeof node !== 'object' || Array.isArray(node)) return out;
  const labels = Array.isArray(node.labels) ? node.labels : Array.isArray(node.categories) ? node.categories : Array.isArray(node.legends) ? node.legends : [];
  const dataSource = Array.isArray(node.data) ? node.data : Array.isArray(node.values) ? node.values : null;
  const directPeriod = cleanText(node.year || node.ano || node.period || node.periodo || node.label || node.name);
  if (labels.length && dataSource && dataSource.length === labels.length) {
    labels.forEach((label, index) => out.push({ label, value: dataSource[index], period: directPeriod }));
  }
  const datasets = Array.isArray(node.datasets) ? node.datasets : Array.isArray(node.series) ? node.series : [];
  for (const dataset of datasets) {
    if (!dataset || typeof dataset !== 'object') continue;
    const data = Array.isArray(dataset.data) ? dataset.data : Array.isArray(dataset.values) ? dataset.values : [];
    const period = cleanText(dataset.year || dataset.ano || dataset.period || dataset.periodo || dataset.label || dataset.name || directPeriod);
    if (labels.length && data.length === labels.length && data.every(item => typeof item !== 'object')) {
      labels.forEach((label, index) => out.push({ label, value: data[index], period }));
      continue;
    }
    for (const point of data) {
      if (point && typeof point === 'object') {
        out.push({
          label: point.name || point.label || point.category || point.x || dataset.name || dataset.label,
          value: point.y ?? point.value ?? point.percent ?? point.percentage ?? point.valor,
          period: cleanText(point.year || point.ano || point.period || point.periodo || period)
        });
      }
    }
  }
  return out;
}

function objectLooksLikeYearBuckets(node = {}) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const keys = Object.keys(node);
  return keys.some(key => /^\d{4}$/.test(String(key).trim())) && keys.some(key => {
    const value = node[key];
    return value && typeof value === 'object';
  });
}

function latestRevenueBucket(node = {}) {
  if (!objectLooksLikeYearBuckets(node)) return node;
  const years = Object.keys(node).filter(key => /^\d{4}$/.test(String(key).trim())).sort((a, b) => Number(b) - Number(a));
  return years.length ? node[years[0]] : node;
}

function collectRevenueRowsFromValue(value, source = 'Investidor10/StatusInvest') {
  const rows = [];
  const consume = (label, raw, period = '') => {
    const percent = normalizeRevenuePercent(raw);
    const cleanLabel = cleanText(label);
    if (!cleanLabel || percent === null) return;
    rows.push({ label: cleanLabel, percent, period: cleanText(period), source });
  };

  const walk = (node, fallbackLabel = '', inheritedPeriod = '') => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, fallbackLabel, inheritedPeriod);
      return;
    }
    if (typeof node !== 'object') {
      consume(fallbackLabel, node, inheritedPeriod);
      return;
    }

    if (objectLooksLikeYearBuckets(node)) {
      const years = Object.keys(node).filter(key => /^\d{4}$/.test(String(key).trim())).sort((a, b) => Number(b) - Number(a));
      for (const year of years.slice(0, 3)) walk(node[year], fallbackLabel, year);
      return;
    }

    const chartEntries = chartLikeRevenueEntries(node);
    if (chartEntries.length) {
      chartEntries.forEach(entry => consume(entry.label, entry.value, entry.period || inheritedPeriod));
      return;
    }

    const directLabel = revenueLabelFromRow(node, fallbackLabel);
    const directPeriod = cleanText(node.year || node.ano || node.period || node.periodo || inheritedPeriod);
    const directRaw = node.percentual ?? node.percentage ?? node.percent ?? node.valuePercent ?? node.share ?? node.participacao ?? node.participação ?? node.value ?? node.valor ?? node.amount ?? node.display;
    if (directLabel && directRaw !== undefined) {
      consume(directLabel, directRaw, directPeriod);
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (['source', 'updatedAt', 'generatedAt', 'metadata', 'diagnostics', 'total', 'sum'].includes(key)) continue;
      const keyPeriod = /^\d{4}$/.test(String(key).trim()) ? String(key).trim() : inheritedPeriod;
      if (Array.isArray(child)) {
        child.forEach(item => walk(item, key, keyPeriod));
      } else if (child && typeof child === 'object') {
        const label = revenueLabelFromRow(child, key);
        const raw = child.percentual ?? child.percentage ?? child.percent ?? child.valuePercent ?? child.share ?? child.participacao ?? child.participação ?? child.value ?? child.valor ?? child.amount ?? child.display;
        if (label && raw !== undefined) consume(label, raw, cleanText(child.year || child.ano || child.period || child.periodo || keyPeriod));
        else walk(child, key, keyPeriod);
      } else {
        consume(key, child, keyPeriod);
      }
    }
  };

  walk(value);
  return rows;
}

function collectRevenueRows(payload = {}, paths = [], source = 'Investidor10/StatusInvest') {
  const rows = [];
  for (const path of paths) {
    const value = valueAtPath(payload, path);
    if (value !== undefined && value !== null) rows.push(...collectRevenueRowsFromValue(value, source));
  }
  return rows;
}

function compactNorm(value = '') {
  return norm(value).replace(/\s+/g, '');
}

const REVENUE_BUSINESS_KEY_HINTS = new Set([
  'revenuebybusiness', 'businessrevenue', 'negociosreceita', 'negociosquegeramreceita',
  'receitapornegocio', 'segmentrevenue', 'segmentsrevenue', 'receitaporsegmento',
  'segmentosreceita', 'businesssegments', 'operatingsegments', 'segmentosoperacionais',
  'revenuesegment', 'revenue_segment', 'companybussinesrevenueschartpie', 'companybusinessrevenueschartpie',
  'business', 'bybusiness'
]);

const REVENUE_REGION_KEY_HINTS = new Set([
  'revenuebyregion', 'regionrevenue', 'regioesreceita', 'regioesondegerareceita',
  'receitaporregiao', 'geographicrevenue', 'geographyrevenue', 'regionalrevenue',
  'mercadointernoexterno', 'domesticexternalrevenue', 'geographicsegments', 'geographysegments',
  'revenuegeography', 'revenue_geography', 'companyrevenueschartpie', 'geography', 'byregion', 'region'
]);

function collectRevenueRowsByKey(payload = {}, keyHints = new Set(), source = 'Investidor10/StatusInvest extração ampliada') {
  const rows = [];
  const visited = new Set();
  const walk = (node, depth = 0) => {
    if (!node || depth > 7) return;
    if (typeof node !== 'object') return;
    if (visited.has(node)) return;
    visited.add(node);
    if (Array.isArray(node)) {
      node.forEach(child => walk(child, depth + 1));
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      const normalizedKey = compactNorm(key);
      if (keyHints.has(normalizedKey)) {
        rows.push(...collectRevenueRowsFromValue(value, source));
        continue;
      }
      if (value && typeof value === 'object') walk(value, depth + 1);
    }
  };
  walk(payload);
  return rows;
}

function dedupeRevenueRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const label = cleanText(row.label);
    const period = cleanText(row.period);
    const percent = Number(row.percent);
    if (!label || !Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
    const key = `${norm(label)}|${period || 'sem_periodo'}`;
    const current = map.get(key);
    if (!current || percent > current.percent) map.set(key, { label, period, percent, source: row.source || 'Investidor10/StatusInvest' });
  }
  return [...map.values()].sort((a, b) => String(b.period || '').localeCompare(String(a.period || '')) || b.percent - a.percent);
}

function revenueGroupTitle(group = 'Distribuição', period = '') {
  const p = cleanText(period);
  return p ? `${group} • ${p}` : group;
}

function revenueItemsFromRows(rows = [], group = 'Distribuição') {
  return rows.map(row => ({
    id: `${group === REVENUE_BUSINESS_GROUP ? 'business' : 'region'}_${norm(row.label).replace(/\s+/g, '_')}_${norm(row.period || 'atual').replace(/\s+/g, '_')}`,
    label: row.label,
    value: revenueDisplay(row.percent),
    group: revenueGroupTitle(group, row.period),
    source: row.source || 'Investidor10/StatusInvest'
  }));
}

function revenuePeriodBuckets(rows = []) {
  const buckets = new Map();
  for (const row of rows) {
    const key = cleanText(row.period) || 'Atual';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()].sort((a, b) => {
    if (a[0] === 'Atual') return -1;
    if (b[0] === 'Atual') return 1;
    return String(b[0]).localeCompare(String(a[0]));
  });
}

function revenueChartFromRows(id, title, rows = [], source = 'Investidor10/StatusInvest') {
  if (!rows.length) return [];
  const charts = [];
  const buckets = revenuePeriodBuckets(rows).slice(0, 2);
  for (const [period, periodRows] of buckets) {
    const hasRealPeriod = period !== 'Atual';
    const chartId = hasRealPeriod && charts.length > 0 ? `${id}_${norm(period).replace(/\s+/g, '_')}` : id;
    charts.push({
      id: chartId,
      title: hasRealPeriod ? `${title} • ${period}` : title,
      chartType: 'donut_composition',
      source,
      unit: '%',
      series: [{
        id: 'share',
        label: title,
        points: periodRows.map(row => ({ label: row.label.slice(0, 24), value: row.percent, display: revenueDisplay(row.percent) }))
      }]
    });
  }
  return charts;
}

function buildRevenueBreakdown(payload = {}) {
  const businessRows = dedupeRevenueRows([
    ...collectRevenueRows(payload, REVENUE_BUSINESS_PATHS, 'Investidor10/StatusInvest negócios de receita'),
    ...collectRevenueRowsByKey(payload, REVENUE_BUSINESS_KEY_HINTS, 'Investidor10/StatusInvest negócios de receita')
  ]);
  const regionRows = dedupeRevenueRows([
    ...collectRevenueRows(payload, REVENUE_REGION_PATHS, 'Investidor10/StatusInvest regiões de receita'),
    ...collectRevenueRowsByKey(payload, REVENUE_REGION_KEY_HINTS, 'Investidor10/StatusInvest regiões de receita')
  ]);

  const items = [
    ...revenueItemsFromRows(businessRows, REVENUE_BUSINESS_GROUP),
    ...revenueItemsFromRows(regionRows, REVENUE_REGION_GROUP)
  ];
  const charts = [
    ...revenueChartFromRows('revenue_by_business', REVENUE_BUSINESS_GROUP, businessRows),
    ...revenueChartFromRows('revenue_by_region', 'Regiões onde gera receita', regionRows)
  ].filter(Boolean);

  return { items, charts };
}


const MARKET_CONTEXT_FIELDS = [
  { id: 'min52Weeks', label: 'Mín. 52 semanas', group: 'Faixa de preço', unit: 'R$', aliases: ['min52Weeks', 'min52', 'minimo52Semanas', 'mínimo 52 semanas', 'min 52 semanas', 'minimo52', 'min52w'] },
  { id: 'max52Weeks', label: 'Máx. 52 semanas', group: 'Faixa de preço', unit: 'R$', aliases: ['max52Weeks', 'max52', 'maximo52Semanas', 'máximo 52 semanas', 'max 52 semanas', 'maximo52', 'max52w'] },
  { id: 'minMonth', label: 'Mín. mês', group: 'Faixa de preço', unit: 'R$', aliases: ['minMonth', 'minimoMes', 'mínimo mês', 'min mes', 'min mês'] },
  { id: 'maxMonth', label: 'Máx. mês', group: 'Faixa de preço', unit: 'R$', aliases: ['maxMonth', 'maximoMes', 'máximo mês', 'max mes', 'max mês'] },
  { id: 'valuation12m', label: 'Valorização 12M', group: 'Desempenho', unit: '%', aliases: ['valuation12m', 'valorizacao12m', 'valorização 12m', 'Valorização (12m)', 'variation12m', 'change12m'] },
  { id: 'monthVariation', label: 'Variação no mês', group: 'Desempenho', unit: '%', aliases: ['monthVariation', 'variacaoMes', 'variação mês', 'Mês atual', 'currentMonthVariation'] },
  { id: 'historicalVolatility', label: 'Volatilidade 12M', group: 'Risco', unit: '%', aliases: ['historicalVolatility', 'volatilidadeHistorica', 'volatilidade histórica', 'volatilidade12m', 'volatility12m'] },
  { id: 'dailyLiquidity', label: 'Liquidez média diária', group: 'Liquidez', unit: 'R$', aliases: ['dailyLiquidity', 'liquidezMediaDiaria', 'liquidez média diária', 'averageDailyLiquidity'] },
  { id: 'tagAlong', label: 'Tag along', group: 'Governança', unit: '%', aliases: ['tagAlong', 'tag along', 'tagalong'] },
  { id: 'freeFloat', label: 'Free float', group: 'Governança', unit: '%', aliases: ['freeFloat', 'free float', 'freefloat'] },
  { id: 'ibovParticipation', label: 'Participação no IBOV', group: 'Índices', unit: '%', aliases: ['ibovParticipation', 'participacaoIbov', 'participação no ibov', 'partIbov'] },
  { id: 'openOptions', label: 'Opções em aberto', group: 'Mercado', aliases: ['openOptions', 'opcoesEmAberto', 'opções em aberto', 'mercadoOpcoes'] },
  { id: 'assetKind', label: 'Tipo', group: 'Cadastro', aliases: ['assetKind', 'tipoAtivo', 'tipo', 'kind'] }
];

function valueFromCandidate(candidate = {}, aliases = []) {
  if (!candidate || typeof candidate !== 'object') return undefined;
  const direct = valueByAliases(candidate, aliases);
  if (direct !== undefined) return direct;
  for (const childKey of ['quote', 'cotacao', 'tickerInfo', 'market', 'mercado', 'summary', 'resumo', 'results', 'indicators', 'fundamentals', 'empresa', 'fundo', 'profile']) {
    const child = candidate[childKey];
    if (child && typeof child === 'object') {
      const value = valueByAliases(child, aliases);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function contextDisplay(value, spec = {}) {
  const rawDisplay = cleanText(value?.display || value?.formatted || value?.fmt || value?.text);
  const raw = rawNumericValue(value);
  if (spec.unit === 'R$') {
    if (suppressUnscaledAggregateMoney(value, spec)) return '';
    const money = firstMoneyExpression(value) || firstMoneyExpression(raw);
    if (money && hasExplicitMoneyScale(money)) return compactMoneyExpression(money) || money;
    const compact = compactMoneyDisplay(raw);
    if (compact) return compact;
    if (money && !suppressUnscaledAggregateMoney(money, spec)) return money;
  }
  if (rawDisplay && rawDisplay !== '-' && rawDisplay !== '--') return rawDisplay;
  const n = finiteValue(raw);
  if (n !== undefined) {
    if (spec.unit === 'R$') return `R$ ${compactDisplay(n)}`;
    if (spec.unit === '%') return percentDisplay(n);
    if (spec.id === 'openOptions') return compactDisplay(n);
    return decimalDisplay(n);
  }
  return cleanText(raw);
}

function buildMarketContextItems(payload = {}, assetType = '') {
  const candidates = [
    payload, payload.results, payload.quote, payload.results?.quote, payload.market, payload.results?.market,
    payload.companyInfo, payload.empresa, payload.fundo, payload.results?.dadosEmpresa,
    payload.results?.informacoesEmpresa, payload.results?.informacoesFundo,
    payload.results?.sections?.empresa, payload.results?.sections?.fundo, payload.sections?.empresa, payload.sections?.fundo
  ].filter(Boolean);
  const rows = [];
  const seen = new Set();
  for (const spec of MARKET_CONTEXT_FIELDS) {
    let raw;
    for (const candidate of candidates) {
      raw = valueFromCandidate(candidate, [spec.id, spec.label, ...(spec.aliases || [])]);
      if (raw !== undefined && raw !== null && cleanText(raw) !== '') break;
    }
    if (raw === undefined || raw === null) continue;
    const display = contextDisplay(raw, spec);
    const numeric = finiteValue(rawNumericValue(raw));
    if (!display || display === '-' || display === '--') continue;
    const zeroIsUnavailable = ['dailyLiquidity', 'ibovParticipation', 'openOptions', 'min52Weeks', 'max52Weeks', 'minMonth', 'maxMonth'].includes(spec.id);
    if (numeric === 0 && zeroIsUnavailable) continue;
    if (['valuation12m', 'monthVariation'].includes(spec.id) && numeric !== undefined && numeric < -100) continue;
    if (spec.unit === 'R$' && ['dailyLiquidity'].includes(spec.id) && numeric !== undefined && numeric > 0 && numeric < 1000 && !hasExplicitMoneyScale(display)) continue;
    const key = `${spec.id}|${display}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: `market_${spec.id}`, label: spec.label, value: display, group: spec.group, source: 'StatusInvest/Investidor10 mercado' });
  }
const usefulGroups = new Set(['faixa de preco', 'faixa de preço', 'desempenho', 'risco', 'liquidez', 'aluguel de acoes', 'aluguel de ações', 'mercado']);
  for (const path of ['sourceFacts', 'results.sourceFacts', 'results.sections.empresa.sourceFacts', 'results.sections.fundo.sourceFacts', 'sections.empresa.sourceFacts', 'sections.fundo.sourceFacts']) {
    for (const fact of arrayFrom(valueAtPath(payload, path))) {
      const groupNorm = norm(fact?.group || '');
      if (!usefulGroups.has(groupNorm)) continue;
      const label = cleanText(fact?.label || fact?.name || fact?.title);
      const value = cleanText(fact?.value || fact?.display || fact?.valor);
      if (!label || !value || value === '-' || value === '--') continue;
      const key = `${norm(label)}|${norm(value)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id: `market_fact_${rows.length + 1}`, label, value, group: fact.group || 'Mercado', source: fact.source || 'StatusInvest/Investidor10 mercado' });
    }
  }
  return rows.slice(0, 24);
}


const VALUATION_MODEL_FIELDS = [
  { id: 'grahamFairPrice', label: 'Preço justo de Graham', group: 'Modelos de valuation', unit: 'R$', aliases: ['grahamFairPrice', 'precoJustoGraham', 'preço justo de graham', 'Preço Justo', 'valorJustoGraham'] },
  { id: 'grahamCurrentPrice', label: 'Preço atual no modelo Graham', group: 'Modelos de valuation', unit: 'R$', aliases: ['grahamCurrentPrice', 'precoAtualGraham', 'Preço Atual'] },
  { id: 'grahamUpside', label: 'Potencial Graham', group: 'Modelos de valuation', unit: '%', aliases: ['grahamUpside', 'upsideGraham', 'potencialGraham', 'Upside Graham'] },
  { id: 'bazinCeilingPrice', label: 'Preço-teto Bazin', group: 'Modelos de valuation', unit: 'R$', aliases: ['bazinCeilingPrice', 'precoTetoBazin', 'preço-teto de bazin', 'Preço-teto', 'preco teto'] },
  { id: 'bazinCurrentPrice', label: 'Preço atual no modelo Bazin', group: 'Modelos de valuation', unit: 'R$', aliases: ['bazinCurrentPrice', 'precoAtualBazin', 'Preço Atual Bazin'] },
  { id: 'bazinUpside', label: 'Potencial Bazin', group: 'Modelos de valuation', unit: '%', aliases: ['bazinUpside', 'upsideBazin', 'potencialBazin', 'Upside Bazin'] },
  { id: 'bazinMinimumDy', label: 'DY mínimo Bazin', group: 'Modelos de valuation', unit: '%', aliases: ['bazinMinimumDy', 'dyMinimoBazin', 'dy mínimo', 'Dividend Yield Desejado'] }
];

function displayByUnit(raw, unit = '', spec = {}) {
  const explicit = cleanText(raw?.display || raw?.formatted || raw?.fmt || raw?.text || raw?.label);
  const value = rawNumericValue(raw);
  if (unit === 'R$') {
    if (suppressUnscaledAggregateMoney(raw, spec)) return '';
    const money = firstMoneyExpression(raw) || firstMoneyExpression(value);
    if (money && hasExplicitMoneyScale(money)) return compactMoneyExpression(money) || money;
    return compactMoneyDisplay(value) || (money && !suppressUnscaledAggregateMoney(money, spec) ? money : '') || cleanText(value);
  }
  if (explicit && explicit !== '-' && explicit !== '--') return explicit;
  if (unit === '%') return percentDisplay(value) || cleanText(value);
  return decimalDisplay(value) || cleanText(value);
}

function collectObjectCandidates(payload = {}, paths = []) {
  const out = [];
  const seen = new Set();
  for (const path of paths) {
    const value = valueAtPath(payload, path);
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

const VALUATION_MODEL_PATHS = [
  'valuationModels',
  'valuation',
  'results.valuationModels',
  'results.valuation',
  'results.sections.empresa.valuationModels',
  'results.sections.empresa.precoJusto',
  'results.sections.empresa.modelosValuation',
  'results.assetChartsCanonical.company.valuationModels',
  'assetChartsCanonical.company.valuationModels'
];

function buildValuationModelItems(payload = {}, assetType = '') {
  if (!isCompanyLikeAssetType(assetType)) return [];
  const merged = {};
  for (const candidate of collectObjectCandidates(payload, VALUATION_MODEL_PATHS)) Object.assign(merged, objectFrom(candidate));
  const rows = [];
  const seen = new Set();
  for (const spec of VALUATION_MODEL_FIELDS) {
    const raw = valueByAliases(merged, [spec.id, spec.label, ...(spec.aliases || [])]);
    if (raw === undefined || raw === null) continue;
    const display = displayByUnit(raw, spec.unit, spec);
    const numeric = finiteValue(rawNumericValue(raw));
    if (!display || display === '-' || display === '--') continue;
    if (numeric === 0 && !['grahamCurrentPrice', 'bazinCurrentPrice'].includes(spec.id)) continue;
    const key = `${spec.id}|${display}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: `valuation_${spec.id}`, label: spec.label, value: display, group: spec.group, source: 'Investidor10 modelos Graham/Bazin' });
  }
  return rows.slice(0, 8);
}

function comparisonDisplay(raw, fallbackUnit = '') {
  const display = cleanText(raw?.display || raw?.formatted || raw?.fmt || raw?.text);
  if (display) return display;
  const value = raw?.value ?? raw?.valor ?? raw?.amount ?? raw?.raw ?? raw;
  if (fallbackUnit === '%') return percentDisplay(value) || cleanText(value);
  return decimalDisplay(value) || cleanText(value);
}

function sourceComparativeRowsFromCards(cards = []) {
  const rows = [];
  const seen = new Set();
  for (const card of arrayFrom(cards)) {
    const label = cleanText(card?.label || card?.name || card?.key);
    const comparisons = card?.comparisons || card?.comparativos || card?.comparative;
    if (!label || !comparisons || typeof comparisons !== 'object') continue;
    const value = ['setor', 'subsetor', 'segmento']
      .map(key => {
        const cmp = comparisons[key] || comparisons[key.charAt(0).toUpperCase() + key.slice(1)];
        const cmpLabel = cleanText(cmp?.label || ({ setor: 'Setor', subsetor: 'Subsetor', segmento: 'Segmento' })[key]);
        const cmpValue = comparisonDisplay(cmp, cmp?.unit || card.unit || '');
        return cmpValue ? `${cmpLabel}: ${cmpValue}` : '';
      })
      .filter(Boolean)
      .join(' • ');
    if (!value) continue;
    const key = norm(`${label}|${value}`);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ id: `source_comparative_${rows.length + 1}`, label, value, group: 'Comparativo setorial', source: card.source || 'Investidor10/StatusInvest comparativos de indicadores' });
  }
  return rows;
}

function buildSourceComparativeItemsAndCharts(payload = {}, assetType = '') {
  const candidates = [
    ...indicatorCards(payload),
    ...arrayFrom(payload.sourceComparatives),
    ...arrayFrom(payload.results?.sourceComparatives),
    ...arrayFrom(payload.results?.indicadoresFundamentalistas?.comparativosFonte),
    ...arrayFrom(payload.results?.sections?.comparativosFonte),
    ...arrayFrom(payload.results?.sections?.empresa?.sourceComparatives)
  ];
  const items = sourceComparativeRowsFromCards(candidates).slice(0, 28);
  const seriesByLabel = [];
  for (const card of candidates.slice(0, 8)) {
    const label = cleanText(card?.label || card?.name || card?.key);
    const base = finiteValue(card?.value ?? card?.raw ?? card?.valor);
    const comparisons = card?.comparisons || card?.comparativos || card?.comparative;
    if (!label || base === undefined || !comparisons) continue;
    const points = [{ label: 'Ativo', value: base, display: comparisonDisplay(card, card.unit || '') }];
    for (const key of ['setor', 'subsetor', 'segmento']) {
      const cmp = comparisons[key] || comparisons[key.charAt(0).toUpperCase() + key.slice(1)];
      const value = finiteValue(cmp?.value ?? cmp?.valor ?? cmp?.raw ?? cmp);
      if (value !== undefined) points.push({ label: cleanText(cmp?.label || key), value, display: comparisonDisplay(cmp, cmp?.unit || card.unit || '') });
    }
    if (points.length > 1) seriesByLabel.push({ id: norm(label).replace(/\s+/g, '_'), label, points });
  }
  const charts = seriesByLabel.length ? [{ id: 'source_indicator_comparatives', title: 'Indicadores x setor', chartType: 'grouped_bar', unit: '', source: 'Investidor10/StatusInvest comparativos de indicadores', series: seriesByLabel.slice(0, 6) }] : [];
  return { items, charts };
}

const INDICES_PATHS = [
  'indices',
  'statusInvestIndices',
  'investidor10Indices',
  'results.indices',
  'results.statusInvestIndices',
  'results.investidor10Indices',
  'results.sections.indices',
  'results.sections.empresa.indices',
  'results.sections.fundo.indices',
  'assetChartsCanonical.indices',
  'results.assetChartsCanonical.indices',
  'results.assetChartsCanonical.fii.indices',
  'assetChartsCanonical.fii.indices'
];

function normalizeIndexRows(value) {
  const rows = [];
  const add = (label, raw, source = 'StatusInvest/Investidor10 índices') => {
    const cleanLabel = cleanText(label).toUpperCase();
    const display = displayByUnit(raw, '%') || cleanText(raw);
    if (!cleanLabel || !display || display === '-' || display === '--') return;
    rows.push({ id: `index_${norm(cleanLabel).replace(/\s+/g, '_')}`, label: cleanLabel, value: display, group: 'Índices', source });
  };
  if (Array.isArray(value)) {
    value.forEach(item => add(item?.ticker || item?.code || item?.codigo || item?.name || item?.label || item?.index, item?.participacao ?? item?.participation ?? item?.percent ?? item?.percentage ?? item?.value ?? item?.valor ?? item?.display, item?.source));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') add(child.ticker || child.code || child.name || key, child.participacao ?? child.participation ?? child.percent ?? child.percentage ?? child.value ?? child.valor ?? child.display, child.source);
      else add(key, child);
    }
  }
  return rows;
}

function buildIndicesEventsItems(payload = {}, assetType = '') {
  const out = [];
  const seen = new Set();
  for (const path of INDICES_PATHS) {
    for (const row of normalizeIndexRows(valueAtPath(payload, path))) {
      const key = norm(`${row.label}|${row.value}`);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  const fiiInfo = isFiiAssetType(assetType) ? mergedFiiInfo(payload) : {};
  const ifix = valueByAliases(fiiInfo, ['participacaoIfix', 'participação no ifix', 'PARTICIPAÇÃO NO IFIX']);
  if (ifix !== undefined && ifix !== null) {
    const display = displayByUnit(ifix, '%');
    const key = norm(`IFIX|${display}`);
    if (display && !seen.has(key)) out.unshift({ id: 'index_ifix', label: 'IFIX', value: display, group: 'Índices', source: 'StatusInvest participação no IFIX' });
  }
  return out.slice(0, 24);
}

const OWNERSHIP_PATHS = [
  'ownership', 'shareholders', 'acionistas', 'posicaoAcionaria', 'posiçãoAcionária', 'posicao acionaria',
  'assetChartsCanonical.ownership', 'assetChartsCanonical.shareholders', 'assetChartsCanonical.company.ownership', 'assetChartsCanonical.company.shareholders', 'assetChartsCanonical.company.posicaoAcionaria',
  'companyChartsCanonical.ownership', 'companyChartsCanonical.shareholders', 'companyChartsCanonical.posicaoAcionaria',
  'sections.empresa.posicaoAcionaria', 'sections.empresa.ownership', 'sections.empresa.shareholders',
  'results.ownership', 'results.shareholders', 'results.acionistas', 'results.posicaoAcionaria',
  'results.assetChartsCanonical.ownership', 'results.assetChartsCanonical.shareholders', 'results.assetChartsCanonical.company.ownership', 'results.assetChartsCanonical.company.shareholders', 'results.assetChartsCanonical.company.posicaoAcionaria',
  'results.companyChartsCanonical.ownership', 'results.companyChartsCanonical.shareholders', 'results.companyChartsCanonical.posicaoAcionaria',
  'results.sections.posicaoAcionaria', 'results.sections.empresa.posicaoAcionaria', 'results.sections.empresa.ownership', 'results.sections.empresa.shareholders',
  'assetChartBundle.shareholders', 'assetChartsMobile.shareholders', 'results.assetChartBundle.shareholders', 'results.assetChartsMobile.shareholders'
];

function ownershipPercent(value) {
  const raw = value?.totalPercent ?? value?.percentTotal ?? value?.percentualTotal ?? value?.percentage ?? value?.percent ?? value?.total ?? value?.value ?? value?.valor ?? value;
  const n = finiteValue(raw);
  if (n === undefined || n <= 0) return null;
  const text = cleanText(raw);
  const adjusted = Math.abs(n) <= 1.5 && /%|0[.,]\d+/.test(text) ? n * 100 : n;
  if (!Number.isFinite(adjusted) || adjusted <= 0 || adjusted > 100) return null;
  return Number(adjusted.toFixed(4));
}

function normalizeOwnershipRows(value, source = 'Investidor10 posição acionária') {
  const rows = [];
  const consume = (row = {}, fallback = '') => {
    if (row == null) return;
    const objectRow = typeof row === 'object' && !Array.isArray(row) ? row : { value: row };
    const label = cleanText(objectRow.shareholder || objectRow.acionista || objectRow.name || objectRow.nome || objectRow.label || objectRow.title || fallback);
    const percent = ownershipPercent(objectRow);
    const display = percent !== null ? revenueDisplay(percent) : cleanText(objectRow.value || objectRow.valor || objectRow.display || objectRow.percentual || objectRow.percent || row);
    if (!label || !display || display === '-' || display === '--') return;
    if (/^posi[cç][aã]o acion[aá]ria$|^acionistas?$|^total$/i.test(label) && !/%|\d/.test(display)) return;
    rows.push({ label, value: display, percent, source });
  };
  const consumeArrayRow = (row = []) => {
    const cells = row.map(cell => cleanText(cell)).filter(Boolean);
    if (cells.length < 2) return;
    const headerLike = cells.join(' ').toLowerCase();
    if (/acionista|percentual|participa[cç][aã]o|total/.test(headerLike) && !/[0-9][0-9.,]*\s*%/.test(headerLike)) return;
    const percentCellIndex = cells.findIndex(cell => /[0-9][0-9.,]*\s*%/.test(cell));
    const valueIndex = percentCellIndex >= 0 ? percentCellIndex : 1;
    const labelIndex = valueIndex === 0 ? 1 : 0;
    consume({ label: cells[labelIndex], value: cells[valueIndex] });
  };
  const walk = (node, fallback = '') => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.every(item => item == null || typeof item !== 'object') && node.length >= 2) return consumeArrayRow(node);
      return node.forEach(item => walk(item, fallback));
    }
    if (typeof node !== 'object') {
      if (fallback) consume({ label: fallback, value: node });
      return;
    }
    if (node.rows || node.items || node.data || node.values || node.keyValues) {
      for (const item of arrayFrom(node.rows || node.items || node.data || node.values || node.keyValues)) walk(item, fallback);
    }
    const directLabel = cleanText(node.shareholder || node.acionista || node.name || node.nome || node.label || node.title || fallback);
    if (directLabel && (ownershipPercent(node) !== null || cleanText(node.value || node.valor || node.display || node.percentual || node.percent))) consume(node, fallback);
    for (const [key, child] of Object.entries(node)) {
      if (['source', 'metadata', 'diagnostics', 'rows', 'items', 'data', 'values', 'keyValues', 'text', 'length'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(item => walk(item, key));
      else if (child && typeof child === 'object') walk(child, key);
      else if (child !== undefined && child !== null && /%|percent|share|free|float|control/i.test(`${key} ${child}`)) consume({ label: key, value: child });
    }
  };
  walk(value);
  const seen = new Set();
  return rows.filter(row => {
    const key = `${norm(row.label)}|${cleanText(row.value)}`;
    if (!norm(row.label) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

function buildOwnershipSection(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() === 'FII') return { items: [], charts: [] };
  const rows = [];
  for (const path of OWNERSHIP_PATHS) {
    const value = valueAtPath(payload, path);
    if (value !== undefined && value !== null) rows.push(...normalizeOwnershipRows(value, path.includes('sections') ? 'Investidor10 seção Posição acionária' : 'Investidor10 posição acionária'));
  }
  const dedupedRows = [];
  const seenRows = new Set();
  for (const row of rows) {
    const key = norm(row.label);
    if (!key || seenRows.has(key)) continue;
    seenRows.add(key);
    dedupedRows.push(row);
  }
  const items = dedupedRows.map((row, index) => ({ id: `ownership_${index}_${norm(row.label).replace(/\s+/g, '_')}`, label: row.label, value: row.value, group: 'Posição acionária', source: row.source }));
  const chartRows = dedupedRows.filter(row => Number.isFinite(row.percent) && row.percent > 0 && row.percent <= 100).slice(0, 8);
  const charts = chartRows.length >= 2 ? [{
    id: 'ownership_distribution',
    title: 'Posição acionária',
    chartType: 'horizontal_bar_composition',
    source: 'Investidor10 posição acionária',
    unit: '%',
    series: [{ id: 'share', label: 'Participação', points: chartRows.map(row => ({ label: row.label.slice(0, 18), value: row.percent, display: revenueDisplay(row.percent) })) }]
  }] : [];
  return { items, charts };
}

const CHECKLIST_PATHS = [
  'checklistBuyHold', 'checklist_buy_hold', 'checklist', 'buyHoldChecklist',
  'results.checklistBuyHold', 'results.checklist_buy_hold', 'results.checklist',
  'results.sections.checklist', 'results.sections.checklistBuyHold', 'results.sections.checklistBah',
  'results.sections.empresa.checklistBuyHold', 'results.sections.empresa.checklist',
  'results.sections.fundo.checklistBuyHold', 'results.sections.fundo.checklist',
  'sections.checklistBuyHold', 'sections.checklist', 'sections.checklistBah',
  'sections.empresa.checklistBuyHold', 'sections.fundo.checklistBuyHold'
];

const FII_CHECKLIST_PATHS = [
  ...CHECKLIST_PATHS,
  'fiiChecklist', 'results.fiiChecklist', 'results.sections.fundo.fiiChecklist'
];

const GOVERNANCE_EVENTS_PATHS = [
  'corporateEvents', 'sourceFacts', 'results.corporateEvents', 'results.sourceFacts',
  'events', 'result.events', 'results.events', 'governanceEvents', 'marketFacts',
  'results.sections.empresa.corporateEvents', 'results.sections.empresa.sourceFacts',
  'results.sections.fundo.corporateEvents', 'results.sections.fundo.sourceFacts',
  'sections.empresa.corporateEvents', 'sections.empresa.sourceFacts',
  'sections.fundo.corporateEvents', 'sections.fundo.sourceFacts'
];


function checklistStatusFromText(value = '') {
  const raw = norm(value);
  if (!raw) return undefined;
  if (/nao\s+atende|não\s+atende|reprov|false|unchecked|uncheck|xmark|fa\s+times|icon\s+times|pendente|invalido|inválido/.test(raw)) return 'Não atende';
  if (/\batende\b|aprov|true|checked|checkmark|fa\s+check|icon\s+check|ok|sucesso|success|positivo|satisfatorio|satisfatório|✓|✔/.test(raw)) return 'Atende';
  return undefined;
}

function normalizeChecklistRows(value, source = 'Investidor10 checklist') {
  const rows = [];
  const walk = (node, fallback = '') => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(item => walk(item, fallback));
    if (typeof node !== 'object') {
      const label = cleanText(fallback);
      const value = cleanText(node);
      if (label && value) rows.push({ label, value, source });
      return;
    }
    const label = cleanText(node.label || node.name || node.criterio || node.critério || node.criteria || node.criterion || node.title || node.text || fallback);
    const statusRaw = node.status ?? node.aprovado ?? node.approved ?? node.ok ?? node.passed ?? node.pass ?? node.checked ?? node.isChecked ?? node.selected ?? node.value ?? node.valor ?? node.display;
    const normalizedStatus = typeof statusRaw === 'boolean' ? (statusRaw ? 'Atende' : 'Não atende') : checklistStatusFromText(statusRaw);
    const valueText = normalizedStatus || cleanText(statusRaw || node.result || node.resultado || node.description || node.descricao) || 'Critério capturado';
    if (label && valueText) rows.push({ label, value: valueText, source });
    for (const [key, child] of Object.entries(node)) {
      if (['label', 'name', 'criterio', 'critério', 'criteria', 'criterion', 'title', 'text', 'status', 'aprovado', 'approved', 'ok', 'passed', 'pass', 'checked', 'isChecked', 'selected', 'value', 'valor', 'display', 'result', 'resultado', 'description', 'descricao'].includes(key)) continue;
      if (Array.isArray(child)) child.forEach(item => walk(item, key));
    }
  };
  walk(value);
  const seen = new Set();
  return rows.filter(row => {
    const key = `${norm(row.label)}|${norm(row.value)}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function uniqueChecklistRows(rows = []) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${norm(row.label)}|${norm(row.value)}`;
    if (!norm(row.label) || !norm(row.value) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function displayStatusFromBoolean(value) {
  return value === true ? 'Atende' : value === false ? 'Não atende' : 'Não informado';
}

function metricKeyVariants(key = '') {
  const raw = cleanText(key);
  const splitCamel = raw.replace(/([a-záàâãéêíóôõúç])([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g, '$1 $2');
  const base = new Set([raw, splitCamel, norm(raw), norm(splitCamel)].filter(Boolean));
  const k = norm(splitCamel || raw);
  const aliasGroups = [
    ['dividendyield', 'dividend yield', 'dy', 'yield12m', 'yield 12m', 'dy 12m'],
    ['roe', 'roe'],
    ['liquidezmediadiaria', 'liquidez media diaria', 'liquidez média diária', 'volume medio diario', 'volume médio diário', 'daily liquidity'],
    ['dividabrutapatrimonio', 'divida bruta patrimonio', 'dívida bruta patrimônio', 'divida bruta patrimonio liquido', 'dívida bruta patrimônio líquido', 'gross debt equity'],
    ['dividabruta', 'divida bruta', 'dívida bruta', 'gross debt'],
    ['patrimonioliquido', 'patrimonio liquido', 'patrimônio líquido', 'equity', 'net worth'],
    ['cagrreceitas5anos', 'cagr receitas 5 anos', 'crescimento receita 5 anos', 'receita cagr 5 anos'],
    ['cagrlucros5anos', 'cagr lucros 5 anos', 'crescimento lucros 5 anos', 'lucro cagr 5 anos'],
    ['numerocotistas', 'numero cotistas', 'número cotistas', 'cotistas'],
    ['numeroimoveis', 'numero imoveis', 'número imóveis', 'quantidade imoveis', 'quantidade imóveis'],
    ['vacanciafisica', 'vacancia fisica', 'vacância física'],
    ['vacanciafinanceira', 'vacancia financeira', 'vacância financeira']
  ];
  for (const group of aliasGroups) {
    const normalizedGroup = group.map(norm);
    if (normalizedGroup.some(alias => alias && (k === alias || k.includes(alias) || alias.includes(k)))) {
      group.forEach(item => { base.add(item); base.add(norm(item)); });
    }
  }
  return [...base].filter(Boolean);
}

function firstMetricNumber(payload = {}, keys = []) {
  for (const key of keys) {
    const candidates = [
      payload?.[key],
      payload?.results?.[key],
      payload?.metrics?.[key],
      payload?.results?.metrics?.[key],
      payload?.fundamentals?.[key],
      payload?.results?.fundamentals?.[key],
      payload?.sections?.empresa?.dados?.[key],
      payload?.results?.sections?.empresa?.dados?.[key],
      payload?.sections?.informacoesFundo?.[key],
      payload?.results?.sections?.informacoesFundo?.[key],
      payload?.sections?.valorPatrimonial?.[key],
      payload?.results?.sections?.valorPatrimonial?.[key]
    ];
    for (const candidate of candidates) {
      const n = numberFrom(candidate?.value ?? candidate?.valor ?? candidate?.amount ?? candidate?.display ?? candidate);
      if (n !== undefined && Number.isFinite(n)) return n;
    }
    const wanted = metricKeyVariants(key).map(norm).filter(Boolean);
    if (wanted.length) {
      for (const card of indicatorCards(payload)) {
        const cardKey = norm([card?.id, card?.key, card?.label, card?.name].map(cleanText).filter(Boolean).join(' '));
        if (!cardKey) continue;
        const matches = wanted.some(alias => alias && (cardKey === alias || cardKey.includes(alias) || alias.includes(cardKey)));
        if (!matches) continue;
        const n = numberFrom(card?.raw ?? card?.value ?? card?.valor ?? card?.display ?? card?.formatted ?? card);
        if (n !== undefined && Number.isFinite(n)) return n;
      }
    }
  }
  return undefined;
}

function hasAtLeastYearsOfEvents(events = [], years = 5) {
  const now = Date.now();
  const threshold = now - years * 365.25 * 24 * 60 * 60 * 1000;
  return events.some(event => {
    const t = Date.parse(event.paymentDate || event.comDate || event.date || event.data || event.referenceDate || '');
    return Number.isFinite(t) && t <= threshold;
  });
}

function evaluateStockChecklistCriterion(id, payload = {}) {
  const events = dividendEvents(payload);
  const roe = firstMetricNumber(payload, ['roe', 'ROE']);
  const grossDebtEquity = firstMetricNumber(payload, ['dividaBrutaPatrimonio', 'dívida bruta / patrimônio', 'grossDebtEquity']);
  const cagrRevenue = firstMetricNumber(payload, ['cagrReceitas5Anos', 'cagrReceita5Anos', 'CAGR Receitas 5 anos']);
  const cagrProfit = firstMetricNumber(payload, ['cagrLucros5Anos', 'cagrLucro5Anos', 'CAGR Lucros 5 anos']);
  const dy = firstMetricNumber(payload, ['dividendYield', 'yield12m', 'dy']);
  const liquidity = firstMetricNumber(payload, ['liquidezMediaDiaria', 'dailyLiquidity', 'liquidezDiaria']);
  const equity = firstMetricNumber(payload, ['patrimonioLiquido', 'equity', 'netWorth']);
  const debt = firstMetricNumber(payload, ['dividaBruta', 'grossDebt']);
  switch (id) {
    case 'listed_5y': return hasAtLeastYearsOfEvents(events, 5) || undefined;
    case 'never_loss': return undefined;
    case 'profit_20q': return undefined;
    case 'dividends_5y': return dy !== undefined ? dy >= 4 : (events.length >= 5 ? true : undefined);
    case 'roe_10': return roe !== undefined ? roe >= 10 : undefined;
    case 'debt_below_equity': {
      if (grossDebtEquity !== undefined) return grossDebtEquity < 1;
      if (debt !== undefined && equity !== undefined && equity > 0) return debt < equity;
      return undefined;
    }
    case 'revenue_growth_5y': return cagrRevenue !== undefined ? cagrRevenue > 0 : undefined;
    case 'profit_growth_5y': return cagrProfit !== undefined ? cagrProfit > 0 : undefined;
    case 'liquidity_2m_usd': return liquidity !== undefined ? liquidity >= 2_000_000 : undefined;
    case 'user_rating': return undefined;
    default: return undefined;
  }
}

function evaluateFiiChecklistCriterion(id, payload = {}) {
  const events = dividendEvents(payload);
  const dy = firstMetricNumber(payload, ['dividendYield', 'yield12m', 'dy']);
  const liquidity = firstMetricNumber(payload, ['liquidezMediaDiaria', 'dailyLiquidity', 'liquidezDiaria']);
  const holders = firstMetricNumber(payload, ['numeroCotistas', 'cotistas']);
  const equity = firstMetricNumber(payload, ['patrimonioLiquido', 'valorPatrimonialTotal', 'netWorth']);
  const properties = firstMetricNumber(payload, ['numeroImoveis', 'quantidadeImoveis', 'imoveis']);
  const physicalVacancy = firstMetricNumber(payload, ['vacanciaFisica', 'vacância física']);
  const financialVacancy = firstMetricNumber(payload, ['vacanciaFinanceira', 'vacância financeira']);
  switch (id) {
    case 'listed_5y': return hasAtLeastYearsOfEvents(events, 5) || undefined;
    case 'dy_24m_9': return dy !== undefined ? dy >= 9 : (events.length >= 12 ? true : undefined);
    case 'liquidity_1m': return liquidity !== undefined ? liquidity >= 1_000_000 : undefined;
    case 'holders_20k': return holders !== undefined ? holders >= 20_000 : undefined;
    case 'equity_500m': return equity !== undefined ? equity >= 500_000_000 : undefined;
    case 'properties_5': return properties !== undefined ? properties >= 5 : undefined;
    case 'physical_vacancy_10': return physicalVacancy !== undefined ? physicalVacancy < 10 : undefined;
    case 'financial_vacancy_10': return financialVacancy !== undefined ? financialVacancy < 10 : undefined;
    default: return undefined;
  }
}

const STOCK_CHECKLIST_CRITERIA = [
  { id: 'listed_5y', label: 'Empresa com mais de 5 anos de Bolsa' },
  { id: 'never_loss', label: 'Empresa nunca deu prejuízo (ano fiscal)' },
  { id: 'profit_20q', label: 'Empresa com lucro nos últimos 20 trimestres (5 anos)' },
  { id: 'dividends_5y', label: 'Empresa pagou +5% de dividendos/ano nos últimos 5 anos' },
  { id: 'roe_10', label: 'Empresa possui ROE acima de 10%' },
  { id: 'debt_below_equity', label: 'Empresa possui dívida menor que patrimônio' },
  { id: 'revenue_growth_5y', label: 'Empresa apresentou crescimento de receita nos últimos 5 anos' },
  { id: 'profit_growth_5y', label: 'Empresa apresentou crescimento de lucros nos últimos 5 anos' },
  { id: 'liquidity_2m_usd', label: 'Empresa possui liquidez diária acima de US$ 2M' },
  { id: 'user_rating', label: 'Empresa é bem avaliada pelos usuários do Investidor10' }
];

const FII_CHECKLIST_CRITERIA = [
  { id: 'listed_5y', label: 'FII com mais de 5 anos listado em Bolsa' },
  { id: 'dy_24m_9', label: 'Dividend Yield médio dos últimos 24 meses acima de 9%' },
  { id: 'liquidity_1m', label: 'Liquidez média diária acima de R$ 1 milhão' },
  { id: 'holders_20k', label: 'Número de cotistas acima de 20 mil' },
  { id: 'equity_500m', label: 'Patrimônio líquido acima de R$ 500 milhões' },
  { id: 'properties_5', label: '5 ou mais imóveis no portfólio' },
  { id: 'physical_vacancy_10', label: 'Vacância física média dos últimos 12 meses abaixo de 10%' },
  { id: 'financial_vacancy_10', label: 'Vacância financeira média dos últimos 12 meses abaixo de 10%' }
];


function hasStockChecklistEvidence(payload = {}, rows = []) {
  if (Array.isArray(rows) && rows.length) return true;
  if (dividendEvents(payload).length) return true;
  const keys = [
    'dividendYield', 'yield12m', 'dy', 'roe', 'ROE', 'liquidezMediaDiaria', 'dailyLiquidity', 'liquidezDiaria',
    'dividaBrutaPatrimonio', 'grossDebtEquity', 'dividaBruta', 'grossDebt', 'patrimonioLiquido', 'equity',
    'cagrReceitas5Anos', 'cagrReceita5Anos', 'cagrLucros5Anos', 'cagrLucro5Anos'
  ];
  return keys.some(key => firstMetricNumber(payload, [key]) !== undefined);
}

function hasFiiChecklistEvidence(payload = {}, rows = []) {
  if (Array.isArray(rows) && rows.length) return true;
  if (dividendEvents(payload).length) return true;
  const keys = [
    'dividendYield', 'yield12m', 'dy', 'liquidezMediaDiaria', 'dailyLiquidity', 'liquidezDiaria',
    'numeroCotistas', 'cotistas', 'patrimonioLiquido', 'valorPatrimonialTotal', 'netWorth',
    'numeroImoveis', 'quantidadeImoveis', 'imoveis', 'vacanciaFisica', 'vacanciaFinanceira'
  ];
  return keys.some(key => firstMetricNumber(payload, [key]) !== undefined);
}

function statusForExtractedChecklistRow(row = {}, criteria = [], payload = {}, assetType = '') {
  const explicit = checklistStatusFromText(row.value);
  if (explicit) return explicit;
  const key = norm(row.label);
  const matched = criteria.find(item => key.includes(norm(item.label).slice(0, 24)) || norm(item.label).includes(key.slice(0, 24)));
  if (matched) {
    const passed = String(assetType).toUpperCase() === 'FII' ? evaluateFiiChecklistCriterion(matched.id, payload) : evaluateStockChecklistCriterion(matched.id, payload);
    return displayStatusFromBoolean(passed);
  }
  return 'Não informado';
}


function checklistIdentityRequirements(specLabel = '') {
  const specKey = norm(specLabel);
  const requirements = [];
  if (specKey.includes('crescimento') && specKey.includes('receita')) requirements.push(['crescimento'], ['receita']);
  if (specKey.includes('crescimento') && (specKey.includes('lucro') || specKey.includes('lucros'))) requirements.push(['crescimento'], ['lucro', 'lucros']);
  if ((specKey.includes('20') || specKey.includes('trimestres')) && (specKey.includes('lucro') || specKey.includes('lucros'))) requirements.push(['20', 'trimestres'], ['lucro', 'lucros']);
  if (specKey.includes('nunca') && specKey.includes('prejuizo')) requirements.push(['nunca'], ['prejuizo']);
  if (specKey.includes('dividendos') || specKey.includes('dividend yield')) requirements.push(['dividendos', 'dividend', 'yield']);
  if (specKey.includes('roe')) requirements.push(['roe']);
  if (specKey.includes('divida')) requirements.push(['divida']);
  if (specKey.includes('liquidez')) requirements.push(['liquidez']);
  if (specKey.includes('usuarios')) requirements.push(['usuarios', 'usuários', 'avaliada']);
  if (specKey.includes('bolsa')) requirements.push(['bolsa', 'listado', 'listada']);
  if (specKey.includes('cotistas')) requirements.push(['cotistas']);
  if (specKey.includes('patrimonio')) requirements.push(['patrimonio']);
  if (specKey.includes('imoveis')) requirements.push(['imoveis']);
  if (specKey.includes('vacancia') && specKey.includes('fisica')) requirements.push(['vacancia'], ['fisica']);
  if (specKey.includes('vacancia') && specKey.includes('financeira')) requirements.push(['vacancia'], ['financeira']);
  return requirements;
}

function checklistRowMatchesCriterion(rowKey = '', specLabel = '') {
  const specKey = norm(specLabel);
  if (!rowKey || !specKey) return false;
  const requirements = checklistIdentityRequirements(specLabel);
  for (const group of requirements) {
    if (!group.some(token => rowKey.includes(norm(token)))) return false;
  }
  if (rowKey === specKey || rowKey.includes(specKey) || specKey.includes(rowKey)) return true;
  const rowTokens = new Set(rowKey.split(/\s+/).filter(token => token.length > 3));
  const specTokens = specKey.split(/\s+/).filter(token => token.length > 3);
  if (!specTokens.length) return false;
  const overlap = specTokens.filter(token => rowTokens.has(token)).length;
  const requiredOverlap = requirements.length ? Math.min(3, Math.ceil(specTokens.length * 0.5)) : Math.min(4, Math.ceil(specTokens.length * 0.6));
  return overlap >= requiredOverlap;
}

function findChecklistMatch(extractedByLabel, specLabel = '') {
  for (const [key, row] of extractedByLabel.entries()) {
    if (checklistRowMatchesCriterion(key, specLabel)) return row;
  }
  return undefined;
}

function isKnownChecklistRow(key = '', criteria = []) {
  return criteria.some(spec => checklistRowMatchesCriterion(key, spec.label));
}

function buildChecklistItems(payload = {}, assetType = '') {
  if (!isStockAssetType(assetType)) return [];
  const rows = [];
  for (const path of CHECKLIST_PATHS) {
    const value = valueAtPath(payload, path);
    if (value !== undefined && value !== null) rows.push(...normalizeChecklistRows(value));
  }
  const uniqueRows = uniqueChecklistRows(rows);
  if (!hasStockChecklistEvidence(payload, uniqueRows)) return [];
  const extracted = uniqueRows.map(row => ({
    label: row.label,
    value: statusForExtractedChecklistRow(row, STOCK_CHECKLIST_CRITERIA, payload, assetType),
    source: row.source
  }));
  const extractedByLabel = new Map(extracted.map(row => [norm(row.label), row]));
  const criteriaRows = STOCK_CHECKLIST_CRITERIA.map(spec => {
    const matched = findChecklistMatch(extractedByLabel, spec.label);
    const status = matched?.value || displayStatusFromBoolean(evaluateStockChecklistCriterion(spec.id, payload));
    return { label: matched?.label || spec.label, value: status, source: matched?.source || 'Investidor10 checklist buy and hold' };
  });
  const extraRows = extracted.filter(row => {
    const key = norm(row.label);
    return !isKnownChecklistRow(key, STOCK_CHECKLIST_CRITERIA);
  });
  return [...criteriaRows, ...extraRows].slice(0, 14).map((row, index) => ({
    id: `checklist_${index}_${norm(row.label).replace(/\s+/g, '_')}`,
    label: row.label,
    value: row.value,
    group: 'Checklist Buy and Hold',
    source: row.source
  }));
}

function buildFiiChecklistItems(payload = {}, assetType = '') {
  if (!isFiiAssetType(assetType)) return [];
  const rows = [];
  for (const path of FII_CHECKLIST_PATHS) {
    const value = valueAtPath(payload, path);
    if (value !== undefined && value !== null) rows.push(...normalizeChecklistRows(value));
  }
  const uniqueRows = uniqueChecklistRows(rows);
  if (!hasFiiChecklistEvidence(payload, uniqueRows)) return [];
  const extracted = uniqueRows.map(row => ({
    label: row.label,
    value: statusForExtractedChecklistRow(row, FII_CHECKLIST_CRITERIA, payload, assetType),
    source: row.source
  }));
  const extractedByLabel = new Map(extracted.map(row => [norm(row.label), row]));
  const criteriaRows = FII_CHECKLIST_CRITERIA.map(spec => {
    const matched = findChecklistMatch(extractedByLabel, spec.label);
    const status = matched?.value || displayStatusFromBoolean(evaluateFiiChecklistCriterion(spec.id, payload));
    return { label: matched?.label || spec.label, value: status, source: matched?.source || 'Investidor10 checklist de FIIs' };
  });
  const extraRows = extracted.filter(row => {
    const key = norm(row.label);
    return !isKnownChecklistRow(key, FII_CHECKLIST_CRITERIA);
  });
  return [...criteriaRows, ...extraRows].slice(0, 12).map((row, index) => ({
    id: `fii_check_${index}_${norm(row.label).replace(/\s+/g, '_')}`,
    label: row.label,
    value: row.value,
    group: 'Checklist Buy and Hold de FII',
    source: row.source
  }));
}

function normalizeGovernanceRows(value, source = 'StatusInvest/Investidor10 eventos e governança') {
  const rows = [];
  const walk = (node, fallbackGroup = '') => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(item => walk(item, fallbackGroup));
    if (typeof node !== 'object') return;
    const label = cleanText(node.label || node.name || node.title || node.event || node.tipo || node.id || fallbackGroup);
    const rawValue = node.value ?? node.valor ?? node.display ?? node.status ?? node.description ?? node.descricao ?? node.date ?? node.data;
    const value = cleanText(rawValue);
    const group = cleanText(node.group || node.category || fallbackGroup || 'Governança e eventos');
    const itemSource = cleanText(node.source || source);
    if (label && value && !/^(suportado)$/i.test(value)) rows.push({ label, value, group, source: itemSource });
    for (const [key, child] of Object.entries(node)) {
      if (['label', 'name', 'title', 'event', 'tipo', 'id', 'value', 'valor', 'display', 'status', 'description', 'descricao', 'date', 'data', 'group', 'category', 'source'].includes(key)) continue;
      if (Array.isArray(child) || (child && typeof child === 'object')) walk(child, key);
    }
  };
  walk(value);
  const seen = new Set();
  return rows.filter(row => {
    const key = `${norm(row.label)}|${norm(row.value)}`;
    if (!norm(row.label) || !norm(row.value) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 24);
}

function buildGovernanceEventsItems(payload = {}, assetType = '') {
  const rows = [];
  for (const path of GOVERNANCE_EVENTS_PATHS) {
    const value = valueAtPath(payload, path);
    if (value !== undefined && value !== null) rows.push(...normalizeGovernanceRows(value));
  }
  return rows.slice(0, 24).map((row, index) => ({
    id: `governance_${index}_${norm(row.label).replace(/\s+/g, '_')}`,
    label: row.label,
    value: row.value,
    group: row.group || 'Governança e eventos',
    source: row.source
  }));
}


function isFiiAssetType(assetType = '') {
  return cleanText(assetType).toUpperCase() === 'FII';
}

function isEtfAssetType(assetType = '') {
  return cleanText(assetType).toUpperCase() === 'ETF';
}

function isCompanyLikeAssetType(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  return type !== 'FII' && type !== 'ETF';
}

function isStockAssetType(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  return !type || type === 'ACAO' || type === 'AÇÃO' || type === 'STOCK';
}

function supportsDividendRadarAssetType(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  return !type || type === 'ACAO' || type === 'AÇÃO' || type === 'STOCK' || type === 'FII';
}

function assetSummaryTitle(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  if (type === 'FII') return 'Resumo do FII';
  if (type === 'ETF') return 'Resumo do ETF';
  if (type === 'BDR') return 'Resumo do BDR';
  return 'Resumo do Ativo';
}

function assetProfileTitle(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  if (type === 'FII') return 'Sobre o Fundo';
  if (type === 'ETF') return 'Sobre o ETF';
  if (type === 'BDR') return 'Sobre o BDR';
  return 'Sobre a Empresa';
}

function assetComparisonTitle(assetType = '') {
  const type = cleanText(assetType).toUpperCase();
  if (type === 'FII') return 'Comparadores de FIIs e Índices';
  if (type === 'ETF') return 'Comparadores do ETF e Índices';
  if (type === 'BDR') return 'Comparadores do BDR e Índices';
  return 'Comparadores de Ações e Índices';
}

function coverageStatus(section, expected = false) {
  if (!expected) return 'not_expected';
  if (!section) return 'missing';
  if (section.status === 'ready' || section.items?.length || section.charts?.length) return 'implemented';
  return 'missing';
}

function buildSourceCoverageDiagnostics(assetType = '', sections = []) {
  const byId = new Map(sections.map(section => [section.id, section]));
  const isFii = isFiiAssetType(assetType);
  const companyLike = isCompanyLikeAssetType(assetType);
  const stockLike = isStockAssetType(assetType);
  const expected = [
    { id: 'summary', source: 'StatusInvest', expected: true },
    { id: 'market_context', source: 'StatusInvest', expected: true },
    { id: 'fundamental_indicators', source: 'StatusInvest', expected: true },
    { id: 'valuation_models', source: 'Investidor10 Graham/Bazin', expected: companyLike },
    { id: 'source_comparatives', source: 'Investidor10/StatusInvest comparativos setoriais', expected: true },
    { id: 'indices_events', source: 'StatusInvest/Investidor10 índices', expected: true },
    { id: 'governance_events', source: 'StatusInvest/Investidor10 eventos e governança', expected: true },
    { id: 'checklist', source: 'Investidor10 checklist', expected: stockLike },
    { id: 'dividend_radar', source: 'Investidor10/StatusInvest proventos', expected: stockLike },
    { id: 'historical_indicators', source: 'StatusInvest/Investidor10', expected: true },
    { id: 'financial_statements', source: 'StatusInvest/Investidor10', expected: companyLike },
    { id: 'asset_charts', source: 'Investidor10/Yahoo/StatusInvest', expected: true },
    { id: 'revenue_breakdown', source: 'Investidor10', expected: companyLike },
    { id: 'ownership', source: 'Investidor10', expected: companyLike },
    { id: 'company_profile', source: 'StatusInvest/Investidor10', expected: true },
    { id: 'comparisons', source: 'Investidor10/B3/BCB/Yahoo', expected: true },
    { id: 'fii_accounting', source: 'StatusInvest/Investidor10', expected: isFii },
    { id: 'fii_details', source: 'Investidor10/StatusInvest', expected: isFii },
    { id: 'fii_portfolio', source: 'Investidor10/StatusInvest', expected: isFii },
    { id: 'fii_checklist', source: 'Investidor10', expected: isFii }
  ];
  return expected.map(item => ({ ...item, status: coverageStatus(byId.get(item.id), item.expected) }));
}

const ALLOWED_INDEX_COMPARATORS = new Set(['IBOV', 'IFIX', 'CDI', 'IPCA', 'SMLL', 'IDIV', 'IVVB11']);

function comparatorCode(raw = '') {
  const text = cleanText(raw).toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  if (!text) return '';
  if (text.includes('IBOV') || text.includes('BVSP')) return 'IBOV';
  if (text.includes('IFIX')) return 'IFIX';
  if (text.includes('CDI')) return 'CDI';
  if (text.includes('IPCA')) return 'IPCA';
  if (text.includes('IVVB11') || text.includes('IVVB')) return 'IVVB11';
  return text.replace(/\^/g, '');
}

function hasFakeComparisonFlags(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return false;
  const flags = [candidate.simulated, candidate.synthetic, candidate.proxyTickerUsed, candidate.fake, candidate.mocked, candidate.reconstructedFromYahooSnapshot];
  if (flags.some(Boolean)) return true;
  const text = cleanText(candidate.source || candidate.policy || candidate.warning || candidate.message || candidate.error).toLowerCase();
  return /(simulad|sint[eé]tic|proxy ticker|proxyticker|etf\/proxy|ticker substituto|fallback falso|snapshot degradado|último snapshot conhecido|ultimo snapshot conhecido|reconstructed)/i.test(text);
}

function isRealComparisonSource(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return true;
  if (hasFakeComparisonFlags(candidate)) return false;
  const nestedSeries = arrayFrom(candidate.series);
  if (nestedSeries.some(serie => hasFakeComparisonFlags(serie))) return false;
  const nestedPoints = nestedSeries.flatMap(serie => arrayFrom(serie.points || serie.values || serie.data));
  if (nestedPoints.some(point => hasFakeComparisonFlags(point))) return false;
  return true;
}

function comparisonPoint(row = {}, valueKeys = ['value', 'return', 'returnPercent', 'accumulatedPercent', 'valuePercent', 'percent', 'percentage']) {
  const label = cleanText(row.label || row.month || row.period || row.date || row.year || row.timestamp || row.time);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  const display = cleanText(row.display) || `${decimalDisplay(value) || value}%`;
  return { label: label.slice(0, 18), value, display: display.includes('%') ? display : `${display}%` };
}

function normalizeComparisonPoints(rows = [], limit = 18) {
  return arrayFrom(rows).map(row => comparisonPoint(row)).filter(Boolean).slice(-limit);
}

function normalizeComparisonSeries(candidate = {}, ticker = '') {
  const rawSeries = Array.isArray(candidate.series) ? candidate.series : [];
  const series = [];
  if (rawSeries.length) {
    for (const serie of rawSeries) {
      const label = cleanText(serie.label || serie.name || serie.id);
      const points = normalizeComparisonPoints(serie.points || serie.values || serie.data || [], 18);
      if (label && points.length >= 2) series.push({ id: norm(label).replace(/\s+/g, '_'), label: label.slice(0, 18), points });
    }
  } else {
    const code = comparatorCode(candidate.name || candidate.label || candidate.index || candidate.benchmark || candidate.code);
    const points = normalizeComparisonPoints(candidate.points || candidate.values || candidate.data || [], 18);
    if (code && points.length >= 2) series.push({ id: code.toLowerCase(), label: code, points });
  }
  return series.filter(serie => cleanText(serie.label).toUpperCase() !== cleanText(ticker).toUpperCase() || series.length > 1).slice(0, 7);
}

function alignSeriesByCommonLabels(series = [], minPoints = 2) {
  const usable = arrayFrom(series).filter(serie => cleanText(serie?.label) && Array.isArray(serie?.points) && serie.points.length >= minPoints);
  if (usable.length < 2) return [];
  const commonLabels = usable
    .map(serie => new Set(serie.points.map(point => cleanText(point?.label)).filter(Boolean)))
    .reduce((common, labels) => new Set([...common].filter(label => labels.has(label))));
  if (commonLabels.size < minPoints) return [];
  const order = usable[0].points.map(point => cleanText(point?.label)).filter(label => commonLabels.has(label));
  if (order.length < minPoints) return [];
  return usable.map(serie => {
    const byLabel = new Map(serie.points.map(point => [cleanText(point?.label), point]));
    return { ...serie, points: order.map(label => byLabel.get(label)).filter(Boolean) };
  }).filter(serie => serie.points.length >= minPoints);
}

function normalizePercentDistributionChartPoints(points = []) {
  return arrayFrom(points)
    .filter(point => Number.isFinite(point?.value) && point.value > 0 && point.value <= 100)
    .slice(0, 12);
}

function collectComparisonCandidates(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const candidates = [];
  const paths = [
    'analysisComparisons', 'comparisons.indexes', 'comparisons.indices', 'comparisons.charts',
    'indexComparison', 'comparacaoIndices', 'comparacoesIndices', 'results.analysisComparisons',
    'results.indexComparison', 'results.comparacaoIndices', 'results.sections.comparacaoIndices',
    'assetChartBundle.indexComparison', 'assetChartsMobile.indexComparison'
  ];
  for (const path of paths) candidates.push(...arrayFrom(valueAtPath(payload, path)));
  candidates.push(...arrayFrom(bundle.indexComparison));
  return candidates;
}


function comparisonPeriodValue(series = []) {
  const first = arrayFrom(series).find(serie => arrayFrom(serie.points).length);
  const points = arrayFrom(first?.points);
  if (!points.length) return 'Série real recebida';
  const start = cleanText(points[0]?.label);
  const end = cleanText(points[points.length - 1]?.label);
  const coverage = start && end && start !== end ? `${start} a ${end}` : (end || start);
  return coverage ? `Período comparável: ${coverage}` : 'Série real recebida';
}

function buildCombinedIndexComparisonChart(ticker = '', charts = []) {
  const indexCharts = arrayFrom(charts)
    .filter(chart => /^asset_vs_(ibov|ifix|cdi|ipca|smll|idiv|ivvb11)$/.test(chart.id || ''))
    .filter(chart => arrayFrom(chart.series).length >= 2);
  const assetSeries = indexCharts
    .map(chart => arrayFrom(chart.series).find(serie => cleanText(serie.label).toUpperCase() === ticker))
    .find(Boolean);
  if (!assetSeries) return null;
  const benchmarkSeries = [];
  for (const chart of indexCharts) {
    const code = (chart.comparatorCode || (chart.id || '').replace('asset_vs_', '')).toUpperCase();
    const serie = arrayFrom(chart.series).find(item => comparatorCode(item.label) === code || cleanText(item.label).toUpperCase() === code);
    if (serie && arrayFrom(serie.points).length >= 8) benchmarkSeries.push({ ...serie, id: code.toLowerCase(), label: code });
  }
  if (benchmarkSeries.length < 2) return null;
  const aligned = alignSeriesByCommonLabels([{ ...assetSeries, id: 'asset', label: ticker || 'Ativo' }, ...benchmarkSeries], 6);
  if (aligned.length < 3) return null;
  return {
    id: 'asset_vs_indices',
    title: `${ticker || 'Ativo'} x índices`,
    chartType: 'multi_line',
    source: 'B3/BCB/Yahoo séries reais alinhadas pelo Proxy',
    unit: '%',
    series: aligned.slice(0, 8)
  };
}

function buildComparisonItemsAndCharts(payload = {}) {
  const ticker = cleanText(payload.ticker || payload.symbol || payload.results?.ticker || payload.results?.symbol).toUpperCase();
  const rows = [];
  const charts = [];
  const seenCharts = new Set();

  for (const candidate of collectComparisonCandidates(payload)) {
    const rawName = cleanText(candidate.name || candidate.label || candidate.index || candidate.benchmark || candidate.code || candidate.title);
    const code = comparatorCode(rawName);
    if (!ALLOWED_INDEX_COMPARATORS.has(code)) continue;
    if (code === ticker || rawName.toUpperCase() === ticker) continue;
    if (!isRealComparisonSource(candidate)) continue;
    const series = alignSeriesByCommonLabels(
      normalizeComparisonSeries(candidate, ticker)
        .filter(serie => serie.points.length >= 2)
        .filter(serie => cleanText(serie.label).toUpperCase() !== ticker || candidate.series?.length > 1),
      2
    );
    if (!series.length) continue;
    const hasBenchmark = series.some(serie => comparatorCode(serie.label) === code);
    const hasAssetSeries = ticker ? series.some(serie => cleanText(serie.label).toUpperCase() === ticker) : series.length >= 2;
    if (!hasBenchmark || !hasAssetSeries || series.length < 2) continue;
    const id = `asset_vs_${code.toLowerCase()}`;
    if (seenCharts.has(id)) continue;
    seenCharts.add(id);
    const source = cleanText(candidate.source) || 'VALORAE Proxy comparadores reais';
    rows.push({ id, label: `${ticker || 'Ativo'} x ${code}`, value: comparisonPeriodValue(series), group: 'Ativo x índice', source });
    charts.push({ id, title: `${ticker || 'Ativo'} x ${code}`, chartType: 'multi_line', source, unit: '%', series, comparatorCode: code });
  }

  for (const item of arrayFrom(payload.peers || payload.results?.peers || payload.comparadorAcoes || payload.results?.comparadorAcoes || payload.comparacaoFiis || payload.results?.comparacaoFiis)) {
    const label = cleanText(item.ticker || item.symbol || item.name || item.label).toUpperCase();
    if (!label || label === ticker) continue;
    if (!isRealComparisonSource(item)) continue;
    const value = cleanText(item.value || item.display || item.price || item.pvp || item.pl || item.dividendYield || item.dy);
    if (value) rows.push({ id: `peer_${label}`, label, value, group: 'Ações/FIIs semelhantes', source: item.source || 'StatusInvest/Investidor10' });
  }

  for (const candidate of arrayFrom(payload.peerComparisons || payload.results?.peerComparisons || payload.comparisons?.peers)) {
    const label = cleanText(candidate.peer || candidate.ticker || candidate.symbol || candidate.name || candidate.label).toUpperCase();
    if (!label || label === ticker || !isRealComparisonSource(candidate)) continue;
    const assetPoints = normalizeComparisonPoints(candidate.assetPoints || candidate.assetSeries || candidate.base?.points || [], 18);
    const peerPoints = normalizeComparisonPoints(candidate.peerPoints || candidate.points || candidate.values || [], 18);
    const aligned = alignSeriesByCommonLabels([
      { id: 'asset', label: ticker || 'Ativo', points: assetPoints },
      { id: 'peer', label, points: peerPoints }
    ], 2);
    if (aligned.length < 2) continue;
    const id = `asset_vs_${label.toLowerCase()}`;
    if (seenCharts.has(id)) continue;
    seenCharts.add(id);
    rows.push({ id, label: `${ticker || 'Ativo'} x ${label}`, value: comparisonPeriodValue(aligned), group: 'Ativo x par semelhante', source: candidate.source || 'StatusInvest/Investidor10' });
    charts.push({ id, title: `${ticker || 'Ativo'} x ${label}`, chartType: 'multi_line', source: candidate.source || 'StatusInvest/Investidor10', unit: '%', series: aligned });
  }

  const combined = buildCombinedIndexComparisonChart(ticker, charts);
  const finalCharts = combined ? [combined, ...charts.filter(chart => chart.id !== combined.id)] : charts;
  return { items: rows.slice(0, 40), charts: finalCharts.slice(0, 9) };
}


const FII_DETAIL_FIELDS = [
  { id: 'segment', label: 'Segmento', group: 'Informações do fundo', aliases: ['segmento', 'segment', 'segmentoFii'] },
  { id: 'fundType', label: 'Tipo de fundo', group: 'Informações do fundo', aliases: ['tipoFundo', 'tipo de fundo', 'fundType', 'tipo'] },
  { id: 'mandate', label: 'Mandato', group: 'Informações do fundo', aliases: ['mandato', 'mandate'] },
  { id: 'managementType', label: 'Tipo de gestão', group: 'Informações do fundo', aliases: ['tipoGestao', 'tipo de gestão', 'managementType'] },
  { id: 'administrator', label: 'Administrador', group: 'Gestão', aliases: ['administrador', 'administrator', 'admin'] },
  { id: 'manager', label: 'Gestor', group: 'Gestão', aliases: ['gestor', 'manager', 'gestao', 'gestão'] },
  { id: 'adminFee', label: 'Taxa de administração', group: 'Custos', aliases: ['taxaAdministracao', 'taxa de administração', 'adminFee', 'administrationFee'] },
  { id: 'targetAudience', label: 'Público-alvo', group: 'Cadastro', aliases: ['publicoAlvo', 'público-alvo', 'targetAudience'] },
  { id: 'cnpj', label: 'CNPJ', group: 'Cadastro', aliases: ['cnpj', 'documento'] },
  { id: 'term', label: 'Prazo', group: 'Cadastro', aliases: ['prazo', 'prazoDuracao', 'prazo de duração', 'duration', 'term'] },
  { id: 'dy12m', label: 'DY 12M', group: 'Rendimentos', unit: '%', aliases: ['yield12m', 'dividendYield', 'dy', 'dy12m', 'Dividend Yield'] },
  { id: 'lastIncome', label: 'Último rendimento', group: 'Rendimentos', unit: 'R$', aliases: ['ultimoRendimento', 'último rendimento', 'lastIncome', 'lastDividend'] },
  { id: 'incomePerShare', label: 'Rendimento por cota', group: 'Rendimentos', unit: 'R$', aliases: ['rendimentoPorCota', 'rendimento por cota', 'incomePerShare', 'dividendPerShare'] },
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'P/VP'] },
  { id: 'patrimonialValuePerShare', label: 'Valor patrimonial/cota', group: 'Patrimônio', unit: 'R$', aliases: ['valorPatrimonialCota', 'valor patrimonial por cota', 'valorPatrimonialPorCota', 'vpCota', 'patrimonialValuePerShare'] },
  { id: 'fundNetWorth', label: 'Patrimônio do fundo', group: 'Patrimônio', unit: 'R$', aliases: ['patrimonioLiquido', 'patrimônio líquido', 'valorPatrimonialTotal', 'netWorth', 'valorPatrimonial'] },
  { id: 'vacancy', label: 'Vacância', group: 'Portfólio', unit: '%', aliases: ['vacancia', 'vacância', 'vacanciaFisica', 'vacância física', 'physicalVacancy'] },
  { id: 'shareholders', label: 'Cotistas', group: 'Portfólio', aliases: ['numeroCotistas', 'número de cotistas', 'numCotistas', 'cotistas'] },
  { id: 'issuedShares', label: 'Cotas emitidas', group: 'Portfólio', aliases: ['cotasEmitidas', 'cotas emitidas', 'issuedShares'] },
  { id: 'dailyLiquidity', label: 'Liquidez diária', group: 'Liquidez', unit: 'R$', aliases: ['liquidezMediaDiaria', 'liquidez média diária', 'liquidezDiaria', 'liquidez diária', 'dailyLiquidity'] },
  { id: 'dyCagr3', label: 'DY CAGR 3 anos', group: 'Rendimentos', unit: '%', aliases: ['dyCagr3', 'DY CAGR (3 anos)', 'dy cagr 3 anos'] },
  { id: 'dyCagr5', label: 'DY CAGR 5 anos', group: 'Rendimentos', unit: '%', aliases: ['dyCagr5', 'DY CAGR (5 anos)', 'dy cagr 5 anos'] },
  { id: 'valorCagr3', label: 'Valor CAGR 3 anos', group: 'Valorização', unit: '%', aliases: ['valorCagr3', 'Valor CAGR (3 anos)', 'valor cagr 3 anos'] },
  { id: 'valorCagr5', label: 'Valor CAGR 5 anos', group: 'Valorização', unit: '%', aliases: ['valorCagr5', 'Valor CAGR (5 anos)', 'valor cagr 5 anos'] },
  { id: 'rendimentoMedio24m', label: 'Rendimento médio 24M', group: 'Rendimentos', unit: 'R$', aliases: ['rendimentoMedio24m', 'RENDIMENTO MENSAL MÉDIO (24M)', 'rendimento mensal medio 24m'] },
  { id: 'participacaoIfix', label: 'Participação no IFIX', group: 'Índices', unit: '%', aliases: ['participacaoIfix', 'PARTICIPAÇÃO NO IFIX', 'participação no ifix'] }
];

function fiiDisplay(value, spec = {}) {
  const display = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label);
  const raw = rawNumericValue(value);
  if (raw === undefined || raw === null || cleanText(raw) === '') return '';
  if (spec.unit === '%') return percentDisplay(raw) || cleanText(raw);
  if (spec.unit === 'R$') {
    if (suppressUnscaledAggregateMoney(value, spec)) return '';
    const money = firstMoneyExpression(value) || firstMoneyExpression(raw);
    if (money && hasExplicitMoneyScale(money)) return compactMoneyExpression(money) || money;
    return compactMoneyDisplay(raw) || (money && !suppressUnscaledAggregateMoney(money, spec) ? money : '') || cleanText(raw);
  }
  if (display && display !== '-' && display !== '--') return display;
  const n = finiteValue(raw);
  if (['shareholders', 'issuedShares', 'numeroCotistas', 'cotasEmitidas'].includes(spec.id) && n !== undefined) return compactDisplay(n);
  return cleanText(raw);
}

function addFiiDetailItem(rows, seen, id, label, rawValue, group = 'FII', source = 'StatusInvest/Investidor10', spec = {}) {
  const value = fiiDisplay(rawValue, spec);
  if (!label || !value || value === '-' || value === '--') return;
  const key = `${id}|${label}|${value}|${group}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ id: `fii_${id}`, label, value, group, source });
}

function collectFiiInfoSources(payload = {}) {
  const results = payload.results || {};
  const sections = results.sections || {};
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || results.assetChartBundle || results.assetChartsMobile || {};
  return [
    payload.fiiInfo,
    payload.fundo,
    payload.fundProfile,
    payload.profile,
    payload.fundamentals?.fii,
    payload.fundamentals?.profile,
    results.informacoesFundo,
    results.fiiInfo,
    results.fundo,
    results.cadastroFundo,
    results.fiiChartsCanonical?.info,
    results.assetChartsCanonical?.fii?.info,
    results.assetChartsCanonical?.info,
    sections.fundo?.informacoesFundo,
    sections.fundo?.fiiInfo,
    sections.informacoesFundo,
    sections.fiiInfo,
    bundle.fundProfile,
    bundle.fiiInfo
  ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
}

function mergedFiiInfo(payload = {}) {
  const merged = {};
  for (const source of collectFiiInfoSources(payload)) Object.assign(merged, objectFrom(source));
  return {
    ...merged,
    segmento: firstClean(payload.segmento, payload.fiiSegment, payload.segment, merged.segmento, merged.segmentoFii, merged.segment),
    tipoFundo: firstClean(payload.tipoFundo, merged.tipoFundo, merged.fundType, merged.tipo, merged['TIPO DE FUNDO'], merged['Tipo de fundo']),
    mandato: firstClean(payload.mandato, merged.mandato, merged.MANDATO, merged.Mandato),
    tipoGestao: firstClean(payload.tipoGestao, merged.tipoGestao, merged.managementType, merged['TIPO DE GESTÃO'], merged['Tipo de gestão']),
    administrador: firstClean(payload.administrador, merged.administrador, merged.administrator),
    gestor: firstClean(payload.gestor, merged.gestor, merged.manager),
    taxaAdministracao: firstClean(payload.taxaAdministracao, merged.taxaAdministracao, merged.adminFee, merged['TAXA DE ADMINISTRAÇÃO'], merged['Taxa de administração']),
    publicoAlvo: firstClean(payload.publicoAlvo, merged.publicoAlvo, merged.targetAudience, merged['PÚBLICO-ALVO'], merged['Público-alvo']),
    cnpj: firstClean(payload.cnpj, merged.cnpj),
    prazo: firstClean(payload.prazo, payload.prazoDuracao, merged.prazo, merged.prazoDuracao, merged.duration, merged['PRAZO DE DURAÇÃO'], merged['Prazo de duração']),
    yield12m: firstClean(payload.yield12m, payload.dividendYield, payload.dy, merged.yield12m, merged.dividendYield, merged.dy),
    ultimoRendimento: firstClean(payload.ultimoRendimento, merged.ultimoRendimento, merged.lastIncome, merged.lastDividend, merged['ÚLTIMO RENDIMENTO'], merged['Último rendimento']),
    rendimentoPorCota: firstClean(payload.rendimentoPorCota, merged.rendimentoPorCota, merged.incomePerShare),
    pvp: firstClean(payload.pvp, payload.p_vp, merged.pvp, merged.p_vp),
    valorPatrimonialCota: firstClean(payload.valorPatrimonialCota, payload.valorPatrimonialPorCota, merged.valorPatrimonialCota, merged.valorPatrimonialPorCota, merged.vpCota, merged['VAL. PATRIMONIAL P/ COTA'], merged['Valor patrimonial por cota']),
    patrimonioLiquido: firstClean(payload.patrimonioLiquido, payload.valorPatrimonialTotal, merged.patrimonioLiquido, merged.valorPatrimonialTotal, merged.netWorth, merged['VALOR PATRIMONIAL'], merged['Valor patrimonial'], merged['Patrimônio Líquido']),
    vacancia: firstClean(payload.vacancia, payload.vacanciaFisica, merged.vacancia, merged.vacanciaFisica, merged.physicalVacancy),
    numeroCotistas: firstClean(payload.numeroCotistas, payload.numCotistas, merged.numeroCotistas, merged.numCotistas, merged['NUMERO DE COTISTAS'], merged['NÚMERO DE COTISTAS'], merged['Número de cotistas']),
    cotasEmitidas: firstClean(payload.cotasEmitidas, merged.cotasEmitidas, merged.issuedShares, merged['COTAS EMITIDAS'], merged['Cotas emitidas']),
    liquidezMediaDiaria: firstClean(payload.liquidezMediaDiaria, payload.liquidezDiaria, merged.liquidezMediaDiaria, merged.liquidezDiaria, merged.dailyLiquidity),
    dyCagr3: firstClean(payload.dyCagr3, merged.dyCagr3, merged['DY CAGR (3 anos)']),
    dyCagr5: firstClean(payload.dyCagr5, merged.dyCagr5, merged['DY CAGR (5 anos)']),
    valorCagr3: firstClean(payload.valorCagr3, merged.valorCagr3, merged['Valor CAGR (3 anos)']),
    valorCagr5: firstClean(payload.valorCagr5, merged.valorCagr5, merged['Valor CAGR (5 anos)']),
    rendimentoMedio24m: firstClean(payload.rendimentoMedio24m, merged.rendimentoMedio24m, merged['RENDIMENTO MENSAL MÉDIO (24M)']),
    participacaoIfix: firstClean(payload.participacaoIfix, merged.participacaoIfix, merged['PARTICIPAÇÃO NO IFIX'])
  };
}

const FII_PROPERTIES_PATHS = [
  'results.listaImoveis',
  'results.imoveis',
  'results.physicalAssets',
  'results.statusInvestFiiPortfolio',
  'results.sections.fundo.listaImoveis',
  'results.sections.fundo.imoveis',
  'results.sections.fundo.physicalAssets',
  'results.sections.fundo.statusInvestFiiPortfolio',
  'results.sections.listaImoveis',
  'results.sections.imoveis',
  'results.fiiChartsCanonical.physicalAssets',
  'results.assetChartsCanonical.fii.physicalAssets',
  'assetChartBundle.fiiPhysicalAssets',
  'assetChartBundle.physicalAssets',
  'statusInvestFiiPortfolio',
  'listaImoveis',
  'imoveis',
  'physicalAssets'
];

const FII_ASSET_DISTRIBUTION_PATHS = [
  'results.distribuicaoAtivosFundo',
  'results.distribuicao_ativos_fundo',
  'results.assetDistribution',
  'results.sections.fundo.distribuicaoAtivosFundo',
  'results.sections.fundo.assetDistribution',
  'results.sections.distribuicaoAtivosFundo',
  'results.fiiChartsCanonical.assetDistribution',
  'results.assetChartsCanonical.fii.assetDistribution',
  'assetChartBundle.fiiAssetDistribution',
  'assetChartBundle.assetDistribution',
  'distribuicaoAtivosFundo',
  'assetDistribution',
  'fiiAssetDistribution'
];

function collectFirstArrayFromPaths(payload = {}, paths = []) {
  for (const path of paths) {
    const arr = arrayFrom(valueAtPath(payload, path));
    if (arr.length) return arr;
  }
  return [];
}

function collectAllArraysFromPaths(payload = {}, paths = []) {
  const out = [];
  for (const path of paths) out.push(...arrayFrom(valueAtPath(payload, path)));
  return out;
}

function propertyName(row = {}, index = 0) {
  return cleanText(row.nome || row.name || row.imovel || row.imóvel || row.asset || row.label || row.ticker || row.codigo || row.code) || `Imóvel ${index + 1}`;
}

function propertyDetail(row = {}) {
  return [
    cleanText(row.tipo || row.type || row.classe || row.segmento || row.segment),
    cleanText(row.cidade || row.city || row.uf || row.estado || row.location || row.localizacao || row.localização),
    cleanText(row.abl || row.area || row.area_bruta_locavel || row.areaBrutaLocavel || row.percentual || row.participacao || row.participação || row.value || row.valor),
    cleanText(row.vacancia || row.vacância || row.vacancy) ? `Vacância: ${cleanText(row.vacancia || row.vacância || row.vacancy)}` : '',
    cleanText(row.inadimplencia || row.inadimplência || row.defaultRate) ? `Inadimplência: ${cleanText(row.inadimplencia || row.inadimplência || row.defaultRate)}` : '',
    cleanText(row.objetivo || row.objective) ? `Objetivo: ${cleanText(row.objetivo || row.objective)}` : ''
  ].filter(Boolean).join(' • ');
}

function relatedFiiLabel(row = {}) {
  return cleanText(row.ticker || row.symbol || row.codigo || row.code || row.nome || row.name || row.label).toUpperCase();
}

function relatedFiiValue(row = {}) {
  return cleanText(row.dividendYield || row.dy || row.pvp || row.valor || row.value || row.display || row.preco || row.price || row.cotacao || row.quote);
}

function collectRelatedFiis(payload = {}, ticker = '') {
  const candidates = [
    ...arrayFrom(payload.peers),
    ...arrayFrom(payload.peerComparisons),
    ...arrayFrom(payload.comparacaoFiis),
    ...arrayFrom(payload.comparadorFiis),
    ...arrayFrom(payload.results?.peers),
    ...arrayFrom(payload.results?.peerComparisons),
    ...arrayFrom(payload.results?.comparacaoFiis),
    ...arrayFrom(payload.results?.comparadorFiis),
    ...arrayFrom(payload.results?.sections?.comparadorFiis),
    ...arrayFrom(payload.assetChartBundle?.fiiPeerAverage),
    ...arrayFrom(payload.results?.assetChartBundle?.fiiPeerAverage),
    ...arrayFrom(payload.results?.assetChartsMobile?.fiiPeerAverage)
  ];
  const seen = new Set();
  return candidates.filter(item => {
    if (!isRealComparisonSource(item)) return false;
    const label = relatedFiiLabel(item);
    if (!label || label === ticker) return false;
    const key = norm(label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

function buildFiiDetailItems(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() !== 'FII') return [];
  const ticker = cleanText(payload.ticker || payload.symbol || payload.results?.ticker || payload.results?.symbol).toUpperCase();
  const info = mergedFiiInfo(payload);
  const rows = [];
  const seen = new Set();

  for (const spec of FII_DETAIL_FIELDS) {
    const raw = valueByAliases(info, [spec.id, spec.label, ...(spec.aliases || [])]);
    if (raw !== undefined && raw !== null) addFiiDetailItem(rows, seen, spec.id, spec.label, raw, spec.group, 'StatusInvest/Investidor10 FII', spec);
  }

  collectFirstArrayFromPaths(payload, FII_PROPERTIES_PATHS).slice(0, 18).forEach((property, index) => {
    const label = propertyName(property, index);
    const value = propertyDetail(property) || 'Imóvel listado pela fonte';
    addFiiDetailItem(rows, seen, `property_${index + 1}_${norm(label).replace(/\s+/g, '_')}`, label, value, 'Lista de imóveis', property.source || 'Investidor10/StatusInvest lista de imóveis');
  });

  const distributionRows = dedupeRevenueRows(normalizeDistributionPoints(collectFirstArrayFromPaths(payload, FII_ASSET_DISTRIBUTION_PATHS), ['percentual', 'valuePercent', 'percent', 'percentage', 'value']).map(point => ({ label: point.label, percent: point.value, source: 'Investidor10/StatusInvest distribuição de ativos' })));
  distributionRows.slice(0, 12).forEach(row => {
    addFiiDetailItem(rows, seen, `asset_distribution_${norm(row.label).replace(/\s+/g, '_')}`, row.label, revenueDisplay(row.percent), 'Distribuição de ativos', row.source);
  });

  collectRelatedFiis(payload, ticker).forEach(peer => {
    const label = relatedFiiLabel(peer);
    const value = relatedFiiValue(peer) || 'FII relacionado pela fonte';
    addFiiDetailItem(rows, seen, `related_${norm(label).replace(/\s+/g, '_')}`, label, value, 'FIIs relacionados', peer.source || 'StatusInvest/Investidor10 pares reais');
  });

  return rows.slice(0, 90);
}

function buildFiiDetailCharts(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() !== 'FII') return [];
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const charts = [];

  const income = analysisChart('fii_detail_monthly_income', 'Rendimento mensal do FII', 'bar', bundle.fiiDistribution12m || bundle.dividendMonthly || payload.distribuicoes12m || payload.results?.distribuicoes12m, 'StatusInvest/Investidor10 rendimentos de FIIs', { valueKeys: ['amount', 'value', 'valor', 'rendimento', 'income', 'valuePerShare'], minPoints: 2, limit: 14, unit: 'R$' });
  if (income) charts.push(income);

  const dy = analysisChart('fii_detail_dy_history', 'Dividend Yield histórico do FII', 'bar', bundle.dividendYieldHistory || bundle.fiiDividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory, 'StatusInvest/Investidor10 histórico de DY', { valueKeys: ['yieldPercent', 'dividendYield', 'dy', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (dy) charts.push(dy);

  const patrimony = analysisChart('fii_detail_patrimonial_value', 'Valor patrimonial por período', 'bar', bundle.equityEvolution || bundle.fiiPatrimonialInfo || payload.valorPatrimonialHistorico || payload.results?.valorPatrimonialHistorico, 'StatusInvest/Investidor10 valor patrimonial', { valueKeys: ['valorPatrimonialCota', 'patrimonialValue', 'valorPatrimonial', 'netWorth', 'equity', 'value'], minPoints: 2, limit: 12, unit: 'R$' });
  if (patrimony) charts.push(patrimony);

  const historical = normalizeHistoricalIndicatorRecords(payload, 'FII');
  for (const spec of FII_HISTORICAL_INDICATORS.filter(item => ['vacanciaFisica', 'numeroCotistas'].includes(item.id))) {
    const rows = historical
      .filter(record => record.id === spec.id && Number.isFinite(record.numeric))
      .map(record => ({ label: record.period, value: record.numeric, display: record.value }))
      .reverse();
    const unique = new Map();
    rows.forEach(row => unique.set(row.label, row));
    const points = Array.from(unique.values()).slice(-12);
    if (points.length >= 2) {
      charts.push({
        id: `fii_detail_${spec.id}`,
        title: `${spec.label} histórico`,
        chartType: 'bar',
        source: 'Investidor10 histórico de indicadores de FIIs',
        unit: spec.unit || '',
        series: [{ id: spec.id, label: spec.label, points }]
      });
    }
  }

  const assetDistributionPoints = normalizePercentDistributionChartPoints(normalizeDistributionPoints(collectFirstArrayFromPaths(payload, FII_ASSET_DISTRIBUTION_PATHS), ['percentual', 'valuePercent', 'percent', 'percentage', 'value']));
  const distribution = analysisChart('fii_detail_asset_distribution', 'Distribuição de ativos do FII', 'donut_composition', assetDistributionPoints, 'Investidor10/StatusInvest distribuição de ativos', { valueKeys: ['value'], minPoints: 1, limit: 12, unit: '%' });
  if (distribution) charts.push(distribution);

  return charts.slice(0, 6);
}


const FII_ACCOUNTING_FIELDS = [
  { id: 'numeroCotistas', label: 'Cotistas', group: 'Base patrimonial', aliases: ['numeroCotistas', 'numCotistas', 'número de cotistas', 'numero de cotistas', 'cotistas'] },
  { id: 'cotasEmitidas', label: 'Cotas emitidas', group: 'Base patrimonial', aliases: ['cotasEmitidas', 'cotas emitidas', 'issuedShares'] },
  { id: 'patrimonioLiquido', label: 'Patrimônio líquido', group: 'Patrimônio', unit: 'R$', aliases: ['patrimonioLiquido', 'patrimônio líquido', 'valorPatrimonialTotal', 'valorPatrimonial', 'netWorth'] },
  { id: 'valorPatrimonialCota', label: 'Valor patrimonial/cota', group: 'Patrimônio', unit: 'R$', aliases: ['valorPatrimonialCota', 'valorPatrimonialPorCota', 'valor patrimonial cota', 'valor patrimonial por cota', 'vpCota'] },
  { id: 'valorCota', label: 'Valor da cota', group: 'Patrimônio', unit: 'R$', aliases: ['valorCota', 'valor da cota', 'cota', 'precoAtual'] },
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'P/VP'] },
  { id: 'ativos', label: 'Ativos', group: 'Contábil', unit: 'R$', aliases: ['ativos', 'ativos - (R$)', 'totalAssets'] },
  { id: 'despesasTaxaAdministracao', label: 'Despesa taxa administração', group: 'Custos', unit: 'R$', aliases: ['despesasTaxaAdministracao', 'Despesas taxa administração - (R$)', 'taxaAdministracao'] },
  { id: 'rentabilidadePatrimonial', label: 'Rentabilidade patrimonial', group: 'Rentabilidade', unit: '%', aliases: ['rentabilidadePatrimonial', 'Rentabilidade patrimonial - (%)'] },
  { id: 'dividendYield', label: 'Dividend Yield', group: 'Rendimentos', unit: '%', aliases: ['dividendYield', 'dy', 'Dividend Yield'] },
  { id: 'disponibilidades', label: 'Disponibilidades', group: 'Liquidez', unit: 'R$', aliases: ['disponibilidades', 'Disponibilidades - (R$)', 'cash'] },
  { id: 'titulosPublicos', label: 'Títulos públicos', group: 'Liquidez', unit: 'R$', aliases: ['titulosPublicos', 'Títulos públicos - (R$)'] },
  { id: 'titulosPrivados', label: 'Títulos privados', group: 'Liquidez', unit: 'R$', aliases: ['titulosPrivados', 'Títulos privados - (R$)'] },
  { id: 'totalInvestido', label: 'Total investido', group: 'Contábil', unit: 'R$', aliases: ['totalInvestido', 'Total investido - (R$)'] },
  { id: 'bensDireitosImoveis', label: 'Bens e direitos imóveis', group: 'Contábil', unit: 'R$', aliases: ['bensDireitosImoveis', 'Bens e direitos imóveis - (R$)'] },
  { id: 'despesasAgenteCustodiante', label: 'Despesa custodiante', group: 'Custos', unit: 'R$', aliases: ['despesasAgenteCustodiante', 'Despesas Agente Custodiante - (R$)'] },
  { id: 'rentabilidadeEfetivaMensal', label: 'Rentabilidade efetiva mensal', group: 'Rentabilidade', unit: '%', aliases: ['rentabilidadeEfetivaMensal', 'Rentabilidade Efetiva Mensal - (%)'] },
  { id: 'amortizacoes', label: 'Amortizações', group: 'Rendimentos', unit: 'R$', aliases: ['amortizacoes', 'Amortizações do Período - (R$)'] },
  { id: 'totalNecessidadeLiquidez', label: 'Necessidade de liquidez', group: 'Liquidez', unit: 'R$', aliases: ['totalNecessidadeLiquidez', 'Total Necessidade Liquidez - (R$)', 'Total Necessidade Líquidez - (R$)'] },
  { id: 'fundosRendaFixa', label: 'Fundos renda fixa', group: 'Liquidez', unit: 'R$', aliases: ['fundosRendaFixa', 'Fundos Renda Fixa - (R$)'] },
  { id: 'terrenos', label: 'Terrenos', group: 'Imóveis', unit: 'R$', aliases: ['terrenos', 'Terrenos - (R$)'] },
  { id: 'imoveisRendaAcabados', label: 'Imóveis renda acabados', group: 'Imóveis', unit: 'R$', aliases: ['imoveisRendaAcabados', 'Imóveis Renda Acabados - (R$)'] },
  { id: 'imoveisRendaConstrucao', label: 'Imóveis renda em construção', group: 'Imóveis', unit: 'R$', aliases: ['imoveisRendaConstrucao', 'Imóveis Renda em Construção - (R$)'] },
  { id: 'imoveisVendaAcabados', label: 'Imóveis venda acabados', group: 'Imóveis', unit: 'R$', aliases: ['imoveisVendaAcabados', 'Imóveis Venda Acabados - (R$)'] },
  { id: 'imoveisVendaConstrucao', label: 'Imóveis venda em construção', group: 'Imóveis', unit: 'R$', aliases: ['imoveisVendaConstrucao', 'Imóveis Venda em Construção - (R$)'] },
  { id: 'outrosBensDireitos', label: 'Outros bens e direitos', group: 'Contábil', unit: 'R$', aliases: ['outrosBensDireitos', 'Outros Bens e Direitos - (R$)'] },
  { id: 'acoes', label: 'Ações', group: 'Valores mobiliários', unit: 'R$', aliases: ['acoes', 'Ações - (R$)'] },
  { id: 'debentures', label: 'Debêntures', group: 'Valores mobiliários', unit: 'R$', aliases: ['debentures', 'Debêntures - (R$)'] },
  { id: 'bonusSubscricao', label: 'Bônus de subscrição', group: 'Valores mobiliários', unit: 'R$', aliases: ['bonusSubscricao', 'Bônus de Subscrição - (R$)'] },
  { id: 'certificadosDepositosValoresMobiliarios', label: 'Certificados de depósitos', group: 'Valores mobiliários', unit: 'R$', aliases: ['certificadosDepositosValoresMobiliarios', 'Certificados de Depósitos de Valores Mobiliários - (R$)'] },
  { id: 'cedulasDebentures', label: 'Cédulas de debêntures', group: 'Valores mobiliários', unit: 'R$', aliases: ['cedulasDebentures', 'Cédulas de Debêntures - (R$)'] },
  { id: 'fundoAcoesFia', label: 'Fundo de ações (FIA)', group: 'Fundos investidos', unit: 'R$', aliases: ['fundoAcoesFia', 'Fundo de Ações (FIA) - (R$)'] },
  { id: 'fundoInvestimentoParticipacoesFip', label: 'Fundo de participações (FIP)', group: 'Fundos investidos', unit: 'R$', aliases: ['fundoInvestimentoParticipacoesFip', 'Fundo de Investimento em Participações (FIP) - (R$)'] },
  { id: 'fiiInvestidos', label: 'FIIs investidos', group: 'Fundos investidos', unit: 'R$', aliases: ['fiiInvestidos', 'FII - (R$)', 'FIIs - (R$)', 'Fundos Imobiliários - (R$)'] },
  { id: 'fidc', label: 'FIDC', group: 'Fundos investidos', unit: 'R$', aliases: ['fidc', 'FIDC - (R$)'] },
  { id: 'outrasCotasFundosInvestimento', label: 'Outras cotas de fundos', group: 'Fundos investidos', unit: 'R$', aliases: ['outrasCotasFundosInvestimento', 'Outras Cotas de Fundos de Investimento - (R$)'] },
  { id: 'notasPromissorias', label: 'Notas promissórias', group: 'Valores mobiliários', unit: 'R$', aliases: ['notasPromissorias', 'Notas Promissórias - (R$)'] },
  { id: 'acoesSociedadesPropositoFii', label: 'Ações de sociedades propósito FII', group: 'Valores mobiliários', unit: 'R$', aliases: ['acoesSociedadesPropositoFii', 'Ações de Sociedades cujo único propósito se enquadre entre as atividades permitidas aos FII - (R$)'] },
  { id: 'cotasSociedadesFii', label: 'Cotas de sociedades FII', group: 'Valores mobiliários', unit: 'R$', aliases: ['cotasSociedadesFii', 'Cotas de Sociedades que se enquadre entre as atividades permitidas aos FII - (R$)'] },
  { id: 'cepac', label: 'CEPAC', group: 'Valores mobiliários', unit: 'R$', aliases: ['cepac', 'Certificados de Potencial Adicional de Construção (CEPAC) - (R$)'] },
  { id: 'cri', label: 'CRI', group: 'Crédito imobiliário', unit: 'R$', aliases: ['cri', 'Certificados de Recebíveis Imobiliários (CRI) - (R$)', 'Certificados Recebíveis Imobiliários - (R$)'] },
  { id: 'letrasHipotecarias', label: 'Letras hipotecárias', group: 'Crédito imobiliário', unit: 'R$', aliases: ['letrasHipotecarias', 'Letras Hipotecárias - (R$)'] },
  { id: 'lci', label: 'LCI', group: 'Crédito imobiliário', unit: 'R$', aliases: ['lci', 'Letras de Crédito Imobiliário (LCI) - (R$)', 'Letras Crédito Imobiliário - (R$)'] },
  { id: 'lig', label: 'LIG', group: 'Crédito imobiliário', unit: 'R$', aliases: ['lig', 'Letras Imobiliárias Garantidas (LIG) - (R$)'] },
  { id: 'outrosValoresMobiliarios', label: 'Outros valores mobiliários', group: 'Valores mobiliários', unit: 'R$', aliases: ['outrosValoresMobiliarios', 'Outros Valores Mobiliários - (R$)'] },
  { id: 'valoresReceber', label: 'Valores a receber', group: 'Recebíveis', unit: 'R$', aliases: ['valoresReceber', 'Valores a Receber - (R$)'] },
  { id: 'contasReceberAlugueis', label: 'Aluguéis a receber', group: 'Recebíveis', unit: 'R$', aliases: ['contasReceberAlugueis', 'Contas a Receber por Aluguéis - (R$)', 'Contas Receber Aluguéis - (R$)'] },
  { id: 'contasReceberVendaImoveis', label: 'Venda de imóveis a receber', group: 'Recebíveis', unit: 'R$', aliases: ['contasReceberVendaImoveis', 'Contas a Receber por Venda de Imóveis - (R$)'] },
  { id: 'outrosValoresReceber', label: 'Outros valores a receber', group: 'Recebíveis', unit: 'R$', aliases: ['outrosValoresReceber', 'Outros Valores a Receber - (R$)'] },
  { id: 'valoresPagar', label: 'Valores a pagar', group: 'Obrigações', unit: 'R$', aliases: ['valoresPagar', 'Valores a Pagar - (R$)'] },
  { id: 'rendimentosDistribuir', label: 'Rendimentos a distribuir', group: 'Obrigações', unit: 'R$', aliases: ['rendimentosDistribuir', 'Rendimentos a Distribuir - (R$)'] },
  { id: 'taxaAdministracaoPagar', label: 'Taxa de administração a pagar', group: 'Obrigações', unit: 'R$', aliases: ['taxaAdministracaoPagar', 'Taxa Administração a Pagar - (R$)', 'Taxa de Administração a Pagar - (R$)'] },
  { id: 'taxaPerformancePagar', label: 'Taxa de performance a pagar', group: 'Obrigações', unit: 'R$', aliases: ['taxaPerformancePagar', 'Taxa Performance a Pagar - (R$)', 'Taxa de Performance a Pagar - (R$)'] },
  { id: 'obrigacoesAquisicaoImoveis', label: 'Obrigações por aquisição de imóveis', group: 'Obrigações', unit: 'R$', aliases: ['obrigacoesAquisicaoImoveis', 'Obrigações por Aquisição de Imóveis - (R$)'] },
  { id: 'adiantamentoVendaImoveis', label: 'Adiantamento por venda de imóveis', group: 'Obrigações', unit: 'R$', aliases: ['adiantamentoVendaImoveis', 'Adiantamento por venda de imóveis - (R$)', 'Adiantamento por Venda de Imóveis - (R$)'] },
  { id: 'adiantamentoAlugueis', label: 'Adiantamento de aluguéis', group: 'Obrigações', unit: 'R$', aliases: ['adiantamentoAlugueis', 'Adiantamento de valores de aluguéis - (R$)', 'Adiantamento de Valores de Aluguéis - (R$)'] },
  { id: 'obrigacoesSecuritizacaoRecebiveis', label: 'Obrigações por securitização', group: 'Obrigações', unit: 'R$', aliases: ['obrigacoesSecuritizacaoRecebiveis', 'Obrigações por securitização de recebíveis - (R$)', 'Obrigações por Securitização de Recebíveis - (R$)'] },
  { id: 'instrumentosFinanceirosDerivativos', label: 'Instrumentos financeiros derivativos', group: 'Derivativos', unit: 'R$', aliases: ['instrumentosFinanceirosDerivativos', 'Instrumentos financeiros derivativos - (R$)', 'Instrumentos Financeiros Derivativos - (R$)'] },
  { id: 'provisoesContingencias', label: 'Provisões para contingências', group: 'Obrigações', unit: 'R$', aliases: ['provisoesContingencias', 'Provisões para contingências - (R$)', 'Provisões para Contingências - (R$)'] },
  { id: 'outrosValoresPagar', label: 'Outros valores a pagar', group: 'Obrigações', unit: 'R$', aliases: ['outrosValoresPagar', 'Outros valores a pagar - (R$)', 'Outros Valores a Pagar - (R$)'] }
];

function collectFiiAccountingSources(payload = {}) {
  const results = payload.results || {};
  const sections = results.sections || {};
  const info = mergedFiiInfo(payload);
  return [
    info,
    payload.fiiAccounting,
    payload.statusInvestFiiAccounting,
    payload.fiiContabil,
    payload.contabilidadeFii,
    results.fiiAccounting,
    results.statusInvestFiiAccounting,
    sections.fundo?.contabil,
    sections.fundo?.contabilidade,
    sections.fundo?.accounting,
    sections.fiiAccounting,
    results.assetChartsCanonical?.fii?.accounting,
    payload.assetChartsCanonical?.fii?.accounting,
    payload.financialSummary,
    results.financialSummary
  ].filter(value => value && typeof value === 'object' && !Array.isArray(value));
}

function buildFiiAccountingItems(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() !== 'FII') return [];
  const sources = collectFiiAccountingSources(payload);
  const merged = {};
  for (const source of sources) Object.assign(merged, objectFrom(source));
  const rows = [];
  const seen = new Set();
  for (const spec of FII_ACCOUNTING_FIELDS) {
    const raw = valueByAliases(merged, [spec.id, spec.label, ...(spec.aliases || [])]);
    if (raw !== undefined && raw !== null) addFiiDetailItem(rows, seen, spec.id, spec.label, raw, spec.group, 'StatusInvest/Investidor10 contábil FII', spec);
  }
  return rows.slice(0, 60);
}

function normalizeFiiPortfolioStateRows(rows = []) {
  const states = [];
  const byState = new Map();
  for (const row of arrayFrom(rows)) {
    const estado = cleanText(row.estado || row.state || row.uf || row.label || row.nome);
    const qty = finiteValue(row.quantidade ?? row.count ?? row.qtd ?? row.value);
    if (!estado || !Number.isFinite(qty) || qty <= 0) continue;
    const key = norm(estado);
    if (!key || byState.has(key)) continue;
    byState.set(key, { estado, quantidade: qty, source: row.source || 'Investidor10/StatusInvest lista de imóveis' });
  }
  for (const [key, row] of byState) states.push(row);
  return states;
}

function splitFiiPortfolioRows(rows = []) {
  const stateRows = [];
  const propertyRows = [];
  for (const row of arrayFrom(rows)) {
    const tipo = norm(row.tipo || row.type || row.kind);
    const hasCount = finiteValue(row.quantidade ?? row.count ?? row.qtd) !== undefined;
    const hasPropertyShape = cleanText(row.area || row.area_bruta_locavel || row.areaBrutaLocavel || row.cidade || row.city || row.vacancia || row.inadimplencia);
    if ((tipo.includes('estado') || hasCount) && !hasPropertyShape) stateRows.push(row);
    else propertyRows.push(row);
  }
  return { stateRows: normalizeFiiPortfolioStateRows(stateRows), propertyRows };
}

function buildFiiPortfolioItems(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() !== 'FII') return [];
  const rows = collectAllArraysFromPaths(payload, FII_PROPERTIES_PATHS);
  const { stateRows, propertyRows } = splitFiiPortfolioRows(rows);
  const out = [];
  const seen = new Set();
  stateRows.slice(0, 12).forEach((row, index) => {
    addFiiDetailItem(out, seen, `portfolio_state_${index + 1}_${norm(row.estado).replace(/\s+/g, '_')}`, row.estado, `${row.quantidade} imóvel(is)`, 'Distribuição por estado', row.source || 'Investidor10 lista de imóveis');
  });
  propertyRows.slice(0, 24).forEach((property, index) => {
    const label = propertyName(property, index);
    const value = propertyDetail(property) || 'Imóvel listado pela fonte';
    addFiiDetailItem(out, seen, `portfolio_property_${index + 1}_${norm(label).replace(/\s+/g, '_')}`, label, value, 'Imóveis do fundo', property.source || 'Investidor10/StatusInvest portfólio');
  });
  const distributionRows = dedupeRevenueRows(normalizeDistributionPoints(collectFirstArrayFromPaths(payload, FII_ASSET_DISTRIBUTION_PATHS), ['percentual', 'valuePercent', 'percent', 'percentage', 'value']).map(point => ({ label: point.label, percent: point.value, source: 'Investidor10/StatusInvest distribuição de ativos' })));
  distributionRows.slice(0, 12).forEach(row => {
    addFiiDetailItem(out, seen, `portfolio_asset_${norm(row.label).replace(/\s+/g, '_')}`, row.label, revenueDisplay(row.percent), 'Distribuição de ativos', row.source);
  });
  return out.slice(0, 50);
}

function buildFiiPortfolioCharts(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() !== 'FII') return [];
  const charts = [];
  const rows = collectAllArraysFromPaths(payload, FII_PROPERTIES_PATHS);
  const { stateRows, propertyRows } = splitFiiPortfolioRows(rows);
  const states = stateRows.length ? stateRows : (() => {
    const counts = new Map();
    propertyRows.forEach(row => {
      const estado = cleanText(row.estado || row.state || row.uf);
      if (!estado) return;
      counts.set(estado, (counts.get(estado) || 0) + 1);
    });
    return [...counts.entries()].map(([estado, quantidade]) => ({ estado, quantidade }));
  })();
  const points = states.map(row => ({ label: row.estado, value: Number(row.quantidade), display: `${Number(row.quantidade)} imóvel(is)` })).filter(point => point.label && Number.isFinite(point.value) && point.value > 0).slice(0, 12);
  if (points.length) {
    charts.push({ id: 'fii_portfolio_by_state', title: 'Imóveis por estado', chartType: 'donut_composition', source: 'Investidor10/StatusInvest lista de imóveis', unit: '', series: [{ id: 'states', label: 'Estados', points }] });
  }
  return charts;
}

function buildFiiPortfolio(payload = {}, assetType = '') {
  return { items: buildFiiPortfolioItems(payload, assetType), charts: buildFiiPortfolioCharts(payload, assetType) };
}

function buildFiiAccounting(payload = {}, assetType = '') {
  return { items: buildFiiAccountingItems(payload, assetType), charts: [] };
}

function buildFiiDetails(payload = {}, assetType = '') {
  return {
    items: buildFiiDetailItems(payload, assetType),
    charts: buildFiiDetailCharts(payload, assetType)
  };
}

const FUTURE_ANALYSIS_SECTIONS = [];

function pendingSection(spec) {
  return {
    id: spec.id,
    title: spec.title,
    type: spec.type,
    status: 'missing',
    itemCount: 0,
    source: 'VALORAE Proxy',
    items: [],
    message: spec.message || 'Seção ainda não está recebendo dados reais pelo contrato único.'
  };
}

function section(id, title, type, items, source = 'VALORAE Proxy', extra = {}) {
  const safeItems = Array.isArray(items) ? items.filter(item => cleanText(item?.label) && cleanText(item?.value)) : [];
  const safeCharts = Array.isArray(extra.charts) ? extra.charts.filter(chart => cleanText(chart?.title) && Array.isArray(chart?.series) && chart.series.some(serie => Array.isArray(serie.points) && serie.points.length)) : [];
  const ready = safeItems.length || safeCharts.length;
  return {
    id,
    title,
    type,
    status: ready ? 'ready' : 'empty',
    itemCount: safeItems.length + safeCharts.length,
    source,
    items: safeItems,
    charts: safeCharts,
    message: ready ? undefined : 'Dados reais ainda não disponíveis para este bloco.'
  };
}

export function buildAnalysisPageResponse(payload = {}, input = {}) {
  const ticker = cleanText(payload.ticker || payload.symbol || input.ticker || input.symbol || input.q).toUpperCase();
  const assetType = cleanText(payload.assetClass || payload.type || input.type || '').toUpperCase() || 'ACAO';
  const requestedSurfaceId = normalizeAnalysisSurfaceId(input.consumer || input.surface || input.consumerId || input.uiSurface || input.modalSurface || 'analysis_page');
  const requestedSurface = getAnalysisSurface(requestedSurfaceId);
  const summaryItems = buildSummaryItems(payload, assetType);
  const fundamentalItems = buildFundamentalItems(payload, assetType);
  const dividendSummaryItems = buildDividendSummaryItems(payload, assetType);
  const dividendHistoryItems = buildDividendHistoryItems(payload);
  const dividendRadarItems = buildDividendRadarItems(payload, assetType, ticker);
  const historicalItems = buildHistoricalIndicatorItems(payload, assetType);
  const historicalCharts = buildHistoricalIndicatorCharts(payload, assetType);
  const statementItems = buildFinancialStatementItems(payload);
  const statementCharts = buildFinancialStatementCharts(payload);
  const assetCharts = buildAssetCharts(payload);
  const companyProfileItems = buildCompanyProfileItems(payload, assetType);
  const marketContextItems = buildMarketContextItems(payload, assetType);
  const valuationModelItems = buildValuationModelItems(payload, assetType);
  const sourceComparatives = buildSourceComparativeItemsAndCharts(payload, assetType);
  const indicesEventsItems = buildIndicesEventsItems(payload, assetType);
  const governanceEventsItems = buildGovernanceEventsItems(payload, assetType);
  const checklistItems = buildChecklistItems(payload, assetType);
  const ownership = buildOwnershipSection(payload, assetType);
  const fiiChecklistItems = buildFiiChecklistItems(payload, assetType);
  const revenueBreakdown = buildRevenueBreakdown(payload);
  const comparisons = buildComparisonItemsAndCharts(payload);
  const fiiDetails = buildFiiDetails(payload, assetType);
  const fiiAccounting = buildFiiAccounting(payload, assetType);
  const fiiPortfolio = buildFiiPortfolio(payload, assetType);

  const isFii = isFiiAssetType(assetType);
  const companyLike = isCompanyLikeAssetType(assetType);
  const stockLike = isStockAssetType(assetType);
  const coreSections = [
    section('summary', assetSummaryTitle(assetType), 'metric_cards', summaryItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('fundamental_indicators', 'Indicadores Fundamentalistas', 'metric_grid', fundamentalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('dividends_summary', isFii ? 'Rendimentos' : 'Dividendos e Proventos', 'metric_cards', dividendSummaryItems, 'StatusInvest proventos por ativo'),
    section('dividends_history', 'Histórico de Proventos', 'table', dividendHistoryItems, 'StatusInvest proventos por ativo'),
    ...(supportsDividendRadarAssetType(assetType) ? [section('dividend_radar', `Radar de Dividendos Inteligente para ${ticker}`, 'dividend_radar', dividendRadarItems, 'Investidor10/StatusInvest proventos normalizados')] : []),
    section('market_context', 'Mercado, risco e liquidez', 'metric_grid', marketContextItems, 'StatusInvest + Investidor10 mercado'),
    ...(companyLike ? [section('valuation_models', 'Preço justo e modelos', 'metric_grid', valuationModelItems, 'Investidor10 Graham/Bazin')] : []),
    section('source_comparatives', 'Comparativos da fonte', 'comparison', sourceComparatives.items, 'Investidor10/StatusInvest comparativos setoriais', { charts: sourceComparatives.charts }),
    section('indices_events', 'Índices e participação', 'metric_grid', indicesEventsItems, 'StatusInvest/Investidor10 índices'),
    section('governance_events', 'Mercado, cadastro e eventos', 'metric_grid', governanceEventsItems, 'StatusInvest/Investidor10 eventos, governança e dados operacionais'),
    section('historical_indicators', 'Histórico de Indicadores', 'table', historicalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy', { charts: historicalCharts }),
    ...(companyLike ? [section('financial_statements', 'DRE, Balanço e Fluxo de Caixa', 'table', statementItems, 'StatusInvest/Yahoo fundamentals normalizados pelo Proxy', { charts: statementCharts })] : []),
    ...(isFii ? [section('fii_accounting', 'Patrimônio e Contábil do FII', 'table', fiiAccounting.items, 'StatusInvest/Investidor10 patrimônio e dados contábeis de FIIs', { charts: fiiAccounting.charts })] : []),
    section('asset_charts', 'Gráficos do Ativo', 'chart', chartPreviewItems(assetCharts), 'VALORAE Proxy séries estruturadas', { charts: assetCharts }),
    section('company_profile', assetProfileTitle(assetType), 'text', companyProfileItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    ...(companyLike ? [section('ownership', 'Posição acionária', 'metric_grid', ownership.items, 'Investidor10 posição acionária', { charts: ownership.charts })] : []),
    ...(stockLike ? [section('checklist', `Checklist do Investidor Buy and Hold sobre ${ticker}`, 'checklist', checklistItems, 'Investidor10 checklist buy and hold')] : []),
    ...(companyLike ? [section('revenue_breakdown', 'Negócios e Regiões de Receita', 'chart', revenueBreakdown.items, 'Investidor10/StatusInvest normalizados pelo Proxy', { charts: revenueBreakdown.charts })] : []),
    section('comparisons', assetComparisonTitle(assetType), 'comparison', comparisons.items, 'VALORAE Proxy comparadores estruturados', { charts: comparisons.charts }),
    ...(isFii ? [section('fii_details', 'Dados do FII', 'fii_details', fiiDetails.items, 'StatusInvest/Investidor10 dados específicos de FIIs', { charts: fiiDetails.charts })] : []),
    ...(isFii ? [section('fii_portfolio', 'Portfólio do FII', 'fii_details', fiiPortfolio.items, 'Investidor10/StatusInvest imóveis e distribuição de ativos', { charts: fiiPortfolio.charts })] : []),
    ...(isFii ? [section('fii_checklist', `Checklist do Investidor para ${ticker}`, 'fii_checklist', fiiChecklistItems, 'Investidor10 checklist de FIIs')] : [])
  ];

  const sections = [
    ...coreSections,
    ...FUTURE_ANALYSIS_SECTIONS
      .filter(spec => !(assetType !== 'FII' && spec.id === 'fii_details'))
      .map(pendingSection)
  ];
  const ready = sections.filter(s => s.status === 'ready').length;
  const missing = sections.filter(s => s.status !== 'ready');
  const sourceCoverage = buildSourceCoverageDiagnostics(assetType, sections);
  const chartCount = sections.reduce((sum, section) => sum + (Array.isArray(section.charts) ? section.charts.length : 0), 0);
  return {
    ok: ready > 0,
    status: ready > 0 ? 'OK' : 'PARTIAL',
    endpoint: 'analysis',
    contract: 'AnalysisPageResponse',
    contractVersion: CONTRACT_VERSION,
    version: RELEASE.version,
    patch: RELEASE.patch,
    ticker,
    symbol: ticker,
    assetType,
    name: cleanText(payload.name || payload.nome || payload.nomeEmpresa || payload.results?.nome || payload.results?.nomeEmpresa || ticker),
    updatedAt: new Date().toISOString(),
    sourcePolicy: 'StatusInvest/Investidor10 para fundamentos, histórico, cadastro e composições; Yahoo Finance apenas para séries de mercado/fundamentals quando estruturadas; B3/BCB para índices, CDI e IPCA quando disponíveis; sem dados sintéticos.',
    sources: [
      { id: 'statusinvest', role: 'structured_numbers_dividends_profile_when_available' },
      { id: 'investidor10', role: 'visual_reference_indicator_history_revenue_breakdown_profile_when_available' },
      { id: 'yahoo', role: 'market_history_direct_index_and_structured_financials_when_available' },
      { id: 'b3', role: 'official_index_history_when_available' },
      { id: 'bcb', role: 'official_cdi_ipca_series_when_available' }
    ],
    sections,
    summary: {
      totalSections: sections.length,
      readySections: ready,
      emptySections: missing.length,
      missingSections: missing.length,
      totalItems: sections.reduce((sum, item) => sum + item.itemCount, 0),
      totalCharts: chartCount
    },
    missingSignals: missing.map(s => ({ id: s.id, title: s.title, status: s.status, message: s.message })),
    consumerSurface: {
      id: requestedSurface.id,
      title: requestedSurface.title,
      role: requestedSurface.role,
      density: requestedSurface.density,
      maxInitialSections: requestedSurface.maxInitialSections
    },
    diagnostics: {
      hasQuote: Boolean(cleanText(summaryItems.find(i => i.id === 'price')?.value)),
      summaryItems: summaryItems.length,
      fundamentalItems: fundamentalItems.length,
      dividendSummaryItems: dividendSummaryItems.length,
      dividendHistoryItems: dividendHistoryItems.length,
      historicalItems: historicalItems.length,
      historicalCharts: historicalCharts.length,
      statementItems: statementItems.length,
      statementCharts: statementCharts.length,
      assetCharts: assetCharts.length,
      companyProfileItems: companyProfileItems.length,
      marketContextItems: marketContextItems.length,
      valuationModelItems: valuationModelItems.length,
      sourceComparativeItems: sourceComparatives.items.length,
      sourceComparativeCharts: sourceComparatives.charts.length,
      indicesEventsItems: indicesEventsItems.length,
      governanceEventsItems: governanceEventsItems.length,
      checklistItems: checklistItems.length,
      ownershipItems: ownership.items.length,
      fiiChecklistItems: fiiChecklistItems.length,
      revenueBreakdownItems: revenueBreakdown.items.length,
      comparisonItems: comparisons.items.length,
      fiiAccountingItems: fiiAccounting.items.length,
      fiiPortfolioItems: fiiPortfolio.items.length,
      fiiPortfolioCharts: fiiPortfolio.charts.length,
      fiiDetailsItems: fiiDetails.items.length,
      fiiDetailsCharts: fiiDetails.charts.length,
      missingSections: missing.map(s => s.id),
      legacyAssetEndpointUntouched: true,
      payloadSource: payload.source || 'VALORAE Fonte Oficial',
      sourceCoverage,
      sourceDriftReports: payload.sourceDriftReports || payload.results?.sourceDriftReports || []
    },
    consumerContract: buildAnalysisConsumerContract(assetType, sections, requestedSurfaceId)
  };
}

export const _test = { STOCK_INDICATORS, STOCK_HISTORICAL_INDICATORS, FII_HISTORICAL_INDICATORS, buildAnalysisPageResponse, buildSummaryItems, buildFundamentalItems, buildDividendSummaryItems, buildDividendHistoryItems, buildHistoricalIndicatorItems, buildHistoricalIndicatorCharts, buildFinancialStatementItems, buildFinancialStatementCharts, normalizeFinancialStatementRecords, buildMarketContextItems, buildValuationModelItems, buildSourceComparativeItemsAndCharts, buildIndicesEventsItems, buildGovernanceEventsItems, buildChecklistItems, buildOwnershipSection, buildFiiChecklistItems, buildDividendRadarItems, dividendEvents, buildSourceCoverageDiagnostics, buildRevenueBreakdown, buildComparisonItemsAndCharts, buildFiiDetails, buildFiiAccounting, buildFiiPortfolio, buildAssetCharts, computeTwelveMonthVariation };
