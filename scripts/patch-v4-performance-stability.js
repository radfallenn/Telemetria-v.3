const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const MARK = 'V4 PERFORMANCE STABILITY FIX';

if (html.includes(MARK)) {
  console.log('JA OK:', MARK);
  process.exit(0);
}

let changes = 0;

// O patch de referencias reconstruia toda a grade em todos os frames.
html = html.replace(
  /function loop\(\)\{\s*installRenderWrapper\(\);\s*ensureReferences\(\);\s*renderReferences\(\);\s*requestAnimationFrame\(loop\);\s*\}\s*if\(document\.readyState==='loading'\) document\.addEventListener\('DOMContentLoaded',\(\)=>requestAnimationFrame\(loop\)\);\s*else requestAnimationFrame\(loop\);/,
  `function initReferenceUpdates(){
    installRenderWrapper();
    ensureReferences();
    renderReferences();
    if(!window.__v4ReferenceTimer){
      window.__v4ReferenceTimer=setInterval(()=>{
        const panel=document.getElementById('customReferenceList');
        if(panel&&panel.offsetParent!==null) renderReferences();
      },1200);
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initReferenceUpdates,{once:true});
  else setTimeout(initReferenceUpdates,0);`
);
if (html.includes('function initReferenceUpdates()')) changes++;

// O patch final de layout lia storage, percorria o DOM e recalculava CSS em todos os frames.
html = html.replace(
  /function loop\(\)\{\s*installRender\(\);\s*normalizeBuilder\(\);\s*ensureFontControl\(\);\s*rebindHeightControls\(\);\s*applyDashboardControls\(\);\s*requestAnimationFrame\(loop\);\s*\}\s*if\(document\.readyState==='loading'\)document\.addEventListener\('DOMContentLoaded',\(\)=>requestAnimationFrame\(loop\)\);\s*else requestAnimationFrame\(loop\);/,
  `function initUiControls(){
    installRender();
    normalizeBuilder();
    ensureFontControl();
    rebindHeightControls();
    applyDashboardControls();

    if(!window.__v4UiMaintenanceTimer){
      window.__v4UiMaintenanceTimer=setInterval(()=>{
        const designer=document.getElementById('designer');
        const builder=document.querySelector('.customBuilder');
        const needsUpdate=(designer&&designer.classList.contains('on'))||(builder&&builder.classList.contains('on'));
        if(needsUpdate){
          normalizeBuilder();
          ensureFontControl();
          rebindHeightControls();
          applyDashboardControls();
        }
      },1000);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initUiControls,{once:true});
  else setTimeout(initUiControls,0);`
);
if (html.includes('function initUiControls()')) changes++;

// Evita mais de um observer do Designer quando a inicializacao for repetida.
html = html.replace(
  /const observer=new MutationObserver\(\(\)=>\{decorateFields\(\);applyDashboardSizes\(\)\}\);\s*if\(q\('fieldsList'\)\)observer\.observe\(q\('fieldsList'\),\{childList:true,subtree:false\}\);/,
  `if(!window.__v4FieldsObserver&&q('fieldsList')){
      let pending=false;
      window.__v4FieldsObserver=new MutationObserver(()=>{
        if(pending)return;
        pending=true;
        setTimeout(()=>{pending=false;decorateFields();applyDashboardSizes()},80);
      });
      window.__v4FieldsObserver.observe(q('fieldsList'),{childList:true,subtree:false});
    }`
);
if (html.includes('window.__v4FieldsObserver')) changes++;

// Marca e aplica pequenas protecoes de renderizacao.
html = html.replace('</style>', `
/* ${MARK} */
html.v4-low-motion *,html.v4-low-motion *::before,html.v4-low-motion *::after{animation-duration:.2s!important;transition-duration:.12s!important}
</style>`);
html = html.replace('</body>', `<script>
/* ${MARK} JS */
(function(){
  document.documentElement.classList.add('v4-performance-fixed');
  document.addEventListener('visibilitychange',()=>{
    document.documentElement.classList.toggle('v4-low-motion',document.hidden);
  });
})();
</script>\n</body>`);

if (changes < 2) {
  throw new Error('Patch de desempenho incompleto: apenas '+changes+' trechos corrigidos');
}

fs.writeFileSync(file, html);
console.log('Desempenho corrigido: loops pesados removidos e observers limitados.');
