const fs = require('fs');

function update(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Let's refine and apply the precise rules.

  // 1. Spacing and CSS variable fixes
  content = content.replace(/--top: 76px;/g, '--top: 86px;');

  // 2. Head and Hamburger
  content = content.replace(
    /\.top\{[^\}]+\}/g,
    '.top{position:sticky;top:0;z-index:40;height:var(--top);display:flex;align-items:center;gap:24px;padding:0 32px;background:rgba(9,13,11,.84);border-bottom:1px solid var(--line);backdrop-filter:blur(18px)}'
  );
  content = content.replace(
    /\.hamburger\{[^\}]+\}/g,
    '.hamburger{width:48px;height:48px;border:1px solid var(--line);border-radius:18px;background:var(--surface2);color:var(--text);display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;transition:all 0.25s cubic-bezier(0.16, 1, 0.3, 1)}.hamburger:hover{background:var(--surface3);transform:scale(1.05)}'
  );

  // 3. Buttons
  content = content.replace(
    /\.btn\{[^\}]+\}\.btn:hover\{[^\}]+\}/g,
    '.btn{border:1px solid var(--line);background:var(--surface2);color:var(--text);padding:14px 24px;border-radius:16px;cursor:pointer;font-weight:760;font-size:15px;display:inline-flex;align-items:center;justify-content:center;transition:all 0.25s cubic-bezier(0.16,1,0.3,1)}.btn:hover{border-color:rgba(34,199,124,.65);transform:translateY(-2px);box-shadow:0 8px 16px rgba(0,0,0,0.3)}.btn:active{transform:translateY(0)}'
  );
  content = content.replace(
    /\.btn\.primary\{[^\}]+\}/g,
    '.btn.primary{background:linear-gradient(135deg,var(--green2),var(--green));color:#04100a;border:0;box-shadow:0 8px 24px rgba(34,199,124,0.3)}'
  );

  // 4. Input & Select Native Style
  // Remove background SVG first to ensure clean state
  content = content.replace(/select\{background-image:[^\}]+\}/g, '');
  content = content.replace(
    /\.input,select\{[^\}]+\}\.input:focus,select:focus\{[^\}]+\}/g,
    '.input,select{background:rgba(255,255,255,.05);border:2px solid var(--line);color:var(--text);border-radius:16px;padding:14px 20px;min-height:52px;font-family:inherit;font-size:15px;transition:all 0.2s cubic-bezier(0.16,1,0.3,1);outline:none;appearance:none;-webkit-appearance:none;width:100%}.input:focus,select:focus{border-color:var(--green);box-shadow:0 0 0 4px rgba(34,199,124,0.15);background:rgba(0,0,0,0.3)}select{padding-right:48px;cursor:pointer;background-image:url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%208l5%205%205-5%22%20stroke%3D%22%23a0aca5%22%20stroke-width%3D%222%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E");background-repeat:no-repeat;background-position:right 18px center;background-size:20px}'
  );

  // 5. Grid gap
  content = content.replace(/\.grid\{display:grid;gap:[^\}]+\}/g, '.grid{display:grid;gap:16px}');

  // 6. Metrics 2x2 spacing and height
  content = content.replace(/\.metric\{[^\}]+\}/g, '.metric{min-height:160px;display:flex;flex-direction:column;justify-content:center}');
  
  // 7. Cards Interaction
  content = content.replace(
    /\.card:hover\{[^\}]+\}/g,
    '.card:hover,.stage:hover{transform:translateY(-8px);box-shadow:0 24px 48px rgba(0,0,0,0.4);border-color:rgba(34,199,124,0.4);z-index:2;position:relative}'
  );

  // 8. Re-apply the chart touch functions exactly.
  const replacementDrawLine = "function drawLine(canvasId,pts,opts={}){const c=$(canvasId);if(!c)return;const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(320,r.width*dpr);c.height=Math.max(180,r.height*dpr);const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height,p=26;if(!c._setup){c._setup=true;const getPos=e=>{const rect=c.getBoundingClientRect();const clientX=e.touches?e.touches[0].clientX:e.clientX;const clientY=e.touches?e.touches[0].clientY:e.clientY;return{x:clientX-rect.left,y:clientY-rect.top};};const onMove=e=>{if(e.cancelable&&e.touches)e.preventDefault();const pos=getPos(e);c._mx=pos.x;c._my=pos.y;c._hover=true;if(c._draw)c._draw()};const onLeave=()=>{c._hover=false;if(c._draw)c._draw()};c.addEventListener('mousemove',onMove);c.addEventListener('touchmove',onMove,{passive:false});c.addEventListener('touchstart',onMove,{passive:false});c.addEventListener('mouseleave',onLeave);c.addEventListener('touchend',onLeave);}c._draw=()=>{ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=p+(h-2*p)*i/3;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}const max=Math.max(1,...pts.map(x=>x.y));ctx.strokeStyle=opts.color||'#22c77c';ctx.lineWidth=2.4;ctx.beginPath();pts.forEach((pt,i)=>{const x=p+(w-2*p)*(pts.length<=1?0:i/(pts.length-1)),y=h-p-(h-2*p)*(pt.y/max);pt._x=x;pt._y=y;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle='rgba(34,199,124,.12)';ctx.lineTo(w-p,h-p);ctx.lineTo(p,h-p);ctx.closePath();ctx.fill();ctx.fillStyle='#a0aca5';ctx.font='12px system-ui';ctx.fillText(opts.label||'',p,16);if(c._hover){let closest=null,minDist=Infinity;pts.forEach(pt=>{const dx=pt._x-c._mx,dy=pt._y-c._my,dist=dx*dx+dy*dy;if(dist<minDist){minDist=dist;closest=pt}});if(closest&&minDist<8000){ctx.beginPath();ctx.moveTo(closest._x,p);ctx.lineTo(closest._x,h-p);ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;ctx.stroke();ctx.beginPath();ctx.arc(closest._x,closest._y,6,0,2*Math.PI);ctx.fillStyle='#22c77c';ctx.shadowColor='rgba(34,199,124,0.6)';ctx.shadowBlur=10;ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.font='600 13px system-ui';ctx.textAlign='center';ctx.fillText(closest.y,closest._x,closest._y-16);ctx.textAlign='left'}}};c._draw()}";
  const replacementDrawBars = "function drawBars(canvasId,items){const c=$(canvasId);if(!c)return;const r=c.getBoundingClientRect(),dpr=devicePixelRatio||1;c.width=Math.max(320,r.width*dpr);c.height=Math.max(180,r.height*dpr);const ctx=c.getContext('2d');ctx.scale(dpr,dpr);const w=r.width,h=r.height,p=26;if(!c._setup){c._setup=true;const getPos=e=>{const rect=c.getBoundingClientRect();const clientX=e.touches?e.touches[0].clientX:e.clientX;const clientY=e.touches?e.touches[0].clientY:e.clientY;return{x:clientX-rect.left,y:clientY-rect.top};};const onMove=e=>{if(e.cancelable&&e.touches)e.preventDefault();const pos=getPos(e);c._mx=pos.x;c._my=pos.y;c._hover=true;if(c._draw)c._draw()};const onLeave=()=>{c._hover=false;if(c._draw)c._draw()};c.addEventListener('mousemove',onMove);c.addEventListener('touchmove',onMove,{passive:false});c.addEventListener('touchstart',onMove,{passive:false});c.addEventListener('mouseleave',onLeave);c.addEventListener('touchend',onLeave);}c._draw=()=>{ctx.clearRect(0,0,w,h);const vals=items.map(x=>x[1]),max=Math.max(1,...vals),bw=(w-2*p)/Math.max(1,items.length);let hovIdx=-1;if(c._hover){items.forEach((_,i)=>{const bx=p+i*bw+4;if(c._mx>=bx&&c._mx<=bx+bw-8)hovIdx=i})}items.forEach(([label,val],i)=>{const x=p+i*bw+4,bh=(h-2*p)*(val/max);ctx.fillStyle=i===hovIdx?'#3be293':(i%2?'#0d8d5b':'#22c77c');if(i===hovIdx){ctx.shadowColor='rgba(34,199,124,0.5)';ctx.shadowBlur=12;}else{ctx.shadowBlur=0;}ctx.fillRect(x,h-p-bh,Math.max(8,bw-8),bh);ctx.shadowBlur=0;ctx.fillStyle=i===hovIdx?'#fff':'#a0aca5';ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(String(label).slice(0,8),x+Math.max(8,bw-8)/2,h-8);if(i===hovIdx){ctx.fillStyle='#fff';ctx.font='600 13px system-ui';ctx.fillText(val,x+Math.max(8,bw-8)/2,h-p-bh-8)}});ctx.fillStyle='#a0aca5';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText('Distribuição de status',p,16)};c._draw()}";

  const drawLinesStart = content.indexOf('function drawLine(');
  const drawAllStart = content.indexOf('function drawAll(');
  
  if (drawLinesStart !== -1 && drawAllStart !== -1) {
     content = content.slice(0, drawLinesStart) + replacementDrawLine + '\n' + replacementDrawBars + '\n' + content.slice(drawAllStart);
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
}

update('public/index.html');
update('public/server.html');
console.log('Done!');
