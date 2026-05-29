// Taxonomia oficial de indicadores por classe de ativo.
// Objetivo: deixar o Engine preciso, didático e fácil de integrar no Web/APK.
// Sem dependências externas e compatível com Vercel Free.

export const VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION = '21.12.28-asset-indicator-taxonomy';

const STOCK_GROUPS = [
  { key: 'quote', title: 'Cotação e liquidez', purpose: 'Primeira pintura do app, cards e listas.', fields: [
    ['price','Preço atual','BRL','critical'], ['variation12m','Variação 12 meses','%','important'], ['dailyLiquidity','Liquidez média diária','BRL','important']
  ]},
  { key: 'valuation', title: 'Valuation', purpose: 'Múltiplos e preço relativo para triagem.', fields: [
    ['pl','P/L','ratio','critical'], ['psr','P/Receita','ratio','important'], ['pvp','P/VP','ratio','critical'], ['evEbitda','EV/EBITDA','ratio','important'], ['evEbit','EV/EBIT','ratio','important'], ['vpa','VPA','BRL','important'], ['lpa','LPA','BRL','important'], ['marketCap','Valor de mercado','BRL','important'], ['enterpriseValue','Valor de firma','BRL','optional']
  ]},
  { key: 'profitability', title: 'Rentabilidade e margens', purpose: 'Qualidade operacional da empresa.', fields: [
    ['roe','ROE','%','critical'], ['roic','ROIC','%','important'], ['roa','ROA','%','important'], ['netMargin','Margem líquida','%','important'], ['grossMargin','Margem bruta','%','optional'], ['ebitMargin','Margem EBIT','%','optional'], ['ebitdaMargin','Margem EBITDA','%','optional'], ['assetTurnover','Giro de ativos','ratio','optional']
  ]},
  { key: 'debt', title: 'Endividamento e estrutura', purpose: 'Risco financeiro e balanço.', fields: [
    ['netDebtEquity','Dívida líquida/Patrimônio','ratio','important'], ['netDebtEbitda','Dívida líquida/EBITDA','ratio','important'], ['grossDebtEquity','Dívida bruta/Patrimônio','ratio','optional'], ['currentLiquidity','Liquidez corrente','ratio','important'], ['equity','Patrimônio líquido','BRL','important'], ['assets','Ativos totais','BRL','optional'], ['cash','Disponibilidades','BRL','optional']
  ]},
  { key: 'growth', title: 'Crescimento', purpose: 'Tendência de receitas e lucros.', fields: [
    ['cagrRevenue5y','CAGR receitas 5a','%','important'], ['cagrProfit5y','CAGR lucros 5a','%','important'], ['revenue12m','Receita 12m','BRL','optional'], ['netIncome12m','Lucro 12m','BRL','optional']
  ]},
  { key: 'dividends', title: 'Dividendos', purpose: 'Renda e consistência de proventos.', fields: [
    ['dy','Dividend Yield','%','critical'], ['dyAverage5y','DY médio 5a','%','important'], ['payout','Payout','%','important'], ['lastDividend','Último provento','BRL','important'], ['dividendsPaid12m','Dividendos pagos 12m','BRL','optional']
  ]},
  { key: 'company', title: 'Empresa e governança', purpose: 'Contexto corporativo e filtros.', fields: [
    ['companyName','Nome da empresa','text','important'], ['cnpj','CNPJ','text','optional'], ['sector','Setor','text','important'], ['subsector','Subsetor','text','optional'], ['segment','Segmento','text','optional'], ['listingSegment','Segmento de listagem','text','optional'], ['freeFloat','Free float','%','optional'], ['tagAlong','Tag along','%','optional']
  ]}
];

const FII_GROUPS = [
  { key: 'quote', title: 'Cotação e liquidez', purpose: 'Cards, watchlist e leitura rápida do fundo.', fields: [
    ['price','Preço da cota','BRL','critical'], ['variation12m','Variação 12 meses','%','important'], ['dailyLiquidity','Liquidez diária/média','BRL','critical']
  ]},
  { key: 'income', title: 'Rendimentos', purpose: 'Renda recorrente, histórico e previsibilidade.', fields: [
    ['dy12m','DY 12 meses','%','critical'], ['dyAverage5y','DY médio 5a','%','important'], ['yield1m','Yield 1 mês','%','important'], ['yield3m','Yield 3 meses','%','optional'], ['yield6m','Yield 6 meses','%','optional'], ['yield12m','Yield 12 meses','%','important'], ['lastDividend','Último rendimento','BRL','critical'], ['paymentFrequency','Frequência de pagamento','text','optional']
  ]},
  { key: 'patrimonial', title: 'Valor patrimonial', purpose: 'P/VP e valor patrimonial para avaliar prêmio/desconto.', fields: [
    ['pvp','P/VP','ratio','critical'], ['bookValuePerShare','Valor patrimonial por cota','BRL','critical'], ['patrimonialValueTotal','Valor patrimonial total','BRL','important'], ['equity','Patrimônio líquido','BRL','important'], ['issuedShares','Cotas emitidas','number','optional']
  ]},
  { key: 'portfolio', title: 'Portfólio imobiliário', purpose: 'Diversificação, concentração e qualidade dos imóveis.', fields: [
    ['propertiesCount','Quantidade de imóveis','number','important'], ['grossLeasableArea','ABL total','m2','important'], ['statesExposure','Exposição por estado','object','optional'], ['properties','Lista de imóveis','array','optional']
  ]},
  { key: 'vacancy', title: 'Vacância', purpose: 'Risco operacional e ocupação.', fields: [
    ['physicalVacancy','Vacância física','%','critical'], ['financialVacancy','Vacância financeira','%','important'], ['vacancy','Vacância geral','%','important']
  ]},
  { key: 'fundProfile', title: 'Perfil do fundo', purpose: 'Mandato, gestão, público e taxas.', fields: [
    ['fundName','Razão social/nome','text','important'], ['cnpj','CNPJ','text','optional'], ['segment','Segmento','text','critical'], ['mandate','Mandato','text','important'], ['fundType','Tipo de fundo','text','important'], ['managementType','Tipo de gestão','text','optional'], ['adminFee','Taxa de administração','%/BRL','important'], ['shareholders','Cotistas','number','important']
  ]},
  { key: 'communications', title: 'Comunicados e relatórios', purpose: 'Eventos, informes mensais, relatórios gerenciais e fatos relevantes.', fields: [
    ['communications','Comunicados','array','important'], ['managementReports','Relatórios gerenciais','array','optional'], ['monthlyReports','Informes mensais','array','optional'], ['relevantFacts','Fatos relevantes','array','optional']
  ]}
];

const ALIASES = {
  price: ['precoAtual','currentPrice','cotacao','valorCota','marketPrice'],
  variation12m: ['variacao12m','rentabilidade12m'],
  dailyLiquidity: ['liquidezMediaDiaria','liquidezDiaria','volumeMedio'],
  pl: ['pl','p_l','precoLucro'], psr: ['psr','pReceita'], pvp: ['pvp','p_vp'],
  evEbitda: ['evEbitda','ev_ebitda'], evEbit: ['evEbit','ev_ebit'],
  roe: ['roe'], roic: ['roic'], roa: ['roa'], netMargin: ['margemLiquida'], grossMargin: ['margemBruta'], ebitMargin: ['margemEbit'], ebitdaMargin: ['margemEbitda'],
  vpa: ['vpa'], lpa: ['lpa'], marketCap: ['valorDeMercado','marketCap'], enterpriseValue: ['valorDeFirma','enterpriseValue'],
  netDebtEquity: ['dividaLiquidaPatrimonio'], netDebtEbitda: ['dividaLiquidaEbitda'], grossDebtEquity: ['dividaBrutaPatrimonio'], currentLiquidity: ['liquidezCorrente'], equity: ['patrimonioLiquido'], assets: ['ativosTotais','assets'], cash: ['disponibilidade','cash'],
  cagrRevenue5y: ['cagrReceitas5a'], cagrProfit5y: ['cagrLucros5a'], revenue12m: ['faturamento12m','receitaLiquida'], netIncome12m: ['lucro12m','lucroLiquido'],
  dy: ['dividendYield','dy'], dy12m: ['dividendYield','dy12m','yield12m'], dyAverage5y: ['dyMedio5a'], payout: ['payout'], lastDividend: ['ultimoRendimento','lastDividend'], dividendsPaid12m: ['totalDividendos12m'],
  companyName: ['nome','razaoSocial'], sector: ['setor','sector'], subsector: ['subsetor'], segment: ['segmento','segmentoFii'], listingSegment: ['segmentoListagem','listingSegment'], freeFloat: ['freeFloat'], tagAlong: ['tagAlong'],
  yield1m: ['yield1m'], yield3m: ['yield3m'], yield6m: ['yield6m'], yield12m: ['yield12m'], paymentFrequency: ['frequenciaPagamento'],
  bookValuePerShare: ['valorPatrimonialCota','valorPatrimonial'], patrimonialValueTotal: ['valorPatrimonialTotal'], issuedShares: ['cotasEmitidas'],
  propertiesCount: ['quantidadeImoveis','propertiesCount'], grossLeasableArea: ['ablTotalM2','grossLeasableArea'], statesExposure: ['estadosExposure'], properties: ['listaImoveis','properties'],
  physicalVacancy: ['vacanciaFisica','physicalVacancy'], financialVacancy: ['vacanciaFinanceira','financialVacancy'], vacancy: ['vacancia'],
  fundName: ['nome','razaoSocial'], mandate: ['mandato'], fundType: ['tipoFundo'], managementType: ['tipoGestao'], adminFee: ['taxaAdministracao'], shareholders: ['numeroCotistas','shareholders'],
  communications: ['comunicados'], managementReports: ['managementReports'], monthlyReports: ['monthlyReports'], relevantFacts: ['relevantFacts'], cnpj: ['cnpj']
};

function normalizeType(type = '') {
  const t = String(type || '').toUpperCase();
  return t === 'FII' ? 'FII' : 'ACAO';
}
function groupsFor(type) { return normalizeType(type) === 'FII' ? FII_GROUPS : STOCK_GROUPS; }
function hasValue(v) { return v !== undefined && v !== null && v !== '' && !(typeof v === 'number' && !Number.isFinite(v)); }
function unwrap(v) { return v && typeof v === 'object' && !Array.isArray(v) && ('value' in v || 'display' in v) ? (v.value ?? v.display) : v; }
function getCandidate(payload, aliases = []) {
  const bags = [payload?.appPayload?.metrics?.canonical, payload?.normalized, payload?.results, payload?.assetClassContract?.fieldConfidence].filter(Boolean);
  for (const alias of aliases) {
    for (const bag of bags) {
      const v = bag?.[alias];
      if (hasValue(unwrap(v))) return { alias, value: v };
    }
  }
  return null;
}

export function buildAssetIndicatorTaxonomy(type = 'ACAO') {
  const normalizedType = normalizeType(type);
  const groups = groupsFor(normalizedType).map(g => ({
    key: g.key,
    title: g.title,
    purpose: g.purpose,
    fields: g.fields.map(([key, label, unit, priority]) => ({ key, label, unit, priority, aliases: ALIASES[key] || [key] }))
  }));
  const fields = groups.flatMap(g => g.fields.map(f => ({ ...f, group: g.key })));
  return {
    version: VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION,
    assetType: normalizedType,
    model: normalizedType === 'FII' ? 'fundo_imobiliario' : 'empresa_listada',
    groups,
    fields,
    summary: {
      groups: groups.length,
      fields: fields.length,
      critical: fields.filter(f => f.priority === 'critical').length,
      important: fields.filter(f => f.priority === 'important').length,
      optional: fields.filter(f => f.priority === 'optional').length,
    }
  };
}

export function analyzeAssetIndicatorCoverage(payload = {}) {
  const taxonomy = buildAssetIndicatorTaxonomy(payload.type || payload.assetClassContract?.assetType || 'ACAO');
  const covered = [];
  const missing = [];
  const byGroup = taxonomy.groups.map(group => {
    const rows = group.fields.map(field => {
      const hit = getCandidate(payload, field.aliases);
      const row = { ...field, present: Boolean(hit), sourceAlias: hit?.alias || null, value: hit?.value?.display ?? hit?.value?.value ?? hit?.value ?? null };
      (row.present ? covered : missing).push(row);
      return row;
    });
    const present = rows.filter(r => r.present).length;
    const criticalMissing = rows.filter(r => !r.present && r.priority === 'critical');
    return { key: group.key, title: group.title, purpose: group.purpose, expected: rows.length, present, missing: rows.length - present, completenessPercent: rows.length ? Math.round((present / rows.length) * 10000) / 100 : 100, criticalMissing: criticalMissing.map(r => r.key), fields: rows };
  });
  const criticalTotal = taxonomy.fields.filter(f => f.priority === 'critical').length;
  const criticalPresent = covered.filter(f => f.priority === 'critical').length;
  const completenessPercent = taxonomy.fields.length ? Math.round((covered.length / taxonomy.fields.length) * 10000) / 100 : 100;
  const criticalCompletenessPercent = criticalTotal ? Math.round((criticalPresent / criticalTotal) * 10000) / 100 : 100;
  return {
    version: VALORAE_ASSET_INDICATOR_TAXONOMY_VERSION,
    assetType: taxonomy.assetType,
    model: taxonomy.model,
    completenessPercent,
    criticalCompletenessPercent,
    readyForPersonalUse: criticalCompletenessPercent >= 55 || covered.length >= 6,
    summary: { expected: taxonomy.fields.length, present: covered.length, missing: missing.length, criticalTotal, criticalPresent, criticalMissing: criticalTotal - criticalPresent },
    groups: byGroup,
    missingCriticalFields: missing.filter(f => f.priority === 'critical').map(f => ({ key: f.key, label: f.label, group: f.group, aliases: f.aliases })),
    missingImportantFields: missing.filter(f => f.priority === 'important').slice(0, 24).map(f => ({ key: f.key, label: f.label, group: f.group })),
    integration: {
      preferredRoot: 'assetIndicatorCoverage',
      fallbackRoots: ['assetClassContract', 'appPayload.metrics.canonical', 'normalized', 'results'],
      appHint: 'Use groups[].fields para montar telas por seção e missingCriticalFields para exibir aviso claro de dados parciais.'
    }
  };
}

export function buildIndicatorEndpointView(payload = {}) {
  const coverage = analyzeAssetIndicatorCoverage(payload);
  const taxonomy = buildAssetIndicatorTaxonomy(payload.type || 'ACAO');
  return {
    ticker: payload.ticker,
    type: payload.type,
    status: payload.status,
    taxonomy,
    coverage,
    assetClassContract: payload.assetClassContract ? {
      version: payload.assetClassContract.version,
      state: payload.assetClassContract.state,
      score: payload.assetClassContract.score,
      summary: payload.assetClassContract.summary,
    } : null,
    appRoots: {
      appMobileSnapshot: Boolean(payload.appMobileSnapshot),
      appPayload: Boolean(payload.appPayload),
      appSyncEnvelope: Boolean(payload.appSyncEnvelope),
      appResponseIntegrity: Boolean(payload.appResponseIntegrity),
    },
    nextBestEndpoints: payload.type === 'FII'
      ? ['/api/v1/fii/income','/api/v1/fii/patrimonial','/api/v1/fii/portfolio','/api/v1/fii/vacancy','/api/v1/fii/checklist']
      : ['/api/v1/asset/valuation','/api/v1/asset/profitability','/api/v1/asset/debt','/api/v1/asset/dividends','/api/v1/asset/source-map'],
  };
}
