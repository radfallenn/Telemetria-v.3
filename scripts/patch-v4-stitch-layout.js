const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'www', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const MARK='V4 STITCH COCKPIT LAYOUT';

if (!html.includes(MARK)) {
  const css = `
/* ${MARK} */
:root{--v4-cyan:#08cfff;--v4-blue:#0476ff;--v4-green:#35f35a;--v4-red:#ff324d;--v4-yellow:#ffe13a;--v4-bg:#020811;--v4-panel:#071421;--v4-line:#18384c}
body{background:radial-gradient(circle at 50% -15%,#0d2137 0,#030a13 34%,#01050b 75%,#000 100%)!important;color:#eef8ff!important;font-family:Inter,Arial,sans-serif!important}
#modPage{padding-bottom:110px!important}
#modPage>.title{display:flex!important;align-items:center!important;justify-content:space-between!important;margin:8px 2px 12px!important;padding:0!important;background:none!important;border:0!important}
#modPage>.title b{font-size:28px!important;letter-spacing:1px!important;font-style:italic!important}
#modPage>.title:after{content:'●  OK  18ms';display:flex;align-items:center;gap:7px;padding:10px 16px;border:1px solid #294350;border-radius:999px;background:linear-gradient(180deg,#101a20,#05090d);box-shadow:0 0 20px rgba(66,255,90,.22);font-size:12px;color:#eaffef}
#modPage>.title .lab{display:none!important}
.modularTools{position:relative!important;top:auto!important;background:linear-gradient(180deg,rgba(8,22,34,.95),rgba(2,9,16,.96))!important;border:1px solid #214258!important;border-radius:12px!important;padding:9px 12px!important;margin:0 0 8px!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 8px 24px rgba(0,0,0,.35)!important}
.modularTools:before{content:'BRIDGE';display:block;text-align:center;color:#8fa3b2;font-size:11px;letter-spacing:1px}.modularTools:after{content:'OK · GT7-UDP';display:block;text-align:center;color:var(--v4-cyan);font-size:16px;font-weight:800;letter-spacing:.5px}
.modularTools .row,.modularTools .small{display:none!important}
.cockpit{min-height:1260px!important;border:1px solid #24465a!important;border-radius:14px!important;background:linear-gradient(180deg,rgba(4,12,20,.97),rgba(1,5,10,.99))!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.02),0 28px 60px rgba(0,0,0,.55)!important;overflow:hidden!important;padding:0!important}
.cockpit:before{content:'';position:absolute;left:4%;right:4%;top:12px;height:420px;border-radius:50%;background:radial-gradient(circle at center,rgba(4,118,255,.14),transparent 61%);pointer-events:none}
.mw{border:1px solid #203f52!important;border-radius:10px!important;background:linear-gradient(180deg,rgba(8,22,34,.98),rgba(3,11,18,.98))!important;box-shadow:inset 0 1px rgba(255,255,255,.04),0 10px 24px rgba(0,0,0,.35)!important;padding:12px 14px!important;min-height:78px!important}
.mw .lab{color:#a5b8c6!important;font-size:11px!important;letter-spacing:.7px!important;font-weight:800!important}
.mw .val{color:#f4fbff!important;font-size:28px!important;font-weight:900!important;text-shadow:0 0 14px rgba(255,255,255,.08)!important}
.mw .sub{color:#8395a3!important;font-size:10px!important}
.mw .editBtn{opacity:0!important}
.cockpit.edit .mw .editBtn{opacity:1!important}
.mw[data-id='speedGauge']{left:24px!important;top:28px!important;width:calc(100% - 48px)!important;height:410px!important;border-radius:16px!important;background:radial-gradient(circle,#081521 0,#030911 58%,#01040a 100%)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;overflow:hidden!important}
.mw[data-id='speedGauge']:before{content:'';position:absolute;inset:18px 34px 44px;border-radius:50%;background:conic-gradient(from 220deg,#23f35f 0 27%,#d9ed35 37%,#ffc21f 52%,#ff6a00 69%,#ff193a 82%,transparent 82% 100%);filter:drop-shadow(0 0 9px rgba(0,188,255,.7))}
.mw[data-id='speedGauge']:after{content:'';position:absolute;inset:44px 58px 70px;border-radius:50%;background:#030912;box-shadow:inset 0 0 35px #000,0 0 0 1px #112a3a}
.mw[data-id='speedGauge'] .lab{display:none!important}
.mw[data-id='speedGauge'] .val{position:relative;z-index:2;font-size:92px!important;line-height:.95!important;font-style:italic!important}
.mw[data-id='speedGauge'] .sub{position:relative;z-index:2;font-size:20px!important;font-weight:800!important;color:#dce9f1!important}
.mw[data-id='gearW']{left:calc(50% - 68px)!important;top:290px!important;width:136px!important;height:118px!important;z-index:8!important;text-align:center!important;background:transparent!important;border:0!important;box-shadow:none!important}
.mw[data-id='gearW'] .lab{display:none!important}.mw[data-id='gearW'] .val{font-size:84px!important;color:#068cff!important;font-style:italic!important}.mw[data-id='gearW'] .sub:after{content:'MT';font-size:16px;color:#c8d2d8}
.mw[data-id='rpmGauge']{left:24px!important;top:448px!important;width:calc(50% - 30px)!important;height:80px!important;border-radius:10px!important}
.mw[data-id='rpmGauge']:before,.mw[data-id='rpmGauge']:after{display:none!important}.mw[data-id='rpmGauge'] .val{font-size:30px!important}.mw[data-id='rpmGauge'] .sub{font-size:10px!important}
.mw[data-id='totalW']{left:calc(50% + 6px)!important;top:448px!important;width:calc(50% - 30px)!important;height:80px!important}
.mw[data-id='thrW']{left:24px!important;top:536px!important;width:calc(50% - 30px)!important;height:86px!important}.mw[data-id='brakeW']{left:calc(50% + 6px)!important;top:536px!important;width:calc(50% - 30px)!important;height:86px!important}
.mw[data-id='bestW']{left:24px!important;top:630px!important;width:calc(50% - 30px)!important;height:86px!important}.mw[data-id='fuelW']{left:calc(50% + 6px)!important;top:630px!important;width:calc(50% - 30px)!important;height:86px!important}
.mw[data-id='lapsW']{left:24px!important;top:724px!important;width:calc(50% - 30px)!important;height:78px!important}.mw[data-id='maxW']{left:calc(50% + 6px)!important;top:724px!important;width:calc(50% - 30px)!important;height:78px!important}
.mw[data-id='gradeW']{left:24px!important;top:810px!important;width:calc(50% - 30px)!important;height:96px!important}.mw[data-id='consW']{left:calc(50% + 6px)!important;top:810px!important;width:calc(50% - 30px)!important;height:96px!important}
.mw[data-id='tyreFLW']{left:24px!important;top:930px!important;width:calc(50% - 30px)!important;height:92px!important}.mw[data-id='tyreFRW']{left:calc(50% + 6px)!important;top:930px!important;width:calc(50% - 30px)!important;height:92px!important}.mw[data-id='tyreRLW']{left:24px!important;top:1030px!important;width:calc(50% - 30px)!important;height:92px!important}.mw[data-id='tyreRRW']{left:calc(50% + 6px)!important;top:1030px!important;width:calc(50% - 30px)!important;height:92px!important}
.mw[data-id='lastW'],.mw[data-id='avgW'],.mw[data-id='deltaW'],.mw[data-id='raspW'],.mw[data-id='boostW'],.mw[data-id='oilPW'],.mw[data-id='oilTW'],.mw[data-id='waterTW'],.mw[data-id='gSwayW'],.mw[data-id='gHeaveW'],.mw[data-id='gSurgeW'],.mw[data-id='steerW'],.mw[data-id='clutchW'],.mw[data-id='surfaceW'],.mw[data-id='categoryW'],.mw[data-id='carCodeW'],.mw[data-id='packetW'],.mw[data-id='suggestW']{display:none!important}
.nav{grid-template-columns:repeat(6,1fr)!important;border:1px solid #19374a!important;border-radius:12px!important;background:linear-gradient(180deg,#08131f,#030811)!important;overflow:hidden!important}
.nav .navBtn{font-size:10px!important;border-radius:0!important;background:transparent!important;border-right:1px solid #102b3d!important}.nav .navBtn.on{color:#08bfff!important;box-shadow:inset 0 0 22px rgba(0,153,255,.22)!important}
.nav:before{content:'';display:none}
@media(max-width:420px){#modPage>.title b{font-size:23px!important}.mw[data-id='speedGauge'] .val{font-size:74px!important}.cockpit{min-height:1220px!important}}
`;
  html = html.replace('</style>', css + '\n</style>');

  const js = `
/* ${MARK} JS */
setTimeout(()=>{
 try{
  const t=document.querySelector('#modPage>.title b');if(t)t.textContent='V4 COCKPIT';
  const nav=document.querySelector('.nav');
  if(nav){nav.innerHTML='<button class="navBtn on" data-page="modPage">DASH</button><button class="navBtn" data-page="infoPage">ATRIB</button><button class="navBtn" data-page="lapsPage">VOLTAS</button><button class="navBtn" data-page="setPage">SEÇÃO</button><button class="navBtn" data-page="infoPage">TELEMETRIA</button><button class="navBtn" data-page="setPage">SET</button>';document.querySelectorAll('.navBtn').forEach(b=>b.onclick=()=>{if(typeof showPage==='function')showPage(b.dataset.page)})}
  if(typeof buildCockpit==='function')buildCockpit();
 }catch(e){console.error('v4 stitch layout',e)}
},220);
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(indexPath, html);
console.log('Visual V4 Stitch aplicado.');
