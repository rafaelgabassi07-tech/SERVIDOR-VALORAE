const fs = require('fs');

const files = ['public/index.html', 'public/server.html'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Chart touch interactions (touchmove, touchstart)
  content = content.replace(
    /c\.addEventListener\('mousemove',/g,
    "c.addEventListener('touchstart', e => { const t = e.touches[0]; const rect = c.getBoundingClientRect(); c._mx = (t.clientX - rect.left); c._my = (t.clientY - rect.top); c._hover = true; if (c._draw) c._draw(); }); c.addEventListener('touchmove', e => { if(e.cancelable) e.preventDefault(); const t = e.touches[0]; const rect = c.getBoundingClientRect(); c._mx = (t.clientX - rect.left); c._my = (t.clientY - rect.top); c._hover = true; if (c._draw) c._draw(); }, {passive: false}); c.addEventListener('mousemove',"
  );
  content = content.replace(
    /c\.addEventListener\('mouseleave',/g,
    "c.addEventListener('touchend', () => { c._hover = false; if (c._draw) c._draw(); }); c.addEventListener('mouseleave',"
  );

  // 2. Global animation
  content = content.replace(
    /@keyframes fade\{from\{opacity:\.72;transform:translateY\(5px\)\}\}/,
    "@keyframes fade{from{opacity:0;transform:translateY(12px)}} @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .card, .stage, .explain, .event, .insight, .hero { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; } " +
    ".card:nth-child(1){animation-delay: 0.05s} .card:nth-child(2){animation-delay: 0.1s} .card:nth-child(3){animation-delay: 0.15s} .card:nth-child(4){animation-delay: 0.2s} " +
    ".event:nth-child(2){animation-delay: 0.05s} .event:nth-child(3){animation-delay: 0.1s} .event:nth-child(4){animation-delay: 0.15s}"
  );

  // 3. Spacing the layout
  content = content.replace(/--top:50px/g, '--top: 64px'); 
  content = content.replace(/--top:52px/g, '--top: 76px'); 
  content = content.replace(/--top:68px/g, '--top: 76px'); 
  content = content.replace(/--top: 68px/g, '--top: 76px');

  // Improve inputs/selects for native feel
  content = content.replace(
    /\.input,select\{background:rgba\(255,255,255,\.05\);border:1px solid var\(--line\);color:var\(--text\);border-radius:12px;padding:10px 14px;min-height:42px;font-family:inherit;font-size:14px;transition:all 0\.2s ease;outline:none\}/g,
    '.input,select{background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--text);border-radius:12px;padding:12px 16px;min-height:46px;font-family:inherit;font-size:15px;transition:all 0.25s cubic-bezier(0.4, 0, 0.2, 1);outline:none;appearance:none;cursor:pointer; -webkit-appearance:none; -moz-appearance:none;}'
  );
  if (!content.includes('select{background-image')) {
    content = content.replace(
      /\.input,select/g,
      "select{background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%23a0aca5%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E');background-repeat:no-repeat;background-position:right 12px center;background-size:16px;padding-right:36px} .input,select"
    );
  }

  // Refine card metrics
  content = content.replace(
    /\.v\{font-size:26px;font-weight:950;margin-top:6px;letter-spacing:-\.035em\}/g,
    '.v{font-size:32px;font-weight:950;margin-top:12px;margin-bottom:4px;letter-spacing:-.04em}'
  );
  content = content.replace(
    /\.card,\.stage\{transition:transform 0\.2s ease,box-shadow 0\.2s ease;border:1px solid var\(--line\);border-radius:18px;background:linear-gradient\(180deg,var\(--surface2\),var\(--surface\)\);padding:14px;/g,
    '.card,.stage{transition:transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),box-shadow 0.3s ease;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,var(--surface2),var(--surface));padding:22px;'
  );

  // General gap
  content = content.replace(/gap:8px;/g, 'gap:12px;');

  // Nav buttons
  content = content.replace(
    /\.nav button\{width:100%;display:flex;align-items:center;gap:10px;text-align:left;margin:4px 0;padding:10px 11px;border:1px solid transparent;border-radius:14px;/g,
    '.nav button{width:100%;display:flex;align-items:center;gap:12px;text-align:left;margin:6px 0;padding:12px 14px;border:1px solid transparent;border-radius:14px;font-size:15px;transition:0.2s;'
  );

  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
}
