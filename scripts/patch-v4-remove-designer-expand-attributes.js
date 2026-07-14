const fs=require('fs');
const path=require('path');

const root=path.join(__dirname,'..');
const file=path.join(root,'www','index.html');
const database=path.join(root,'data','telemetry-attributes.json');
const webDatabase=path.join(root,'www','telemetry-attributes.json');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 DESIGNER PHYSICALLY REMOVED ATTRIBUTES DATABASE';

function removeElementById(source,id){
  const re=new RegExp('<([a-zA-Z][\\w:-]*)\\b[^>]*\\bid=["\\\']'+id+'["\\\'][^>]*>','i');
  const match=re.exec(source);
  if(!match)return source;
  const start=match.index;
  const tag=match[1];
  const tokenRe=new RegExp('<\\/?'+tag+'\\b[^>]*>','ig');
  tokenRe.lastIndex=start;
  let depth=0,end=-1,token;
  while((token=tokenRe.exec(source))){
    const text=token[0];
    if(/^<\\//.test(text))depth--;
    else if(!/\\/>$/.test(text))depth++;
    if(depth===0){end=tokenRe.lastIndex;break;}
  }
  return end>start?source.slice(0,start)+source.slice(end):source;
}

// Remove fisicamente o botão e todas as janelas do Designer.
html=removeElementById(html,'designerBtn');
html=removeElementById(html,'designer');
html=removeElementById(html,'customBuilder');
html=removeElementById(html,'fieldEditor');

// Remove código-base exclusivo do Designer para que ele não permaneça no APK.
html=html.replace(/function applyPref\(\)[\s\S]*?(?=function renderSegments)/,'');
const designerHandlersStart=html.indexOf("$('designerBtn').onclick");
const connectHandlerStart=designerHandlersStart>=0?html.indexOf("$('connectBtn').onclick",designerHandlersStart):-1;
if(designerHandlersStart>=0&&connectHandlerStart>designerHandlersStart){
  html=html.slice(0,designerHandlersStart)+html.slice(connectHandlerStart);
}
html=html.replace(/\bapplyPref\(\);/g,'');
html=html.replace(/<button[^>]*>\s*DESIGNER DO CARD\s*<\/button>/ig,'');
html=html.replace(/<button[^>]*id=["']openDesigner["'][^>]*>[\s\S]*?<\/button>/ig,'');

// Substitui a lista limitada por um catálogo vindo do banco versionado no GitHub.
const attrsStart=html.indexOf('function renderAttrs(d){');
const pollStart=attrsStart>=0?html.indexOf('async function poll',attrsStart):-1;
if(attrsStart<0||pollStart<0)throw new Error('Função renderAttrs não encontrada');
const attrsCode=`
let telemetryAttributeRegistry=[];
const telemetryDiscovered=new Map();
function telemetryPath(obj,p){return String(p).split('.').reduce((a,k)=>a==null?undefined:a[k],obj)}
function telemetryFirst(obj,paths){for(const p of paths||[]){const v=telemetryPath(obj,p);if(v!==undefined&&v!==null&&v!=='')return v}return undefined}
function telemetryFlatten(obj,prefix='',depth=0){if(!obj||typeof obj!=='object'||depth>4)return;Object.entries(obj).forEach(([k,v])=>{const p=prefix?prefix+'.'+k:k;if(v&&typeof v==='object'&&!Array.isArray(v))telemetryFlatten(v,p,depth+1);else if(['string','number','boolean'].includes(typeof v))telemetryDiscovered.set(p,v)})}
function telemetryValue(v,unit=''){if(v===undefined||v===null||v==='')return'--';if(typeof v==='number')v=Math.abs(v)>=100?Math.round(v):Number(v.toFixed(2));else if(Array.isArray(v))v=v.join(' · ');else if(typeof v==='object')v=Object.entries(v).map(([k,x])=>k+': '+x).join(' · ');return String(v)+(unit?' '+unit:'')}
function renderAttrs(d){
 telemetryFlatten(d||{});
 const known=new Set();
 let last='';
 const rows=[];
 telemetryAttributeRegistry.forEach(item=>{
  (item.paths||[]).forEach(p=>known.add(p));
  if(item.group!==last){rows.push('<div class="telemetryGroup">'+item.group.toUpperCase()+'</div>');last=item.group}
  rows.push('<div class="sectionItem telemetryAttribute"><div class="label">'+item.name+'</div><div class="telemetryAttributeValue">'+telemetryValue(telemetryFirst(d||{},item.paths),item.unit||'')+'</div><div class="telemetryAttributePath">'+(item.paths||[]).join(' · ')+'</div></div>');
 });
 const extras=[...telemetryDiscovered.entries()].filter(([p])=>!known.has(p)).slice(0,160);
 if(extras.length){rows.push('<div class="telemetryGroup">OUTROS CAMPOS RECEBIDOS DO BRIDGE</div>');extras.forEach(([p,v])=>rows.push('<div class="sectionItem telemetryAttribute"><div class="label">'+p.split('.').pop()+'</div><div class="telemetryAttributeValue">'+telemetryValue(v)+'</div><div class="telemetryAttributePath">'+p+'</div></div>'))}
 $('attrList').innerHTML=rows.join('')||'<div class="smallsub">Aguardando atributos da telemetria.</div>';
}
fetch('telemetry-attributes.json',{cache:'no-store'}).then(r=>r.json()).then(list=>{telemetryAttributeRegistry=Array.isArray(list)?list:[];renderAttrs(live||{})}).catch(()=>{});
`;
html=html.slice(0,attrsStart)+attrsCode+html.slice(pollStart);

// Estilo da página ATRIB, sem qualquer dependência do Designer.
const css=`
/* ${MARK} */
#designerBtn,#openDesigner,#designer,#customBuilder,.customBuilder,#fieldEditor,.fieldEditor{display:none!important}
#attributes #attrList{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#attributes .telemetryGroup{grid-column:1/-1;margin:14px 0 2px;color:#75eaff;font-size:12px;font-weight:900;letter-spacing:1.4px}
#attributes .telemetryAttribute{min-width:0;padding:12px!important}
#attributes .telemetryAttributeValue{font-size:21px;color:var(--cyan);margin-top:7px;overflow:hidden;text-overflow:ellipsis}
#attributes .telemetryAttributePath{font-size:9px;color:#6f8287;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:430px){#attributes #attrList{grid-template-columns:1fr 1fr;gap:8px}#attributes .telemetryAttributeValue{font-size:18px}}
`;
html=html.replace('</style>',css+'\n</style>');

// Copia o banco para dentro do pacote web do APK.
if(!fs.existsSync(database))throw new Error('Banco de atributos não encontrado');
fs.copyFileSync(database,webDatabase);

// Validação: o build falha se o Designer continuar no código final.
if(/DESIGNER DO CARD/i.test(html)||/id=["']designer["']/i.test(html)||/id=["']designerBtn["']/i.test(html)){
  throw new Error('Designer do Card ainda presente no HTML final');
}
if(!html.includes('telemetry-attributes.json'))throw new Error('Banco de atributos não foi integrado');

html=html.replace('</body>',`<script>/* ${MARK} */</script>\n</body>`);
fs.writeFileSync(file,html);
console.log('Designer removido fisicamente e banco de atributos integrado ao APK.');
