import { parseFinancialNumber, parsePercentNumber } from '../normalizers/numbers.js';

export const VALORAE_ASSET_CLASS_CONTRACT_VERSION = '21.12.27-investidor10-class-contract';

const STOCK_GROUPS = {
  profile: {
    title: 'Perfil da empresa',
    description: 'Identidade, setor, subsetor, segmento, governança e dados corporativos que ajudam o app a tratar a ação como empresa.',
    fields: ['nome','cnpj','setor','subsetor','segmento','listingSegment','freeFloat','tagAlong','totalPapeis']
  },
  quote: {
    title: 'Cotação',
    description: 'Preço, variação diária/anual e liquidez para cards de primeira renderização.',
    fields: ['precoAtual','variacaoDay','variacao12m','liquidezMediaDiaria']
  },
  valuation: {
    title: 'Valuation',
    description: 'Múltiplos de preço, valor patrimonial e valor de mercado usados para comparação e filtros.',
    fields: ['pl','psr','pvp','evEbitda','evEbit','pEbitda','pEbit','pAtivo','pCapGiro','pAtivoCircLiq','vpa','lpa','valorDeMercado','valorDeFirma']
  },
  profitability: {
    title: 'Rentabilidade e eficiência',
    description: 'Indicadores de retorno, margens e crescimento de receitas/lucros.',
    fields: ['roe','roic','roa','margemLiquida','margemBruta','margemEbit','margemEbitda','giroAtivos','cagrReceitas5a','cagrLucros5a']
  },
  debt: {
    title: 'Endividamento e liquidez',
    description: 'Estrutura de capital, dívida, caixa, liquidez corrente e passivos.',
    fields: ['dividaLiquidaPatrimonio','dividaLiquidaEbitda','dividaLiquidaEbit','dividaBrutaPatrimonio','patrimonioAtivos','passivosAtivos','liquidezCorrente','dividaBruta','dividaLiquida','disponibilidade','ativosTotais','ativoCirculante','patrimonioLiquido']
  },
  dividends: {
    title: 'Dividendos',
    description: 'DY atual, média histórica, payout, último provento e histórico de pagamentos.',
    fields: ['dividendYield','dyMedio5a','payout','ultimoRendimento','totalDividendos12m']
  },
  statements: {
    title: 'Demonstrações e séries financeiras',
    description: 'Receitas, lucros, patrimônio, balanço e gráficos financeiros quando captados das páginas/API.',
    fields: ['faturamento12m','lucro12m','receitaLiquida','lucroLiquido','receitasLucros','lucroCotacao','resultados','evolucaoPatrimonio','balancoPatrimonial']
  },
  peers: {
    title: 'Comparação setorial',
    description: 'Comparativos por setor, subsetor, segmento, pares e índices.',
    fields: ['comparativoSetor','comparadorAcoes','comparacaoIndices','comparacaoCommodity','tabelaComparativoPares']
  }
};

const FII_GROUPS = {
  profile: {
    title: 'Perfil do FII',
    description: 'Identidade do fundo, CNPJ, público-alvo, mandato, segmento, tipo, gestão, duração e taxa de administração.',
    fields: ['nome','cnpj','publicoAlvo','mandato','segmentoFii','tipoFundo','prazoDuracao','tipoGestao','taxaAdministracao']
  },
  quote: {
    title: 'Cotação',
    description: 'Preço da cota, variação e liquidez para cards/listas do app.',
    fields: ['precoAtual','variacaoDay','variacao12m','liquidezDiaria','liquidezMediaDiaria']
  },
  income: {
    title: 'Rendimentos',
    description: 'Rendimento mensal, DY por janelas, média em 5 anos e proventos pagos.',
    fields: ['dividendYield','dyMedio5a','yield1m','yield3m','yield6m','yield12m','ultimoRendimento','totalDividendos12m','frequenciaPagamento']
  },
  patrimonial: {
    title: 'Valor patrimonial',
    description: 'VP por cota, P/VP, patrimônio líquido, valor patrimonial total e cotas emitidas.',
    fields: ['pvp','valorPatrimonial','valorPatrimonialCota','valorPatrimonialTotal','patrimonioLiquido','cotasEmitidas','valorDeMercado']
  },
  portfolio: {
    title: 'Portfólio imobiliário',
    description: 'Imóveis, estados, ABL, quantidade de propriedades e concentração por região.',
    fields: ['quantidadeImoveis','grossLeasableArea','ablTotalM2','estadosExposure','properties','listaImoveis','maioresImoveis']
  },
  vacancy: {
    title: 'Vacância',
    description: 'Vacância física e financeira, quando disponível, para leitura de risco operacional.',
    fields: ['vacanciaFisica','vacanciaFinanceira','vacancia','physicalVacancy','financialVacancy']
  },
  holders: {
    title: 'Cotistas e liquidez',
    description: 'Número de cotistas, cotas emitidas e liquidez diária/média.',
    fields: ['numeroCotistas','cotasEmitidas','liquidezDiaria','liquidezMediaDiaria']
  },
  communications: {
    title: 'Comunicados',
    description: 'Relatórios gerenciais, informes mensais, fatos relevantes e comunicados captados.',
    fields: ['comunicados','managementReports','monthlyReports','relevantFacts','reports']
  },
  checklist: {
    title: 'Checklist FII',
    description: 'Critérios buy and hold e critérios operacionais úteis para triagem de FIIs.',
    fields: ['checklistBah','listed5y','liquidityAbove700k','holdersAbove20k','equityAbove1b','propertiesAbove5','physicalVacancyBelow10','financialVacancyBelow10']
  },
  peers: {
    title: 'Comparação FII',
    description: 'Médias do tipo/segmento, comparativos de FIIs e comparação com índices.',
    fields: ['mediaTipoSegmento','comparacaoFiis','comparacaoIndices','pvpMedioTipo','dyMedioTipo']
  }
};

const FIELD_ALIASES = {
  price: 'precoAtual', currentPrice: 'precoAtual', dy: 'dividendYield', p_vp: 'pvp', marketCap: 'valorDeMercado', lastDividend: 'ultimoRendimento', dailyLiquidity: 'liquidezMediaDiaria', bookValuePerShare: 'valorPatrimonialCota',
  valorPatrimonialCota: 'valorPatrimonial', vpCota: 'valorPatrimonial', shareholders: 'numeroCotistas', issuedShares: 'cotasEmitidas', propertiesCount: 'quantidadeImoveis', grossLeasableArea: 'ablTotalM2', statesExposure: 'estadosExposure', properties: 'listaImoveis', reports: 'comunicados', relevantFacts: 'comunicados', monthlyReports: 'comunicados', managementReports: 'comunicados',
  receitaLiquida: 'faturamento12m', lucroLiquido: 'lucro12m', listingSegment: 'segmentoListagem', totalShares: 'totalPapeis', assets: 'ativosTotais', currentAssets: 'ativoCirculante', grossDebt: 'dividaBruta', netDebt: 'dividaLiquida', cash: 'disponibilidade', sector: 'setor', subsector: 'subsetor', segment: 'segmento'
};

const RESULT_PATHS = {
  setor: ['informacoesEmpresa.setor','dadosEmpresa.setor','comparativoSetor.setor','sections.empresa.dados.setor'],
  subsetor: ['informacoesEmpresa.subsetor','dadosEmpresa.subsetor','comparativoSetor.subsetor'],
  segmento: ['informacoesEmpresa.segmento','dadosEmpresa.segmento','comparativoSetor.segmento'],
  segmentoListagem: ['informacoesEmpresa.segmentoListagem','dadosEmpresa.segmentoListagem','listingSegment'],
  totalPapeis: ['informacoesEmpresa.totalPapeis','totalPapeis'],
  ativoCirculante: ['informacoesEmpresa.ativoCirculante','ativoCirculante'],
  dividaBruta: ['informacoesEmpresa.dividaBruta','dividaBruta'],
  dividaLiquida: ['informacoesEmpresa.dividaLiquida','dividaLiquida'],
  disponibilidade: ['informacoesEmpresa.disponibilidade','disponibilidade'],
  receitasLucros: ['sections.demonstrativos.receitasLucros','chartsFinanceiros.receitasLucros'],
  lucroCotacao: ['sections.demonstrativos.lucroCotacao','chartsFinanceiros.lucroCotacao'],
  resultados: ['sections.demonstrativos.resultados'],
  evolucaoPatrimonio: ['sections.demonstrativos.evolucaoPatrimonio','chartsFinanceiros.evolucaoPatrimonio'],
  balancoPatrimonial: ['sections.demonstrativos.balancoPatrimonial'],
  comparativoSetor: ['comparativoSetor','indicadoresFundamentalistas.comparativoSetor'],
  comparadorAcoes: ['sections.comparadorAcoes','sections.comparador'],
  comparacaoIndices: ['sections.comparacaoIndices'],
  comparacaoCommodity: ['sections.comparacaoCommodity'],
  tabelaComparativoPares: ['tabelaComparativoPares','sections.comparador.pares'],
  listaImoveis: ['sections.listaImoveis','portafolioImoveis','portfolioImoveis'],
  quantidadeImoveis: ['portfolioStats.quantidadeImoveis','sections.portfolioStats.quantidadeImoveis'],
  ablTotalM2: ['portfolioStats.ablTotalM2','sections.portfolioStats.ablTotalM2'],
  estadosExposure: ['portfolioStats.estados','sections.portfolioStats.estados'],
  maioresImoveis: ['portfolioStats.maioresImoveis','sections.portfolioStats.maioresImoveis'],
  comunicados: ['sections.comunicados','comunicados','noticias'],
  checklistBah: ['sections.checklistBah','checklistBuyAndHold'],
  mediaTipoSegmento: ['sections.mediaTipoSegmento'],
};

function keys(obj = {}) { return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : []; }
function hasValue(v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)); }
function getPath(root, path) {
  if (!root || !path) return undefined;
  let cur = root;
  for (const part of String(path).split('.')) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}
function isFieldObject(v) { return v && typeof v === 'object' && !Array.isArray(v) && ('value' in v || 'display' in v || 'unit' in v); }
function unwrap(v) { return isFieldObject(v) ? (v.value ?? v.display) : v; }
function unitForKey(key = '', value) {
  const k = String(key || '').toLowerCase();
  if (/yield|dy|roe|roic|roa|margem|payout|cagr|vacancia|float|tagalong|percent/.test(k)) return '%';
  if (/preco|valor|mercado|firma|patrimonio|liquidez|rendimento|dividend|faturamento|lucro|receita|divida|disponibilidade|ativo|cash|debt/.test(k)) return 'BRL';
  if (/area|abl|m2/.test(k)) return 'm2';
  if (/pl|pvp|psr|ev|pativo|vpa|lpa|giro|liquidezcorrente/.test(k)) return 'ratio';
  return Array.isArray(value) || (value && typeof value === 'object') ? 'object' : 'number';
}
function numericFor(key, value, unit) {
  const raw = unwrap(value);
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  if (raw == null || typeof raw === 'object') return undefined;
  if (unit === '%') return parsePercentNumber(raw);
  return parseFinancialNumber(raw);
}
function resolveField(payload = {}, field = '') {
  const canonical = FIELD_ALIASES[field] || field;
  const normalized = payload.normalized || {};
  const appCanonical = payload.appPayload?.metrics?.canonical || {};
  const aliases = payload.appPayload?.metrics?.aliases || {};
  const results = payload.results || {};
  const candidates = [];
  const push = (path, value, source, confidence = 0.72) => { if (hasValue(value)) candidates.push({ path, value, source, confidence }); };
  push(`appPayload.metrics.canonical.${field}`, appCanonical[field], 'appPayload', 0.94);
  if (canonical !== field) push(`appPayload.metrics.canonical.${canonical}`, appCanonical[canonical], 'appPayload', 0.93);
  const alias = aliases[field] || aliases[canonical];
  if (alias) push(`appPayload.metrics.canonical.${alias}`, appCanonical[alias], 'appPayload.alias', 0.9);
  push(`normalized.${field}`, normalized[field], 'normalized', 0.9);
  if (canonical !== field) push(`normalized.${canonical}`, normalized[canonical], 'normalized.alias', 0.9);
  push(`results.${field}`, results[field], 'results', 0.82);
  if (canonical !== field) push(`results.${canonical}`, results[canonical], 'results.alias', 0.82);
  for (const p of RESULT_PATHS[field] || RESULT_PATHS[canonical] || []) push(`results.${p}`, getPath(results, p), 'results.section', 0.78);
  const best = candidates.find(c => hasValue(unwrap(c.value)) || Array.isArray(c.value) || (c.value && typeof c.value === 'object'));
  if (!best) return { field, canonical, present: false, supported: true };
  const v = best.value;
  const raw = unwrap(v);
  const unit = isFieldObject(v) ? v.unit : unitForKey(canonical, raw);
  const numberValue = numericFor(canonical, v, unit);
  const display = isFieldObject(v) ? (v.display ?? String(raw)) : (typeof raw === 'object' ? undefined : String(raw));
  return {
    field,
    canonical,
    present: true,
    supported: true,
    value: numberValue ?? raw,
    display,
    unit,
    source: isFieldObject(v) ? (v.source || best.source) : best.source,
    confidence: Number(isFieldObject(v) ? (v.confidence ?? best.confidence) : best.confidence),
    path: best.path,
    alternatives: candidates.slice(1, 5).map(c => ({ path: c.path, source: c.source, display: isFieldObject(c.value) ? c.value.display : String(unwrap(c.value)).slice(0, 120) })),
  };
}
function buildGroups(payload = {}, groupDefs = {}) {
  const out = {};
  const allFields = {};
  for (const [name, def] of Object.entries(groupDefs)) {
    const fields = {};
    const missing = [];
    for (const field of def.fields) {
      const resolved = resolveField(payload, field);
      if (resolved.present) fields[field] = resolved;
      else missing.push(field);
      allFields[field] = resolved;
    }
    const present = keys(fields).length;
    out[name] = {
      title: def.title,
      description: def.description,
      present,
      expected: def.fields.length,
      completenessPercent: def.fields.length ? Math.round((present / def.fields.length) * 100) : 0,
      fields,
      missing,
      recommendedUi: present ? 'render_group_with_missing_badges' : 'hide_or_show_unavailable_state',
    };
  }
  return { groups: out, fields: allFields };
}
function buildClassChecklist(assetType, groups = {}) {
  if (assetType === 'fii') {
    const f = groups;
    return [
      { id: 'income_available', label: 'Rendimentos captados', ok: (f.income?.present || 0) >= 3 },
      { id: 'patrimonial_available', label: 'VP/PVP disponível', ok: (f.patrimonial?.present || 0) >= 2 },
      { id: 'profile_available', label: 'Perfil do fundo disponível', ok: (f.profile?.present || 0) >= 4 },
      { id: 'vacancy_available', label: 'Vacância disponível', ok: (f.vacancy?.present || 0) >= 1 },
      { id: 'portfolio_available', label: 'Portfólio/imóveis disponível', ok: (f.portfolio?.present || 0) >= 1 },
      { id: 'communications_available', label: 'Comunicados disponíveis', ok: (f.communications?.present || 0) >= 1 },
    ];
  }
  const f = groups;
  return [
    { id: 'valuation_available', label: 'Valuation captado', ok: (f.valuation?.present || 0) >= 4 },
    { id: 'profitability_available', label: 'Rentabilidade/margens captadas', ok: (f.profitability?.present || 0) >= 3 },
    { id: 'debt_available', label: 'Endividamento captado', ok: (f.debt?.present || 0) >= 2 },
    { id: 'dividends_available', label: 'Dividendos captados', ok: (f.dividends?.present || 0) >= 2 },
    { id: 'profile_available', label: 'Perfil corporativo disponível', ok: (f.profile?.present || 0) >= 3 },
    { id: 'statements_available', label: 'Demonstrações/séries disponíveis', ok: (f.statements?.present || 0) >= 1 },
  ];
}
function summarizeSources(fields = {}) {
  const counts = {};
  for (const f of Object.values(fields)) {
    if (!f?.present) continue;
    const s = f.source || 'unknown';
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([source,count])=>({ source, count }));
}
function flattenFieldConfidence(fields = {}) {
  const out = {};
  for (const [key, f] of Object.entries(fields)) {
    out[key] = {
      present: Boolean(f.present),
      value: f.present ? f.value : undefined,
      display: f.display,
      unit: f.unit,
      source: f.source,
      confidence: f.present ? Math.round(Number(f.confidence || 0.65) * 100) / 100 : 0,
      path: f.path,
      freshness: f.present ? 'current_payload' : 'missing_in_payload',
      crossChecked: Array.isArray(f.alternatives) && f.alternatives.length > 0,
    };
  }
  return out;
}
export function buildAssetClassContract(payload = {}) {
  const rawType = String(payload.type || '').toUpperCase();
  const assetType = rawType === 'FII' ? 'fii' : rawType === 'ETF' ? 'etf' : rawType === 'BDR' ? 'bdr' : rawType === 'STOCK' ? 'stock_us' : 'stock';
  const defs = assetType === 'fii' ? FII_GROUPS : STOCK_GROUPS;
  const { groups, fields } = buildGroups(payload, defs);
  const expected = Object.values(groups).reduce((sum, g) => sum + g.expected, 0);
  const present = Object.values(groups).reduce((sum, g) => sum + g.present, 0);
  const score = expected ? Math.round((present / expected) * 100) : 0;
  const checklist = buildClassChecklist(assetType, groups);
  const missingCriticalFields = Object.entries(groups)
    .flatMap(([group, g]) => (g.completenessPercent < 35 ? g.missing.slice(0, 6).map(field => ({ group, field })) : []))
    .slice(0, 24);
  return {
    version: VALORAE_ASSET_CLASS_CONTRACT_VERSION,
    ticker: payload.ticker,
    assetType,
    sourceModel: assetType === 'fii' ? 'fii-as-fund' : 'stock-as-company',
    score,
    state: score >= 72 ? 'strong' : score >= 45 ? 'partial_usable' : 'source_limited',
    summary: {
      presentFields: present,
      expectedFields: expected,
      groupCount: keys(groups).length,
      readyGroups: Object.values(groups).filter(g => g.completenessPercent >= 50).length,
      missingCriticalCount: missingCriticalFields.length,
    },
    groups,
    fieldConfidence: flattenFieldConfidence(fields),
    dataCompletenessByAssetType: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.completenessPercent])),
    missingCriticalFields,
    sourceMap: summarizeSources(fields),
    sourceDisagreement: [],
    checklist,
    appGuidance: {
      firstPaint: 'appMobileSnapshot',
      fundamentals: 'assetClassContract.groups',
      fieldConfidence: 'assetClassContract.fieldConfidence',
      sourceMap: 'assetClassContract.sourceMap',
      missingState: 'Mostrar campo como indisponível quando present=false; não inventar valores.',
    },
  };
}
export function buildAssetGroupView(payload = {}, groupName = '') {
  const contract = payload.assetClassContract || buildAssetClassContract(payload);
  const group = contract.groups?.[groupName] || null;
  return {
    version: VALORAE_ASSET_CLASS_CONTRACT_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    assetType: contract.assetType,
    group: groupName,
    title: group?.title || groupName,
    description: group?.description || 'Grupo não encontrado no contrato especializado do ativo.',
    status: payload.status,
    partial: Boolean(payload.partial),
    completenessPercent: group?.completenessPercent || 0,
    present: group?.present || 0,
    expected: group?.expected || 0,
    fields: group?.fields || {},
    missing: group?.missing || [],
    sourceMap: contract.sourceMap,
    fieldConfidence: Object.fromEntries(Object.entries(contract.fieldConfidence || {}).filter(([k]) => group?.fields?.[k] || group?.missing?.includes(k))),
    appGuidance: contract.appGuidance,
  };
}
export function buildAssetSourceMapView(payload = {}) {
  const contract = payload.assetClassContract || buildAssetClassContract(payload);
  return {
    version: VALORAE_ASSET_CLASS_CONTRACT_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    assetType: contract.assetType,
    score: contract.score,
    sourceMap: contract.sourceMap,
    fieldConfidence: contract.fieldConfidence,
    missingCriticalFields: contract.missingCriticalFields,
    sourceDisagreement: contract.sourceDisagreement,
    recommendation: contract.state === 'strong' ? 'Dados suficientes para painéis completos.' : 'Renderize grupos disponíveis e mostre campos ausentes com badge de fonte limitada.',
  };
}
export function buildFiiChecklistView(payload = {}) {
  const contract = payload.assetClassContract || buildAssetClassContract(payload);
  const g = contract.groups || {};
  const fc = contract.fieldConfidence || {};
  const num = (key) => Number(fc[key]?.value);
  const checks = [
    { id: 'dy_available', label: 'DY 12m disponível', ok: Boolean(fc.dividendYield?.present || fc.yield12m?.present), value: fc.dividendYield?.display || fc.yield12m?.display },
    { id: 'pvp_available', label: 'P/VP disponível', ok: Boolean(fc.pvp?.present), value: fc.pvp?.display },
    { id: 'holders_available', label: 'Número de cotistas disponível', ok: Boolean(fc.numeroCotistas?.present), value: fc.numeroCotistas?.display },
    { id: 'liquidity_available', label: 'Liquidez diária disponível', ok: Boolean(fc.liquidezDiaria?.present || fc.liquidezMediaDiaria?.present), value: fc.liquidezDiaria?.display || fc.liquidezMediaDiaria?.display },
    { id: 'equity_available', label: 'Patrimônio disponível', ok: Boolean(fc.patrimonioLiquido?.present || fc.valorPatrimonialTotal?.present), value: fc.patrimonioLiquido?.display || fc.valorPatrimonialTotal?.display },
    { id: 'portfolio_available', label: 'Portfólio/imóveis disponível', ok: (g.portfolio?.present || 0) > 0, value: g.portfolio?.present },
    { id: 'physical_vacancy_below_10_when_available', label: 'Vacância física abaixo de 10% quando disponível', ok: Number.isFinite(num('vacanciaFisica')) ? num('vacanciaFisica') < 10 : null, value: fc.vacanciaFisica?.display },
    { id: 'financial_vacancy_below_10_when_available', label: 'Vacância financeira abaixo de 10% quando disponível', ok: Number.isFinite(num('vacanciaFinanceira')) ? num('vacanciaFinanceira') < 10 : null, value: fc.vacanciaFinanceira?.display },
  ];
  const known = checks.filter(c => c.ok !== null);
  const score = known.length ? Math.round(known.filter(c => c.ok).length / known.length * 100) : 0;
  return {
    version: VALORAE_ASSET_CLASS_CONTRACT_VERSION,
    ticker: payload.ticker,
    type: payload.type,
    assetType: contract.assetType,
    score,
    state: score >= 75 ? 'fii_checklist_good' : score >= 45 ? 'fii_checklist_partial' : 'fii_checklist_limited',
    checks,
    note: 'Critérios educativos inspirados em leitura buy and hold de FIIs; não é recomendação de investimento.',
  };
}
export function listAssetClassEndpoints() {
  return {
    stock: ['/api/v1/asset/profile','/api/v1/asset/valuation','/api/v1/asset/profitability','/api/v1/asset/debt','/api/v1/asset/dividends','/api/v1/asset/statements','/api/v1/asset/peers','/api/v1/asset/source-map'],
    fii: ['/api/v1/fii/profile','/api/v1/fii/income','/api/v1/fii/patrimonial','/api/v1/fii/portfolio','/api/v1/fii/vacancy','/api/v1/fii/communications','/api/v1/fii/checklist'],
  };
}
