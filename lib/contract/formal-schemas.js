export const VALORAE_JSON_SCHEMA_DIALECT = 'https://json-schema.org/draft/2020-12/schema';

const nonEmptyString = { type: 'string', minLength: 1 };
const objectValue = { type: 'object' };
const arrayValue = { type: 'array' };
const stringOrObject = { anyOf: [nonEmptyString, objectValue] };
const objectOrArray = { anyOf: [objectValue, arrayValue] };

function responseSchema(id, required = [], properties = {}) {
  return {
    $schema: VALORAE_JSON_SCHEMA_DIALECT,
    $id: `https://valorae.local/schemas/response/${id}.schema.json`,
    title: `VALORAE ${id} response`,
    type: 'object',
    required,
    properties,
    additionalProperties: true,
  };
}

function requestSchema(id, properties = {}, required = []) {
  return {
    $schema: VALORAE_JSON_SCHEMA_DIALECT,
    $id: `https://valorae.local/schemas/request/${id}.schema.json`,
    title: `VALORAE ${id} request`,
    type: 'object',
    required,
    properties,
    additionalProperties: true,
  };
}

const ticker = { type: 'string', minLength: 4, maxLength: 16, pattern: '^[A-Za-z0-9.^_-]+$' };
const status = nonEmptyString;

export const VALORAE_RESPONSE_SCHEMAS = Object.freeze({
  analysis: responseSchema('analysis', ['endpoint', 'contract', 'ticker', 'sections', 'summary'], {
    endpoint: nonEmptyString,
    contract: stringOrObject,
    ticker,
    sections: arrayValue,
    summary: objectValue,
    sourceCoverage: objectOrArray,
    missingSignals: arrayValue,
  }),
  asset: responseSchema('asset', ['ticker', 'status', 'results'], {
    ticker,
    status,
    results: objectValue,
    normalized: objectValue,
  }),
  assetModal: responseSchema('asset-modal', ['contract', 'ticker', 'status'], {
    contract: stringOrObject,
    ticker,
    status,
    header: objectValue,
    sections: { anyOf: [objectValue, arrayValue] },
  }),
  stockModal: responseSchema('stock-modal', ['contract', 'ticker', 'status'], {
    contract: stringOrObject,
    ticker,
    status,
    header: objectValue,
    summary: objectValue,
    fundamentalIndicators: { anyOf: [objectValue, arrayValue] },
  }),
  fiiModal: responseSchema('fii-modal', ['contract', 'ticker', 'status'], {
    contract: stringOrObject,
    ticker,
    status,
    header: objectValue,
    summary: objectValue,
    metrics: { anyOf: [objectValue, arrayValue] },
  }),
  portfolioReturns: responseSchema('portfolio-returns', ['status', 'contractVersion', 'summary', 'series', 'monthlyTable', 'highlights'], {
    status,
    contractVersion: nonEmptyString,
    summary: objectValue,
    series: arrayValue,
    chartSeries: arrayValue,
    monthlyTable: arrayValue,
    highlights: arrayValue,
    benchmarks: arrayValue,
  }),
  portfolioHistory: responseSchema('portfolio-history', ['ok', 'version', 'series'], {
    ok: { type: 'boolean' },
    version: nonEmptyString,
    series: arrayValue,
    summary: objectValue,
    coverage: objectValue,
  }),
  mobileSync: responseSchema('mobile-sync', ['status'], {
    status,
    portfolio: objectValue,
    analysis: objectValue,
    history: { anyOf: [objectValue, arrayValue] },
    dividends: { anyOf: [objectValue, arrayValue] },
    rankings: { anyOf: [objectValue, arrayValue] },
  }),
});

export const VALORAE_REQUEST_SCHEMAS = Object.freeze({
  analysis: requestSchema('analysis', {
    ticker,
    symbol: ticker,
    q: ticker,
    query: ticker,
    mode: { type: 'string' },
    surface: { type: 'string' },
  }),
  asset: requestSchema('asset', {
    ticker,
    symbol: ticker,
    q: ticker,
    query: ticker,
    mode: { type: 'string' },
  }),
  assetModal: requestSchema('asset-modal', {
    ticker,
    symbol: ticker,
    stage: { type: 'string' },
    mode: { type: 'string' },
  }),
  stockModal: requestSchema('stock-modal', {
    ticker,
    symbol: ticker,
    stage: { type: 'string' },
  }),
  fiiModal: requestSchema('fii-modal', {
    ticker,
    symbol: ticker,
    stage: { type: 'string' },
  }),
  portfolioReturns: requestSchema('portfolio-returns', {
    range: { type: 'string' },
    period: { type: 'string' },
    assetFilter: { type: 'string' },
    positions: arrayValue,
    transactions: arrayValue,
    dividendEvents: arrayValue,
    benchmarks: { type: 'array', items: { type: 'string' } },
  }),
  portfolioHistory: requestSchema('portfolio-history', {
    range: { type: 'string' },
    period: { type: 'string' },
    interval: { type: 'string' },
    positions: arrayValue,
    transactions: arrayValue,
    tickers: { anyOf: [{ type: 'string' }, arrayValue] },
  }),
  mobileSync: requestSchema('mobile-sync', {
    positions: arrayValue,
    transactions: arrayValue,
    dividendEvents: arrayValue,
    tickers: { anyOf: [{ type: 'string' }, arrayValue] },
    userId: { type: 'string' },
    deviceId: { type: 'string' },
  }),
});

export function formalSchemaCatalog() {
  return {
    draft: '2020-12',
    dialect: VALORAE_JSON_SCHEMA_DIALECT,
    response: Object.fromEntries(Object.entries(VALORAE_RESPONSE_SCHEMAS).map(([id, schema]) => [id, {
      id: schema.$id,
      title: schema.title,
      required: schema.required || [],
    }])),
    request: Object.fromEntries(Object.entries(VALORAE_REQUEST_SCHEMAS).map(([id, schema]) => [id, {
      id: schema.$id,
      title: schema.title,
      required: schema.required || [],
    }])),
  };
}
