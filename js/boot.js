/* Zavaděč Videotéky s automatickými aktualizacemi.
   Nainstalovaný balíček obsahuje záložní kopii aplikace. Novější verze se stahují z GitHubu
   (soubor version.json v repozitáři), ukládají v televizi a použijí se při dalším spuštění.
   js/config.js (klíče) se nikdy nestahuje ani nepřepisuje. */
'use strict';
(function () {
  // Verze „slupky" (index.html, boot.js, config.xml, oprávnění). Když aktualizace potřebuje
  // novější slupku (version.json → minShell), stáhnout nejde a je nutné aplikaci přeinstalovat.
  var SHELL = 1;
  // Úložiště na GitHubu, ze kterého se stahují aktualizace (vlastník/název). U vlastní kopie
  // (fork) ho sestavení APK nastaví samo; prázdná hodnota aktualizace vypne.
  var REPO = 'zarybjir/Tv_app';
  // Webová verze (otevřená z adresy v prohlížeči, bez televize a bez mobilní aplikace) se načítá
  // vždy čerstvá ze serveru, aktualizace si proto nestahuje.
  var WEB = !window.tizen && !window.VideotekaAndroid && /^https?:$/.test(location.protocol);
  var SOURCE = REPO && !WEB ? 'https://raw.githubusercontent.com/' + REPO + '/main/' : '';
  var BUNDLED_FILES = ['css/style.css', 'js/services.js', 'js/qrcode.js', 'js/app.js'];
  var LS = 'promitarna.update.';

  function get(k) { try { return localStorage.getItem(LS + k); } catch (e) { return null; } }
  function set(k, v) {
    try { if (v == null) localStorage.removeItem(LS + k); else localStorage.setItem(LS + k, v); } catch (e) { /* plno */ }
  }
  function cmp(a, b) {
    a = String(a).split('.'); b = String(b).split('.');
    for (var i = 0; i < 3; i++) {
      var d = (parseInt(a[i], 10) || 0) - (parseInt(b[i], 10) || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  var bundled = window.PROMITARNA_BUNDLED || '0.0.0';
  var pkg = null;
  try { pkg = JSON.parse(get('pkg') || 'null'); } catch (e) { pkg = null; }
  if (WEB) pkg = null;
  var notice = null;

  // Minulé spuštění stažené verze nedoběhlo → verzi zahoď a označ jako vadnou.
  if (pkg && get('pending') === pkg.version) {
    set('bad', pkg.version);
    set('pkg', null);
    notice = 'Verze ' + pkg.version + ' nenaběhla, obnovena verze ' + bundled + '.';
    pkg = null;
  }
  set('pending', null);

  var use = pkg && cmp(pkg.version, bundled) > 0 ? pkg : null;
  if (pkg && !use) set('pkg', null); // nainstalovaná verze je stejná nebo novější

  var running = use ? use.version : bundled;
  if (use) set('pending', use.version);

  // Po naběhnutí nové verze ukaž jednou, co je nového.
  if (!notice && get('seen') && cmp(running, get('seen')) > 0) {
    notice = 'Aktualizováno na verzi ' + running + (use && use.notes ? ': ' + use.notes : '.');
  }
  set('seen', running);

  // ---------------------------------------------------------------- API pro aplikaci
  var ready = null; // stažená verze čekající na restart

  function check() {
    if (!SOURCE) return Promise.resolve({ status: 'latest', version: running });
    var bust = '?t=' + Date.now();
    set('lastCheck', String(Date.now()));
    return fetch(SOURCE + 'version.json' + bust, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (man) {
      if (!man || !man.version || !man.files) throw new Error('vadný version.json');
      if (ready && cmp(man.version, ready.version) <= 0) return { status: 'ready', version: ready.version, notes: ready.notes };
      if (cmp(man.version, running) <= 0) return { status: 'latest', version: running };
      if (man.version === get('bad')) return { status: 'bad', version: man.version };
      if (man.minShell && man.minShell > SHELL) return { status: 'reinstall', version: man.version, notes: man.notes };
      var files = man.files.filter(function (f) { return /^(css|js)\/[\w.-]+\.(css|js)$/.test(f) && f !== 'js/config.js'; });
      return Promise.all(files.map(function (f) {
        return fetch(SOURCE + f + bust, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) throw new Error(f + ': HTTP ' + r.status);
          return r.text();
        });
      })).then(function (texts) {
        var stored = {};
        files.forEach(function (f, i) {
          if (!texts[i] || texts[i].length < 20) throw new Error(f + ' je prázdný');
          if (/\.js$/.test(f)) new Function(texts[i]); // syntaktická kontrola, nespouští se
          stored[f] = texts[i];
        });
        var p = { version: man.version, notes: man.notes || '', order: files, files: stored };
        var json = JSON.stringify(p);
        set('pkg', json);
        if (get('pkg') !== json) throw new Error('v televizi není místo');
        ready = p;
        return { status: 'ready', version: p.version, notes: p.notes };
      });
    });
  }

  window.PromitarnaUpdate = {
    version: running,
    web: WEB,
    bundled: bundled,
    downloaded: !!use,
    notice: notice,
    lastCheck: function () { return parseInt(get('lastCheck'), 10) || 0; },
    auto: function (v) {
      if (v === undefined) return get('auto') !== 'off';
      set('auto', v ? null : 'off');
      return v;
    },
    pendingVersion: function () { return ready ? ready.version : null; },
    check: check,
    restart: function () { location.reload(); },
    // vrátí nainstalovanou verzi (pro případ, že by stažená dělala potíže)
    reset: function () { set('pkg', null); if (use) set('bad', use.version); location.reload(); },
    // aplikace úspěšně naběhla
    ready: function () { set('pending', null); }
  };

  // ---------------------------------------------------------------- načtení aplikace (až po API výše)
  if (use) {
    use.order.forEach(function (f) {
      var el;
      if (/\.css$/.test(f)) { el = document.createElement('style'); el.textContent = use.files[f]; document.head.appendChild(el); }
      else { el = document.createElement('script'); el.textContent = use.files[f]; document.body.appendChild(el); }
    });
  } else {
    // na webu přidej k adresám verzi, ať prohlížeč po vydání nenačte staré soubory z mezipaměti
    var q = WEB ? '?v=' + encodeURIComponent(bundled) : '';
    BUNDLED_FILES.forEach(function (f) {
      var el;
      if (/\.css$/.test(f)) { el = document.createElement('link'); el.rel = 'stylesheet'; el.href = f + q; document.head.appendChild(el); }
      else { el = document.createElement('script'); el.src = f + q; el.async = false; document.body.appendChild(el); }
    });
  }
})();
