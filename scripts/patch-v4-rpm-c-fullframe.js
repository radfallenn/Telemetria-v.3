const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 RPM C FULLFRAME';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

html=html.replace(/<div class="card bridge"[\s\S]*?<\/div>\s*<\/div>/,`<div class="rpmCWrap" id="rpmCWrap" aria-label="Conta-giros RPM">
  <div class="rpmC" id="rpmC">
    <div class="rpmCSegments" id="rpmCSegments"></div>
    <div class="rpmCCenter">
      <div class="rpmCTitle">RPM</div>
      <div class="rpmCValue" id="rpmCValue">0</div>
      <div class="rpmCSub" id="rpmCSub">GT7-UDP</div>
    </div>
  </div>
</div>`);

html=html.replace('</style>',`
/* ${MARK} */
html,body{width:100%;height:100%;min-height:100%;overflow-x:hidden;background:#000}
body{padding:0;margin:0;overscroll-behavior:none}
.app{max-width:none;width:100%;min-height:100dvh;margin:0;padding:calc(env(safe-area-inset-top) + 14px) 14px calc(86px + env(safe-area-inset-bottom))}
.rpmCWrap{display:flex;justify-content:center;align-items:center;margin:4px 0 18px;min-height:250px}
.rpmC{position:relative;width:min(86vw,430px);aspect-ratio:1/1;border-radius:50%;display:grid;place-items:center;filter:drop-shadow(0 0 18px rgba(0,217,242,.18))}
.rpmCSegments{position:absolute;inset:0;transform:rotate(126deg)}
.rpmCSeg{position:absolute;left:50%;top:50%;width:10px;height:28px;border-radius:999px;background:#172326;transform-origin:50% calc(-1 * (min(43vw,215px) - 18px));box-shadow:none;transition:background .06s linear,box-shadow .06s linear,opacity .06s linear}
.rpmCSeg.on.green{background:#18ef52;box-shadow:0 0 10px rgba(24,239,82,.8)}
.rpmCSeg.on.yellow{background:#e7ff19;box-shadow:0 0 10px rgba(231,255,25,.8)}
.rpmCSeg.on.orange{background:#ff9f0a;box-shadow:0 0 10px rgba(255,159,10,.8)}
.rpmCSeg.on.red{background:#ff344f;box-shadow:0 0 12px rgba(255,52,79,.9)}
.rpmCCenter{position:absolute;inset:21%;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#071416 0,#020808 72%,#000 100%);border:1px solid #17373a;box-shadow:inset 0 0 35px #000;text-align:center}
.rpmCTitle{font-family:Georgia,serif;font-weight:800;letter-spacing:3px;color:#c7c8c9;font-size:18px}
.rpmCValue{font-size:64px;line-height:1;color:#fff;margin-top:8px;font-weight:300}
.rpmCSub{font-size:13px;color:var(--cyan);margin-top:8px;font-weight:800;letter-spacing:1px}
.rpmC.redline .rpmCCenter{box-shadow:inset 0 0 35px #000,0 0 24px rgba(255,52,79,.42)}
.nav{left:0;right:0;bottom:0;width:100%;min-height:72px;padding:0 0 env(safe-area-inset-bottom);align-items:end;grid-template-columns:repeat(6,minmax(0,1fr));background:#010506;border-top:1px solid #153236}
.nav button,.nav a{min-width:0;height:72px;padding:30px 1px 8px!important;display:flex!important;align-items:flex-end!important;justify-content:center!important;line-height:1!important;font-size:11px!important;white-space:nowrap;overflow:hidden;text-overflow:clip}
.page{padding-bottom:8px}
@media(max-width:430px){.rpmCWrap{min-height:220px}.rpmC{width:min(88vw,390px)}.rpmCSeg{transform-origin:50% calc(-1 * (min(44vw,195px) - 18px));width:9px;height:25px}.rpmCValue{font-size:56px}.nav button,.nav a{font-size:10px!important;padding-top:32px!important}}
</style>`);

html=html.replace('</body>',`<script>
(function(){
 const N=34,ARC=288,start=-144,box=document.getElementById('rpmCSegments');
 if(box&&!box.children.length){
  for(let i=0;i<N;i++){
   const s=document.createElement('i');s.className='rpmCSeg';
   const a=start+(ARC*i/(N-1));
   s.style.transform='translate(-50%,-50%) rotate('+a+'deg) translateY(calc(-1 * (min(43vw,215px) - 18px)))';
   box.appendChild(s);
  }
 }
 function updateGauge(){
  const raw=Number(document.getElementById('rpm')?.textContent)||0;
  const max=Math.max(7000,Number((window.live&&window.live.advanced&&window.live.advanced.maxAlertRPM)||window.live?.maxAlertRPM)||9000);
  const ratio=Math.max(0,Math.min(1,raw/max));
  const on=Math.round(ratio*N);
  document.getElementById('rpmCValue').textContent=Math.round(raw);
  const segs=[...document.querySelectorAll('.rpmCSeg')];
  segs.forEach((s,i)=>{s.className='rpmCSeg';if(i<on){let cls=i/N<.58?'green':i/N<.76?'yellow':i/N<.9?'orange':'red';s.classList.add('on',cls)}});
  document.getElementById('rpmC')?.classList.toggle('redline',ratio>=.92);
  requestAnimationFrame(updateGauge);
 }
 requestAnimationFrame(updateGauge);
})();
</script>\n</body>`);

fs.writeFileSync(file,html);
console.log('RPM em C 80% e full-frame aplicados.');
