import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import { attachProxyMetricsInterceptor, getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

function response() {
  const headers = new Map([['content-type', 'application/json; charset=utf-8']]);
  return { statusCode: 200, writableEnded: false, setHeader(name,value){headers.set(String(name).toLowerCase(),String(value));}, getHeader(name){return headers.get(String(name).toLowerCase());}, write(){return true;}, end(){this.writableEnded=true;return this;} };
}
function capture({ route, latencyMs=50, sourceStatus='ok', cacheStatus='miss', payload={ok:true}, status=200 }) {
  const req={method:'GET',url:route,headers:{}}; const res=response(); res.statusCode=status;
  res.setHeader('X-Valorae-Source-Status',sourceStatus); res.setHeader('X-Valorae-Cache',cacheStatus);
  attachProxyMetricsInterceptor(req,res); req.__valoraeMetrics.startedAt=performance.now()-latencyMs; res.end(JSON.stringify(payload));
  return getServerMetricsSnapshot();
}

resetServerMetricsForTests();
let snapshot=capture({route:'/api/v1/slow-single',latencyMs:9756});
assert.equal(snapshot.summary.measuredLatencySamples,1);
assert.equal(snapshot.summary.latencyConfidence,'low');
assert.equal(snapshot.summary.latencyAlertEligible,false);
assert.equal(snapshot.summary.dataQualityScore,100);
assert.ok(snapshot.insights.some(item=>item.title==='Pico de latência com baixa confiança'));
assert.ok(!snapshot.insights.some(item=>item.title==='Latência p95 elevada'));

resetServerMetricsForTests();
capture({route:'/api/v1/recovered-partial',sourceStatus:'partial_timeout_fallback',cacheStatus:'stale-hit',payload:{partial:true,appResponseIntegrity:{renderSafe:true,cacheSafe:true}}});
snapshot=capture({route:'/api/v1/critical-partial',sourceStatus:'partial',payload:{partial:true,appResponseIntegrity:{renderSafe:false,cacheSafe:false}}});
assert.equal(snapshot.summary.partialResponses,2);
assert.equal(snapshot.summary.partialRecovered,1);
assert.equal(snapshot.summary.partialCritical,0);
assert.equal(snapshot.summary.partialDegraded,1);
assert.equal(snapshot.proxyOutputMonitor.outputFeed.find(e=>e.route==='/api/v1/recovered-partial').partial.classification,'recovered');
assert.equal(snapshot.proxyOutputMonitor.outputFeed.find(e=>e.route==='/api/v1/critical-partial').partial.classification,'degraded');

resetServerMetricsForTests();
snapshot=getServerMetricsSnapshot({
  persistedEvents:[{eventKey:'legacy:1',at:'2026-07-18T12:00:00.000Z',route:'/api/v1/legacy',method:'GET',status:200,latencyMs:3000}],
  persistedTotal:1,
  persistence:{operational:true,active:true,enabled:true,cachedTotal:1},
});
assert.equal(snapshot.serverless.mode,'memory-observability');
assert.equal(snapshot.serverless.persistent,false);
assert.equal(snapshot.summary.persistentEventsStored,0);
assert.equal(snapshot.summary.historyPersistenceActive,false);
assert.equal(snapshot.monitorPersistence.operational,false);
assert.equal(snapshot.monitorAnalytics.eventCount,0, 'histórico remoto legado deve ser ignorado');
assert.match(snapshot.serverless.note,/não há polling, cron ou persistência de telemetria no Supabase/i);

const frontend=fs.readFileSync(new URL('../public/monitor-valorae.js',import.meta.url),'utf8');
assert.match(frontend,/Consulta estritamente sob demanda/);
assert.match(frontend,/nenhuma telemetria gravada no Supabase/);
assert.match(frontend,/Heap \/ limite V8/);

console.log('proxy-monitor-diagnostics-resilience-v364 ok');
