import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VALORAE_FORMAL_SCHEMA_POLICY, VALORAE_FORMAL_SCHEMA_VERSION } from '../lib/contract/formal-schema-validation.js';

const root = new URL('../', import.meta.url);
const apkRoot = process.env.VALORAE_APK_ROOT;
if (apkRoot) {
  const protocol = fs.readFileSync(`${apkRoot}/app/src/main/java/com/example/data/proxy/ValoraeMobileProtocol.kt`, 'utf8');
  const http = fs.readFileSync(`${apkRoot}/app/src/main/java/com/example/data/proxy/ValoraeProxyHttp.kt`, 'utf8');
  const contract = fs.readFileSync(`${apkRoot}/app/src/main/java/com/example/data/proxy/ValoraeFormalSchema.kt`, 'utf8');
  const catalog = fs.readFileSync(`${apkRoot}/app/src/main/java/com/example/domain/model/ValoraeProxyEndpointCatalog.kt`, 'utf8');
  assert.ok(contract.includes(VALORAE_FORMAL_SCHEMA_VERSION));
  assert.ok(contract.includes(VALORAE_FORMAL_SCHEMA_POLICY));
  assert.ok(protocol.includes('HeaderFormalSchemaAccept'));
  assert.ok(http.includes(VALORAE_FORMAL_SCHEMA_POLICY));
  assert.ok(http.includes('formalSchemaVersion = header(ValoraeMobileProtocol.HeaderFormalSchema)'));
  assert.ok(catalog.includes('/api/v1/contract/formal-schemas'));
}
assert.ok(fs.existsSync(new URL('./test/formal-schema-checkpoint112-v342.test.js', root)));
console.log('cross-stack-formal-schema-v342 ok');
