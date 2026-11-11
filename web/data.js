/*
 * What the home screen shows, kept in localStorage so it opens with numbers:
 *  - the picks: what's trending this week and recent releases, only from the streaming apps on this TV (TMDB, with
 *    the person's own free key from config.properties), 3 per hour (up to 6 in Home Settings);
 *  - weather, sunrise and sunset (Open-Meteo, every 30 min) and optional crypto prices (Binance, every 5 min).
 * Settings changed on the TV (Prefs) win over config.properties, as on Android. Built without a city (--generic), the
 * TV's time zone gives the city, and its country the currency and the region (zones.js).
 */
var CONFIG = window.CONFIG || {};

/**
 * Weekday and month names for formatDate on TVs without Intl (strings.js), here where translate.py finds them.
 * "months" is the form next to a day ("28 октября"), as the catalogues' patterns use it.
 */
I18N.dateNames = function (kind) {
  if (kind === 'months') {
    return [tr('monthday|January'), tr('monthday|February'), tr('monthday|March'), tr('monthday|April'),
      tr('monthday|May'), tr('monthday|June'), tr('monthday|July'), tr('monthday|August'), tr('monthday|September'),
      tr('monthday|October'), tr('monthday|November'), tr('monthday|December')];
  }
  if (kind === 'shortMonths') {
    return [tr('month|Jan'), tr('month|Feb'), tr('month|Mar'), tr('month|Apr'), tr('month|May'), tr('month|Jun'),
      tr('month|Jul'), tr('month|Aug'), tr('month|Sep'), tr('month|Oct'), tr('month|Nov'), tr('month|Dec')];
  }
  if (kind === 'weekdays') {
    return [tr('weekday|Sunday'), tr('weekday|Monday'), tr('weekday|Tuesday'), tr('weekday|Wednesday'),
      tr('weekday|Thursday'), tr('weekday|Friday'), tr('weekday|Saturday')];
  }
  return [tr('weekday|Sun'), tr('weekday|Mon'), tr('weekday|Tue'), tr('weekday|Wed'), tr('weekday|Thu'),
    tr('weekday|Fri'), tr('weekday|Sat')];
};

var Place = (function () {
  'use strict';
  var EURO = /^(AT|BE|BG|CY|DE|EE|ES|FI|FR|GR|HR|IE|IT|LT|LU|LV|MT|NL|PT|SI|SK)$/;

  /** A time zone's main city: {country, lat, lon, name}, or null. */
  function zone(name) {
    var all = window.ZONES || {}, v = all[name], hops = 0;
    while (v && v.charAt(0) === '=' && hops++ < 3) { name = v.slice(1); v = all[name]; }
    if (!v) return null;
    var p = v.split(',');
    return {country: p[0], lat: p[1], lon: p[2], name: p[3] || name.slice(name.lastIndexOf('/') + 1).replace(/_/g, ' ')};
  }

  var tz = zone(TV.zone()), set = CONFIG.latitude !== '' && CONFIG.latitude !== undefined;
  var country = (CONFIG.tmdbRegion || (tz ? tz.country : '') || 'US').toUpperCase();
  return {
    lat: set ? CONFIG.latitude : tz ? tz.lat : '40.7128',
    lon: set ? CONFIG.longitude : tz ? tz.lon : '-74.0060',
    city: CONFIG.city || (!set && tz ? tz.name : ''),
    country: country,
    currency: (CONFIG.currency || (country === 'BR' ? 'BRL' : EURO.test(country) ? 'EUR' : 'USD')).toUpperCase(),
    /** Fahrenheit for TVs in the US (by their time zone, or their language when it doesn't tell). */
    fahrenheit: tz ? tz.country === 'US' : /-US$/i.test(navigator.language || '')
  };
})();

var Prefs = (function () {
  'use strict';
  var KEY = 'fmtv.prefs';
  var v = {};
  try { v = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  // settings_on_tv=false: what was saved on the TV doesn't count, every setting is config.properties'.
  var FROZEN = CONFIG.settingsOnTv === false;
  function pick(name, fallback) { return FROZEN || v[name] === undefined ? fallback : v[name]; }
  return {
    version: 0,
    language: function () { return pick('language', CONFIG.language || 'auto'); },
    temperature: function () { return pick('temperature', CONFIG.temperature || 'auto'); },
    theme: function () { return pick('theme', CONFIG.theme || 'auto'); },
    weather: function () { return pick('weather', CONFIG.weather !== false); },
    /** OK on the screensaver opens the title it shows, in its app; any other key only closes it (off by default). */
    saverWatch: function () { return pick('saverWatch', CONFIG.saverWatch === true) === true; },
    /** What the screensaver shows: 'photos' (the picks' photos, as it always has) or 'clock' (a clock and the weather). */
    saver: function () { return pick('saver', CONFIG.saver || 'photos') === 'clock' ? 'clock' : 'photos'; },
    /** Dimming over the picture, for a dark room: 'off', 'low', 'medium', 'high' or 'auto' (medium at night). */
    dim: function () { return pick('dim', CONFIG.dim || 'off'); },
    /** The weather card's forecast: 'hours' (the next 6 hours) or 'days' (the next 5 days). */
    forecast: function () { return pick('forecast', 'hours') === 'days' ? 'days' : 'hours'; },
    quotes: function () { return pick('quotes', CONFIG.showCrypto !== false); },
    coin: function (i) { var c = pick('coins', null); return c ? c[i] !== false : true; },
    /** Picks per tab: 3 (as it was) up to 6. */
    cards: function () { var n = pick('cards', CONFIG.cards || 3); return n < 3 ? 3 : n > 6 ? 6 : n; },
    /** Cartoons and anime out of the picks (Home Settings), or config.properties' hide_animation. */
    hideAnimation: function () { return pick('hideAnimation', CONFIG.hideAnimation === true) === true; },
    shelf: function () { return pick('shelf', null); },
    /** The shelf_apps of the build that last set the shelf, so a new one wins once over the TV's choice. */
    shelfConfig: function () { return pick('shelfConfig', ''); },
    /** The weather's city, picked on the TV (Home Settings → City), or config.properties' (or the time zone's). */
    city: function () { return pick('city', Place.city); },
    latitude: function () { return pick('latitude', Place.lat); },
    longitude: function () { return pick('longitude', Place.lon); },
    /** The TMDB key typed on the TV (Home Settings → TMDB key), or config.properties' ('' for none). */
    tmdbKey: function () { return String(pick('tmdbKey', CONFIG.tmdbKey || '')).trim(); },
    /** True when the key in use was typed on the TV (Remove takes it back to config.properties'). */
    tmdbKeyOnTV: function () { return v.tmdbKey !== undefined; },
    setCity: function (name, lat, lon) { v.city = name; v.latitude = lat; v.longitude = lon; save(); this.version++; },
    /** Streaming services (keys like "netflix") whose titles are left out of the picks. */
    serviceOff: function (key) { return pick('servicesOff', CONFIG.hideServices || []).indexOf(key) >= 0; },
    setServiceOff: function (key, off) {
      var list = pick('servicesOff', CONFIG.hideServices || []).filter(function (k) { return k !== key; });
      if (off) list.push(key);
      this.set('servicesOff', list);
    },
    openPicks: function () { return pick('openPicks', CONFIG.openPicksIn === 'nuvio' ? 'nuvio' : 'apps'); },
    /** The input the first top button opens, picked on the TV (Home Settings > Live TV button): 'live' (Live TV)
     * or 'hdmi1'..'hdmi4'. */
    boxInput: function () {
      var k = String(pick('boxInput', 'live')).toLowerCase();
      return /^hdmi[1-4]$/.test(k) ? k : 'live';
    },
    /** The Live TV tile in the drawer's inputs (Home Settings > Live TV), on until turned off on a TV with no
     * antenna; the first top button still opens it. */
    liveInput: function () { return pick('liveInput', CONFIG.liveTvButton !== false) !== false; },
    /** Home Settings > Clock: '24' or '12', or 'auto' for the language's own; config.properties' clock_format until
     * it's picked on the TV. */
    clockFormat: function () {
      var c = String(pick('clockFormat', CONFIG.clockFormat));
      return c === '24' || c === '12' ? c : 'auto';
    },
    set: function (name, value) { v[name] = value; save(); this.version++; },
    setCoin: function (i, on) {
      var c = (pick('coins', null) || [true, true, true, true]).slice();
      c[i] = on;
      this.set('coins', c);
    }
  };
})();

var Data = (function () {
  'use strict';

  function store(key, value) { try { localStorage.setItem('fmtv.' + key, JSON.stringify(value)); } catch (e) {} }
  function stored(key) { try { return JSON.parse(localStorage.getItem('fmtv.' + key)); } catch (e) { return null; } }

  /** GET a JSON document; done(error, json). */
  function get(url, headers, done) {
    var x = new XMLHttpRequest();
    var over = false;
    x.open('GET', url, true);
    x.timeout = 10000;
    for (var h in headers) if (headers.hasOwnProperty(h)) x.setRequestHeader(h, headers[h]);
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      if (x.status !== 200) { done(new Error(x.status === 401 ? 'TMDB rejected the key' : 'HTTP ' + x.status)); return; }
      var json;
      try { json = JSON.parse(x.responseText); } catch (e) { done(e); return; }
      done(null, json);
    };
    x.ontimeout = x.onerror = function () { if (!over) { over = true; done(new Error('no connection')); } };
    x.send();
  }

  /**
   * Open-Meteo, over plain http where https fails: its certificate chains to Let's Encrypt's ISRG root, which 2015 and
   * 2016 TVs (Tizen 2.3 and 2.4) don't trust. Only the city's coordinates and the forecast go in the clear. Each call
   * tries https first, so a newer TV whose request once timed out doesn't stay on http.
   */
  function getMeteo(path, done) {
    get('https://' + path, {}, function (err, body) {
      // A certificate the TV doesn't trust ends as a network error: status 0, or onerror.
      if (err && /^(no connection|HTTP 0)$/.test(err.message)) {
        get('http://' + path, {}, done);
        return;
      }
      done(err, body);
    });
  }

  var listeners = [];
  function changed() { for (var i = 0; i < listeners.length; i++) listeners[i](); }

  // MARK: - Weather

  function place() { return Prefs.latitude() + ',' + Prefs.longitude(); }
  // Both forecasts in one answer, the next 48 hours and today plus 5 days: Home Settings → Forecast switches without
  // asking again, and offline too. 14 steps of 15 minutes tell the card whether rain comes in the next two hours, even
  // from a forecast 30 minutes old (where the time zone is off by half an hour, they start up to 45 minutes back).
  var QUERY = '&current=temperature_2m,weather_code,is_day'
      + '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,weather_code,uv_index_max'
      + '&minutely_15=precipitation,precipitation_probability&forecast_minutely_15=14'
      + '&hourly=temperature_2m,weather_code,is_day&timezone=auto&forecast_days=6&forecast_hours=48';
  var weather = null, weatherAt = 0, fetchingWeather = false;
  (function () {
    var w = stored('weather');
    // Fetched with another query (an older version): shown, and fetched again now.
    if (w && w.place === place()) { weather = parseWeather(w.body); weatherAt = w.query === QUERY ? w.at : 0; }
  })();

  /** "2026-10-20T18:31" at the location (Open-Meteo's local time) → epoch ms. */
  function localTime(iso, offsetSeconds) {
    var m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+)/.exec(iso || '');
    if (!m) return 0;
    return Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) - offsetSeconds * 1000;
  }

  function parseWeather(o) {
    if (!o || !o.current) return null;
    var off = o.utc_offset_seconds || 0, dl = o.daily, now = Date.now();
    var w = {
      temp: o.current.temperature_2m, code: o.current.weather_code, isDay: o.current.is_day !== 0,
      max: dl.temperature_2m_max[0], min: dl.temperature_2m_min[0],
      uv: dl.uv_index_max ? dl.uv_index_max[0] : null,
      sunrise: localTime(dl.sunrise[0], off), sunset: localTime(dl.sunset[0], off), hours: [], days: []
    };
    // The 15-minute steps, [start, rain]: a step counts as rain from a 50% chance or 0.2 mm of it. rainIn reads them at
    // the moment the card is drawn, not when the forecast came.
    var mr = o.minutely_15;
    if (mr && mr.time) {
      w.steps = [];
      for (var k = 0; k < mr.time.length; k++) {
        var pr = mr.precipitation_probability ? mr.precipitation_probability[k] || 0 : 0;
        var mm = mr.precipitation ? mr.precipitation[k] || 0 : 0;
        w.steps.push([localTime(mr.time[k], off), pr >= 50 || mm >= 0.2]);
      }
    }
    var hr = o.hourly;
    for (var i = 0; hr && i < hr.time.length && w.hours.length < 6; i++) {
      var at = localTime(hr.time[i], off);
      if (at <= now) continue;
      w.hours.push({at: at, temp: hr.temperature_2m[i], code: hr.weather_code[i], day: !hr.is_day || hr.is_day[i] !== 0});
    }
    // The next 5 days, from tomorrow (none in a forecast cached before the days). Only days that haven't started at
    // the city: today, and past days in a forecast cached offline, are left out.
    for (var j = 0; dl.weather_code && j < dl.time.length && w.days.length < 5; j++) {
      if (localTime(dl.time[j] + 'T12:00', off) - 12 * 3600000 <= now) continue;
      var p = dl.time[j].split('-');   // named by its noon on the TV's clock, right even with the city far away
      w.days.push({at: new Date(+p[0], p[1] - 1, +p[2], 12).getTime(), max: dl.temperature_2m_max[j],
        min: dl.temperature_2m_min[j], code: dl.weather_code[j]});
    }
    return w;
  }

  /**
   * Rain in the next two hours at `now`: the minutes until it starts, 0 while the step we're in has it, -1 if no step up
   * to two hours from now has any, null when the steps don't reach that far (an older forecast, offline).
   */
  function rainIn(now) {
    var s = weather && weather.steps, STEP = 15 * 60000, end = now + 2 * 3600000;
    if (!s || !s.length) return null;
    for (var i = 0; i < s.length && s[i][0] < end; i++) {
      if (s[i][0] + STEP <= now) continue;   // already over
      if (s[i][1]) return Math.max(0, Math.round((s[i][0] - now) / 60000));
    }
    return s[s.length - 1][0] + STEP >= end ? -1 : null;
  }

  function refreshWeather() {
    var now = Date.now();
    if (fetchingWeather || (now - weatherAt < 30 * 60000 && now >= weatherAt)) return;
    fetchingWeather = true;
    var at = place();
    getMeteo('api.open-meteo.com/v1/forecast?latitude=' + Prefs.latitude() + '&longitude=' + Prefs.longitude() + QUERY, function (err, body) {
      fetchingWeather = false;
      if (at !== place()) { refreshWeather(); return; }   // another city was picked meanwhile
      if (err) return;
      weather = parseWeather(body);
      weatherAt = Date.now();
      store('weather', {place: at, body: body, at: weatherAt, query: QUERY});
      changed();
    });
  }

  // MARK: - Air quality

  /**
   * Open-Meteo's air-quality endpoint, apart from the forecast: its numbers change slowly, so it has its own half-hour
   * cache and its own key, and a TV that can't reach it still shows the weather.
   */
  var AIR_QUERY = 'current=us_aqi,pm2_5&timezone=auto';
  var air = null, airAt = 0, airTried = 0, fetchingAir = false;
  (function () {
    var a = stored('air');
    if (a && a.place === place() && a.query === AIR_QUERY) { air = a.body; airAt = a.at; }
  })();

  function refreshAir() {
    var now = Date.now();
    // Only for the weather card; a host that didn't answer is asked again 5 minutes later, not at every 30-second tick.
    if (!Prefs.weather() || fetchingAir || (now - airAt < 30 * 60000 && now >= airAt) || (now - airTried < 5 * 60000 && now >= airTried)) return;
    airTried = now;
    fetchingAir = true;
    var at = place();
    getMeteo('air-quality-api.open-meteo.com/v1/air-quality?latitude=' + Prefs.latitude() + '&longitude='
        + Prefs.longitude() + '&' + AIR_QUERY, function (err, body) {
      fetchingAir = false;
      if (at !== place()) { refreshAir(); return; }   // another city was picked meanwhile
      if (err || !body || !body.current) return;
      air = {aqi: body.current.us_aqi, pm25: body.current.pm2_5, at: Date.now()};
      airAt = air.at;
      store('air', {place: at, body: air, at: airAt, query: AIR_QUERY});
      changed();
    });
  }

  /** Places with this name (Open-Meteo, in the app's language): done(error, [{label, city, lat, lon}]). */
  function findCity(name, done) {
    var lang = I18N.lang.replace(/-.*/, '');   // Open-Meteo takes the language without the country
    getMeteo('geocoding-api.open-meteo.com/v1/search?count=10&format=json&language=' + lang + '&name='
        + encodeURIComponent(name.trim()), function (err, body) {
      if (err) { done(err); return; }
      var results = (body && body.results) || [], out = [], seen = {};
      for (var i = 0; i < results.length; i++) {
        var r = results[i], city = r.name || '';
        if (!city || typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
        var label = city, parts = [r.admin1, r.country];
        for (var j = 0; j < parts.length; j++) if (parts[j] && parts[j] !== city) label += ', ' + parts[j];
        if (seen['#' + label]) continue;   // places with the same name, state and country read the same
        seen['#' + label] = true;
        out.push({label: label, city: city, lat: r.latitude.toFixed(4), lon: r.longitude.toFixed(4)});
      }
      done(null, out);
    });
  }

  // MARK: - Prices

  var COINS = ['BTC', 'ETH', 'SOL', 'USDT'];
  var CURRENCY = Place.currency;
  /** A currency Binance lists no pairs in (COP, MXN...): the coins come in USDT and convert with USDT<currency>. */
  var FX = 'USDT' + CURRENCY, inFx = false;
  var QUOTE = CURRENCY === 'USD' ? 'USDT' : CURRENCY;
  /** Binance refuses the whole request when it has no pairs in the currency (INR...): the prices go in dollars then. */
  function inDollars() {
    store('dollarsFor', CURRENCY);
    CURRENCY = 'USD';
    QUOTE = 'USDT';
    inFx = false;   // dollars, not USDT converted: no USDT<currency> in the request any more
  }
  /** No direct pairs: USDT first, dollars only when Binance lists no USDT<currency> pair either. */
  function fromUsdt() {
    inFx = true;
    QUOTE = 'USDT';
  }
  /** A pair with no trade for a day: Binance halted it and keeps answering with the frozen last price (AUD since 2026-10-06). */
  function halted(list) {
    for (var i = 0; list && i < list.length; i++) if (list[i].closeTime > 0 && Date.now() - list[i].closeTime > 864e5) return true;
    return false;
  }
  if (stored('dollarsFor') === CURRENCY && CURRENCY !== 'USD') {
    CURRENCY = 'USD';
    QUOTE = 'USDT';
  } else if (stored('fxFor') === CURRENCY && CURRENCY !== 'USD') {
    fromUsdt();
  }
  var prices = [NaN, NaN, NaN, NaN], changes = [NaN, NaN, NaN, NaN], pricesAt = 0, fetchingPrices = false;

  /** The dollar card shows the USDT rate when there is one to show (reais, or a currency converted from USDT). */
  function dollarRow() {
    return CURRENCY !== 'USD' && (CURRENCY === 'BRL' || inFx);
  }

  /** Indexes in COINS of the coins that are on (and the dollar where there's a rate for it). */
  function activeCoins() {
    var out = [];
    if (!Prefs.quotes()) return out;
    for (var i = 0; i < COINS.length; i++) if (Prefs.coin(i) && (i < 3 || dollarRow())) out.push(i);
    return out;
  }

  function parsePrices(list) {
    var found = 0, fx = NaN, fxOpen = NaN, got = [false, false, false, false];
    for (var i = 0; list && i < list.length; i++) {
      if (inFx && list[i].symbol === FX) {
        fx = parseFloat(list[i].lastPrice);
        fxOpen = parseFloat(list[i].openPrice);
        continue;
      }
      for (var k = 0; k < COINS.length; k++) {
        if (list[i].symbol !== COINS[k] + QUOTE) continue;
        found++;
        var last = parseFloat(list[i].lastPrice), open = parseFloat(list[i].openPrice);
        prices[k] = last;
        changes[k] = open > 0 ? (last - open) / open * 100 : NaN;
        got[k] = true;
      }
    }
    if (inFx) {
      if (!(fx > 0)) return 0;   // no rate in the answer: as for any answer without prices
      for (var c = 0; c < 3; c++) if (got[c]) prices[c] *= fx;
      prices[3] = fx;
      changes[3] = fxOpen > 0 ? (fx - fxOpen) / fxOpen * 100 : NaN;
      return found + 1;
    }
    return found;
  }

  (function () {
    var p = stored('prices');
    if (p && p.quote === (inFx ? FX : QUOTE) && parsePrices(p.body)) pricesAt = p.at;
  })();

  function refreshPrices() {
    var coins = activeCoins(), now = Date.now(), symbols = [];
    if (!coins.length || fetchingPrices || (now - pricesAt < 5 * 60000 && now >= pricesAt)) return;
    fetchingPrices = true;
    for (var i = 0; i < coins.length; i++) if (!(inFx && coins[i] === 3)) symbols.push('%22' + COINS[coins[i]] + QUOTE + '%22');
    if (inFx) symbols.push('%22' + FX + '%22');
    var path = '/api/v3/ticker/24hr?type=MINI&symbols=%5B' + symbols.join(',') + '%5D';
    // Binance.com refuses the US (HTTP 451); Binance.US answers the same call in dollars. data-api.binance.vision is
    // Binance's own address for public market data, with Binance.com's pairs on another domain and certificate chain:
    // it answers where a network blocks or intercepts api.binance.com (#375). A refusal skips it.
    var hosts = ['https://api.binance.com', 'https://data-api.binance.vision', 'https://api.binance.us'];
    (function next(h, refused) {
      get(hosts[h] + path, {}, function (err, body) {
        // A pair Binance doesn't list (HTTP 400): direct pairs, then USDT converted, then dollars, and no further: a
        // 400 in dollars stops here. Binance.US has only dollar pairs: its 400 counts only where Binance.com refuses
        // the US (HTTP 451), not after a timeout or a 5xx there.
        if (err && err.message === 'HTTP 400' && (inFx || QUOTE !== 'USDT') && (h < 2 || refused)) {
          fetchingPrices = false;
          if (inFx) inDollars(); else fromUsdt();
          refreshPrices();
          return;
        }
        // Halted: dollars for this run, not saved like the 400's (the market may open again).
        if (!err && !inFx && QUOTE !== 'USDT' && halted(body)) { fetchingPrices = false; CURRENCY = 'USD'; QUOTE = 'USDT'; refreshPrices(); return; }
        if (err || !parsePrices(body)) {
          var refusal = !!err && err.message === 'HTTP 451';
          if (h + 1 < hosts.length && !(err && err.message === 'HTTP 400')) next(refusal ? 2 : h + 1, refused || refusal);
          else fetchingPrices = false;
          return;
        }
        fetchingPrices = false;
        pricesAt = Date.now();
        store('prices', {quote: inFx ? FX : QUOTE, body: body, at: pricesAt});
        if (inFx) store('fxFor', CURRENCY);
        changed();
      });
    })(0);
  }

  // MARK: - Picks (TMDB)

  var KEY = Prefs.tmdbKey();
  var REGION = Place.country;
  var API = 'https://api.tmdb.org/3';   // TMDB's own mirror of api.themoviedb.org: some ISPs block the other name (#327)

  /** Service name on TMDB (part of it, lowercase) → our key, how to find its app on the TV (id, name), its name. */
  var SERVICES = [
    ['netflix', 'netflix', /^netflix$/, /netflix/i, 'Netflix'],
    ['prime video', 'prime', /^amazon$/, /prime video|amazon/i, 'Prime Video'],
    ['disney', 'disney', /disney/, /disney/i, 'Disney+'],
    ['hulu', 'hulu', /^hulu/, /hulu/i, 'Hulu'],
    ['paramount', 'paramount', /paramount|cbs/, /paramount/i, 'Paramount+'],
    ['peacock', 'peacock', /peacock/, /peacock/i, 'Peacock'],
    ['globoplay', 'globoplay', /globoplay/, /globoplay/i, 'Globoplay'],
    ['max', 'max', /hbo|wbd|\.max/, /^(hbo )?max$|hbo max/i, 'Max'],
    ['apple tv', 'appletv', /appletv|apple\.tv/, /apple tv/i, 'Apple TV'],
    ['hotstar', 'hotstar', /hotstar/, /hotstar/i, 'JioHotstar'],
    ['crunchyroll', 'crunchyroll', /crunchyroll/, /crunchyroll/i, 'Crunchyroll'],
    ['now tv', 'now', /nowtv|now\.tv/, /^now( tv)?$/i, 'NOW']
  ];

  var installed = [];   // the TV's apps, from TV.apps()

  /** A service whose app is on the TV and that the person hasn't switched off in Home Settings (Picks from). */
  function usable(key) { return !!appFor(key) && !Prefs.serviceOff(key); }

  /** The streaming services whose app is on this TV, as {key, name}, for Home Settings. */
  function services() {
    var out = [];
    for (var s = 0; s < SERVICES.length; s++) if (appFor(SERVICES[s][1])) out.push({key: SERVICES[s][1], name: SERVICES[s][4]});
    return out;
  }

  /** The installed app for a service key, or null. */
  function appFor(key) {
    for (var s = 0; s < SERVICES.length; s++) {
      if (SERVICES[s][1] !== key) continue;
      for (var i = 0; i < installed.length; i++) {
        if (SERVICES[s][2].test(installed[i].id) || SERVICES[s][3].test(installed[i].title)) return installed[i];
      }
    }
    return null;
  }

  /** "… Amazon Channel" is sold inside another app; Apple TV is only the streaming service (350; 2 is the store). */
  function service(providerName, providerId) {
    var n = (providerName || '').toLowerCase();
    if (n.indexOf(' channel') >= 0) return null;
    for (var i = 0; i < SERVICES.length; i++) {
      var s = SERVICES[i];
      if (s[1] === 'appletv' && providerId !== 350) continue;
      if (s[0] === 'max' ? /\bmax\b/.test(n) : n.indexOf(s[0]) >= 0) return s;
    }
    return null;
  }

  function tmdb(path, done, key) {
    key = key || KEY;
    var bearer = key.indexOf('eyJ') === 0;   // read access token (v4) or API key (v3)
    var url = API + path + (bearer ? '' : (path.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + encodeURIComponent(key));
    get(url, bearer ? {Authorization: 'Bearer ' + key, Accept: 'application/json'} : {Accept: 'application/json'}, done);
  }

  // MARK: - Watchmode: the title's own page in its app (watchmode_key; the free plan's web addresses are what's handed
  // over). Looked up only when a pick is opened, 2 requests of the free plan's 2,500 a month, and kept.

  var WATCHMODE = 'https://api.watchmode.com/v1', wmRefused = false;

  function wmLinks() { return stored('wm') || {}; }

  /** The pick's page in its app, done(url or ''), within 4 s; '' without a key or a match (the app opens at home). */
  // MARK: - RPDB (rpdb_key): posters with the title's ratings (IMDb, Metacritic, Rotten Tomatoes) drawn under them

  /** A pick detailed before RPDB was on has no IMDb id yet: its details are fetched once more. */
  function needsImdb(p) { return !!CONFIG.rpdbKey && p.imdb === undefined; }

  /** The pick's poster: RPDB's with its ratings when there's a key and an IMDb id, else TMDB's. */
  function poster(p, size) {
    if (CONFIG.rpdbKey && p.imdb) return 'https://api.ratingposterdb.com/' + encodeURIComponent(CONFIG.rpdbKey) + '/imdb/poster-default/' + p.imdb + '.jpg';
    return p.poster ? 'https://image.tmdb.org/t/p/' + (size || 'w342') + p.poster : '';
  }

  function titleLink(p, done) {
    var key = String(CONFIG.watchmodeKey || '').trim(), id = p.kind + ':' + p.id + ':' + p.app, links = wmLinks();
    if (!key || wmRefused || !p.app) { done(''); return; }
    if (links[id] !== undefined) { done(links[id]); return; }
    var answered = false;
    function answer(link) { if (!answered) { answered = true; done(link); } }
    setTimeout(function () { answer(''); }, 4000);   // a slow answer opens the app at home, and is kept for next time
    function keep(link) { links = wmLinks(); links[id] = link; store('wm', links); answer(link); }
    get(WATCHMODE + '/search/?search_field=tmdb_' + p.kind + '_id&search_value=' + p.id + '&apiKey=' + encodeURIComponent(key), {}, function (e, r) {
      if (e) { if (/401/.test(e.message) || /rejected/.test(e.message)) wmRefused = true; answer(''); return; }
      var found = r && r.title_results && r.title_results[0];
      if (!found) { keep(''); return; }
      get(WATCHMODE + '/title/' + found.id + '/sources/?regions=' + REGION + '&apiKey=' + encodeURIComponent(key), {}, function (e2, sources) {
        if (e2) { answer(''); return; }
        keep(sourceLink(sources || [], p.app));
      });
    });
  }

  /** The subscription's https page of that service among Watchmode's sources, as on Android (Recs.findLink). */
  function sourceLink(sources, app) {
    var want = '';
    for (var s = 0; s < SERVICES.length; s++) if (SERVICES[s][1] === app) want = SERVICES[s][0].replace(/ /g, '');
    if (!want) return '';
    for (var i = 0; i < sources.length; i++) {
      var words = String(sources[i].name || '').toLowerCase(), name = words.replace(/ /g, '');
      // Not a channel sold inside another app ("MGM+ (Via Amazon Prime)"): that page opens Amazon's app.
      var resold = name.indexOf('channel') >= 0 || name.indexOf('(via') >= 0;
      var same = !resold && (want === 'max' ? /\bmax\b/.test(words) : name.indexOf(want) >= 0);
      var url = String(sources[i].web_url || '');
      if (same && sources[i].type === 'sub' && url.indexOf('https://') === 0) return url;
    }
    return '';
  }

  /** Asks TMDB whether a key works before it's saved: done(error), with error.rejected when TMDB said no. */
  function checkKey(key, done) {
    tmdb('/configuration', function (err) {
      if (err && /rejected/.test(err.message)) err.rejected = true;
      done(err || null);
    }, key);
  }

  var cache = stored('recs') || {};
  var picks = cache.picks || [], listAt = cache.listAt || 0, period = cache.period, listLang = cache.lang || '', stamp = cache.stamp || '';
  var fetchingRecs = false, failedAt = 0, recsError = '';

  function saveRecs() { store('recs', {picks: picks, listAt: listAt, period: period, lang: listLang, stamp: stamp}); }

  function hourPeriod(d) {
    var h = d.getHours();
    return h >= 5 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : 2;
  }

  function sourceStamp() {
    // ':m3': picks kept from before they knew their genres are fetched again.
    var s = KEY.length + ':' + KEY.slice(-6) + ':' + REGION + ':m3' + (Prefs.hideAnimation() ? ':no-animation' : '');
    for (var i = 0; i < SERVICES.length; i++) s += usable(SERVICES[i][1]) ? '1' : '0';
    return s;
  }

  function franchise(title) {
    var t = (title || '').toLowerCase(), cut = t.indexOf(':');
    if (cut < 0) cut = t.indexOf(' - ');
    return (cut > 0 ? t.slice(0, cut) : t).replace(/^\s+|\s+$/g, '');
  }

  /** This hour's picks (Prefs.cards()): movies ("movie"), shows ("tv") or both (null). */
  function now(kind) {
    var list = [];
    if (!KEY) return list;
    for (var i = 0; i < picks.length; i++) {
      var p = picks[i];
      if ((kind === null || kind === p.kind) && (!p.detailed || (p.app && usable(p.app)))) list.push(p);
    }
    if (!list.length) return list;
    var hour = Math.floor(Date.now() / 3600000), out = [], seen = {}, n = Prefs.cards();
    for (var j = 0; j < list.length && out.length < n; j++) {
      var q = list[(hour * n + j) % list.length], f = franchise(q.title);
      if (!seen[f]) { seen[f] = true; out.push(q); }
    }
    return out;
  }

  /** TMDB's language, as on Android: Latin American Spanish unless the TV is in Spain, and Germany's German. */
  function lang() {
    if (I18N.lang === 'es') return /-ES\b/i.test(navigator.language || '') ? 'es-ES' : 'es-MX';
    if (I18N.lang === 'de') return 'de-DE';   // TMDB's de-AT and de-CH have few translations of their own
    return I18N.locale();
  }

  function day(offset) {
    var d = new Date(Date.now() + offset * 86400000);
    function two(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  /** TMDB's genres that it leaves in English in some languages. */
  function genre(name) {
    switch (name) {
      case 'Action & Adventure': return tr('genre|Action & Adventure');
      case 'Sci-Fi & Fantasy': return tr('genre|Sci-Fi & Fantasy');
      case 'War & Politics': return tr('genre|War & Politics');
      case 'Kids': return tr('genre|Kids');
      case 'News': return tr('genre|News');
      case 'Soap': return tr('genre|Soap');
      case 'Talk': return tr('genre|Talk');
      default: return name;
    }
  }

  /** The best backdrop: no text over it, the largest, then the best rated. */
  function bestBackdrop(images) {
    var list = images && images.backdrops, best = null, score = -1;
    for (var i = 0; list && i < list.length; i++) {
      var b = list[i];
      if (!b.file_path) continue;
      var s = (b.iso_639_1 === null ? 1e7 : 0) + Math.min(b.width || 0, 3840) * 100 + (b.vote_average || 0);
      if (s > score) { score = s; best = b.file_path; }
    }
    return best;
  }

  /** Genre, runtime or seasons, and the service it's on among the TV's apps. */
  function details(p, done) {
    tmdb('/' + p.kind + '/' + p.id + '?language=' + lang() + '&append_to_response=watch/providers,images,external_ids&include_image_language=null,'
        + I18N.base + ',en', function (err, o) {
      if (err) { done(err); return; }
      var best = bestBackdrop(o.images);
      if (best) p.backdrop = best;
      if (o.poster_path) p.poster = o.poster_path;
      p.imdb = o.imdb_id || (o.external_ids && o.external_ids.imdb_id) || '';   // RPDB's posters are by IMDb id
      // Under the focused poster: only the genre and the length (movie) or seasons (show).
      var parts = [];
      p.genres = (o.genres || []).map(function (g) { return g.id; });   // for the genre sub-tabs (GENRES)
      if (o.genres && o.genres.length) {
        parts.push(genre(o.genres[0].name));
      }
      if (p.kind === 'movie' && o.runtime > 0) {
        var h = Math.floor(o.runtime / 60), m = o.runtime % 60;
        parts.push(h ? trf('{h}h {m}m', {h: h, m: m}) : trf('{m}m', {m: m}));
      } else if (p.kind === 'tv' && o.number_of_seasons > 0) {
        parts.push(plural('plural|one:{n} season|other:{n} seasons', o.number_of_seasons));
      }
      var wp = o['watch/providers'], here = wp && wp.results && wp.results[REGION], flat = here && here.flatrate;
      p.app = null;
      for (var i = 0; flat && i < flat.length && !p.app; i++) {
        var s = service(flat[i].provider_name, flat[i].provider_id);
        if (s && usable(s[1])) { p.app = s[1]; p.service = s[4]; }
      }
      p.meta = parts.join(' · ');
      title(p, o, function () {
        p.detailed = true;
        done(null);
      });
    });
  }

  /**
   * Without a title in the TV's language TMDB answers with the original one, so a Korean series on a German TV reads
   * "닥터X: 하얀 마피아의 시대". Then the English title, when TMDB has one (one more request, only for those).
   */
  function title(p, o, done) {
    var field = p.kind === 'movie' ? 'title' : 'name', own = o[field] || p.title;
    p.title = own;
    if (I18N.lang === 'en' || !own || own !== o['original_' + field] || o.original_language === I18N.base
        || o.original_language === 'en') { done(); return; }
    tmdb('/' + p.kind + '/' + p.id + '?language=en-US', function (err, en) {
      if (!err && en && en[field]) p.title = en[field];
      done();
    });
  }

  /** TMDB's Animation genre (movies and shows: cartoons and anime), left out with Cartoons and anime off. */
  var ANIMATION = 16;

  function animated(o) {
    for (var i = 0; o.genre_ids && i < o.genre_ids.length; i++) if (o.genre_ids[i] === ANIMATION) return true;
    return false;
  }

  function addPick(list, o, kind) {
    if (!o.backdrop_path) return;
    if (Prefs.hideAnimation() && animated(o)) return;
    list.push({id: o.id, kind: kind, title: kind === 'movie' ? o.title : o.name, backdrop: o.backdrop_path, poster: o.poster_path || '', meta: '', app: null, detailed: false});
  }

  function keyOf(p) { return p.kind + ':' + p.id; }

  function alternate(out, seen, a, b, max) {
    for (var i = 0; i < Math.max(a.length, b.length) && out.length < max; i++) {
      if (i < a.length && !seen[keyOf(a[i])]) { seen[keyOf(a[i])] = true; out.push(a[i]); }
      if (i < b.length && out.length < max && !seen[keyOf(b[i])]) { seen[keyOf(b[i])] = true; out.push(b[i]); }
    }
  }

  /** Runs fn on each item one after the other (the TV's network is shared with what's playing). */
  function each(items, fn, done) {
    var i = 0;
    (function next() {
      if (i >= items.length) { done(); return; }
      fn(items[i++], next);
    })();
  }

  function fetchList(done) {
    tmdb('/watch/providers/movie?language=' + lang() + '&watch_region=' + REGION, function (err, res) {
      if (err) { done(err); return; }
      var ids = [];
      for (var i = 0; res.results && i < res.results.length; i++) {
        var s = service(res.results[i].provider_name, res.results[i].provider_id);
        if (s && usable(s[1])) ids.push(res.results[i].provider_id);
      }
      if (!ids.length) { done(new Error("none of the TV's streaming apps are on TMDB (or switched on in Picks from)")); return; }
      var common = '&language=' + lang() + '&watch_region=' + REGION + '&with_watch_monetization_types=flatrate&include_adult=false'
          + '&sort_by=popularity.desc&with_watch_providers=' + encodeURIComponent(ids.join('|'))
          + (Prefs.hideAnimation() ? '&without_genres=' + ANIMATION : '');
      var hot = {movie: [], tv: []}, fresh = {movie: [], tv: []};
      each(['movie', 'tv'], function (kind, next) {
        tmdb('/trending/' + kind + '/week?language=' + lang(), function (e, r) {
          var candidates = [];
          for (var j = 0; !e && j < r.results.length && j < 16; j++) addPick(candidates, r.results[j], kind);
          // Trending is only kept when it's on one of the TV's apps: the details say where.
          each(candidates, function (p, n) {
            details(p, function (de) { if (!de && p.app) hot[kind].push(p); n(); });
          }, next);
        });
      }, function () {
        tmdb('/discover/movie?vote_count.gte=30&primary_release_date.gte=' + day(-365) + '&primary_release_date.lte=' + day(0) + common, function (e1, r1) {
          for (var j = 0; !e1 && j < r1.results.length; j++) addPick(fresh.movie, r1.results[j], 'movie');
          tmdb('/discover/tv?vote_count.gte=20&air_date.gte=' + day(-90) + '&air_date.lte=' + day(0) + common, function (e2, r2) {
            for (var k = 0; !e2 && k < r2.results.length; k++) addPick(fresh.tv, r2.results[k], 'tv');
            var list = [], seen = {};
            alternate(list, seen, hot.movie, hot.tv, 24);
            alternate(list, seen, fresh.movie, fresh.tv, 24);
            if (!list.length) { done(new Error('TMDB returned no recommendations')); return; }
            picks = list;
            done(null);
          });
        });
      });
    });
  }

  /** Fetches the list when stale (6 h, a new period of the day, language, key or apps), then this hour's details. */
  function refreshRecs() {
    if (!KEY || fetchingRecs || !installed.length) return;
    var t = Date.now(), p = hourPeriod(new Date()), st = sourceStamp();
    if (st === stamp && failedAt && t - failedAt < 10 * 60000 && t >= failedAt) return;
    var stale = st !== stamp || p !== period || t - listAt > 6 * 3600000 || t < listAt || !picks.length || listLang !== I18N.lang;
    var wanted = all(), missing = false;
    for (var i = 0; i < wanted.length; i++) missing = missing || !wanted[i].detailed || needsImdb(wanted[i]);
    if (!stale && !missing) return;
    fetchingRecs = true;
    stamp = st;
    function finish(err) {
      fetchingRecs = false;
      if (err) { recsError = err.message; failedAt = Date.now(); } else { recsError = ''; failedAt = 0; }
      saveRecs();
      changed();
    }
    function detailWanted() {
      var todo = all().filter(function (x) { return !x.detailed || needsImdb(x); });
      each(todo, function (x, next) { details(x, function () { next(); }); }, function () { finish(null); });
    }
    if (stale) {
      fetchList(function (err) {
        if (err) { finish(err); return; }
        listAt = Date.now();
        period = p;
        listLang = I18N.lang;
        detailWanted();
      });
    } else {
      detailWanted();
    }
  }

  /** This hour's picks for the three tabs, without repeats (the screensaver shows them too). */
  function all() {
    var out = [], seen = {}, kinds = [null, 'movie', 'tv'];
    for (var k = 0; k < kinds.length; k++) {
      var list = now(kinds[k]);
      for (var i = 0; i < list.length; i++) if (!seen[keyOf(list[i])]) { seen[keyOf(list[i])] = true; out.push(list[i]); }
    }
    return out;
  }

  // MARK: - Trakt's picks: Continue Watching (what's paused, a show's next episode), For You (the watchlist and Trakt's
  // recommendations, interleaved) and Explore (the picks above, without what's been watched). Each title is TMDB's,
  // detailed as the picks are; the lists come again every 15 minutes.

  // -3: kept from before the picks knew their genres (the genre sub-tabs), they're detailed again.
  var tk = stored('trakt-picks-3') || {lists: null, at: 0, pool: {}}, fetchingTrakt = false, detailingTrakt = false, detailAgain = false;

  function saveTrakt() { store('trakt-picks-3', tk); }

  function traktPick(key, note) {
    var p = tk.pool[key];
    if (!p) {
      var k = key.split(':');
      p = tk.pool[key] = {id: +k[1], kind: k[0], title: '', backdrop: '', poster: '', meta: '', app: null, detailed: false};
    }
    // Only the details' line (genre, length): which Trakt list or episode it comes from isn't shown.
    return p;
  }

  // A tab shows 20 at first, and 20 more each time the arrow at its end is opened (Data.more).
  /**
   * The genre sub-tabs: big genres, each a few of TMDB's (movies and shows have their own ids). All first; label is the
   * catalogue's key; trakt: Trakt's slugs for it (shows have horror there, not on TMDB).
   */
  var GENRES = [
    {label: 'kind|All'},
    // Adventure takes in action, science fiction and fantasy; Thriller (Suspense) crime, mystery and horror.
    {label: 'genre|Adventure', movie: [28, 12, 878, 14], tv: [10759, 10765], trakt: ['action', 'adventure', 'science-fiction', 'fantasy', 'superhero']},
    {label: 'genre|Comedy', movie: [35], tv: [35], trakt: ['comedy']},
    {label: 'genre|Drama', movie: [18], tv: [18], trakt: ['drama']},
    {label: 'genre|Thriller', movie: [53, 80, 9648, 27], tv: [80, 9648], trakt: ['thriller', 'crime', 'mystery', 'suspense', 'horror']},
    {label: 'genre|Animation', movie: [16], tv: [16], trakt: ['animation', 'anime']},
    {label: 'genre|Documentary', movie: [99], tv: [99], trakt: ['documentary']}
  ];

  var TAB_STEP = 20, shownN = [TAB_STEP, TAB_STEP, TAB_STEP, TAB_STEP], moreLeft = [false, false, false, false];

  // The filters are applied before TMDB is asked: Trakt gives each title's genres with its lists (extended=full), and
  // trending comes already filtered by Trakt for a genre. Only the titles a filter keeps are detailed, 20 at a time, so
  // a page is full unless there are no more. The view (tab, kind, genre) home.js shows is what gets detailed first.

  var view = {tab: 1, kind: null, genre: 0}, hotBy = {}, hotAsked = {}, detailGen = 0;

  /** Whether a title is of a big genre: true, false, or null when not known yet (it may be: details will tell). */
  function keyInGenre(key, G) {
    if (!G || !G.movie) return true;
    var slugs = tk.lists && tk.lists.genres && tk.lists.genres[key];
    if (slugs) { for (var j = 0; j < slugs.length; j++) if (G.trakt.indexOf(slugs[j]) >= 0) return true; return false; }
    var q = tk.pool[key];
    if (!q || !q.detailed) return null;
    var ids = q.kind === 'tv' ? G.tv : G.movie;
    for (var i = 0; q.genres && i < q.genres.length; i++) if (ids.indexOf(q.genres[i]) >= 0) return true;
    return false;
  }

  /** A tab's titles for a filter, in its order: what isn't deleted, of the kind, of the genre (or maybe), and for
   * Explore and Discover not watched yet. */
  function candidates(tab, kind, genre) {
    var L = tk.lists, G = GENRES[genre || 0], keys = tabKeys(tab, genre), out = [];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (marks.trash[k] || (kind && k.indexOf(kind + ':') !== 0) || (tab < 2 && L.watched[k])) continue;
      if (keyInGenre(k, G) === false) continue;
      out.push(k);
    }
    return out;
  }

  /**
   * The picks of a tab from Trakt's lists: 0 Explore (trending on Trakt), 1 For You (its recommendations), 2 Continue
   * Watching (paused, or a show's next episode), 3 Watchlist. Every detailed title shows, on one of the TV's apps or
   * not (home.js opens the rest in Stremio).
   */
  function traktTab(tab, kind, genre) {
    var L = tk.lists, out = [], G = GENRES[genre || 0];
    if (view.tab !== tab || view.kind !== kind || view.genre !== (genre || 0)) {
      view = {tab: tab, kind: kind, genre: genre || 0};
      detailGen++;   // a round for another view stops where it is
      setTimeout(detailTrakt, 0);   // the new filter's titles get their details
    }
    moreLeft[tab] = false;
    if (!L) return out;
    var keys = candidates(tab, kind, genre), seen = 0;
    for (var i = 0; i < keys.length && out.length < shownN[tab]; i++) {
      var p = traktPick(keys[i], '');
      if (p.detailed && keyInGenre(keys[i], G)) out.push(p);
    }
    for (var j = 0; j < keys.length; j++) if (keyInGenre(keys[j], G) !== false) seen++;
    moreLeft[tab] = seen > out.length;
    return out;
  }

  /** A tab's keys; Explore for a genre is Trakt's trending filtered by Trakt (fetched once for it, then kept). */
  function tabKeys(tab, genre) {
    var L = tk.lists;
    if (!L) return [];
    if (tab === 0 && genre && GENRES[genre].trakt) {
      var hot = hotBy[genre];
      if (!hot && !hotAsked[genre]) {
        hotAsked[genre] = true;
        Trakt.trending(GENRES[genre].trakt, function (err, keys, genres) {
          if (err) { hotAsked[genre] = false; return; }
          hotBy[genre] = keys;
          for (var k in genres) if (Object.prototype.hasOwnProperty.call(genres, k)) L.genres[k] = genres[k];
          detailTrakt();
        });
      }
      if (hot) return hot;
    }
    return tab === 0 ? L.trending || [] : tab === 1 ? L.recommended : tab === 2 ? L.progress.map(function (g) { return g.key; }) : L.watchlist;
  }

  function refreshTrakt() {
    if (!Trakt.signedIn() || fetchingTrakt || !KEY || !installed.length) return;
    var t = Date.now();
    // Lists kept from before they carried Trakt's genres (or trending) are fetched again at once.
    if (tk.lists && tk.lists.trending && tk.lists.genres && t - tk.at < 15 * 60000 && t >= tk.at) { detailTrakt(); return; }
    fetchingTrakt = true;
    Trakt.lists(function (err, lists) {
      fetchingTrakt = false;
      if (!err && lists) { tk.lists = lists; tk.at = Date.now(); hotBy = {}; hotAsked = {}; saveTrakt(); }
      detailTrakt();
    });
  }

  /**
   * TMDB's details, one at a time as the picks': first the titles the view shows (its filter's first ones up to the
   * tab's count, and ones of unknown genre among them), then each other tab's first ones for All, All.
   */
  function detailTrakt() {
    if (detailingTrakt) { detailAgain = true; return; }   // more asked meanwhile: once this round ends
    if (!tk.lists) return;
    var todo = [];
    function take(tab, kind, genre) {
      var keys = candidates(tab, kind, genre), n = 0, G = GENRES[genre || 0];
      for (var j = 0; j < keys.length && n < shownN[tab]; j++) {
        var p = traktPick(keys[j], '');
        if ((!p.detailed || needsImdb(p)) && todo.indexOf(p) < 0) todo.push(p);
        if (keyInGenre(keys[j], G) !== false) n++;
      }
    }
    if (typeof view.tab === 'number') take(view.tab, view.kind, view.genre);
    for (var t = 0; t < 4; t++) take(t, null, 0);
    if (!todo.length) { changed(); return; }
    detailingTrakt = true;
    var gen = detailGen, done = 0;
    each(todo, function (p, next) {
      if (gen !== detailGen) { next(); return; }   // the view changed: this round ends, the next starts with it
      details(p, function () { if (++done % 5 === 0) changed(); next(); });   // the row fills as they come
    }, function () {
      detailingTrakt = false;
      saveTrakt();
      changed();
      if (detailAgain || gen !== detailGen) { detailAgain = false; detailTrakt(); }
    });
  }

  // MARK: - Search: any title on TMDB (movies and shows), detailed as the picks, the first ones first

  var SEARCH_MAX = 20;

  /** done(error, picks so far, finished), called as each result is detailed; seq lets a newer search win. */
  function search(query, done) {
    tmdb('/search/multi?query=' + encodeURIComponent(query) + '&language=' + lang() + '&include_adult=false', function (err, r) {
      if (err) { done(err, [], true); return; }
      var found = [];
      for (var i = 0; r && r.results && i < r.results.length && found.length < SEARCH_MAX; i++) {
        var o = r.results[i], kind = o.media_type;
        if ((kind === 'movie' || kind === 'tv') && (o.poster_path || o.backdrop_path)) addPick(found, o, kind);
      }
      if (!found.length) { done(null, [], true); return; }
      var shown = [];
      each(found, function (p, next) {
        details(p, function (e) { if (!e && !deleted(p)) { shown.push(p); done(null, shown.slice(), false); } next(); });
      }, function () { done(null, shown, true); });
    });
  }

  // MARK: - Favorites and deleted: a title favorited shows in the home tab too; one deleted shows nowhere but the trash
  // tab. Kept in this TV's storage apart from the settings (settings_on_tv=false leaves them), each with what drawing
  // it needs, so it shows even once it's left Trakt's lists. Newest first.

  var marks = stored('marks') || {fav: {}, trash: {}};

  function markKey(p) { return p.kind + ':' + p.id; }

  function snapshot(p) {
    return {id: p.id, kind: p.kind, title: p.title, backdrop: p.backdrop, poster: p.poster, imdb: p.imdb, app: p.app,
      genres: p.genres || [], meta: p.meta, detailed: true, at: Date.now()};
  }

  /** what: 'fav', 'unfav', 'trash' (it leaves the favorites too) or 'restore'. */
  function mark(p, what) {
    var k = markKey(p);
    if (what === 'fav') { marks.fav[k] = snapshot(p); delete marks.trash[k]; }
    else if (what === 'unfav') delete marks.fav[k];
    else if (what === 'trash') { marks.trash[k] = snapshot(p); delete marks.fav[k]; }
    else if (what === 'restore') delete marks.trash[k];
    store('marks', marks);
    changed();
  }

  function deleted(p) { return !!marks.trash[markKey(p)]; }

  /** A big genre of GENRES: a title in one of its TMDB genres (all for All). */
  function genreOk(p, genre) {
    var G = GENRES[genre || 0];
    if (!G.movie) return true;
    var ids = p.kind === 'tv' ? G.tv : G.movie;
    for (var j = 0; p.genres && j < p.genres.length; j++) if (ids.indexOf(p.genres[j]) >= 0) return true;
    return false;
  }

  function marked(which, kind, genre) {
    var all = [], m = marks[which];
    for (var k in m) if (Object.prototype.hasOwnProperty.call(m, k)) all.push(m[k]);
    all.sort(function (a, b) { return b.at - a.at; });
    return all.filter(function (p) { return (!kind || p.kind === kind) && genreOk(p, genre); });
  }

  // MARK: - Formatting

  function fmt(v, digits) {
    // Old WebKit (Tizen 2) has no Intl: toLocaleString ignores its options and prints every digit, without failing.
    // English separators there; a per-language table if someone asks.
    if (typeof Intl === 'undefined') return v.toFixed(digits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    try { return v.toLocaleString(I18N.locale(), {minimumFractionDigits: digits, maximumFractionDigits: digits}); } catch (e) { return v.toFixed(digits); }
  }

  var SYMBOLS = {USD: '$', BRL: 'R$ ', EUR: '€', GBP: '£', JPY: '¥'};

  return {
    COINS: COINS,
    get city() { return Prefs.city(); },
    currency: CURRENCY,
    onChange: function (fn) { listeners.push(fn); },
    setApps: function (apps) { installed = apps; },
    appFor: appFor,
    usable: usable,
    services: services,
    refresh: function () { refreshWeather(); refreshAir(); refreshPrices(); refreshRecs(); refreshTrakt(); },
    /** A tab's picks: Trakt's when signed in (traktTab), else this hour's of that kind. */
    /** Whether a tab has more than it shows (its last card is then an arrow for 20 more). */
    hasMore: function (tab) { return Trakt.signedIn() && typeof tab === 'number' && !!moreLeft[tab]; },
    /** 20 more of a tab: their details come, and the row grows. */
    more: function (tab) { if (typeof tab !== 'number') return; shownN[tab] += TAB_STEP; detailTrakt(); },
    /** tab: 'fav', 'trash', or Trakt's 0 to 3 (the kinds' tabs without Trakt); the deleted show only in 'trash'. */
    tabPicks: function (tab, kind, genre) {
      if (tab === 'fav' || tab === 'trash') return marked(tab, kind, genre);
      return (Trakt.signedIn() ? traktTab(tab, kind, genre) : now(kind)).filter(function (p) { return !deleted(p); });
    },
    mark: mark,
    /** Still fetching or detailing picks: an empty row may fill yet (home.js shows dots, not "nothing here"). */
    busy: function () { return !!(fetchingRecs || fetchingTrakt || detailingTrakt); },
    isFav: function (p) { return !!marks.fav[markKey(p)]; },
    favCount: function () { var n = 0; for (var k in marks.fav) if (Object.prototype.hasOwnProperty.call(marks.fav, k)) n++; return n; },
    /** Signed in or out of Trakt: its lists are fetched again. */
    traktChanged: function () { tk.at = 0; if (!Trakt.signedIn()) tk = {lists: null, at: 0, pool: {}}; saveTrakt(); refreshTrakt(); changed(); },
    settingsChanged: function () { pricesAt = 0; refreshPrices(); changed(); },
    findCity: findCity,
    /** Another city picked: its weather now (none shown until it comes). */
    cityChanged: function () { weather = null; weatherAt = 0; air = null; airAt = 0; airTried = 0; refreshWeather(); refreshAir(); changed(); },
    get weather() { return weather; },
    get air() { return air; },
    rainIn: rainIn,
    get weatherAt() { return weatherAt; },
    prices: prices,
    changes: changes,
    get pricesAt() { return pricesAt; },
    activeCoins: activeCoins,
    hasKey: function () { return !!KEY; },
    checkKey: checkKey,
    /** A key typed (or removed) on the TV: the picks come again with it, or go. */
    keyChanged: function () { KEY = Prefs.tmdbKey(); recsError = ''; failedAt = 0; refreshRecs(); changed(); },
    recsError: function () { return recsError; },
    picks: now,
    showcase: all,
    poster: poster,
    titleLink: titleLink,
    genres: function () { return GENRES; },
    search: search,
    image: function (path, size) { return path ? 'https://image.tmdb.org/t/p/' + (size || 'w1280') + path : ''; },

    /** Night at the location: from sunset to sunrise (the last forecast; without one, 6:00 and 18:00). */
    isNight: function (at) {
      var theme = Prefs.theme();
      if (theme === 'dark') return true;
      if (theme === 'light') return false;
      var d = new Date(at), mins = d.getHours() * 60 + d.getMinutes();
      function hm(t, fallback) { if (!t) return fallback; var x = new Date(t); return x.getHours() * 60 + x.getMinutes(); }
      var rise = hm(weather && weather.sunrise, 360), set = hm(weather && weather.sunset, 1080);
      return mins < rise || mins >= set;
    },

    compact: function (v) {
      if (isNaN(v)) return '—';
      if (v >= 1000000) return fmt(v / 1000000, 2) + 'M';
      if (v >= 10000) return fmt(v / 1000, 1) + 'k';
      if (v >= 1000) return fmt(v / 1000, 2) + 'k';
      if (v >= 100) return fmt(v, 0);
      return fmt(v, 2);
    },
    money: function (v) {
      var s = SYMBOLS[CURRENCY] || CURRENCY + ' ';
      if (isNaN(v)) return s + '—';
      return s + (v >= 1000 ? fmt(v, 0) : fmt(v, 2));
    },
    change: function (v) { return isNaN(v) ? '' : (v >= 0 ? '+' : '−') + fmt(Math.abs(v), 1) + '%'; },
    degrees: function (v) {
      if (v === undefined || v === null || isNaN(v)) return '—';
      var unit = Prefs.temperature();
      var f = unit === 'F' || (unit === 'auto' && Place.fahrenheit);
      return Math.round(f ? v * 9 / 5 + 32 : v) + '°';
    },
    /** "3 PM", "15:00", "15 Uhr": the hourly forecast. */
    hour: function (at) { return formatDate('format|h a', at); },
    /** "Seg", "Mon", "Lun", "Mo", "Пн": the short day of the week, capitalized and without the abbreviation's dot. */
    weekday: function (at) {
      var s = formatDate('format|EEE', at).replace(/\.$/, '');
      return s.charAt(0).toUpperCase() + s.substring(1);
    },
    /** "5:21 AM", "05:21": the clock, sunrise and sunset. */
    time: function (at) { return formatDate('format|h:mm a', at); },
    /** "12 min ago" when the data is old (no internet), or empty. */
    staleness: function (at, every) {
      if (!at) return '';
      var age = Date.now() - at;
      if (age < every * 2) return '';
      var m = Math.floor(age / 60000), h = Math.floor(m / 60);
      return m < 60 ? trf('{n} min ago', {n: m}) : trf('{n} h ago', {n: h});
    },
    condition: function (code, day) {
      if (code === undefined || code === null || code < 0) return '';
      if (code === 0) return day ? tr('Clear') : tr('night|Clear');
      if (code === 1) return day ? tr('Mostly Sunny') : tr('Mostly Clear');
      if (code === 2) return tr('Partly Cloudy');
      if (code === 3) return tr('Cloudy');
      if (code === 45 || code === 48) return tr('Fog');
      if (code >= 51 && code <= 57) return tr('Drizzle');
      if (code === 65 || code === 67 || code === 82) return tr('Heavy Rain');
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return tr('Snow');
      if (code >= 95) return tr('Thunderstorms');
      return tr('Rain');
    },
    symbol: function (code, day) {
      if (code <= 1) return day ? 'sunny' : 'clear_night';
      if (code === 2) return day ? 'partly_cloudy_day' : 'partly_cloudy_night';
      if (code === 3) return 'cloud';
      if (code === 45 || code === 48) return 'foggy';
      if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowflake';
      if (code >= 95) return 'thunderstorm';
      return 'rainy';
    },
    coinName: function (i) { return i === 3 ? tr('Dollar') : ['Bitcoin', 'Ethereum', 'Solana'][i]; }
  };
})();

/**
 * Trakt (trakt_client_id), as on Android (Trakt.java): signed in with a code typed at trakt.tv/activate (the device
 * flow with PKCE: no secret is built in), then the account's progress, watched titles, watchlist and recommendations
 * make the picks. The tokens stay in this TV's storage and go only to api.trakt.tv.
 */
var Trakt = (function () {
  'use strict';
  var API = 'https://api.trakt.tv', ID = String((window.CONFIG || {}).traktClientId || '').trim();
  // Long lists (only TMDB ids: small); Data details 20 more of a tab each time its last card, the arrow, is opened.
  var WATCHLIST_MAX = 200, RECOMMENDED_MAX = 50, TRENDING_MAX = 60, UP_NEXT_SHOWS = 12;
  var state = {code: '', url: '', message: ''}, busy = false, listeners = [];

  function load() { try { return JSON.parse(localStorage.getItem('fmtv.trakt')) || {}; } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem('fmtv.trakt', JSON.stringify(v)); } catch (e) {} }
  function changed() { for (var i = 0; i < listeners.length; i++) listeners[i](); }

  /** SHA-256 of an ASCII string, as bytes (ES5 has no crypto.subtle on old TVs; only the PKCE challenge needs it). */
  function sha256(text) {
    var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
    var bytes = [], i, t;
    for (i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 255);
    var bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    bytes.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    var w = [];
    for (var o = 0; o < bytes.length; o += 64) {
      for (t = 0; t < 16; t++) w[t] = (bytes[o + 4 * t] << 24) | (bytes[o + 4 * t + 1] << 16) | (bytes[o + 4 * t + 2] << 8) | bytes[o + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var x = w[t - 15], y = w[t - 2];
        w[t] = (w[t - 16] + (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) + w[t - 7] + (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10))) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        var t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    for (i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    return out;
  }

  function base64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function random(n) {
    var out = [], i;
    try {
      var a = new Uint8Array(n);
      window.crypto.getRandomValues(a);
      for (i = 0; i < n; i++) out.push(a[i]);
    } catch (e) {
      for (i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
    }
    return out;
  }

  /** One request: done(status, json or null). */
  function send(method, path, body, token, done) {
    var x = new XMLHttpRequest(), over = false;
    x.open(method, API + path, true);
    x.timeout = 15000;
    x.setRequestHeader('Content-Type', 'application/json');
    x.setRequestHeader('trakt-api-version', '2');
    x.setRequestHeader('trakt-api-key', ID);
    if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.onreadystatechange = function () {
      if (x.readyState !== 4 || over) return;
      over = true;
      var json = null;
      try { json = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) {}
      done(x.status, json);
    };
    x.ontimeout = x.onerror = function () { if (!over) { over = true; done(0, null); } };
    x.send(body ? JSON.stringify(body) : null);
  }

  function keep(t) {
    var v = load(), created = t.created_at || Math.floor(Date.now() / 1000);
    v.access = t.access_token;
    v.refresh = t.refresh_token;
    v.expires = (created + (t.expires_in || 86400)) * 1000;
    save(v);
  }

  /** The code to type at trakt.tv/activate (state.code), then waits for it; a code that expires makes a new one. */
  function signIn() {
    if (!ID || busy || signedIn()) return;
    busy = true;
    state.message = '';
    var verifier = base64url(random(48)), challenge = base64url(sha256(verifier));
    send('POST', '/oauth/device/code', {client_id: ID, code_challenge: challenge, code_challenge_method: 'S256'}, '', function (status, start) {
      if (status !== 200 || !start) {
        busy = false;
        state.code = '';
        state.message = trf("Couldn't sign in: {error}", {error: 'HTTP ' + status});
        changed();
        return;
      }
      state.code = start.user_code;
      state.url = String(start.verification_url || 'https://trakt.tv/activate').replace(/^https?:\/\//, '');
      changed();
      var interval = Math.max(5, start.interval || 5) * 1000, until = Date.now() + (start.expires_in || 600) * 1000;
      (function poll() {
        if (Date.now() > until) { busy = false; signIn(); return; }   // expired: a new code
        setTimeout(function () {
          send('POST', '/oauth/device/token', {code: start.device_code, client_id: ID, code_verifier: verifier}, '', function (s, t) {
            if (s === 200 && t) {
              keep(t);
              state.code = '';
              get('/users/settings', function (err, me) {
                var v = load();
                v.user = me && me.user ? me.user.username : '';
                save(v);
                busy = false;
                changed();
              });
              return;
            }
            if (s === 429) interval += 1000;
            if (s === 418) { busy = false; state.code = ''; state.message = tr('Sign-in declined on Trakt.'); changed(); return; }
            if (s === 410) until = 0;
            poll();   // 400: not typed yet
          });
        }, interval);
      })();
    });
  }

  function signedIn() { return !!load().refresh; }

  /** A valid access token, renewed when it's about to expire; done(error, token). */
  function token(done) {
    var v = load();
    if (!v.refresh) { done(new Error('not signed in')); return; }
    if (Date.now() < v.expires - 3600000) { done(null, v.access); return; }
    send('POST', '/oauth/token', {refresh_token: v.refresh, client_id: ID, redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        grant_type: 'refresh_token'}, '', function (s, t) {
      if (s === 400 || s === 401) { save({}); changed(); done(new Error('Trakt signed this TV out')); return; }
      if (s !== 200 || !t) { done(new Error('Trakt returned HTTP ' + s)); return; }
      keep(t);
      done(null, t.access_token);
    });
  }

  function get(path, done) {
    token(function (err, access) {
      if (err) { done(err); return; }
      send('GET', path, null, access, function (s, json) { done(s === 200 ? null : new Error('HTTP ' + s), json); });
    });
  }

  /** {"movie": {"ids": {"tmdb": 603}}} or {"ids": …} → "movie:603" (Trakt's show is TMDB's tv); '' without one. */
  function key(item, type) {
    var o = item && item[type] ? item[type] : item, tmdb = o && o.ids ? o.ids.tmdb : 0;
    return tmdb > 0 ? (type === 'show' ? 'tv' : 'movie') + ':' + tmdb : '';
  }

  /** In steps, one request at a time: each part failing on its own leaves the rest. */
  function lists(done) {
    // genres: Trakt's genre slugs of each title (extended=full), so a genre filter needs no TMDB details first.
    var out = {progress: [], watched: {}, watchlist: [], recommended: [], trending: [], genres: {}}, shows = [], at = {};
    function full(path) { return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'extended=full'; }
    function genresOf(item, type, k) { var o = item && item[type] ? item[type] : item; if (o && o.genres) out.genres[k] = o.genres; }
    function has(k) { for (var i = 0; i < out.progress.length; i++) if (out.progress[i].key === k) return true; return false; }
    function watched(path, type, next) {
      get(path, function (err, a) {
        for (var i = 0; !err && a && i < a.length; i++) {
          var k = key(a[i], type);
          if (!k) continue;
          var w = a[i].last_watched_at || '', u = a[i].last_updated_at || '';
          out.watched[k] = true;
          at[k] = w > u ? w : u;
          if (type === 'show') shows.push({key: k, at: at[k], trakt: a[i].show.ids.trakt});
        }
        next();
      });
    }
    function playback(next) {
      get(full('/sync/playback?limit=20'), function (err, a) {
        a = (!err && a) ? a.slice() : [];
        a.sort(function (x, y) { return x.paused_at < y.paused_at ? 1 : x.paused_at > y.paused_at ? -1 : 0; });
        for (var i = 0; i < a.length; i++) {
          var movie = a[i].type === 'movie', k = key(a[i], movie ? 'movie' : 'show'), ep = movie ? null : a[i].episode;
          if (!k || has(k) || (at[k] && at[k] >= a[i].paused_at)) continue;   // watched since it was paused
          genresOf(a[i], movie ? 'movie' : 'show', k);
          out.progress.push({key: k, season: ep ? ep.season : 0, number: ep ? ep.number : 0, paused: true});
        }
        next();
      });
    }
    function upNext(next) {
      shows.sort(function (x, y) { return x.at < y.at ? 1 : x.at > y.at ? -1 : 0; });
      var todo = shows.filter(function (s) { return s.trakt > 0 && !has(s.key); }).slice(0, UP_NEXT_SHOWS), i = 0;
      (function one() {
        if (i >= todo.length) { next(); return; }
        var s = todo[i++];
        get('/shows/' + s.trakt + '/progress/watched?specials=false&count_specials=false', function (err, p) {
          var n = p && p.next_episode;
          if (!err && n && p.completed < p.aired) out.progress.push({key: s.key, season: n.season, number: n.number, paused: false});
          one();
        });
      })();
    }
    function listed(path, type, list, max, next) {
      get(full(path), function (err, a) {
        a = (!err && a) ? a.slice() : [];
        if (a.length && a[0].listed_at) a.sort(function (x, y) { return x.listed_at < y.listed_at ? 1 : x.listed_at > y.listed_at ? -1 : 0; });
        for (var i = 0; i < a.length && list.length < max; i++) {
          var k = key(a[i], type);
          if (k && list.indexOf(k) < 0) { list.push(k); genresOf(a[i], type, k); }
        }
        next();
      });
    }
    var mixed = {movies: [], shows: []}, picks = {movies: [], shows: []}, hot = {movies: [], shows: []};
    function both(a, b, list, max) { for (var i = 0; i < max; i++) { if (a[i]) list.push(a[i]); if (b[i]) list.push(b[i]); } }
    watched('/sync/watched/movies', 'movie', function () {
      watched('/sync/watched/shows?extended=noseasons', 'show', function () {
        playback(function () {
          upNext(function () {
            listed('/sync/watchlist/movies', 'movie', mixed.movies, WATCHLIST_MAX, function () {
              listed('/sync/watchlist/shows', 'show', mixed.shows, WATCHLIST_MAX, function () {
                listed('/recommendations/movies?ignore_collected=true&limit=' + Math.min(100, RECOMMENDED_MAX * 2), 'movie', picks.movies, RECOMMENDED_MAX, function () {
                  listed('/recommendations/shows?ignore_collected=true&limit=' + Math.min(100, RECOMMENDED_MAX * 2), 'show', picks.shows, RECOMMENDED_MAX, function () {
                    listed('/movies/trending?limit=' + TRENDING_MAX, 'movie', hot.movies, TRENDING_MAX, function () {
                      listed('/shows/trending?limit=' + TRENDING_MAX, 'show', hot.shows, TRENDING_MAX, function () {
                        both(mixed.movies, mixed.shows, out.watchlist, WATCHLIST_MAX);
                        both(picks.movies, picks.shows, out.recommended, RECOMMENDED_MAX);
                        both(hot.movies, hot.shows, out.trending, TRENDING_MAX);
                        done(null, out);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /** Trending on Trakt in these genres (Trakt's own filter), movies and shows interleaved: done(null, keys, genres). */
  function trending(slugs, done) {
    var g = '&genres=' + encodeURIComponent(slugs.join(',')), out = [], genres = {}, lists = {movie: [], show: []};
    function one(type, next) {
      get('/' + type + 's/trending?limit=' + TRENDING_MAX + g + '&extended=full', function (err, a) {
        for (var i = 0; !err && a && i < a.length; i++) {
          var k = key(a[i], type);
          if (!k) continue;
          lists[type].push(k);
          if (a[i][type] && a[i][type].genres) genres[k] = a[i][type].genres;
        }
        next();
      });
    }
    one('movie', function () {
      one('show', function () {
        for (var i = 0; i < TRENDING_MAX; i++) {
          if (lists.movie[i]) out.push(lists.movie[i]);
          if (lists.show[i]) out.push(lists.show[i]);
        }
        done(null, out, genres);
      });
    });
  }

  return {
    trending: trending,
    available: function () { return !!ID; },
    signedIn: signedIn,
    signIn: signIn,
    state: state,
    user: function () { return load().user || ''; },
    lists: lists,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
