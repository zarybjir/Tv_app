// Nastavení Videotéky. Uprav před nahráním do televize.
window.PROMITARNA_CONFIG = {
  // Klíč k TMDB (themoviedb.org → Nastavení → API). Funguje „API Key" (32 znaků)
  // i delší „API Read Access Token". Bez klíče fungují jen dlaždice služeb.
  tmdbKey: '',

  // Klíč k OMDb (omdbapi.com → API Key, zdarma 1000 dotazů denně) pro hodnocení
  // IMDb a Rotten Tomatoes. Bez něj se ukazuje jen hodnocení TMDB a nejde filtrovat.
  omdbKey: '',

  // Klíč k Watchmode (watchmode.com → API, zdarma 1000 dotazů měsíčně) pro skok rovnou
  // na titul ve službě. Bez něj se otevře jen úvodní obrazovka služby.
  watchmodeKey: '',

  // Klíč k Movie of the Night (developers.movieofthenight.com, zdarma 1000 dotazů měsíčně)
  // pro filtr Český dabing. Bez něj filtr nabízí jen Českou tvorbu.
  motnKey: '',

  // Země, kde máš předplatné – podle ní se zjišťuje, co kde běží.
  region: 'CZ',

  // Jazyk názvů a popisů.
  language: 'cs-CZ'
};
