# Videotéka

**Všechny streamovací služby na jedné obrazovce.** Netflix, HBO Max, Disney+, Prime Video,
Apple TV a SkyShowtime dohromady, rozdělené podle žánrů, s hodnocením IMDb a Rotten Tomatoes.
Hned uvidíš, co na kterých tvých službách běží, a jedním klepnutím to pustíš.

Pro **telefony s Androidem** a **televize Samsung**. Zdarma, bez reklam a bez účtu.

<p align="center">
  <img src="docs/tv-domu.jpg" width="100%" alt="Videotéka v televizi: služby a řádky s novinkami">
</p>
<p align="center">
  <img src="docs/mobil-domu.jpg" width="31%" alt="Domovská obrazovka v telefonu">
  <img src="docs/mobil-detail.jpg" width="31%" alt="Detail titulu s hodnocením a tlačítkem pro přehrání">
  <img src="docs/mobil-klice.jpg" width="31%" alt="Nastavení klíčů s odkazy, kde je získat">
</p>

<sub>Snímky jsou z ukázkových dat, názvy filmů jsou vymyšlené.</sub>

## Co umí

- 🎬 **Jeden katalog místo šesti aplikací.** Kategorie jako Krimi, Sci-fi, Komedie nebo Dokumenty
  ukazují jen to, co máš ve svých předplatných.
- ⭐ **Hodnocení IMDb a Rotten Tomatoes** přímo na plakátech a filtr podle nich, třeba jen IMDb 7+.
- 🇨🇿 **Česká tvorba a český dabing:** jedním tlačítkem jen české tituly nebo jen tituly s českým zvukem.
- ▶️ **Přehrát rovnou:** v telefonu otevře film přímo v aplikaci Netflixu, HBO Max a dalších.
- 📅 **Novinky a kalendář:** co přibylo, co brzy odchází a kdy vyjde další díl tvého seriálu.
- ✅ **Chci vidět a Už jsem viděl:** vlastní seznam napříč službami. Co tě nezajímá, schováš.
- 📺 **Telefon jako ovladač:** spáruješ mobil s televizí přes QR kód a titul do ní pošleš z telefonu.
- 🔄 **Aktualizuje se sama.**

## Instalace do telefonu (Android)

1. **[⬇️ Stáhnout Videoteka.apk](https://github.com/zarybjir/Tv_app/releases/latest/download/Videoteka.apk)**
2. Otevři stažený soubor. Telefon se zeptá, jestli povolit instalaci z tohoto zdroje: povol.
3. Ve Videotéce otevři **Nastavení → Klíče** a vlož klíče (viz níž). U každého je odkaz
   *Získat klíč ›* a krátký postup.

## Klíče (zdarma, pár minut)

Videotéka si data bere z veřejných filmových databází. Každá z nich chce vlastní bezplatný klíč,
proto si je každý zařídí sám. Nutný je jen první, ostatní přidávají funkce navíc.

| Klíč | Na co je | Kde ho získat |
|---|---|---|
| **TMDB** (nutný) | tituly, plakáty, kategorie, hledání | [themoviedb.org → Nastavení → API](https://www.themoviedb.org/settings/api) — nejdřív [registrace](https://www.themoviedb.org/signup), pak požádat o klíč (Developer, osobní použití) a zkopírovat *API Key* |
| **OMDb** | hodnocení IMDb a Rotten Tomatoes | [omdbapi.com/apikey.aspx](https://www.omdbapi.com/apikey.aspx) — zvolit FREE, klíč přijde e-mailem a je potřeba ho aktivovat odkazem v e-mailu |
| **Watchmode** | přehrání rovnou konkrétního titulu | [api.watchmode.com](https://api.watchmode.com/requestApiKey/) — registrace (Free), klíč je v sekci API Key |
| **Movie of the Night** | český dabing, co přibylo a co odchází | [developers.movieofthenight.com](https://developers.movieofthenight.com/) — registrace, plán Free, zkopírovat API key |

Klíče zůstávají jen v tvém telefonu (nebo televizi) a nikam jinam se neposílají.

## Do televize Samsung

Na televizi se Videotéka instaluje přes vývojářský režim. Nastavuje se to jednou a postup je
[níž v návodu](#2-instalace-do-televize). Klíče do televize nemusíš opisovat: pošleš je
z telefonu přes QR kód ([jak](#klíče-do-televize-z-mobilu-nejjednodušší)).

> **Jedna věc, kterou neumí:** na televizi Samsung se služba otevře na úvodní stránce
> a Videotéka ti napíše, co v ní vyhledat. Skok rovnou na film televize nedovolí. V telefonu
> skok funguje.

---

## Všechny funkce podrobně

- **Moje služby:** dlaždice, které jedním stiskem OK spustí aplikaci služby.
- **Kategorie:** domovská obrazovka je rozdělená do řádků podle žánrů (Krimi, Thrillery
  a záhady, Fantasy, Sci-fi, Akční, Komedie, Drama, Animované, Dokumenty…). Každý řádek
  obsahuje jen to, co běží na tvých službách. Štítek na plakátu ukazuje, na které službě.
- **Celá kategorie:** na konci každého řádku je dlaždice **Zobrazit vše ›**. V telefonu
  stačí klepnout i na název řádku. Otevře se mřížka plakátů a další tituly se při posouvání
  načítají samy, až stovky titulů.
- **Dokumenty po podkategoriích:** příroda a zvířata, skutečné zločiny, historie, válka,
  věda a vesmír, sport a hudba. Zapínají se v *Nastavení → Obsah → Dokumenty* a v rozbalené
  kategorii Dokumenty mezi nimi přepínáš záložkami.
- **Co chceš vidět:** v *Nastavení → Obsah domovské obrazovky* zapneš nebo vypneš:
  - **seriály a filmy**,
  - **jednotlivé kategorie** (16 žánrů),
  - řádek **Nejpopulárnější**,
  - **řádky podle služeb** („Populární na Netflix" apod.).
- **Méně procházení:** titul, který tě nezajímá nebo jsi ho už viděl, jedním tlačítkem
  schováš ze všech řádků. Na plakátu:
  - **červené** tlačítko ovladače = *Nezajímá mě*,
  - **zelené** = *Už jsem viděl*,
  - **žluté** = vrátit poslední skrytí.
  
  Totéž je i v detailu titulu. Skryté tituly najdeš a vrátíš v *Nastavení → Skryté*.
- **Série a díly:** u seriálu otevři *Série a díly*. Uvidíš série a u každého dílu název,
  datum, délku, popis a obrázek. Výběrem dílu se seriál otevře ve službě a Videotéka si
  zapamatuje, kde jsi skončil: viděné díly mají ✓ a další na řadě je zvýrazněný. Na konkrétní
  díl služby skočit nedovolí, ten pustíš v jejich aplikaci.
- **Nově přidáno:** řádek s novými filmy (poslední 4 měsíce) a seriály, kterým za poslední
  měsíc vyšel díl, pokud běží na tvých službách. Starší tituly, které službě přibyly do
  katalogu, v něm nejsou, protože tenhle údaj žádná bezplatná databáze nedává.
- **Nové díly a řady:** u seriálů ze seznamu „Chci vidět" a u seriálů označených jako viděné
  ukáže štítek *Nová řada 3*, *Nové díly* nebo *Další díl 1. 12.* Až nové díly dokoukáš,
  dej na seriálu znovu zelené tlačítko.
- **Přibylo na tvých službách:** když se titul ze seznamu objeví na některé z tvých služeb,
  ukáže se nahoře na domovské obrazovce. Kontroluje se při spuštění, nejvýš dvakrát denně.
- **Pořadí řádků:** v *Nastavení → Obsah → Pořadí řádků* si posuneš oblíbené kategorie
  nahoru.
- **Plakáty:** skutečné plakáty filmů a seriálů z TMDB.
- **Hodnocení IMDb a Rotten Tomatoes** u každého plakátu, v detailu navíc počet hlasů
  a Metacritic.
- **Filtr podle hodnocení:** tlačítka *IMDb* (6+ / 6,5+ / 7+ / 7,5+ / 8+) a *Rotten Tomatoes*
  (60 / 75 / 90 %+) nahoře na domovské obrazovce. Filtr se týká řádků „Populární na …"
  i hledání, ne vlastního seznamu. Tituly bez hodnocení filtr schová.
- **Česká tvorba:** tlačítko *Jazyk* nahoře přepne všechny řádky, rozbalené kategorie
  i hledání jen na české filmy a seriály.
- **Český dabing:** další stisk tlačítka *Jazyk* naplní řádky a rozbalené kategorie jen
  tituly, které mají na některé z tvých služeb český zvuk. Štítek **CZ** na plakátu označuje
  ověřený dabing. Detail titulu ukáže dabing a titulky u každé služby zvlášť, např.
  „Netflix ✓ · Disney+ – jen české titulky". Potřebuje klíč Movie of the Night (viz níž).
  Hledání dabing neověřuje, aby se šetřil limit.
- **Herci a tvůrci:** detail titulu ukazuje režii (u seriálů tvůrce) a hlavní herce. Klepnutím
  na jméno se otevře stránka s tím, co s daným člověkem běží na tvých službách.
- **Kalendář:** tlačítko *Kalendář* nahoře ukáže po dnech, co na tvých službách přibude,
  a další díly seriálů, které sleduješ.
- **Skutečně nově přidané a Brzy odchází** (s klíčem Movie of the Night): řádek *Nově přidáno*
  ukazuje, co službám opravdu přibylo do katalogu, a řádek *Brzy odchází* to, co mizí,
  s datem. Tituly ze seznamu *Chci vidět*, které odcházejí, mají štítek „odchází 20. 11."
  a upozornění nahoře na hlavní stránce.
- **Pošli do TV:** v televizi zapni *Nastavení → Telefon jako ovladač* a kód zadej v mobilu
  v *Nastavení → Televize*. V detailu titulu v mobilu pak tlačítko *Pošli do TV* otevře titul
  v televizi. Zpráva jde přes veřejnou službu ntfy.sh na náhodný kanál a obsahuje jen název
  a ID titulu.
- **Hledání:** napíšeš název a uvidíš, na které z tvých služeb titul běží.
- **Skok rovnou na titul:** tlačítko „▶ Netflix" otevře film nebo seriál přímo v aplikaci
  služby, ne její úvodní obrazovku. U seriálu tě služba pustí tam, kde jsi skončil.
  Potřebuje Watchmode klíč (viz níž).
- **Detail titulu:** popis, hodnocení a tlačítka „▶ Netflix", „▶ HBO Max"… Kromě toho
  ukáže, kde je titul v jiném předplatném nebo k pronájmu.
- **Chci vidět:** vlastní seznam napříč službami, uložený v televizi.
- **Nastavení:** zapnutí a vypnutí služeb a ruční výběr aplikace, kdyby ji Videotéka
  nenašla sama.

### Co aplikace neumí

Netflix, HBO a další nemají veřejné rozhraní. Proto aplikace:

- **nevidí „Pokračovat ve sledování"** ani tvou historii,
- **nepřehraje video sama.** Videa služeb jsou chráněná a pustí je jen jejich vlastní
  aplikace. Videotéka tě do nich přepne, nejlépe rovnou na vybraný titul.

Údaje o tom, co kde běží, pochází z TMDB (data JustWatch) pro zemi z `js/config.js`
(výchozí Česko) a můžou být o den či dva pozadu.

---

## Klíče do televize z mobilu (nejjednodušší)

Klíče stačí mít v mobilní Videotéce (*Nastavení → Klíče*). Do televize je přeneseš takhle:
1. V televizi otevři *Nastavení → Telefon jako ovladač → Zapnout*. Ukáže se QR kód.
2. V mobilu otevři *Nastavení → Televize → Naskenovat QR z televize*. Pokud fotoaparát
   nejde, opiš 20znakový kód pod QR kódem.
3. Telefon televizi pošle klíče, televize si je uloží a sama se restartuje.

Spárování zároveň zapne tlačítko *Pošli do TV* v mobilu. Zprávy jdou přes veřejnou službu
ntfy.sh a jsou zašifrované kódem z QR, který se nikam neposílá. `js/config.js` pak v televizi
může zůstat prázdný.

## 1. TMDB klíč (zdarma, 5 minut)

1. Zaregistruj se na <https://www.themoviedb.org/signup>.
2. Otevři *Nastavení → API* (<https://www.themoviedb.org/settings/api>) a požádej o klíč
   (Developer, osobní použití).
3. Zkopíruj **API Key** nebo **API Read Access Token** do souboru `js/config.js`:

   ```js
   tmdbKey: 'sem-vloz-klic',
   ```

Bez klíče fungují jen dlaždice pro spouštění služeb.

## 1b. OMDb klíč pro IMDb a Rotten Tomatoes (zdarma)

1. Na <https://www.omdbapi.com/apikey.aspx> vyber **FREE (1 000 dotazů denně)** a zadej e-mail.
2. Klíč ti přijde e-mailem. Nejdřív ho aktivuj odkazem z e-mailu.
3. Vlož ho do `js/config.js`:

   ```js
   omdbKey: 'sem-vloz-klic',
   ```

Hodnocení se ukládají v televizi na 7 dní, takže limit stačí: první spuštění spotřebuje zhruba
120 dotazů, další už jen pár na nové tituly. Kdyby limit přesto došel, filtr dočasně nic
neschovává a aplikace na to upozorní. Seriály na Rotten Tomatoes často hodnocení nemají.

## 1c. Watchmode klíč pro skok rovnou na titul (zdarma)

1. Zaregistruj se na <https://api.watchmode.com/> (bezplatný plán, 1 000 dotazů měsíčně).
2. Klíč vlož do `js/config.js`:

   ```js
   watchmodeKey: 'sem-vloz-klic',
   ```

Dotaz se posílá jen po stisku „▶" a odkaz se pamatuje 30 dní, takže limit bohatě stačí.

### Jak se skok „naučí"

Samsung nezveřejňuje, jak aplikacím služeb předat konkrétní titul. Videotéka proto zná tři
způsoby. Po návratu z aplikace se zeptá: **„Otevřel se rovnou titul?"**

- **Ano:** zapamatuje si, že tenhle způsob u té služby funguje, a víc se neptá.
- **Ne:** příště zkusí další způsob. Když nefunguje žádný, u té služby bude otevírat jen
  aplikaci.

Ručně to přepneš v *Nastavení → Skok na titul* (automaticky / způsob 1–3 / vypnuto).

## 1d. Klíč Movie of the Night pro český dabing (zdarma)

1. Zaregistruj se na <https://developers.movieofthenight.com/> a nech si plán **Free**
   (1 000 dotazů měsíčně).
2. Zkopíruj API klíč do `js/config.js` (`motnKey: '…'`), v mobilu do *Nastavení → Klíče*.

Kvůli limitu se řádky s dabingem pamatují 3 dny a údaje o titulu 30 dní. Spotřebu vidíš
v nastavení. U 950 dotazů za měsíc se Videotéka sama zastaví a od 1. dne dalšího měsíce
zase pojede.

## 2. Instalace do televize

Samsung povoluje vlastní aplikace jen přes vývojářský režim. Nastavuje se to jednou.

**Na počítači (Windows, macOS i Linux):**

1. Nainstaluj [Tizen Studio](https://developer.tizen.org/development/tizen-studio/download).
2. V *Package Manageru* (*Tools → Package Manager → Extension SDK*) doinstaluj
   **TV Extensions** a **Samsung Certificate Extension**.

**Na televizi:**

3. Otevři *Aplikace (Apps)* a na ovladači zadej **1 2 3 4 5**.
4. Zapni **Developer mode**, jako *Host PC IP* zadej IP adresu počítače a televizi restartuj
   (vypnout a zapnout).

**Zpět na počítači:**

5. V Tizen Studiu otevři *Tools → Device Manager → Remote Device Manager → +*, zadej IP
   adresu televize a připoj se.
6. Otevři *Tools → Certificate Manager → +* a zvol **Samsung**, typ **TV**. Přihlas se
   Samsung účtem a nech vytvořit autorský i distributorský certifikát. Distributorský
   certifikát se váže k připojené televizi (DUID se doplní sám).
7. V Tizen Studiu založ projekt: *File → New → Tizen Project → Template → TV → Web Application
   → Basic Project*, pojmenuj ho `Videoteka`. Ve složce projektu smaž vygenerované soubory
   kromě `.project`, `.tproject` a `.settings` a nakopíruj tam obsah tohoto repozitáře
   (`config.xml`, `index.html`, `icon.png`, `version.json`, složky `css` a `js`).
   Pak klikni na projekt pravým tlačítkem a zvol *Run As → Tizen Web Application*.

Videotéka se objeví mezi aplikacemi v televizi. Doporučuju si ji připnout na domovskou lištu.

### Totéž z příkazové řádky

```sh
tizen package -t wgt -s <jméno-profilu-certifikátu> -- .
sdb connect <IP-televize>
tizen install -n <vzniklý-soubor>.wgt -t <jméno-zařízení-ze-sdb-devices>
```

> Certifikát z vývojářského režimu platí zhruba rok. Potom aplikaci stačí znovu nahrát
> stejným postupem.

## Aktualizace

Aplikaci stačí do televize nahrát jednou. Další verze si stahuje sama z tohoto repozitáře:

- **Kontrola:** při spuštění, nejvýš jednou za 6 hodin, a ručně v *Nastavení → Aktualizace*.
- **Stažení:** nová verze se stáhne a uloží v televizi.
- **Nasazení:** použije se při příštím spuštění, nebo hned po návratu z Netflixu apod.,
  když jsi na domovské obrazovce. Jednou se pak ukáže, co je nového.
- **Pojistka:** když nová verze nenaběhne, Videotéka se při dalším spuštění sama vrátí
  k nainstalované verzi. Ručně to jde přes *Vrátit verzi* v nastavení.
- **Klíče** v `js/config.js` se aktualizací nikdy nepřepíšou.

Znovu nahrát přes Tizen Studio je potřeba jen tehdy, když aktualizace mění oprávnění nebo
zavaděč (`version.json` → `minShell`; aplikace na to upozorní), a když vyprší certifikát
(zhruba po roce).

**Vydání nové verze:** zvyš číslo ve `version.json` i v `js/version.js` a pushni do `main`.
GitHub Action *Kontrola vydání* ověří, že kód jde přeložit, že je verze zvýšená a že
v `js/config.js` nezůstal vyplněný klíč.

> ⚠️ Repozitář je veřejný. Klíče vyplňuj jen v kopii, kterou nahráváš do televize,
> a necommituj je.

## Starší televize (2016–2017): když instalace končí `install failed[118]`

Ověřeno na Samsung UE55MU6272 (2017, Tizen 3.0):

1. Použij **Tizen Studio 6.1** (z `download.tizen.org/sdk/Installer/tizen-studio_6.1/`, soubor
   `web-ide…windows-64.exe`). Nové rozšíření pro VS Code tuhle televizi nezvládlo.
2. V Certificate Manageru vytvoř certifikát **Samsung → TV** (televize musí být připojená,
   aby se doplnilo její DUID). Pak v Device Manageru klikni na televizi pravým tlačítkem →
   **Permit to install applications**. **Tohle byl rozhodující krok** – bez něj televize každý
   balíček odmítla s `install failed[118]`, ať byl podepsaný jakkoli.
3. Ze složky projektu smaž `js/jsqr.js` a `js/jsqr.LICENSE.txt` (televize je nepotřebuje),
   pak **Build Signed Package**.
4. Instaluj z příkazové řádky (`C:\tizen-studio\tools`), každý řádek zvlášť:
   ```
   sdb.exe -s <IP-televize>:26101 install "C:\…\Videoteka.wgt"
   sdb.exe -s <IP-televize>:26101 shell 0 vd_appinstall PrMtArNa01.Videoteka /home/owner/share/tmp/sdk_tools/Videoteka.wgt
   ```
   Hláška „closed" po prvním příkazu nevadí, instaluje až druhý.
5. Při každé další instalaci použij **stejný certifikát**, jinak ji televize odmítne.

Na této televizi se Netflix spouští jako systémová aplikace `org.tizen.netflix-app` a skok rovnou
na film služby nepřijímají. Videotéka proto službu otevře a napíše, jaký titul v ní vyhledat.

## 3. Když nejde spustit některá služba

Videotéka hledá aplikace v televizi podle názvu. Když některou nenajde (na dlaždici je
„nenalezeno v TV"), otevři **Nastavení → Aplikace: …** a vyber ji ze seznamu všech
nainstalovaných aplikací. Tlačítkem **Vyzkoušet** ověříš, že se spustí.

## Mobilní aplikace (Android)

Stejná Videotéka, jen pro telefon: ovládá se dotykem a hledá se klávesnicí telefonu.
**Přehrát** otevře rovnou titul v aplikaci služby. Na Androidu to funguje spolehlivěji
než v televizi, ale potřebuje Watchmode klíč.

**Instalace:**
1. V telefonu stáhni **[Videoteka.apk](https://github.com/zarybjir/Tv_app/releases/latest/download/Videoteka.apk)**
   (nejnovější vydání). Pro vývojáře: sestavení z každého commitu je i v *Actions →
   Mobilní aplikace (APK) → Artifacts*.
2. Otevři ho. Telefon se zeptá, jestli povolit instalaci z neznámých zdrojů – povol.
3. Ve Videotéce otevři *Nastavení → Klíče* a vlož klíče TMDB, OMDb a Watchmode. Zůstávají
   jen v telefonu.

Obsah aplikace se aktualizuje sám, stejně jako v televizi. Nové APK je potřeba jen při
změně samotného obalu. Aby šlo nainstalovat přes staré bez ztráty dat, nastav podpisový
klíč (secrets `VIDEOTEKA_*`, popsané v `.github/workflows/apk.yml`). Může být stejný jako
u Ženisty.

## Ovládání

| Tlačítko | Akce |
|---|---|
| Šipky | pohyb |
| OK | otevřít nebo spustit |
| Zpět | o krok zpět; na domovské obrazovce aplikaci zavře |

Funguje i ukazovátko (Smart Remote nebo myš).

## Struktura

```
config.xml       manifest Tizen aplikace (oprávnění: internet, spouštění aplikací)
index.html       vstup
css/style.css    vzhled pro 1920×1080
js/config.js     TMDB, OMDb a Watchmode klíč, země, jazyk  ← upravit
js/services.js   seznam služeb, jejich barvy, TMDB ID a ID aplikací v TV
js/boot.js       zavaděč: vybere nainstalovanou nebo staženou verzi, stahuje aktualizace
js/version.js    verze přibalená v instalaci
version.json     nejnovější verze pro aktualizace (čtou ji televize)
mobile/          obal mobilní aplikace (Android, WebView)
js/app.js        celá logika: navigace ovladačem, obrazovky, TMDB, spouštění aplikací
```

Náhled bez televize: v adresáři spusť `python3 -m http.server`, otevři
<http://localhost:8000> a ovládej šipkami, Enterem a Escapem.
