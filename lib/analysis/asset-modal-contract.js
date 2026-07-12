import { classifyTicker, isStockUnitTicker, normalizeTicker } from '../core/tickers.js';
import { buildFiiModalContract } from './fii-modal-contract.js';
import { buildStockModalContract } from './stock-modal-contract.js';

export const ASSET_MODAL_GATEWAY_VERSION = '26.asset-modal.gateway.v2-protocol-harmony';

function normalizeAssetFamilyHint(payload = {}) {
  const raw = [
    payload.assetType,
    payload.assetClass,
    payload.family,
    payload.type,
    payload.kind,
    payload.productType
  ].filter(Boolean).join(' ').toUpperCase();

  if (/FII|FIAGRO|FI[-_\s]?INFRA/.test(raw)) return 'fii';
  if (/A[CÇ][AÃ]O|ACAO|STOCK|UNIT|BDR/.test(raw)) return 'stock';
  return '';
}

export function resolveAssetModalFamily(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query || '');
  const hintFamily = normalizeAssetFamilyHint(payload);
  const classification = classifyTicker(ticker);
  const classifiedFamily = classification === 'FII'
    ? 'fii'
    : ['ACAO', 'ACAO_UNIT'].includes(classification)
      ? 'stock'
      : '';

  const knownStockUnit = isStockUnitTicker(ticker);
  // O tipo explícito enviado pelo APK prevalece para tickers ambíguos terminados em 11.
  // A única exceção é um UNIT conhecido no catálogo, que não pode virar FII por hint obsoleto.
  const family = knownStockUnit
    ? 'stock'
    : hintFamily || classifiedFamily;

  return {
    ticker,
    family,
    hintFamily,
    classification,
    classifiedFamily,
    knownStockUnit,
    conflict: Boolean(hintFamily && classifiedFamily && hintFamily !== classifiedFamily)
  };
}

export async function buildAssetModalContract(payload = {}) {
  const resolution = resolveAssetModalFamily(payload);
  const { ticker, family, classification } = resolution;

  if (!ticker) {
    return {
      ok: false,
      status: 'ERROR',
      endpoint: 'asset/modal',
      gatewayVersion: ASSET_MODAL_GATEWAY_VERSION,
      error: 'Informe ticker ou symbol do ativo.'
    };
  }

  if (!family) {
    return {
      ok: false,
      status: 'UNSUPPORTED',
      endpoint: 'asset/modal',
      gatewayVersion: ASSET_MODAL_GATEWAY_VERSION,
      ticker,
      assetType: classification,
      resolvedFamily: 'unsupported',
      classification: resolution,
      message: `O modal único cobre ações e FIIs; ${ticker} foi classificado como ${classification}.`
    };
  }

  const normalizedPayload = {
    ...payload,
    ticker,
    symbol: ticker,
    q: ticker,
    resolvedFamily: family
  };
  const contract = family === 'fii'
    ? await buildFiiModalContract(normalizedPayload)
    : await buildStockModalContract(normalizedPayload);

  return {
    ...contract,
    gatewayEndpoint: 'asset/modal',
    gatewayVersion: ASSET_MODAL_GATEWAY_VERSION,
    resolvedFamily: family,
    classification: resolution,
    contractCapabilities: {
      ...(contract?.contractCapabilities || {}),
      universalAssetModalRoute: true,
      serverSideFamilyResolution: true
    }
  };
}

export const _test = { normalizeAssetFamilyHint };
