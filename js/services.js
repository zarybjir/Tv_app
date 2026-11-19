// Streamovací služby. `providers` jsou ID poskytovatelů v TMDB,
// `match` hledá aplikaci v televizi podle názvu, `appIds` jsou záložní
// Tizen ID aplikací (zkouší se postupně, pokud se aplikace nenajde podle názvu),
// `watchmode` poznává službu v odkazech z Watchmode, `android` jsou balíčky aplikací v telefonu.
window.SERVICES = [
  {
    id: 'netflix',
    android: ['com.netflix.mediaclient'],
    watchmode: /netflix/i, name: 'Netflix', short: 'N',
    colors: ['#e50914', '#3d0205'],
    providers: [8, 1796],
    match: /netflix/i,
    appIds: ['org.tizen.netflix-app', 'RN1MCdNq8t.Netflix']
  },
  {
    id: 'hbo',
    android: ['com.wbd.stream', 'com.hbo.hbonow'],
    watchmode: /hbo|^max$/i, name: 'HBO Max', short: 'HBO',
    colors: ['#7b2ff7', '#1a0840'],
    providers: [1899, 384],
    match: /hbo|^max$/i,
    appIds: ['5b8c3eb16b.BeamCTVDev']
  },
  {
    id: 'disney',
    android: ['com.disney.disneyplus'],
    watchmode: /disney/i, name: 'Disney+', short: 'D+',
    colors: ['#1d4ed8', '#071341'],
    providers: [337],
    match: /disney/i,
    appIds: ['MCmYXNxgcu.DisneyPlus', '3201901017640']
  },
  {
    id: 'prime',
    android: ['com.amazon.avod.thirdpartyclient'],
    watchmode: /prime video|amazon prime/i, name: 'Prime Video', short: 'PV',
    colors: ['#1399d6', '#06263a'],
    providers: [119, 9],
    match: /prime|amazon/i,
    appIds: ['evKhCgZelL.AmazonIgnitionLauncher2', '3201910019365']
  },
  {
    id: 'apple',
    android: ['com.apple.atve.androidtv.appletv', 'com.apple.atve.amazon.appletv'],
    watchmode: /apple tv/i, name: 'Apple TV', short: 'tv',
    colors: ['#6b7280', '#111214'],
    providers: [350],
    match: /apple\s*tv/i,
    appIds: ['Y6A54cEa22.AppleTV']
  },
  {
    id: 'skyshowtime', name: 'SkyShowtime', short: 'SST',
    watchmode: /skyshowtime/i,
    android: ['com.skyshowtime.skyshowtime.google', 'com.skyshowtime.skyshowtime'],
    colors: ['#4b2fd6', '#120a3d'],
    // ID v TMDB se při spuštění ověří podle jména (providerMatch)
    providers: [1773],
    providerMatch: /skyshowtime/i,
    match: /skyshowtime/i,
    appIds: ['skysh0WTIM.SkyShowtime', 'skyshOWTIM.SkyShowtime']
  }
];
