import { compactEngineRuntimeProfiler } from './engine-runtime-profiler.js';
import { compactEngineLaunchGate } from './engine-launch-gate.js';

export const VALORAE_APP_VIEW_VERSION = '21.12.54-total-apk-proxy-contract';

function clone(value) {
  if (value == null) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function objectKeys(obj = {}) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
}

function compactEngineEfficiency(efficiency = {}) {
  if (!efficiency || typeof efficiency !== 'object') return undefined;
  return {
    version: efficiency.version,
    mode: efficiency.mode || efficiency.assemblyMode,
    scores: efficiency.scores,
    precision: efficiency.precision,
    reliability: efficiency.reliability,
    delivery: efficiency.delivery,
    recommendations: Array.isArray(efficiency.recommendations) ? efficiency.recommendations.slice(0, 6) : undefined,
    moduleTreeSummary: efficiency.moduleTreeSummary,
  };
}


function compactAssetClassContract(contract = {}) {
  if (!contract || typeof contract !== 'object') return undefined;
  const groups = {};
  for (const [key, group] of Object.entries(contract.groups || {})) {
    groups[key] = {
      title: group.title,
      description: group.description,
      completenessPercent: group.completenessPercent,
      present: group.present,
      expected: group.expected,
      missing: Array.isArray(group.missing) ? group.missing.slice(0, 8) : [],
      fields: Object.fromEntries(Object.entries(group.fields || {}).slice(0, 24).map(([field, value]) => [field, {
        value: value?.value,
        display: value?.display,
        unit: value?.unit,
        confidence: value?.confidence,
        source: value?.source,
      }]))
    };
  }
  return {
    version: contract.version,
    assetType: contract.assetType,
    sourceModel: contract.sourceModel,
    score: contract.score,
    state: contract.state,
    summary: contract.summary,
    groups,
    sourceMap: Array.isArray(contract.sourceMap) ? contract.sourceMap.slice(0, 8) : [],
    missingCriticalFields: Array.isArray(contract.missingCriticalFields) ? contract.missingCriticalFields.slice(0, 12) : [],
    appGuidance: contract.appGuidance,
  };
}


function compactAssetIndicatorCoverage(coverage = {}) {
  if (!coverage || typeof coverage !== 'object') return undefined;
  return {
    version: coverage.version,
    assetType: coverage.assetType,
    model: coverage.model,
    completenessPercent: coverage.completenessPercent,
    criticalCompletenessPercent: coverage.criticalCompletenessPercent,
    readyForPersonalUse: coverage.readyForPersonalUse,
    summary: coverage.summary,
    groups: Array.isArray(coverage.groups) ? coverage.groups.map(g => ({
      key: g.key,
      title: g.title,
      purpose: g.purpose,
      expected: g.expected,
      present: g.present,
      completenessPercent: g.completenessPercent,
      criticalMissing: g.criticalMissing,
      fields: Array.isArray(g.fields) ? g.fields.slice(0, 18).map(f => ({ key: f.key, label: f.label, unit: f.unit, priority: f.priority, present: f.present, sourceAlias: f.sourceAlias, value: f.value })) : [],
    })) : [],
    missingCriticalFields: Array.isArray(coverage.missingCriticalFields) ? coverage.missingCriticalFields.slice(0, 16) : [],
    integration: coverage.integration,
  };
}

function compactMaturityBooster(maturity = {}) {
  if (!maturity || typeof maturity !== 'object') return undefined;
  return {
    version: maturity.version,
    grade: maturity.grade,
    scores: maturity.scores,
    signals: maturity.signals,
    processingPlan: maturity.processingPlan,
    bottlenecks: Array.isArray(maturity.bottlenecks) ? maturity.bottlenecks.slice(0, 8) : [],
    recommendations: Array.isArray(maturity.recommendations) ? maturity.recommendations.slice(0, 8) : [],
  };
}

function compactFieldGuard(guard = {}) {
  if (!guard || typeof guard !== 'object') return undefined;
  return {
    version: guard.version,
    score: guard.score,
    state: guard.state,
    checkedFields: guard.checkedFields,
    issueCounts: guard.issueCounts,
    appPolicy: guard.appPolicy,
    topIssues: Array.isArray(guard.issues) ? guard.issues.slice(0, 8) : [],
  };
}

function compactPayloadBudget(budget = {}) {
  if (!budget || typeof budget !== 'object') return undefined;
  return {
    version: budget.version,
    view: budget.view,
    totalBytesApprox: budget.totalBytesApprox,
    state: budget.state,
    routePlan: budget.routePlan,
    thresholds: budget.thresholds,
    signals: budget.signals,
    topRoots: Array.isArray(budget.rootWeights) ? budget.rootWeights.slice(0, 8) : [],
    suggestions: Array.isArray(budget.suggestions) ? budget.suggestions.slice(0, 6) : [],
    appGuidance: budget.appGuidance,
  };
}

function compactActionPlan(plan = {}) {
  if (!plan || typeof plan !== 'object') return undefined;
  return {
    version: plan.version,
    score: plan.score,
    grade: plan.grade,
    releaseDecision: plan.releaseDecision,
    appInstructions: plan.appInstructions,
    suggestedPages: plan.suggestedPages,
    nextEndpoints: plan.nextEndpoints,
    priorityActions: Array.isArray(plan.priorityActions) ? plan.priorityActions.slice(0, 8) : [],
  };
}

function compactSourceReport(sourceReport = {}) {
  if (!sourceReport || typeof sourceReport !== 'object') return undefined;
  const tried = Array.isArray(sourceReport.sourcesTried) ? sourceReport.sourcesTried : [];
  return {
    primarySource: sourceReport.primarySource,
    sourcesUsed: sourceReport.sourcesUsed,
    totalTried: tried.length,
    ok: tried.filter(s => s?.ok || (Number(s?.status || 0) >= 200 && Number(s?.status || 0) < 400)).length,
    blocked: tried.filter(s => s?.blocked || [401, 403, 429].includes(Number(s?.status || 0))).length,
    failed: tried.filter(s => s?.error || Number(s?.status || 0) >= 400).length,
    attemptsPreview: tried.slice(0, 5).map(s => ({
      provider: s.provider || s.source || s.hostname,
      status: s.status,
      ok: Boolean(s.ok),
      blocked: Boolean(s.blocked),
      errorType: s.errorType,
      error: s.error ? String(s.error).slice(0, 120) : undefined,
    })),
  };
}


function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isBlankCompatValue(value) {
  if (value === undefined || value === null || value === '') return true;
  if (isPlainObject(value) && Object.keys(value).length === 0) return true;
  return false;
}

function fieldValue(field) {
  if (isBlankCompatValue(field)) return undefined;
  if (typeof field !== 'object' || Array.isArray(field)) return field;
  for (const candidate of [field.value, field.valor, field.display, field.raw, field.text]) {
    if (!isBlankCompatValue(candidate)) return candidate;
  }
  return undefined;
}

function metricField(metrics = {}, key, aliases = []) {
  const keys = [key, ...aliases];
  for (const k of keys) {
    const value = fieldValue(metrics?.[k]);
    if (!isBlankCompatValue(value)) return value;
  }
  return undefined;
}

function contractFieldsFromOfficialView(contract = {}) {
  const out = {};
  const groups = contract?.groups;
  if (!groups || typeof groups !== 'object') return out;
  for (const group of Object.values(groups)) {
    const fields = group?.fields;
    if (!fields || typeof fields !== 'object') continue;
    for (const [key, field] of Object.entries(fields)) {
      const value = fieldValue(field);
      if (isBlankCompatValue(value)) continue;
      out[key] = value;
      if (field?.sourceAlias && typeof field.sourceAlias === 'string') out[field.sourceAlias] = value;
    }
  }
  return out;
}

function coverageFieldsFromOfficialView(coverage = {}) {
  const out = {};
  const groups = Array.isArray(coverage?.groups) ? coverage.groups : [];
  for (const group of groups) {
    const fields = Array.isArray(group?.fields) ? group.fields : [];
    for (const field of fields) {
      const value = fieldValue(field);
      if (isBlankCompatValue(value)) continue;
      if (field?.key) out[field.key] = value;
      if (field?.sourceAlias && typeof field.sourceAlias === 'string') out[field.sourceAlias] = value;
    }
  }
  return out;
}


function buildLegacyTopLevelCompat({ p = {}, metrics = {}, cotacao = {}, indicadores = {}, informacoesEmpresa = {}, informacoesFundo = {}, valorPatrimonial = {} } = {}) {
  const pick = (key, aliases = []) => metricField(metrics, key, aliases);
  const out = {
    ticker: p.ticker,
    symbol: p.ticker,
    tipo: p.type,
    type: p.type,
    nome: informacoesEmpresa.nome || informacoesFundo.nome || p.results?.nome || p.ticker,
    precoAtual: cotacao.precoAtual,
    price: cotacao.precoAtual,
    currentPrice: cotacao.precoAtual,
    variacaoDay: cotacao.variacaoDay,
    changePercent: cotacao.variacaoDay,
    dividendYield: indicadores.dividendYield,
    dy: indicadores.dividendYield,
    ultimoRendimento: indicadores.ultimoRendimento,
    lastDividend: indicadores.ultimoRendimento,
    pvp: indicadores.pvp,
    pl: indicadores.pl,
    psr: indicadores.psr,
    roe: indicadores.roe,
    roic: indicadores.roic,
    roa: indicadores.roa,
    margemLiquida: indicadores.margemLiquida,
    margemBruta: indicadores.margemBruta,
    margemEbit: indicadores.margemEbit,
    margemEbitda: indicadores.margemEbitda,
    payout: indicadores.payout,
    evEbitda: indicadores.evEbitda,
    evEbit: indicadores.evEbit,
    pEbitda: indicadores.pEbitda,
    pEbit: indicadores.pEbit,
    pAtivo: indicadores.pAtivo,
    pCapGiro: indicadores.pCapGiro,
    pAtivoCircLiq: indicadores.pAtivoCircLiq,
    giroAtivos: indicadores.giroAtivos,
    dividaLiquidaPatrimonio: indicadores.dividaLiquidaPatrimonio,
    dividaLiquidaEbitda: indicadores.dividaLiquidaEbitda,
    dividaLiquidaEbit: indicadores.dividaLiquidaEbit,
    dividaBrutaPatrimonio: indicadores.dividaBrutaPatrimonio,
    patrimonioAtivos: indicadores.patrimonioAtivos,
    passivosAtivos: indicadores.passivosAtivos,
    liquidezCorrente: indicadores.liquidezCorrente,
    cagrReceitas5a: indicadores.cagrReceitas5a,
    cagrLucros5a: indicadores.cagrLucros5a,
    yield1m: indicadores.yield1m,
    yield3m: indicadores.yield3m,
    yield6m: indicadores.yield6m,
    yield12m: indicadores.yield12m,
    vacanciaFisica: informacoesFundo.vacanciaFisica ?? indicadores.vacanciaFisica,
    vacanciaFinanceira: indicadores.vacanciaFinanceira,
    valorPatrimonial: valorPatrimonial.valorPatrimonial,
    valorPatrimonialCota: informacoesFundo.valorPatrimonialCota ?? valorPatrimonial.valorPatrimonial,
    patrimonioLiquido: informacoesFundo.patrimonioLiquido ?? informacoesEmpresa.patrimonioLiquido ?? valorPatrimonial.patrimonioLiquido,
    valorDeMercado: informacoesEmpresa.valorDeMercado,
    liquidezMediaDiaria: informacoesEmpresa.liquidezMediaDiaria,
    numeroCotistas: informacoesFundo.numeroCotistas ?? informacoesFundo.cotistas,
    cotistas: informacoesFundo.cotistas ?? informacoesFundo.numeroCotistas,
    cotasEmitidas: informacoesFundo.cotasEmitidas,
    quantidadeCotas: informacoesFundo.cotasEmitidas,
    taxaAdministracao: informacoesFundo.taxaAdministracao,
    tipoFundo: informacoesFundo.tipoFundo,
    segmentoFii: informacoesFundo.segmentoFii,
    mandato: informacoesFundo.mandato,
    publicoAlvo: informacoesFundo.publicoAlvo,
    tipoGestao: informacoesFundo.tipoGestao,
    prazoDuracao: informacoesFundo.prazoDuracao,
    setor: informacoesEmpresa.setor,
    subsetor: informacoesEmpresa.subsetor,
    segmento: informacoesEmpresa.segmento || informacoesFundo.segmentoFii,
    segmentoListagem: informacoesEmpresa.segmentoListagem,
    cnpj: informacoesEmpresa.cnpj || informacoesFundo.cnpj,
  };
  for (const [key, aliases] of Object.entries({
    lpa: ['lucroPorAcao'],
    vpa: ['valorPatrimonialCota','bookValuePerShare','vpCota'],
    freeFloat: ['free_float'],
    tagAlong: ['tag_along'],
    valorDeFirma: ['enterpriseValue','firmValue'],
    ativos: ['ativosTotais','totalAssets'],
    totalAtivos: ['ativosTotais','totalAssets'],
    ativoCirculante: ['currentAssets'],
    dividaBruta: ['grossDebt'],
    dividaLiquida: ['netDebt'],
    disponibilidade: ['cash','availability'],
    totalPapeis: ['sharesOutstanding','issuedShares'],
  })) {
    out[key] = out[key] ?? pick(key, aliases);
  }
  for (const key of Object.keys(out)) if (isBlankCompatValue(out[key])) delete out[key];
  return out;
}

function buildLegacyAdvancedAliases(metrics = {}) {
  const pick = (key, aliases = []) => metricField(metrics, key, aliases);
  const out = {
    p_l: pick('pl', ['p_l','priceEarnings','priceToEarnings']),
    p_vp: pick('pvp', ['p_vp','priceBook','priceToBook']),
    psr: pick('psr', ['priceSales','priceToSales']),
    roe: pick('roe'),
    roic: pick('roic'),
    roa: pick('roa'),
    net_margin: pick('margemLiquida', ['netMargin']),
    gross_margin: pick('margemBruta', ['grossMargin']),
    ebit_margin: pick('margemEbit', ['ebitMargin']),
    ebitda_margin: pick('margemEbitda', ['ebitdaMargin']),
    payout: pick('payout'),
    ev_ebitda: pick('evEbitda', ['enterpriseValueEbitda']),
    ev_ebit: pick('evEbit'),
    p_ebitda: pick('pEbitda', ['priceEbitda']),
    p_ebit: pick('pEbit', ['priceEbit']),
    p_assets: pick('pAtivo', ['priceAsset']),
    p_working_capital: pick('pCapGiro'),
    p_asset_current_net: pick('pAtivoCircLiq'),
    active_turns: pick('giroAtivos'),
    net_debt_net_worth: pick('dividaLiquidaPatrimonio', ['netDebtEquity']),
    net_debt_ebitda: pick('dividaLiquidaEbitda', ['netDebtEbitda']),
    net_debt_ebit: pick('dividaLiquidaEbit'),
    gross_debt_net_worth: pick('dividaBrutaPatrimonio', ['grossDebtEquity']),
    net_worth_assets: pick('patrimonioAtivos'),
    liabilities_assets: pick('passivosAtivos'),
    current_liquidity: pick('liquidezCorrente', ['currentLiquidity']),
    growth_net_revenue_last_5_years: pick('cagrReceitas5a', ['cagrRevenue5y']),
    growth_net_profit_last_5_years: pick('cagrLucros5a', ['cagrProfit5y']),
    market_value: pick('valorDeMercado', ['marketCap','marketValue']),
    balance_net_worth: pick('patrimonioLiquido', ['netWorth','equity']),
    balance_total_assets: pick('ativosTotais', ['ativos','totalAssets']),
    balance_current_assets: pick('ativoCirculante', ['currentAssets']),
    balance_gross_debt: pick('dividaBruta', ['grossDebt']),
    balance_net_debt: pick('dividaLiquida', ['netDebt']),
    balance_availability: pick('disponibilidade', ['cash','availability']),
    free_float: pick('freeFloat'),
    tag_along: pick('tagAlong'),
    dividend_yield: pick('dividendYield', ['dy']),
    dividend_yield_last_12_months: pick('yield12m', ['dividendYield','dy']),
    vpa: pick('vpa', ['valorPatrimonialCota','bookValuePerShare','vpCota']),
  };
  for (const key of Object.keys(out)) if (isBlankCompatValue(out[key])) delete out[key];
  return out;
}

function compactResultsFromOfficialRoots(p = {}) {
  const appPayload = p.appPayload || {};
  const appSnapshot = p.appMobileSnapshot || {};
  const contractMetrics = contractFieldsFromOfficialView(p.assetClassContract);
  const coverageMetrics = coverageFieldsFromOfficialView(p.assetIndicatorCoverage);
  const metrics = Object.assign(
    {},
    contractMetrics,
    coverageMetrics,
    p.normalized || {},
    appSnapshot?.metrics || {},
    appPayload?.metrics?.canonical || {}
  );
  const quote = appPayload?.quote || appSnapshot?.quote || {};
  const dividends = appPayload?.dividends || appSnapshot?.dividends || {};
  const assetChartBundle = p.assetChartBundle || p.assetChartsMobile || p.results?.assetChartBundle || p.results?.assetChartsMobile || appPayload?.assetChartBundle || appPayload?.charts?.assetChartBundle || appSnapshot?.assetChartBundle;
  const normalized = Object.fromEntries(Object.entries(metrics || {}).filter(([k, v]) => k !== '_meta' && !isBlankCompatValue(fieldValue(v))));

  function pick(key, aliases = []) {
    return metricField(metrics, key, aliases);
  }

  const cotacao = {
    precoAtual: pick('precoAtual', ['price', 'currentPrice']) ?? quote.price ?? quote.priceDisplay,
    variacaoDay: pick('variacaoDay', ['dayChange', 'changeDay']) ?? quote.dayChange ?? quote.dayChangeDisplay,
    dividendYield: pick('dividendYield', ['dy']) ?? quote.dividendYield ?? quote.dividendYieldDisplay,
  };
  const indicadores = {
    dividendYield: pick('dividendYield', ['dy', 'yield12m', 'dividend_yield_last_12_months']) ?? dividends.dy,
    dyMedio5a: pick('dyMedio5a', ['averageDy5y']),
    ultimoRendimento: pick('ultimoRendimento', ['lastDividend']) ?? dividends.lastIncome,
    pvp: pick('pvp', ['p_vp', 'priceBook', 'priceToBook']),
    pl: pick('pl', ['p_l', 'priceEarnings', 'priceToEarnings']),
    psr: pick('psr', ['priceSales', 'priceToSales']),
    roe: pick('roe'),
    roic: pick('roic'),
    roa: pick('roa'),
    margemLiquida: pick('margemLiquida', ['netMargin']),
    margemBruta: pick('margemBruta', ['grossMargin']),
    margemEbit: pick('margemEbit', ['ebitMargin']),
    margemEbitda: pick('margemEbitda', ['ebitdaMargin']),
    payout: pick('payout'),
    evEbitda: pick('evEbitda'),
    evEbit: pick('evEbit'),
    pEbitda: pick('pEbitda', ['priceEbitda']),
    pEbit: pick('pEbit', ['priceEbit']),
    pAtivo: pick('pAtivo', ['priceAsset']),
    pCapGiro: pick('pCapGiro'),
    pAtivoCircLiq: pick('pAtivoCircLiq'),
    giroAtivos: pick('giroAtivos'),
    dividaLiquidaPatrimonio: pick('dividaLiquidaPatrimonio', ['netDebtEquity']),
    dividaLiquidaEbitda: pick('dividaLiquidaEbitda', ['netDebtEbitda']),
    dividaLiquidaEbit: pick('dividaLiquidaEbit'),
    dividaBrutaPatrimonio: pick('dividaBrutaPatrimonio', ['grossDebtEquity']),
    patrimonioAtivos: pick('patrimonioAtivos'),
    passivosAtivos: pick('passivosAtivos'),
    liquidezCorrente: pick('liquidezCorrente', ['currentLiquidity']),
    vacanciaFisica: pick('vacanciaFisica', ['physicalVacancy', 'vacancy']),
    vacanciaFinanceira: pick('vacanciaFinanceira', ['financialVacancy']),
    cagrReceitas5a: pick('cagrReceitas5a', ['cagrRevenue5y']),
    cagrLucros5a: pick('cagrLucros5a', ['cagrProfit5y']),
    yield1m: pick('yield1m'),
    yield3m: pick('yield3m'),
    yield6m: pick('yield6m'),
    yield12m: pick('yield12m', ['dividendYield', 'dy']),
  };
  const informacoesEmpresa = {
    nome: quote.name || p.results?.nome || p.ticker,
    nomeCompleto: quote.name || p.results?.nomeCompleto || p.results?.nome || p.ticker,
    setor: p.results?.informacoesEmpresa?.setor || p.results?.setor || pick('setor', ['sector']),
    subsetor: p.results?.informacoesEmpresa?.subsetor || p.results?.subsetor || p.results?.subSetor || pick('subsetor', ['subSector']),
    segmento: p.results?.informacoesEmpresa?.segmento || p.results?.segmento || pick('segmento', ['segment']),
    segmentoListagem: pick('segmentoListagem', ['listingSegment']),
    cnpj: pick('cnpj'),
    valorDeFirma: pick('valorDeFirma', ['enterpriseValue', 'firmValue']),
    valorDeMercado: pick('valorDeMercado', ['marketCap', 'marketValue']),
    patrimonioLiquido: pick('patrimonioLiquido', ['netWorth', 'equity']),
    liquidezMediaDiaria: pick('liquidezMediaDiaria', ['dailyLiquidity']),
    freeFloat: pick('freeFloat'),
    tagAlong: pick('tagAlong'),
    ativos: pick('ativosTotais', ['ativos', 'totalAssets']),
    totalAtivos: pick('ativosTotais', ['ativos', 'totalAssets']),
    ativoCirculante: pick('ativoCirculante', ['currentAssets']),
    dividaBruta: pick('dividaBruta', ['grossDebt']),
    dividaLiquida: pick('dividaLiquida', ['netDebt']),
    disponibilidade: pick('disponibilidade', ['cash', 'availability']),
    totalPapeis: pick('totalPapeis', ['sharesOutstanding', 'issuedShares']),
  };
  const informacoesFundo = {
    nome: quote.name || p.results?.nome || p.ticker,
    segmentoFii: p.results?.informacoesFundo?.segmentoFii || p.results?.segmentoFii || p.results?.segmento || pick('segmentoFii', ['segmento', 'segment']),
    cnpj: pick('cnpj'),
    vacanciaFisica: pick('vacanciaFisica', ['physicalVacancy', 'vacancy']),
    valorPatrimonialCota: pick('valorPatrimonialCota', ['valorPatrimonial', 'bookValuePerShare', 'vpCota']),
    patrimonioLiquido: pick('patrimonioLiquido', ['netWorth', 'equity']),
    numeroCotistas: pick('numeroCotistas', ['cotistas', 'holders', 'fiiTotalHolders']),
    cotistas: pick('numeroCotistas', ['cotistas', 'holders', 'fiiTotalHolders']),
    cotasEmitidas: pick('cotasEmitidas', ['quantidadeCotas', 'issuedShares', 'fiiIssuedShares']),
    taxaAdministracao: pick('taxaAdministracao', ['adminFee']),
    tipoFundo: pick('tipoFundo', ['fundType']),
    mandato: pick('mandato'),
    publicoAlvo: pick('publicoAlvo', ['targetAudience']),
    tipoGestao: pick('tipoGestao', ['managementType']),
    prazoDuracao: pick('prazoDuracao', ['duration']),
  };
  const dividendHistory = Array.isArray(dividends.history) ? dividends.history
    : Array.isArray(dividends.recentHistory) ? dividends.recentHistory
    : Array.isArray(p.results?.dividendos?.historico) ? p.results.dividendos.historico
    : [];

  const advancedAliases = buildLegacyAdvancedAliases(metrics);
  const topLevelCompat = buildLegacyTopLevelCompat({ p, metrics, cotacao, indicadores, informacoesEmpresa, informacoesFundo, valorPatrimonial: {
    valorPatrimonial: pick('valorPatrimonialCota', ['valorPatrimonial', 'bookValuePerShare', 'vpCota']),
    patrimonioLiquido: pick('patrimonioLiquido', ['netWorth', 'equity']),
  } });

  const results = {
    ...topLevelCompat,
    nome: quote.name || p.results?.nome || p.ticker,
    tipo: p.type,
    cotacao,
    indicadores,
    dividendos: {
      dividendYield: indicadores.dividendYield,
      ultimoRendimento: indicadores.ultimoRendimento,
      historico: dividendHistory,
      history: dividendHistory,
    },
    informacoesEmpresa,
    informacoesFundo,
    financialSummary: {
      ...informacoesEmpresa,
      ratiosChave: indicadores,
      keyRatios: indicadores,
    },
    ratiosChave: indicadores,
    keyRatios: indicadores,
    indicadoresAvancados: advancedAliases,
    advancedMetrics: advancedAliases,
    sections: {
      indicadores,
      financialSummary: { ...informacoesEmpresa, ratiosChave: indicadores, keyRatios: indicadores },
      informacoesEmpresa,
      informacoesFundo,
      indicadoresAvancados: advancedAliases,
      valorPatrimonial: {
        valorPatrimonial: pick('valorPatrimonialCota', ['valorPatrimonial', 'bookValuePerShare', 'vpCota']),
        patrimonioLiquido: pick('patrimonioLiquido', ['netWorth', 'equity']),
      },
      charts: appPayload?.charts || appSnapshot?.charts || undefined,
      assetChartBundle,
      assetChartsMobile: assetChartBundle,
    },
    valorPatrimonial: {
      valorPatrimonial: pick('valorPatrimonialCota', ['valorPatrimonial', 'bookValuePerShare', 'vpCota']),
      patrimonioLiquido: pick('patrimonioLiquido', ['netWorth', 'equity']),
    },
    charts: appPayload?.charts || appSnapshot?.charts || undefined,
    assetChartBundle,
    assetChartsMobile: assetChartBundle,
  };

  for (const obj of [cotacao, indicadores, informacoesEmpresa, informacoesFundo, results.valorPatrimonial, results.financialSummary, results.ratiosChave, results.keyRatios, results.indicadoresAvancados, results.advancedMetrics]) {
    for (const key of Object.keys(obj)) if (isBlankCompatValue(obj[key])) delete obj[key];
  }
  return { normalized, results };
}

function buildEndpointCoverage(payload = {}) {
  const normalized = payload.normalized || {};
  const appPayload = payload.appPayload || {};
  const chartCount = Number(appPayload?.charts?.count || appPayload?.charts?.series?.length || payload.chartSeries?.series?.length || 0);
  const metricCount = Number(appPayload?.metrics?.count || objectKeys(appPayload?.metrics?.canonical).length || objectKeys(normalized).filter(k => k !== '_meta').length || 0);
  const dividendCount = Number(appPayload?.dividends?.count || appPayload?.dividends?.items?.length || payload.results?.dividendos?.historico?.length || 0);
  return {
    version: VALORAE_APP_VIEW_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    score: payload.quality?.score ?? payload.valoraeScore?.score ?? payload.appResponseIntegrity?.score ?? null,
    blocks: {
      quote: Boolean(appPayload?.quote?.price || normalized.precoAtual || normalized.price),
      metrics: metricCount > 0,
      fundamentals: Boolean(payload.assetClassContract?.score >= 35 || metricCount >= (payload.type === 'FII' ? 6 : 8)),
      charts: chartCount > 0,
      dividends: dividendCount > 0,
      sourceTrace: Boolean(payload.sourceReport || payload.cacheStatus),
      renderSafe: Boolean(payload.appResponseIntegrity?.renderSafe || payload.appDataContract?.renderSafe),
      cacheSafe: Boolean(payload.appResponseIntegrity?.cacheSafe || payload.appDataContract?.canReplacePreviousSnapshot),
    },
    counts: {
      metrics: metricCount,
      chartSeries: chartCount,
      chartPoints: Number(appPayload?.charts?.bestPointCount || appPayload?.charts?.totalPoints || 0),
      dividends: dividendCount,
      warnings: Array.isArray(payload.warnings) ? payload.warnings.length : 0,
    },
    missingCritical: payload.appDataContract?.uiGuards?.missingCritical || payload.appPayload?.blankShield?.missingCritical || [],
    recommendation: payload.appResponseIntegrity?.recommendedAction || payload.appSyncEnvelope?.decision || (payload.partial ? 'render_partial_keep_previous_available' : 'render'),
  };
}

export function buildOfficialAppView(payload = {}) {
  const p = clone(payload) || {};
  const endpointCoverage = buildEndpointCoverage(p);
  const legacyCompat = compactResultsFromOfficialRoots(p);
  const output = {
    schemaVersion: p.schemaVersion,
    version: p.version,
    view: 'app',
    officialAppContractVersion: VALORAE_APP_VIEW_VERSION,
    status: p.status,
    partial: Boolean(p.partial),
    ticker: p.ticker,
    type: p.type,
    generatedAt: p.metrics?.generatedAt || new Date().toISOString(),
    cacheStatus: p.cacheStatus,
    news: Array.isArray(p.news) ? p.news.slice(0, 10) : undefined,
    newsStatus: p.newsStatus,
    warnings: Array.isArray(p.warnings) ? p.warnings.slice(0, 8) : [],

    // Compatibilidade direta com APKs que ainda mapeiam results/normalized.
    // Mantém a visão app enxuta, mas espelha os campos canônicos oficiais para evitar telas sem dados.
    normalized: legacyCompat.normalized,
    results: legacyCompat.results,
    legacyAppCompat: {
      version: '21.12.54-total-apk-proxy-contract-compat',
      preferredRoots: ['appMobileSnapshot', 'appPayload'],
      mirroredRoots: ['normalized', 'results'],
      reason: 'APK VALORAE consome campos antigos e oficiais durante a transição.'
    },

    // Raízes oficiais que Web/APK devem consumir. O monitor também detecta estas raízes.
    assetChartBundle: p.assetChartBundle || p.assetChartsMobile || p.results?.assetChartBundle || p.appPayload?.assetChartBundle || p.appPayload?.charts?.assetChartBundle || p.appMobileSnapshot?.assetChartBundle,
    assetChartsMobile: p.assetChartBundle || p.assetChartsMobile || p.results?.assetChartBundle || p.appPayload?.assetChartBundle || p.appPayload?.charts?.assetChartBundle || p.appMobileSnapshot?.assetChartBundle,
    assetAnalysisPage: p.assetAnalysisPage || p.results?.assetAnalysisPage || p.results?.sections?.assetAnalysisPage || p.appPayload?.assetAnalysisPage || p.appMobileSnapshot?.assetAnalysisPage,
    appMobileSnapshot: p.appMobileSnapshot ? { ...p.appMobileSnapshot, assetAnalysisPage: p.appMobileSnapshot.assetAnalysisPage || p.assetAnalysisPage || p.results?.assetAnalysisPage || p.results?.sections?.assetAnalysisPage || p.appPayload?.assetAnalysisPage } : p.appMobileSnapshot,
    appPayload: p.appPayload ? { ...p.appPayload, assetAnalysisPage: p.appPayload.assetAnalysisPage || p.assetAnalysisPage || p.results?.assetAnalysisPage || p.results?.sections?.assetAnalysisPage || p.appMobileSnapshot?.assetAnalysisPage } : p.appPayload,
    appSyncEnvelope: p.appSyncEnvelope,
    appResponseIntegrity: p.appResponseIntegrity,
    engineEfficiency: compactEngineEfficiency(p.engineEfficiency),
    engineMaturityBooster: compactMaturityBooster(p.engineMaturityBooster),
    assetClassContract: compactAssetClassContract(p.assetClassContract),
    assetIndicatorCoverage: compactAssetIndicatorCoverage(p.assetIndicatorCoverage),
    fieldConsistencyGuard: compactFieldGuard(p.fieldConsistencyGuard),
    payloadBudget: compactPayloadBudget(p.payloadBudget),
    assetActionPlan: compactActionPlan(p.assetActionPlan),
    engineRuntimeProfiler: compactEngineRuntimeProfiler(p.engineRuntimeProfiler),
    engineLaunchGate: compactEngineLaunchGate(p.engineLaunchGate),

    // Diagnóstico enxuto para lançamento e integração.
    endpointCoverage,
    normalizedSummary: {
      count: objectKeys(legacyCompat.normalized).filter(k => k !== '_meta').length,
      fields: objectKeys(legacyCompat.normalized).filter(k => k !== '_meta').slice(0, 80),
      meta: legacyCompat.normalized?._meta || p.normalized?._meta,
    },
    sourceReport: compactSourceReport(p.sourceReport),
    extractionCompleteness: p.metrics?.extractionCompleteness,
    dataReliability: p.dataReliability,
    bestSnapshotHydration: p.bestSnapshotHydration,
    metrics: p.metrics?.extractionCompleteness ? {
      generatedAt: p.metrics?.generatedAt,
      source: p.metrics?.source,
      foundKeysCount: p.metrics?.foundKeysCount,
      performanceProfile: p.metrics?.performanceProfile,
      extractionCompleteness: p.metrics.extractionCompleteness,
    } : undefined,
    appContract: {
      stableRootOrder: ['assetAnalysisPage', 'assetChartBundle', 'appMobileSnapshot', 'appPayload', 'news', 'newsStatus', 'appSyncEnvelope', 'appResponseIntegrity', 'assetActionPlan', 'engineLaunchGate', 'fieldConsistencyGuard', 'payloadBudget', 'assetIndicatorCoverage', 'engineMaturityBooster', 'engineRuntimeProfiler', 'dataReliability'],
      firstPaintRoot: 'appMobileSnapshot',
      hydrateRoot: 'appPayload',
      cacheDecisionRoot: 'appSyncEnvelope',
      safetyRoot: 'appResponseIntegrity',
      debugViews: ['standard', 'full', 'analysis'],
      rule: 'Nunca apague o último snapshot bom quando renderSafe/cacheSafe vier falso ou status vier PARTIAL.',
    },
    links: {
      self: `/api/v1/asset?ticker=${encodeURIComponent(p.ticker || '')}&view=app`,
      coverage: `/api/v1/asset/coverage?ticker=${encodeURIComponent(p.ticker || '')}`,
      fundamentals: `/api/v1/asset/fundamentals?ticker=${encodeURIComponent(p.ticker || '')}`,
      sourceMap: `/api/v1/asset/source-map?ticker=${encodeURIComponent(p.ticker || '')}`,
      quality: `/api/v1/asset/quality?ticker=${encodeURIComponent(p.ticker || '')}`,
      actionPlan: `/api/v1/asset/action-plan?ticker=${encodeURIComponent(p.ticker || '')}`,
      integrationManifest: '/api/v1/integration/manifest',
      profile: `/api/v1/${p.type === 'FII' ? 'fii' : 'asset'}/profile?ticker=${encodeURIComponent(p.ticker || '')}`,
      sourceStatus: '/api/v1/source/status',
      fields: '/api/v1/fields',
      openapi: '/api/v1/openapi',
    },
  };
  Object.keys(output).forEach(k => output[k] === undefined && delete output[k]);
  return output;
}
