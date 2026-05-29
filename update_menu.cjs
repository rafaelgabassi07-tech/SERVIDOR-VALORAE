const fs = require('fs');

function update(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace topActions
  content = content.replace(
    /<div class="topActions"><span id="liveBadge" class="pill">● conectando<\/span><button class="btn" id="apiBaseBtn">API origem<\/button><button class="btn" id="refreshBtn">Atualizar<\/button><button class="btn" id="pauseBtn">Pausar<\/button><\/div>/g,
    '<div class="topActions"><span id="liveBadge" class="pill">● conectando</span><div class="action-dropdown" id="topActionsContainer" style="position:relative"><button class="btn" id="menuToggleBtn"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg> Opções</button><div id="actionMenu" class="menu-popup"><button class="btn" id="apiBaseBtn">API origem</button><button class="btn" id="refreshBtn">Atualizar</button><button class="btn" id="pauseBtn">Pausar</button></div></div></div>'
  );

  // Add styles
  const styles = `
.menu-popup {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 12px;
  background: var(--surface2);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 10px;
  min-width: 170px;
  box-shadow: 0 16px 40px rgba(0,0,0,0.5);
  flex-direction: column;
  gap: 8px;
  z-index: 100;
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.menu-popup.show {
  display: flex;
}
.menu-popup .btn {
  width: 100%;
  justify-content: flex-start;
}
.btn.active-state {
  background: rgba(34,199,124,0.15) !important;
  color: var(--green) !important;
  border-color: rgba(34,199,124,0.4) !important;
}
.btn.paused-state {
  background: rgba(226,179,64,0.15) !important;
  color: var(--warn) !important;
  border-color: rgba(226,179,64,0.4) !important;
}
</style>
`;
  content = content.replace(/<\/style>/g, styles);

  // Add JS logic
  const jsToAdd = `
$('menuToggleBtn').onclick = (e) => {
  e.stopPropagation();
  $('actionMenu').classList.toggle('show');
};
document.addEventListener('click', (e) => {
  if (!$('topActionsContainer').contains(e.target)) {
    $('actionMenu').classList.remove('show');
  }
});
`;

  // We need to find where to append it, for instance right before `$('apiBaseBtn').onclick=`
  content = content.replace(
    /\$\('apiBaseBtn'\)\.onclick/g,
    jsToAdd + "\n$('apiBaseBtn').onclick"
  );

  // Update refreshBtn and pauseBtn JS
  content = content.replace(
    /\$\('refreshBtn'\)\.onclick=\(\)=>refresh\(\{force:true\}\);/g,
    `$('refreshBtn').onclick=()=>{
       $('actionMenu').classList.remove('show');
       $('refreshBtn').classList.add('active-state');
       setTimeout(()=>$('refreshBtn').classList.remove('active-state'), 400);
       refresh({force:true});
    };`
  );

  content = content.replace(
    /\$\('pauseBtn'\)\.onclick=\(\)=>\{state\.paused=!state\.paused;\$\('pauseBtn'\)\.textContent=state\.paused\?'Retomar':'Pausar';refresh\(\{force:true\}\)\};/g,
    `$('pauseBtn').onclick=()=>{
      state.paused=!state.paused;
      $('pauseBtn').textContent=state.paused?'Retomar':'Pausar';
      if(state.paused) {
        $('pauseBtn').classList.add('paused-state');
      } else {
        $('pauseBtn').classList.remove('paused-state');
      }
      refresh({force:true});
    };`
  );

  fs.writeFileSync(filePath, content, 'utf8');
}

update('public/index.html');
update('public/server.html');
console.log('Done dropdown menu integration');
