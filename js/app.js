/* Videotéka – jedna domovská obrazovka pro Netflix, HBO Max, Disney+, Prime Video a Apple TV.
   Psáno v ES2015 bez async/await, aby to běželo na Samsung TV od roku 2018 (Tizen 4+). */
'use strict';
(function () {
  var CFG = window.PROMITARNA_CONFIG || {};
  var LANG = CFG.language || 'cs-CZ';
  var SERVICES = window.SERVICES;
  var IS_TV = typeof window.tizen !== 'undefined' && !!window.tizen.application;
  // mobilní aplikace (Android) dává k dispozici most do systému
  var ANDROID = window.VideotekaAndroid || null;
  var MOBILE = !!ANDROID || (!IS_TV && window.innerWidth < 1100);
  if (MOBILE) {
    document.documentElement.className += ' mobile';
    // index.html je nastavený na televizi (šířka 1920 px); na mobilu použij šířku zařízení
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
  var IMG = 'https://image.tmdb.org/t/p/';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8, RED: 403, GREEN: 404, YELLOW: 405 };

  // ------------------------------------------------------------------ úložiště
  function load(key, def) {
    try { var v = localStorage.getItem('promitarna.' + key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  var KEY_NAMES = ['tmdbKey', 'omdbKey', 'watchmodeKey', 'motnKey'];
  (function () {
    var k = load('keys', {});
    KEY_NAMES.forEach(function (n) { if (k[n]) CFG[n] = k[n]; });
  })();

  // domovská obrazovka se při návratu překreslí jen tehdy, když se změnilo něco, co na ní je
  var homeDirty = true;
  var DIRTY_KEYS = ['watchlist', 'hidden', 'settings', 'keys', 'arrivals'];

  function save(key, val) {
    if (DIRTY_KEYS.indexOf(key) >= 0) homeDirty = true;
    try { localStorage.setItem('promitarna.' + key, JSON.stringify(val)); } catch (e) { /* plné úložiště */ }
  }

  var settings = load('settings', {});   // { netflix: { enabled: true, appId: '...' , appName: '...' } }
  var watchlist = load('watchlist', []); // [{ key, id, type, title, year, poster, services: [] }]
  var installedApps = [];                // [{ id, name }] – jen na televizi

  // katalog, podle kterého se zjišťuje, co kde běží (js/config.js → region)
  var REGION = CFG.region || 'CZ';

  function svcSettings(s) {
    if (!settings[s.id]) settings[s.id] = { enabled: true, appId: null, appName: null };
    return settings[s.id];
  }
  function enabledServices() { return SERVICES.filter(function (s) { return svcSettings(s).enabled; }); }
  function serviceById(id) { return SERVICES.filter(function (s) { return s.id === id; })[0]; }

  // ------------------------------------------------------------------ DOM pomocníci
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
      else if (k === 'onselect') el._select = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function $(id) { return document.getElementById(id); }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function gradient(s) { return 'background: linear-gradient(135deg,' + s.colors[0] + ',' + s.colors[1] + ')'; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3200);
  }

  // ------------------------------------------------------------------ fokus a navigace ovladačem
  var focused = null;

  function setFocus(el) {
    if (!el) return;
    if (focused) focused.classList.remove('focus');
    focused = el;
    el.classList.add('focus');
    if (!MOBILE) ensureVisible(el);
    if (currentScreen) currentScreen.lastFocus = el;
    if (el._focus) el._focus();
  }

  function focusablesIn(root) {
    return Array.prototype.slice.call(root.querySelectorAll('.focusable')).filter(function (el) {
      return el.offsetParent !== null;
    });
  }

  function center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function move(dir) {
    var root = currentScreen.el;
    var all = focusablesIn(root);
    if (!focused || !root.contains(focused)) { setFocus(all[0]); return; }
    var r = focused.getBoundingClientRect(), c = center(r);
    var best = null, bestScore = Infinity;

    if (dir === 'left' || dir === 'right') {
      // nejdřív prvky ve stejném „řádku" (překrývají se svisle)
      all.forEach(function (el) {
        if (el === focused) return;
        var q = el.getBoundingClientRect(), p = center(q);
        var overlap = q.top < r.bottom - 4 && q.bottom > r.top + 4;
        var dx = dir === 'left' ? c.x - p.x : p.x - c.x;
        if (dx <= 1) return;
        var score = dx + (overlap ? 0 : 100000 + Math.abs(p.y - c.y) * 3);
        if (score < bestScore) { bestScore = score; best = el; }
      });
    } else {
      // nejbližší řádek nad/pod a v něm prvek nejblíž vodorovně
      var cands = all.filter(function (el) {
        if (el === focused) return false;
        var q = el.getBoundingClientRect();
        return dir === 'down' ? q.top >= r.bottom - 8 : q.bottom <= r.top + 8;
      });
      if (cands.length) {
        var edge = dir === 'down'
          ? Math.min.apply(null, cands.map(function (el) { return el.getBoundingClientRect().top; }))
          : Math.max.apply(null, cands.map(function (el) { return el.getBoundingClientRect().bottom; }));
        cands.forEach(function (el) {
          var q = el.getBoundingClientRect();
          var inBand = dir === 'down' ? q.top < edge + 60 : q.bottom > edge - 60;
          if (!inBand) return;
          var p = center(q);
          // preferuj prvky, které jsou na obrazovce
          var off = (q.right < 0 || q.left > 1920) ? 5000 : 0;
          var score = Math.abs(p.x - c.x) + off;
          if (score < bestScore) { bestScore = score; best = el; }
        });
      }
    }
    if (best) setFocus(best);
  }

  function ensureVisible(el) {
    var p = el.parentNode;
    while (p && p !== document.body) {
      if (p.classList && p.classList.contains('hscroll')) {
        var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect(), pad = 96;
        if (er.left < pr.left + pad) p.scrollLeft -= (pr.left + pad - er.left);
        else if (er.right > pr.right - pad) p.scrollLeft += (er.right - (pr.right - pad));
      } else if (p.classList && p.classList.contains('vscroll')) {
        // u řádků ukaž celý řádek i s nadpisem
        var target = el, a = el;
        while (a && a !== p) { if (a.classList && a.classList.contains('row')) { target = a; break; } a = a.parentNode; }
        var vr = p.getBoundingClientRect(), ev = target.getBoundingClientRect(), padv = target === el ? 150 : 20;
        if (ev.top < vr.top + padv) p.scrollTop -= (vr.top + padv - ev.top);
        else if (ev.bottom > vr.bottom - padv) p.scrollTop += (ev.bottom - (vr.bottom - padv));
      }
      p = p.parentNode;
    }
  }

  // ------------------------------------------------------------------ obrazovky
  var screens = {};
  var currentScreen = null;
  var history = [];

  function defineScreen(name, render) {
    // index.html patří k instalaci a aktualizace ho nemění – chybějící obrazovku si vytvoř sám
    var el = $('screen-' + name);
    if (!el) {
      el = document.createElement('section');
      el.id = 'screen-' + name;
      el.className = 'screen';
      ($('app') || document.body).appendChild(el);
    }
    screens[name] = { name: name, el: el, render: render, lastFocus: null };
  }

  // ------------------------------------------------------------------ pamatování pozice (posun obrazovky a řádků)
  var homeRestore = null;
  function captureScroll(root) {
    var st = { v: [], h: {} };
    Array.prototype.forEach.call(root.querySelectorAll('.vscroll'), function (v) { st.v.push(v.scrollTop); });
    Array.prototype.forEach.call(root.querySelectorAll('.row[data-row]'), function (r) {
      var hs = r.querySelector('.hscroll');
      if (hs) st.h[r.getAttribute('data-row')] = hs.scrollLeft;
    });
    return st;
  }
  function restoreScroll(root, st) {
    if (!st) return;
    Array.prototype.forEach.call(root.querySelectorAll('.row[data-row]'), function (r) {
      var hs = r.querySelector('.hscroll'), x = st.h[r.getAttribute('data-row')];
      if (hs && x != null) hs.scrollLeft = x;
    });
    Array.prototype.forEach.call(root.querySelectorAll('.vscroll'), function (v, i) { if (st.v[i] != null) v.scrollTop = st.v[i]; });
  }
  // řádky se po překreslení načítají postupně – pozici dorovnávej, dokud uživatel sám nezačne posouvat
  function reapplyHomeScroll() {
    if (homeRestore && homeRestore.active && currentScreen === screens.home) restoreScroll(screens.home.el, homeRestore.st);
  }
  function stopHomeRestore() { if (homeRestore) homeRestore.active = false; }
  ['touchstart', 'wheel', 'mousedown'].forEach(function (ev) { document.addEventListener(ev, stopHomeRestore, true); });

  function reactivate(name, lastFocus) {
    Object.keys(screens).forEach(function (k) { screens[k].el.classList.remove('active'); });
    currentScreen = screens[name];
    currentScreen.el.classList.add('active');
    if (focused) focused.classList.remove('focus');
    focused = null;
    restoreScroll(currentScreen.el, currentScreen.scrollState);
    var el = lastFocus && document.body.contains(lastFocus) ? lastFocus : focusablesIn(currentScreen.el)[0];
    if (el) {
      if (MOBILE) { focused = el; el.classList.add('focus'); currentScreen.lastFocus = el; }
      else setFocus(el);
    }
  }

  function go(name, params, opts) {
    opts = opts || {};
    if (currentScreen) currentScreen.scrollState = captureScroll(currentScreen.el);
    if (currentScreen && !opts.replace) history.push({ name: currentScreen.name, params: currentScreen.params, lastFocus: currentScreen.lastFocus });
    show(name, params, null);
  }

  function show(name, params, restoreFocus) {
    Object.keys(screens).forEach(function (k) { screens[k].el.classList.remove('active'); });
    var s = screens[name];
    s.onKey = null;
    currentScreen = s;
    s.params = params;
    s.el.classList.add('active');
    if (focused) focused.classList.remove('focus');
    focused = null;
    var initial = s.render(s.el, params || {});
    var target = (restoreFocus && document.body.contains(restoreFocus)) ? restoreFocus : initial;
    if (!target || !document.body.contains(target)) target = focusablesIn(s.el)[0];
    setFocus(target);
  }

  function back() {
    if (!history.length) { exitApp(); return; }
    var prev = history.pop();
    if (prev.name === 'search') {
      // hledání se nepřekresluje – zůstanou výsledky i pozice
      reactivate('search', prev.lastFocus);
      Array.prototype.slice.call(currentScreen.el.querySelectorAll('.card[data-key]')).forEach(markHidden);
      return;
    }
    if (prev.name === 'home' && !homeDirty && screens.home.el.firstChild) {
      // nic se nezměnilo – vrať se přesně tam, kde jsi byl
      reactivate('home', prev.lastFocus);
      return;
    }
    var keep = prev.name === 'home' ? screens.home.scrollState : null;
    show(prev.name, prev.params, null); // znovu vykresli (mohl se změnit seznam/nastavení)
    if (keep) {
      homeRestore = { st: keep, active: true };
      setTimeout(function () { if (homeRestore && homeRestore.st === keep) homeRestore.active = false; }, 10000);
      reapplyHomeScroll();
    }
    // obnov fokus na stejný prvek podle data-fid
    var fid = prev.lastFocus && prev.lastFocus.getAttribute('data-fid');
    if (fid) {
      var el = currentScreen.el.querySelector('[data-fid="' + fid + '"]');
      if (el) setFocus(el);
      else currentScreen.pendingFid = fid; // řádek se ještě načítá
    }
  }

  function exitApp() {
    if (ANDROID) { ANDROID.exit(); return; }
    if (IS_TV) {
      try { window.tizen.application.getCurrentApplication().exit(); } catch (e) { /* nic */ }
    } else {
      toast('V televizi by se teď aplikace zavřela.');
    }
  }

  // ------------------------------------------------------------------ TMDB
  var cache = {};
  function tmdb(path, params) {
    if (!CFG.tmdbKey) return Promise.reject(new Error('NO_KEY'));
    params = params || {};
    if (!params.language) params.language = LANG;
    var headers = {};
    if (CFG.tmdbKey.length > 40) headers.Authorization = 'Bearer ' + CFG.tmdbKey;
    else params.api_key = CFG.tmdbKey;
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var url = 'https://api.themoviedb.org/3' + path + '?' + qs;
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url, { headers: headers }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { cache[url] = j; return j; });
  }

  function normalize(r, type) {
    type = type || r.media_type;
    return {
      key: type + ':' + r.id,
      id: r.id,
      type: type,
      title: r.title || r.name || '',
      year: (r.release_date || r.first_air_date || '').slice(0, 4),
      poster: r.poster_path || null,
      backdrop: r.backdrop_path || null,
      overview: r.overview || '',
      vote: r.vote_average || 0,
      lang: r.original_language || ''
    };
  }

  // ------------------------------------------------------------------ kategorie
  // movie/tv = žánry TMDB (oddělené | znamená „nebo"), null = typ v kategorii není
  var CATEGORIES = [
    { id: 'krimi', name: 'Krimi', movie: '80', tv: '80', mg: 'crime', on: true },
    { id: 'thriller', name: 'Thrillery a záhady', movie: '53|9648', tv: '9648', mg: 'thriller,mystery', mgRel: 'or', on: true },
    { id: 'fantasy', name: 'Fantasy', movie: '14', tv: '10765', mg: 'fantasy', on: true },
    { id: 'scifi', name: 'Sci-fi', movie: '878', tv: '10765', mg: 'scifi', on: true },
    { id: 'akcni', name: 'Akční', movie: '28', tv: '10759', mg: 'action', on: true },
    { id: 'komedie', name: 'Komedie', movie: '35', tv: '35', mg: 'comedy', on: true },
    { id: 'drama', name: 'Drama', movie: '18', tv: '18', mg: 'drama', on: true },
    { id: 'dobrodruzne', name: 'Dobrodružné', movie: '12', tv: '10759', mg: 'adventure', on: false },
    { id: 'horor', name: 'Horory', movie: '27', tv: null, mg: 'horror', on: false },
    { id: 'romanticke', name: 'Romantické', movie: '10749', tv: null, mg: 'romance', on: false },
    { id: 'animovane', name: 'Animované', movie: '16', tv: '16', mg: 'animation', on: true },
    { id: 'rodinne', name: 'Rodinné a pro děti', movie: '10751', tv: '10751|10762', mg: 'family', on: false },
    { id: 'dokumenty', name: 'Dokumenty', movie: '99', tv: '99', mg: 'documentary', on: true },
    // podkategorie dokumentů: žánry spojené čárkou musí platit všechny, kw = klíčové slovo v TMDB
    { id: 'dok-priroda', parent: 'dokumenty', short: 'Příroda a zvířata', name: 'Dokumenty: příroda a zvířata', movie: '99', tv: '99', kw: 'nature', mg: 'documentary', on: true },
    { id: 'dok-krimi', parent: 'dokumenty', short: 'Skutečné zločiny', name: 'Dokumenty: skutečné zločiny', movie: '99,80', tv: '99,80', mg: 'documentary,crime', mgRel: 'and', on: true },
    { id: 'dok-historie', parent: 'dokumenty', short: 'Historie', name: 'Dokumenty: historie', movie: '99,36', tv: '99,10768', mg: 'documentary,history', mgRel: 'and', on: true },
    { id: 'dok-valka', parent: 'dokumenty', short: 'Válka', name: 'Dokumenty: válka', movie: '99,10752', tv: '99,10768', mg: 'documentary,war', mgRel: 'and', on: false },
    { id: 'dok-veda', parent: 'dokumenty', short: 'Věda a vesmír', name: 'Dokumenty: věda a vesmír', movie: '99', tv: '99', kw: 'science', mg: 'documentary', on: true },
    { id: 'dok-sport', parent: 'dokumenty', short: 'Sport', name: 'Dokumenty: sport', movie: '99', tv: '99', kw: 'sports', mg: 'documentary', on: false },
    { id: 'dok-hudba', parent: 'dokumenty', short: 'Hudba', name: 'Dokumenty: hudba', movie: '99,10402', tv: null, mg: 'documentary,music', mgRel: 'and', on: false },
    { id: 'historicke', name: 'Válečné a historické', movie: '10752|36', tv: '10768', mg: 'war,history', mgRel: 'or', on: false },
    { id: 'reality', name: 'Reality show', movie: null, tv: '10764', mg: 'reality', on: false },
    { id: 'westerny', name: 'Westerny', movie: '37', tv: '37', mg: 'western', on: false }
  ];

  function content() {
    var c = settings._content;
    if (!c) c = settings._content = { series: true, movies: true, trending: true, byService: false, cats: {} };
    if (c.newest === undefined) c.newest = true;
    CATEGORIES.forEach(function (cat) { if (c.cats[cat.id] === undefined) c.cats[cat.id] = cat.on; });
    return c;
  }
  function typesLabel(cat) {
    var c = content(), t = [];
    if (c.series && (!cat || cat.tv)) t.push('seriály');
    if (c.movies && (!cat || cat.movie)) t.push('filmy');
    return t.join(' a ');
  }
  function allProviders() {
    var out = [];
    enabledServices().forEach(function (s) { out = out.concat(s.providers); });
    return out;
  }

  // opts: { providers: [...], movie: 'žánry'|''|null, tv: 'žánry'|''|null }
  // ID poskytovatelů v TMDB podle jména – služby s `providerMatch` si je doplní samy
  function resolveProviders(done) {
    var need = SERVICES.some(function (sv) { return sv.providerMatch; });
    if (!need || !CFG.tmdbKey) { done(); return; }
    function apply(list) {
      SERVICES.forEach(function (sv) {
        if (!sv.providerMatch) return;
        list.forEach(function (pv) {
          if (sv.providerMatch.test(pv.n) && sv.providers.indexOf(pv.id) < 0) sv.providers.push(pv.id);
        });
      });
    }
    var cached = load('provcache', null);
    if (cached && cached.region === REGION && Date.now() - cached.t < 7 * DAY) { apply(cached.list); done(); return; }
    var finished = false;
    var fin = function () { if (!finished) { finished = true; done(); } };
    setTimeout(fin, 3500);
    Promise.all([tmdb('/watch/providers/movie', { watch_region: REGION }), tmdb('/watch/providers/tv', { watch_region: REGION })]).then(function (r) {
      var list = [];
      r.forEach(function (x) { (x.results || []).forEach(function (pv) { list.push({ id: pv.provider_id, n: pv.provider_name }); }); });
      save('provcache', { t: Date.now(), region: REGION, list: list });
      apply(list);
    }).catch(function () {}).then(fin);
  }

  // klíčové slovo TMDB (např. „nature") → jeho číslo, pamatuje se v zařízení
  var kwCache = load('kwcache', {});
  function keywordId(kw) {
    if (kwCache[kw]) return Promise.resolve(kwCache[kw]);
    return tmdb('/search/keyword', { query: kw }).then(function (j) {
      var list = j.results || [];
      var hit = list.filter(function (r) { return (r.name || '').toLowerCase() === kw; })[0] || list[0];
      if (hit) { kwCache[kw] = hit.id; save('kwcache', kwCache); return hit.id; }
      return null;
    }).catch(function () { return null; });
  }

  function discover(opts) {
    if (opts.changes) return changesDiscover(opts);
    if (filt().cz === 'dub' && CFG.motnKey) return motnDiscover(opts);
    if (opts.kw && !opts.kwId) {
      return keywordId(opts.kw).then(function (id) { return discover(Object.assign({}, opts, { kwId: id || -1 })); });
    }
    var c = content();
    var p = {
      watch_region: REGION,
      with_watch_providers: opts.providers.join('|'),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc'
    };
    if (filt().cz === 'cs') p.with_original_language = 'cs';
    var pg = opts.page || 1;
    var pages = [pg];
    if (filterActive()) {
      // s filtrem stáhni víc titulů a předfiltruj podle TMDB, ať zbyde dost kvalitních
      pages = [2 * pg - 1, 2 * pg];
      p['vote_count.gte'] = 50;
      if (filt().imdb) p['vote_average.gte'] = Math.max(0, filt().imdb - 1.5);
    }
    var wantMovie = c.movies && opts.movie !== null;
    var wantTv = c.series && opts.tv !== null;
    var reqs = [];
    pages.forEach(function (n) {
      var mp = Object.assign({}, p, { page: n }), tp = Object.assign({}, p, { page: n });
      if (opts.movie) mp.with_genres = opts.movie;
      if (opts.tv) tp.with_genres = opts.tv;
      if (opts.kwId > 0) { mp.with_keywords = opts.kwId; tp.with_keywords = opts.kwId; }
      if (opts.extraMovie) Object.assign(mp, opts.extraMovie);
      if (opts.extraTv) Object.assign(tp, opts.extraTv);
      reqs.push(wantMovie ? tmdb('/discover/movie', mp) : Promise.resolve({ results: [] }));
      reqs.push(wantTv ? tmdb('/discover/tv', tp) : Promise.resolve({ results: [] }));
    });
    return Promise.all(reqs).then(function (res) {
      var m = [], t = [], out = [];
      res.forEach(function (r, i) { (i % 2 ? t : m).push.apply(i % 2 ? t : m, r.results || []); });
      for (var i = 0; i < Math.max(m.length, t.length); i++) {
        if (t[i]) out.push(normalize(t[i], 'tv'));
        if (m[i]) out.push(normalize(m[i], 'movie'));
      }
      return out;
    });
  }

  // ------------------------------------------------------------------ český dabing (Movie of the Night / Streaming Availability)
  // Bezplatný plán má 1000 dotazů měsíčně: řádky se pamatují 3 dny, údaje o titulu 30 dní.
  var MOTN = 'https://api.movieofthenight.com/v4';
  var MOTN_LIMIT = 950;
  var dubCache = load('dub', {});        // { 'movie:123': { t, by: { netflix: { a: 1, s: 1 } } } }
  var motnRows = load('motnrows', {});   // { url: { t, keys: [...], next } }
  var motnUsage = load('motnUsage', { m: '', n: 0 });
  var motnCursors = {};
  var dubSaveTimer = null;

  function motnCount() {
    var m = new Date().toISOString().slice(0, 7);
    if (motnUsage.m !== m) motnUsage = { m: m, n: 0 };
    return motnUsage;
  }
  function motn(path, params) {
    if (!CFG.motnKey) return Promise.reject(new Error('NO_MOTN'));
    var u = motnCount();
    if (u.n >= MOTN_LIMIT) return Promise.reject(new Error('MOTN_LIMIT'));
    u.n++;
    save('motnUsage', u);
    var qs = Object.keys(params || {}).filter(function (k) { return params[k] != null && params[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(MOTN + path + (qs ? '?' + qs : ''), { headers: { 'X-API-Key': CFG.motnKey } }).then(function (r) {
      if (r.status === 429) { u.n = MOTN_LIMIT; save('motnUsage', u); throw new Error('MOTN_LIMIT'); }
      if (!r.ok) throw new Error('Movie of the Night HTTP ' + r.status);
      return r.json();
    });
  }
  function saveDubSoon() {
    clearTimeout(dubSaveTimer);
    dubSaveTimer = setTimeout(function () {
      var keys = Object.keys(dubCache);
      if (keys.length > 4000) {
        keys.sort(function (a, b) { return dubCache[a].t - dubCache[b].t; });
        keys.slice(0, keys.length - 3000).forEach(function (k) { delete dubCache[k]; });
      }
      save('dub', dubCache);
    }, 1500);
  }
  function keyOfTmdb(t) { var p = String(t || '').split('/'); return p.length === 2 ? (p[0] === 'tv' ? 'tv' : 'movie') + ':' + p[1] : null; }
  function storeDub(show) {
    var key = keyOfTmdb(show.tmdbId);
    if (!key) return null;
    var by = {};
    ((show.streamingOptions || {})[REGION.toLowerCase()] || []).forEach(function (o) {
      if (['subscription', 'free'].indexOf(o.type) < 0 || !o.service) return;
      var e = by[o.service.id] || (by[o.service.id] = { a: 0, s: 0 });
      if (o.expiresOn) e.x = e.x ? Math.min(e.x, o.expiresOn) : o.expiresOn;
      if ((o.audios || []).some(function (x) { return x.language === 'ces'; })) e.a = 1;
      if ((o.subtitles || []).some(function (x) { return x.locale && x.locale.language === 'ces'; })) e.s = 1;
    });
    dubCache[key] = { t: Date.now(), by: by };
    saveDubSoon();
    return key;
  }
  function hasCzDub(key) {
    var d = dubCache[key];
    if (!d) return null;
    return enabledServices().some(function (sv) { return d.by[sv.id] && d.by[sv.id].a; });
  }
  // datum (unix s), kdy titul odchází z tvých služeb – jen pokud odchází ze všech, kde běží
  function leavingTs(key) {
    var d = dubCache[key];
    if (!d) return null;
    var mine = enabledServices().filter(function (sv) { return d.by[sv.id]; });
    if (!mine.length || mine.some(function (sv) { return !d.by[sv.id].x; })) return null;
    var ts = Math.max.apply(null, mine.map(function (sv) { return d.by[sv.id].x; }));
    var now = Date.now() / 1000;
    return ts > now && ts - now < 45 * 86400 ? ts : null;
  }
  // když dorazí nová data o odchodech, doplň štítky a upozornění na hlavní stránce
  function updateLeavingUI() {
    var root = screens.home && screens.home.el;
    if (!root || !root.firstChild) return;
    Array.prototype.forEach.call(root.querySelectorAll('.card[data-key]'), function (c) {
      var lv = leavingTs(c.getAttribute('data-key'));
      if (lv && !c.querySelector('.leavetag')) {
        var at = c.querySelector('.addtag');
        if (at) at.parentNode.removeChild(at);
        c.querySelector('.poster').appendChild(h('div', { class: 'leavetag', text: 'odchází ' + fmtTs(lv) }));
      }
    });
    var leavingWl = watchlist.filter(function (w) { return leavingTs(w.key); });
    var banner = root.querySelector('.leavebanner');
    if (!leavingWl.length) { if (banner) banner.parentNode.removeChild(banner); return; }
    var nb = leavingBanner(leavingWl);
    if (banner) banner.parentNode.replaceChild(nb, banner);
    else {
      var first = root.querySelector('.vscroll .row');
      if (first) first.parentNode.insertBefore(nb, first);
    }
  }
  function leavingBanner(list) {
    return h('div', { class: 'banner leavebanner' }, ['Z tvého seznamu brzy odchází: ',
      h('b', { text: list.map(function (w) { return w.title + ' (' + fmtTs(leavingTs(w.key)) + ')'; }).join(', ') })]);
  }
  function titulu(n) { return n + (n === 1 ? ' titul' : n >= 2 && n <= 4 ? ' tituly' : ' titulů'); }
  function fmtTs(ts) { var d = new Date(ts * 1000); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; }

  // ----- změny katalogu: nové, odchází, přibude (Movie of the Night /changes)
  var motnChanges = load('motnch', {});
  function changesPage(type, pg) {
    var cats = enabledServices().map(function (sv) { return sv.id + '.subscription'; }).join(',');
    var params = { country: REGION.toLowerCase(), change_type: type, item_type: 'show', catalogs: cats, order_direction: type === 'new' ? 'desc' : 'asc' };
    var base = type + '|' + cats;
    if (pg > 1) {
      var cur = (motnCursors[base] || {})[pg];
      if (!cur) return Promise.resolve({ entries: [], next: null });
      params.cursor = cur;
    }
    var cached = pg === 1 && motnChanges[base];
    var get = cached && Date.now() - cached.t < 12 * 3600 * 1000 ? Promise.resolve(cached) :
      motn('/changes', params).then(function (j) {
        var seen = {}, entries = [];
        (j.changes || []).forEach(function (c) {
          var sh = (j.shows || {})[c.showId];
          if (!sh) return;
          var key = storeDub(sh);
          if (!key || seen[key]) return;
          seen[key] = 1;
          entries.push({ key: key, ts: c.timestamp || 0, svc: c.service && c.service.id });
        });
        setTimeout(updateLeavingUI, 0);
        var e = { t: Date.now(), entries: entries, next: j.hasMore ? j.nextCursor : null };
        if (pg === 1) { motnChanges[base] = e; save('motnch', motnChanges); }
        return e;
      });
    return get.then(function (e) { (motnCursors[base] = motnCursors[base] || {})[pg + 1] = e.next; return e; });
  }
  function entriesToItems(entries) {
    var c = content();
    return Promise.all(entries.map(function (en) {
      var t = en.key.split(':');
      if ((t[0] === 'tv' && !c.series) || (t[0] === 'movie' && !c.movies)) return null;
      if (filt().cz === 'dub' && !hasCzDub(en.key)) return null;
      return tmdb('/' + t[0] + '/' + t[1]).then(function (d) {
        var it = normalize(d, t[0]);
        it.change = en;
        return it;
      }, function () { return null; });
    })).then(function (list) { return list.filter(Boolean); });
  }
  function changesDiscover(opts) {
    return changesPage(opts.changes, opts.page || 1).then(function (e) {
      return entriesToItems(e.entries).then(function (items) {
        if (!items.length && e.next) items.more = true;
        return items;
      });
    });
  }

  function dubFor(item) {
    var d = dubCache[item.key];
    if (d && Date.now() - d.t < 30 * DAY) return Promise.resolve(d);
    return motn('/shows/' + item.type + '/' + item.id, { country: REGION.toLowerCase() }).then(function (show) {
      storeDub(show);
      return dubCache[item.key] || null;
    });
  }

  // řádek v režimu „Český dabing": seznam z Movie of the Night, české názvy a plakáty z TMDB
  function motnDiscover(opts) {
    var c = content();
    var services = (opts.services || enabledServices().map(function (sv) { return sv.id; }));
    var params = {
      country: REGION.toLowerCase(),
      catalogs: services.join(','),
      order_by: opts.mOrder || 'popularity_1month',
      order_direction: opts.mOrder === 'release_date' ? 'desc' : null,
      genres: opts.mg || null,
      genres_relation: opts.mgRel || null,
      show_type: c.series && !c.movies ? 'series' : (c.movies && !c.series ? 'movie' : null)
    };
    if (opts.movie === null && opts.tv) params.show_type = 'series';
    if (opts.tv === null && opts.movie) params.show_type = 'movie';
    var base = JSON.stringify(params);
    var pg = opts.page || 1;
    var cursor = null;
    if (pg > 1) {
      cursor = (motnCursors[base] || {})[pg];
      if (!cursor) return Promise.resolve([]);
    }
    var cacheKey = base + '#' + pg;
    var cached = motnRows[cacheKey];
    var get = (cached && Date.now() - cached.t < 3 * DAY) ? Promise.resolve(cached) :
      motn('/shows/search/filters', Object.assign({}, params, { cursor: cursor })).then(function (j) {
        var keys = (j.shows || []).map(storeDub).filter(Boolean);
        var entry = { t: Date.now(), keys: keys, next: j.hasMore ? j.nextCursor : null };
        if (pg === 1) {
          motnRows[cacheKey] = entry;
          var rk = Object.keys(motnRows);
          if (rk.length > 120) { rk.sort(function (a, b) { return motnRows[a].t - motnRows[b].t; }); rk.slice(0, rk.length - 100).forEach(function (k) { delete motnRows[k]; }); }
          save('motnrows', motnRows);
        }
        return entry;
      });
    return get.then(function (entry) {
      (motnCursors[base] = motnCursors[base] || {})[pg + 1] = entry.next;
      var keys = entry.keys.filter(function (k) { return hasCzDub(k); });
      // pokud jsou všechny na stránce bez dabingu, vrať aspoň prázdnou stránku s odkazem na další
      return Promise.all(keys.map(function (k) {
        var t = k.split(':');
        return tmdb('/' + t[0] + '/' + t[1]).then(function (d) { return normalize(d, t[0]); }, function () { return null; });
      })).then(function (items) {
        items = items.filter(Boolean);
        if (!items.length && entry.next) items.more = true;
        return items;
      });
    });
  }

  // ------------------------------------------------------------------ hodnocení IMDb / Rotten Tomatoes (OMDb)
  var DAY = 86400000;
  var ratingCache = load('ratings', {}); // { 'movie:123': { t, id, imdb, votes, rt, mc } }
  var ratingPending = {};
  var omdbBlocked = null;
  var ratingSaveTimer = null;

  function hasRatingsSource() { return !!CFG.omdbKey && !!CFG.tmdbKey; }

  function saveRatingsSoon() {
    clearTimeout(ratingSaveTimer);
    ratingSaveTimer = setTimeout(function () {
      var keys = Object.keys(ratingCache);
      if (keys.length > 3000) {
        keys.sort(function (a, b) { return ratingCache[a].t - ratingCache[b].t; });
        keys.slice(0, keys.length - 2500).forEach(function (k) { delete ratingCache[k]; });
      }
      save('ratings', ratingCache);
    }, 1500);
  }

  // max. 4 dotazy najednou, ať televize i OMDb stíhají
  var rqueue = [], ractive = 0;
  function enqueue(task) {
    return new Promise(function (res, rej) { rqueue.push({ task: task, res: res, rej: rej }); pump(); });
  }
  function pump() {
    while (ractive < 4 && rqueue.length) {
      (function (job) {
        ractive++;
        job.task().then(job.res, job.rej).then(function () { ractive--; pump(); });
      })(rqueue.shift());
    }
  }

  function cachedRatings(item) {
    var c = ratingCache[item.key];
    if (!c) return null;
    var ttl = (c.imdb != null || c.rt != null) ? 7 * DAY : 2 * DAY;
    return (Date.now() - c.t < ttl) ? c : null;
  }

  function parseOmdb(j, imdbId) {
    var num = function (v) { var n = parseFloat(String(v || '').replace(/,/g, '')); return isNaN(n) ? null : n; };
    var rt = null, mc = null;
    (j.Ratings || []).forEach(function (r) {
      if (r.Source === 'Rotten Tomatoes') rt = num(r.Value);
      if (r.Source === 'Metacritic') mc = num(r.Value);
    });
    return { t: Date.now(), id: imdbId, imdb: num(j.imdbRating), votes: num(j.imdbVotes), rt: rt, mc: mc };
  }

  function blockOmdb(msg) {
    if (omdbBlocked) return;
    omdbBlocked = /limit/i.test(msg)
      ? 'Došel denní limit OMDb (1000 dotazů). Další hodnocení se doplní zítra.'
      : 'OMDb klíč nefunguje (' + msg + ').';
    toast(omdbBlocked);
  }

  function ratingsFor(item) {
    var c = cachedRatings(item);
    if (c) return Promise.resolve(c);
    if (!hasRatingsSource() || omdbBlocked) return Promise.resolve(ratingCache[item.key] || null);
    if (ratingPending[item.key]) return ratingPending[item.key];
    var p = enqueue(function () {
      if (omdbBlocked) return Promise.resolve(null);
      return tmdb('/' + item.type + '/' + item.id + '/external_ids', { language: 'en-US' }).then(function (ext) {
        if (!ext.imdb_id) return { t: Date.now(), id: null, imdb: null, votes: null, rt: null, mc: null };
        return fetch('https://www.omdbapi.com/?i=' + encodeURIComponent(ext.imdb_id) + '&apikey=' + encodeURIComponent(CFG.omdbKey))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (j.Response === 'False') {
              if (/limit|key|unauthori/i.test(j.Error || '')) { blockOmdb(j.Error); return null; }
              return { t: Date.now(), id: ext.imdb_id, imdb: null, votes: null, rt: null, mc: null };
            }
            return parseOmdb(j, ext.imdb_id);
          });
      });
    }).then(function (r) {
      delete ratingPending[item.key];
      if (r) { ratingCache[item.key] = r; saveRatingsSoon(); }
      return r || ratingCache[item.key] || null;
    }, function () {
      delete ratingPending[item.key];
      return ratingCache[item.key] || null;
    });
    ratingPending[item.key] = p;
    return p;
  }

  // ------------------------------------------------------------------ filtr podle hodnocení
  var IMDB_STEPS = [0, 6, 6.5, 7, 7.5, 8];
  var RT_STEPS = [0, 60, 75, 90];

  function filt() {
    if (!settings._filter) settings._filter = { imdb: 0, rt: 0 };
    return settings._filter;
  }
  function filterActive() { var f = filt(); return hasRatingsSource() && (f.imdb > 0 || f.rt > 0); }
  // jakýkoli filtr včetně jazyka (česká tvorba)
  function anyFilter() { return filterActive() || filt().cz === 'cs' || (filt().cz === 'dub' && !!CFG.motnKey); }
  function passes(r) {
    if (omdbBlocked) return true; // bez dat nic neschovávej
    var f = filt();
    if (!r) return false;
    if (f.imdb && !(r.imdb >= f.imdb)) return false;
    if (f.rt && !(r.rt >= f.rt)) return false;
    return true;
  }
  function dec(x, digits) { return (digits ? x.toFixed(digits) : String(x)).replace('.', ','); }
  function filterLabel() {
    var f = filt(), parts = [];
    if (f.imdb) parts.push('IMDb ' + dec(f.imdb) + '+');
    if (f.rt) parts.push('RT ' + f.rt + ' %+');
    if (f.cz === 'cs') parts.push('česká tvorba');
    if (f.cz === 'dub') parts.push('český dabing');
    return parts.join(' a ');
  }
  // vrátí { items, hidden } – s aktivním filtrem počká na hodnocení všech titulů
  function applyFilter(items) {
    var total = items.length;
    if (filt().cz === 'cs') items = items.filter(function (it) { return it.lang === 'cs'; });
    if (!filterActive()) return Promise.resolve({ items: items, hidden: total - items.length });
    return Promise.all(items.map(ratingsFor)).then(function (rs) {
      var kept = items.filter(function (it, i) { return passes(rs[i]); });
      return { items: kept, hidden: total - kept.length };
    });
  }

  function ratingChips(r) {
    var out = [];
    if (r && r.imdb != null) out.push(h('span', { class: 'rchip imdb', text: 'IMDb ' + dec(r.imdb, 1) }));
    if (r && r.rt != null) out.push(h('span', { class: 'rchip ' + (r.rt >= 60 ? 'rt-fresh' : 'rt-rotten'), text: 'RT ' + r.rt + ' %' }));
    return out;
  }
  function fillRatings(cardEl, item) {
    ratingsFor(item).then(function (r) {
      var bar = cardEl.querySelector('.rbar');
      if (!bar) return;
      clear(bar);
      ratingChips(r).forEach(function (c) { bar.appendChild(c); });
    });
  }

  function errorText(err) {
    if (err && err.message === 'MOTN_LIMIT') return 'Došel měsíční limit dotazů na český dabing (Movie of the Night). Vypni filtr Český dabing, od 1. dne v měsíci zase pojede.';
    if (err && err.message === 'NO_MOTN') return 'Pro filtr Český dabing chybí klíč Movie of the Night.';
    if (err && err.message === 'NO_KEY') return MOBILE ? 'Pro tipy a hledání vlož v Nastavení → Klíče klíč TMDB.' : 'Chybí klíč TMDB. Nejsnáz ho pošleš z mobilní Videotéky: Nastavení → Telefon jako ovladač a naskenuj QR kód.';
    return 'Nepodařilo se načíst data (' + (err && err.message || 'chyba sítě') + ').';
  }

  // ------------------------------------------------------------------ spouštění aplikací v TV
  function detectApps(done) {
    if (ANDROID) {
      try {
        installedApps = JSON.parse(ANDROID.getApps()).sort(function (a, b) { return a.name.localeCompare(b.name); });
      } catch (e) { installedApps = []; }
      done();
      return;
    }
    if (!IS_TV) { done(); return; }
    try {
      window.tizen.application.getAppsInfo(function (list) {
        installedApps = list.map(function (a) { return { id: a.id, name: a.name }; })
          .filter(function (a) { return a.name; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); });
        done();
      }, function () { done(); });
    } catch (e) { done(); }
  }

  function detectedApp(service) {
    return installedApps.filter(function (a) { return service.match.test(a.name); })[0] || null;
  }

  function candidateIds(service) {
    var ids = [], st = svcSettings(service), d = detectedApp(service);
    if (st.appId) ids.push(st.appId);
    if (d) ids.push(d.id);
    service.appIds.forEach(function (id) { ids.push(id); });
    return ids.filter(function (id, i) { return ids.indexOf(id) === i; });
  }

  // balíček služby na Androidu, který je v telefonu nainstalovaný
  function androidPackage(service) {
    var st = svcSettings(service), d = detectedApp(service);
    if (st.appId) return st.appId;
    if (d) return d.id;
    return (service.android || []).filter(function (p) { return installedApps.some(function (a) { return a.id === p; }); })[0] || null;
  }

  function launchService(service, hint) {
    if (ANDROID) {
      var pkg = androidPackage(service);
      if (pkg && ANDROID.launch(pkg)) return;
      toast(service.name + ' v telefonu není – otevírám Google Play.');
      ANDROID.openUrl('https://play.google.com/store/apps/details?id=' + ((service.android || [])[0] || ''), '');
      return;
    }
    if (!IS_TV) { toast('V televizi by se teď spustila aplikace ' + service.name + '.'); return; }
    var ids = candidateIds(service), i = 0, errs = [];
    var mode = launchMode(service);
    toast(hint || 'Spouštím ' + service.name + '…');
    function fail(id, e) { errs.push(id + ': ' + ((e && (e.name || e.message)) || 'chyba')); tryNext(); }
    function ok() { if (hint) toast(hint); afterLaunch(); }
    function tryNext() {
      if (i >= ids.length) {
        toast('Aplikaci ' + service.name + ' se nepodařilo spustit – ' + errs.join(', '));
        return;
      }
      var id = ids[i++];
      try {
        if (mode === 'hide') {
          // Videotéku nejdřív schovej, ať spuštěná aplikace dostane obrazovku i fokus
          try { window.tizen.application.getCurrentApplication().hide(); } catch (e2) { /* nic */ }
          setTimeout(function () { window.tizen.application.launch(id, ok, function (e) { fail(id, e); }); }, 400);
        } else if (mode === 'plain') window.tizen.application.launch(id, ok, function (e) { fail(id, e); });
        else window.tizen.application.launchAppControl(launchControl(mode), id, ok, function (e) { fail(id, e); }, null);
      } catch (e) { fail(id, e); }
    }
    tryNext();
  }

  // Stará televize má málo paměti: Netflix apod. se nemusí rozběhnout, když Videotéka
  // zůstane běžet na pozadí. Po spuštění služby se proto Videotéka zavře.
  function closeAfterLaunch() { return IS_TV && settings._closeAfter !== false; }
  function afterLaunch() {
    if (!closeAfterLaunch()) return;
    if (pendingFeedback) {
      save('pendingFb', { s: pendingFeedback.service.id, m: pendingFeedback.method, item: pendingFeedback.item, t: Date.now() });
    }
    setTimeout(function () {
      try { window.tizen.application.getCurrentApplication().exit(); } catch (e) { /* nic */ }
    }, 5000);
  }

  // Způsob spuštění aplikace služby (kdyby některá služba potřebovala jiný).
  // Netflix je na Samsungu systémová aplikace org.tizen.netflix-app.
  var LAUNCH_MODES = ['plain', 'control', 'payload', 'hide'];
  var LAUNCH_DEFAULT = { hbo: 'hide' };
  var LAUNCH_LABEL = { plain: 'způsob 1', control: 'způsob 2', payload: 'způsob 3', hide: 'způsob 4' };
  function launchMode(service) {
    var m = svcSettings(service).launchMode;
    return LAUNCH_MODES.indexOf(m) >= 0 ? m : (LAUNCH_DEFAULT[service.id] || 'plain');
  }
  function launchControl(mode) {
    var T = window.tizen;
    var data = [];
    if (mode === 'payload') {
      var payload = JSON.stringify({ values: JSON.stringify({ moduleName: 'common', query: 'source_type=12' }) });
      data = [new T.ApplicationControlData('PAYLOAD', [payload])];
    }
    return new T.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
  }

  // ------------------------------------------------------------------ skok rovnou na titul
  // Samsung nezveřejňuje, jaká data aplikace služeb přijímají, proto jsou tu tři způsoby.
  // Po návratu z aplikace se Videotéka zeptá, jestli se otevřel titul, a podle odpovědi
  // si zapamatuje fungující způsob, nebo zkusí další.
  var DEEP_METHODS = ['view', 'payload', 'payload-json'];
  // Netflix (systémová aplikace Samsungu) čte PAYLOAD = {"values": "m=<id>&…"} jako dlaždice Smart Hubu
  var NF_METHODS = ['nf-plain', 'nf-mdp', 'payload-json'];
  var DEEP_DEFAULT = { netflix: 'nf-plain' };
  function deepMethodsFor(service) { return service.id === 'netflix' ? NF_METHODS : DEEP_METHODS; }
  var DEEP_LABEL = { auto: 'automaticky', view: 'způsob 1', payload: 'způsob 2', 'payload-json': 'způsob 3', off: 'vypnuto',
    'nf-plain': 'způsob 1', 'nf-mdp': 'způsob 2' };
  var linkCache = load('links', {}); // { 'movie:123': { t, links: { netflix: { CZ: url } } } }
  var pendingFeedback = null;

  function deepMethod(service) {
    var st = svcSettings(service), list = deepMethodsFor(service);
    // u Netflixu přešly nové formáty – starší uložená volba z jiného seznamu se nepoužije
    if (st.deep && st.deep !== 'auto' && (st.deep === 'off' || list.indexOf(st.deep) >= 0)) return st.deep;
    if (st.deepOk && list.indexOf(st.deepOk) >= 0) return st.deepOk;
    if (IS_TV) return 'off'; // starší televize Samsung odkazy na titul nepřijímají – zapíná se ručně v Nastavení
    return DEEP_DEFAULT[service.id] || list[0];
  }

  function titleLinks(item) {
    var c = linkCache[item.key];
    if (c && Date.now() - c.t < 30 * DAY) return Promise.resolve(c.links);
    if (!CFG.watchmodeKey) return Promise.resolve(null);
    var url = 'https://api.watchmode.com/v1/title/' + item.type + '-' + item.id + '/sources/?apiKey=' + encodeURIComponent(CFG.watchmodeKey);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Watchmode HTTP ' + r.status);
      return r.json();
    }).then(function (arr) {
      var links = {};
      (Array.isArray(arr) ? arr : []).forEach(function (src) {
        if (!src.web_url || ['sub', 'free', 'tve'].indexOf(src.type) < 0) return;
        var sv = SERVICES.filter(function (x) { return x.watchmode.test(src.name || ''); })[0];
        if (!sv) return;
        links[sv.id] = links[sv.id] || {};
        links[sv.id][src.region || '*'] = src.web_url;
      });
      linkCache[item.key] = { t: Date.now(), links: links };
      var keys = Object.keys(linkCache);
      if (keys.length > 600) {
        keys.sort(function (a, b) { return linkCache[a].t - linkCache[b].t; });
        keys.slice(0, keys.length - 500).forEach(function (k) { delete linkCache[k]; });
      }
      save('links', linkCache);
      return links;
    });
  }

  function pickLink(links, service) {
    var m = links && links[service.id];
    if (!m) return null;
    return m[REGION] || m['*'] || m[Object.keys(m)[0]] || null;
  }

  function buildControl(method, service, url) {
    var T = window.tizen;
    var data = function (k, v) { return new T.ApplicationControlData(k, [v]); };
    var nfId = (/netflix\.com\/(?:[a-z-]+\/)?(?:title|watch)\/(\d+)/.exec(url) || [])[1];
    if ((method === 'nf-plain' || method === 'nf-mdp') && nfId) {
      var values = method === 'nf-plain'
        ? 'm=' + nfId + '&source_type=4'
        : 'm=' + nfId + '&trackId=254080000&&source_type_payload=' +
          encodeURIComponent('groupIndex=2&tileIndex=6&action=mdp&movieId=' + nfId + '&trackId=254081000');
      return new T.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null,
        [data('PAYLOAD', JSON.stringify({ values: values }))]);
    }
    if (method === 'view') {
      return new T.ApplicationControl('http://tizen.org/appcontrol/operation/view', url, null, null, [data('PAYLOAD', url)]);
    }
    if (method === 'payload') {
      return new T.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null,
        [data('PAYLOAD', url), data('url', url), data('deeplink', url)]);
    }
    // payload-json: formát, který používá Samsung u Netflixu; ostatním služba pošle odkaz v JSONu
    var nf = /netflix\.com\/(?:[a-z-]+\/)?(?:title|watch)\/(\d+)/.exec(url);
    var payload = nf
      ? JSON.stringify({ values: JSON.stringify({ moduleName: 'common', query: 'm=' + nf[1] + '&source_type=4' }) })
      : JSON.stringify({ values: JSON.stringify({ url: url, deeplink: url }) });
    return new T.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, [data('PAYLOAD', payload)]);
  }

  function deepLaunch(service, url, item) {
    var method = deepMethod(service);
    var ids = candidateIds(service), i = 0;
    (function tryNext() {
      if (i >= ids.length) { launchService(service); return; }
      var id = ids[i++];
      try {
        window.tizen.application.launchAppControl(buildControl(method, service, url), id, function () {
          if (!svcSettings(service).deepOk) pendingFeedback = { service: service, method: method, item: item };
          afterLaunch();
        }, tryNext, null);
      } catch (e) { tryNext(); }
    })();
  }

  function playTitle(service, item) {
    var hint = 'V ' + service.name + ' vyhledej: ' + item.title;
    if ((!ANDROID && deepMethod(service) === 'off') || !CFG.watchmodeKey || !CFG.tmdbKey) { launchService(service, hint); return; }
    toast('Otevírám „' + item.title + '" v ' + service.name + '…');
    titleLinks(item).then(function (links) {
      var url = pickLink(links, service);
      if (!url) { launchService(service, hint); return; }
      if (ANDROID) {
        if (!ANDROID.openUrl(url, androidPackage(service) || '')) launchService(service);
        return;
      }
      if (!IS_TV) { toast('V televizi bych otevřel ' + service.name + ' rovnou na ' + url); return; }
      deepLaunch(service, url, item);
    }).catch(function (err) {
      launchService(service, hint);
    });
  }

  // po návratu z aplikace: otevřel se titul?
  function askFeedback() {
    var fb = pendingFeedback;
    pendingFeedback = null;
    if (!fb || currentScreen !== screens.detail) return;
    var info = currentScreen.el.querySelector('.detail-info');
    if (!info || info.querySelector('.feedback')) return;
    var st = svcSettings(fb.service);
    var box = h('div', { class: 'feedback' });
    var yes = h('div', { class: 'btn secondary focusable', 'data-fid': 'fb-yes', text: 'Ano',
      onselect: function () {
        st.deepOk = fb.method; st.deep = 'auto'; st.deepTried = [];
        save('settings', settings); toast('Super, u ' + fb.service.name + ' si to pamatuju.');
        info.removeChild(box); setFocus(info.querySelector('.btn.play') || info.querySelector('.focusable'));
      } });
    var no = h('div', { class: 'btn secondary focusable', 'data-fid': 'fb-no', text: 'Ne, jen úvodní obrazovka',
      onselect: function () {
        var tried = (st.deepTried || []).concat([fb.method]);
        var next = deepMethodsFor(fb.service).filter(function (m) { return tried.indexOf(m) < 0; })[0];
        st.deepTried = tried;
        st.deep = next || 'off';
        save('settings', settings);
        toast(next ? 'Příště zkusím u ' + fb.service.name + ' ' + DEEP_LABEL[next] + '.' : 'Přímý skok u ' + fb.service.name + ' nefunguje, budu otevírat jen aplikaci.');
        info.removeChild(box); setFocus(info.querySelector('.btn.play') || info.querySelector('.focusable'));
      } });
    box.appendChild(h('div', { class: 'fbq', text: 'Otevřel se v ' + fb.service.name + ' rovnou „' + fb.item.title + '"?' }));
    box.appendChild(yes);
    box.appendChild(no);
    info.appendChild(box);
    setFocus(yes);
  }

  // ------------------------------------------------------------------ seznam „Chci vidět"
  function inWatchlist(item) { return watchlist.some(function (w) { return w.key === item.key; }); }
  function toggleWatchlist(item, services) {
    if (inWatchlist(item)) {
      watchlist = watchlist.filter(function (w) { return w.key !== item.key; });
      toast('Odebráno ze seznamu');
    } else {
      watchlist.unshift({
        key: item.key, id: item.id, type: item.type, title: item.title, year: item.year,
        poster: item.poster, backdrop: item.backdrop, overview: item.overview, vote: item.vote,
        services: (services || []).map(function (s) { return s.id; })
      });
      toast('Přidáno do seznamu Chci vidět');
    }
    save('watchlist', watchlist);
  }

  // ------------------------------------------------------------------ komponenty
  var fidCounter = 0;

  function card(item, fid, serviceIds) {
    var poster = h('div', { class: 'poster' }, [
      item.poster
        ? h('img', { src: IMG + 'w342' + item.poster, alt: '' })
        : h('div', { class: 'ph', text: item.title }),
      h('div', { class: 'rbar' })
    ]);
    var badges = null;
    if (serviceIds && serviceIds.length) {
      badges = h('div', { class: 'badges' }, serviceIds.map(function (id) {
        var s = serviceById(id);
        return s ? h('span', { class: 'badge', style: 'background:' + s.colors[0], text: s.short }) : null;
      }));
    }
    var el = h('div', {
      class: 'card focusable', 'data-fid': fid || ('c' + (fidCounter++)), 'data-key': item.key,
      onselect: function () { go('detail', { item: item }); }
    }, [poster, badges, h('div', { class: 'ctitle', text: item.title + (item.year ? ' (' + item.year + ')' : '') })]);
    el._item = item;
    if (hasCzDub(item.key)) poster.appendChild(h('div', { class: 'dubtag', text: 'CZ' }));
    var lv = leavingTs(item.key);
    if (lv) poster.appendChild(h('div', { class: 'leavetag', text: 'odchází ' + fmtTs(lv) }));
    else if (item.change && item.change.ts && fid && fid.indexOf('new-') === 0) poster.appendChild(h('div', { class: 'addtag', text: 'přidáno ' + fmtTs(item.change.ts) }));
    fillRatings(el, item);
    if (hiddenItems[item.key]) markHidden(el);
    return el;
  }

  function row(title, sub, content) {
    return h('div', { class: 'row', 'data-row': title }, [
      h('h2', null, [title, sub ? h('small', { text: sub }) : null]),
      content
    ]);
  }

  function clock() {
    var el = h('div', { class: 'clock' });
    function tick() {
      var d = new Date();
      el.textContent = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    tick();
    setInterval(tick, 15000);
    return el;
  }

  function topbar(extra) {
    return h('div', { class: 'topbar' }, [
      h('div', { class: 'brand' }, ['Video', h('span', { text: 'téka' })]),
      h('div', { class: 'spacer' })
    ].concat(extra || []).concat([clock()]));
  }

  // ------------------------------------------------------------------ dostupnost titulu v aktuální zemi
  function setBadges(cardEl, services) {
    var old = cardEl.querySelector('.badges');
    if (old) old.parentNode.removeChild(old);
    if (!services.length) return;
    cardEl.insertBefore(h('div', { class: 'badges' }, services.map(function (s) {
      return h('span', { class: 'badge', style: 'background:' + s.colors[0], text: s.short });
    })), cardEl.querySelector('.ctitle'));
  }
  function markAvailability(cardEl, item) {
    if (!CFG.tmdbKey) return;
    providersFor(item).then(function (res) {
      setBadges(cardEl, res.mine);
      if (!res.mine.length) {
        cardEl.classList.add('away');
        cardEl.querySelector('.poster').appendChild(h('div', { class: 'awaytag', text: 'už na tvých službách není' }));
      }
    }).catch(function () {});
  }

  // ------------------------------------------------------------------ skryté tituly (Nezajímá mě / Už jsem viděl)
  var hiddenItems = load('hidden', {}); // { key: { …titul, reason: 'skip'|'seen', t, baseSeason, baseAir } }
  var lastHidden = null;                // pro vrácení žlutým tlačítkem

  function isHidden(item) { return !!hiddenItems[item.key]; }
  function hiddenLabel(e) { return e.reason === 'seen' ? 'viděno' : 'nezajímá mě'; }
  function markHidden(cardEl) {
    var e = hiddenItems[cardEl.getAttribute('data-key')];
    if (!e || cardEl.classList.contains('away')) return;
    cardEl.classList.add('away');
    cardEl.querySelector('.poster').appendChild(h('div', { class: 'awaytag', text: hiddenLabel(e) }));
  }

  function tvInfo(item) { return tmdb('/tv/' + item.id); }

  function hideItem(item, reason) {
    var entry = {
      key: item.key, id: item.id, type: item.type, title: item.title, year: item.year, poster: item.poster,
      backdrop: item.backdrop, overview: item.overview, vote: item.vote, reason: reason, t: Date.now()
    };
    var wl = watchlist.filter(function (w) { return w.key === item.key; })[0] || null;
    if (wl) { watchlist = watchlist.filter(function (w) { return w.key !== item.key; }); save('watchlist', watchlist); }
    hiddenItems[item.key] = entry;
    save('hidden', hiddenItems);
    lastHidden = { entry: entry, wl: wl };
    // u viděného seriálu si zapamatuj, kde skončil – podle toho se pak poznají nové díly
    if (reason === 'seen' && item.type === 'tv' && CFG.tmdbKey) {
      tvInfo(item).then(function (d) {
        var le = d.last_episode_to_air;
        entry.baseSeason = le ? le.season_number : 0;
        entry.baseAir = le ? le.air_date : '0000';
        save('hidden', hiddenItems);
      }).catch(function () {});
    }
  }
  function unhide(key) { delete hiddenItems[key]; save('hidden', hiddenItems); }

  function undoHide() {
    if (!lastHidden) { toast('Není co vrátit.'); return; }
    var x = lastHidden; lastHidden = null;
    unhide(x.entry.key);
    if (x.wl) { watchlist.unshift(x.wl); save('watchlist', watchlist); }
    toast('Vráceno: ' + x.entry.title);
    if (currentScreen === screens.home) {
      var fid = focused && focused.getAttribute('data-fid');
      show('home', {}, null);
      var el = fid && screens.home.el.querySelector('[data-fid="' + fid + '"]');
      if (el) setFocus(el);
    }
  }

  // červené/zelené tlačítko na plakátu
  function quickHide(reason) {
    if (!focused || !focused._item || currentScreen === screens.detail) return;
    var item = focused._item;
    if (reason === 'skip' && isHidden(item) && hiddenItems[item.key].reason === 'skip') return;
    var sib = function (el) {
      var n = el.nextElementSibling, p = el.previousElementSibling;
      while (n && (!n.classList.contains('focusable') || n.getAttribute('data-key') === item.key)) n = n.nextElementSibling;
      while (p && (!p.classList.contains('focusable') || p.getAttribute('data-key') === item.key)) p = p.previousElementSibling;
      return n || p;
    };
    var next = sib(focused);
    hideItem(item, reason);
    var root = currentScreen.el;
    if (currentScreen === screens.home) {
      Array.prototype.slice.call(root.querySelectorAll('.card[data-key="' + item.key + '"]')).forEach(function (c) {
        if (c.parentNode) c.parentNode.removeChild(c);
      });
    } else {
      markHidden(focused);
    }
    focused = null;
    setFocus(next && document.body.contains(next) ? next : focusablesIn(root)[0]);
    toast((reason === 'seen' ? 'Viděno: ' : 'Skryto: ') + item.title + ' · žluté tlačítko vrátí');
  }

  // ------------------------------------------------------------------ kde jsem v seriálu skončil
  var progress = load('progress', {}); // { 'tv:123': { s: 2, e: 3, t } }
  function epLabel(s, e) { return s + '×' + (e < 10 ? '0' : '') + e; }
  function setProgress(item, s, e) {
    progress[item.key] = { s: s, e: e, t: Date.now() };
    save('progress', progress);
  }
  function isWatched(item, s, e) {
    var p = progress[item.key];
    return !!p && (s < p.s || (s === p.s && e <= p.e));
  }

  // ------------------------------------------------------------------ nové díly a řady
  function trackedSeries() {
    var list = watchlist.filter(function (w) { return w.type === 'tv'; }).map(function (w) { return { item: w, base: null }; });
    Object.keys(hiddenItems).forEach(function (k) {
      var e = hiddenItems[k];
      if (e.type === 'tv' && e.reason === 'seen') list.push({ item: e, base: e });
    });
    return list;
  }
  function fmtDate(s) { var p = String(s).split('-'); return parseInt(p[2], 10) + '. ' + parseInt(p[1], 10) + '.'; }

  function seriesNews(t) {
    return tvInfo(t.item).then(function (d) {
      var le = d.last_episode_to_air, ne = d.next_episode_to_air;
      var today = new Date().toISOString().slice(0, 10);
      var ago = function (s) { return (Date.now() - Date.parse(s)) / DAY; };
      if (le && le.air_date) {
        if (t.base) {
          if (!t.base.baseAir) { // starší záznam bez výchozího stavu: ulož ho teď
            t.base.baseSeason = le.season_number; t.base.baseAir = le.air_date; save('hidden', hiddenItems);
          } else if (le.air_date > t.base.baseAir && le.air_date <= today) {
            return { tag: le.season_number > (t.base.baseSeason || 0) ? 'Nová řada ' + le.season_number : 'Nové díly', soon: false, date: le.air_date };
          }
        } else if (ago(le.air_date) <= 21) {
          return { tag: le.episode_number === 1 ? 'Nová řada ' + le.season_number : 'Nový díl ' + le.season_number + '×' + le.episode_number, soon: false, date: le.air_date };
        }
      }
      if (ne && ne.air_date && ne.air_date >= today && -ago(ne.air_date) <= 30) {
        return { tag: (ne.episode_number === 1 ? 'Nová řada ' : 'Další díl ') + fmtDate(ne.air_date), soon: true, date: ne.air_date };
      }
      return null;
    });
  }

  function restorePendingFocus() {
    var sc = screens.home;
    if (currentScreen === sc && sc.pendingFid) {
      var el = sc.el.querySelector('[data-fid="' + sc.pendingFid + '"]');
      if (el) { setFocus(el); sc.pendingFid = null; }
    }
  }

  function renderNews(slot) {
    var tracked = trackedSeries();
    if (!tracked.length || !CFG.tmdbKey) return;
    Promise.all(tracked.map(function (t) { return seriesNews(t).catch(function () { return null; }); })).then(function (res) {
      var items = [];
      res.forEach(function (n, i) { if (n) items.push({ t: tracked[i], n: n }); });
      if (!items.length || !document.body.contains(slot)) return;
      // nejdřív vyšlé (nejnovější první), pak chystané (nejbližší první)
      items.sort(function (a, b) {
        if (a.n.soon !== b.n.soon) return a.n.soon ? 1 : -1;
        return a.n.soon ? (a.n.date < b.n.date ? -1 : 1) : (a.n.date > b.n.date ? -1 : 1);
      });
      var r = h('div', { class: 'hscroll' });
      items.forEach(function (x) {
        var cEl = card(x.t.item, 'news-' + x.t.item.key);
        cEl.classList.remove('away');
        var tag = cEl.querySelector('.awaytag');
        if (tag) tag.parentNode.removeChild(tag);
        cEl.querySelector('.poster').appendChild(h('div', { class: 'newtag' + (x.n.soon ? ' soon' : ''), text: x.n.tag }));
        r.appendChild(cEl);
        if (!x.t.base) markAvailability(cEl, x.t.item);
      });
      slot.appendChild(row('Nové díly a řady', 'seriály, které chceš vidět nebo jsi viděl · zelené = viděl jsem i nové', r));
      restorePendingFocus();
      reapplyHomeScroll();
    });
  }

  // ------------------------------------------------------------------ přibylo na tvých službách
  var arrivals = load('arrivals', []); // [{ key, services: [id] }]

  function refreshWatchlistMotn() {
    if (!CFG.motnKey) return;
    var stale = watchlist.filter(function (w) { var d = dubCache[w.key]; return !d || Date.now() - d.t > 7 * DAY; }).slice(0, 6);
    stale.forEach(function (w) {
      motn('/shows/' + w.type + '/' + w.id, { country: REGION.toLowerCase() }).then(function (sh) { storeDub(sh); updateLeavingUI(); }).catch(function () {});
    });
  }

  function checkArrivals() {
    if (!CFG.tmdbKey || !watchlist.length) return;
    if (Date.now() - load('arrivalsCheck', 0) < 12 * 3600 * 1000) return;
    save('arrivalsCheck', Date.now());
    refreshWatchlistMotn();
    Promise.all(watchlist.map(function (w) {
      return providersFor(w).then(function (res) {
        return { w: w, mine: res.mine.map(function (s) { return s.id; }) };
      }, function () { return null; });
    })).then(function (list) {
      var found = [];
      list.forEach(function (x) {
        if (!x) return;
        var prev = x.w.services || [];
        var added = x.mine.filter(function (id) { return prev.indexOf(id) < 0; });
        x.w.services = x.mine;
        if (added.length) found.push({ key: x.w.key, services: added });
      });
      save('watchlist', watchlist);
      if (!found.length) return;
      found.forEach(function (f) {
        arrivals = arrivals.filter(function (a) { return a.key !== f.key; });
        arrivals.unshift(f);
      });
      save('arrivals', arrivals);
      toast('Přibylo na tvých službách: ' + found.map(function (f) {
        var w = watchlist.filter(function (x) { return x.key === f.key; })[0];
        return w ? w.title : '';
      }).join(', '));
      if (currentScreen === screens.home) {
        var slot = currentScreen.el.querySelector('.arrivals-slot');
        if (slot) renderArrivals(slot);
      }
    });
  }

  function renderArrivals(slot) {
    clear(slot);
    var items = arrivals.map(function (a) {
      var w = watchlist.filter(function (x) { return x.key === a.key; })[0];
      return w ? { w: w, services: a.services } : null;
    }).filter(Boolean);
    if (!items.length) return;
    var r = h('div', { class: 'hscroll' });
    items.forEach(function (x) { r.appendChild(card(x.w, 'arr-' + x.w.key, x.services)); });
    var done = h('div', { class: 'card clearcard focusable', 'data-fid': 'arr-clear',
      onselect: function () {
        arrivals = []; save('arrivals', arrivals);
        clear(slot);
        focused = null;
        setFocus(focusablesIn(currentScreen.el)[0]);
      } }, [h('div', { class: 'poster' }, [h('div', { class: 'ph', text: '✓ Beru na vědomí' })])]);
    r.appendChild(done);
    slot.appendChild(row('Přibylo na tvých službách', 'z tvého seznamu Chci vidět', r));
  }

  // ------------------------------------------------------------------ pořadí řádků
  function rowDefs() {
    return [{ id: 'news', name: 'Nové díly a řady' }, { id: 'watchlist', name: 'Chci vidět' }, { id: 'newest', name: 'Nově přidáno' }, { id: 'leaving', name: 'Brzy odchází' }, { id: 'trending', name: 'Nejpopulárnější' }]
      .concat(CATEGORIES.map(function (cat) { return { id: 'cat:' + cat.id, name: cat.name }; }))
      .concat([{ id: 'byService', name: 'Podle služeb' }]);
  }
  function rowOrder() {
    var c = content(), ids = rowDefs().map(function (d) { return d.id; });
    var order = (c.order || []).filter(function (id) { return ids.indexOf(id) >= 0; });
    // nové řádky vlož na jejich výchozí místo
    ids.forEach(function (id, i) { if (order.indexOf(id) < 0) order.splice(Math.min(i, order.length), 0, id); });
    c.order = order;
    return order;
  }
  function isRowOn(id) {
    var c = content();
    if (id === 'news' || id === 'watchlist') return true;
    if (id === 'trending') return c.trending;
    if (id === 'newest') return c.newest;
    if (id === 'leaving') return c.leaving !== false;
    if (id === 'byService') return c.byService;
    return !!c.cats[id.slice(4)];
  }

  // ------------------------------------------------------------------ DOMŮ
  var refreshTimer = null;
  function filterPill(kind) {
    var steps = kind === 'imdb' ? IMDB_STEPS : kind === 'cz' ? (CFG.motnKey ? ['', 'cs', 'dub'] : ['', 'cs']) : RT_STEPS;
    function label() {
      var v = filt()[kind];
      if (kind === 'cz') return v === 'cs' ? 'Česká tvorba' : v === 'dub' ? 'Český dabing' : 'Jazyk: vše';
      if (kind === 'imdb') return 'IMDb: ' + (v ? dec(v) + '+' : 'vše');
      return 'RT: ' + (v ? v + ' %+' : 'vše');
    }
    var el = h('div', {
      class: 'pill focusable' + (filt()[kind] ? ' on' : ''), 'data-fid': 'nav-f-' + kind, text: label(),
      onselect: function () {
        if (kind !== 'cz' && !hasRatingsSource()) { toast(MOBILE ? 'Pro hodnocení a filtr vlož v Nastavení → Klíče klíč OMDb.' : 'Pro hodnocení a filtr doplň OMDb klíč do js/config.js (viz README).'); return; }
        var i = steps.indexOf(filt()[kind] || steps[0]);
        filt()[kind] = steps[(i + 1) % steps.length];
        save('settings', settings);
        el.textContent = label();
        el.classList.toggle('on', !!filt()[kind]);
        // překresli řádky, až se přestane mačkat
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(function () {
          if (currentScreen !== screens.home) return;
          var fid = focused && focused.getAttribute('data-fid');
          show('home', {}, null);
          var again = fid && screens.home.el.querySelector('[data-fid="' + fid + '"]');
          if (again) setFocus(again);
        }, 900);
      }
    });
    return el;
  }

  defineScreen('home', function (root) {
    clear(root);
    homeDirty = false;
    var searchBtn = h('div', { class: 'pill focusable', 'data-fid': 'nav-search', text: 'Hledat', onselect: function () { go('search', { q: '' }); } });
    var setBtn = h('div', { class: 'pill focusable', 'data-fid': 'nav-settings', text: 'Nastavení', onselect: function () { go('settings'); } });
    var calBtn = h('div', { class: 'pill focusable', 'data-fid': 'nav-cal', text: 'Kalendář', onselect: function () { go('calendar'); } });
    root.appendChild(topbar([searchBtn, filterPill('imdb'), filterPill('rt'), filterPill('cz'), calBtn, setBtn]));

    var body = h('div', { class: 'vscroll', style: 'top:140px' });
    root.appendChild(body);

    // dlaždice služeb
    var tiles = h('div', { class: 'hscroll' });
    var first = null;
    SERVICES.forEach(function (s) {
      var st = svcSettings(s);
      if (!st.enabled) return;
      var state = null;
      if (IS_TV && !st.appId && !detectedApp(s)) state = h('div', { class: 'tstate', text: 'nenalezeno v TV' });
      var t = h('div', {
        class: 'tile focusable', style: gradient(s), 'data-fid': 'tile-' + s.id,
        onselect: function () { launchService(s); }
      }, [h('div', { class: 'tbig', text: s.short }), state, h('div', { class: 'tname', text: s.name })]);
      if (!first) first = t;
      tiles.appendChild(t);
    });
    var leavingWl = watchlist.filter(function (w) { return leavingTs(w.key); });
    if (leavingWl.length) body.appendChild(leavingBanner(leavingWl));
    body.appendChild(row('Moje služby', MOBILE ? 'klepnutím spustíš aplikaci' : 'OK spustí aplikaci · na plakátu: červené = nezajímá mě, zelené = viděl jsem', tiles));
    if (!CFG.tmdbKey && MOBILE) {
      body.appendChild(h('div', { class: 'banner focusable', 'data-fid': 'need-keys', onselect: function () { go('settings'); } },
        ['Pro tipy, hledání a kategorie vlož v ', h('b', { text: 'Nastavení → Klíče' }), ' klíč TMDB (zdarma na themoviedb.org). Klepni sem.']));
    }

    // přibylo na tvých službách – vždy nahoře
    var arrivalsSlot = h('div', { class: 'arrivals-slot' });
    body.appendChild(arrivalsSlot);
    renderArrivals(arrivalsSlot);

    var c = content();
    function addRow(title, sub, fidPrefix, opts, serviceIds, tabs) {
      var r = h('div', { class: 'hscroll' });
      for (var i = 0; i < 7; i++) r.appendChild(h('div', { class: 'card loading' }, [h('div', { class: 'poster' })]));
      var subText = function (extra) { return [sub, anyFilter() ? 'filtr ' + filterLabel() + (extra || '') : ''].filter(Boolean).join(' · '); };
      var rowEl = row(title, subText(filterActive() ? ' · ověřuji hodnocení…' : ''), r);
      var openAll = function () { go('grid', { title: title, sub: sub, opts: opts, serviceIds: serviceIds || null, tabs: tabs || null }); };
      var head = rowEl.querySelector('h2');
      head.className = MOBILE ? 'rowhead focusable' : 'rowhead';
      head.setAttribute('data-fid', fidPrefix + 'head');
      head._select = openAll;
      if (MOBILE) head.appendChild(h('span', { class: 'more', text: 'Zobrazit vše ›' }));
      body.appendChild(rowEl);
      discover(opts).then(function (items) {
        return items.filter(function (it) { return !isHidden(it); });
      }).then(applyFilter).then(function (res) {
        var items = res.items.slice(0, 24);
        var small = rowEl.querySelector('h2 small');
        if (small) small.textContent = subText(res.hidden ? ' · skryto ' + res.hidden : '');
        clear(r);
        if (!items.length) {
          rowEl.replaceChild(h('div', { class: 'note', text: anyFilter() ? 'Nic nesplňuje filtr ' + filterLabel() + '.' : 'Na tvých službách tu teď nic není.' }), r);
          return;
        }
        items.forEach(function (it, idx) {
          var cardEl = card(it, fidPrefix + it.key, serviceIds);
          r.appendChild(cardEl);
          if (!serviceIds) {
            // u kategorií zjisti, na které službě titul běží: hned u viditelných, ostatní až při najetí
            var done = false;
            var badge = function () {
              if (done) return; done = true;
              providersFor(it).then(function (pr) { setBadges(cardEl, pr.mine); }).catch(function () {});
            };
            if (idx < 8) badge(); else cardEl._focus = badge;
          }
        });
        r.appendChild(h('div', { class: 'card morecard focusable', 'data-fid': fidPrefix + 'more', onselect: openAll },
          [h('div', { class: 'poster' }, [h('div', { class: 'ph', text: 'Zobrazit vše ›' })])]));
        restorePendingFocus();
        reapplyHomeScroll();
      }).catch(function (err) {
        clear(r);
        rowEl.replaceChild(h('div', { class: 'note', text: errorText(err) }), r);
      });
    }

    var providers = allProviders();
    var canDiscover = providers.length && (c.series || c.movies);
    if (!c.series && !c.movies) {
      body.appendChild(h('div', { class: 'banner', text: 'V Nastavení → Obsah máš vypnuté seriály i filmy, takže tu nic není.' }));
    }
    rowOrder().forEach(function (id) {
      if (id === 'watchlist') {
        if (!watchlist.length) return;
        var wl = h('div', { class: 'hscroll' });
        watchlist.forEach(function (w) {
          var wc = card(w, 'wl-' + w.key, w.services);
          wl.appendChild(wc);
          markAvailability(wc, w);
        });
        body.appendChild(row('Chci vidět', watchlist.length + ' titulů', wl));
        return;
      }
      if (id === 'news') {
        var slot = h('div');
        body.appendChild(slot);
        renderNews(slot);
        return;
      }
      if (!canDiscover || !isRowOn(id)) return;
      if (id === 'leaving') {
        if (CFG.motnKey) addRow('Brzy odchází', 'z katalogu tvých služeb, nejbližší první', 'leave-', { providers: providers, changes: 'expiring' });
        return;
      }
      if (id === 'newest' && CFG.motnKey) {
        addRow('Nově přidáno', 'tituly, které tvým službám přibyly do katalogu', 'new-', { providers: providers, changes: 'new' });
        return;
      }
      if (id === 'newest') {
        var day = function (n) { return new Date(Date.now() - n * DAY).toISOString().slice(0, 10); };
        addRow('Nově přidáno', 'nové filmy a seriály s novými díly na tvých službách', 'new-', {
          providers: providers, movie: '', tv: '',
          extraMovie: { 'primary_release_date.gte': day(120), 'primary_release_date.lte': day(0), 'vote_count.gte': 5 },
          extraTv: { 'air_date.gte': day(30), 'air_date.lte': day(0) },
          mOrder: 'release_date'
        });
        return;
      }
      if (id === 'trending') { addRow('Nejpopulárnější na tvých službách', typesLabel(), 'tr-', { providers: providers, movie: '', tv: '', mOrder: 'popularity_1month' }); return; }
      if (id === 'byService') {
        enabledServices().forEach(function (s) {
          addRow('Populární na ' + s.name, typesLabel(), 'pop-' + s.id + '-', { providers: s.providers, movie: '', tv: '', services: [s.id] }, [s.id]);
        });
        return;
      }
      var cat = CATEGORIES.filter(function (x) { return 'cat:' + x.id === id; })[0];
      if (cat && typesLabel(cat)) {
        // dokumenty a jejich podkategorie mají v rozbalené mřížce záložky
        var fam = cat.parent || (CATEGORIES.some(function (x) { return x.parent === cat.id; }) ? cat.id : null);
        var tabs = null;
        if (fam) {
          tabs = CATEGORIES.filter(function (x) { return x.id === fam || x.parent === fam; }).map(function (x) {
            return { id: x.id, name: x.parent ? x.short : 'Vše', opts: { providers: providers, movie: x.movie, tv: x.tv, kw: x.kw, mg: x.mg, mgRel: x.mgRel } };
          });
        }
        addRow(cat.name, typesLabel(cat), 'cat-' + cat.id + '-', { providers: providers, movie: cat.movie, tv: cat.tv, kw: cat.kw, mg: cat.mg, mgRel: cat.mgRel }, null,
          tabs ? { list: tabs, cur: cat.id } : null);
      }
    });

    body.appendChild(h('div', { style: 'height:120px' }));
    return first || searchBtn;
  });

  // ------------------------------------------------------------------ HLEDÁNÍ
  var LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    .concat('ÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ'.split(''))
    .concat('1234567890'.split(''));

  defineScreen('search', function (root, params) {
    clear(root);
    var query = params.q || '';
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'search-wrap' });
    root.appendChild(wrap);

    var qEl = h('div', { class: 'query' });
    var kbd = h('div', { class: 'kbd' }, [qEl]);
    var results = h('div', { class: 'results' });
    var scroller = h('div', { class: 'vscroll' });
    var grid = h('div', { class: 'grid' });
    scroller.appendChild(grid);
    results.appendChild(scroller);
    wrap.appendChild(kbd);
    wrap.appendChild(results);

    function renderQuery() {
      if (MOBILE) { currentScreen.params = { q: query }; return; }
      clear(qEl);
      if (query) qEl.appendChild(document.createTextNode(query));
      else qEl.appendChild(h('span', { class: 'hint', text: 'Název filmu nebo seriálu' }));
      qEl.appendChild(h('span', { class: 'cursor' }));
      currentScreen.params = { q: query };
    }

    var timer = null, seq = 0;
    function changed() {
      renderQuery();
      clearTimeout(timer);
      timer = setTimeout(runSearch, 450);
    }

    function runSearch() {
      var my = ++seq;
      clear(grid);
      if (query.trim().length < 2) {
        grid.appendChild(h('div', { class: 'msg', text: MOBILE ? 'Napiš název. Výsledky se ukážou i se službou, kde titul běží.' : 'Piš na klávesnici vlevo. Výsledky se ukážou tady i se službou, kde titul běží.' }));
        return;
      }
      grid.appendChild(h('div', { class: 'msg', text: filterActive() ? 'Hledám a ověřuji hodnocení…' : 'Hledám…' }));
      tmdb('/search/multi', { query: query.trim(), include_adult: 'false' }).then(function (j) {
        var all = (j.results || []).filter(function (r) { return r.media_type === 'movie' || r.media_type === 'tv'; })
          .slice(0, 18).map(function (r) { return normalize(r); });
        return applyFilter(all);
      }).then(function (res) {
        if (my !== seq) return;
        clear(grid);
        var items = res.items;
        if (res.hidden) grid.appendChild(h('div', { class: 'msg small', text: 'Filtr ' + filterLabel() + ' skryl ' + res.hidden + ' výsledků (mění se na domovské obrazovce).' }));
        if (!items.length) { grid.appendChild(h('div', { class: 'msg', text: res.hidden ? 'Nic nesplňuje filtr.' : 'Nic jsem nenašel.' })); return; }
        items.forEach(function (it) {
          var c = card(it, 'sr-' + it.key);
          grid.appendChild(c);
          // dočti, kde se titul streamuje, a přidej odznaky
          providersFor(it).then(function (res) { setBadges(c, res.mine); }).catch(function () {});
        });
      }).catch(function (err) {
        if (my !== seq) return;
        clear(grid);
        grid.appendChild(h('div', { class: 'msg', text: errorText(err) }));
      });
    }

    var firstKey = null;
    if (MOBILE) {
      var input = h('input', { class: 'minput', type: 'search', placeholder: 'Název filmu nebo seriálu', autocomplete: 'off' });
      input.value = query;
      input.addEventListener('input', function () { query = input.value; changed(); });
      kbd.replaceChild(input, qEl);
      renderQuery();
      runSearch();
      setTimeout(function () { input.focus(); }, 150);
      return null;
    }
    LETTERS.forEach(function (ch, i) {
      var k = h('div', { class: 'key focusable', 'data-fid': 'k' + i, text: ch, onselect: function () { query += ch.toLowerCase(); changed(); } });
      if (!firstKey) firstKey = k;
      kbd.appendChild(k);
    });
    kbd.appendChild(h('div', { class: 'key wide focusable', 'data-fid': 'k-space', text: 'mezera', onselect: function () { query += ' '; changed(); } }));
    kbd.appendChild(h('div', { class: 'key mid focusable', 'data-fid': 'k-bs', text: '⌫', onselect: function () { query = query.slice(0, -1); changed(); } }));
    kbd.appendChild(h('div', { class: 'key mid focusable', 'data-fid': 'k-clr', text: 'smazat', onselect: function () { query = ''; changed(); } }));
    kbd.appendChild(h('div', { class: 'clear' }));

    renderQuery();
    runSearch();
    return firstKey;
  });

  // ------------------------------------------------------------------ DETAIL
  function providersFor(item, region) {
    return tmdb('/' + item.type + '/' + item.id + '/watch/providers').then(function (j) {
      var reg = (j.results || {})[region || REGION] || {};
      var list = [].concat(reg.flatrate || [], reg.free || [], reg.ads || []);
      var mine = [], others = [];
      list.forEach(function (p) {
        var s = SERVICES.filter(function (x) { return x.providers.indexOf(p.provider_id) >= 0; })[0];
        if (s && svcSettings(s).enabled) { if (mine.indexOf(s) < 0) mine.push(s); }
        else if (others.indexOf(p.provider_name) < 0) others.push(p.provider_name);
      });
      var rent = [].concat(reg.rent || [], reg.buy || []).map(function (p) { return p.provider_name; })
        .filter(function (n, i, a) { return a.indexOf(n) === i; });
      return { mine: mine, others: others, rent: rent };
    });
  }

  defineScreen('detail', function (root, params) {
    clear(root);
    var item = params.item;
    var bd = h('div', { class: 'backdrop' });
    if (item.backdrop) bd.style.backgroundImage = 'url(' + IMG + 'w1280' + item.backdrop + ')';
    root.appendChild(bd);
    root.appendChild(h('div', { class: 'backdrop-fade' }));

    var meta = [item.type === 'tv' ? 'Seriál' : 'Film'];
    if (item.year) meta.push(item.year);
    var metaEl = h('div', { class: 'meta' }, [meta.join(' · ')]);
    if (item.vote && !hasRatingsSource()) metaEl.appendChild(h('span', null, ['  ·  ', h('b', { text: 'TMDB ★ ' + dec(item.vote, 1) })]));
    var ratingsEl = h('div', { class: 'dratings' });
    ratingsFor(item).then(function (r) {
      if (!r) return;
      if (r.imdb != null) {
        ratingsEl.appendChild(h('span', { class: 'rchip imdb', text: 'IMDb ' + dec(r.imdb, 1) }));
        if (r.votes) ratingsEl.appendChild(h('span', { class: 'votes', text: r.votes >= 1e6 ? dec(r.votes / 1e6, 1) + ' mil. hlasů' : r.votes >= 1000 ? Math.round(r.votes / 1000) + ' tis. hlasů' : r.votes + ' hlasů' }));
      }
      if (r.rt != null) ratingsEl.appendChild(h('span', { class: 'rchip ' + (r.rt >= 60 ? 'rt-fresh' : 'rt-rotten'), text: 'Rotten Tomatoes ' + r.rt + ' %' }));
      if (r.mc != null) ratingsEl.appendChild(h('span', { class: 'rchip mc', text: 'Metacritic ' + r.mc }));
      if (r.imdb == null && r.rt == null && item.vote) ratingsEl.appendChild(h('span', { class: 'votes', text: 'IMDb ani RT hodnocení nemá · TMDB ★ ' + dec(item.vote, 1) }));
    });

    var actions = h('div', { class: 'actions' });
    var peopleEl = h('div', { class: 'people' });
    if (CFG.tmdbKey) {
      Promise.all([
        tmdb('/' + item.type + '/' + item.id + (item.type === 'tv' ? '/aggregate_credits' : '/credits')),
        item.type === 'tv' ? tvInfo(item) : Promise.resolve(null)
      ]).then(function (r) {
        var cr = r[0] || {}, tv = r[1];
        var dirs = item.type === 'tv'
          ? ((tv && tv.created_by) || []).slice(0, 2)
          : (cr.crew || []).filter(function (p) { return p.job === 'Director'; }).slice(0, 2);
        var cast = (cr.cast || []).slice(0, MOBILE ? 8 : 6);
        var pchip = function (p) {
          return h('div', { class: 'btn person focusable', 'data-fid': 'p-' + p.id, text: p.name,
            onselect: function () { go('person', { id: p.id, name: p.name }); } });
        };
        if (dirs.length) peopleEl.appendChild(h('div', { class: 'prow' }, [h('span', { class: 'plabel', text: item.type === 'tv' ? 'Tvůrci' : 'Režie' })].concat(dirs.map(pchip))));
        if (cast.length) peopleEl.appendChild(h('div', { class: 'prow' }, [h('span', { class: 'plabel', text: 'Hrají' })].concat(cast.map(pchip))));
      }).catch(function () {});
    }
    var info = h('div', { class: 'detail-info' }, [
      h('h1', { text: item.title }),
      metaEl,
      ratingsEl,
      h('div', { class: 'overview', text: item.overview || '' }),
      peopleEl,
      h('h3', { text: 'Kde sledovat' }),
      actions
    ]);
    root.appendChild(h('div', { class: 'detail-body' }, [
      h('div', { class: 'dposter' }, [item.poster ? h('img', { src: IMG + 'w500' + item.poster, alt: '' }) : null]),
      info
    ]));
    root.appendChild(h('div', { class: 'hintbar', text: (CFG.watchmodeKey ? 'OK otevře titul rovnou ve službě' : 'OK otevře aplikaci služby (pro skok rovnou na titul doplň Watchmode klíč)') + ' · Zpět vrátí na předchozí obrazovku' }));

    var foundServices = [];
    var listBtn = h('div', {
      class: 'btn secondary focusable', 'data-fid': 'd-list',
      text: inWatchlist(item) ? '✓ V seznamu' : '+ Chci vidět',
      onselect: function () {
        toggleWatchlist(item, foundServices);
        listBtn.textContent = inWatchlist(item) ? '✓ V seznamu' : '+ Chci vidět';
      }
    });
    var loading = h('div', { class: 'also', text: 'Zjišťuji dostupnost…' });
    var epBtn = null;
    if (MOBILE && validCode(load('tvCode', ''))) {
      actions.appendChild(h('div', { class: 'btn secondary focusable', 'data-fid': 'd-send', text: '📺 Pošli do TV', onselect: function () { sendToTv(item); } }));
    }
    if (item.type === 'tv' && CFG.tmdbKey) {
      var pr = progress[item.key];
      epBtn = h('div', { class: 'btn secondary focusable', 'data-fid': 'd-episodes',
        text: 'Série a díly' + (pr ? ' · naposledy ' + epLabel(pr.s, pr.e) : ''),
        onselect: function () { go('episodes', { item: item }); } });
      actions.appendChild(epBtn);
    }
    actions.appendChild(listBtn);
    var dbtn = function (fid, label, fn) {
      actions.appendChild(h('div', { class: 'btn secondary focusable', 'data-fid': fid, text: label, onselect: fn }));
    };
    var he = hiddenItems[item.key];
    if (he) {
      dbtn('d-unhide', 'Vrátit do nabídky', function () { unhide(item.key); toast('Vráceno: ' + item.title); back(); });
      if (he.reason === 'seen' && item.type === 'tv') {
        dbtn('d-seen-new', 'Viděl jsem i nové díly', function () { hideItem(item, 'seen'); toast('Zapamatováno, další díly ti zase ukážu.'); back(); });
      }
    } else {
      dbtn('d-skip', '✕ Nezajímá mě', function () { hideItem(item, 'skip'); toast('Skryto: ' + item.title + ' · vrátíš v Nastavení'); back(); });
      dbtn('d-seen', '✓ Už jsem viděl', function () {
        hideItem(item, 'seen');
        toast('Viděno: ' + item.title + (item.type === 'tv' ? ' · nové díly ti ukážu' : ''));
        back();
      });
    }
    info.appendChild(loading);

    // doplň popis, pokud chybí (např. u položek ze seznamu)
    if (!item.overview && CFG.tmdbKey) {
      tmdb('/' + item.type + '/' + item.id).then(function (d) {
        if (d.overview) info.querySelector('.overview').textContent = d.overview;
      }).catch(function () {});
    }

    providersFor(item).then(function (res) {
      foundServices = res.mine;
      info.removeChild(loading);
      var firstPlay = null;
      res.mine.forEach(function (s) {
        var b = h('div', {
          class: 'btn play focusable', style: gradient(s), 'data-fid': 'd-play-' + s.id,
          text: '▶  ' + s.name, onselect: function () { playTitle(s, item); }
        });
        actions.insertBefore(b, epBtn || listBtn);
        if (!firstPlay) firstPlay = b;
      });
      if (!res.mine.length) info.appendChild(h('div', { class: 'unavailable', text: 'Na tvých službách teď není.' }));
      if (CFG.motnKey && res.mine.length) {
        var dubEl = h('div', { class: 'also dubline', text: 'Zjišťuji český dabing…' });
        info.appendChild(dubEl);
        dubFor(item).then(function (d) {
          if (!d) { dubEl.textContent = 'Český dabing: nezjištěno.'; return; }
          var parts = res.mine.map(function (sv) {
            var e = d.by[sv.id];
            if (!e) return sv.name + ' ?';
            return sv.name + (e.a ? ' ✓' : e.s ? ' – jen české titulky' : ' – bez češtiny');
          });
          dubEl.textContent = 'Český dabing: ' + parts.join(' · ');
        }).catch(function (err) { dubEl.textContent = errorText(err); });
      }
      if (res.others.length) info.appendChild(h('div', { class: 'also', text: 'V předplatném také na: ' + res.others.join(', ') }));
      if (res.rent.length) info.appendChild(h('div', { class: 'also', text: 'K pronájmu nebo koupi: ' + res.rent.slice(0, 6).join(', ') }));
      // aktualizuj odznaky v uloženém seznamu
      var ids = res.mine.map(function (s) { return s.id; });
      var changed = false;
      watchlist.forEach(function (w) {
        if (w.key === item.key && (w.services || []).join() !== ids.join()) { w.services = ids; changed = true; }
      });
      if (changed) save('watchlist', watchlist);
      if (firstPlay && focused === listBtn) setFocus(firstPlay);
    }).catch(function (err) {
      loading.textContent = errorText(err);
    });

    return listBtn;
  });

  // ------------------------------------------------------------------ AKTUALIZACE
  var UPD = window.PromitarnaUpdate || null;
  var updateState = null; // výsledek poslední kontroly

  function updateLabel() {
    if (!UPD) return 'nedostupné';
    if (UPD.pendingVersion()) return 'verze ' + UPD.pendingVersion() + ' připravená';
    if (!updateState) return 'zatím nekontrolováno';
    if (updateState.checking) return 'kontroluji…';
    switch (updateState.status) {
      case 'latest': return 'máš nejnovější verzi';
      case 'reinstall': return 'verze ' + updateState.version + ' vyžaduje přeinstalovat';
      case 'bad': return 'verze ' + updateState.version + ' nenaběhla, čekám na opravu';
      case 'error': return 'kontrola selhala (' + updateState.message + ')';
      default: return '';
    }
  }

  function checkUpdates(manual) {
    if (!UPD) return Promise.resolve();
    updateState = { checking: true };
    return UPD.check().then(function (res) {
      updateState = res;
      if (res.status === 'ready') toast('Nová verze ' + res.version + ' je připravená' + (res.notes ? ': ' + res.notes : '') + '. Použije se při dalším spuštění.');
      else if (res.status === 'reinstall') toast('Verze ' + res.version + ' potřebuje znovu nainstalovat aplikaci (viz README).');
      else if (manual) toast('Máš nejnovější verzi ' + UPD.version + '.');
    }).catch(function (err) {
      updateState = { status: 'error', message: err.message };
      if (manual) toast('Aktualizace se nepodařilo zkontrolovat: ' + err.message);
    });
  }

  function autoCheckUpdates() {
    if (!UPD || !UPD.auto()) return;
    if (Date.now() - UPD.lastCheck() < 6 * 3600 * 1000) return;
    checkUpdates(false);
  }

  // ------------------------------------------------------------------ NASTAVENÍ
  function refreshSettings(fid) {
    show('settings', {}, null);
    var el = screens.settings.el.querySelector('[data-fid="' + fid + '"]') ||
      screens.settings.el.querySelector('[data-fid^="set-upd-"]');
    if (el) setFocus(el);
  }
  function deepLabel(s) {
    var st = svcSettings(s), m = st.deep || 'auto';
    if (m === 'auto') return st.deepOk ? 'funguje (' + DEEP_LABEL[st.deepOk] + ')' : (IS_TV ? 'vypnuto' : 'automaticky');
    return DEEP_LABEL[m];
  }
  defineScreen('settings', function (root) {
    clear(root);
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'settings vscroll' });
    root.appendChild(wrap);
    var first = null;
    if (MOBILE) {
      wrap.appendChild(h('div', { class: 'shead', text: 'Klíče' }));
      var inputs = {};
      var labels = { tmdbKey: 'TMDB (nutný)', omdbKey: 'OMDb – hodnocení', watchmodeKey: 'Watchmode – skok na titul', motnKey: 'Movie of the Night – český dabing' };
      var keyBox = h('div', { class: 'srow wrap keys' }, KEY_NAMES.map(function (n) {
        var inp = h('input', { class: 'minput', type: 'text', placeholder: labels[n], autocomplete: 'off', spellcheck: 'false' });
        inp.value = CFG[n] || '';
        inputs[n] = inp;
        return h('label', { class: 'keyrow' }, [h('span', { text: labels[n] }), inp]);
      }));
      keyBox.appendChild(h('div', { class: 'btn focusable', 'data-fid': 'set-keys-save', text: 'Uložit klíče',
        onselect: function () {
          var k = {};
          KEY_NAMES.forEach(function (n) { k[n] = inputs[n].value.trim(); });
          save('keys', k);
          toast('Klíče uloženy');
          setTimeout(function () { location.reload(); }, 600);
        } }));
      wrap.appendChild(keyBox);
      wrap.appendChild(h('div', { class: 'sinfo', text: 'Klíče jsou zdarma: themoviedb.org (Nastavení → API), omdbapi.com a api.watchmode.com. Zůstávají jen v telefonu.' }));
    }

    // obsah domovské obrazovky
    var c = content();
    function chip(fid, label, on, toggle) {
      var el = h('div', { class: 'btn chip focusable' + (on ? ' on' : ''), 'data-fid': fid, text: (on ? '✓ ' : '') + label,
        onselect: function () {
          var now = toggle();
          save('settings', settings);
          el.textContent = (now ? '✓ ' : '') + label;
          el.classList.toggle('on', now);
        } });
      return el;
    }
    wrap.appendChild(h('div', { class: 'shead', text: 'Obsah domovské obrazovky' }));
    wrap.appendChild(h('div', { class: 'srow' }, [
      h('div', { class: 'sname', text: 'Typ' }),
      chip('set-c-series', 'Seriály', c.series, function () { return (c.series = !c.series); }),
      chip('set-c-movies', 'Filmy', c.movies, function () { return (c.movies = !c.movies); })
    ]));
    wrap.appendChild(h('div', { class: 'srow' }, [
      h('div', { class: 'sname', text: 'Řádky' }),
      chip('set-c-new', 'Nově přidáno', c.newest, function () { return (c.newest = !c.newest); }),
      CFG.motnKey ? chip('set-c-leave', 'Brzy odchází', c.leaving !== false, function () { return (c.leaving = c.leaving === false); }) : null,
      chip('set-c-trend', 'Nejpopulárnější', c.trending, function () { return (c.trending = !c.trending); }),
      chip('set-c-svc', 'Podle služeb', c.byService, function () { return (c.byService = !c.byService); }),
      h('div', { class: 'btn focusable', 'data-fid': 'set-order', text: 'Pořadí řádků…', onselect: function () { go('order'); } })
    ]));
    first = wrap.querySelector('.chip');
    var catChips = CATEGORIES.filter(function (cat) { return !cat.parent; }).map(function (cat) {
      return chip('set-cat-' + cat.id, cat.name, c.cats[cat.id], function () { return (c.cats[cat.id] = !c.cats[cat.id]); });
    });
    wrap.appendChild(h('div', { class: 'srow wrap' }, [h('div', { class: 'sname', text: 'Kategorie' }), h('div', { class: 'chips' }, catChips)]));
    var subChips = CATEGORIES.filter(function (cat) { return cat.parent === 'dokumenty'; }).map(function (cat) {
      return chip('set-cat-' + cat.id, cat.short, c.cats[cat.id], function () { return (c.cats[cat.id] = !c.cats[cat.id]); });
    });
    wrap.appendChild(h('div', { class: 'srow wrap' }, [h('div', { class: 'sname', text: 'Dokumenty' }), h('div', { class: 'chips' }, subChips)]));
    wrap.appendChild(h('div', { class: 'shead', text: 'Služby' }));

    SERVICES.forEach(function (s) {
      var st = svcSettings(s);
      var d = detectedApp(s);
      var appLabel = st.appId ? (st.appName || st.appId) : (d ? d.name : (IS_TV ? 'nenalezeno – vyber' : 'automaticky'));
      var toggle = h('div', {
        class: 'btn focusable', 'data-fid': 'set-en-' + s.id, text: st.enabled ? 'Zapnuto' : 'Vypnuto',
        onselect: function () {
          st.enabled = !st.enabled; save('settings', settings);
          toggle.textContent = st.enabled ? 'Zapnuto' : 'Vypnuto';
        }
      });
      var pick = h('div', {
        class: 'btn focusable', 'data-fid': 'set-app-' + s.id, text: 'Aplikace: ' + appLabel,
        onselect: function () { go('picker', { service: s }); }
      });
      var deepBtn = h('div', {
        class: 'btn focusable', 'data-fid': 'set-deep-' + s.id,
        text: 'Skok na titul: ' + deepLabel(s),
        onselect: function () {
          var order = ['auto'].concat(deepMethodsFor(s)).concat(['off']);
          var cur = st.deep || 'auto';
          st.deep = order[(order.indexOf(cur) + 1) % order.length];
          st.deepTried = [];
          if (st.deep === 'auto') st.deepOk = null;
          save('settings', settings);
          deepBtn.textContent = 'Skok na titul: ' + deepLabel(s);
        }
      });
      var test = h('div', {
        class: 'btn focusable', 'data-fid': 'set-test-' + s.id, text: 'Vyzkoušet',
        onselect: function () { launchService(s); }
      });
      var modeBtn = IS_TV ? h('div', {
        class: 'btn focusable', 'data-fid': 'set-launch-' + s.id, text: 'Spuštění: ' + LAUNCH_LABEL[launchMode(s)],
        onselect: function () {
          st.launchMode = LAUNCH_MODES[(LAUNCH_MODES.indexOf(launchMode(s)) + 1) % LAUNCH_MODES.length];
          save('settings', settings);
          modeBtn.textContent = 'Spuštění: ' + LAUNCH_LABEL[launchMode(s)];
        }
      }) : null;
      wrap.appendChild(h('div', { class: 'srow' }, [
        h('div', { class: 'sdot', style: 'background:' + s.colors[0] }),
        h('div', { class: 'sname', text: s.name }),
        toggle, pick, modeBtn, ANDROID ? null : deepBtn, test
      ]));
    });

    if (UPD) {
      var pend = UPD.pendingVersion();
      var updBtns = [
        h('div', { class: 'sver', text: 'Verze ' + UPD.version + (UPD.downloaded ? ' (stažená)' : '') + ' · ' + updateLabel() }),
        pend
          ? h('div', { class: 'btn focusable', 'data-fid': 'set-upd-restart', text: 'Restartovat na ' + pend, onselect: function () { UPD.restart(); } })
          : h('div', { class: 'btn focusable', 'data-fid': 'set-upd-check', text: 'Zkontrolovat',
              onselect: function () { checkUpdates(true).then(function () { if (currentScreen === screens.settings) refreshSettings('set-upd-check'); }); } }),
        h('div', { class: 'btn focusable', 'data-fid': 'set-upd-auto', text: 'Automaticky: ' + (UPD.auto() ? 'ano' : 'ne'),
          onselect: function () { UPD.auto(!UPD.auto()); refreshSettings('set-upd-auto'); } })
      ];
      if (UPD.downloaded) updBtns.push(h('div', { class: 'btn focusable', 'data-fid': 'set-upd-reset', text: 'Vrátit verzi ' + UPD.bundled,
        onselect: function () { UPD.reset(); } }));
      wrap.appendChild(h('div', { class: 'srow' }, [h('div', { class: 'sname', text: 'Aktualizace' })].concat(updBtns)));
    }

    if (MOBILE) {
      var tvCode = load('tvCode', '');
      var paired = validCode(tvCode);
      var codeIn = h('input', { class: 'minput', type: 'text', placeholder: 'Kód z televize (20 znaků)', autocomplete: 'off' });
      wrap.appendChild(h('div', { class: 'srow wrap keys' }, [
        h('div', { class: 'sname', text: 'Televize' }),
        h('div', { class: 'sinfo', text: paired
          ? 'Spárováno. V detailu titulu je tlačítko Pošli do TV.'
          : 'V televizi otevři Nastavení → Telefon jako ovladač a naskenuj QR kód. Telefon pak televizi pošle i klíče.' }),
        h('div', { class: 'btn focusable', 'data-fid': 'set-scan', text: paired ? 'Spárovat znovu (QR)' : 'Naskenovat QR z televize', onselect: function () { go('scan'); } }),
        paired ? h('div', { class: 'btn focusable', 'data-fid': 'set-sendkeys', text: 'Poslat klíče do televize', onselect: function () { sendKeysToTv(); } }) : null,
        paired ? h('div', { class: 'btn focusable', 'data-fid': 'set-unpair', text: 'Zrušit spárování', onselect: function () { save('tvCode', ''); refreshSettings('set-scan'); } }) : null,
        h('label', { class: 'keyrow' }, [h('span', { text: 'Nebo kód opiš:' }), codeIn]),
        h('div', { class: 'btn focusable', 'data-fid': 'set-pair', text: 'Spárovat kódem', onselect: function () {
          if (pairWith(codeIn.value)) refreshSettings('set-scan');
        } })
      ]));
    } else {
      var pc = load('pairCode', '');
      var pcOk = validCode(pc);
      wrap.appendChild(h('div', { class: 'srow pairrow' }, [
        h('div', { class: 'sname', text: 'Telefon jako ovladač' }),
        pcOk ? qrImage(QR_PREFIX + pc) : null,
        h('div', { class: 'pairtext' }, [
          pcOk ? h('div', { class: 'paircode', text: fmtCode(pc) }) : null,
          h('div', { class: 'sver', text: pcOk
            ? 'V mobilní Videotéce otevři Nastavení → Televize → Naskenovat QR. Telefon pak pošle televizi i klíče.'
            : 'Spáruj mobil s televizí: půjde z něj posílat tituly a přenést klíče.' }),
          h('div', null, [
            h('div', { class: 'btn focusable', 'data-fid': 'set-paircode', text: pcOk ? 'Nový kód' : 'Zapnout',
              onselect: function () { stopTvListener(); save('pairCode', newPairCode()); startTvListener(); refreshSettings('set-paircode'); } }),
            pcOk ? h('div', { class: 'btn focusable', 'data-fid': 'set-pairoff', text: 'Vypnout',
              onselect: function () { stopTvListener(); save('pairCode', ''); refreshSettings('set-paircode'); } }) : null
          ])
        ])
      ]));
    }

    if (IS_TV) {
      var closeBtn = h('div', { class: 'btn focusable', 'data-fid': 'set-closeafter',
        text: 'Po spuštění služby zavřít Videotéku: ' + (closeAfterLaunch() ? 'ano' : 'ne'),
        onselect: function () {
          settings._closeAfter = !closeAfterLaunch();
          save('settings', settings);
          closeBtn.textContent = 'Po spuštění služby zavřít Videotéku: ' + (closeAfterLaunch() ? 'ano' : 'ne');
        } });
      wrap.appendChild(h('div', { class: 'srow' }, [h('div', { class: 'sname', text: 'Spouštění' }), closeBtn,
        h('div', { class: 'sver', text: 'Uvolní paměť pro Netflix apod. Zpět do Videotéky se vrátíš přes APPS.' })]));
    }

    wrap.appendChild(h('div', { class: 'srow' }, [
      h('div', { class: 'sname', text: 'Skryté' }),
      h('div', { class: 'btn focusable', 'data-fid': 'set-hidden', text: 'Skryté a viděné tituly (' + Object.keys(hiddenItems).length + ')…',
        onselect: function () { go('hiddenlist'); } }),
      MOBILE ? null : h('div', { class: 'sver', text: 'Na plakátu: červené = nezajímá mě, zelené = viděl jsem, žluté = vrátit poslední' })
    ]));

    wrap.appendChild(h('div', { class: 'srow' }, [
      h('div', { class: 'sname', text: 'Chci vidět' }),
      h('div', {
        class: 'btn focusable', 'data-fid': 'set-clear-wl', text: 'Vyprázdnit seznam (' + watchlist.length + ')',
        onselect: function () { watchlist = []; save('watchlist', watchlist); toast('Seznam je prázdný'); show('settings', {}, null); }
      })
    ]));

    wrap.appendChild(h('div', { class: 'sinfo' }, [
      'Data o tom, co kde běží: ', h('b', { text: 'TMDB / JustWatch' }), ', katalog ', h('b', { text: REGION }),
      '. TMDB klíč: ', h('b', { text: CFG.tmdbKey ? 'nastaven' : (MOBILE ? 'chybí (Nastavení → Klíče)' : 'chybí – pošli ho z mobilu (Telefon jako ovladač)') }),
      '. Hodnocení IMDb / Rotten Tomatoes (OMDb): ', h('b', { text: omdbBlocked || (CFG.omdbKey ? 'zapnuto, v paměti ' + Object.keys(ratingCache).length + ' titulů' : 'chybí OMDb klíč (' + (MOBILE ? 'Nastavení → Klíče' : 'js/config.js') + ')') }),
      '. Český dabing (Movie of the Night): ', h('b', { text: CFG.motnKey ? 'zapnuto, tento měsíc ' + motnCount().n + ' z 1000 dotazů' : 'chybí klíč (' + (MOBILE ? 'Nastavení → Klíče' : 'js/config.js') + ')' }),
      '. Skok na titul (Watchmode): ', h('b', { text: CFG.watchmodeKey ? 'zapnuto, v paměti ' + Object.keys(linkCache).length + ' odkazů' : 'chybí Watchmode klíč (' + (MOBILE ? 'Nastavení → Klíče' : 'js/config.js') + ')' }),
      IS_TV ? '. Nalezeno aplikací v TV: ' + installedApps.length + '.' : ANDROID ? '. Mobilní aplikace, nalezeno aplikací: ' + installedApps.length + '.' : '. Běží mimo televizi (náhled v prohlížeči).'
    ]));
    wrap.appendChild(h('div', { style: 'height:160px' }));
    return first;
  });

  // ------------------------------------------------------------------ CELÁ KATEGORIE
  defineScreen('grid', function (root, params) {
    clear(root);
    root.appendChild(topbar([h('div', { class: 'eptitle', text: params.title })]));
    var sc = h('div', { class: 'vscroll gridscreen' });
    var grid = h('div', { class: 'grid' });
    var status = h('div', { class: 'sinfo gridstatus', text: 'Načítám…' });
    sc.appendChild(h('div', { class: 'gridhead' }, [h('span', { class: 'gtitle', text: params.title }),
      params.sub ? h('small', { text: params.sub + (anyFilter() ? ' · filtr ' + filterLabel() : '') }) : null]));
    var curOpts = params.opts;
    var tabsEl = null;
    if (params.tabs) {
      tabsEl = h('div', { class: 'gridtabs' });
      params.tabs.list.forEach(function (t) {
        var el = h('div', { class: 'pill focusable' + (t.id === params.tabs.cur ? ' on' : ''), 'data-fid': 'tab-' + t.id, text: t.name });
        el._select = function () {
          Array.prototype.forEach.call(tabsEl.children, function (x) { x.classList.remove('on'); });
          el.classList.add('on');
          params.tabs.cur = t.id;
          curOpts = t.opts;
          clear(grid);
          page = 0; done = false; seen = {}; count = 0; empty = 0; loading = false; gen++;
          sc.scrollTop = 0;
          loadMore();
        };
        tabsEl.appendChild(el);
      });
      sc.appendChild(tabsEl);
    }
    sc.appendChild(grid);
    sc.appendChild(status);
    root.appendChild(sc);

    var page = 0, loading = false, done = false, seen = {}, count = 0, empty = 0, gen = 0;
    function loadMore() {
      if (loading || done) return;
      loading = true;
      page++;
      status.textContent = 'Načítám…';
      var myGen = gen;
      discover(Object.assign({}, curOpts, { page: page })).then(function (items) {
        if (myGen !== gen) return { items: [], hidden: 0, stale: true };
        if (!items.length && !items.more) { done = true; return { items: [], hidden: 0 }; }
        return applyFilter(items.filter(function (it) { return !isHidden(it) && !seen[it.key]; }));
      }).then(function (res) {
        if (res.stale) return;
        loading = false;
        if (currentScreen !== screens.grid) return;
        var first = !grid.firstChild;
        res.items.forEach(function (it) {
          seen[it.key] = true;
          var c = card(it, 'g-' + it.key, params.serviceIds);
          var idx = count++;
          c._focus = function () { if (idx >= count - 14) loadMore(); };
          if (!params.serviceIds) providersFor(it).then(function (pr) { setBadges(c, pr.mine); }).catch(function () {});
          grid.appendChild(c);
        });
        if (first && grid.firstChild && (!focused || !document.body.contains(focused))) setFocus(grid.firstChild);
        if (page >= 25) done = true;
        // s přísným filtrem může stránka zůstat prázdná – zkus další, ale ne donekonečna
        if (!res.items.length && !done) { if (++empty < 4) { loadMore(); return; } done = true; } else empty = 0;
        status.textContent = done ? (count ? 'To je všechno (' + count + ' titulů).' : 'Nic tu není.') : '';
        if (!done && sc.scrollHeight <= sc.clientHeight + 50) loadMore(); // obrazovka ještě není plná
      }).catch(function (err) {
        loading = false;
        status.textContent = errorText(err);
      });
    }
    sc.addEventListener('scroll', function () {
      if (sc.scrollTop + sc.clientHeight > sc.scrollHeight - 800) loadMore();
    });
    loadMore();
    return null;
  });

  // ------------------------------------------------------------------ TELEFON JAKO OVLADAČ (ntfy.sh, šifrované)
  // Televize ukáže QR kód s náhodným 20znakovým kódem. Z kódu se odvodí kanál na ntfy.sh i klíč
  // k šifrování; samotný kód se nikam neposílá. Zprávy (titul k otevření, klíče) jsou zašifrované.
  var NTFY = 'https://ntfy.sh/';
  var CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var CODE_LEN = 20;
  var QR_PREFIX = 'VIDEOTEKA:';

  // SHA-256 v čistém JS (Tizen nemá WebCrypto mimo zabezpečený kontext)
  var K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256(msg) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = msg.slice(), bits = msg.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bits / 0x100000000), lo = bits >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    var w = new Array(64);
    for (var off = 0; off < bytes.length; off += 64) {
      var t;
      for (t = 0; t < 16; t++) w[t] = (bytes[off + 4 * t] << 24) | (bytes[off + 4 * t + 1] << 16) | (bytes[off + 4 * t + 2] << 8) | bytes[off + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        w[t] = (w[t - 16] + (ror(x, 7) ^ ror(x, 18) ^ (x >>> 3)) + w[t - 7] + (ror(y, 17) ^ ror(y, 19) ^ (y >>> 10))) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (t = 0; t < 64; t++) {
        var t1 = (hh + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[t] + w[t]) | 0;
        var t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = [];
    H.forEach(function (v) { out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); });
    return out;
  }
  function utf8(str) { var b = unescape(encodeURIComponent(str)), a = []; for (var i = 0; i < b.length; i++) a.push(b.charCodeAt(i)); return a; }
  function fromUtf8(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]); return decodeURIComponent(escape(s)); }
  function toHex(arr) { return arr.map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function toB64(arr) { var s = ''; for (var i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]); return btoa(s); }
  function fromB64(str) { var b = atob(str), a = []; for (var i = 0; i < b.length; i++) a.push(b.charCodeAt(i)); return a; }
  function keystream(code, nonce, n) {
    var out = [];
    for (var i = 0; out.length < n; i++) out = out.concat(sha256(utf8('ks|' + code + '|' + nonce + '|' + i)));
    return out.slice(0, n);
  }
  function randomCode(n) {
    var a = new Uint8Array(n), out = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += CODE_ABC[a[i] % CODE_ABC.length];
    return out;
  }
  function seal(code, obj) {
    var nonce = randomCode(12);
    var pt = utf8(JSON.stringify(obj)), ks = keystream(code, nonce, pt.length);
    var ct = toB64(pt.map(function (x, i) { return x ^ ks[i]; }));
    return JSON.stringify({ v: 2, n: nonce, c: ct, t: toHex(sha256(utf8('mac|' + code + '|' + nonce + '|' + ct))).slice(0, 32) });
  }
  function unseal(code, str) {
    var m = JSON.parse(str);
    if (!m || m.v !== 2 || !m.n || !m.c) return null;
    if (toHex(sha256(utf8('mac|' + code + '|' + m.n + '|' + m.c))).slice(0, 32) !== m.t) return null; // cizí nebo poškozená zpráva
    var ct = fromB64(m.c), ks = keystream(code, m.n, ct.length);
    return JSON.parse(fromUtf8(ct.map(function (x, i) { return x ^ ks[i]; })));
  }
  function topicOf(code) { return 'videoteka-' + toHex(sha256(utf8('topic|' + code))).slice(0, 24); }
  function newPairCode() { return randomCode(CODE_LEN); }
  function fmtCode(c) { return String(c).match(/.{1,4}/g).join('-'); }
  function normCode(c) {
    c = String(c || '').trim();
    if (c.indexOf(QR_PREFIX) === 0) c = c.slice(QR_PREFIX.length);
    return c.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  function validCode(c) { return c.length === CODE_LEN && c.split('').every(function (ch) { return CODE_ABC.indexOf(ch) >= 0; }); }

  function postToTv(obj) {
    var code = load('tvCode', '');
    if (!validCode(code)) return Promise.reject(new Error('NOT_PAIRED'));
    return fetch(NTFY + topicOf(code), { method: 'POST', body: seal(code, obj) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
    });
  }
  function sendToTv(item) {
    postToTv({ a: 'open', item: { key: item.key, id: item.id, type: item.type, title: item.title, year: item.year,
      poster: item.poster, backdrop: item.backdrop, overview: item.overview, vote: item.vote } })
      .then(function () { toast('Odesláno do televize: ' + item.title); })
      .catch(function (err) { toast(err.message === 'NOT_PAIRED' ? 'Nejdřív spáruj televizi v Nastavení → Televize.' : 'Odeslání se nepovedlo – zkontroluj internet.'); });
  }
  function sendKeysToTv() {
    var keys = {};
    KEY_NAMES.forEach(function (n) { if (CFG[n]) keys[n] = CFG[n]; });
    if (!keys.tmdbKey) { toast('V telefonu zatím nemáš klíč TMDB, není co posílat.'); return Promise.resolve(); }
    return postToTv({ a: 'keys', keys: keys })
      .then(function () { toast('Klíče odeslány do televize. Televize se za chvíli sama restartuje.'); })
      .catch(function () { toast('Klíče se nepodařilo odeslat – zkontroluj internet.'); });
  }
  function pairWith(raw) {
    var c = normCode(raw);
    if (!validCode(c)) { toast('Kód má 20 znaků, opiš ho přesně z televize (nebo naskenuj QR).'); return false; }
    save('tvCode', c);
    sendKeysToTv();
    toast('Spárováno s televizí');
    return true;
  }

  var tvListener = null;
  function startTvListener() {
    var code = load('pairCode', '');
    if (!validCode(code) || MOBILE || tvListener || typeof EventSource === 'undefined') return;
    tvListener = new EventSource(NTFY + topicOf(code) + '/sse');
    tvListener.onmessage = function (ev) {
      var m = null;
      try { m = unseal(code, JSON.parse(ev.data).message || ''); } catch (e) { m = null; }
      if (!m) return;
      if (m.a === 'open' && m.item && m.item.id) {
        var it = m.item;
        it.key = (it.type === 'tv' ? 'tv' : 'movie') + ':' + it.id;
        toast('Z telefonu: ' + it.title);
        go('detail', { item: it });
      } else if (m.a === 'keys' && m.keys) {
        var k = load('keys', {}), changed = false;
        KEY_NAMES.forEach(function (n) { if (m.keys[n] && m.keys[n] !== k[n]) { k[n] = m.keys[n]; changed = true; } });
        if (!changed) { toast('Klíče z telefonu už televize má.'); return; }
        save('keys', k);
        toast('Klíče z telefonu uloženy, restartuji…');
        setTimeout(function () { location.reload(); }, 1800);
      }
    };
  }
  function stopTvListener() { if (tvListener) { tvListener.close(); tvListener = null; } }

  function qrImage(text) {
    if (typeof qrcode === 'undefined') return null;
    var q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return h('img', { class: 'pairqr', src: q.createDataURL(MOBILE ? 4 : 7, 2), alt: '' });
  }

  // ----- skenování QR v telefonu (fotoaparát + jsQR přibalené v aplikaci)
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'js/jsqr.js';
      sc.onload = function () { window.jsQR ? res() : rej(new Error('jsQR')); };
      sc.onerror = function () { rej(new Error('jsQR')); };
      document.body.appendChild(sc);
    });
  }
  defineScreen('scan', function (root) {
    clear(root);
    root.appendChild(topbar([h('div', { class: 'eptitle', text: 'Skenování' })]));
    var video = h('video', { class: 'scanvideo', playsinline: 'true', muted: 'true', autoplay: 'true' });
    var msg = h('div', { class: 'sinfo scanmsg', text: 'Namiř telefon na QR kód v televizi (Nastavení → Telefon jako ovladač).' });
    var cancel = h('div', { class: 'btn focusable', 'data-fid': 'scan-cancel', text: 'Zrušit', onselect: function () { back(); } });
    root.appendChild(h('div', { class: 'scanwrap' }, [video, msg, cancel]));
    var stream = null, canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    function stop() { if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; } }
    function tick() {
      if (currentScreen !== screens.scan) { stop(); return; }
      if (video.readyState >= 2 && video.videoWidth) {
        var w = 480, hgt = Math.round(video.videoHeight * 480 / video.videoWidth);
        canvas.width = w; canvas.height = hgt;
        ctx.drawImage(video, 0, 0, w, hgt);
        var res = window.jsQR(ctx.getImageData(0, 0, w, hgt).data, w, hgt, { inversionAttempts: 'dontInvert' });
        if (res && res.data && res.data.indexOf(QR_PREFIX) === 0) {
          stop();
          if (pairWith(res.data)) { back(); return; }
        }
      }
      setTimeout(tick, 250);
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      msg.textContent = 'Fotoaparát tady není k dispozici – opiš kód z televize ručně.';
      return cancel;
    }
    loadJsQR().then(function () {
      return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    }).then(function (s) {
      if (currentScreen !== screens.scan) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      var pl = video.play();
      if (pl && pl.catch) pl.catch(function () {});
      tick();
    }).catch(function (err) {
      msg.textContent = err && err.message === 'jsQR'
        ? 'Skenování potřebuje novější APK Videotéky. Zatím opiš kód z televize ručně.'
        : 'Fotoaparát se nepodařilo spustit (' + ((err && err.name) || 'chyba') + '). Povol ho Videotéce, nebo opiš kód ručně.';
    });
    return cancel;
  });

  // ------------------------------------------------------------------ KALENDÁŘ
  defineScreen('calendar', function (root) {
    clear(root);
    root.appendChild(topbar([h('div', { class: 'eptitle', text: 'Kalendář' })]));
    var body = h('div', { class: 'vscroll calbody' });
    root.appendChild(body);
    var status = h('div', { class: 'sinfo calstatus', text: 'Načítám…' });
    body.appendChild(h('div', { class: 'gridhead' }, [h('span', { class: 'gtitle', text: 'Co přibude' }),
      h('small', { text: CFG.motnKey ? 'nové tituly na tvých službách a další díly seriálů, které sleduješ' : 'další díly seriálů, které sleduješ (pro nové tituly služeb vlož klíč Movie of the Night)' })]));
    body.appendChild(status);

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var DAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
    function dayLabel(dateStr) {
      var d = new Date(dateStr + 'T00:00:00');
      var diff = Math.round((d - today) / DAY);
      if (diff === 0) return 'Dnes';
      if (diff === 1) return 'Zítra';
      return DAYS[d.getDay()] + ' ' + d.getDate() + '. ' + (d.getMonth() + 1) + '.';
    }
    function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

    var events = []; // { date, item, tag, services }
    var jobs = [];
    // další díly sledovaných seriálů
    trackedSeries().forEach(function (t) {
      jobs.push(tvInfo(t.item).then(function (d) {
        var ne = d.next_episode_to_air;
        if (!ne || !ne.air_date) return;
        var diff = (new Date(ne.air_date + 'T00:00:00') - today) / DAY;
        if (diff < 0 || diff > 60) return;
        events.push({ date: ne.air_date, item: t.item, tag: (ne.episode_number === 1 ? 'nová řada ' : 'díl ') + ne.season_number + '×' + ne.episode_number });
      }).catch(function () {}));
    });
    // co přibude do katalogu služeb (2 stránky = až 50 změn)
    if (CFG.motnKey) {
      jobs.push(changesPage('upcoming', 1).then(function (e1) {
        return (e1.next ? changesPage('upcoming', 2) : Promise.resolve({ entries: [] })).then(function (e2) {
          var all = e1.entries.concat(e2.entries).filter(function (en) { return en.ts; });
          return entriesToItems(all).then(function (items) {
            items.forEach(function (it) {
              var sv = serviceById(it.change.svc);
              events.push({ date: ymd(new Date(it.change.ts * 1000)), item: it, tag: 'přibude', services: sv ? [sv] : [] });
            });
          });
        });
      }).catch(function (err) { status.textContent = errorText(err); }));
    }
    Promise.all(jobs).then(function () {
      if (currentScreen !== screens.calendar) return;
      var uniq = {};
      events = events.filter(function (ev) { var k = ev.date + '|' + ev.item.key; if (uniq[k]) return false; uniq[k] = 1; return true; });
      events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var groups = {}, order = [];
      events.forEach(function (ev) { if (!groups[ev.date]) { groups[ev.date] = []; order.push(ev.date); } groups[ev.date].push(ev); });
      if (status.textContent === 'Načítám…') status.textContent = order.length ? '' : 'V nejbližších týdnech tu nic není.';
      var firstCard = null;
      order.forEach(function (date) {
        var r = h('div', { class: 'hscroll' });
        groups[date].forEach(function (ev) {
          var c = card(ev.item, 'cal-' + date + '-' + ev.item.key, null);
          c.querySelector('.poster').appendChild(h('div', { class: 'newtag' + (ev.tag === 'přibude' ? ' soon' : ''), text: ev.tag }));
          if (ev.services) setBadges(c, ev.services);
          r.appendChild(c);
          if (!firstCard) firstCard = c;
        });
        body.appendChild(row(dayLabel(date), titulu(groups[date].length), r));
      });
      body.appendChild(h('div', { style: 'height:120px' }));
      if (firstCard && (!focused || !document.body.contains(focused))) setFocus(firstCard);
    });
    return null;
  });

  // ------------------------------------------------------------------ HEREC / TVŮRCE
  defineScreen('person', function (root, params) {
    clear(root);
    root.appendChild(topbar([h('div', { class: 'eptitle', text: params.name })]));
    var sc = h('div', { class: 'vscroll gridscreen' });
    var head = h('div', { class: 'personhead' });
    var grid = h('div', { class: 'grid' });
    var status = h('div', { class: 'sinfo gridstatus', text: 'Hledám, co s ním běží na tvých službách…' });
    sc.appendChild(head); sc.appendChild(grid); sc.appendChild(status);
    root.appendChild(sc);
    tmdb('/person/' + params.id, { append_to_response: 'combined_credits' }).then(function (p) {
      var photo = h('div', { class: 'pphoto' }, [p.profile_path ? h('img', { src: IMG + 'w185' + p.profile_path, alt: '' }) : null]);
      var bits = [];
      if (p.birthday) bits.push('nar. ' + p.birthday.split('-').reverse().map(function (x) { return String(+x); }).join('. '));
      if (p.place_of_birth) bits.push(p.place_of_birth);
      head.appendChild(photo);
      head.appendChild(h('div', { class: 'ptext' }, [h('div', { class: 'gtitle', text: p.name }), h('div', { class: 'pmeta', text: bits.join(' · ') }),
        h('div', { class: 'pbio', text: p.biography || '' })]));
      var seen = {}, list = [];
      [].concat((p.combined_credits || {}).cast || [], (p.combined_credits || {}).crew || []).forEach(function (r) {
        if (r.media_type !== 'movie' && r.media_type !== 'tv') return;
        var it = normalize(r);
        if (seen[it.key]) return;
        seen[it.key] = 1;
        it.pop = r.popularity || 0;
        list.push(it);
      });
      list.sort(function (a, b) { return b.pop - a.pop; });
      list = list.slice(0, 60);
      var found = 0, done = 0;
      return Promise.all(list.map(function (it) {
        return enqueue(function () { return providersFor(it); }).then(function (res) {
          done++;
          if (res.mine.length && !isHidden(it)) {
            found++;
            var c = card(it, 'pc-' + it.key);
            setBadges(c, res.mine);
            grid.appendChild(c);
            if (found === 1 && currentScreen === screens.person && (!focused || !document.body.contains(focused))) setFocus(c);
          }
          status.textContent = 'Prohledáno ' + done + ' z ' + list.length + ' titulů…';
        }, function () { done++; });
      })).then(function () {
        status.textContent = found ? 'Na tvých službách: ' + titulu(found) + '.' : 'Teď s ním na tvých službách nic neběží.';
      });
    }).catch(function (err) { status.textContent = errorText(err); });
    return null;
  });

  // ------------------------------------------------------------------ SÉRIE A DÍLY
  defineScreen('episodes', function (root, params) {
    clear(root);
    var item = params.item;
    root.appendChild(topbar([h('div', { class: 'eptitle', text: item.title })]));
    var wrap = h('div', { class: 'episodes' });
    var seasonsEl = h('div', { class: 'seasons vscroll' });
    var listWrap = h('div', { class: 'eplist vscroll' });
    wrap.appendChild(seasonsEl);
    wrap.appendChild(listWrap);
    root.appendChild(wrap);
    seasonsEl.appendChild(h('div', { class: 'sinfo', text: 'Načítám série…' }));

    var services = [];
    providersFor(item).then(function (res) { services = res.mine; }).catch(function () {});
    var today = new Date().toISOString().slice(0, 10);
    var curSeason = null;

    function play(ep) {
      setProgress(item, ep.season_number, ep.episode_number);
      markList();
      var s = services[0];
      if (!s) { toast('Seriál teď na tvých službách není, díl ' + epLabel(ep.season_number, ep.episode_number) + ' jsem si poznamenal.'); return; }
      playTitle(s, item);
      toast('Otevírám ' + s.name + ' – pusť díl ' + epLabel(ep.season_number, ep.episode_number) + (ep.name ? ' „' + ep.name + '"' : ''));
    }
    function markList() {
      Array.prototype.forEach.call(listWrap.querySelectorAll('.ep'), function (el) {
        var sN = +el.getAttribute('data-s'), eN = +el.getAttribute('data-e');
        el.classList.toggle('watched', isWatched(item, sN, eN));
      });
      var nextEl = Array.prototype.filter.call(listWrap.querySelectorAll('.ep'), function (el) { return !el.classList.contains('watched') && !el.classList.contains('future'); })[0];
      Array.prototype.forEach.call(listWrap.querySelectorAll('.ep.next'), function (el) { el.classList.remove('next'); });
      if (nextEl && progress[item.key]) nextEl.classList.add('next');
      return nextEl;
    }

    function loadSeason(n, focusEpisodes) {
      curSeason = n;
      Array.prototype.forEach.call(seasonsEl.querySelectorAll('.season'), function (el) {
        el.classList.toggle('cur', +el.getAttribute('data-s') === n);
      });
      clear(listWrap);
      listWrap.scrollTop = 0;
      listWrap.appendChild(h('div', { class: 'sinfo', text: 'Načítám díly…' }));
      tmdb('/tv/' + item.id + '/season/' + n).then(function (d) {
        if (curSeason !== n) return;
        clear(listWrap);
        (d.episodes || []).forEach(function (ep) {
          var future = ep.air_date && ep.air_date > today;
          var meta = [];
          if (ep.air_date) meta.push((future ? 'vyjde ' : '') + fmtDate(ep.air_date) + ' ' + ep.air_date.slice(0, 4));
          if (ep.runtime) meta.push(ep.runtime + ' min');
          var el = h('div', { class: 'ep focusable' + (future ? ' future' : ''), 'data-fid': 'ep-' + n + '-' + ep.episode_number,
            'data-s': n, 'data-e': ep.episode_number }, [
            h('div', { class: 'still' }, [ep.still_path ? h('img', { src: IMG + 'w300' + ep.still_path, alt: '' }) : null,
              h('div', { class: 'epcheck', text: '✓' })]),
            h('div', { class: 'eptext' }, [
              h('div', { class: 'epname', text: epLabel(n, ep.episode_number) + '  ' + (ep.name || '') }),
              h('div', { class: 'epmeta', text: meta.join(' · ') }),
              h('div', { class: 'epov', text: ep.overview || '' })
            ])
          ]);
          el._select = function () { play(ep); };
          listWrap.appendChild(el);
        });
        if (!(d.episodes || []).length) listWrap.appendChild(h('div', { class: 'sinfo', text: 'K téhle sérii nejsou díly.' }));
        listWrap.appendChild(h('div', { style: 'height:200px' }));
        var nextEl = markList();
        if (focusEpisodes) setFocus(nextEl || listWrap.querySelector('.ep'));
      }).catch(function (err) {
        clear(listWrap);
        listWrap.appendChild(h('div', { class: 'sinfo', text: errorText(err) }));
      });
    }

    tvInfo(item).then(function (d) {
      clear(seasonsEl);
      var seasons = (d.seasons || []).filter(function (x) { return x.episode_count > 0; })
        .sort(function (a, b) { return (a.season_number || 999) - (b.season_number || 999); }); // speciály na konec
      var first = null, want = null, pr = progress[item.key];
      seasons.forEach(function (x) {
        var el = h('div', { class: 'season pitem focusable', 'data-fid': 'season-' + x.season_number, 'data-s': x.season_number },
          [x.season_number ? x.season_number + '. série' : 'Speciály', h('small', { text: x.episode_count + ' dílů' })]);
        el._select = function () { loadSeason(x.season_number, false); };
        seasonsEl.appendChild(el);
        if (!first && x.season_number) first = el;
        if (pr && x.season_number === pr.s) want = el;
      });
      if (!MOBILE) seasonsEl.appendChild(h('div', { style: 'height:120px' }));
      var start = want || first || seasonsEl.querySelector('.season');
      if (!start) { seasonsEl.appendChild(h('div', { class: 'sinfo', text: 'Série nejsou k dispozici.' })); return; }
      var sN = +start.getAttribute('data-s');
      // když je v rozkoukané sérii všechno viděné, otevři další
      if (pr && want) {
        var cur = seasons.filter(function (x) { return x.season_number === pr.s; })[0];
        var nxt = seasons.filter(function (x) { return x.season_number === pr.s + 1; })[0];
        if (cur && pr.e >= cur.episode_count && nxt) sN = nxt.season_number;
      }
      if (currentScreen === screens.episodes) setFocus(seasonsEl.querySelector('[data-s="' + sN + '"]'));
      loadSeason(sN, !!pr);
    }).catch(function (err) {
      clear(seasonsEl);
      seasonsEl.appendChild(h('div', { class: 'sinfo', text: errorText(err) }));
    });
    return null;
  });

  // ------------------------------------------------------------------ POŘADÍ ŘÁDKŮ
  defineScreen('order', function (root) {
    clear(root);
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'picker' }, [h('h2', { text: 'Pořadí řádků na domovské obrazovce' })]);
    var sc = h('div', { class: 'vscroll' });
    wrap.appendChild(sc);
    root.appendChild(wrap);
    root.appendChild(h('div', { class: 'side-help' }, [
      MOBILE ? 'Šipkami ▲▼ posuneš řádek nahoru nebo dolů.' : 'OK vezme řádek, šipkami nahoru a dolů ho posuneš, dalším OK ho položíš.', h('br'), h('br'),
      'Vypnuté řádky zapneš v Nastavení → Obsah. Řádek „Přibylo na tvých službách" je vždy nahoře.'
    ]));
    var names = {};
    rowDefs().forEach(function (d) { names[d.id] = d.name; });
    var moving = null;
    function toggle(el) {
      if (moving) { moving.classList.remove('moving'); moving = null; save('settings', settings); toast('Pořadí uloženo'); }
      else { moving = el; el.classList.add('moving'); }
    }
    rowOrder().forEach(function (id) {
      var on = isRowOn(id);
      var el = h('div', { class: 'pitem focusable' + (on ? '' : ' off'), 'data-fid': 'o-' + id, 'data-id': id },
        [names[id], on ? null : h('small', { text: 'vypnuto' })]);
      el._select = function () { toggle(el); };
      if (MOBILE) {
        var mv = function (dir) {
          var sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
          if (!sib || !sib.classList.contains('pitem')) return;
          if (dir < 0) sc.insertBefore(el, sib); else sc.insertBefore(sib, el);
          content().order = Array.prototype.map.call(sc.querySelectorAll('.pitem'), function (x) { return x.getAttribute('data-id'); });
          save('settings', settings);
        };
        var up = h('span', { class: 'mv focusable', text: '▲' }); up._select = function () { mv(-1); };
        var dn = h('span', { class: 'mv focusable', text: '▼' }); dn._select = function () { mv(1); };
        el._select = function () {};
        el.appendChild(h('span', { class: 'mvs' }, [up, dn]));
      }
      sc.appendChild(el);
    });
    sc.appendChild(h('div', { style: 'height:200px' }));
    screens.order.onKey = function (code) {
      if (!moving) return false;
      if (code === KEY.UP || code === KEY.DOWN) {
        var sib = code === KEY.UP ? moving.previousElementSibling : moving.nextElementSibling;
        if (sib && sib.classList.contains('pitem')) {
          if (code === KEY.UP) sc.insertBefore(moving, sib); else sc.insertBefore(sib, moving);
          content().order = Array.prototype.map.call(sc.querySelectorAll('.pitem'), function (x) { return x.getAttribute('data-id'); });
          save('settings', settings);
          setFocus(moving);
        }
        return true;
      }
      if (code === KEY.BACK || code === KEY.ESC || code === KEY.BACKSPACE) { toggle(moving); return true; }
      return code === KEY.LEFT || code === KEY.RIGHT;
    };
    return sc.querySelector('.pitem');
  });

  // ------------------------------------------------------------------ SKRYTÉ TITULY
  defineScreen('hiddenlist', function (root) {
    clear(root);
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'picker' }, [h('h2', { text: 'Skryté a viděné tituly' })]);
    var sc = h('div', { class: 'vscroll' });
    wrap.appendChild(sc);
    root.appendChild(wrap);
    root.appendChild(h('div', { class: 'side-help', text: 'OK vrátí titul zpátky do nabídky. Viděné seriály Videotéka dál hlídá a ukáže ti jejich nové díly.' }));
    var keys = Object.keys(hiddenItems).sort(function (a, b) { return hiddenItems[b].t - hiddenItems[a].t; });
    if (!keys.length) sc.appendChild(h('div', { class: 'sinfo', text: 'Nemáš žádné skryté tituly.' }));
    keys.forEach(function (k) {
      var e = hiddenItems[k];
      var el = h('div', { class: 'pitem focusable', 'data-fid': 'h-' + k },
        [e.title + (e.year ? ' (' + e.year + ')' : ''), h('small', { text: hiddenLabel(e) + (e.type === 'tv' ? ' · seriál' : ' · film') })]);
      el._select = function () {
        var next = el.nextElementSibling && el.nextElementSibling.classList.contains('pitem') ? el.nextElementSibling : el.previousElementSibling;
        unhide(k);
        sc.removeChild(el);
        toast('Vráceno: ' + e.title);
        focused = null;
        if (next && next.classList.contains('pitem')) setFocus(next);
        else { sc.insertBefore(h('div', { class: 'sinfo', text: 'Nemáš žádné skryté tituly.' }), sc.firstChild); }
      };
      sc.appendChild(el);
    });
    sc.appendChild(h('div', { style: 'height:200px' }));
    return sc.querySelector('.pitem');
  });

  // ------------------------------------------------------------------ VÝBĚR APLIKACE
  defineScreen('picker', function (root, params) {
    clear(root);
    var s = params.service, st = svcSettings(s);
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'picker' }, [h('h2', { text: 'Která aplikace v televizi je ' + s.name + '?' })]);
    var sc = h('div', { class: 'vscroll' });
    wrap.appendChild(sc);
    root.appendChild(wrap);

    function choose(id, name) {
      st.appId = id; st.appName = name; save('settings', settings);
      toast(s.name + ': ' + (name || 'automaticky'));
      back();
    }

    var first = h('div', { class: 'pitem focusable', text: 'Automaticky (podle názvu)', onselect: function () { choose(null, null); } });
    sc.appendChild(first);
    var apps = installedApps.slice().sort(function (a, b) {
      return (s.match.test(b.name) ? 1 : 0) - (s.match.test(a.name) ? 1 : 0);
    });
    if (!IS_TV) sc.appendChild(h('div', { class: 'sinfo', text: 'Seznam aplikací je k dispozici jen v televizi.' }));
    apps.forEach(function (a) {
      sc.appendChild(h('div', { class: 'pitem focusable', onselect: function () { choose(a.id, a.name); } },
        [a.name, h('small', { text: a.id })]));
    });
    sc.appendChild(h('div', { style: 'height:200px' }));
    var current = st.appId ? apps.filter(function (a) { return a.id === st.appId; })[0] : null;
    return current ? sc.children[apps.indexOf(current) + (IS_TV ? 1 : 2)] : first;
  });

  // ------------------------------------------------------------------ klávesy
  document.addEventListener('keydown', function (e) {
    stopHomeRestore();
    if (e.target && e.target.tagName === 'INPUT') {
      if (e.keyCode === KEY.ENTER) e.target.blur();
      return;
    }
    if (currentScreen && currentScreen.onKey && currentScreen.onKey(e.keyCode)) { e.preventDefault(); return; }
    switch (e.keyCode) {
      case KEY.RED: quickHide('skip'); break;
      case KEY.GREEN: quickHide('seen'); break;
      case KEY.YELLOW: undoHide(); break;
      case KEY.LEFT: move('left'); break;
      case KEY.RIGHT: move('right'); break;
      case KEY.UP: move('up'); break;
      case KEY.DOWN: move('down'); break;
      case KEY.ENTER:
        if (focused && focused._select) focused._select();
        break;
      case KEY.BACK:
      case KEY.ESC:
      case KEY.BACKSPACE:
        back();
        break;
      default: return;
    }
    e.preventDefault();
  });

  // myš / Smart ovladač s ukazatelem
  document.addEventListener('click', function (e) {
    var el = e.target;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('focusable')) { setFocus(el); if (el._select) el._select(); return; }
      el = el.parentNode;
    }
  });
  document.addEventListener('mouseover', function (e) {
    if (MOBILE) return;
    var el = e.target;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('focusable')) { if (el !== focused) setFocus(el); return; }
      el = el.parentNode;
    }
  });

  // po návratu z Netflixu apod. obnov seznam aplikací (mohly přibýt)
  function onResumeApp() {
    if (pendingFeedback) setTimeout(askFeedback, 400);
    // připravená aktualizace se nasadí po návratu do aplikace, pokud jsi na domovské obrazovce
    if (UPD && UPD.pendingVersion() && currentScreen === screens.home && !pendingFeedback) { UPD.restart(); return; }
    autoCheckUpdates();
    checkArrivals();
    detectApps(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !ANDROID) onResumeApp(); });
  // pro mobilní aplikaci: tlačítko Zpět a návrat do aplikace
  window.videotekaBack = function () { back(); };
  window.videotekaResume = function () { onResumeApp(); };

  // ------------------------------------------------------------------ start
  var pending = 2;
  function ready() {
    if (--pending !== 0) return;
    if (IS_TV) {
      try {
        ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow'].forEach(function (k) { window.tizen.tvinputdevice.registerKey(k); });
      } catch (e) { /* starší TV */ }
    }
    go('home');
    var fb = load('pendingFb', null);
    if (fb) {
      save('pendingFb', null);
      var fsvc = serviceById(fb.s);
      if (fsvc && fb.item && Date.now() - fb.t < 2 * 3600 * 1000) {
        pendingFeedback = { service: fsvc, method: fb.m, item: fb.item };
        go('detail', { item: fb.item });
        setTimeout(askFeedback, 900);
      }
    }
    setTimeout(checkArrivals, 2500);
    startTvListener();
    if (UPD) {
      UPD.ready();
      if (UPD.notice) toast(UPD.notice);
      setTimeout(autoCheckUpdates, 4000);
    }
  }
  detectApps(ready);
  resolveProviders(ready);
})();
