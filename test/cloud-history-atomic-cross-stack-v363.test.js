import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readSiblingApkFile } from './helpers/cross-stack-apk.js';
import { readMinimalFinancialSql } from './helpers/minimal-financial-sql.js';

const route = fs.readFileSync(new URL('../routes/sync.js', import.meta.url), 'utf8');
const sql = readMinimalFinancialSql();
const apk = readSiblingApkFile('app/src/main/java/com/example/data/sync/ValoraeSyncClient.kt');
assert.match(route, /valorae-financial-sync-v2/);
assert.match(route, /download_financial_data/);
assert.match(route, /valorae_financial_download_v2/);
assert.doesNotMatch(route, /encodeCursor|decodeCursor|next_cursor|read_fence/);
assert.match(sql, /create or replace function public\.valorae_financial_download_v2\(p_user_id uuid\)/i);
if (apk) {
  assert.match(apk, /downloadFinancialData/);
  assert.match(apk, /put\("action", "download_financial_data"\)/);
  assert.doesNotMatch(apk, /nextCursor|next_offset|restore-v1|history-restore-atomic-v1/);
}
console.log('minimal financial download cross-stack v363 OK');
