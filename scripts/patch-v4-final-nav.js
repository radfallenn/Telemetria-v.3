const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 FINAL NAV FIX';
if(!html.includes(MARK)){
  const css=`\n/* ${MARK} */\n.nav{pointer-events:auto!important;z-index:9999!important;isolation:isolate!important}\n.nav button{pointer-events:auto!important;position:relative!important;z-index:10000!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent}\n.page{pointer-events:none!important}\n.page.on{pointer-events:auto!important}\n.sheet:not(.on){display:none!important;pointer-events:none!important;visibility:hidden!important}\n.sheet.on{display:flex!important;pointer-events:auto!important;visibility:visible!important}\n`;
  html=html.replace('</style>',css+'\n</style>');
  const js=`\n/* ${MARK} JS */\n(function(){\n const nav=document.querySelector('.nav');\n if(!nav)return;\n function openPage(id){\n   const target=document.getElementById(id);\n   if(!target)return;\n   document.querySelectorAll('.page').forEach(p=>{p.classList.toggle('on',p===target);p.style.display=p===target?'block':'none'});\n   nav.querySelectorAll('button[data-page]').forEach(b=>b.classList.toggle('on',b.dataset.page===id));\n   document.querySelectorAll('.sheet').forEach(s=>{s.classList.remove('on');s.style.display='none'});\n   window.scrollTo({top:0,behavior:'instant'});\n   if(id==='sessions'&&typeof loadSessions==='function')loadSessions();\n }\n nav.replaceWith(nav.cloneNode(true));\n const fixedNav=document.querySelector('.nav');\n fixedNav.addEventListener('click',function(e){\n   const btn=e.target.closest('button[data-page]');\n   if(!btn)return;\n   e.preventDefault();e.stopPropagation();openPage(btn.dataset.page);\n },true);\n fixedNav.addEventListener('touchend',function(e){\n   const btn=e.target.closest('button[data-page]');\n   if(!btn)return;\n   e.preventDefault();openPage(btn.dataset.page);\n },{capture:true,passive:false});\n window.showPage=openPage;\n openPage('dash');\n})();\n`;
  html=html.replace('</script>',js+'\n</script>');
}
fs.writeFileSync(file,html);console.log('Navegacao V4 corrigida definitivamente.');
