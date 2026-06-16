import { RELEASE } from '../core/release.js';

const CONTRACT_VERSION = '26.analysis.v2';

const STOCK_INDICATORS = [
  { id: 'pl', label: 'P/L', group: 'Valuation', aliases: ['pl', 'p_l', 'pL', 'P/L'] },
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
    aliases: ['incomeStatement', 'dre', 'demonstracaoResultado', 'demonstraçãoResultado', 'resultado', 'resultados', 'statementIncome'],
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
    aliases: ['balanceSheet', 'balancoPatrimonial', 'balançoPatrimonial', 'balanco', 'balanço', 'balance'],
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
    aliases: ['cashFlowStatement', 'fluxoCaixa', 'fluxo de caixa', 'cashFlow', 'fcf', 'fluxosCaixa'],
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

function numberFrom(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value && typeof value === 'object') return numberFrom(value.raw ?? value.value ?? value.fmt ?? value.display);
  const raw = cleanText(value).replace(/R\$/g, '').replace(/%/g, '').trim();
  if (!raw || raw === '--' || raw === '-') return undefined;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
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
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return raw.slice(0, 10);
}

function moneyPerShare(value) {
  const n = numberFrom(value);
  if (n === undefined || n <= 0) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(n);
}

function dividendEvents(payload = {}) {
  const candidates = [
    payload?.dividends,
    payload?.proventos,
    payload?.results?.dividends,
    payload?.results?.proventos,
    payload?.assetChartBundle?.dividendEvents,
    payload?.assetChartsMobile?.dividendEvents,
    payload?.appMobileSnapshot?.assetChartBundle?.dividendEvents,
    payload?.results?.assetChartBundle?.dividendEvents,
    payload?.results?.assetChartsMobile?.dividendEvents
  ];
  const events = [];
  for (const arr of candidates) if (Array.isArray(arr)) events.push(...arr);
  const unique = new Map();
  for (const event of events) {
    const amount = numberFrom(event?.valuePerShare ?? event?.grossValuePerShare ?? event?.netValuePerShare ?? event?.amount ?? event?.value ?? event?.valor);
    const paymentDate = cleanText(event?.paymentDate || event?.payDate || event?.dataPagamento || event?.datePayment || event?.date || event?.referenceDate);
    const comDate = cleanText(event?.dateCom || event?.comDate || event?.dataCom || event?.eligibilityDate || event?.recordDate);
    const kind = cleanText(event?.dividendType || event?.kind || event?.type || event?.event || event?.status || 'Provento') || 'Provento';
    if (!(amount > 0) && !paymentDate && !comDate) continue;
    const key = [paymentDate, comDate, kind, amount || 0].join('|');
    if (!unique.has(key)) unique.set(key, { ...event, amount, paymentDate, comDate, kind });
  }
  return [...unique.values()].sort((a, b) => String(b.paymentDate || b.comDate || '').localeCompare(String(a.paymentDate || a.comDate || '')));
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
  return dividendEvents(payload).slice(0, 24).map((event, index) => {
    const payment = dateLabel(event.paymentDate);
    const com = dateLabel(event.comDate);
    const kind = cleanText(event.kind || event.dividendType || event.type || 'Provento') || 'Provento';
    const amount = moneyPerShare(event.amount ?? event.valuePerShare ?? event.grossValuePerShare ?? event.value);
    return amount ? {
      id: `dividend_${index + 1}`,
      label: payment ? `Pagamento ${payment}` : kind,
      value: amount,
      group: [kind, com ? `Data com ${com}` : ''].filter(Boolean).join(' • '),
      source: cleanText(event.source || event.rawProvider || 'StatusInvest proventos')
    } : null;
  }).filter(Boolean);
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
  const label = cleanText(row.label || row.period || row.year || row.date || row.timestamp || row.month || row.name);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  return { label: label.slice(0, 18), value, display: cleanText(row.display) || compactDisplay(value) };
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

function chartPreviewItems(charts = []) {
  return charts.map(chart => ({
    id: chart.id,
    label: chart.title,
    value: `${chart.series.reduce((sum, serie) => sum + (serie.points?.length || 0), 0)} ponto(s)`,
    group: chart.source || 'VALORAE Proxy',
    source: chart.source || 'VALORAE Proxy'
  }));
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
  return [
    { source: 'StatusInvest/Investidor10 histórico', value: payload.historicalIndicators },
    { source: 'Investidor10 histórico de indicadores', value: payload.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: payload.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.historicalIndicators },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: payload.results?.sections?.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: bundle.historicoIndicadores },
    { source: 'Investidor10 histórico de indicadores', value: bundle.indicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: bundle.fundamentalIndicatorHistory },
    { source: 'Investidor10 histórico de indicadores', value: bundle.fiiFundamentalIndicatorHistory },
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
      for (const row of lineRows) {
        const label = cleanText(row?.indicador || row?.indicator || row?.label || row?.name || inheritedLabel);
        const valores = row?.valores || row?.values || row?.periods || row?.data;
        if (valores && typeof valores === 'object' && !Array.isArray(valores)) {
          const periods = columns.length ? columns : Object.keys(valores);
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
    if (Object.prototype.hasOwnProperty.call(obj, alias)) return obj[alias];
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
  if (rawDisplay && rawDisplay !== '-' && rawDisplay !== '--') return rawDisplay;
  const raw = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
  const n = finiteValue(raw);
  if (n === undefined) return cleanText(raw);
  if (metric.unit === 'R$') return `R$ ${compactDisplay(n)}`;
  if (metric.unit === '%') return percentDisplay(n);
  return decimalDisplay(n);
}

function addFinancialStatementRecord(records, seen, metric, period, value, source = 'StatusInvest/Yahoo fundamentals') {
  if (!metric) return;
  const cleanPeriod = cleanText(period || value?.period || value?.year || value?.date || value?.label || 'Atual');
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
    { source: 'StatusInvest/Yahoo fundamentals', value: sections.demonstrativos },
    { source: 'Yahoo fundamentals estruturados', value: { incomeStatement: canonical.incomeStatement, balanceSheet: canonical.balanceSheet, cashFlowStatement: canonical.cashFlowStatement } },
    { source: 'VALORAE assetChartBundle', value: { incomeStatement: bundle.incomeStatement || bundle.revenueProfit, balanceSheet: bundle.balanceSheet || bundle.equityEvolution, cashFlowStatement: bundle.cashFlowStatement } },
    { source: 'Yahoo financial summary', value: payload.financialSummary || payload.results?.financialSummary }
  ].filter(entry => entry.value !== undefined && entry.value !== null);
}

function normalizeFinancialStatementRecords(payload = {}) {
  const records = [];
  const seen = new Set();

  const consumeRow = (row = {}, source = 'StatusInvest/Yahoo fundamentals', groupHint = null, inheritedPeriod = '') => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return 0;
    const period = statementPeriodFrom(row, inheritedPeriod || 'Atual');
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
    const labelMetric = financialStatementMetricByAlias(row.label || row.name || row.metric || row.indicador || row.conta, groupHint);
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

    const groupAdded = consumeRow(value, source, groupHint, inheritedPeriod);

    for (const [key, child] of Object.entries(value)) {
      if (child === undefined || child === null) continue;
      const keyGroup = financialStatementGroupByAlias(key);
      if (keyGroup) {
        walk(child, source, keyGroup, inheritedPeriod);
        continue;
      }
      const keyMetric = financialStatementMetricByAlias(key, groupHint);
      if (keyMetric) {
        if (Array.isArray(child)) {
          for (const row of child) addFinancialStatementRecord(records, seen, keyMetric, statementPeriodFrom(row, inheritedPeriod || 'Atual'), row, source);
        } else if (child && typeof child === 'object') {
          const childPeriod = statementPeriodFrom(child, inheritedPeriod || 'Atual');
          const directValue = child.value ?? child.valor ?? child.amount ?? child.raw ?? child.display ?? child.formatted;
          if (directValue !== undefined) addFinancialStatementRecord(records, seen, keyMetric, childPeriod, child, source);
          for (const [periodKey, periodValue] of Object.entries(child)) {
            if (looksLikeStatementPeriodKey(periodKey) || typeof periodValue !== 'object') {
              addFinancialStatementRecord(records, seen, keyMetric, periodKey, periodValue, source);
            }
          }
        } else {
          addFinancialStatementRecord(records, seen, keyMetric, inheritedPeriod || 'Atual', child, source);
        }
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

function buildFinancialStatementCharts(payload = {}) {
  const records = normalizeFinancialStatementRecords(payload).filter(record => Number.isFinite(record.numeric));
  const charts = [];
  for (const group of FINANCIAL_STATEMENT_GROUPS) {
    const series = [];
    for (const metric of group.metrics) {
      const rows = records
        .filter(record => record.statementId === group.id && record.metricId === metric.id)
        .map(record => ({ label: record.period, value: record.numeric, display: record.value }));
      const unique = new Map();
      for (const row of rows) unique.set(row.label, row);
      const points = Array.from(unique.values()).reverse().slice(-10);
      if (points.length >= 2) series.push({ id: metric.id, label: metric.label, points });
      if (series.length >= 3) break;
    }
    if (series.length) {
      charts.push({
        id: `${group.id}_statement`,
        title: `${group.title} por período`,
        chartType: 'multi_line',
        source: 'StatusInvest/Yahoo fundamentals normalizados pelo Proxy',
        unit: 'R$',
        series
      });
    }
  }
  return charts;
}

function buildAssetCharts(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const assetType = cleanText(payload.assetClass || payload.type || payload.results?.assetClass || payload.results?.type).toUpperCase();
  const isFii = assetType === 'FII';
  const charts = [];

  const price = analysisChart('price_history', 'Cotação histórica', 'line', bundle.priceHistory || payload.historicoPrecos || payload.results?.historicoPrecos, 'Yahoo Finance / StatusInvest', { valueKeys: ['close', 'price', 'value'], minPoints: 2, limit: 24, unit: 'R$' });
  if (price) charts.push(price);

  const dividends = analysisChart(isFii ? 'fii_monthly_distribution' : 'dividend_history', isFii ? 'Rendimento mensal' : 'Histórico de proventos', 'line', bundle.dividendMonthly || bundle.fiiDistribution12m || bundle.dividendYearly, 'StatusInvest/Investidor10 proventos', { valueKeys: ['amount', 'value', 'total', 'valuePerShare'], minPoints: 2, limit: 14, unit: 'R$' });
  if (dividends) charts.push(dividends);

  const dyHistory = analysisChart('dividend_yield_history', 'Dividend Yield histórico', 'line', bundle.dividendYieldHistory || bundle.fiiDividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory, 'StatusInvest/Investidor10 proventos', { valueKeys: ['yieldPercent', 'dividendYield', 'dy', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (dyHistory) charts.push(dyHistory);

  const revenueProfit = dualSeriesChart('revenue_profit', 'Receitas e Lucros', 'multi_line', bundle.revenueProfit || payload.statements?.revenueProfit || payload.results?.statements?.revenueProfit, 'StatusInvest/Yahoo fundamentals', { id: 'revenue', label: 'Receita', valueKeys: ['netRevenue', 'revenue', 'receita'] }, { id: 'profit', label: 'Lucro', valueKeys: ['netProfit', 'profit', 'lucro'] });
  if (revenueProfit) charts.push(revenueProfit);

  const profitVsQuoteRows = arrayFrom(bundle.profitVsQuote || payload.statements?.profitVsQuote || payload.results?.statements?.profitVsQuote)
    .filter(row => finiteValue(row?.value ?? row?.price ?? row?.quote) !== undefined && finiteValue(row?.secondaryValue ?? row?.profit ?? row?.lucro) !== undefined)
    .filter(row => Math.abs(finiteValue(row?.secondaryValue ?? row?.profit ?? row?.lucro) || 0) > 0);
  const profitQuote = profitVsQuoteRows.length >= 2
    ? dualSeriesChart('profit_vs_quote', 'Lucro x Cotação', 'multi_line', profitVsQuoteRows, 'StatusInvest/Yahoo fundamentals', { id: 'quote', label: 'Cotação', valueKeys: ['value', 'price', 'quote'] }, { id: 'profit', label: 'Lucro', valueKeys: ['secondaryValue', 'profit', 'lucro'] })
    : null;
  if (profitQuote) charts.push(profitQuote);

  const equity = analysisChart(isFii ? 'fii_patrimonial_value' : 'equity_evolution', isFii ? 'Valor patrimonial' : 'Evolução patrimonial', 'line', bundle.equityEvolution || bundle.balanceSheet || bundle.fiiPatrimonialInfo || payload.statements?.balanceSheet || payload.results?.statements?.balanceSheet, 'StatusInvest/Yahoo fundamentals', { valueKeys: ['netWorth', 'equity', 'patrimonioLiquido', 'valorPatrimonial', 'patrimonialValue', 'value'], minPoints: 2, limit: 12, unit: isFii ? 'R$' : '' });
  if (equity) charts.push(equity);

  const payout = analysisChart('payout_history', 'Payout histórico', 'line', bundle.payoutHistory || payload.payoutHistory || payload.results?.payoutHistory, 'StatusInvest/Investidor10', { valueKeys: ['payout', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
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
  { id: 'marketCap', label: 'Valor de mercado', group: 'Mercado', aliases: ['valorMercado', 'valor de mercado', 'marketCap', 'marketValue'] },
  { id: 'equity', label: 'Patrimônio líquido', group: 'Mercado', aliases: ['patrimonioLiquido', 'patrimônio líquido', 'equity', 'netWorth'] }
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

function profileDisplay(value, spec = {}) {
  const display = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label);
  if (display && display !== '-' && display !== '--') return display;
  const raw = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
  if (raw === undefined || raw === null) return '';
  if (spec.id === 'marketCap' || spec.id === 'equity') {
    const n = finiteValue(raw);
    return n === undefined ? cleanText(raw) : `R$ ${compactDisplay(n)}`;
  }
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
  if (!value || value === '-' || value === '--') return;
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
    valorMercado: firstClean(payload.marketCap, payload.valorMercado, merged.valorMercado, merged.marketCap),
    patrimonioLiquido: firstClean(payload.equity, payload.netWorth, payload.patrimonioLiquido, merged.patrimonioLiquido, merged.equity, merged.netWorth)
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
  const officialLabels = new Set([...specs.map(spec => norm(spec.label)), 'descricao', 'description', 'sobre', 'resumo']);
  for (const item of tableItemsFromObject(info, 'StatusInvest/Investidor10 perfil', 28)) {
    if (officialLabels.has(norm(item.label)) || seen.has(`${item.id}|${item.value}`.toLowerCase())) continue;
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
  'segmentsRevenue'
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
  'domesticExternalRevenue'
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

function collectRevenueRowsFromValue(value, source = 'Investidor10/StatusInvest') {
  const rows = [];
  const consume = (label, raw) => {
    const percent = normalizeRevenuePercent(raw);
    const cleanLabel = cleanText(label);
    if (!cleanLabel || percent === null) return;
    rows.push({ label: cleanLabel, percent, source });
  };

  const walk = (node, fallbackLabel = '') => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, fallbackLabel);
      return;
    }
    if (typeof node !== 'object') {
      consume(fallbackLabel, node);
      return;
    }

    const directLabel = revenueLabelFromRow(node, fallbackLabel);
    const directRaw = node.percentual ?? node.percentage ?? node.percent ?? node.valuePercent ?? node.share ?? node.participacao ?? node.participação ?? node.value ?? node.valor ?? node.amount ?? node.display;
    if (directLabel && directRaw !== undefined) {
      consume(directLabel, directRaw);
      return;
    }

    for (const [key, child] of Object.entries(node)) {
      if (['source', 'updatedAt', 'generatedAt', 'metadata', 'diagnostics', 'total', 'sum'].includes(key)) continue;
      if (Array.isArray(child)) {
        child.forEach(item => walk(item, key));
      } else if (child && typeof child === 'object') {
        const label = revenueLabelFromRow(child, key);
        const raw = child.percentual ?? child.percentage ?? child.percent ?? child.valuePercent ?? child.share ?? child.participacao ?? child.participação ?? child.value ?? child.valor ?? child.amount ?? child.display;
        if (label && raw !== undefined) consume(label, raw);
        else walk(child, key);
      } else {
        consume(key, child);
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

function dedupeRevenueRows(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const label = cleanText(row.label);
    const percent = Number(row.percent);
    if (!label || !Number.isFinite(percent) || percent <= 0 || percent > 100) continue;
    const key = norm(label);
    const current = map.get(key);
    if (!current || percent > current.percent) map.set(key, { label, percent, source: row.source || 'Investidor10/StatusInvest' });
  }
  return [...map.values()].sort((a, b) => b.percent - a.percent);
}

function revenueItemsFromRows(rows = [], group = 'Distribuição') {
  return rows.map(row => ({
    id: `${group === REVENUE_BUSINESS_GROUP ? 'business' : 'region'}_${norm(row.label).replace(/\s+/g, '_')}`,
    label: row.label,
    value: revenueDisplay(row.percent),
    group,
    source: row.source || 'Investidor10/StatusInvest'
  }));
}

function revenueChartFromRows(id, title, rows = [], source = 'Investidor10/StatusInvest') {
  if (!rows.length) return null;
  return {
    id,
    title,
    chartType: 'horizontal_bar_composition',
    source,
    unit: '%',
    series: [{
      id: 'share',
      label: title,
      points: rows.map(row => ({ label: row.label.slice(0, 18), value: row.percent, display: revenueDisplay(row.percent) }))
    }]
  };
}

function buildRevenueBreakdown(payload = {}) {
  const businessRows = dedupeRevenueRows(collectRevenueRows(payload, REVENUE_BUSINESS_PATHS, 'Investidor10/StatusInvest negócios de receita'));
  const regionRows = dedupeRevenueRows(collectRevenueRows(payload, REVENUE_REGION_PATHS, 'Investidor10/StatusInvest regiões de receita'));

  const items = [
    ...revenueItemsFromRows(businessRows, REVENUE_BUSINESS_GROUP),
    ...revenueItemsFromRows(regionRows, REVENUE_REGION_GROUP)
  ];
  const charts = [
    revenueChartFromRows('revenue_by_business', REVENUE_BUSINESS_GROUP, businessRows),
    revenueChartFromRows('revenue_by_region', 'Regiões onde gera receita', regionRows)
  ].filter(Boolean);

  return { items, charts };
}

const ALLOWED_INDEX_COMPARATORS = new Set(['IBOV', 'IFIX', 'CDI', 'IPCA', 'SMLL', 'IDIV']);

function comparatorCode(raw = '') {
  const text = cleanText(raw).toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  if (!text) return '';
  if (text.includes('IBOV') || text.includes('BVSP')) return 'IBOV';
  if (text.includes('IFIX')) return 'IFIX';
  if (text.includes('CDI')) return 'CDI';
  if (text.includes('IPCA')) return 'IPCA';
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
  return series.filter(serie => cleanText(serie.label).toUpperCase() !== cleanText(ticker).toUpperCase() || series.length > 1).slice(0, 4);
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
    rows.push({ id, label: `${ticker || 'Ativo'} x ${code}`, value: `${series.reduce((sum, serie) => sum + serie.points.length, 0)} ponto(s)`, group: 'Ativo x índice', source });
    charts.push({ id, title: `${ticker || 'Ativo'} x ${code}`, chartType: 'multi_line', source, unit: '%', series });
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
    rows.push({ id, label: `${ticker || 'Ativo'} x ${label}`, value: `${aligned[0].points.length} ponto(s)`, group: 'Ativo x par semelhante', source: candidate.source || 'StatusInvest/Investidor10' });
    charts.push({ id, title: `${ticker || 'Ativo'} x ${label}`, chartType: 'multi_line', source: candidate.source || 'StatusInvest/Investidor10', unit: '%', series: aligned });
  }

  return { items: rows.slice(0, 32), charts: charts.slice(0, 6) };
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
  { id: 'dailyLiquidity', label: 'Liquidez diária', group: 'Liquidez', unit: 'R$', aliases: ['liquidezMediaDiaria', 'liquidez média diária', 'liquidezDiaria', 'liquidez diária', 'dailyLiquidity'] }
];

function fiiDisplay(value, spec = {}) {
  const display = cleanText(value?.display || value?.formatted || value?.fmt || value?.text || value?.label);
  if (display && display !== '-' && display !== '--') return display;
  const raw = value?.value ?? value?.valor ?? value?.amount ?? value?.raw ?? value;
  if (raw === undefined || raw === null || cleanText(raw) === '') return '';
  if (spec.unit === '%') return percentDisplay(raw) || cleanText(raw);
  if (spec.unit === 'R$') return brl(raw) || compactDisplay(raw) || cleanText(raw);
  const n = finiteValue(raw);
  if (['shareholders', 'issuedShares'].includes(spec.id) && n !== undefined) return compactDisplay(n);
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
    tipoFundo: firstClean(payload.tipoFundo, merged.tipoFundo, merged.fundType, merged.tipo),
    mandato: firstClean(payload.mandato, merged.mandato),
    tipoGestao: firstClean(payload.tipoGestao, merged.tipoGestao, merged.managementType),
    administrador: firstClean(payload.administrador, merged.administrador, merged.administrator),
    gestor: firstClean(payload.gestor, merged.gestor, merged.manager),
    taxaAdministracao: firstClean(payload.taxaAdministracao, merged.taxaAdministracao, merged.adminFee),
    publicoAlvo: firstClean(payload.publicoAlvo, merged.publicoAlvo, merged.targetAudience),
    cnpj: firstClean(payload.cnpj, merged.cnpj),
    prazo: firstClean(payload.prazo, payload.prazoDuracao, merged.prazo, merged.prazoDuracao, merged.duration),
    yield12m: firstClean(payload.yield12m, payload.dividendYield, payload.dy, merged.yield12m, merged.dividendYield, merged.dy),
    ultimoRendimento: firstClean(payload.ultimoRendimento, merged.ultimoRendimento, merged.lastIncome, merged.lastDividend),
    rendimentoPorCota: firstClean(payload.rendimentoPorCota, merged.rendimentoPorCota, merged.incomePerShare),
    pvp: firstClean(payload.pvp, payload.p_vp, merged.pvp, merged.p_vp),
    valorPatrimonialCota: firstClean(payload.valorPatrimonialCota, payload.valorPatrimonialPorCota, merged.valorPatrimonialCota, merged.valorPatrimonialPorCota, merged.vpCota),
    patrimonioLiquido: firstClean(payload.patrimonioLiquido, payload.valorPatrimonialTotal, merged.patrimonioLiquido, merged.valorPatrimonialTotal, merged.netWorth),
    vacancia: firstClean(payload.vacancia, payload.vacanciaFisica, merged.vacancia, merged.vacanciaFisica, merged.physicalVacancy),
    numeroCotistas: firstClean(payload.numeroCotistas, payload.numCotistas, merged.numeroCotistas, merged.numCotistas),
    cotasEmitidas: firstClean(payload.cotasEmitidas, merged.cotasEmitidas, merged.issuedShares),
    liquidezMediaDiaria: firstClean(payload.liquidezMediaDiaria, payload.liquidezDiaria, merged.liquidezMediaDiaria, merged.liquidezDiaria, merged.dailyLiquidity)
  };
}

const FII_PROPERTIES_PATHS = [
  'results.listaImoveis',
  'results.imoveis',
  'results.physicalAssets',
  'results.sections.listaImoveis',
  'results.sections.imoveis',
  'results.fiiChartsCanonical.physicalAssets',
  'results.assetChartsCanonical.fii.physicalAssets',
  'assetChartBundle.fiiPhysicalAssets',
  'assetChartBundle.physicalAssets',
  'listaImoveis',
  'imoveis',
  'physicalAssets'
];

const FII_ASSET_DISTRIBUTION_PATHS = [
  'results.distribuicaoAtivosFundo',
  'results.distribuicao_ativos_fundo',
  'results.assetDistribution',
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

function propertyName(row = {}, index = 0) {
  return cleanText(row.nome || row.name || row.imovel || row.imóvel || row.asset || row.label || row.ticker || row.codigo || row.code) || `Imóvel ${index + 1}`;
}

function propertyDetail(row = {}) {
  return [
    cleanText(row.tipo || row.type || row.classe || row.segmento || row.segment),
    cleanText(row.cidade || row.city || row.uf || row.estado || row.location || row.localizacao || row.localização),
    cleanText(row.abl || row.area || row.percentual || row.participacao || row.participação || row.value || row.valor)
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

  const income = analysisChart('fii_detail_monthly_income', 'Rendimento mensal do FII', 'line', bundle.fiiDistribution12m || bundle.dividendMonthly || payload.distribuicoes12m || payload.results?.distribuicoes12m, 'StatusInvest/Investidor10 rendimentos de FIIs', { valueKeys: ['amount', 'value', 'valor', 'rendimento', 'income', 'valuePerShare'], minPoints: 2, limit: 14, unit: 'R$' });
  if (income) charts.push(income);

  const dy = analysisChart('fii_detail_dy_history', 'Dividend Yield histórico do FII', 'line', bundle.dividendYieldHistory || bundle.fiiDividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory, 'StatusInvest/Investidor10 histórico de DY', { valueKeys: ['yieldPercent', 'dividendYield', 'dy', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (dy) charts.push(dy);

  const patrimony = analysisChart('fii_detail_patrimonial_value', 'Valor patrimonial por período', 'line', bundle.equityEvolution || bundle.fiiPatrimonialInfo || payload.valorPatrimonialHistorico || payload.results?.valorPatrimonialHistorico, 'StatusInvest/Investidor10 valor patrimonial', { valueKeys: ['valorPatrimonialCota', 'patrimonialValue', 'valorPatrimonial', 'netWorth', 'equity', 'value'], minPoints: 2, limit: 12, unit: 'R$' });
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
        chartType: 'line',
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
    message: ready ? undefined : 'Seção sem dados reais suficientes. O Proxy não envia valores sintéticos.'
  };
}

export function buildAnalysisPageResponse(payload = {}, input = {}) {
  const ticker = cleanText(payload.ticker || payload.symbol || input.ticker || input.symbol || input.q).toUpperCase();
  const assetType = cleanText(payload.assetClass || payload.type || input.type || '').toUpperCase() || 'ACAO';
  const summaryItems = buildSummaryItems(payload, assetType);
  const fundamentalItems = buildFundamentalItems(payload, assetType);
  const dividendSummaryItems = buildDividendSummaryItems(payload, assetType);
  const dividendHistoryItems = buildDividendHistoryItems(payload);
  const historicalItems = buildHistoricalIndicatorItems(payload, assetType);
  const historicalCharts = buildHistoricalIndicatorCharts(payload, assetType);
  const statementItems = buildFinancialStatementItems(payload);
  const statementCharts = buildFinancialStatementCharts(payload);
  const assetCharts = buildAssetCharts(payload);
  const companyProfileItems = buildCompanyProfileItems(payload, assetType);
  const revenueBreakdown = buildRevenueBreakdown(payload);
  const comparisons = buildComparisonItemsAndCharts(payload);
  const fiiDetails = buildFiiDetails(payload, assetType);

  const coreSections = [
    section('summary', assetType === 'FII' ? 'Resumo do FII' : 'Resumo do Ativo', 'metric_cards', summaryItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('fundamental_indicators', 'Indicadores Fundamentalistas', 'metric_grid', fundamentalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('dividends_summary', assetType === 'FII' ? 'Rendimentos' : 'Dividendos e Proventos', 'metric_cards', dividendSummaryItems, 'StatusInvest proventos por ativo'),
    section('dividends_history', 'Histórico de Proventos', 'table', dividendHistoryItems, 'StatusInvest proventos por ativo'),
    section('historical_indicators', 'Histórico de Indicadores', 'table', historicalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy', { charts: historicalCharts }),
    section('financial_statements', 'DRE, Balanço e Fluxo de Caixa', 'table', statementItems, 'StatusInvest/Yahoo fundamentals normalizados pelo Proxy', { charts: statementCharts }),
    section('asset_charts', 'Gráficos do Ativo', 'chart', chartPreviewItems(assetCharts), 'VALORAE Proxy séries estruturadas', { charts: assetCharts }),
    section('company_profile', assetType === 'FII' ? 'Sobre o Fundo' : 'Sobre a Empresa', 'text', companyProfileItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('revenue_breakdown', 'Negócios e Regiões de Receita', 'chart', revenueBreakdown.items, 'Investidor10/StatusInvest normalizados pelo Proxy', { charts: revenueBreakdown.charts }),
    section('comparisons', assetType === 'FII' ? 'Comparadores de FIIs e Índices' : 'Comparadores de Ações e Índices', 'comparison', comparisons.items, 'VALORAE Proxy comparadores estruturados', { charts: comparisons.charts }),
    ...(assetType === 'FII' ? [section('fii_details', 'FIIs completos', 'fii_details', fiiDetails.items, 'StatusInvest/Investidor10 dados específicos de FIIs', { charts: fiiDetails.charts })] : [])
  ];

  const sections = [
    ...coreSections,
    ...FUTURE_ANALYSIS_SECTIONS
      .filter(spec => !(assetType !== 'FII' && spec.id === 'fii_details'))
      .map(pendingSection)
  ];
  const ready = sections.filter(s => s.status === 'ready').length;
  const missing = sections.filter(s => s.status !== 'ready');
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
      revenueBreakdownItems: revenueBreakdown.items.length,
      comparisonItems: comparisons.items.length,
      fiiDetailsItems: fiiDetails.items.length,
      fiiDetailsCharts: fiiDetails.charts.length,
      missingSections: missing.map(s => s.id),
      legacyAssetEndpointUntouched: true,
      payloadSource: payload.source || 'VALORAE Fonte Oficial'
    }
  };
}

export const _test = { STOCK_INDICATORS, STOCK_HISTORICAL_INDICATORS, FII_HISTORICAL_INDICATORS, buildAnalysisPageResponse, buildSummaryItems, buildFundamentalItems, buildDividendSummaryItems, buildDividendHistoryItems, buildHistoricalIndicatorItems, buildHistoricalIndicatorCharts, buildFinancialStatementItems, buildFinancialStatementCharts, normalizeFinancialStatementRecords, buildRevenueBreakdown, buildComparisonItemsAndCharts, buildFiiDetails, buildAssetCharts, computeTwelveMonthVariation };
