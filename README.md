# Promítárna — jedna obrazovka pro všechny streamovací služby

Aplikace pro televize **Samsung (Tizen, modely od roku 2018)**. Spojuje Netflix, HBO Max,
Disney+, Prime Video a Apple TV:

- **Moje služby:** dlaždice, které jedním stiskem OK spustí aplikaci služby.
- **Populární na …:** u každé služby řádek s tím, co se na ní teď nejvíc sleduje (v Česku).
- **Hodnocení IMDb a Rotten Tomatoes** u každého plakátu, v detailu navíc počet hlasů
  a Metacritic.
- **Filtr podle hodnocení:** tlačítka *IMDb* (6+ / 6,5+ / 7+ / 7,5+ / 8+) a *Rotten Tomatoes*
  (60 / 75 / 90 %+) nahoře na domovské obrazovce. Filtr se týká řádků „Populární na …"
  i hledání, ne vlastního seznamu. Tituly bez hodnocení filtr schová.
- **Země, kde právě jsi:** tlačítko *Jsem v:* nahoře. Buď automaticky podle připojení, nebo
  ručně. Naposledy použité země jsou v seznamu nahoře.
  - **V EU** ti služby díky přenositelnosti předplatného (nařízení EU 2017/1128) ukazují
    katalog z domova. Promítárna to ví a dál ukazuje domácí katalog.
  - **Mimo EU** ukáže, co jde sledovat tam. Tituly ze seznamu „Chci vidět", které tam nejdou,
    ztlumí, a v detailu napíše, kde běží doma.
  - Domov (zemi předplatného) nastavíš v *Nastavení → Země*.
  - Promítárna jen ukazuje, co kde jde sledovat. Co ti služby opravdu pustí, určují podle
    připojení, takže tohle nastavení nic neodemkne.
- **Hledání:** napíšeš název a uvidíš, na které z tvých služeb titul běží.
- **Detail titulu:** popis, hodnocení a tlačítka „▶ Netflix", „▶ HBO Max"… Kromě toho
  ukáže, kde je titul v jiném předplatném nebo k pronájmu.
- **Chci vidět:** vlastní seznam napříč službami, uložený v televizi.
- **Nastavení:** zapnutí a vypnutí služeb a ruční výběr aplikace, kdyby ji Promítárna
  nenašla sama.

### Co aplikace neumí

Netflix, HBO a další nemají veřejné rozhraní. Proto aplikace:

- **nevidí „Pokračovat ve sledování"** ani tvou historii,
- **neotevře konkrétní film rovnou** — spustí aplikaci služby a titul si v ní dohledáš.

Údaje o tom, co kde běží, pochází z TMDB (data JustWatch) a můžou být o den či dva pozadu.
Zemi připojení zjišťuje Promítárna přes veřejnou adresu `cloudflare.com/cdn-cgi/trace`.

---

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
7. Otevři *File → Import → Tizen → Tizen Project* a vyber tuto složku. Potom klikni pravým
   tlačítkem na projekt a zvol *Run As → Tizen Web Application*.

Promítárna se objeví mezi aplikacemi v televizi. Doporučuju si ji připnout na domovskou lištu.

### Totéž z příkazové řádky

```sh
tizen package -t wgt -s <jméno-profilu-certifikátu> -- .
sdb connect <IP-televize>
tizen install -n <vzniklý-soubor>.wgt -t <jméno-zařízení-ze-sdb-devices>
```

> Certifikát z vývojářského režimu platí zhruba rok. Potom aplikaci stačí znovu nahrát
> stejným postupem.

## 3. Když nejde spustit některá služba

Promítárna hledá aplikace v televizi podle názvu. Když některou nenajde (na dlaždici je
„nenalezeno v TV"), otevři **Nastavení → Aplikace: …** a vyber ji ze seznamu všech
nainstalovaných aplikací. Tlačítkem **Vyzkoušet** ověříš, že se spustí.

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
js/config.js     TMDB a OMDb klíč, region, jazyk  ← upravit
js/services.js   seznam služeb, jejich barvy, TMDB ID a ID aplikací v TV
js/app.js        celá logika: navigace ovladačem, obrazovky, TMDB, spouštění aplikací
```

Náhled bez televize: v adresáři spusť `python3 -m http.server`, otevři
<http://localhost:8000> a ovládej šipkami, Enterem a Escapem.
