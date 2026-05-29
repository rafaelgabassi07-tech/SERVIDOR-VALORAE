const fs = require('fs');

function update(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Reduce header height
  content = content.replace(/--top: 86px;/g, '--top: 60px;');

  // 2. Adjust .top padding and gap
  content = content.replace(
    /\.top\{position:sticky;top:0;z-index:40;height:var\(--top\);display:flex;align-items:center;gap:24px;padding:0 32px;background:rgba\(9,13,11,\.84\);border-bottom:1px solid var\(--line\);backdrop-filter:blur\(18px\)\}/g,
    '.top{position:sticky;top:0;z-index:40;height:var(--top);display:flex;align-items:center;gap:12px;padding:0 16px;background:rgba(9,13,11,.84);border-bottom:1px solid var(--line);backdrop-filter:blur(18px)}'
  );

  // 3. Make hamburger slightly smaller
  content = content.replace(
    /\.hamburger\{width:48px;height:48px;border:1px solid var\(--line\);border-radius:18px;background:var\(--surface2\);color:var\(--text\);display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;transition:all 0\.25s cubic-bezier\(0\.16, 1, 0\.3, 1\)\}/g,
    '.hamburger{width:38px;height:38px;border:1px solid var(--line);border-radius:10px;background:var(--surface2);color:var(--text);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;transition:all 0.25s cubic-bezier(0.16, 1, 0.3, 1)}'
  );

  // 4. Reduce .btn padding and ensure single-line
  content = content.replace(
    /\.btn\{border:1px solid var\(--line\);background:var\(--surface2\);color:var\(--text\);padding:14px 24px;border-radius:16px;cursor:pointer;font-weight:760;font-size:15px;display:inline-flex;align-items:center;justify-content:center;transition:all 0\.25s cubic-bezier\(0\.16,1,0\.3,1\)\}/g,
    '.btn{border:1px solid var(--line);background:var(--surface2);color:var(--text);padding:8px 14px;border-radius:10px;cursor:pointer;font-weight:600;font-size:13px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.25s cubic-bezier(0.16,1,0.3,1);white-space:nowrap}'
  );

  // 5. Fix mobile specific overrides that might be messing up .btn padding
  content = content.replace(
    /\.btn\{padding:10px 14px\}/g,
    '.btn{padding:8px 12px;font-size:12px}'
  );
  
  // 3.5 Also replace previous variant if .top was missed
  content = content.replace(/gap:24px;padding:0 32px;/g, 'gap:12px;padding:0 16px;');

  fs.writeFileSync(filePath, content, 'utf8');
}

update('public/index.html');
update('public/server.html');
console.log('Fixed header and buttons padding');
