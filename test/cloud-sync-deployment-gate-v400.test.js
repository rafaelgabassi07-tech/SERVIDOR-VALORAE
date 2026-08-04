import assert from 'node:assert/strict';
import fs from 'node:fs';
import pkg from '../package.json' with { type: 'json' };
import { verifyCloudSyncDeployment } from '../scripts/verify-cloud-sync-deployment.js';

assert.equal(pkg.scripts['verify:cloud-sync'], 'node scripts/verify-cloud-sync-deployment.js');
const source = fs.readFileSync(new URL('../scripts/verify-cloud-sync-deployment.js', import.meta.url), 'utf8');
for (const marker of [
  'valorae_financial_transactions',
  'valorae_financial_dividends',
  'valorae_financial_status_v2',
  'SUPABASE_SERVICE_ROLE_KEY',
]) assert.ok(source.includes(marker), marker);
await assert.rejects(() => verifyCloudSyncDeployment({}), /SUPABASE_URL/);
console.log('cloud sync deployment gate v400 OK');
