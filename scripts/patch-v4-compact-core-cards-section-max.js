const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 COMPACT CORE CARDS SECTION MAX';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

html=html.replace('</style>',`
/* ${MARK} */
#dash [data-field="throttle"],
#dash [data-field="brake"],
#dash [data-field="best"]{
  min-height:78px!important;
  height:78px!important;
  padding:9px 12px!important;
  overflow:hidden!important;
}
#dash [data-field="throttle"] .label,
#dash [data-field="brake"] .label,
#dash [data-field="best"] .label{
  font-size:8px!important;
  letter-spacing:1px!important;
}
#dash [data-field="throttle"] .value,
#dash [data-field="brake"] .value,
#dash [data-field="best"] .value{
  font-size:18px!important;
  margin-top:5px!important;
  line-height:1!important;
}
#dash [data-field="throttle"] .bar,
#dash [data-field="brake"] .bar{
  height:7px!important;
  margin-top:7px!important;
}
#dash [data-field="fuel"]{display:none!important}
#dash [data-field="max"]{
  min-height:118px!important;
  height:auto!important;
}
#dash [data-field="max"] .label{font-size:13px!important}
#dash [data-field="max"] .value{font-size:31px!important;margin-top:10px!important}
#dash [data-field="max"] .smallsub{font-size:12px!important;margin-top:7px!important}
@media(max-width:430px){
 #dash [data-field="throttle"],#dash [data-field="brake"],#dash [data-field="best"]{min-height:70px!important;height:70px!important;padding:8px 10px!important}
 #dash [data-field="throttle"] .value,#dash [data-field="brake"] .value,#dash [data-field="best"] .value{font-size:16px!important}
}
</style>`);

html=html.replace('</body>',`<script>
/* ${MARK} JS */
(function(){
 const q=id=>document.getElementById(id);
 let sectionMax=0;
 const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
 function backendSectionMax(d){
  return num(d?.sectionMaxSpeed ?? d?.currentSectionMaxSpeed ?? d?.session?.maxSpeed ?? d?.activeSection?.maxSpeed ?? d?.velocidadeMaximaSecao);
 }
 function apply(d){
  if(!d||typeof d!=='object')return d;
  const speed=num(d.velocidade ?? d.speed ?? d.car?.speedKmh);
  const provided=backendSectionMax(d);
  sectionMax=Math.max(sectionMax,speed,provided);
  d.velocidadeMaxima=sectionMax;
  d.velocidadeMaximaSecao=sectionMax;
  const el=q('maxSpeed');if(el)el.textContent=String(Math.round(sectionMax));
  return d;
 }
 function wrapRender(){
  if(typeof window.render!=='function'||window.render.__v4SectionMax)return;
  const old=window.render;
  const wrapped=function(d){d=apply(d);const out=old.call(this,d);const el=q('maxSpeed');if(el)el.textContent=String(Math.round(sectionMax));return out};
  wrapped.__v4SectionMax=true;window.render=wrapped;
 }
 function resetSectionMax(){sectionMax=0;const el=q('maxSpeed');if(el)el.textContent='0'}
 function bindReset(id){const b=q(id);if(!b||b.__v4MaxBound)return;b.__v4MaxBound=true;b.addEventListener('click',resetSectionMax,{capture:true})}
 function init(){
  wrapRender();bindReset('startSection');bindReset('resetSection');
  const fuel=document.querySelector('#dash [data-field="fuel"]');if(fuel)fuel.remove();
  const timer=setInterval(()=>{wrapRender();bindReset('startSection');bindReset('resetSection')},1500);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInterval(timer)},{once:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
</script>\n</body>`);
fs.writeFileSync(file,html);
console.log('Cards compactos, combustível duplicado removido e Max Speed da seção aplicados.');
