const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const MARK = 'FINAL NAVIGATION FIX V4';

if (!html.includes(MARK)) {
  const css = `
/* ${MARK} */
.nav{pointer-events:auto!important;z-index:2147483000!important;isolation:isolate!important}
.nav button{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:2!important;min-width:0!important}
.page{pointer-events:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important}
.page.on{pointer-events:auto!important;visibility:visible!important;height:auto!important;overflow:visible!important;display:block!important}
.sheet:not(.on){display:none!important;pointer-events:none!important;visibility:hidden!important}
.sheet.on{pointer-events:auto!important;visibility:visible!important}
`;
  html = html.replace('</style>', css + '\n</style>');

  const js = `
/* ${MARK} JS */
(function(){
  const pageIds = ['dash','attributes','lapsPage','sessions','telemetry','settings'];
  function activatePage(id){
    if(!pageIds.includes(id)) return;
    document.querySelectorAll('.page').forEach(p=>{
      const active = p.id === id;
      p.classList.toggle('on', active);
      p.setAttribute('aria-hidden', active ? 'false' : 'true');
    });
    document.querySelectorAll('.nav button[data-page]').forEach(b=>{
      const active = b.dataset.page === id;
      b.classList.toggle('on', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.sheet').forEach(s=>{
      if(!s.classList.contains('on')){
        s.style.display='none';
        s.style.pointerEvents='none';
      }
    });
    window.scrollTo({top:0,left:0,behavior:'auto'});
    if(id==='sessions' && typeof loadSessions==='function'){
      try{ loadSessions(); }catch(e){ console.error(e); }
    }
  }
  window.showPage = activatePage;
  function bind(){
    const nav = document.querySelector('.nav');
    if(!nav) return;
    nav.style.pointerEvents='auto';
    nav.addEventListener('pointerup', function(e){
      const btn = e.target.closest('button[data-page]');
      if(!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      activatePage(btn.dataset.page);
    }, true);
    nav.addEventListener('click', function(e){
      const btn = e.target.closest('button[data-page]');
      if(!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      activatePage(btn.dataset.page);
    }, true);
    nav.querySelectorAll('button[data-page]').forEach(btn=>{
      btn.type='button';
      btn.onclick=null;
      btn.style.pointerEvents='auto';
    });
    activatePage(document.querySelector('.nav button.on')?.dataset.page || 'dash');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bind, {once:true}); else bind();
  setTimeout(bind, 300);
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(file, html);
console.log('Navegacao inferior V4 corrigida definitivamente.');
