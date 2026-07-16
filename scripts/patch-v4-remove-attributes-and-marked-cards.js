const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'..','www','index.html');
let html=fs.readFileSync(file,'utf8');
const MARK='V4 REMOVE ATTRIBUTES PAGE AND MARKED CARDS';
if(html.includes(MARK)){console.log('JA OK:',MARK);process.exit(0)}

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
const css=`\n/* ${MARK} */\n.nav{grid-template-columns:repeat(5,1fr)!important}\n[data-field="rpmtotal"],[data-field="tyres"],[data-field="last"],[data-field="total"]{display:none!important}\n`;
html=html.replace('</style>',css+'\n</style>');

const cleanup=`<script>\n/* ${MARK} RUNTIME */\n(function(){\n const forbidden=new Set(['rpmtotal','tyres','last','total']);\n function clean(){\n  document.getElementById('attributes')?.remove();\n  document.querySelector('[data-page="attributes"]')?.remove();\n  document.querySelectorAll('[data-field]').forEach(el=>{if(forbidden.has(el.dataset.field))el.remove()});\n  document.querySelector('.nav')?.style.setProperty('grid-template-columns','repeat(5,1fr)','important');\n }\n if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clean,{once:true});else clean();\n const observer=new MutationObserver(clean);\n const start=()=>observer.observe(document.body,{childList:true,subtree:true});\n if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});\n})();\n</script>`;
html=html.replace('</body>',cleanup+'\n</body>');

// Valida apenas elementos HTML reais; referências dentro do script de limpeza são permitidas.
if(/<button\b[^>]*data-page=["']attributes["']/i.test(html))throw new Error('Botão ATRIB ainda presente');
if(/<section\b[^>]*id=["']attributes["']/i.test(html))throw new Error('Página ATRIB ainda presente');
fs.writeFileSync(file,html);
console.log('Página ATRIB e cards marcados removidos definitivamente.');