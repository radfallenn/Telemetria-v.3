const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'www');
const telemetryPath = path.join(root, 'telemetry-bc.js');
const identityPath = path.join(root, 'identity-track.js');

function patchFile(filePath, transform, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} ausente: ${filePath}`);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) console.log(`${label}: nenhuma alteração adicional necessária`);
  else fs.writeFileSync(filePath, after);
  new Function(after);
  console.log(`${label}: validado`);
}

patchFile(telemetryPath, (source) => {
  let out = source;
  if (!out.includes("page.classList.contains('on')")) {
    out = out.replace(
      "  async function refresh() {\n    if (!$('telemetryAll')) return;",
      "  async function refresh() {\n    const page = $('telemetria');\n    if (!$('telemetryAll') || !page || !page.classList.contains('on')) return;"
    );
  }
  out = out.replace(
    "    refresh();\n    timer = setInterval(refresh, 700);",
    "    window.addEventListener('gt7:pagechange', (event) => { if (event.detail?.page === 'telemetria') refresh(); });\n    document.querySelector('[data-p=\"telemetria\"]')?.addEventListener('click', () => setTimeout(refresh, 0));\n    timer = setInterval(refresh, 1600);"
  );
  return out;
}, 'Telemetria B/C');

patchFile(identityPath, (source) => {
  let out = source;
  out = out.replace('    enableFullscreen();\n', '    // Fullscreen é controlado nativamente pelo Android para não consumir o primeiro toque.\n');
  out = out.replace('    timer = setInterval(refreshIdentity, 1000);', '    timer = setInterval(refreshIdentity, 1800);');
  return out;
}, 'Identificação de carro e pista');
