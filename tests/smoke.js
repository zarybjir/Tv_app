// Základní test Videotéky: projde hlavní obrazovky v televizi, v mobilní aplikaci a ve webové verzi.
// Spuštění: node tests/smoke.js   (potřebuje Playwright s Chromiem; nic nestahuje, data jsou smyšlená)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const TITLES = ['Poslední maják', 'Stíny nad Prahou', 'Ledová stopa', 'Odvrácená strana', 'Tichý svědek', 'Hvězdný přístav', 'Noční linka', 'Zlatá horečka',
  'Kód Orion', 'Vlčí hory', 'Pod hladinou', 'Velká loupež', 'Ztracené město', 'Sedmý den', 'Ocelový vítr', 'Dům u řeky', 'Bílá tma', 'Druhý břeh', 'Tiché pole', 'Zimní hra'];
const PROVIDERS = [8, 1899, 337, 119, 1773, 350];

let failed = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ok   ' : '  CHYBA ') + name + (ok || detail === undefined ? '' : ' → ' + JSON.stringify(detail)));
  if (!ok) failed++;
}

function serve() {
  const srv = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)));
}

function list(type, page) {
  return { page, total_pages: 5, results: TITLES.map((t, i) => {
    const id = (type === 'tv' ? 1000 : 0) + (page - 1) * 20 + i;
    return { id, [type === 'tv' ? 'name' : 'title']: t + (page > 1 ? ' ' + page : ''), poster_path: '/p.svg', backdrop_path: '/b.svg', media_type: type,
      overview: 'Krátký český popis.', vote_average: 7.4, original_language: 'cs', [type === 'tv' ? 'first_air_date' : 'release_date']: '2021-03-14' };
  }) };
}

// smyšlené odpovědi zdrojů dat; vrací seznam dotazů na TMDB pro kontroly
async function mock(page, keys) {
  const calls = [];
  await page.route('**/js/config.js*', (r) => r.fulfill({ contentType: 'text/javascript',
    body: 'window.PROMITARNA_CONFIG=' + JSON.stringify(Object.assign({ region: 'CZ', language: 'cs-CZ' }, keys)) + ';' }));
  await page.route('https://raw.githubusercontent.com/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route('https://ntfy.sh/**', (r) => r.abort());
  await page.route('https://www.youtube-nocookie.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.route('https://api.watchmode.com/**', (r) => r.fulfill({ json: ['Netflix', 'HBO Max', 'Disney+', 'Prime Video', 'Apple TV+', 'SkyShowtime'].map((n) => ({ name: n, type: 'sub', region: 'CZ', web_url: 'https://sluzba.example/title/80057281' })) }));
  await page.route('https://www.omdbapi.com/**', (r) => r.fulfill({ json: { Response: 'True', imdbRating: '7.6', imdbVotes: '120,000', Awards: 'Won 2 Oscars.', Ratings: [{ Source: 'Rotten Tomatoes', Value: '88%' }] } }));
  await page.route('https://image.tmdb.org/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="342" height="513" fill="#345"/></svg>' }));
  await page.route('https://api.themoviedb.org/**', (r) => {
    const u = new URL(r.request().url());
    const parts = u.pathname.split('/');
    calls.push(u.pathname + u.search);
    let body;
    if (u.pathname.includes('/watch/providers')) body = { results: { CZ: +parts[3] >= 5000 ? {} : { flatrate: [{ provider_id: PROVIDERS[+parts[3] % 6] }] } } };
    else if (parts[2] === 'person') {
      // 10 titulů ve vybraných službách, 10 mimo ně a jedno vystoupení „sám za sebe", které se nepočítá
      const credit = (id, character) => ({ id, media_type: 'movie', title: 'Film ' + id, poster_path: '/p.svg', vote_average: 7, vote_count: 50, popularity: 100 - (id % 100), release_date: '2015-01-01', character });
      body = { id: +parts[3], name: 'Jana Malá', biography: '', combined_credits: { crew: [],
        cast: [...Array(10).keys()].map((i) => credit(i, 'Role')).concat([...Array(10).keys()].map((i) => credit(5000 + i, 'Role')), [credit(6000, 'Self')]) } };
    }
    else if (u.pathname.includes('/discover/') || u.pathname.includes('/search/')) body = list(u.pathname.includes('/tv') ? 'tv' : 'movie', +(u.searchParams.get('page') || 1));
    else if (u.pathname.includes('/videos')) body = { results: [{ site: 'YouTube', key: 'abc123', type: 'Trailer', iso_639_1: 'en', official: true }] };
    else if (u.pathname.includes('/external_ids')) body = { imdb_id: 'tt' + parts[3] };
    else if (u.pathname.includes('credits')) body = { cast: [{ id: 1, name: 'Jana Malá' }], crew: [{ id: 2, name: 'Karel Veselý', job: 'Director' }] };
    else if (u.pathname.includes('/recommendations')) body = { results: [] };
    else if (parts.length === 4) body = { id: +parts[3], title: 'Titul', overview: u.searchParams.get('language') === 'en-US' ? 'A longer English description of the plot.' : 'Krátký český popis.',
      genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Krimi' }], runtime: 118, production_countries: [{ name: 'Česko' }] };
    else body = { results: [] };
    r.fulfill({ json: body });
  });
  return calls;
}

const rows = (page) => page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('#screen-home .row h2'), (e) => e.firstChild.textContent));
const active = (page) => page.evaluate(() => document.querySelector('.screen.active').id);
const select = (page, fid) => page.evaluate((f) => { const e = document.querySelector('.screen.active [data-fid="' + f + '"]'); if (!e) return false; e._select(); return true; }, fid);

async function tv(browser, base) {
  console.log('Televize');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('promitarna.watchlist', JSON.stringify([{ key: 'movie:9001', id: 9001, type: 'movie', title: 'Titul v seznamu', year: '2020', services: [] }]));
    window.__launched = [];
    window.tizen = { application: { getAppsInfo: (ok) => ok([{ id: 'org.tizen.netflix-app', name: 'Netflix' }]),
      launch: (id, ok) => { window.__launched.push(id); if (ok) ok(); }, getCurrentApplication: () => ({ exit: () => {} }) } };
  });
  const calls = await mock(page, { tmdbKey: 'k', omdbKey: 'k' });
  await page.goto(base + '/index.html');
  await page.waitForTimeout(2500);
  const r = await rows(page);
  check('řádek Služby', r.includes('Služby'), r);
  check('kategorie (Krimi, Komedie, Drama)', ['Krimi', 'Komedie', 'Drama'].every((x) => r.includes(x)), r);
  check('nové řádky (Nejlépe hodnocené, Skryté klenoty, Klasika)', ['Nejlépe hodnocené', 'Skryté klenoty', 'Klasika'].every((x) => r.includes(x)), r);
  // přímá doporučení jsou v testu prázdná – řádek se musí doplnit podle žánrů
  check('Doporučené se doplní i bez přímých doporučení', await page.evaluate(() => document.querySelectorAll('#screen-home .card[data-fid^="rec-"]').length >= 10),
    await page.evaluate(() => document.querySelectorAll('#screen-home .card[data-fid^="rec-"]').length));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  check('ovladač posouvá fokus', await page.evaluate(() => !!document.querySelector('.focus')));

  await select(page, 'cat-krimi-head');
  await page.waitForTimeout(1500);
  check('rozbalená kategorie', await active(page) === 'screen-grid');
  check('řazení a filtry v seznamu', await page.evaluate(() => !!document.querySelector('#screen-grid [data-fid="sort-rating"]') && !!document.querySelector('#screen-grid [data-fid="nav-f-period"]')));
  await select(page, 'sort-rating');
  await page.waitForTimeout(1200);
  check('řazení podle hodnocení posílá dotaz', calls.some((c) => c.includes('vote_average.desc') && c.includes('with_genres=80')));
  const picked = await page.evaluate(() => { const c = document.querySelectorAll('#screen-grid .card')[16]; c.scrollIntoView(); c.click(); return c.getAttribute('data-fid'); });
  await page.waitForTimeout(1500);
  check('detail se žánry', await active(page) === 'screen-detail' && await page.evaluate(() => document.querySelectorAll('#screen-detail .dgenres span').length === 2));
  check('trailer se v televizi nenabízí', await page.evaluate(() => !document.querySelector('[data-fid="d-trailer"]')));
  check('tlačítko Domů v detailu i v seznamu', await page.evaluate(() => !!document.querySelector('#screen-detail [data-fid="nav-home"]') && !!document.querySelector('#screen-grid [data-fid="nav-home"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => document.querySelector('#screen-grid .vscroll').scrollTop);
  check('návrat do seznamu bez posunu na začátek', await active(page) === 'screen-grid' && after > 0, { after });
  check('fokus zůstal na stejném titulu', await page.evaluate(() => { const f = document.querySelector('.focus'); return f && f.getAttribute('data-fid'); }) === picked);
  // ze seznamu do detailu a tlačítkem Domů rovnou na domovskou obrazovku
  await page.evaluate(() => document.querySelectorAll('#screen-grid .card')[2].click());
  await page.waitForTimeout(800);
  await select(page, 'nav-home');
  await page.waitForTimeout(600);
  check('Domů vrací na domovskou obrazovku', await active(page) === 'screen-home');
  await page.keyboard.press('Escape');
  check('po Domů už není kam se vracet', await active(page) === 'screen-home');

  // filtr typu: jen filmy → v řádcích nezůstane žádný seriál
  await select(page, 'nav-f-type');
  await page.waitForTimeout(2500);
  const kinds = await page.evaluate(() => ({ label: document.querySelector('#screen-home [data-fid="nav-f-type"]').textContent,
    movies: document.querySelectorAll('#screen-home .card[data-key^="movie:"]').length, tv: document.querySelectorAll('#screen-home .card[data-key^="tv:"]').length }));
  check('filtr Filmy', kinds.label === 'Filmy' && kinds.movies > 20 && kinds.tv === 0, kinds);
  // stránka herce: vlastní filtr (domovská obrazovka má právě Filmy) a celá tvorba
  await page.evaluate(() => document.querySelector('#screen-home .card[data-key^="movie:"]').click());
  await page.waitForTimeout(1200);
  await select(page, 'p-1');
  await page.waitForTimeout(1500);
  const pcards = () => page.evaluate(() => document.querySelectorAll('#screen-person .card').length);
  check('herec: tituly ve vybraných službách', await active(page) === 'screen-person' && await pcards() === 10, await pcards());
  check('herec: vlastní filtr nepřebírá filtr z domovské obrazovky', await page.evaluate(() => document.querySelector('#screen-person [data-fid="nav-f-type"]').textContent) === 'Typ: vše');
  await select(page, 'scope-all');
  await page.waitForTimeout(1500);
  check('herec: celá tvorba', await pcards() === 20, await pcards());
  await select(page, 'nav-f-period');
  await page.waitForTimeout(1000);
  check('herec: filtr let platí jen pro tuto stránku', await pcards() === 0 && await page.evaluate(() => document.querySelector('#screen-person .gridstatus').textContent) === 'Nic nesplňuje nastavený filtr.');
  await select(page, 'nav-home');
  await page.waitForTimeout(800);
  check('filtr let se nepropsal na domovskou obrazovku', await page.evaluate(() => document.querySelector('#screen-home [data-fid="nav-f-period"]').textContent) === 'Roky: vše');

  await select(page, 'nav-f-type');
  await select(page, 'nav-f-type');
  await page.waitForTimeout(2000);

  await select(page, 'nav-settings');
  await page.waitForTimeout(400);
  for (const t of ['obsah', 'sluzby', 'klice', 'zarizeni', 'aplikace']) {
    await select(page, 'set-tab-' + t);
    await page.waitForTimeout(200);
    check('nastavení: karta ' + t, await page.evaluate(() => document.querySelectorAll('#screen-settings .scard').length > 0));
  }
  check('bez chyb v konzoli', errs.length === 0, errs);
  await page.close();
}

async function android(browser, base) {
  console.log('Mobilní aplikace (Android)');
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    if (!sessionStorage.x) { localStorage.clear(); sessionStorage.x = 1; }
    window.__a = [];
    window.VideotekaAndroid = { getApps: () => JSON.stringify([{ id: 'com.netflix.mediaclient', name: 'Netflix' }]),
      launch: (p) => { window.__a.push('launch ' + p); return true; }, openUrl: (u, p) => { window.__a.push('open ' + u); return true; }, exit: () => window.__a.push('exit') };
  });
  await mock(page, {});
  await page.goto(base + '/index.html');
  await page.waitForTimeout(1200);
  check('bez klíče jen uvítání', await page.evaluate(() => !!document.querySelector('[data-fid="need-keys"]') && document.querySelectorAll('#screen-home .row').length === 1));
  await page.tap('[data-fid="need-keys"]');
  await page.waitForTimeout(400);
  check('uvítání vede na kartu Klíče', await page.evaluate(() => document.querySelectorAll('#screen-settings .scard .minput').length === 4));
  await page.fill('.scard .minput >> nth=0', 'k');
  await page.fill('.scard .minput >> nth=2', 'k');
  await page.tap('[data-fid="set-keys-save"]');
  await page.waitForTimeout(3000);
  const r = await rows(page);
  check('po vložení klíče se zobrazí kategorie', r.includes('Krimi') && r.includes('Služby'), r);
  await page.evaluate(() => document.querySelector('.card[data-fid^="tr-"]').click());
  await page.waitForTimeout(1500);
  check('přepnutí popisu do angličtiny', await page.evaluate(() => !!document.querySelector('[data-fid="d-ovlang"]')));
  check('tlačítko Trailer', await select(page, 'd-trailer'));
  await page.waitForTimeout(300);
  check('trailer se přehrává v aplikaci', await page.evaluate(() => { const f = document.querySelector('.trailer iframe'); return !!f && f.src.includes('/embed/abc123'); }));
  await page.evaluate(() => window.videotekaBack());
  check('Zpět zavře trailer a zůstane v detailu', await page.evaluate(() => !document.querySelector('.trailer')) && await active(page) === 'screen-detail');
  await page.evaluate(() => document.querySelector('#screen-detail .btn.play').click());
  await page.waitForTimeout(500);
  check('přehrání otevře titul ve službě', await page.evaluate(() => window.__a.some((x) => x.indexOf('open https://sluzba.example/title/') === 0)), await page.evaluate(() => window.__a));
  check('tlačítka Zpět a Domů v detailu', await page.evaluate(() => !!document.querySelector('#screen-detail [data-fid="nav-back"]') && !!document.querySelector('#screen-detail [data-fid="nav-home"]')));
  check('bez chyb v konzoli', errs.length === 0, errs);
  await ctx.close();
}

async function web(browser, base) {
  console.log('Webová verze (iPhone)');
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('promitarna.keys', JSON.stringify({ tmdbKey: 'k' }));
    window.__opened = [];
    window.open = (u) => {
      if (u) window.__opened.push(u);
      return { close: () => {}, location: { set href(v) { window.__opened.push(v); } } };
    };
  });
  await mock(page, {});
  await page.goto(base + '/index.html');
  await page.waitForTimeout(2500);
  check('mobilní rozvržení a webový režim', await page.evaluate(() => document.documentElement.className.includes('mobile') && window.PromitarnaUpdate.web === true));
  check('značky pro přidání na plochu', await page.evaluate(() => !!document.querySelector('link[rel="manifest"]') && !!document.querySelector('link[rel="apple-touch-icon"]')));
  const r = await rows(page);
  check('kategorie', r.includes('Krimi'), r);
  await page.evaluate(() => document.querySelector('[data-fid="tile-netflix"]').click());
  check('dlaždice otevře web služby', await page.evaluate(() => window.__opened.includes('https://www.netflix.com/')), await page.evaluate(() => window.__opened));
  await page.evaluate(() => document.querySelector('.card[data-fid^="tr-"]').click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__opened = []; document.querySelector('#screen-detail .btn.play').click(); });
  await page.waitForTimeout(300);
  check('přehrání bez klíče Watchmode otevře službu', await page.evaluate(() => window.__opened.length === 1 && /^https:\/\//.test(window.__opened[0])), await page.evaluate(() => window.__opened));
  check('bez chyb v konzoli', errs.length === 0, errs);
  await ctx.close();
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const only = process.argv[2];
  try {
    if (!only || only === 'tv') await tv(browser, base);
    if (!only || only === 'android') await android(browser, base);
    if (!only || only === 'web') await web(browser, base);
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(failed ? '\nNEPROŠLO: ' + failed : '\nVše prošlo.');
  process.exit(failed ? 1 : 0);
})();
