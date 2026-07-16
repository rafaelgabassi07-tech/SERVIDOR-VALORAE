import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { dispatchRoute, routeManifest } from '../routes/_router.js';
import { _test as stockTest } from '../lib/analysis/stock-modal-contract.js';
import { _test as fiiTest } from '../lib/analysis/fii-modal-contract.js';
import { VALORAE_REQUEST_HEADERS } from '../lib/core/mobile-protocol.js';
import { readSiblingApkFile, resolveSiblingApkRoot } from './helpers/cross-stack-apk.js';

const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const metadata=JSON.parse(fs.readFileSync(new URL('../metadata.json',import.meta.url),'utf8'));
assert.equal(pkg.valorae.publicVersion,'21.12.378');
assert.equal(pkg.valorae.releasePatch,'21.12.378-final-decomposition-v346');
assert.equal(pkg.releasePatch,pkg.valorae.releasePatch);
for(const block of [pkg.config,pkg.releaseMetadata]) assert.deepEqual({releasePatch:block.releasePatch,publicVersion:block.publicVersion,checkpoint:block.checkpoint,releaseLabel:block.releaseLabel},{releasePatch:pkg.valorae.releasePatch,publicVersion:pkg.valorae.publicVersion,checkpoint:pkg.valorae.checkpoint,releaseLabel:pkg.valorae.releaseLabel});
assert.equal(metadata.apkVersion,'2026.07.15.08');
for(const header of ['X-Valorae-Delivery-Schema','X-Valorae-Signature','X-Valorae-Timestamp'])assert.ok(VALORAE_REQUEST_HEADERS.includes(header));
for(const [input,expected] of [['1m','1m'],['3 meses','3m'],['6m','6m'],['1 ano','12m']])assert.equal(fiiTest.distributionPeriodKey(input),expected);
const revenue=stockTest.buildStockRevenueBreakdownPayload({ticker:'AUDT3',canonical:{revenueByRegion:{totalAmountDisplay:'127 mi',rows:[{label:'Brasil',percent:100}]}}},'region');
assert.equal(revenue.totalAmount,127_000_000);assert.match(revenue.totalAmountDisplay,/127\s*mi/i);

const forbidden=/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
for(const directory of ['api','routes','lib','scripts']){const walk=current=>{for(const e of fs.readdirSync(current,{withFileTypes:true})){const f=path.join(current,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.js'))assert.equal(forbidden.test(fs.readFileSync(f,'utf8')),false,`controle em ${f}`);}};walk(path.resolve(directory));}

let seq=1;
function response(){const h=new Map();return{statusCode:200,writableEnded:false,body:'',setHeader(n,v){h.set(String(n).toLowerCase(),String(v));},getHeader(n){return h.get(String(n).toLowerCase());},removeHeader(n){h.delete(String(n).toLowerCase());},end(v=''){this.body=Buffer.isBuffer(v)?v:String(v);this.writableEnded=true;return this;},status(c){this.statusCode=c;return this;},send(v){return this.end(v);}}}
async function invoke(url,{method='GET',headers={},body}={}){const res=response();await dispatchRoute({method,url,headers,body,socket:{remoteAddress:`127.0.1.${seq++}`}},res);return res;}
const json=res=>JSON.parse(Buffer.isBuffer(res.body)?res.body.toString('utf8'):res.body);
const keys=['VALORAE_RATE_LIMIT_DISABLED','VALORAE_CORS_STRICT','VALORAE_CORS_ALLOW_ORIGINS','VALORAE_CLIENT_KEYS','VALORAE_REQUIRE_CLIENT_AUTH','VALORAE_ADMIN_TOKEN','ADMIN_TOKEN','VALORAE_MAX_BODY_BYTES','MAX_LOCAL_BODY_BYTES','VALORAE_DISABLE_EXTERNAL'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
try{
  process.env.VALORAE_RATE_LIMIT_DISABLED='1';
  process.env.VALORAE_CORS_STRICT='1';process.env.VALORAE_CORS_ALLOW_ORIGINS='https://app.valorae.test';
  const cors=await invoke('/api/v1/ready',{headers:{origin:'https://evil.example'}});assert.equal(cors.getHeader('Access-Control-Allow-Origin'),'https://app.valorae.test');assert.ok(cors.getHeader('X-Valorae-Security'));
  delete process.env.VALORAE_CORS_STRICT;delete process.env.VALORAE_CORS_ALLOW_ORIGINS;
  process.env.VALORAE_CLIENT_KEYS='audit-app:audit-key';process.env.VALORAE_REQUIRE_CLIENT_AUTH='1';
  const unauthorized=await invoke('/api/v1/ready');assert.equal(unauthorized.statusCode,401);assert.equal(json(unauthorized).code,'VALORAE_CLIENT_AUTH_REQUIRED');
  assert.equal((await invoke('/api/v1/ready',{headers:{'x-valorae-app-id':'audit-app','x-valorae-client-key':'audit-key'}})).statusCode,200);
  delete process.env.VALORAE_CLIENT_KEYS;delete process.env.VALORAE_REQUIRE_CLIENT_AUTH;
  delete process.env.VALORAE_ADMIN_TOKEN;delete process.env.ADMIN_TOKEN;
  let admin=await invoke('/api/v1/admin/cache',{method:'POST',body:{}});assert.equal(admin.statusCode,503);assert.equal(json(admin).code,'ADMIN_TOKEN_NOT_CONFIGURED');
  process.env.VALORAE_ADMIN_TOKEN='audit-admin-token';assert.equal((await invoke('/api/v1/admin/cache')).statusCode,405);assert.equal((await invoke('/api/v1/admin/cache',{method:'POST',body:{}})).statusCode,401);
  admin=await invoke('/api/v1/admin/cache',{method:'POST',headers:{'x-valorae-admin-token':'audit-admin-token'},body:{}});assert.equal(admin.statusCode,200);assert.equal(json(admin).cleared,true);delete process.env.VALORAE_ADMIN_TOKEN;
  process.env.VALORAE_MAX_BODY_BYTES='1024';const oversized=await invoke('/api/v1/mobile/bootstrap',{method:'POST',body:{payload:'x'.repeat(3000)}});assert.equal(oversized.statusCode,413);assert.equal(json(oversized).code,'PAYLOAD_TOO_LARGE');delete process.env.VALORAE_MAX_BODY_BYTES;
  const calls=[];globalThis.fetch=async url=>{calls.push(String(url));if(String(url).includes('statusinvest.com.br')){const image=Buffer.alloc(512,7);Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(image,0);image.writeUInt32BE(32,16);image.writeUInt32BE(32,20);return new Response(image,{status:200,headers:{'content-type':'image/png'}});}throw new Error(`unexpected ${url}`);};
  const logo=await invoke('/api/v1/asset/logo?ticker=AUDT3&cache=false');assert.equal(logo.statusCode,200);assert.equal(Buffer.isBuffer(logo.body),true);assert.ok(calls.some(u=>u.includes('statusinvest.com.br')));assert.match(logo.getHeader('x-valorae-logo-source')||'',/Status Invest/i);
}finally{globalThis.fetch=originalFetch;for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}

const application=readSiblingApkFile('app/src/main/java/com/example/ValoraeApplication.kt'),feed=readSiblingApkFile('app/src/main/java/com/example/data/proxy/ValoraeProxyPublicFeedService.kt'),manifest=readSiblingApkFile('app/src/main/AndroidManifest.xml'),build=readSiblingApkFile('app/build.gradle.kts');
if([application,feed,manifest,build].every(Boolean)){
  assert.match(application,/ValoraeAppGraph\.installHttpCache\(this\)/);assert.equal((feed.match(/executeJsonGetCancellable\(/g)||[]).length,2);assert.equal(feed.includes('executeJsonGet('),false);assert.match(manifest,/ValoraeNotificationRescheduleReceiver[\s\S]{0,160}android:exported="false"/);assert.match(build,/versionCode = (?:2607140[45]|2607150[1-8])/);
  const endpoints=new Set();const walk=current=>{for(const e of fs.readdirSync(current,{withFileTypes:true})){const f=path.join(current,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.kt'))for(const m of fs.readFileSync(f,'utf8').matchAll(/["'](\/api\/v1\/[A-Za-z0-9_./-]+)(?:\?[^"']*)?["']/g))endpoints.add(m[1].replace(/^\/api\/v1/,'')||'/');}};walk(path.join(resolveSiblingApkRoot(),'app/src/main/java'));
  const routes=new Set(routeManifest().routes),missing=[...endpoints].filter(e=>!routes.has(e));assert.deepEqual(missing,[]);assert.ok(endpoints.size>=30);
}
console.log('monthly-variation-logos-return-indices-v332 ok');
