const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 RPM C FULLFRAME';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

html=html.replace(/<div class="card bridge"[\s\S]*?<\/div>\s*<\/div>/,`<div class="rpmCWrap" id="rpmCWrap" aria-label="Indicador de velocidade e RPM">
  <div class="rpmC" id="rpmC">
    <div class="rpmCOuterGlow"></div>
    <div class="rpmCRing rpmCRingOuter"></div>
    <div class="rpmCRing rpmCRingInner"></div>
    <div class="rpmCSegments" id="rpmCSegments"></div>
    <div class="rpmCTicks" id="rpmCTicks"></div>
    <div class="rpmCNumbers" id="rpmCNumbers"></div>
    <div class="rpmCRpmReadout"><span id="rpmCMiniValue">0</span> RPM</div>
    <div class="rpmCCenter">
      <div class="rpmCTitle">VELOCIDADE</div>
      <div class="rpmCValue" id="rpmCValue">0</div>
      <div class="rpmCSub">KM/H</div>
    </div>
    <div class="rpmCGear" id="rpmCGear">N</div>
  </div>
</div>`);

html=html.replace('</style>',`
 /* ${MARK} */
 html,body{width:100%;height:100%;min-height:100%;overflow-x:hidden;background:#000}
 body{padding:0;margin:0;overscroll-behavior:none}
 .app{max-width:none;width:100%;min-height:100dvh;margin:0;padding:calc(env(safe-area-inset-top) + 14px) 14px calc(86px + env(safe-area-inset-bottom))}
 .rpmCWrap{display:flex;justify-content:center;align-items:center;margin:2px 0 16px;min-height:300px}
 .rpmC{position:relative;width:min(92vw,470px);aspect-ratio:1/1;border-radius:50%;display:grid;place-items:center;filter:drop-shadow(0 0 22px rgba(0,170,255,.22))}
 .rpmCOuterGlow{position:absolute;inset:3.5%;border-radius:50%;background:radial-gradient(circle at 50% 42%,transparent 58%,rgba(0,174,255,.18) 72%,transparent 76%);pointer-events:none}
 .rpmCRing{position:absolute;border-radius:50%;pointer-events:none}
 .rpmCRingOuter{inset:7%;border:2px solid rgba(0,174,255,.42);box-shadow:0 0 12px rgba(0,174,255,.34),inset 0 0 12px rgba(0,174,255,.15)}
 .rpmCRingInner{inset:16.5%;border:1px solid rgba(64,145,190,.32);box-shadow:inset 0 0 18px rgba(0,0,0,.9)}
 .rpmCSegments,.rpmCTicks,.rpmCNumbers{position:absolute;inset:0}
 .rpmCSeg{position:absolute;left:50%;top:50%;width:10px;height:27px;border-radius:4px;background:#142326;box-shadow:inset 0 0 3px #000;transition:background .05s linear,box-shadow .05s linear,opacity .05s linear}
 .rpmCSeg.on{background:hsl(var(--segHue,120) 100% 50%);box-shadow:0 0 12px hsl(var(--segHue,120) 100% 50% / .9),inset 0 0 2px rgba(255,255,255,.55)}
 .rpmCTick{position:absolute;left:50%;top:50%;width:2px;height:11px;border-radius:2px;background:rgba(210,236,247,.45)}
 .rpmCTick.major{width:3px;height:18px;background:#eef8fb;box-shadow:0 0 5px rgba(255,255,255,.55)}
 .rpmCNum{position:absolute;left:50%;top:50%;width:34px;text-align:center;color:#eaf1f3;font-size:16px;font-weight:800;text-shadow:0 0 7px #000;transform-origin:center}
 .rpmCRpmReadout{position:absolute;top:14.5%;left:50%;transform:translateX(-50%);z-index:4;color:#eef4f5;font-size:13px;font-weight:900;letter-spacing:.5px;text-shadow:0 0 8px #000;white-space:nowrap}
 .rpmCCenter{position:absolute;inset:24%;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 42%,#071416 0,#020808 68%,#000 100%);border:1px solid #17373a;box-shadow:inset 0 0 40px #000,0 0 0 6px rgba(0,28,38,.38);text-align:center;z-index:3}
 .rpmCTitle{font-family:Georgia,serif;font-weight:800;letter-spacing:3px;color:#c7c8c9;font-size:16px}
 .rpmCValue{font-size:68px;line-height:1;color:#fff;margin-top:7px;font-weight:300}
 .rpmCSub{font-size:15px;color:#c7c8c9;margin-top:8px;font-weight:700;letter-spacing:2px}
 .rpmCGear{position:absolute;left:50%;bottom:3.5%;transform:translateX(-50%);width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#073c69 0,#021421 72%);border:2px solid #00d9f2;color:#00d9f2;font-size:39px;font-weight:300;line-height:1;box-shadow:0 0 20px rgba(0,217,242,.42),inset 0 0 18px rgba(0,217,242,.16);z-index:6}
 .rpmC.redline .rpmCCenter{box-shadow:inset 0 0 40px #000,0 0 28px rgba(255,52,79,.46)}
 .hero{display:none!important}
 .nav{left:0;right:0;bottom:0;width:100%;min-height:72px;padding:0 0 env(safe-area-inset-bottom);align-items:end;grid-template-columns:repeat(6,minmax(0,1fr));background:#010506;border-top:1px solid #153236}
 .nav button,.nav a{min-width:0;height:72px;padding:30px 1px 8px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;line-height:1!important;font-size:11px!important;white-space:nowrap;overflow:hidden;text-overflow:clip}
 .page{padding-bottom:8px}
 @media(max-width:430px){.rpmCWrap{min-height:260px}.rpmC{width:min(94vw,410px)}.rpmCSeg{width:8px;height:23px}.rpmCValue{font-size:56px}.rpmCGear{width:54px;height:54px;font-size:34px}.rpmCNum{font-size:14px}.rpmCRpmReadout{font-size:12px}.nav button,.nav a{font-size:10px!important;padding-top:32px!important}}
 </style>`);

html=html.replace('</body>',`<script>
(function(){
 const N=42,ARC=288,start=-144,box=document.getElementById('rpmCSegments'),ticks=document.getElementById('rpmCTicks'),nums=document.getElementById('rpmCNumbers');
 const radius='calc(min(46vw,235px) - 22px)';
 if(box&&!box.children.length){
  for(let i=0;i<N;i++){
   const s=document.createElement('i');s.className='rpmCSeg';
   const a=start+(ARC*i/(N-1));
   s.style.transform='translate(-50%,-50%) rotate('+a+'deg) translateY(calc(-1 * '+radius+'))';
   box.appendChild(s);
  }
 }
 if(ticks&&!ticks.children.length){
  for(let i=0;i<=50;i++){
   const t=document.createElement('i');t.className='rpmCTick'+(i%5===0?' major':'');
   const a=start+(ARC*i/50);
   t.style.transform='translate(-50%,-50%) rotate('+a+'deg) translateY(calc(-1 * (min(46vw,235px) - 58px)))';
   ticks.appendChild(t);
  }
 }
 if(nums&&!nums.children.length){
  [0,2,4,6,8,10].forEach((n,j)=>{
   const e=document.createElement('b');e.className='rpmCNum';e.textContent=n;
   const a=start+(ARC*j/5),rad=a*Math.PI/180,r=Math.min(window.innerWidth*.46,235)-83;
   e.style.transform='translate(calc(-50% + '+(Math.sin(rad)*r)+'px),calc(-50% - '+(Math.cos(rad)*r)+'px))';
   nums.appendChild(e);
  });
 }
 function textNumber(id,fallback=0){const n=Number(String(document.getElementById(id)?.textContent||'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:fallback}
 function updateGauge(){
  const rpm=textNumber('rpm',Number(window.live?.rpm)||0),speed=textNumber('speed',Number(window.live?.velocidade)||0),gear=String(document.getElementById('gear')?.textContent||window.live?.marcha||'N').trim()||'N';
  const max=Math.max(7000,Number(window.live?.advanced?.maxAlertRPM||window.live?.maxAlertRPM)||9000),ratio=Math.max(0,Math.min(1,rpm/max)),on=Math.round(ratio*N);
  const value=document.getElementById('rpmCValue');if(value)value.textContent=Math.round(speed);
  const mini=document.getElementById('rpmCMiniValue');if(mini)mini.textContent=Math.round(rpm);
  const gearEl=document.getElementById('rpmCGear');if(gearEl)gearEl.textContent=gear;
  [...document.querySelectorAll('.rpmCSeg')].forEach((s,i)=>{s.className='rpmCSeg';s.style.removeProperty('--segHue');if(i<on){const p=i/(N-1),hue=p<=.20?120:Math.max(0,120*(1-(p-.20)/.80));s.style.setProperty('--segHue',String(hue));s.classList.add('on')}});
  document.getElementById('rpmC')?.classList.toggle('redline',ratio>=.92);
  requestAnimationFrame(updateGauge);
 }
 requestAnimationFrame(updateGauge);
})();
</script>\n</body>`);

fs.writeFileSync(file,html);
console.log('Conta-giros premium com escala, marcadores e leitura RPM aplicado.');
