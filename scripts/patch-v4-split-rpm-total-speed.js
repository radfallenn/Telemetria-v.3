const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 SPLIT RPM TOTAL SPEED CARDS';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

const oldBlock=/<div class="card rpmblock" data-field="rpmtotal">[\s\S]*?<div class="speedscale"><span>0<\/span><span>KM\/H<\/span><span>300<\/span><\/div><\/div>/;
const newBlock=`
<div class="rpmSplit" data-field="rpmtotal">
  <div class="card stat rpmSolo">
    <div class="label">RPM</div>
    <div class="value" id="rpm">0</div>
  </div>
  <div class="card stat totalSolo">
    <div class="label">TEMPO TOTAL</div>
    <div class="value" id="total">--</div>
  </div>
  <div class="card speedSolo">
    <div class="label" style="text-align:center">VELOCIDADE</div>
    <div class="segments" id="speedSegments"></div>
    <div class="speedscale"><span>0</span><span>KM/H</span><span>300</span></div>
  </div>
</div>`;

if(!oldBlock.test(html))throw new Error('Bloco RPM/Tempo/Velocidade nao encontrado');
html=html.replace(oldBlock,newBlock);

const css=`
/* ${MARK} */
.rpmSplit{display:grid;grid-template-columns:1fr 1fr;gap:var(--gap);margin-bottom:var(--gap)}
.rpmSplit .rpmSolo,.rpmSplit .totalSolo{min-height:150px}
.rpmSplit .rpmSolo .value,.rpmSplit .totalSolo .value{font-size:42px;margin-top:22px;line-height:1}
.rpmSplit .speedSolo{grid-column:1/-1;padding-top:22px;padding-bottom:18px}
.rpmSplit .speedSolo .segments{margin-top:24px}
body.compact .rpmSplit .rpmSolo,body.compact .rpmSplit .totalSolo{min-height:120px}
@media(max-width:430px){.rpmSplit .rpmSolo,.rpmSplit .totalSolo{min-height:138px}.rpmSplit .rpmSolo .value,.rpmSplit .totalSolo .value{font-size:38px}}
`;
html=html.replace('</style>',css+'\n</style>');
fs.writeFileSync(file,html);
console.log('RPM, Tempo Total e Velocidade separados em 3 cards.');
