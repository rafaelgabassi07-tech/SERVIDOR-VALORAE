import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveClientAuth } from '../lib/security/client-auth.js';

const invalid = { headers: {} };
assert.equal(resolveClientAuth(invalid, { requireClientAuth: true }).ok, false);
const source = fs.readFileSync(new URL('../lib/http/route.js', import.meta.url), 'utf8');
assert.match(source, /resolveClientAuth\(req, options\)/,
  'beginRoute deve propagar requireClientAuth para a resolução de identidade');
assert.doesNotMatch(source, /const clientAuth = resolveClientAuth\(req\);/);
console.log('route client auth options v426: OK');
