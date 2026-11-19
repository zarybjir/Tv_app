// Ověří, že to, co si televize stáhnou jako aktualizaci, je v pořádku.
const fs = require('fs');
const vm = require('vm');
const { execSync } = require('child_process');

const fail = (msg) => { console.error('CHYBA: ' + msg); process.exitCode = 1; };
const man = JSON.parse(fs.readFileSync('version.json', 'utf8'));

if (!/^\d+\.\d+\.\d+$/.test(man.version)) fail('version.json: verze musí mít tvar 1.2.3');
const bundled = /PROMITARNA_BUNDLED\s*=\s*'([^']+)'/.exec(fs.readFileSync('js/version.js', 'utf8'));
if (!bundled || bundled[1] !== man.version) fail('js/version.js a version.json musí mít stejnou verzi');

for (const f of man.files) {
  if (f === 'js/config.js') fail('js/config.js se nesmí stahovat (jsou v něm klíče)');
  if (!fs.existsSync(f)) { fail('chybí soubor ' + f); continue; }
  if (f.endsWith('.js')) {
    try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { fail(f + ': ' + e.message); }
  }
}
for (const f of ['js/boot.js', 'js/version.js', 'js/config.js']) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { fail(f + ': ' + e.message); }
}

// televize Samsung z roku 2017 (Tizen 3.0, Chromium 47) neumí CSS proměnné ani ES2015+ zápisy
for (const f of man.files.concat(['js/boot.js'])) {
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (f.endsWith('.css') && /var\(--/.test(src)) fail(f + ': CSS proměnné var(--…) starší televize neumí');
  if (f.endsWith('.js')) {
    if (/=>/.test(src)) fail(f + ': šipkové funkce (=>) starší televize neumí');
    if (/(^|[^.\w])(let|const|class)\s/.test(src)) fail(f + ': let/const/class starší televize neumí');
    if (/`/.test(src)) fail(f + ': šablonové řetězce (`) starší televize neumí');
  }
}

// klíče patří jen do televize, ne do veřejného repozitáře
const cfg = fs.readFileSync('js/config.js', 'utf8');
for (const k of ['tmdbKey', 'omdbKey', 'watchmodeKey', 'motnKey']) {
  const m = new RegExp(k + "\\s*:\\s*'([^']*)'").exec(cfg);
  if (m && m[1]) fail('js/config.js obsahuje vyplněný ' + k + ' – klíč do veřejného repozitáře nepatří');
}

// změnil se kód, ale ne verze → televize by aktualizaci nestáhly
try {
  const changed = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' }).split('\n');
  const prev = JSON.parse(execSync('git show HEAD~1:version.json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  if (man.files.some((f) => changed.includes(f)) && prev.version === man.version) {
    fail('změnily se soubory aplikace, ale verze zůstala ' + man.version + ' – zvyš ji ve version.json i js/version.js');
  }
} catch (e) { /* první commit s version.json */ }

if (!process.exitCode) console.log('Verze ' + man.version + ' je v pořádku.');
