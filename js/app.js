/* Promítárna – jedna domovská obrazovka pro Netflix, HBO Max, Disney+, Prime Video a Apple TV.
   Psáno v ES2015 bez async/await, aby to běželo na Samsung TV od roku 2018 (Tizen 4+). */
'use strict';
(function () {
  var CFG = window.PROMITARNA_CONFIG || {};
  var REGION = CFG.region || 'CZ';
  var LANG = CFG.language || 'cs-CZ';
  var SERVICES = window.SERVICES;
  var IS_TV = typeof window.tizen !== 'undefined' && !!window.tizen.application;
  var IMG = 'https://image.tmdb.org/t/p/';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8 };

  // ------------------------------------------------------------------ úložiště
  function load(key, def) {
    try { var v = localStorage.getItem('promitarna.' + key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem('promitarna.' + key, JSON.stringify(val)); } catch (e) { /* plné úložiště */ }
  }

  var settings = load('settings', {});   // { netflix: { enabled: true, appId: '...' , appName: '...' } }
  var watchlist = load('watchlist', []); // [{ key, id, type, title, year, poster, services: [] }]
  var installedApps = [];                // [{ id, name }] – jen na televizi

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
    ensureVisible(el);
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
    screens[name] = { name: name, el: $('screen-' + name), render: render, lastFocus: null };
  }

  function go(name, params, opts) {
    opts = opts || {};
    if (currentScreen && !opts.replace) history.push({ name: currentScreen.name, params: currentScreen.params, lastFocus: currentScreen.lastFocus });
    show(name, params, null);
  }

  function show(name, params, restoreFocus) {
    Object.keys(screens).forEach(function (k) { screens[k].el.classList.remove('active'); });
    var s = screens[name];
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
      Object.keys(screens).forEach(function (k) { screens[k].el.classList.remove('active'); });
      currentScreen = screens.search;
      currentScreen.el.classList.add('active');
      if (focused) focused.classList.remove('focus');
      focused = null;
      setFocus(prev.lastFocus || focusablesIn(currentScreen.el)[0]);
      return;
    }
    show(prev.name, prev.params, null); // znovu vykresli (mohl se změnit seznam/nastavení)
    // obnov fokus na stejný prvek podle data-fid
    var fid = prev.lastFocus && prev.lastFocus.getAttribute('data-fid');
    if (fid) {
      var el = currentScreen.el.querySelector('[data-fid="' + fid + '"]');
      if (el) setFocus(el);
      else currentScreen.pendingFid = fid; // řádek se ještě načítá
    }
  }

  function exitApp() {
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
      vote: r.vote_average || 0
    };
  }

  function discoverFor(service) {
    var p = {
      watch_region: REGION,
      with_watch_providers: service.providers.join('|'),
      with_watch_monetization_types: 'flatrate',
      sort_by: 'popularity.desc'
    };
    return Promise.all([
      tmdb('/discover/movie', Object.assign({}, p)),
      tmdb('/discover/tv', Object.assign({}, p))
    ]).then(function (res) {
      var m = res[0].results || [], t = res[1].results || [], out = [];
      for (var i = 0; i < 12; i++) {
        if (t[i]) out.push(normalize(t[i], 'tv'));
        if (m[i]) out.push(normalize(m[i], 'movie'));
      }
      return out;
    });
  }

  function errorText(err) {
    if (err && err.message === 'NO_KEY') return 'Pro tipy a hledání doplň TMDB klíč do js/config.js (viz README).';
    return 'Nepodařilo se načíst data (' + (err && err.message || 'chyba sítě') + ').';
  }

  // ------------------------------------------------------------------ spouštění aplikací v TV
  function detectApps(done) {
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

  function launchService(service) {
    if (!IS_TV) { toast('V televizi by se teď spustila aplikace ' + service.name + '.'); return; }
    var ids = candidateIds(service), i = 0;
    toast('Spouštím ' + service.name + '…');
    (function tryNext() {
      if (i >= ids.length) {
        toast('Aplikaci ' + service.name + ' se nepodařilo spustit. Vyber ji v Nastavení.');
        return;
      }
      var id = ids[i++];
      try { window.tizen.application.launch(id, function () {}, tryNext); }
      catch (e) { tryNext(); }
    })();
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
        : h('div', { class: 'ph', text: item.title })
    ]);
    var badges = null;
    if (serviceIds && serviceIds.length) {
      badges = h('div', { class: 'badges' }, serviceIds.map(function (id) {
        var s = serviceById(id);
        return s ? h('span', { class: 'badge', style: 'background:' + s.colors[0], text: s.short }) : null;
      }));
    }
    return h('div', {
      class: 'card focusable', 'data-fid': fid || ('c' + (fidCounter++)),
      onselect: function () { go('detail', { item: item }); }
    }, [poster, badges, h('div', { class: 'ctitle', text: item.title + (item.year ? ' (' + item.year + ')' : '') })]);
  }

  function row(title, sub, content) {
    return h('div', { class: 'row' }, [
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
      h('div', { class: 'brand' }, ['Promít', h('span', { text: 'árna' })]),
      h('div', { class: 'spacer' })
    ].concat(extra || []).concat([clock()]));
  }

  // ------------------------------------------------------------------ DOMŮ
  defineScreen('home', function (root) {
    clear(root);
    var searchBtn = h('div', { class: 'pill focusable', 'data-fid': 'nav-search', text: 'Hledat', onselect: function () { go('search', { q: '' }); } });
    var setBtn = h('div', { class: 'pill focusable', 'data-fid': 'nav-settings', text: 'Nastavení', onselect: function () { go('settings'); } });
    root.appendChild(topbar([searchBtn, setBtn]));

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
    body.appendChild(row('Moje služby', 'OK spustí aplikaci', tiles));

    // můj seznam
    if (watchlist.length) {
      var wl = h('div', { class: 'hscroll' });
      watchlist.forEach(function (w) { wl.appendChild(card(w, 'wl-' + w.key, w.services)); });
      body.appendChild(row('Chci vidět', watchlist.length + ' titulů', wl));
    }

    // populární na každé službě
    enabledServices().forEach(function (s) {
      var r = h('div', { class: 'hscroll' });
      for (var i = 0; i < 7; i++) r.appendChild(h('div', { class: 'card loading' }, [h('div', { class: 'poster' })]));
      var rowEl = row('Populární na ' + s.name, null, r);
      body.appendChild(rowEl);
      discoverFor(s).then(function (items) {
        clear(r);
        items.forEach(function (it) { r.appendChild(card(it, 'pop-' + s.id + '-' + it.key, [s.id])); });
        if (currentScreen === screens.home && currentScreen.pendingFid) {
          var el = root.querySelector('[data-fid="' + currentScreen.pendingFid + '"]');
          if (el) { setFocus(el); currentScreen.pendingFid = null; }
        }
      }).catch(function (err) {
        clear(r);
        rowEl.replaceChild(h('div', { class: 'note', text: errorText(err) }), r);
      });
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
        grid.appendChild(h('div', { class: 'msg', text: 'Piš na klávesnici vlevo. Výsledky se ukážou tady i se službou, kde titul běží.' }));
        return;
      }
      grid.appendChild(h('div', { class: 'msg', text: 'Hledám…' }));
      tmdb('/search/multi', { query: query.trim(), include_adult: 'false' }).then(function (j) {
        if (my !== seq) return;
        clear(grid);
        var items = (j.results || []).filter(function (r) { return r.media_type === 'movie' || r.media_type === 'tv'; })
          .slice(0, 18).map(function (r) { return normalize(r); });
        if (!items.length) { grid.appendChild(h('div', { class: 'msg', text: 'Nic jsem nenašel.' })); return; }
        items.forEach(function (it) {
          var c = card(it, 'sr-' + it.key);
          grid.appendChild(c);
          // dočti, kde se titul streamuje, a přidej odznaky
          providersFor(it).then(function (res) {
            if (!res.mine.length) return;
            c.querySelector('.poster').parentNode.insertBefore(
              h('div', { class: 'badges' }, res.mine.map(function (s) {
                return h('span', { class: 'badge', style: 'background:' + s.colors[0], text: s.short });
              })), c.querySelector('.ctitle'));
          }).catch(function () {});
        });
      }).catch(function (err) {
        if (my !== seq) return;
        clear(grid);
        grid.appendChild(h('div', { class: 'msg', text: errorText(err) }));
      });
    }

    var firstKey = null;
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
  function providersFor(item) {
    return tmdb('/' + item.type + '/' + item.id + '/watch/providers').then(function (j) {
      var reg = (j.results || {})[REGION] || {};
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
    if (item.vote) metaEl.appendChild(h('span', null, ['  ·  ', h('b', { text: '★ ' + item.vote.toFixed(1) })]));

    var actions = h('div', { class: 'actions' });
    var info = h('div', { class: 'detail-info' }, [
      h('h1', { text: item.title }),
      metaEl,
      h('div', { class: 'overview', text: item.overview || '' }),
      h('h3', { text: 'Kde sledovat' }),
      actions
    ]);
    root.appendChild(h('div', { class: 'detail-body' }, [
      h('div', { class: 'dposter' }, [item.poster ? h('img', { src: IMG + 'w500' + item.poster, alt: '' }) : null]),
      info
    ]));
    root.appendChild(h('div', { class: 'hintbar', text: 'OK otevře aplikaci služby · Zpět vrátí na předchozí obrazovku' }));

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
    actions.appendChild(listBtn);
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
          text: '▶  ' + s.name, onselect: function () { launchService(s); }
        });
        actions.insertBefore(b, listBtn);
        if (!firstPlay) firstPlay = b;
      });
      if (!res.mine.length) info.appendChild(h('div', { class: 'unavailable', text: 'Na tvých službách teď není.' }));
      if (res.others.length) info.appendChild(h('div', { class: 'also', text: 'V předplatném také na: ' + res.others.join(', ') }));
      if (res.rent.length) info.appendChild(h('div', { class: 'also', text: 'K pronájmu nebo koupi: ' + res.rent.slice(0, 6).join(', ') }));
      // aktualizuj odznaky v uloženém seznamu
      watchlist.forEach(function (w) {
        if (w.key === item.key) w.services = res.mine.map(function (s) { return s.id; });
      });
      save('watchlist', watchlist);
      if (firstPlay && focused === listBtn) setFocus(firstPlay);
    }).catch(function (err) {
      loading.textContent = errorText(err);
    });

    return listBtn;
  });

  // ------------------------------------------------------------------ NASTAVENÍ
  defineScreen('settings', function (root) {
    clear(root);
    root.appendChild(topbar([]));
    var wrap = h('div', { class: 'settings' });
    root.appendChild(wrap);
    var first = null;

    SERVICES.forEach(function (s) {
      var st = svcSettings(s);
      var d = detectedApp(s);
      var appLabel = st.appId ? (st.appName || st.appId) : (d ? d.name + ' (automaticky)' : (IS_TV ? 'nenalezeno – vyber' : 'automaticky'));
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
      var test = h('div', {
        class: 'btn focusable', 'data-fid': 'set-test-' + s.id, text: 'Vyzkoušet',
        onselect: function () { launchService(s); }
      });
      if (!first) first = toggle;
      wrap.appendChild(h('div', { class: 'srow' }, [
        h('div', { class: 'sdot', style: 'background:' + s.colors[0] }),
        h('div', { class: 'sname', text: s.name }),
        toggle, pick, test
      ]));
    });

    wrap.appendChild(h('div', { class: 'srow' }, [
      h('div', { class: 'sname', text: 'Chci vidět' }),
      h('div', {
        class: 'btn focusable', 'data-fid': 'set-clear-wl', text: 'Vyprázdnit seznam (' + watchlist.length + ')',
        onselect: function () { watchlist = []; save('watchlist', watchlist); toast('Seznam je prázdný'); show('settings', {}, null); }
      })
    ]));

    wrap.appendChild(h('div', { class: 'sinfo' }, [
      'Data o tom, co kde běží: ', h('b', { text: 'TMDB / JustWatch' }), ', region ', h('b', { text: REGION }),
      '. TMDB klíč: ', h('b', { text: CFG.tmdbKey ? 'nastaven' : 'chybí (js/config.js)' }),
      IS_TV ? '. Nalezeno aplikací v TV: ' + installedApps.length + '.' : '. Běží mimo televizi (náhled v prohlížeči).'
    ]));
    return first;
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
    switch (e.keyCode) {
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
    var el = e.target;
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains('focusable')) { if (el !== focused) setFocus(el); return; }
      el = el.parentNode;
    }
  });

  // po návratu z Netflixu apod. obnov seznam aplikací (mohly přibýt)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) detectApps(function () {});
  });

  // ------------------------------------------------------------------ start
  detectApps(function () { go('home'); });
})();
