import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const router = read('routes/_router.js');
const sync = read('routes/sync.js');

// Contratos consumidos pela dupla móvel permanecem presentes e roteados.
for (const marker of [
  "if (path === '/asset/modal')",
  "if (path === '/portfolio/history')",
  "if (path === '/asset/logo' || path === '/asset/yahoo-logo')",
  "if (path === '/news')",
]) {
  assert.match(router, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(router, /buildAssetModalContract\(payload\)/);
assert.match(router, /buildPortfolioHistory\(/);
assert.match(router, /fetchOfficialAssetLogo/);
assert.match(router, /getNews\(payload\)/);

// O atalho B3 do APK continua usando o contrato de transações existente.
assert.match(sync, /upsert_transactions/);
assert.match(sync, /replace_transactions_for_symbols/);
assert.match(sync, /get_transactions/);
assert.match(read('routes/portfolio/transactions.js'), /portfolio-transactions/);

// Nenhum endpoint B3 paralelo foi introduzido no Proxy.
assert.doesNotMatch(router, /\/b3\/import|\/import\/b3/);


console.log('apk-v474-contract-compatibility-v310 ok');
