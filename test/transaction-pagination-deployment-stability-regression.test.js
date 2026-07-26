import assert from 'node:assert/strict';
import fs from 'node:fs';
const route=fs.readFileSync(new URL('../routes/sync.js',import.meta.url),'utf8');
const sql=fs.readFileSync(new URL('../supabase/013_valorae_minimal_financial_sync_v2.sql',import.meta.url),'utf8');
assert.match(route,/DOWNLOAD_RPC = 'valorae_financial_download_v2'/);
assert.doesNotMatch(route,/CURSOR_SECRET|HMAC|encodeCursor|decodeCursor|next_cursor|next_offset/);
assert.match(sql,/jsonb_agg\(jsonb_build_object\([\s\S]*from public\.valorae_financial_transactions/i);
assert.match(sql,/where t\.user_id = p_user_id/);
console.log('transaction restore is deployment-stable without cursor OK');
