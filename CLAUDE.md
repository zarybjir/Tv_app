# Videotéka – pokyny pro Claude

Přehled streamovacích služeb (Netflix, HBO Max, Disney+, Prime Video, Apple TV, SkyShowtime) na jedné
obrazovce. Jedna webová aplikace bez build kroku a bez npm, která běží na dvou místech:
televize Samsung (Tizen, balíček `.wgt`) a telefon s Androidem (WebView, `mobile/`).

## Jak pracovat (šetři kód i tokeny)

1. **Než něco napíšeš, najdi, jestli to už neexistuje.** Grepni název nebo podobnou funkci.
   Pomocníci jsou na začátku `js/app.js`: `h` (tvorba prvků), `clear`, `toast`, `load`/`save`,
   `row`, `card`, `scard`/`sline`/`sbtn` (nastavení), `listControls` (řazení a filtry seznamů).
2. **Nejmenší změna, která funguje.** Žádné refaktory, přejmenovávání ani „úklid", o které nikdo
   nežádal. Nepřidávej abstrakce pro jedno použití.
3. **Žádné nové závislosti ani build nástroje.** Aplikace se do televize kopíruje jako složka souborů.
4. **Nečti celý `js/app.js`** (přes 3000 řádků). Je rozdělený na sekce
   `// ------------------------------------------------------------------ název`; vypiš si je
   grepem a čti jen tu, které se změna týká (Read s offset/limit).
5. **Nikdy nečti** `js/qrcode.js` a `js/jsqr.js` (cizí knihovny), `docs/` a ikony (obrázky).
6. Když zadání jde udělat jednodušeji, než bylo popsáno, řekni to dřív, než začneš psát.

## Dvě pravidla, která se nesmí porušit

- **Starý prohlížeč v televizi.** Televize z roku 2017 má Chromium 47. Ve všem, co se do ní stahuje
  (`js/app.js`, `js/services.js`, `js/boot.js`, `css/style.css`), platí: jen `var` a `function`,
  **žádné** `let`/`const`/`class`, šipkové funkce, šablonové řetězce ani CSS proměnné `var(--…)`.
  Bez CSS gridu a flex `gap`. `Promise`, `fetch` a `Object.assign` použít lze.
  Hlídá to `node .github/kontrola-vydani.js`.
- **Klíče nepatří do repozitáře.** Repozitář je veřejný. `js/config.js` musí zůstat s prázdnými
  klíči; uživatel je vkládá v telefonu (Nastavení → Klíče) a do televize je přenáší přes QR kód.
  Podpisový klíč APK je jen v GitHub secrets `VIDEOTEKA_*`.

## Struktura

- `index.html` – prázdné sekce obrazovek; načte `js/config.js`, `js/version.js`, `js/boot.js`.
- `js/boot.js` – zavaděč s aktualizacemi. Vybere přibalenou nebo staženou verzi (uloženou
  v `localStorage`), při nezdařeném startu se vrátí zpět. Zdroj aktualizací je `REPO`
  (sestavení APK ho přepíše na repozitář, ve kterém běží). Změna zavaděče, `index.html` nebo
  oprávnění vyžaduje novou instalaci: zvyš `SHELL` a `minShell` ve `version.json`.
- `js/services.js` – `window.SERVICES`: služby, barvy, ID poskytovatelů TMDB, ID aplikací
  v televizi (`appIds`) a balíčky v Androidu.
- `js/app.js` – celá aplikace v jedné funkci (IIFE), sekce shora dolů:
  úložiště → DOM pomocníci → fokus a navigace ovladačem → obrazovky (`defineScreen`, `go`,
  `show`, `back`) → TMDB a `discover` → kategorie → Movie of the Night (dabing, změny katalogu)
  → hodnocení OMDb → filtry → spouštění aplikací → skok na titul → seznamy → komponenty
  (`row`, `card`) → jednotlivé obrazovky (DOMŮ, HLEDÁNÍ, DETAIL, NASTAVENÍ, CELÁ KATEGORIE,
  TELEFON JAKO OVLADAČ, KALENDÁŘ, HEREC, SÉRIE A DÍLY…) → klávesy → start.
- `css/style.css` – nejdřív vzhled pro televizi (pevně 1920×1080), níže mobilní úpravy pod
  třídou `.mobile`. Novou věc styluj pro obojí.
- `mobile/` – obal pro Android (Kotlin, `MainActivity.kt`). Webové soubory se do APK kopírují
  při sestavení. Most do systému je `window.VideotekaAndroid` (`getApps`, `launch`, `openUrl`, `exit`).
- `config.xml` – manifest Tizen (id `PrMtArNa01.Videoteka`, oprávnění).
- `.github/workflows/kontrola.yml` + `.github/kontrola-vydani.js` – kontrola vydání;
  `.github/workflows/apk.yml` – sestavení APK a vydání na GitHubu.
- `docs/` – snímky obrazovky do README (z ukázkových dat, smyšlené názvy).

Prostředí se rozlišuje proměnnými `IS_TV` (Tizen), `ANDROID` (most z APK) a `MOBILE`
(Android nebo úzké okno). Televize se ovládá ovladačem: každý ovladatelný prvek má třídu
`focusable`, jedinečné `data-fid` a akci v `onselect`. V mobilu stejné prvky reagují na klepnutí.

## Obrazovky a návrat na pozici

- Nová obrazovka: `defineScreen('název', function (root, params) { … })`, přechod `go('název', params)`.
  Sekci v `index.html` není potřeba přidávat, vytvoří se sama.
- Seznamy v `LIST_SCREENS` (hledání, mřížka kategorie, herec, kalendář) se při návratu
  nepřekreslují, aby zůstala pozice. Nový seznam titulů tam přidej a dej mu `listControls`.
- Domovská obrazovka se překresluje jen při `homeDirty` (nastaví ho `save` u klíčů v `DIRTY_KEYS`).

## Zdroje dat a limity

- **TMDB** – katalog, plakáty, dostupnost (`tmdb()`, výsledky se drží v paměti).
- **OMDb** – hodnocení a Oscary, 1000 dotazů denně; fronta `enqueue` (nejvýš 4 najednou), uloženo 7 dní.
- **Watchmode** – odkaz na titul ve službě, 1000 dotazů měsíčně; jen po stisku přehrání.
- **Movie of the Night** – dabing a změny katalogu, 1000 dotazů měsíčně; aplikace se zastaví na 950.

Nová funkce nesmí bezplatné limity vyčerpat: výsledky ukládej a dotazuj se až na vyžádání.

## Ukládání (localStorage)

Klíče mají předponu `promitarna.` (historický název, **neměnit**): `settings`, `keys`, `watchlist`,
`hidden`, `ratings`, `arrivals`, `tvCode`, `pairCode`, `promitarna.update.*` (zavaděč).
Totéž platí pro `window.PROMITARNA_CONFIG` a `PROMITARNA_BUNDLED`. Při změně formátu doplň
chybějící pole výchozí hodnotou (viz `content()`), ať uživatelům nezmizí seznamy a nastavení.
Přístup vždy přes `load`/`save`.

## Spuštění a ověření

- Náhled: `python3 -m http.server 8000` a otevřít `http://localhost:8000` (široké okno = televize,
  ovládání šipkami, Enter, Escape; úzké okno = mobil).
- **Po každé změně spusť `node .github/kontrola-vydani.js`** (syntaxe, starý prohlížeč, verze, prázdné klíče).
- Změnu vzhledu nebo chování ověř v prohlížeči přes Playwright: TMDB a OMDb nahraď smyšlenými
  odpověďmi (`page.route`), televizi napodob objektem `window.tizen`, telefon objektem
  `window.VideotekaAndroid`. Zkontroluj **televizi i mobil** a hlídej chyby v konzoli.
- Testy v repozitáři zatím nejsou. Co nešlo ověřit (živá data, skutečná televize), napiš.
- Spouštění služeb a skok na titul jdou vyzkoušet jen na skutečném zařízení. Na televizi
  Samsung skok přímo na titul nefunguje (ověřeno), služba se otevře na úvodní stránce.

## Vydání verze

- Zvyš verzi ve `version.json` **i** v `js/version.js` (musí být stejné) a do `notes` dej jednu
  krátkou českou větu; zobrazí se uživateli po aktualizaci.
- Odeslání do `main` = vydání: zařízení si změnu stáhnou sama a workflow sestaví APK.
- Nové APK je potřeba jen při změně `mobile/` nebo ikony; pak zvyš `versionCode` a `versionName`
  v `mobile/build.gradle.kts`.
- Když se změní funkce viditelná pro uživatele, uprav i `README.md`.
- Commit: krátký český popis a verze v závorce, např. `Filtr podle let (verze 1.31.0)`.

## Styl

- Texty v aplikaci, komentáře, README i commity česky.
- Texty pro uživatele v **neutrálním tónu**: bez tykání i vykání a bez první osoby
  („je potřeba vložit klíč", „Nic nebylo nalezeno", „Načítání…"). Bez hovorových výrazů a emoji.
- Řádky a karty bez vysvětlujících podtitulků, pokud nenesou informaci.
- Drž se stávajícího stylu kódu: krátké názvy, kompaktní zápis, sekce oddělené řádkem s pomlčkami.
