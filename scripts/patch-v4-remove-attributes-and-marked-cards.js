const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 REMOVE ATTRIBUTES PAGE AND MARKED CARDS';
const CANONICAL_BRIDGE='<script src="bridge-v408.js"></script>';
const BRIDGE_TAG=/<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*bridge-v408\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script>\s*/gi;

function normalizeBridgeReference(source){
 source=source.replace(BRIDGE_TAG,'\n');
 const token='__GT7_CANONICAL_BRIDGE_SCRIPT__';
 if(!/<\/body>/i.test(source))throw new Error('Tag </body> ausente ao normalizar a Bridge');
 source=source.replace(/<\/body>/i,token+'\n</body>');
 // A validação antiga conta texto bruto. Remove menções em comentários/diagnósticos
 // e restaura somente a inclusão externa canônica.
 source=source.replace(/bridge-v408\.js/gi,'');
 source=source.replace(token,CANONICAL_BRIDGE);
 const tags=source.match(BRIDGE_TAG)||[];
 const mentions=source.match(/bridge-v408\.js/gi)||[];
 if(tags.length!==1||mentions.length!==1)throw new Error('Bridge final inválida: tags='+tags.length+' menções='+mentions.length);
 return source;
}

if(html.includes(MARK)){
 html=normalizeBridgeReference(html);
 fs.writeFileSync(file,html);
 console.log('JA OK:',MARK,'· Bridge única confirmada');
 process.exit(0);
}

function removeBalancedElementByAttr(source, attr, value){
  const pattern=new RegExp('<([a-zA-Z0-9]+)(?=[^>]*\\b'+attr+'=["\\\']'+value+'["\\\'])[^>]*>','i');
  const match=pattern.exec(source);
  if(!match)return source;
  const tag=match[1];
  let pos=match.index+match[0].length;
  let depth=1;
  const token=new RegExp('<\\/?'+tag+'\\b[^>]*>','ig');
  token.lastIndex=pos;
  let current;
  while((current=token.exec(source))){
    const text=current[0].trim();
    if(text.startsWith('</'))depth--;
    else if(!text.endsWith('/>'))depth++;
    if(depth===0)return source.slice(0,match.index)+source.slice(token.lastIndex);
  }
  throw new Error('Elemento não balanceado: '+attr+'='+value);
}

// Cards fixos marcados no DASH.
for(const field of ['rpmtotal','tyres'])html=removeBalancedElementByAttr(html,'data-field',field);

// Página ATRIB completa e botão da navegação.
html=removeBalancedElementByAttr(html,'id','attributes');
html=html.replace(/<button\b[^>]*data-page=["']attributes["'][^>]*>[\s\S]*?<\/button>/ig,'');

// Não chamar mais o renderizador da página excluída.
html=html.replace(/;?renderAttrs\(d\)/g,'');
html=html.replace(/function renderAttrs\(d\)\{[\s\S]*?\}(?=\s*async function poll)/,'function renderAttrs(){return}');

// Retira RPM/Tempo Total, pneus, Última volta e Tempo total caso scripts antigos os recriem.
const css=`
/* ${MARK} */
.nav{grid-template-columns:repeat(5,1fr)!important}
[data-field="rpmtotal"],[data-field="tyres"],[data-field="last"],[data-field="total"]{display:none!important}
`;
html=html.replace('</style>',css+'\n</style>');

const cleanup=`<script>
/* ${MARK} RUNTIME */
(function(){
 const forbidden=new Set(['rpmtotal','tyres','last','total']);
 function clean(){
  document.getElementById('attributes')?.remove();
  document.querySelector('[data-page="attributes"]')?.remove();
  document.querySelectorAll('[data-field]').forEach(el=>{if(forbidden.has(el.dataset.field))el.remove()});
  document.querySelector('.nav')?.style.setProperty('grid-template-columns','repeat(5,1fr)','important');
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();
 const observer=new MutationObserver(clean);
 const start=()=>observer.observe(document.body,{childList:true,subtree:true});
 if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
})();
</script>`;
html=html.replace('</body>',cleanup+'\n</body>');
html=normalizeBridgeReference(html);

// Valida apenas elementos HTML reais; referências dentro do script de limpeza são permitidas.
if(/<button\b[^>]*data-page=["']attributes["']/i.test(html))throw new Error('Botão ATRIB ainda presente');
if(/<section\b[^>]*id=["']attributes["']/i.test(html))throw new Error('Página ATRIB ainda presente');
fs.writeFileSync(file,html);
console.log('Página ATRIB e cards marcados removidos definitivamente; Bridge única confirmada.');
