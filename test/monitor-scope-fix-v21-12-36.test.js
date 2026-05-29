import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['public/server.html', 'public/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /window\.valoraeMonitorState\s*=\s*state/, `${file}: monitor state bridge missing`);
  assert.match(html, /window\.valoraeMonitorApplyFilters\s*=\s*applyFilters/, `${file}: applyFilters bridge missing`);
  assert.match(html, /function updateFilterOptions\(\) \{\s*const state = window\.valoraeMonitorState;/, `${file}: updateFilterOptions must use bridge state`);
  assert.doesNotMatch(html, /\n\s*if \(!state\.feed\) return;/, `${file}: updateFilterOptions still reads lexical state outside monitor closure`);
  assert.match(html, /if \(window\.valoraeMonitorApplyFilters\) window\.valoraeMonitorApplyFilters\(\);/, `${file}: custom select must call bridged applyFilters`);
}

console.log('monitor-scope-fix-v21-12-36 ok');
