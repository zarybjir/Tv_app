// Nastavení Promítárny. Uprav před nahráním do televize.
window.PROMITARNA_CONFIG = {
  // Klíč k TMDB (themoviedb.org → Nastavení → API). Funguje „API Key" (32 znaků)
  // i delší „API Read Access Token". Bez klíče fungují jen dlaždice služeb.
  tmdbKey: '',

  // Klíč k OMDb (omdbapi.com → API Key, zdarma 1000 dotazů denně) pro hodnocení
  // IMDb a Rotten Tomatoes. Bez něj se ukazuje jen hodnocení TMDB a nejde filtrovat.
  omdbKey: '',

  // Země, pro kterou se zjišťuje, kde se co streamuje.
  region: 'CZ',

  // Jazyk názvů a popisů.
  language: 'cs-CZ'
};
