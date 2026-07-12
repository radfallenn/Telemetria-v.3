const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');

const nav = `<nav class="nav" id="mainNav" aria-label="Navegação principal">
  <a href="#dash" data-page="dash">DASH</a>
  <a href="#attributes" data-page="attributes">ATRIB</a>
  <a href="#lapsPage" data-page="lapsPage">VOLTAS</a>
  <a href="#sessions" data-page="sessions">SEÇÃO</a>
  <a href="#telemetry" data-page="telemetry">TELEMETRIA</a>
  <a href="#settings" data-page="settings">SET</a>
</nav>`;

html = html.replace(/<nav\s+class=["']nav["'][\s\S]*?<\/nav>/i, nav);

const cssMarker = '/* HARD_NAV_V4 */';
if (!html.includes(cssMarker)) {
  const css = `
${cssMarker}
.nav{z-index:2147483647!important;pointer-events:auto!important;touch-action:manipulation!important;isolation:isolate!important}
.nav a{display:flex!important;align-items:center!important;justify-content:center!important;min-width:0!important;min-height:62px!important;padding:14px 2px calc(12px + env(safe-area-inset-bottom))!important;text-decoration:none!important;color:#a6acad!important;background:#010506!important;border:0!important;font-family:Georgia,serif!important;font-size:12px!important;font-weight:800!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:rgba(0,217,242,.2)!important;user-select:none!important}
.nav a.on{color:var(--cyan)!important;background:#062428!important;border:1px solid #0c5f68!important;border-bottom:0!important}
.page{display:none!important;pointer-events:none!important}
.page.nav-active{display:block!important;pointer-events:auto!important}
.sheet:not(.on){display:none!important;visibility:hidden!important;pointer-events:none!important}
.sheet.on{visibility:visible!important;pointer-events:auto!important}
`;
  html = html.replace('</style>', css + '\n</style>');
}

const jsMarker = 'HARD_NAV_CONTROLLER_V4';
if (!html.includes(jsMarker)) {
  const js = `
<script id="${jsMarker}">
(function(){
  'use strict';
  var valid=['dash','attributes','lapsPage','sessions','telemetry','settings'];
  function activate(id, updateHash){
    if(valid.indexOf(id)===-1) id='dash';
    document.querySelectorAll('.page').forEach(function(page){
      var active=page.id===id;
      page.classList.toggle('nav-active',active);
      page.classList.toggle('on',active);
      page.style.display=active?'block':'none';
      page.style.pointerEvents=active?'auto':'none';
      page.setAttribute('aria-hidden',active?'false':'true');
    });
    document.querySelectorAll('#mainNav [data-page]').forEach(function(link){
      var active=link.getAttribute('data-page')===id;
      link.classList.toggle('on',active);
      link.setAttribute('aria-current',active?'page':'false');
    });
    document.querySelectorAll('.sheet').forEach(function(sheet){
      if(!sheet.classList.contains('on')){
        sheet.style.display='none';
        sheet.style.pointerEvents='none';
      }
    });
    if(updateHash && location.hash!=='#'+id){
      try{history.replaceState(null,'','#'+id)}catch(e){location.hash=id}
    }
    window.scrollTo(0,0);
    if(id==='sessions' && typeof window.loadSessions==='function'){
      try{window.loadSessions()}catch(e){}
    }
  }
  function targetFromHash(){return (location.hash||'#dash').slice(1)}
  function bind(){
    var nav=document.getElementById('mainNav');
    if(!nav)return;
    nav.querySelectorAll('[data-page]').forEach(function(link){
      var open=function(ev){
        if(ev){ev.preventDefault();ev.stopPropagation();}
        activate(link.getAttribute('data-page'),true);
      };
      link.onclick=open;
      link.addEventListener('pointerup',open,{passive:false});
      link.addEventListener('touchend',open,{passive:false});
    });
    activate(targetFromHash(),false);
  }
  window.hardNavigateV4=activate;
  window.addEventListener('hashchange',function(){activate(targetFromHash(),false)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  setTimeout(bind,300);
  setTimeout(bind,1200);
})();
</script>`;
  html = html.replace('</body>', js + '\n</body>');
}

fs.writeFileSync(file, html);
console.log('HARD NAV V4 aplicado com links reais e script independente.');
