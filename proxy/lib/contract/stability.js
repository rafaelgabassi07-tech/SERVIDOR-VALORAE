export const SCHEMA_STABILITY_VERSION = '21.12.0';

export const STABLE_ASSET_KEYS = [
  'version','schemaVersion','status','partial','ticker','type','mode','results','normalized','quality','fieldConfidence','valoraeScore','alerts','coverage','sourceReport','metrics','performance','parserResilience','schemaStability'
];

export function buildSchemaStability(payload = {}) {
  const present = STABLE_ASSET_KEYS.filter(k => payload[k] !== undefined);
  const missing = STABLE_ASSET_KEYS.filter(k => payload[k] === undefined);
  return {
    version: SCHEMA_STABILITY_VERSION,
    contract: 'asset-v1-compatible / query-view-compatible',
    stableKeys: STABLE_ASSET_KEYS,
    present,
    missing,
    predictable: missing.length <= 5,
    note: 'Novos campos podem ser adicionados, mas os campos estáveis não devem mudar de significado.',
  };
}
