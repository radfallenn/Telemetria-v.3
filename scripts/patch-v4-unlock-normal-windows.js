const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 UNLOCK NORMAL WINDOWS';
if(!html.includes(MARK)){
  const css=`
/* ${MARK} */
html,body{height:auto!important;min-height:100%!important;overflow-x:hidden!important;overflow-y:auto!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch!important}
.app{min-height:100vh!important;overflow:visible!important;pointer-events:auto!important}
.page{position:relative!important;inset:auto!important;height:auto!important;min-height:calc(100vh - 110px)!important;overflow:visible!important;pointer-events:none!important;visibility:hidden!important;opacity:0!important;display:none!important}
.page.on{display:block!important;pointer-events:auto!important;visibility:visible!important;opacity:1!important}
.page *{pointer-events:auto!important}
.nav{pointer-events:auto!important;touch-action:manipulation!important;z-index:1000!important}
.nav button,.action,.customBtn,.close,.tabs button,.fieldItem button,.settings input{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:2!important}
.sheet{display:none!important;pointer-events:none!important;visibility:hidden!important;opacity:0!important}
.sheet.on{display:flex!important;pointer-events:auto!important;visibility:visible!important;opacity:1!important}
.sheet.on .dialog,.sheet.on .dialog *{pointer-events:auto!important}
.dialog{overscroll-behavior:contain!important;touch-action:pan-y!important;-webkit-overflow-scrolling:touch!important}
#designer:not(.on){display:none!important;pointer-events:none!important}
#designer.on{display:flex!important;pointer-events:auto!important}
body.modal-open{overflow:hidden!important}
`;
  html=html.replace('</style>',css+'\n</style>');
  const js=`
/* ${MARK} JS */
(function(){
 function closeAllSheets(){document.querySelectorAll('.sheet.on').forEach(s=>s.classList.remove('on'));document.body.classList.remove('modal-open')}
 function openSheet(id){closeAllSheets();const s=document.getElementById(id);if(s){s.classList.add('on');document.body.classList.add('modal-open');const d=s.querySelector('.dialog');if(d)d.scrollTop=0}}
 window.openSheet=openSheet;window.closeAllSheets=closeAllSheets;
 document.addEventListener('click',e=>{
   const nav=e.target.closest('.nav button');
   if(nav&&nav.dataset.page){e.preventDefault();e.stopPropagation();if(typeof showPage==='function')showPage(nav.dataset.page);return}
   if(e.target.closest('#designerBtn')){e.preventDefault();openSheet('designer');return}
   if(e.target.closest('#closeDesigner')){e.preventDefault();closeAllSheets();return}
   const sheet=e.target.classList&&e.target.classList.contains('sheet')?e.target:null;
   if(sheet){e.preventDefault();closeAllSheets()}
 },true);
 document.addEventListener('touchmove',e=>{
   const d=e.target.closest('.dialog');
   if(document.body.classList.contains('modal-open')&&!d)e.preventDefault();
 },{passive:false});
 setTimeout(()=>{closeAllSheets();const active=document.querySelector('.page.on')||document.getElementById('dash');if(active){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('on',p===active))}},50);
})();
`;
  html=html.replace('</script>',js+'\n</script>');
}
fs.writeFileSync(file,html);
console.log('Janelas normais e navegacao destravadas.');
