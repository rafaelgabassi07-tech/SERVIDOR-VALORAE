import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import syncHandler from '../routes/sync.js';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/monitor-valorae.css'), 'utf8');
const logo = fs.readFileSync(path.join(root, 'public/assets/valorae-logo.svg'), 'utf8');

assert.match(html, /class="back-link"[\s\S]*?<svg[\s\S]*?<span>Voltar ao tráfego<\/span>/);
assert.match(css, /\.back-link\{[^}]*min-height:44px/);
assert.match(css, /\.icon-button\{[^}]*width:var\(--control-height\)[^}]*height:var\(--control-height\)/);
assert.match(css, /--control-height:44px/);
assert.match(css, /@media\(max-width:620px\)\{[\s\S]*?--control-height:44px/);
assert.match(css, /button:disabled/);
assert.doesNotMatch(css.trim(), /x\)\}\}$/);
assert.match(logo, /Monograma VP do V-Proxy/);

function pngDimensions(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}
for (const [name, size] of [['valorae-favicon-48.png',48],['valorae-icon-192.png',192],['valorae-icon-512.png',512],['valorae-icon-1024.png',1024]]) {
  assert.deepEqual(pngDimensions(path.join(root,'public/assets',name)), [size,size]);
}

class MockRes {
  constructor(){this.headers={};this.statusCode=200;this.body='';this.finished=false;}
  setHeader(k,v){this.headers[String(k).toLowerCase()]=v;return this;}
  getHeader(k){return this.headers[String(k).toLowerCase()];}
  removeHeader(k){delete this.headers[String(k).toLowerCase()];}
  status(c){this.statusCode=c;return this;}
  send(v){this.body=v;this.finished=true;return this;}
  end(v=''){this.body=v;this.finished=true;return this;}
}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,headers:{get:()=>null},text:async()=>JSON.stringify(body)});
const old={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,anon:process.env.SUPABASE_ANON_KEY,fetch:globalThis.fetch};
try {
  process.env.SUPABASE_URL='https://audit.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='service';
  process.env.SUPABASE_ANON_KEY='anon';
  let rpcBody=null;
  globalThis.fetch=async(url,init={})=>{
    const href=String(url);
    if(href.includes('/auth/v1/user')) return response({id:'11111111-1111-4111-8111-111111111111',email:'a@b.c'});
    if(href.includes('/rpc/valorae_financial_upload_transactions_v2')) {rpcBody=JSON.parse(init.body);return response({ok:true,contract:'valorae-financial-sync-v2',count:1,deleted:0});}
    throw new Error(`unexpected ${href}`);
  };
  const req={method:'POST',url:'/api/sync',query:{},body:{action:'upload_transactions',transactions:[
    {clientTxId:'dup',date:'2026-07-26',operation:'COMPRA',symbol:'PETR4',quantity:1,price:10,grossValue:10},
    {clientTxId:'dup',date:'2026-07-26',operation:'COMPRA',symbol:'PETR4',quantity:2,price:10,grossValue:20},
  ]},headers:{host:'x','content-type':'application/json',authorization:'Bearer ok','x-valorae-sync-contract':'valorae-financial-sync-v2'},socket:{remoteAddress:'127.0.0.1'}};
  const res=new MockRes(); await syncHandler(req,res);
  assert.equal(res.statusCode,200,res.body);
  assert.equal(rpcBody.p_rows.length,2);
  assert.notEqual(rpcBody.p_rows[0].clientTxId,rpcBody.p_rows[1].clientTxId);
  assert.deepEqual(rpcBody.p_rows.map(row=>row.quantity).sort((a,b)=>a-b),[1,2]);

  const badReq={...req,headers:{...req.headers,'x-valorae-sync-contract':'legacy-v1'}};
  const badRes=new MockRes(); await syncHandler(badReq,badRes);
  assert.equal(badRes.statusCode,409);
  assert.equal(JSON.parse(badRes.body).code,'SYNC_CONTRACT_MISMATCH');

  const missingContractReq={...req,headers:{...req.headers}};
  delete missingContractReq.headers['x-valorae-sync-contract'];
  const missingContractRes=new MockRes(); await syncHandler(missingContractReq,missingContractRes);
  assert.equal(missingContractRes.statusCode,428);
  assert.equal(JSON.parse(missingContractRes.body).code,'SYNC_CONTRACT_REQUIRED');

  globalThis.fetch=async(url)=>{
    const href=String(url);
    if(href.includes('/auth/v1/user')) return response({id:'22222222-2222-4222-8222-222222222222'});
    if(href.includes('/rpc/valorae_financial_download_v2')) return response({ok:true,contract:'valorae-financial-sync-v2',transactions:[],dividends:[],transactions_count:1,dividends_count:0});
    throw new Error(`unexpected ${href}`);
  };
  const countReq={...req,body:{action:'download_financial_data'},headers:{...req.headers,authorization:'Bearer another'}};
  const countRes=new MockRes(); await syncHandler(countReq,countRes);
  assert.equal(countRes.statusCode,502);
  assert.equal(JSON.parse(countRes.body).code,'MINIMAL_SYNC_COUNT_MISMATCH');
} finally {
  if(old.url===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=old.url;
  if(old.key===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=old.key;
  if(old.anon===undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY=old.anon;
  globalThis.fetch=old.fetch;
}
console.log('monitor brand and sync audit v367 OK');
