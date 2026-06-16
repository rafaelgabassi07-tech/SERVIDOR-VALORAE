import { parsePtNumber, parsePercent, round } from './financial.js';
import { parseFinancialNumber, parsePercentNumber } from './numbers.js';

export const UNIVERSAL_NORMALIZER_VERSION = '21.12.27-investidor10-field-alias-normalizer';

const MONEY_KEYS = new Set([
  'precoAtual','valorDeMercado','valorDeFirma','patrimonioLiquido','liquidezDiaria','liquidezMediaDiaria',
  'valorPatrimonial','valorPatrimonialCota','ultimoRendimento','faturamento12m','dividaBruta','dividaLiquida',
  'disponibilidade','ativos','ativoCirculante','totalInvested','currentValue','monthlyEstimate','annualIncomeEstimated',
  'realizedPnL','unrealizedPnL','totalPnL','averagePrice','currentPrice','investedValue','cashAvailable',
  'valorDeFirma','ativosTotais','ativoCirculante','receitaLiquida','lucroLiquido','lucro12m','valorPatrimonialTotal','dividaBruta','dividaLiquida','grossLeasableArea','ablTotalM2'
]);

const PERCENT_KEYS = new Set([
  'dividendYield','dy','dyMedio5a','yield1m','yield3m','yield6m','yield12m','variacaoDay','variacao12m',
  'roe','roic','roa','margemLiquida','margemBruta','margemEbit','margemEbitda','payout','cagrReceitas5a','cagrLucros5a',
  'vacanciaFisica','vacanciaFinanceira','freeFloat','tagAlong','percentOfPortfolio','targetPercent','gapPercent',
  'financialVacancy','physicalVacancy','yieldMedio','rentabilidadeReal','rentabilidade1m','rentabilidade3m','rentabilidade1a','rentabilidade5a'
]);

const RATIO_KEYS = new Set([
  'pl','pvp','psr','pEbitda','pEbit','pAtivo','pCapGiro','pAtivoCircLiq','evEbitda','evEbit',
  'lpa','vpa','giroAtivos','liquidezCorrente','dividaLiquidaPatrimonio','dividaLiquidaEbitda',
  'dividaLiquidaEbit','dividaBrutaPatrimonio','patrimonioAtivos','passivosAtivos','payoutRatio','pvpMedioTipo','dyMedioTipo'
]);

function hasValue(value) {
  return value !== undefined && value !== null && value !== '' && !(typeof value === 'number' && !Number.isFinite(value));
}

function inferUnit(key, value) {
  const k = String(key || '');
  if (PERCENT_KEYS.has(k) || String(value || '').includes('%')) return '%';
  if (MONEY_KEYS.has(k) || /^\s*(R\$|BRL)/i.test(String(value || ''))) return 'BRL';
  if (/abl|area/i.test(k)) return 'm2';
  if (RATIO_KEYS.has(k)) return 'ratio';
  return 'number';
}

function inferNumber(key, value, unit) {
  if (!hasValue(value)) return undefined;
  const parsed = unit === '%' ? parsePercentNumber(value) : parseFinancialNumber(value);
  if (parsed !== null && parsed !== undefined) return parsed;
  if (unit === '%') return parsePercent(value);
  return parsePtNumber(value);
}

function normalizeKeyName(key = '') {
  return String(key || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[%$]/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const FIELD_ALIAS_MAP = new Map(Object.entries({
  // Cotação/preço
  precoatual: 'precoAtual', preco: 'precoAtual', cotacao: 'precoAtual', valoratual: 'precoAtual', ultimo: 'precoAtual', lastprice: 'precoAtual', currentprice: 'precoAtual', price: 'precoAtual', last: 'precoAtual',
  variacaodia: 'variacaoDay', variacaoday: 'variacaoDay', variacaohoje: 'variacaoDay', oscilacaodia: 'variacaoDay', changeday: 'variacaoDay', daychange: 'variacaoDay', variacao: 'variacaoDay',
  variacao12m: 'variacao12m', variacaoano: 'variacao12m', variacaoanual: 'variacao12m', change12m: 'variacao12m', yearchange: 'variacao12m',

  // Dividendos/proventos/yields
  dividendyield: 'dividendYield', dividendyield12m: 'dividendYield', dy: 'dividendYield', dy12m: 'dividendYield', yield: 'dividendYield', yield12meses: 'dividendYield', rendimentodividendo: 'dividendYield',
  dymedio5a: 'dyMedio5a', dymedio5anos: 'dyMedio5a', mediadividendyield5anos: 'dyMedio5a', averagedy5y: 'dyMedio5a', dyavg5y: 'dyMedio5a',
  ultimorendimento: 'ultimoRendimento', ultimodividendo: 'ultimoRendimento', ultimoprovento: 'ultimoRendimento', lastdividend: 'ultimoRendimento', lastincome: 'ultimoRendimento', rendimento: 'ultimoRendimento', provento: 'ultimoRendimento',
  totaldividendos12m: 'totalDividendos12m', proventos12m: 'totalDividendos12m', dividendos12m: 'totalDividendos12m', income12m: 'totalDividendos12m',
  yield1m: 'yield1m', yield3m: 'yield3m', yield6m: 'yield6m', yield12m: 'yield12m',


  // Indicadores detalhados de ações inspirados nas páginas de Ação
  precoacao: 'precoAtual', cotacaoatual: 'precoAtual', variacao12meses: 'variacao12m',
  precoareceita: 'psr', precoreceita: 'psr', pporreceita: 'psr', psrcanonical: 'psr',
  pativo: 'pAtivo', precoativo: 'pAtivo', pcapgiro: 'pCapGiro', pcapitaldegiro: 'pCapGiro', pativocirculanteliquido: 'pAtivoCircLiq', pacl: 'pAtivoCircLiq',
  vpa: 'vpa', valorpatrimonialporacao: 'vpa', lpa: 'lpa', lucroporacao: 'lpa', giroativos: 'giroAtivos', girodeativos: 'giroAtivos',
  margembruta: 'margemBruta', margemebit: 'margemEbit', margemoperacional: 'margemEbit',
  dividalıquidapatrimonio: 'dividaLiquidaPatrimonio', dividaliquidapatrimonio: 'dividaLiquidaPatrimonio', divliqpl: 'dividaLiquidaPatrimonio',
  dividaliquidaebitda: 'dividaLiquidaEbitda', dividaliquidaebit: 'dividaLiquidaEbit', dividabrutapatrimonio: 'dividaBrutaPatrimonio',
  patrimonioativos: 'patrimonioAtivos', passivosativos: 'passivosAtivos', liquidezcorrente: 'liquidezCorrente',
  cagrreceitas5anos: 'cagrReceitas5a', cagrreceitas: 'cagrReceitas5a', cagrreceita5anos: 'cagrReceitas5a',
  cagrlucros5anos: 'cagrLucros5a', cagrlucros: 'cagrLucros5a', cagrlucro5anos: 'cagrLucros5a',
  valorfirma: 'valorDeFirma', enterprisevalue: 'valorDeFirma', ev: 'valorDeFirma', ativostotais: 'ativosTotais', totaldeativos: 'ativosTotais', ativos: 'ativosTotais',
  ativocirculante: 'ativoCirculante', divida: 'dividaBruta', dividabruta: 'dividaBruta', dividaliquida: 'dividaLiquida', caixa: 'disponibilidade', disponibilidade: 'disponibilidade',
  totaldepapeis: 'totalPapeis', totalacoes: 'totalPapeis', acoesemitidas: 'totalPapeis', segmentodelistagem: 'segmentoListagem', governanca: 'segmentoListagem',

  // Campos cadastrais e de FII vistos em páginas de FII
  numerocotistas: 'numeroCotistas', ndeCotistas: 'numeroCotistas', cotistas: 'numeroCotistas', shareholders: 'numeroCotistas',
  cotasemitidas: 'cotasEmitidas', numerodecotas: 'cotasEmitidas', issuedshares: 'cotasEmitidas',
  taxaadministracao: 'taxaAdministracao', taxaadm: 'taxaAdministracao', adminfee: 'taxaAdministracao',
  tipofundo: 'tipoFundo', fundtype: 'tipoFundo', segmentofii: 'segmentoFii', segmentofundo: 'segmentoFii', mandato: 'mandato', publicoalvo: 'publicoAlvo', targetaudience: 'publicoAlvo',
  tipogestao: 'tipoGestao', managementtype: 'tipoGestao', prazoduracao: 'prazoDuracao', duration: 'prazoDuracao',
  vacanciafinanceira: 'vacanciaFinanceira', financialvacancy: 'vacanciaFinanceira', vacanciafisica: 'vacanciaFisica', physicalvacancy: 'vacanciaFisica',
  valorpatrimonialtotal: 'valorPatrimonialTotal', patrimonialvaluetotal: 'valorPatrimonialTotal', patrimonialvalue: 'valorPatrimonialTotal',
  quantidadeimoveis: 'quantidadeImoveis', numerodeimoveis: 'quantidadeImoveis', propertiescount: 'quantidadeImoveis',
  areabrutalocavel: 'ablTotalM2', abl: 'ablTotalM2', grossleasablearea: 'ablTotalM2',

  // Valuation/fundamentos
  pvp: 'pvp', pvpratio: 'pvp', pricebook: 'pvp', pricetobook: 'pvp', pvalorpatrimonial: 'pvp',
  pl: 'pl', per: 'pl', pe: 'pl', pricetoearnings: 'pl', precolucro: 'pl', pearnings: 'pl',
  psr: 'psr', pebitda: 'pEbitda', pebit: 'pEbit', evebitda: 'evEbitda', evebit: 'evEbit',
  roe: 'roe', roic: 'roic', roa: 'roa', payout: 'payout', margemliquida: 'margemLiquida', margemebitda: 'margemEbitda',

  // Patrimônio/liquidez
  valorpatrimonialcota: 'valorPatrimonialCota', vpcota: 'valorPatrimonialCota', valorpatrimonialporcota: 'valorPatrimonialCota', bookvaluepershare: 'valorPatrimonialCota', vp: 'valorPatrimonialCota',
  patrimonioliquido: 'patrimonioLiquido', patrimonio: 'patrimonioLiquido', networth: 'patrimonioLiquido', patrimoniofundo: 'patrimonioLiquido',
  valordemercado: 'valorDeMercado', valormercado: 'valorDeMercado', marketcap: 'valorDeMercado', marketvalue: 'valorDeMercado',
  liquidezmediadiaria: 'liquidezMediaDiaria', liquidezdiaria: 'liquidezMediaDiaria', volumemediario: 'liquidezMediaDiaria', dailyliquidity: 'liquidezMediaDiaria', volume: 'liquidezMediaDiaria',
  vacanciafisica: 'vacanciaFisica', vacancia: 'vacanciaFisica', physicalvacancy: 'vacanciaFisica', vacancy: 'vacanciaFisica'
}));

function canonicalAliasForKey(key = '') {
  const normalized = normalizeKeyName(key);
  return FIELD_ALIAS_MAP.get(normalized) || null;
}

function collectAliasCandidates(root = {}, options = {}) {
  const out = new Map();
  const maxDepth = Number(options.maxDepth || 4);
  const maxEntries = Number(options.maxEntries || 420);
  let seen = 0;
  const visit = (value, path = [], depth = 0) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > maxDepth || seen >= maxEntries) return;
    for (const [key, child] of Object.entries(value)) {
      if (seen >= maxEntries) break;
      seen += 1;
      const canonical = canonicalAliasForKey(key);
      const childPath = [...path, key];
      if (canonical && hasValue(child) && (typeof child !== 'object' || child instanceof Date)) {
        const arr = out.get(canonical) || [];
        arr.push({ value: child, path: childPath.join('.') });
        out.set(canonical, arr);
      }
      if (child && typeof child === 'object' && !Array.isArray(child)) visit(child, childPath, depth + 1);
      if (Array.isArray(child) && child.length && child.length <= 24) {
        for (let i = 0; i < Math.min(child.length, 8); i++) {
          if (child[i] && typeof child[i] === 'object' && !Array.isArray(child[i])) visit(child[i], [...childPath, String(i)], depth + 1);
        }
      }
    }
  };
  visit(root);
  return out;
}

function setAliasFallbacks(out = {}, payload = {}) {
  const candidates = collectAliasCandidates(payload.results || payload.data?.results || {});
  for (const [key, items] of candidates.entries()) {
    if (out[key]) continue;
    const item = items.find(x => hasValue(x.value));
    if (!item) continue;
    const f = makeFinancialField(key, item.value, { source: `valorae:alias:${item.path}`, confidence: 0.74 });
    if (f) out[key] = f;
  }
}

export function makeFinancialField(key, value, options = {}) {
  if (!hasValue(value)) return undefined;
  const unit = options.unit || inferUnit(key, value);
  const n = inferNumber(key, value, unit);
  return {
    display: String(value),
    value: n === undefined ? undefined : round(n, unit === 'BRL' ? 2 : 4),
    unit,
    source: options.source || 'valorae:derived',
    confidence: options.confidence ?? (n === undefined ? 0.55 : 0.9),
  };
}

function setIf(out, key, value, source, confidence = 0.9) {
  const f = makeFinancialField(key, value, { source, confidence });
  if (f) out[key] = f;
}

export function buildUniversalNormalized(payload = {}) {
  const out = { ...(payload.normalized || {}) };
  const r = payload.results || payload.data?.results || {};
  const candidates = [
    ['precoAtual', r.precoAtual ?? r.cotacao?.precoAtual ?? payload.cotacao?.precoAtual, 'cotacao'],
    ['variacaoDay', r.variacaoDay ?? r.cotacao?.variacaoDay ?? payload.cotacao?.variacaoDay, 'cotacao'],
    ['variacao12m', r.variacao12m ?? r.cotacao?.variacao12m ?? payload.cotacao?.variacao12m, 'cotacao'],
    ['dividendYield', r.dividendYield ?? r.indicadores?.dividendYield ?? r.dividendos?.dividendYield ?? r.indicadoresFundamentalistas?.semComparativos?.dividendYield, 'indicadores'],
    ['dyMedio5a', r.dyMedio5a ?? r.dividendos?.dyMedio5a, 'dividendos'],
    ['pvp', r.pvp ?? r.indicadores?.pvp ?? r.indicadoresFundamentalistas?.semComparativos?.pvp, 'indicadores'],
    ['pl', r.pl ?? r.indicadores?.pl ?? r.indicadoresFundamentalistas?.semComparativos?.pl, 'indicadores'],
    ['roe', r.roe ?? r.indicadores?.roe ?? r.indicadoresFundamentalistas?.semComparativos?.roe, 'indicadores'],
    ['roic', r.roic ?? r.indicadores?.roic ?? r.indicadoresFundamentalistas?.semComparativos?.roic, 'indicadores'],
    ['roa', r.roa ?? r.indicadores?.roa ?? r.indicadoresFundamentalistas?.semComparativos?.roa, 'indicadores'],
    ['margemLiquida', r.margemLiquida ?? r.indicadores?.margemLiquida, 'indicadores'],
    ['margemEbitda', r.margemEbitda ?? r.indicadores?.margemEbitda, 'indicadores'],
    ['payout', r.payout ?? r.indicadores?.payout, 'indicadores'],
    ['valorPatrimonialCota', r.valorPatrimonial?.valorPatrimonialCota ?? r.valorPatrimonial?.valorPatrimonial ?? r.valorPatrimonial, 'patrimonio'],
    ['patrimonioLiquido', r.valorPatrimonial?.patrimonioLiquido ?? r.informacoesEmpresa?.patrimonioLiquido ?? r.patrimonioLiquido, 'patrimonio'],
    ['valorDeMercado', r.informacoesEmpresa?.valorDeMercado ?? r.valorDeMercado, 'empresa'],
    ['liquidezMediaDiaria', r.informacoesEmpresa?.liquidezMediaDiaria ?? r.liquidezMediaDiaria ?? r.liquidezDiaria, 'liquidez'],
    ['vacanciaFisica', r.informacoesFundo?.vacanciaFisica ?? r.indicadores?.vacanciaFisica, 'fii'],
    ['yield1m', r.indicadores?.yield1m ?? r.distribuicoes12m?.yield1m, 'fii'],
    ['yield3m', r.indicadores?.yield3m ?? r.distribuicoes12m?.yield3m, 'fii'],
    ['yield6m', r.indicadores?.yield6m ?? r.distribuicoes12m?.yield6m, 'fii'],
    ['yield12m', r.indicadores?.yield12m ?? r.distribuicoes12m?.yield12m, 'fii'],
    ['valorDeFirma', r.informacoesEmpresa?.valorDeFirma ?? r.valorDeFirma, 'empresa'],
    ['ativosTotais', r.informacoesEmpresa?.ativosTotais ?? r.ativosTotais, 'empresa'],
    ['ativoCirculante', r.informacoesEmpresa?.ativoCirculante ?? r.ativoCirculante, 'empresa'],
    ['dividaBruta', r.informacoesEmpresa?.dividaBruta ?? r.dividaBruta, 'empresa'],
    ['dividaLiquida', r.informacoesEmpresa?.dividaLiquida ?? r.dividaLiquida, 'empresa'],
    ['disponibilidade', r.informacoesEmpresa?.disponibilidade ?? r.disponibilidade, 'empresa'],
    ['numeroCotistas', r.informacoesFundo?.numeroCotistas ?? r.numeroCotistas, 'fii'],
    ['cotasEmitidas', r.informacoesFundo?.cotasEmitidas ?? r.cotasEmitidas, 'fii'],
    ['taxaAdministracao', r.informacoesFundo?.taxaAdministracao ?? r.taxaAdministracao, 'fii'],
    ['segmentoFii', r.informacoesFundo?.segmentoFii ?? r.segmentoFii, 'fii'],
    ['tipoFundo', r.informacoesFundo?.tipoFundo ?? r.tipoFundo, 'fii'],
    ['tipoGestao', r.informacoesFundo?.tipoGestao ?? r.tipoGestao, 'fii'],
    ['mandato', r.informacoesFundo?.mandato ?? r.mandato, 'fii'],
    ['publicoAlvo', r.informacoesFundo?.publicoAlvo ?? r.publicoAlvo, 'fii'],
    ['valorPatrimonialTotal', r.valorPatrimonial?.valorPatrimonialTotal ?? r.valorPatrimonialTotal, 'fii'],
  ];
  for (const [key, value, source] of candidates) if (!out[key]) setIf(out, key, value, `valorae:${source}`, 0.92);
  setAliasFallbacks(out, payload);
  out._meta = { version: UNIVERSAL_NORMALIZER_VERSION, count: Object.keys(out).filter(k => k !== '_meta').length, contract: 'display/value/unit/source/confidence', aliasFallbacks: true };
  return out;
}

export function normalizeDividendHistory(dividendos = {}) {
  const historico = Array.isArray(dividendos.historico) ? dividendos.historico : [];
  const valores = historico.map(d => Number(d.valor ?? parsePtNumber(d.valor))).filter(Number.isFinite);
  const soma = valores.reduce((s, v) => s + v, 0);
  return {
    version: UNIVERSAL_NORMALIZER_VERSION,
    count: historico.length,
    total: round(soma, 8),
    media: valores.length ? round(soma / valores.length, 8) : undefined,
    maior: valores.length ? Math.max(...valores) : undefined,
    menor: valores.length ? Math.min(...valores) : undefined,
    primeiro: historico.at(-1)?.dataCom || historico.at(-1)?.date,
    ultimo: historico[0]?.dataCom || historico[0]?.date,
  };
}
