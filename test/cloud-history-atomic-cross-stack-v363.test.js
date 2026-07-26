import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';

const syncRoute = fs.readFileSync(new URL('../routes/sync.js', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/012_valorae_atomic_history_restore_v363.sql', import.meta.url), 'utf8');
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
const apkClient = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
const apkViewModel = readSiblingApkFile('app/src/main/java/com/example/ui/PortfolioViewModel.kt');
const apkMetadataText = readSiblingApkFile('metadata.json');

assert.ok(syncRoute.includes("'restore_transactions'"));
assert.ok(syncRoute.includes("restoreContract: 'history-restore-atomic-v1'"));
assert.ok(syncRoute.includes("fetchTransactionRowsWithIdentityFallback(auth, targetCount, 'valorae_transactions')"));
assert.ok(migration.includes('create or replace function public.valorae_sync_restore_transactions'));
assert.ok(migration.includes('t.user_id::text = p_user_id'));

if (apkClient && apkViewModel && apkMetadataText) {
  const apkMetadata = JSON.parse(apkMetadataText);
  assert.equal(apkMetadata.versionName, metadata.apkVersion);
  assert.ok(apkClient.includes('.put("action", "restore_transactions")'));
  assert.ok(apkClient.includes('history-restore-atomic-v1'));
  assert.ok(apkClient.includes('SYNC_TRANSACTION_PAYLOAD_UNREADABLE'));
  assert.ok(apkViewModel.includes('cloud.totalCount > 0 && remoteTransactions.isEmpty()'));
  assert.ok(apkViewModel.includes('!cloud.verifiedEmpty && syncState.revision > 0L'));
}

console.log('cloud history atomic cross-stack v363 OK');
