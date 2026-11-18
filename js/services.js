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
    appIds: ['RN1MCdNq8t.Netflix', 'org.tizen.netflix-app', '3201907018807']
  },
  {
    id: 'hbo',
    android: ['com.wbd.stream', 'com.hbo.hbonow'],
    watchmode: /hbo|^max$/i, name: 'HBO Max', short: 'HBO',
    colors: ['#7b2ff7', '#1a0840'],
    providers: [1899, 384],
    match: /hbo|^max$/i,
    appIds: ['3202301029760', '3201601007230']
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
    appIds: ['3201807016597']
  }
];
