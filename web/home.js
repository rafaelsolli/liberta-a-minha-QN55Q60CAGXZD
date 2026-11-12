/*
 * The home screen for web-app TVs (LG webOS, Samsung Tizen), with the Android app's design and behavior (HomeView):
 *  - top: the "For You" title and the tabs (Explore, Movies, Shows); icon-only glass buttons at the right (Live TV,
 *    HDMI Inputs, Settings) and the crypto quotes at the end of the tab row;
 *  - three picks for this hour in the selected tab; the background is the focused one's photo, blurred, almost white;
 *  - the glass shelf with the apps; ↓ opens the drawer (inputs, shortcuts, weather, prices); ↑ or Back closes it;
 *  - a night look from sunset to sunrise; a screensaver after a few idle minutes.
 * The remote's arrows, OK and Back move the focus; a pointer (LG's Magic Remote) focuses what it points at.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, parent, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  function sym(name, parent, size) {
    var s = el('span', 'sym', parent);
    s.style.webkitMaskImage = 'url(symbols/' + name + '.png)';
    s.style.maskImage = 'url(symbols/' + name + '.png)';
    if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
    return s;
  }

  function coin(i, parent) {
    var c = window.COINS && window.COINS[i];
    if (!c) return;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 32 32');
    // Old WebKit (Tizen 2) draws an SVG without them at 300×150; the CSS still sets the size everywhere it's shown.
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    for (var k = 0; k < c.length; k++) {
      var p = document.createElementNS(ns, 'path');
      p.setAttribute('d', c[k]);
      p.setAttribute('fill-rule', 'evenodd');
      svg.appendChild(p);
    }
    parent.appendChild(svg);
  }

  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function setClass(e, c, on) {
    if (!e) return;
    if (on && !hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, '');
    else if (!on && hasClass(e, c)) e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, '');
  }

  var stage = $('stage'), body = document.body;

  /**
   * The 1920 × 1080 stage fills the window (on the TV it already is 1920 × 1080). A TV's window only gets shorter for
   * the keyboard (Samsung's resizes it while the city or key field has focus): there the stage keeps its width and the
   * keyboard covers its bottom, as in other apps. Fitted to the short window, it shrank into the top left beside a white
   * band (#399).
   */
  function fit() {
    var s = TV.name !== 'browser' ? window.innerWidth / 1920 : Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.webkitTransform = stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
    // The browser preview: a window that isn't 16:9 shows the stage centered, with black bars, as a TV shows a film.
    if (TV.name === 'browser') {
      stage.style.left = Math.round((window.innerWidth - 1920 * s) / 2) + 'px';
      stage.style.top = Math.round((window.innerHeight - 1080 * s) / 2) + 'px';
      document.documentElement.style.background = body.style.background = '#000';
    }
  }

  // MARK: - Apps on the shelf

  /** Shelf apps in this order when installed, like the Android app: key, LG app id, name on the TV, brand gradient. */
  var SHELF = [
    ['netflix', /^netflix$/, /netflix/i, ['#0A0A0A', '#000000']],
    ['youtube', /youtube/, /^youtube$/i, ['#1C1C1E', '#09090A']],
    ['prime', /^amazon$/, /prime video|amazon/i, ['#2AA8FF', '#0A68D4']],
    ['disney', /disney/, /disney/i, ['#173584', '#08143F']],
    ['max', /hbo|wbd/, /^(hbo )?max$|hbo max/i, ['#5C30E8', '#221684']],
    ['appletv', /appletv|apple\.tv/, /apple tv/i, ['#1C1C1E', '#000000']],
    ['hulu', /^hulu/, /hulu/i, ['#1CE783', '#0B8F4E']],
    ['paramount', /paramount|cbs/, /paramount/i, ['#0064FF', '#002A86']],
    ['peacock', /peacock/, /peacock/i, ['#1C1C1E', '#000000']],
    ['nfl', /nfl/, /^nfl/i, ['#013369', '#00163D']],
    ['globoplay', /globoplay/, /globoplay/i, ['#FF8A1F', '#FF2D5A']],
    ['jellyfin', /jellyfin/i, /jellyfin/i, ['#AA5CC3', '#00A4DC']],
    ['spotify', /spotify/, /spotify/i, ['#1DB954', '#0F7A36']]
  ];
  // Apps shown at once, as on Android: 8 (today's smallest tiles, 178 wide); the shelf scrolls for the rest. The
  // built-in list keeps 8 too.
  var SHELF_VISIBLE = 11, FEW_APPS = 8;

  function shelfKey(app) {
    for (var i = 0; i < SHELF.length; i++) if (SHELF[i][1].test(app.id) || SHELF[i][2].test(app.title)) return SHELF[i];
    return null;
  }

  function darken(hex, f) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '#161618';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g * f) + ',' + Math.round(b * f) + ')';
  }

  /** A name that fits the tile on one line (the font shrinks for long names). */
  function wordFit(title, width, max) {
    return Math.max(18, Math.min(max, Math.floor(width * 0.8 / (Math.max(4, title.length) * 0.56))));
  }

  // MARK: - Logos

  // The TV's icons are small squares with their own background (white behind Netflix, black behind Max). Like the
  // Android app does with the TV art, the logo is lifted off it once: the background goes transparent and the rest is
  // cropped to the logo, which then fills the tile on the brand's color.
  var lifted = {};   // icon url -> {src, bg: [r, g, b], ink: luminance histogram} or false (keep the icon as it is)
  var LIFT_SIZE = 240;

  // sRGB (0-255) to linear light, computed once: lift() needs it for every pixel, and old TVs are slow at Math.pow.
  var LINEAR = [];
  for (var li = 0; li < 256; li++) LINEAR[li] = li <= 10 ? li / 255 / 12.92 : Math.pow((li / 255 + 0.055) / 1.055, 2.4);

  /** Relative luminance (0-1) of an sRGB color (whole numbers, as read from the canvas). */
  function luminance(r, g, b) {
    return 0.2126 * LINEAR[r] + 0.7152 * LINEAR[g] + 0.0722 * LINEAR[b];
  }

  function rgbOf(color) {
    var m = /^#?([0-9a-f]{6})$/i.exec(color || '');
    if (m) { var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color || '');
    return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  }

  /**
   * The background of an icon whose edges change smoothly instead of being one color (Disney+'s and SkyShowtime's
   * gradients, Vodafone TV's vignette, Movistar Plus+'s grey to black on a 2019 Q70R): the colors along its four edges,
   * a little inside, for a Coons patch between them (patch()). null when an edge is clear or jumps: a picture, not a
   * background.
   */
  function ramp(px, w, h, inset) {
    var N = 16, x0 = inset, x1 = w - 1 - inset, y0 = inset, y1 = h - 1 - inset;
    if (x1 - x0 < N || y1 - y0 < N) return null;
    var sum = [0, 0, 0];
    function side(xa, ya, xb, yb) {   // N + 1 colors from (xa, ya) to (xb, yb)
      var out = [], prev = null;
      for (var s = 0; s <= N; s++) {
        var i = (Math.round(ya + s / N * (yb - ya)) * w + Math.round(xa + s / N * (xb - xa))) * 4;
        if (px[i + 3] < 250) return null;
        var c = [px[i], px[i + 1], px[i + 2]];
        if (prev && Math.max(Math.abs(c[0] - prev[0]), Math.abs(c[1] - prev[1]), Math.abs(c[2] - prev[2])) > 48) return null;
        sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2];
        out.push(prev = c);
      }
      return out;
    }
    var top = side(x0, y0, x1, y0), bottom = side(x0, y1, x1, y1), left = side(x0, y0, x0, y1), right = side(x1, y0, x1, y1);
    if (!top || !bottom || !left || !right) return null;
    // Each column's top and bottom colors, each row's left and right ones, and where it sits between the edges (0-1).
    function spread(edge, n, a, b) {
      var out = [], at = [];
      for (var z = 0; z < n; z++) {
        var t = Math.max(0, Math.min(1, (z - a) / (b - a))), f = t * N, s = Math.min(N - 1, Math.floor(f)), r = f - s;
        for (var c = 0; c < 3; c++) out.push(edge[s][c] + (edge[s + 1][c] - edge[s][c]) * r);
        at.push(t);
      }
      return {rgb: out, at: at};
    }
    var cols = spread(top, w, x0, x1), colsB = spread(bottom, w, x0, x1), rows = spread(left, h, y0, y1);
    var corners = [];
    for (var c = 0; c < 3; c++) {
      corners.push((top[0][c] + left[0][c]) / 2, (top[N][c] + right[0][c]) / 2,
        (bottom[0][c] + left[N][c]) / 2, (bottom[N][c] + right[N][c]) / 2);
    }
    var n = 4 * (N + 1);
    return {t: cols.rgb, b: colsB.rgb, l: rows.rgb, r: spread(right, h, y0, y1).rgb, u: cols.at, v: rows.at,
      corners: corners, mean: [Math.round(sum[0] / n), Math.round(sum[1] / n), Math.round(sum[2] / n)]};
  }

  /** Channel c of ramp()'s background at (x, y): the edges blended in, less the corners counted twice. */
  function patch(g, x, y, c) {
    var u = g.u[x], v = g.v[y], k = c * 4;
    return (1 - v) * g.t[x * 3 + c] + v * g.b[x * 3 + c] + (1 - u) * g.l[y * 3 + c] + u * g.r[y * 3 + c] -
      ((1 - u) * (1 - v) * g.corners[k] + u * (1 - v) * g.corners[k + 1] + (1 - u) * v * g.corners[k + 2] +
        u * v * g.corners[k + 3]);
  }

  function lift(img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return false;
    var f = Math.min(1, LIFT_SIZE / Math.max(w, h));
    w = Math.max(1, Math.round(w * f));
    h = Math.max(1, Math.round(h * f));
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var g = canvas.getContext('2d');
    var data;
    try {
      g.drawImage(img, 0, 0, w, h);
      data = g.getImageData(0, 0, w, h);
    } catch (e) {
      return false;   // a TV that doesn't let the page read its icons
    }
    var px = data.data;
    // The background: the most common color a little inside the edges (rounded icons have transparent corners).
    var votes = {}, best = null, bestN = 0, inset = Math.round(Math.min(w, h) * 0.08);
    for (var s = 0; s < 64; s++) {
      var t = s % 16 / 16, side = s >> 4;
      var x = side < 2 ? Math.round(inset + t * (w - 2 * inset)) : side === 2 ? inset : w - 1 - inset;
      var y = side < 2 ? (side === 0 ? inset : h - 1 - inset) : Math.round(inset + t * (h - 2 * inset));
      var i = (y * w + x) * 4;
      var key = px[i + 3] < 128 ? 'clear' : (px[i] >> 4) + ',' + (px[i + 1] >> 4) + ',' + (px[i + 2] >> 4);
      votes[key] = (votes[key] || 0) + 1;
      if (votes[key] > bestN) { bestN = votes[key]; best = key === 'clear' ? null : [px[i], px[i + 1], px[i + 2]]; }
    }
    // Not one color all along the edge: a gradient or a vignette, taken away pixel by pixel when it's smooth. Against
    // its near-black end, a pixel a few levels darker isn't ink (Movistar Plus+'s last rows, HBO Max's vignette).
    var grad = bestN < 64 ? ramp(px, w, h, inset) : null, under = [0, 0, 0], dark = grad ? 64 : 1;
    if (grad) best = grad.mean;
    var minX = w, minY = h, maxX = -1, maxY = -1, ink = [0, 0, 0, 0, 0, 0, 0, 0], inkSum = 0;
    for (var p = 0; p < w * h; p++) {
      var j = p * 4, a = px[j + 3] / 255;
      if (best) {
        // color to alpha: how far each channel is from the background, as a share of how far it could go, so the
        // anti-aliased edges come out as the logo's color, partly clear, without a fringe of the background
        var k = 0, c;
        for (c = 0; c < 3; c++) {
          var v = px[j + c], o = under[c] = grad ? patch(grad, p % w, (p / w) | 0, c) : best[c];
          k = Math.max(k, v > o ? (v - o) / Math.max(1, 255 - o) : (o - v) / Math.max(dark, o));
        }
        k = Math.max(0, Math.min(1, (k - 0.1) / 0.9));   // compression noise stays clear
        // Outside the edges a gradient was read on, it keeps going (Disney+'s brightens in its last rows): background.
        if (grad && (p % w < inset || p % w >= w - inset || p < inset * w || p >= (h - inset) * w)) k = 0;
        if (k > 0 && k < 1) {
          for (c = 0; c < 3; c++) px[j + c] = Math.max(0, Math.min(255, under[c] + (px[j + c] - under[c]) / k));
        }
        a *= k;
      }
      px[j + 3] = Math.round(a * 255);
      if (a > 0.3) {
        var px0 = p % w, py0 = (p / w) | 0;
        if (px0 < minX) minX = px0;
        if (px0 > maxX) maxX = px0;
        if (py0 < minY) minY = py0;
        if (py0 > maxY) maxY = py0;
        ink[Math.min(7, Math.floor(Math.sqrt(luminance(px[j], px[j + 1], px[j + 2])) * 8))] += a;
        inkSum += a;
      }
    }
    // Nothing left, or nothing taken away (a picture rather than a logo on a background): keep the icon.
    if (maxX < 0 || (maxX - minX > w * 0.96 && maxY - minY > h * 0.96)) return false;
    var crop = document.createElement('canvas');
    crop.width = maxX - minX + 1;
    crop.height = maxY - minY + 1;
    g.putImageData(data, 0, 0);
    crop.getContext('2d').drawImage(canvas, minX, minY, crop.width, crop.height, 0, 0, crop.width, crop.height);
    for (var b = 0; b < 8; b++) ink[b] /= inkSum;
    try {
      return {src: crop.toDataURL('image/png'), bg: best, ink: ink};
    } catch (e2) {
      return false;
    }
  }

  /**
   * Share of the logo that hardly shows on a tile of this luminance (YouTube's black type on a dark tile). Each bin
   * of the histogram holds the ink whose square-root luminance falls in it.
   */
  function unseen(ink, tileLum) {
    var share = 0;
    for (var b = 0; b < 8; b++) {
      var l = Math.pow((b + 0.5) / 8, 2);
      if ((Math.max(l, tileLum) + 0.05) / (Math.min(l, tileLum) + 0.05) < 1.8) share += ink[b];
    }
    return share;
  }

  function paint(box, top, bottom) {
    box.style.background = '-webkit-linear-gradient(top, ' + top + ', ' + bottom + ')';
    box.style.background = 'linear-gradient(' + top + ', ' + bottom + ')';
  }

  /** A color that is clearly a hue (Crunchyroll's orange), not black, white or a gray. */
  function colorful(rgb) {
    return Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2]) >= 96;
  }

  /**
   * The logo's box in its own proportions, as large as object-fit: contain draws it. Chrome 38 (webOS 3) ignores
   * object-fit while a tile next to it animates, and the logo stretched to its 70% x 50% box until the move ended.
   * Not laid out yet (a closed sheet): object-fit stays, and fitLogos() runs when the sheet opens.
   */
  function fitLogo(img) {
    var box = img.parentNode, bw = img.offsetWidth, bh = img.offsetHeight, nw = img.naturalWidth, nh = img.naturalHeight;
    if (!box || !bw || !bh || !nw || !nh || img.style.width) return;
    var s = Math.min(bw / nw, bh / nh);
    img.style.width = nw * s / box.offsetWidth * 100 + '%';
    img.style.height = nh * s / box.offsetHeight * 100 + '%';
  }

  function fitLogos(root) {
    var imgs = root.querySelectorAll('img.logo');
    for (var i = 0; i < imgs.length; i++) if (imgs[i].complete) fitLogo(imgs[i]);
  }

  /** own: the tile has the TV's color for the app, not one of SHELF's. */
  function showLogo(img, box, top, bottom, logo, own) {
    img.className = 'logo';
    img.onload = function () { img.onload = null; fitLogo(img); };
    img.src = logo.src;
    if (img.complete) fitLogo(img);
    var a = rgbOf(top), z = rgbOf(bottom);
    var tileLum = (luminance(a[0], a[1], a[2]) + luminance(z[0], z[1], z[2])) / 2;
    // The tile takes the icon's background when the logo only reads on it, and when that background is the brand's
    // color: LG's bgColor isn't always the icon's (Crunchyroll's is black, on an orange icon).
    if (logo.bg && ((own && colorful(logo.bg)) || unseen(logo.ink, tileLum) > 0.35)) {
      var bg = 'rgb(' + logo.bg.join(',') + ')';
      var hex = '#' + ((1 << 24) | (logo.bg[0] << 16) | (logo.bg[1] << 8) | logo.bg[2]).toString(16).slice(1);
      paint(box, bg, darken(hex, 0.93));
    }
  }

  /** An app's face: its logo on its brand color (or its name, when the icon can't be read). */
  function face(app, box, wordSize) {
    var k = shelfKey(app);
    var top = k ? k[3][0] : app.color ? darken(app.color, 0.92) : '#2A2A2E';
    var bottom = k ? k[3][1] : app.color ? darken(app.color, 0.62) : '#161618';
    paint(box, top, bottom);
    var word = el('div', 'word', box, app.title);
    if (wordSize) word.style.fontSize = wordSize + 'px';
    if (app.icon) {
      var img = el('img', '', box), url = app.icon;
      word.style.visibility = 'hidden';
      img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); word.style.visibility = ''; };
      if (lifted[url]) { showLogo(img, box, top, bottom, lifted[url], !k); return; }
      if (lifted[url] !== false) {
        img.onload = function () {
          img.onload = null;
          if (lifted[url] === undefined) lifted[url] = lift(img);
          if (lifted[url]) showLogo(img, box, top, bottom, lifted[url], !k);
        };
      }
      img.src = url;
    }
  }

  /** A shelf tile's face: the app's glyph in the theme's color (its brand's when focused), else its name. */
  function glyphFace(app, box, size, initial) {
    if (app.symbol) { sym(app.symbol, box).className = 'sym glyph plain symbol'; return; }
    if (!app.glyph && app.icon) { liftedGlyph(app, box, size, initial); return; }
    if (!app.glyph) {
      wordFace(app, box, size, initial);
      return;
    }
    var layers = app.tint ? ['glyph plain tinted', 'glyph tint'] : ['glyph plain'];
    for (var i = 0; i < layers.length; i++) {
      var g = el('div', layers[i], box);
      g.style.webkitMaskImage = g.style.maskImage = 'url(' + app.glyph + ')';
      if (i) g.style.backgroundColor = app.tint;
    }
  }

  /**
   * An app with no glyph of ours: the logo lifted off the TV's icon (lift: its background taken away) as the mask, so
   * it takes the theme's color like the rest; its name until then, and where the icon can't be read or isn't a logo.
   */
  /** The name in the tile, or (initial: All Apps, where the name is under it) only its first letter, large. */
  function wordFace(app, box, size, initial) {
    var word = el('div', 'word' + (initial ? ' initial' : ''), box, initial ? String(app.title).charAt(0).toUpperCase() : app.title);
    if (!initial) word.style.fontSize = wordFit(app.title, size, 24) + 'px';
    return word;
  }

  function liftedGlyph(app, box, size, initial) {
    var word = wordFace(app, box, size, initial), url = app.icon;
    function show(logo) {
      if (!logo) return;
      word.style.display = 'none';
      var g = el('div', 'glyph plain', box);
      g.style.webkitMaskImage = g.style.maskImage = 'url(' + logo.src + ')';
    }
    if (lifted[url] !== undefined) { show(lifted[url]); return; }
    var img = new Image();
    img.onload = function () {
      if (lifted[url] === undefined) lifted[url] = lift(img);
      show(lifted[url]);
    };
    img.src = url;
  }

  var apps = [], shelf = [], others = [], inputs = [];

  /** shelf_apps in config.properties: the shelf in that order, by id or name (part of it). */
  var WANTED = (CONFIG.shelfApps || []).map(function (s) { return s.toLowerCase(); });

  function pickShelf() {
    // One shelf holds everything: the apps, Live TV and the inputs (the named ones always, the others when something is
    // plugged in), alphabetically, running on to the right from the picks' left edge; with shelf_order=recent, what was
    // opened last from here comes first. shelf_apps and the shelf editor don't order it.
    var out = apps.concat(inputItems()).sort(function (a, b) {
      var x = a.title.toLowerCase(), y = b.title.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
    if (CONFIG.shelfOrder === 'recent') {
      var used = recentUse(), given = out.slice();
      out.sort(function (a, b) { return (used[b.id] || 0) - (used[a.id] || 0) || given.indexOf(a) - given.indexOf(b); });
    }
    others = [];
    shelf = out;
  }

  /** Live TV and the inputs as shelf items: a symbol (a TV, an HDMI plug), or the brand's glyph for a named input. */
  function inputItems() {
    var out = [], named = CONFIG.inputNames || {}, live = Prefs.liveInput() && liveTV();
    if (live) out.push({id: live.id, title: tr('Live TV'), symbol: 'tv', input: true});
    for (var i = 0; i < inputs.length; i++) {
      var x = inputs[i], name = named[x.key];
      if (x.key === 'live' || !(name || x.connected)) continue;
      var glyph = name ? TV.glyphNamed(name) : '';
      out.push(glyph ? {id: x.id, title: name, glyph: glyph, tint: TV.tintNamed(name), input: true}
                     : {id: x.id, title: name || x.label, symbol: x.symbol, input: true});
    }
    return out;
  }

  /** When each app was last opened from here, {id: ms}: kept apart from the settings, so settings_on_tv=false leaves it. */
  function recentUse() {
    try { return JSON.parse(localStorage.getItem('fmtv.recent')) || {}; } catch (e) { return {}; }
  }

  function noteUse(id) {
    var used = recentUse();
    used[id] = Date.now();
    try { localStorage.setItem('fmtv.recent', JSON.stringify(used)); } catch (e) {}
  }

  // MARK: - Focus

  var Z = {TOP: 'top', CARDS: 'cards', SHELF: 'shelf', DRAWER: 'drawer', APPS: 'apps', SETTINGS: 'settings', EDIT: 'edit', LANG: 'lang', CITY: 'city', KEY: 'key', ABOUT: 'about', SEARCH: 'search', SUB: 'sub', GENRE: 'genre', ACT: 'act', SPIDER: 'spider', DETAIL: 'detail'};
  var st = {zone: Z.SHELF, top: 0, tab: 0, card: 0, shelf: 0, drawer: 0, grid: 0, row: 0, edit: 0, lang: 0, city: 0, key: 0, sub: 0, genre: 0, act: 0};
  var cards = [];

  function sheetOpen() { return st.zone === Z.DETAIL || st.zone === Z.APPS || st.zone === Z.SETTINGS || st.zone === Z.EDIT || st.zone === Z.LANG || st.zone === Z.CITY || st.zone === Z.KEY || st.zone === Z.ABOUT; }

  function updateFocus() {
    var i, list;
    list = $('tabs').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === st.tab && !searchMode);
      setClass(list[i], 'focus', st.zone === Z.TOP && st.top === i);
    }
    list = $('buttons').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.TOP && st.top === tabsN() + i);
    setClass($('quotes'), 'hide', st.zone === Z.TOP && st.top >= tabsN());
    setClass($('searchbar'), 'focus', st.zone === Z.SEARCH);
    setClass(body, 'searchfocus', st.zone === Z.SEARCH && searchOpen);   // the magnifier dark on the white field
    list = $('subtabs') ? $('subtabs').children : [];
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === (st.sub || 0) && !searchMode);
      setClass(list[i], 'focus', st.zone === Z.SUB && st.sub === i);
    }
    list = $('genres') ? $('genres').children : [];
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'on', i === (st.genre || 0) && !searchMode);
      setClass(list[i], 'focus', st.zone === Z.GENRE && st.genre === i);
    }
    layoutCards();
    list = $('cards').children;
    for (i = 0; i < list.length; i++) {
      setClass(list[i], 'focus', st.zone === Z.CARDS && st.card === i);
      setClass(list[i], 'acting', st.zone === Z.ACT && st.card === i);   // its buttons focused: its name and line stay
    }
    if (st.zone === Z.CARDS && cards[st.card] && cards[st.card].more) startMore();   // reaching the arrow loads more
    renderActions();
    if (st.zone === Z.SPIDER && !spiderShown()) st.zone = cards.length ? Z.CARDS : Z.SHELF;
    setClass($('empty'), 'focus', st.zone === Z.SPIDER);
    // The search field shrinks back into the magnifier when the focus leaves it (its results stay).
    if (searchOpen && st.zone !== Z.SEARCH) {
      searchOpen = false;
      closeField('searchbar');
      // It closes as it was, white and solid (and the magnifier dark on it) until it's gone: retracts, then shrinks.
      var bar = $('searchbar');
      setClass(bar, 'closing', true);
      setClass(body, 'searchclosing', true);
      clearTimeout(searchCloseTimer);
      searchCloseTimer = setTimeout(function () { setClass(bar, 'closing', false); setClass(body, 'searchclosing', false); }, 560);
      renderSearchBar();
    }
    list = $('tiles').children;
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.SHELF && st.shelf === i);
    revealShelf();
    list = document.querySelectorAll('#drawer .dcell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.DRAWER && st.drawer === i);
    scrollDrawer();
    list = document.querySelectorAll('#apps .cell');
    for (i = 0; i < list.length; i++) setClass(list[i], 'focus', st.zone === Z.APPS && st.grid === i);
    var rows = Math.max(1, Math.ceil(apps.length / APP_COLS)), r = Math.floor(st.grid / APP_COLS), first = Math.max(0, Math.min(rows - 3, r - 1));
    $('apps').lastChild.style.webkitTransform = $('apps').lastChild.style.transform = 'translateY(' + (-first * APP_ROW) + 'px)';
    focusRows($('settings'), st.row, st.zone === Z.SETTINGS);
    focusRows($('shelfedit'), st.edit, st.zone === Z.EDIT);
    focusRows($('langpick'), st.lang, st.zone === Z.LANG);
    if (langHint) langHint.textContent = (st.lang + 1) + ' / ' + languageChoices().length + '  ·  ' + tr('OK picks, Back cancels.');
    focusRows($('citypick'), st.city, st.zone === Z.CITY);
    focusRows($('keypick'), st.key, st.zone === Z.KEY);
    setClass(body, 'drawer-open', st.zone === Z.DRAWER);
    followSoon();
  }

  function focusRows(sheet, index, on) {
    var rows = sheet.querySelectorAll('.row');
    for (var i = 0; i < rows.length; i++) setClass(rows[i], 'focus', on && i === index);
    var holder = sheet.querySelector('.rows');
    if (!holder) return;
    var visible = 7, first = Math.max(0, Math.min(rows.length - visible, index - 3));
    holder.style.webkitTransform = holder.style.transform = 'translateY(' + (-first * 78) + 'px)';
  }

  function nearest(nodes, x) {
    var best = 0, bestD = 1e9;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(), d = Math.abs((r.left + r.right) / 2 - x);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function centerX(node) {
    if (!node) return 960;
    var r = node.getBoundingClientRect();
    return (r.left + r.right) / 2;
  }

  // MARK: - Top: title, tabs, buttons, quotes

  var TAB_KIND = [null, 'movie', 'tv'];

  /** How many tabs: 4 with Trakt (Explore, For You, Continue Watching, Watchlist), else 3. The round buttons follow. */
  // With Trakt: the favorites (a house, no name), Trakt's five, then the deleted (a bin). Data's tab for each.
  var TRAKT_TABS = ['fav', 0, 1, 2, 3, 4, 'trash'];
  function tabsN() { return Trakt.signedIn() ? TRAKT_TABS.length : 3; }
  function dataTab() { return Trakt.signedIn() ? TRAKT_TABS[st.tab] : st.tab; }
  /** Where every entry lands: Explore (Trakt's, or the first tab without it). */
  function startTab() { return Trakt.signedIn() ? 1 : 0; }

  // With Trakt, each tab has sub-tabs under it: All, Movies, Shows (st.sub). Without, the tabs are the kinds already.
  var SUB_KIND = [null, 'movie', 'tv'];
  function hasSubs() { return Trakt.signedIn() && Data.hasKey(); }

  function renderTop() {
    $('title').textContent = tr('For You');
    var tabs = $('tabs');
    tabs.innerHTML = '';
    renderSubs();
    // Signed in to Trakt: the account's tabs (Data.tabPicks) in place of the kinds.
    var names = Trakt.signedIn() ? ['icon:home', tr('Explore'), tr('tab|Discover'), tr('tab|Continue'), tr('tab|Watchlist'), tr('tab|Rewatch'), 'icon:trash']
        : [tr('Explore'), tr('Movies'), tr('Shows')];
    for (var i = 0; i < names.length; i++) {
      var icon = names[i].indexOf('icon:') === 0, t = el('button', 'tab' + (icon ? ' icon' : ''), tabs, icon ? '' : names[i]);
      if (icon) { var mk = el('span', 'mark', t); mk.style.webkitMaskImage = mk.style.maskImage = 'url(icons/glyph-' + names[i].slice(5) + '.svg)'; }
      hover(t, Z.TOP, i);
    }
    var buttons = $('buttons');
    buttons.innerHTML = '';
    // Live TV and the inputs are on the shelf (inputItems): only the gear can be here (Home Settings, whose last row
    // opens TV Settings), and only without settings_on_tv=false, where config.properties holds them all.
    topItems = [['apps', tr('Search'), openSearch, 'icons/glyph-search.svg', 'bare']];   // no disc; focus opens it
    if (CONFIG.settingsOnTv !== false) topItems.push(['settings', tr('light|Settings'), openSettings]);
    for (var b = 0; b < topItems.length; b++) {
      var r = el('button', 'round' + (b === topItems.length - 1 ? ' last' : '') + (topItems[b][4] ? ' ' + topItems[b][4] : ''), buttons);
      r.style.left = (1772 - 88 * (topItems.length - 1 - b)) + 'px';
      var mark = sym(topItems[b][0], r);
      if (topItems[b][3]) mark.style.webkitMaskImage = mark.style.maskImage = 'url(' + topItems[b][3] + ')';
      el('div', 'tip', r, topItems[b][1]);
      hover(r, Z.TOP, tabsN() + b);
    }
    if (st.top > tabsN() - 1 + topItems.length) st.top = tabsN() - 1 + topItems.length;
    alignRows();
    // Trakt not signed in yet: the code to type at trakt.tv/activate, at the top right (Trakt.signIn makes it).
    var tk = Trakt.state, hint = tk.code ? 'Trakt · ' + trf('{url}, code {code}', {url: tk.url, code: tk.code}) : tk.message;
    if (hint && !Trakt.signedIn() && !searchOpen) el('div', 'trakthint', buttons, hint);
    renderSearchBar();
  }

  var topItems = [];

  // MARK: - Search: the magnifier opens a field at the top right (the TV's keyboard comes up); OK or Done searches
  // TMDB (Data.search), and the results take the picks' row, with the same marks and the same ways to open. Back,
  // or picking a tab, goes back to the tabs' picks.

  var searchCloseTimer = 0, searchOpen = false, searchMode = false, searchResults = [], searchText = '', searchStatus = '', searchSeq = 0;

  /**
   * Made once, beside the buttons (renderTop rebuilds those): opening it is an animation, a disc growing out of the
   * magnifier that then stretches left into the field (CSS: only transforms and opacity, as everywhere here).
   */
  function renderSearchBar() {
    var bar = $('searchbar');
    if (!bar) {
      bar = el('div', 'searchbar', $('buttons').parentNode);
      bar.id = 'searchbar';
      var fill = el('div', 'fill', bar), field = el('input', '', fill);
      field.type = 'text';
      field.setAttribute('aria-label', tr('Search'));
      field.setAttribute('autocomplete', 'off');
      field.setAttribute('spellcheck', 'false');
      field.oninput = function () { searchText = field.value; };
      hover(bar, Z.SEARCH, 0);
    }
    var input = bar.querySelector('input');
    if (input.value !== searchText) input.value = searchText;
    input.placeholder = searchStatus || tr('Search');
    setClass(bar, 'open', searchOpen);
    setClass(body, 'searching', searchOpen);
  }

  function openSearch() {
    clearTimeout(searchCloseTimer);
    setClass($('searchbar'), 'closing', false);
    setClass(body, 'searchclosing', false);
    searchOpen = true;
    renderTop();
    st.zone = Z.SEARCH;
    updateFocus();
    // The keyboard once the field has grown out of the magnifier (renderSearchBar's animation takes 0.48 s).
    setTimeout(function () { if (searchOpen && st.zone === Z.SEARCH) openField('searchbar'); }, 480);
  }

  function closeSearch() {
    closeField('searchbar');
    var was = searchMode;
    searchOpen = false;
    searchMode = false;
    searchStatus = '';
    searchSeq++;
    renderTop();
    st.zone = Z.TOP;
    st.top = tabsN();   // back on the magnifier
    if (was) { cards = []; renderCards(); }
    updateFocus();
  }

  function runSearch() {
    var q = searchText.trim();
    closeField('searchbar');
    if (!q) { openField('searchbar'); return; }
    var seq = ++searchSeq;
    searchMode = true;
    searchResults = [];
    searchStatus = tr('Searching…');
    renderTop();
    cards = [];
    renderCards();
    Data.search(q, function (err, list, finished) {
      if (seq !== searchSeq) return;   // a newer search, or closed
      searchResults = list;
      searchStatus = err ? trf("Couldn't search now: {error}", {error: err.message}) : finished && !list.length ? tr('Nothing') : '';
      if (finished || err) renderTop();
      renderCards();
      if (list.length && st.zone === Z.SEARCH) { st.zone = Z.CARDS; st.card = 0; }
      updateFocus();
    });
  }

  function renderQuotes() {
    var q = $('quotes'), coins = Data.activeCoins();
    q.innerHTML = '';
    for (var i = 0; i < coins.length; i++) {
      var item = el('span', 'q', q);
      coin(coins[i], item);
      el('span', '', item, Data.compact(Data.prices[coins[i]]));
    }
  }

  // MARK: - Picks and background

  function renderCards() {
    var list = searchMode ? searchResults : Data.tabPicks(dataTab(), Trakt.signedIn() ? SUB_KIND[st.sub || 0] : TAB_KIND[st.tab], st.genre || 0);
    // More of the tab on Trakt than it shows: an arrow ends the row, and OK on it brings 20 more (Data.more).
    if (!searchMode && Data.hasMore(dataTab())) list = list.concat([{id: 'more', kind: '', title: '', backdrop: '', meta: '', more: true}]);
    var holder = $('cards');
    setClass(body, 'no-picks', !list.length);
    renderEmpty(!list.length && !searchMode);
    setClass(body, 'no-key', !Data.hasKey());   // as on Android: no title or tabs that could never show anything
    if (!Data.hasKey() && st.zone === Z.TOP && st.top < tabsN()) st.top = tabsN();
    var same = list.length === cards.length;
    for (var i = 0; same && i < list.length; i++) same = list[i].id === cards[i].id && list[i].backdrop === cards[i].backdrop && list[i].meta === cards[i].meta;
    if (same && holder.children.length === list.length) return;
    cards = list;
    loadingMore = false;
    holder.innerHTML = '';
    for (var c = 0; c < list.length; c++) {
      var p = list[c], card = el('div', 'card' + (p.more ? ' loadmore' : ''), holder);
      // The row's end on Trakt: the shelf's small arrow; reaching it loads 20 more (startMore), dots meanwhile.
      if (p.more) {
        sym('chevron_right', card);
        var dots = el('div', 'dots', card);   // while more come: three dots, each hopping in turn
        for (var d = 0; d < 3; d++) el('span', '', dots);
        hover(card, Z.CARDS, c);
        continue;
      }
      var img = el('div', 'img', card);
      // Narrow: the poster (the backdrop cropped without one); the wide card fades its backdrop in over it, loaded then.
      var poster = el('div', 'layer', img);
      var art = Data.poster(p, 'w342');
      poster.style.backgroundImage = 'url(' + (art || Data.image(p.backdrop, 'w780')) + ')';
      // RPDB's ratings are a strip along the poster's bottom: the card keeps that edge where it crops.
      if (CONFIG.rpdbKey && p.imdb) poster.style.backgroundPosition = '50% 100%';
      el('div', 'layer back', img);
      badge(p, img);
      airBadge(p, img);
      // How far in on Trakt: a thin bar over RPDB's ratings strip; watched ones faded (not in Rewatch, all watched there).
      var far = Trakt.signedIn() ? Data.progressOf(p) : 0;
      if (far > 0) {
        var bar = el('div', 'prog' + (CONFIG.rpdbKey && p.imdb ? ' over-rpdb' : ''), img);
        el('div', 'fill', bar).style.width = Math.max(4, Math.round(far * 100)) + '%';
      }
      if (Trakt.signedIn() && dataTab() !== 4 && Data.watched(p)) setClass(card, 'seen', true);
      el('div', 'name', card, p.title);
      if (p.meta) el('div', 'meta', card, p.meta);
      hover(card, Z.CARDS, c);
    }
    st.card = Math.min(st.card, Math.max(0, list.length - 1));
    if (!list.length && st.zone === Z.CARDS) st.zone = Z.SHELF;
    if (list.length && !list[st.card].more) backdrop(Data.image(list[st.card].backdrop, 'w300'));
    else if (!list.length) backdrop('');
    updateFocus();
  }

  /**
   * The card with focus (st.card, also while focus is elsewhere) is the wide one, the others narrow; past the third the
   * row scrolls a card at a time (the holder slides), and the cards at the edges lose their text. Only the holder's
   * transform and the backdrop's opacity animate: the widths change at once (older TVs).
   */
  function layoutCards() {
    // Posters only, as many as a tab has: the row slides to keep the focused one among the first four on screen.
    // At the row's end it stops where the last poster meets the right edge, not leaving a gap after it.
    var holder = $('cards'), nodes = holder.children, left = 80, step = POSTER_W + 32;
    var arrow = cards.length && cards[cards.length - 1].more ? POSTER_W - ARROW_W : 0;
    var end = Math.max(0, nodes.length * step - arrow - 32 - 1760), scroll = Math.min(end, Math.max(0, st.card - 3) * step);
    for (var i = 0; i < nodes.length; i++) {
      var wide = false, w = cards[i] && cards[i].more ? ARROW_W : POSTER_W, n = nodes[i], at = left - scroll;
      n.style.left = left + 'px';
      n.style.width = w + 'px';
      setClass(n, 'wide', wide);
      setClass(n, 'edge', at < 0 || at > 1740);
      if (wide && !n.getAttribute('data-back') && cards[i]) {
        n.setAttribute('data-back', '1');
        n.querySelector('.back').style.backgroundImage = 'url(' + Data.image(cards[i].backdrop, 'w1280') + ')';
      }
      left += w + 32;
    }
    holder.style.webkitTransform = holder.style.transform = 'translateX(' + (-scroll) + 'px)';
  }

  // MARK: - An empty row: three hopping dots while the picks may still come, then the itsy bitsy spider and a line
  // picked at random (a new one each time the row turns empty), where the posters would be.

  var emptyWas = false, emptyLine = 0;

  function emptyLines() {
    return [tr('empty|Nothing here… just the itsy bitsy spider.'), tr('empty|So empty the itsy bitsy spider moved in.'),
      tr('empty|Nothing to watch… but the itsy bitsy spider still wants popcorn.'), tr('empty|Did you come here just to watch the itsy bitsy spider?'),
      tr('empty|Empty… even the itsy bitsy spider is bored.')];
  }

  var SPIDER = '<svg width="120" height="120" viewBox="0 0 120 120"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">' +
    '<path d="M52 64 Q36 48 24 28"/><path d="M50 70 Q30 62 12 56"/><path d="M50 76 Q30 82 14 94"/><path d="M53 82 Q40 96 32 112"/>' +
    '<path d="M68 64 Q84 48 96 28"/><path d="M70 70 Q90 62 108 56"/><path d="M70 76 Q90 82 106 94"/><path d="M67 82 Q80 96 88 112"/></g>' +
    '<ellipse cx="60" cy="76" rx="15" ry="18" fill="currentColor"/><circle cx="60" cy="53" r="10" fill="currentColor"/>' +
    '<circle class="eye" cx="56" cy="51" r="2.6"/><circle class="eye" cx="64" cy="51" r="2.6"/></svg>';

  function spiderShown() { var e = $('empty'); return !!e && /\bon\b/.test(e.className) && !/\bbusy\b/.test(e.className); }

  /**
   * The easter egg: the spider on a spring. Holding OK pulls it down its thread, slower as it nears the limit (the band
   * resists); letting go, it springs back and bounces, a damped spring, harder the further it was pulled. A tap gives a
   * small tug. Run frame by frame on the transform (as everything here animates); at rest, it swings again (CSS).
   */
  var SPRING_MAX = 84, SPRING_K = 95, SPRING_C = 3.6;
  var spring = {y: 0, v: 0, holding: false, running: false, last: 0, timer: 0};
  var nextFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };

  function springFrame(t) {
    var hang = document.querySelector('#empty .hang');
    if (!hang || !spring.running) { spring.running = false; return; }
    var dt = Math.min(0.05, Math.max(0, (t - spring.last) / 1000));
    spring.last = t;
    if (spring.holding) {
      spring.y += (SPRING_MAX - spring.y) * Math.min(1, dt * 1.6);   // harder to pull the further it goes
      spring.v = 0;
    } else {
      spring.v += (-SPRING_K * spring.y - SPRING_C * spring.v) * dt;
      spring.y += spring.v * dt;
    }
    var r = -3 + Math.max(-5, Math.min(5, spring.v * 0.012));   // a little twist as it flies; -3° is where the swing starts
    hang.style.webkitTransform = hang.style.transform = 'translateY(' + spring.y.toFixed(1) + 'px) rotate(' + r.toFixed(2) + 'deg)';
    if (!spring.holding && Math.abs(spring.y) < 0.4 && Math.abs(spring.v) < 4) {
      spring.running = false;
      hang.style.webkitTransform = hang.style.transform = '';
      setClass(hang, 'physics', false);   // at rest: the swing again
      return;
    }
    nextFrame(springFrame);
  }

  /** OK down on the spider (again and again while held: the TV repeats the key). */
  function springHold() {
    var hang = document.querySelector('#empty .hang');
    if (!hang) return;
    clearTimeout(spring.timer);
    spring.timer = setTimeout(springRelease, 700);   // a TV that sends no keyup: let go once the repeats stop
    if (spring.holding) return;
    spring.holding = true;
    spring.y = Math.max(spring.y, 16);   // even a tap tugs it a little
    if (!spring.running) {
      spring.running = true;
      setClass(hang, 'physics', true);
      spring.last = (window.performance && performance.now) ? performance.now() : Date.now();
      nextFrame(springFrame);
    }
  }

  function springRelease() {
    clearTimeout(spring.timer);
    spring.holding = false;
  }

  /** One piece swinging from a point above its clip: the thread (its top hidden) tied to the spider's head. */
  function hangSpider(clip) {
    var hang = el('div', 'hang', clip);
    el('div', 'thread', hang);
    el('div', 'spider', hang).innerHTML = SPIDER;
    return hang;
  }

  function renderEmpty(empty) {
    var e = $('empty');
    if (!e) {
      e = el('div', '', $('cards').parentNode);
      e.id = 'empty';
      hangSpider(el('div', 'clip', e));
      el('div', 'line', e);
      var dots = el('div', 'dots', e);
      for (var d = 0; d < 3; d++) el('span', '', dots);
    }
    var busy = empty && Data.busy();
    if (empty && !busy && !emptyWas) emptyLine = Math.floor(Math.random() * 5);   // a new line each time it turns empty
    emptyWas = empty && !busy;
    e.querySelector('.line').textContent = emptyLines()[emptyLine];
    setClass(e, 'on', empty);
    setClass(e, 'busy', busy);
  }

  var POSTER_W = 306, ARROW_W = 40, loadingMore = false;   // 2:3, as the posters, 460 high

  /** At the row's last card, the arrow: 20 more of the tab (Data.more), the arrow hopping dots until they come. */
  // MARK: - Favorite and delete: two buttons under the focused poster, left of its name and line (↓ from the poster
  // goes through them before the shelf). In a Trakt tab: Favorite (Unfavorite once it is) and Delete; in the favorites:
  // Unfavorite and Delete; in the bin: Favorite and Restore.

  /** Nothing under the posters any more: a title's buttons are on its page (detailActs). */
  function actionsFor() { return []; }

  /**
   * The page's buttons, at its top right before Back and the X: Play, then what changes its Trakt state (watched, stop
   * watching in Continue, the watchlist's + or -), then what's kept here (favorite or not, delete or restore). A pair
   * shows one of its two, by the title's state; the tab it was opened from (none for a related title) adds Continue's.
   */
  function detailActs(p) {
    var t = detailStack.length > 1 || searchMode ? null : dataTab(), out = [];
    if (!p) return out;
    if (pickTarget(p)) out.push(['play', 'play', tr('action|Watch')]);
    if (Trakt.signedIn()) {
      if (t !== 4 && !Data.watched(p)) out.push(['watched', 'check', tr('action|Mark watched')]);
      if (t === 2) out.push(['drop', 'block', tr('action|Stop watching')]);
      if (Data.inWatchlist(p)) out.push(['unlist', 'remove', tr('action|Remove from watchlist')]);
      else if (t !== 2) out.push(['list', 'add', tr('details|Want to watch')]);
    }
    out.push(Data.isFav(p) ? ['unfav', 'unheart', tr('action|Unfavorite')] : ['fav', 'heart', tr('action|Favorite')]);
    out.push(Data.isTrashed(p) ? ['restore', 'restore', tr('action|Restore')] : ['trash', 'trash', tr('action|Delete')]);
    return out;
  }


  /**
   * Under the posters, at the screen's left edge (not the poster's): the focused title's name and line, and right of
   * them its buttons.
   */
  function renderActions() {
    var info = $('info');
    if (!info) {
      info = el('div', '', $('cards').parentNode);
      info.id = 'info';
      el('div', 'name', info);
      el('div', 'meta', info);
    }
    var old = $('actions');
    if (old) old.parentNode.removeChild(old);
    var p = cards[st.card], shown = (st.zone === Z.CARDS || st.zone === Z.ACT) && p && !p.more;
    setClass(info, 'on', !!shown);
    if (!shown) { if (st.zone === Z.ACT) st.zone = Z.CARDS; return; }
    var name = info.firstChild, meta = info.lastChild;
    name.textContent = p.title || '';
    meta.textContent = p.meta || '';
    var acts = actionsFor();
    if (!acts.length) { if (st.zone === Z.ACT) st.zone = Z.CARDS; return; }
    var box = el('div', '', info);
    box.id = 'actions';
    box.style.left = (Math.max(name.offsetWidth, meta.offsetWidth) + 36) + 'px';
    for (var i = 0; i < acts.length; i++) {
      var b = el('div', 'act' + (st.zone === Z.ACT && st.act === i ? ' focus' : ''), box), m = el('span', 'mark', b);
      m.style.webkitMaskImage = m.style.maskImage = 'url(icons/glyph-' + acts[i][1] + '.svg)';
      el('div', 'tip', b, acts[i][2]);
      hover(b, Z.ACT, i);
    }
  }

  // MARK: - A title's page, as a modal over the screen: its photo, name, year, genres, length and score, the overview,
  // the cast with their photos and who directed or created it. The X at the top right has the focus; it, or Back,
  // closes it, back on the button that opened it.

  // The page: its photo darkened behind; at the left its poster (RPDB's, with the scores), right of it the name, the line
  // and the overview across the rest of the width; under them who made it and the cast, and under those the related
  // titles in a row. The focus: row 0 the top right (Back once a page was opened from another, then the X, focused
  // first), row 1 the related posters.
  var detailSeq = 0, detailStack = [], df = {row: 0, i: 0}, detailRelated = [];

  function openDetails(p, push) {
    if (!push) detailStack = [];
    detailStack.push(p);
    df = {row: 0, i: 0};   // Play (else the first button)
    renderDetail();
    st.zone = Z.DETAIL;
    updateFocus();
  }

  function detailTop() {
    var out = detailActs(detailStack[detailStack.length - 1]);
    if (out.length) out[out.length - 1].gap = true;   // a space between the title's buttons and the page's own
    if (detailStack.length > 1) out.push(['back', 'back', tr('details|Back')]);
    out.push(['close', 'close', tr('details|Close')]);
    return out;
  }

  function renderDetail() {
    var p = detailStack[detailStack.length - 1], d = $('detail');
    if (!d) { d = el('div', 'layer', $('stage')); d.id = 'detail'; }
    d.innerHTML = '';
    var back = el('div', 'back', d);
    if (p.backdrop) back.style.backgroundImage = 'url(' + Data.image(p.backdrop, 'w1280') + ')';
    el('div', 'shade', d);
    renderDetailTop(d);
    var art = Data.poster(p, 'w500') || (p.poster ? Data.image(p.poster, 'w500') : '');
    var poster = el('div', 'd-poster', d);
    if (art) { poster.style.backgroundImage = 'url(' + art + ')'; if (CONFIG.rpdbKey) poster.style.backgroundPosition = '50% 100%'; }
    var box = el('div', 'box', d);
    // d- names: the settings' and All Apps' rules use title, row, head and face.
    el('div', 'd-title', box, p.title || '');
    var line = el('div', 'd-line', box, p.meta || '');
    var text = el('div', 'd-text', box, '');
    var people = el('div', 'd-people', d);
    var rel = el('div', 'd-rel', d);
    setClass(d, 'open', true);
    detailRelated = [];
    var seq = ++detailSeq;
    Data.fullDetails(p, function (info) {
      if (seq !== detailSeq || !info) return;
      var bits = [];
      if (info.year) bits.push(info.year);
      if (info.genres.length) bits.push(info.genres.join(', '));
      if (info.length) bits.push(info.length);
      line.textContent = bits.join(' · ');
      text.textContent = info.overview;
      setClass(text, 'short', box.firstChild.offsetHeight > 90);   // a name in two lines: a line less of overview
      if (info.people.length) {
        el('div', 'd-relhead', people, tr('details|Cast'));
        var row = el('div', 'd-row', people);
        for (var i = 0; i < info.people.length; i++) {
          var c = info.people[i], who = el('div', 'd-who' + (c.maker ? ' maker' : ''), row), face = el('div', 'd-face', who);
          if (c.photo) face.style.backgroundImage = 'url(' + c.photo + ')';
          else face.textContent = String(c.name).charAt(0);
          el('div', 'd-nm', who, c.name);
          el('div', 'd-rl', who, c.role);
        }
      }
    });
    Data.related(p, function (list) {
      if (seq !== detailSeq || !list.length) return;
      detailRelated = list.slice(0, 8);
      el('div', 'd-relhead', rel, tr('details|More like this'));
      var row = el('div', 'd-relrow', rel);
      for (var i = 0; i < detailRelated.length; i++) {
        // TMDB's plain posters: RPDB's scores are too small to read at this size
        el('div', 'd-relcard', row).style.backgroundImage = 'url(' + Data.image(detailRelated[i].poster, 'w185') + ')';
      }
      // Right of them, the focused one's name and line (year, genres, length), as the screen shows a pick's.
      var side = el('div', 'd-relinfo', rel);
      el('div', 'd-relname', side);
      el('div', 'd-relmeta', side);
      updateDetailFocus();
    });
    updateDetailFocus();
  }

  /** The top right's buttons, right to left from the X, with a gap after the title's own (detailTop). */
  function renderDetailTop(d) {
    var old = d.querySelectorAll('.d-top');
    for (var o = 0; o < old.length; o++) old[o].parentNode.removeChild(old[o]);
    var top = detailTop(), x0 = 1772;
    for (var t = top.length - 1; t >= 0; t--) {
      var x = el('div', 'close d-top' + (top[t][0] === 'close' ? ' x' : ''), d), m = el('span', 'mark', x);
      if (top[t].gap) x0 -= 28;
      x.style.left = x0 + 'px';
      x0 -= 92;
      m.style.webkitMaskImage = m.style.maskImage = 'url(icons/glyph-' + top[t][1] + '.svg)';
      el('div', 'tip', x, top[t][2]);
    }
    // In document order left to right, as the focus counts them.
    var nodes = d.querySelectorAll('.d-top'), list = [];
    for (var n = 0; n < nodes.length; n++) list.push(nodes[n]);
    list.reverse();
    for (var r = 0; r < list.length; r++) d.appendChild(list[r]);
  }

  function updateDetailFocus() {
    var d = $('detail');
    if (!d) return;
    var rows = [d.querySelectorAll('.d-top'), d.querySelectorAll('.d-relcard')];
    for (var r = 0; r < rows.length; r++) {
      for (var i = 0; i < rows[r].length; i++) setClass(rows[r][i], 'focus', st.zone === Z.DETAIL && df.row === r && df.i === i);
    }
    relatedInfo(d, st.zone === Z.DETAIL && df.row === 1 ? detailRelated[df.i] : null);
  }

  var relInfo = {};   // a related title's line, by kind:id, fetched once when it's focused

  function relatedInfo(d, p) {
    var side = d.querySelector('.d-relinfo');
    if (!side) return;
    setClass(side, 'on', !!p);
    if (!p) return;
    var k = p.kind + ':' + p.id;
    side.firstChild.textContent = p.title || '';
    side.lastChild.textContent = relInfo[k] || '';
    if (relInfo[k] !== undefined) return;
    relInfo[k] = '';
    Data.fullDetails(p, function (info) {
      if (!info) return;
      var bits = [];
      if (info.year) bits.push(info.year);
      if (info.genres.length) bits.push(info.genres.join(', '));
      if (info.length) bits.push(info.length);
      relInfo[k] = bits.join(' · ');
      if (df.row === 1 && detailRelated[df.i] === p) side.lastChild.textContent = relInfo[k];
    });
  }

  function detailMove(dx, dy) {
    var counts = [detailTop().length, detailRelated.length];
    if (dx) df.i = Math.max(0, Math.min(counts[df.row] - 1, df.i + dx));
    else if (dy > 0 && df.row === 0 && counts[1]) { df.row = 1; df.i = 0; }
    else if (dy < 0 && df.row === 1) { df.row = 0; df.i = counts[0] - 1; }
    updateDetailFocus();
  }

  function detailActivate() {
    if (df.row === 1) { if (detailRelated[df.i]) openDetails(detailRelated[df.i], true); return; }
    var what = detailTop()[df.i] && detailTop()[df.i][0];
    if (what === 'back') detailBack();
    else if (what === 'close') closeDetails();
    else if (what) detailAction(what);
  }

  /**
   * A button on the page, for its title: Play opens it (the page closes); the rest change its state here and on Trakt,
   * and the page stays with its buttons redrawn (the focus on the same place), unless it left the tab it came from.
   */
  function detailAction(what) {
    var p = detailStack[detailStack.length - 1];
    if (!p) return;
    if (what === 'play') {
      var target = pickTarget(p);
      if (!target) return;
      closeDetails();
      openPick(p, target);
      return;
    }
    function failed(err) { if (err) toast(trf("trakt|Trakt didn't take it: {error}", {error: err.message})); }
    if (what === 'list' || what === 'unlist') Data.setWatchlist(p, what === 'list', failed);
    else if (what === 'watched' || what === 'drop') Data.traktMark(p, what, failed);
    else Data.mark(p, what);
    cards = [];
    renderCards();
    var d = $('detail');
    if (d) renderDetailTop(d);
    df.i = Math.min(df.i, detailTop().length - 1);
    updateDetailFocus();
  }

  /** Back on a page: the page opened before, then the screen. */
  function detailBack() {
    if (detailStack.length > 1) {
      detailStack.pop();
      var p = detailStack.pop();
      openDetails(p, true);
      return;
    }
    closeDetails();
  }

  function closeDetails() {
    detailSeq++;
    detailStack = [];
    setClass($('detail'), 'open', false);
    st.zone = cards.length ? Z.CARDS : Z.SHELF;   // back on the poster
    updateFocus();
  }

  /** The action on the focused title; where it leaves this tab, the next one takes the focus (on its poster). */
  function doAction(what) {
    var p = cards[st.card];
    if (!p) return;
    if (what === 'details') { openDetails(p); return; }
    function failed(err) { if (err) toast(trf("trakt|Trakt didn't take it: {error}", {error: err.message})); }
    if (what === 'list' || what === 'unlist') {
      Data.setWatchlist(p, what === 'list', failed);
    } else if (what === 'watched' || what === 'drop') {
      Data.traktMark(p, what, failed);
    } else {
      Data.mark(p, what);
    }
    cards = [];
    renderCards();
    if (!cards[st.card] || cards[st.card].id !== p.id) st.zone = Z.CARDS;
    updateFocus();
  }

  function startMore() {
    if (loadingMore) return;
    loadingMore = true;
    var nodes = $('cards').children;
    if (nodes.length) setClass(nodes[nodes.length - 1], 'loading', true);
    Data.more(dataTab());
  }   // the cards' width: TMDB's and RPDB's posters are 2:3, the card 442 high

  var bgUrl = null, bgFront = 'bgA', blurCanvas = null;

  /** The focused pick's photo as the background: drawn tiny and stretched, it's already as soft as a heavy blur. */
  function backdrop(url) {
    if (url === bgUrl) return;
    bgUrl = url;
    var next = bgFront === 'bgA' ? 'bgB' : 'bgA';
    if (!url) {
      setClass($('bgA'), 'on', false);
      setClass($('bgB'), 'on', false);
      return;
    }
    var img = new Image();
    img.onload = function () {
      if (bgUrl !== url) return;
      // A real blur, smooth at any stretch: the photo shrunk to 12 × 7, then drawn back up inside the canvas with its
      // own smoothing, a soft gradient the TV can't show as blocks when it stretches the canvas to the screen.
      var canvas = $(next), ctx = canvas.getContext('2d'), tiny = blurCanvas || (blurCanvas = document.createElement('canvas'));
      tiny.width = 12;
      tiny.height = 7;
      var t = tiny.getContext('2d');
      t.imageSmoothingEnabled = true;
      t.drawImage(img, 0, 0, tiny.width, tiny.height);
      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
      setClass(canvas, 'on', true);
      setClass($(bgFront), 'on', false);
      bgFront = next;
    };
    img.src = url;
  }

  // As HomeView's bgFollow: the background follows the focused pick.
  var BG_FOLLOW_MS = 250, bgTimer = 0;

  /** The focused pick's photo as the background once the focus has rested on it: a quick run along the row fades once. */
  function followSoon() {
    clearTimeout(bgTimer);
    bgTimer = setTimeout(function () {
      var c = cards[Math.min(st.card, cards.length - 1)];
      if (c && !c.more) backdrop(Data.image(c.backdrop, 'w300'));
    }, BG_FOLLOW_MS);
  }

  function renderClock() {
    var d = new Date(), c = $('clock');
    c.firstChild.textContent = formatDate('format|h:mm', d.getTime());
    c.lastChild.textContent = formatDate('format|EEEE, MMMM d', d.getTime());
  }

  /** On the minute, so the clock never runs late (the 30-second refresh could, by up to 30 s). */
  function tickClock() {
    renderClock();
    setTimeout(tickClock, 60000 - Date.now() % 60000 + 50);
  }

  // MARK: - Shelf

  var shelfFirst = 0, tileStep = 0, tileLeft = 0;

  function renderShelf() {
    var n = Math.min(shelf.length, SHELF_VISIBLE), gap = 40, pad = 40;
    // Square tiles, as a phone's app icons: never taller than 120 (the name shows under the focused one, inside the
    // glass), and the glass keeps its bottom edge.
    var tw = Math.min(120, (1760 - Math.max(0, n - 1) * gap) / Math.max(1, n)), th = tw;
    var width = n * tw + Math.max(0, n - 1) * gap, left = 80;   // the picks' left edge
    var platter = $('platter');
    platter.className = 'bare';
    platter.style.display = n ? '' : 'none';
    platter.style.left = (left - pad) + 'px';
    platter.style.width = (width + 2 * pad) + 'px';
    platter.style.top = (854 + 126 - th) + 'px';   // 40 lower than the stock layout: the room under it
    platter.style.height = (th + 2 * pad) + 'px';
    $('quotes').style.right = (1920 - left - width) + 'px';
    var tiles = $('tiles');
    tiles.innerHTML = '';
    tileStep = tw + gap;
    tileLeft = left;
    shelfFirst = Math.max(0, Math.min(shelfFirst, shelf.length - n));
    for (var i = 0; i < shelf.length; i++) {
      var t = el('div', 'tile', tiles);
      t.style.top = (894 + 126 - th) + 'px';
      t.style.width = tw + 'px';
      t.style.height = th + 'px';
      t.className = 'tile bare';
      glyphFace(shelf[i], el('div', 'look', t), tw);
      el('div', 'name', t, shelf[i].title);
      hover(t, Z.SHELF, i);
    }
    // More apps than fit: a small arrow inside the glass's edge on each side that has more, where no tile reaches
    // even focused (inside the screen's safe area, as on Android).
    platter.innerHTML = '';
    for (var a = 0; a < 2; a++) {
      var arrow = sym('chevron_right', platter);
      arrow.className += a ? ' more' : ' more back';
      arrow.style.left = (a ? width + 2 * pad - 14 : 14) - 8.5 + 'px';
      arrow.style.top = (pad + th / 2 - 8.5) + 'px';
    }
    st.shelf = Math.min(st.shelf, Math.max(0, shelf.length - 1));
    placeTiles();
  }

  /** The row slides (a transform on #tiles, which old TVs animate), and the apps it takes past the glass fade out. */
  function placeTiles() {
    var row = $('tiles'), tiles = row.children, n = Math.min(shelf.length, SHELF_VISIBLE);
    for (var i = 0; i < shelf.length; i++) {
      var shown = i >= shelfFirst && i < shelfFirst + n;
      tiles[i].style.left = (tileLeft + i * tileStep) + 'px';
      tiles[i].style.opacity = shown ? '' : '0';
      tiles[i].style.pointerEvents = shown ? '' : 'none';
    }
    row.style.webkitTransform = row.style.transform = 'translateX(' + (-shelfFirst * tileStep) + 'px)';
    var arrows = $('platter').children;
    arrows[0].style.visibility = shelfFirst > 0 ? '' : 'hidden';
    arrows[1].style.visibility = shelfFirst + n < shelf.length ? '' : 'hidden';
  }

  /** Scrolls the shelf, one app at a time, so the focused app is shown. */
  function revealShelf() {
    var n = Math.min(shelf.length, SHELF_VISIBLE);
    var first = Math.max(0, Math.min(Math.max(shelfFirst, st.shelf - n + 1), Math.min(st.shelf, shelf.length - n)));
    if (first === shelfFirst || !shelf.length) return;
    shelfFirst = first;
    placeTiles();
  }

  // MARK: - Drawer

  // The drawer is All Apps: ↓ on the shelf (or its last tile, the arrow) slides the page up as the weather's did, the
  // shelf stays at the top and every other app follows under it, in alphabetical order, as the shelf shows its own.
  // The weather and prices panels are gone (NO_PANELS).
  var drawerItems = [], drawerInputs = 0, NO_DRAWER = true, NO_PANELS = true;   // every app is on the shelf now
  var DRAWER_COLS = 8, DRAWER_STEP = 210, DRAWER_ROW = 230, DRAWER_TOP = 556;

  function renderDrawer() {
    var d = $('drawer');
    d.innerHTML = '';
    drawerItems = others.slice().sort(function (a, b) {
      var x = a.title.toLowerCase(), y = b.title.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    }).map(function (app) { return {app: app, run: launcher(app.id, app.title)}; });
    drawerInputs = 0;
    if (drawerItems.length) el('div', 'row-title', d, tr('All Apps')).style.left = '84px';
    // The rows scroll inside a window under the shelf, so the ones above the focus never slide over it.
    var view = el('div', 'dview', d), grid = el('div', 'dgrid', view);
    var left = (1920 - ((DRAWER_COLS - 1) * DRAWER_STEP + 120)) / 2;
    for (var k = 0; k < drawerItems.length; k++) {
      var app = drawerItems[k].app, cell = el('div', 'tile bare dcell', grid);
      cell.style.left = (left + (k % DRAWER_COLS) * DRAWER_STEP) + 'px';
      cell.style.top = (24 + Math.floor(k / DRAWER_COLS) * DRAWER_ROW) + 'px';
      cell.style.width = cell.style.height = '120px';
      glyphFace(app, el('div', 'look', cell), 120);
      el('div', 'name', cell, app.title);
      hover(cell, Z.DRAWER, k);
    }
    renderPanels();
    updateFocus();
  }

  /** The drawer's rows from the focused one's row: the one above it stays in view. */
  function scrollDrawer() {
    var grid = document.querySelector('#drawer .dgrid');
    if (!grid) return;
    var rows = Math.ceil(drawerItems.length / DRAWER_COLS), r = Math.floor(st.drawer / DRAWER_COLS);
    var first = Math.max(0, Math.min(rows - 2, r - 1));
    grid.style.webkitTransform = grid.style.transform = 'translateY(' + (-first * DRAWER_ROW) + 'px)';
  }

  function renderPanels() {
    var d = $('drawer');
    var old = d.querySelectorAll('.panel');
    for (var o = 0; o < old.length; o++) d.removeChild(old[o]);
    // No second page: the drawer shows nothing and never opens (↓ on the shelf does nothing), so nor are its weather
    // and prices drawn. The quotes in the tab row and the screensaver's weather stay.
    if (NO_PANELS) return;
    var wx = Prefs.weather(), coins = Data.activeCoins(), qt = coins.length > 0;
    var split = 80 + 1760 * 0.585;
    if (wx) {
      var w = el('div', 'panel glass', d);
      w.id = 'weather';
      w.style.left = '80px';
      w.style.width = ((qt ? split - 16 : 1840) - 80) + 'px';
      renderWeather(w);
    }
    if (qt) {
      var q = el('div', 'panel glass', d);
      q.id = 'prices';
      var left = wx ? split + 16 : 80;
      q.style.left = left + 'px';
      q.style.width = (1840 - left) + 'px';
      renderPrices(q, coins);
    }
  }

  function renderWeather(card) {
    el('div', 'head', card, Data.city || tr('Weather'));
    var w = Data.weather;
    if (!w) {
      el('div', 'cond', card, tr('No weather data right now.')).style.top = '96px';
      return;
    }
    var now = el('div', 'now', card);
    sym(Data.symbol(w.code, w.isDay), now);
    el('span', 'temp', now, Data.degrees(w.temp));
    el('div', 'cond', card, Data.condition(w.code, w.isDay));
    var parts = weatherParts(w);
    extraKey = parts.join(' · ');
    if (parts.length) extraShown = fitExtra(el('div', 'extra', card, extraKey), parts);
    else extraShown = '';
    setClass(card, 'with-extra', !!extraShown);   // the card grows the line only when it has one: otherwise, main's
    el('div', 'range', card, trf('H:{max}', {max: Data.degrees(w.max)}) + '   ' + trf('L:{min}', {min: Data.degrees(w.min)}));
    el('div', 'split', card);
    // Home Settings → Forecast: the next 6 hours or the next 5 days (the hours until a forecast has days).
    var days = Prefs.forecast() === 'days' && w.days && w.days.length > 0, list = days ? w.days : w.hours, n = days ? 5 : 6;
    var hours = el('div', 'hours', card), width = parseFloat(card.style.width) - 30 - 422, hw = width / n;
    for (var i = 0; list && i < list.length && i < n; i++) {
      var h = el('div', 'hour', hours), x = list[i];
      h.style.left = (hw * i) + 'px';
      h.style.width = hw + 'px';
      el('div', 't', h, days ? Data.weekday(x.at) : Data.hour(x.at));
      sym(Data.symbol(x.code, days || x.day), h);
      var t = el('div', 'd', h, Data.degrees(days ? x.max : x.temp));
      if (days) el('span', 'low', t, Data.degrees(x.min));
    }
    var sun = el('div', 'sun', card);
    if (w.sunrise) { var a = el('span', '', sun); sym('sunrise', a); a.appendChild(document.createTextNode(trf('Sunrise {time}', {time: Data.time(w.sunrise)}))); }
    if (w.sunset) { var b = el('span', '', sun); sym('sunset', b); b.appendChild(document.createTextNode(trf('Sunset {time}', {time: Data.time(w.sunset)}))); }
  }

  var extraShown = '', extraKey = '';

  /**
   * The line under the condition, part by part: rain in the next two hours, the UV index by day, the air quality from
   * moderate up. Empty when it has nothing to say (no rain coming, night, clean air): then the card is the one on main.
   */
  function weatherParts(w) {
    var parts = [], rain = Data.rainIn(Date.now());
    // 0: it rains now, which the line above says; -1: no rain in the two hours ahead; null: the forecast doesn't reach.
    if (rain > 0) parts.push(trf('Rain in ~{time}', {time: trf('{n} min', {n: Math.max(5, Math.round(rain / 5) * 5)})}));
    if (w.uv >= 3 && w.isDay) parts.push(trf('UV {n}', {n: Math.round(w.uv)}));   // the day's highest, so not at night
    var air = Data.air;
    // 51 is where the US AQI says moderate: good air is what a weather card needn't spell out.
    if (air && air.aqi !== null && air.aqi !== undefined && air.aqi >= 51) parts.push(trf('AQI {n}', {n: Math.round(air.aqi)}));
    return parts;
  }

  /** Never a cut at the edge: the line is set smaller first, and then its last part goes (the air quality, then the UV). */
  function fitExtra(line, parts) {
    var sizes = [21, 19];
    for (var i = 0; i < sizes.length; i++) {
      line.style.fontSize = sizes[i] + 'px';
      if (line.scrollWidth <= line.clientWidth + 1) return line.textContent;
    }
    while (parts.length > 1 && line.scrollWidth > line.clientWidth + 1) {
      parts.pop();
      line.textContent = parts.join(' · ');
    }
    return line.textContent;
  }

  // "Rain in ~40 min" counts down between forecasts: the card is drawn again when its line would read otherwise.
  setInterval(function () {
    if (Prefs.weather() && Data.weather && weatherParts(Data.weather).join(' · ') !== extraKey) renderPanels();
  }, 60000);

  function renderPrices(card, coins) {
    el('div', 'head', card, tr('Crypto'));
    var stale = Data.staleness(Data.pricesAt, 5 * 60000);
    el('div', 'side', card, stale ? trf('quotes|{ago}', {ago: stale}) : tr('24h change'));
    for (var j = 0; j < coins.length; j++) {
      var i = coins[j], row = el('div', 'coin', card);
      row.style.top = (86 + 52 * j) + 'px';
      coin(i, row);
      el('span', 'n', row, Data.coinName(i));
      el('span', 'p', row, Data.money(Data.prices[i]));
      var ch = Data.changes[i];
      if (!isNaN(ch)) el('span', 'c ' + (ch >= 0 ? 'up' : 'down'), row, Data.change(ch));
    }
  }

  function openDrawer() {
    if (NO_DRAWER || !drawerItems.length) return;
    var tiles = $('tiles').children, cells = document.querySelectorAll('#drawer .dcell'), row = [];
    for (var i = 0; i < Math.min(DRAWER_COLS, cells.length); i++) row.push(cells[i]);
    st.zone = Z.DRAWER;
    st.drawer = nearest(row, centerX(tiles[st.shelf]));   // the first row's app under the shelf's focus
    updateFocus();
  }

  function closeDrawer() {
    var keys = document.querySelectorAll('#drawer .dcell');
    st.zone = Z.SHELF;
    if (shelf.length && keys[st.drawer]) st.shelf = nearest($('tiles').children, centerX(keys[st.drawer]));
    updateFocus();
  }

  // MARK: - All Apps

  // All Apps: every app (the shelf's too) as the shelf shows them, a glyph in the theme's color with its name under it,
  // APP_COLS to a row.
  var APP_COLS = 8, APP_STEP = 210, APP_ROW = 240;

  function renderApps() {
    var sheet = $('apps');
    sheet.firstChild.textContent = tr('All Apps');
    var grid = sheet.lastChild;
    grid.innerHTML = '';
    var left = (1920 - ((APP_COLS - 1) * APP_STEP + 130)) / 2;
    for (var i = 0; i < apps.length; i++) {
      var r = Math.floor(i / APP_COLS), c = i % APP_COLS, cell = el('div', 'cell glyphcell', grid);
      cell.style.left = (left + c * APP_STEP) + 'px';
      cell.style.top = (210 + r * APP_ROW) + 'px';
      glyphFace(apps[i], el('div', 'look', cell), 130, true);
      el('div', 'label', cell, apps[i].title);
      hover(cell, Z.APPS, i);
    }
  }

  function openApps() {
    renderApps();
    st.zone = Z.APPS;
    st.grid = 0;
    setClass($('apps'), 'open', true);
    fitLogos($('apps'));
    updateFocus();
  }

  function closeSheets() {
    setClass($('apps'), 'open', false);
    setClass($('settings'), 'open', false);
    setClass($('shelfedit'), 'open', false);
    setClass($('langpick'), 'open', false);
    setClass($('about'), 'open', false);
    closeField('citypick');
    closeField('keypick');
    setClass($('citypick'), 'open', false);
    setClass($('keypick'), 'open', false);
    langHint = null;
    st.zone = Z.SHELF;
    updateFocus();
  }

  // MARK: - Home Settings

  function settingRows() {
    var unit = Prefs.temperature(), theme = Prefs.theme(), clock = Prefs.clockFormat();
    var auto = tr('Automatic'), picked = pickedLanguage();
    var rows = [
      {label: tr('Language'), value: picked === 'auto' ? auto : I18N.languageName(picked), opens: true, language: true,
        step: function (d) { if (d >= 0) openLanguages(); }},
      {label: tr('Temperature'), value: unit === 'C' ? '°C' : unit === 'F' ? '°F' : tr('unit|Automatic'),
        step: function (d) { cycle('temperature', ['auto', 'C', 'F'], unit, d); renderPanels(); }},
      {label: tr('Theme'), value: theme === 'light' ? tr('Light') : theme === 'dark' ? tr('Dark') : auto,
        step: function (d) { cycle('theme', ['auto', 'light', 'dark'], theme, d); checkNight(); }},
      {label: tr('Clock'), value: clock === '24' ? tr('24 hours') : clock === '12' ? tr('12 hours') : auto,
        step: function (d) {
          cycle('clockFormat', ['auto', '24', '12'], clock, d);
          I18N.setClock(Prefs.clockFormat());
          renderClock();
          renderPanels();
        }},
      {label: tr('Dim'), value: dimName(),
        step: function (d) { cycle('dim', ['off', 'low', 'medium', 'high', 'auto'], Prefs.dim(), d); applyDim(); }},
      {label: tr('Screensaver'), value: saverMode() === 'clock' ? tr('Clock') : tr('Photos'),
        step: function (d) { cycle('saver', ['photos', 'clock'], saverMode(), d); }},
      {label: tr('Picks per tab'), value: String(Prefs.cards()),
        step: function (d) { Prefs.set('cards', 3 + (Prefs.cards() - 3 + (d || 1) + 4) % 4); renderCards(); }},
      {label: tr('Cartoons and anime'), toggle: !Prefs.hideAnimation(),
        step: function () { Prefs.set('hideAnimation', !Prefs.hideAnimation()); Data.refresh(); }},
      {label: tr('Watch from the screensaver'), toggle: Prefs.saverWatch(),
        step: function () { Prefs.set('saverWatch', !Prefs.saverWatch()); }},
      {label: tr('Weather widget'), toggle: Prefs.weather(),
        step: function () { Prefs.set('weather', !Prefs.weather()); renderPanels(); }},
      {label: tr('City'), value: Prefs.city() || '—', opens: true, city: true,
        step: function (d) { if (d >= 0) openCities(); }},
      {label: tr('Forecast'), value: Prefs.forecast() === 'days' ? tr('Next days') : tr('Next hours'),
        step: function (d) { cycle('forecast', ['hours', 'days'], Prefs.forecast(), d); renderPanels(); }},
      {label: tr('Quotes widget'), toggle: Prefs.quotes(),
        step: function () { Prefs.set('quotes', !Prefs.quotes()); Data.settingsChanged(); }}
    ];
    var names = ['Bitcoin', 'Ethereum', 'Solana', tr('Dollar')];
    var count = Data.currency === 'BRL' ? 4 : 3;
    for (var i = 0; i < count; i++) {
      (function (i) {
        rows.push({label: names[i], toggle: Prefs.quotes() && Prefs.coin(i), dim: !Prefs.quotes(),
          step: function () { if (Prefs.quotes()) { Prefs.setCoin(i, !Prefs.coin(i)); Data.settingsChanged(); } }});
      })(i);
    }
    rows.push({label: tr('TMDB key'), value: Prefs.tmdbKey().length >= 4 ? '•••• ' + Prefs.tmdbKey().slice(-4) : tr('Not set'), opens: true, tmdb: true,
      step: function (d) { if (d >= 0) openKey(); }});
    var sv = Data.services();
    if (sv.length) {
      var someOff = false;   // only the services this TV has count
      for (var q = 0; q < sv.length; q++) someOff = someOff || Prefs.serviceOff(sv[q].key);
      rows.push({label: tr('Picks from'), value: someOff ? tr('services|Some') : tr('services|All'),
        step: function () { Prefs.set('servicesOff', []); Data.settingsChanged(); }});
      for (var j = 0; j < sv.length; j++) {
        (function (key, name) {
          rows.push({label: name, toggle: !Prefs.serviceOff(key),
            step: function () { Prefs.setServiceOff(key, !Prefs.serviceOff(key)); Data.refresh(); Data.settingsChanged(); }});
        })(sv[j].key, sv[j].name);
      }
    }
    if (nuvio()) {
      var open = Prefs.openPicks();
      rows.push({label: tr('Open picks in'), value: open === 'nuvio' ? 'Nuvio' : tr('Streaming apps'),
        step: function (d) { cycle('openPicks', ['apps', 'nuvio'], open, d); }});
    }
    rows.push({label: tr('Live TV button'), value: boxLabel(),
      step: function (d) { cycle('boxInput', ['live', 'hdmi1', 'hdmi2', 'hdmi3', 'hdmi4'], Prefs.boxInput(), d); renderTop(); }});
    rows.push({label: tr('Live TV'), toggle: Prefs.liveInput(),
      step: function () { Prefs.set('liveInput', !Prefs.liveInput()); pickShelf(); renderShelf(); }});
    rows.push({label: tr('Shelf'), value: '›', shelf: true, step: function (d) { if (d >= 0) openShelfEdit(); }});
    rows.push({label: tr('About this TV'), value: '›', about: true, step: function (d) { if (d >= 0) openAbout(); }});
    if (TV.canOpenSettings) rows.push({label: tr('TV Settings'), value: '›', step: function (d) { if (d >= 0) tvSettings(); }});
    return rows;
  }

  function cycle(name, values, current, d) {
    var i = values.indexOf(current);
    Prefs.set(name, values[(i + (d || 1) + values.length) % values.length]);
  }

  var rowsNow = [];

  function renderSettings() {
    var box = $('settings').firstChild;
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('settings', title);
    title.appendChild(document.createTextNode(tr('Home Settings')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    rowsNow = settingRows();
    list.style.height = Math.min(rowsNow.length, 7) * 78 + 'px';
    for (var i = 0; i < rowsNow.length; i++) {
      var r = rowsNow[i], row = el('div', 'row' + (r.dim ? ' dim' : ''), holder, r.label);
      if (r.toggle !== undefined) setClass(el('div', 'toggle', row), 'on', r.toggle);
      else {
        var v = el('span', 'value', row);
        if (r.value === '›') v.textContent = '›';
        else if (r.opens) { v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
        else { el('span', 'chev', v, '‹'); v.appendChild(document.createTextNode(r.value)); el('span', 'chev', v, '›'); }
      }
      hover(row, Z.SETTINGS, i);
    }
    el('div', 'hint', box, tr('OK or the arrows change the value.'));
    updateFocus();
  }

  function openSettings() {
    st.zone = Z.SETTINGS;
    st.row = 0;
    renderSettings();
    setClass($('settings'), 'open', true);
    updateFocus();
  }

  // MARK: - Language: a list of every catalogue in its own name, as on Android (moving through it doesn't switch the app)

  var langHint = null;

  function languageChoices() {
    return ['auto'].concat(I18N.languages());
  }

  /** The language in use: "auto", or the catalogue the setting resolved to ("pt-BR" in config.properties is "pt"). */
  function pickedLanguage() {
    return Prefs.language() === 'auto' ? 'auto' : I18N.lang;
  }

  function renderLanguages() {
    var box = $('langpick').firstChild, choices = languageChoices(), current = choices.indexOf(pickedLanguage());
    box.innerHTML = '';
    el('div', 'title', box, tr('Language'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(choices.length, 7) * 78 + 'px';
    for (var i = 0; i < choices.length; i++) {
      var row = el('div', 'row', holder, choices[i] === 'auto' ? tr('Automatic') : I18N.languageName(choices[i]));
      if (i === current) sym('check', el('span', 'value', row));
      hover(row, Z.LANG, i);
    }
    langHint = el('div', 'hint', box);
    updateFocus();
  }

  function openLanguages() {
    setClass($('settings'), 'open', false);
    st.zone = Z.LANG;
    st.lang = Math.max(0, languageChoices().indexOf(pickedLanguage()));
    renderLanguages();
    setClass($('langpick'), 'open', true);
    updateFocus();
  }

  /** OK: the language under the focus; Back: none. Either way, back to Home Settings, on the Language row. */
  function closeLanguages(pick) {
    setClass($('langpick'), 'open', false);
    langHint = null;
    var code = languageChoices()[st.lang];
    if (pick && code !== pickedLanguage()) {
      Prefs.set('language', code);
      I18N.set(Prefs.language());
      renderAll();
      Data.refresh();   // the picks' titles and genres come in the new language
    }
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].language) st.row = i;
    updateFocus();
  }

  // MARK: - Text fields: typed with the TV's keyboard (the city, the TMDB key)

  /** A row with a text field; on the TV, the focus in it brings up the keyboard. */
  function textField(holder, zone, value, placeholder, label) {
    var field = el('input', '', el('div', 'row field', holder));
    field.type = 'text';
    field.value = value;
    field.placeholder = placeholder;
    field.setAttribute('aria-label', label);
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('spellcheck', 'false');
    hover(field.parentNode, zone, 0);
    return field;
  }

  function fieldOf(sheet) { return $(sheet).querySelector('input'); }

  function typingIn(sheet) { var f = fieldOf(sheet); return !!f && document.activeElement === f; }

  /** Into the field: the TV shows its keyboard. */
  function openField(sheet) {
    var f = fieldOf(sheet);
    if (!f) return;
    // Without scrolling: the search bar clips its field, and a focus that scrolls it would undo its animation.
    try { f.focus({preventScroll: true}); } catch (e) { f.focus(); }
    $(sheet).scrollLeft = 0;
    try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {}
  }

  function closeField(sheet) {
    if (typingIn(sheet)) fieldOf(sheet).blur();
  }

  // MARK: - City: typed with the TV's keyboard, found by Open-Meteo, as on Android (the weather is for its coordinates)

  var cityFound = [], cityStatus = '', cityTimer = 0, citySeq = 0;

  /** The field to type in, the Search row, then the places found. */
  function cityRows() { return 2 + cityFound.length; }

  function renderCities() {
    var box = $('citypick').firstChild, old = fieldOf('citypick'), typed = old ? old.value : '', inField = typingIn('citypick');
    box.innerHTML = '';
    el('div', 'title', box, tr('City'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(cityRows(), 7) * 78 + 'px';
    textField(holder, Z.CITY, typed, tr("Type the city's name"), tr('City'));
    var search = el('div', 'row', holder, tr('Search'));
    sym('chevron_right', el('span', 'value', search));
    hover(search, Z.CITY, 1);
    for (var i = 0; i < cityFound.length; i++) {
      var row = el('div', 'row', holder, cityFound[i].label);
      hover(row, Z.CITY, 2 + i);
    }
    el('div', 'hint', box, cityStatus || tr('OK picks, Back cancels.'));
    if (inField) openField('citypick');   // a message that went away while typing: the keyboard stays
    updateFocus();
  }

  function openCities() {
    setClass($('settings'), 'open', false);
    st.zone = Z.CITY;
    st.city = 0;
    cityFound = [];
    cityStatus = '';
    $('citypick').firstChild.innerHTML = '';
    renderCities();
    setClass($('citypick'), 'open', true);
    openField('citypick');
  }

  function setCityStatus(text) {
    cityStatus = text;
    clearTimeout(cityTimer);
    // Clears only the hint: a new render would rebuild the field and interrupt the TV's keyboard while someone types.
    if (text && text !== tr('Searching…')) cityTimer = setTimeout(function () {
      cityStatus = '';
      var hint = st.zone === Z.CITY && $('citypick').querySelector('.hint');
      if (hint) hint.textContent = tr('OK picks, Back cancels.');
    }, 4000);
    if (st.zone === Z.CITY) renderCities();
  }

  function searchCity() {
    var f = fieldOf('citypick'), name = f ? f.value : '';
    closeField('citypick');
    if (!name.trim()) { st.city = 0; openField('citypick'); updateFocus(); return; }
    if (cityStatus === tr('Searching…')) return;
    setCityStatus(tr('Searching…'));
    var mine = ++citySeq;   // an answer for a sheet already closed (and opened again) is dropped
    Data.findCity(name, function (err, found) {
      if (mine !== citySeq) return;
      if (st.zone !== Z.CITY) { cityStatus = ''; return; }
      cityFound = found || [];
      if (cityFound.length) st.city = 2;   // on the first place found
      setCityStatus(err ? trf("Couldn't search now: {error}", {error: err.message}) : cityFound.length ? '' : tr('No city with that name.'));
    });
  }

  /** OK on a place: the weather moves there. Back (pick false): nothing changes. Either way, back on the City row. */
  function closeCities(pick) {
    var place = pick && cityFound[st.city - 2];
    closeField('citypick');
    setClass($('citypick'), 'open', false);
    cityFound = [];
    citySeq++;
    clearTimeout(cityTimer);
    cityStatus = '';
    if (place) {
      Prefs.setCity(place.city, place.lat, place.lon);
      Data.cityChanged();
    }
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].city) st.row = i;
    updateFocus();
  }

  function activateCity() {
    if (st.city === 0) openField('citypick');
    else if (st.city === 1) searchCity();
    else closeCities(true);
  }

  // MARK: - TMDB key: typed on the TV, so builds without one (the releases) get the picks too; TMDB checks it first

  var keyStatus = '', keyWarn = false, keyTimer = 0, keySeq = 0, keyAsking = false;

  function keyRows() { return keyAsking ? 2 : Prefs.tmdbKeyOnTV() ? 3 : 2; }

  function keySteps() {
    return tr("The key brings the picks: what's trending on your streaming apps, with their photos on the screensaver.") + '\n'
      + tr('Free, and it takes two minutes:') + '\n1. ' + tr('Create an account at themoviedb.org.')
      + '\n2. ' + tr('Open Settings → API and request a developer key.');
  }

  function renderKey() {
    var box = $('keypick').firstChild, old = fieldOf('keypick'), typed = old ? old.value : '', inField = typingIn('keypick');
    box.innerHTML = '';
    el('div', 'title', box, keyAsking ? tr('Remove the TMDB key?') : tr('TMDB key'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = keyRows() * 78 + 'px';
    if (keyAsking) {
      hover(el('div', 'row', holder, tr('Cancel')), Z.KEY, 0);
      hover(el('div', 'row', holder, tr('Remove')), Z.KEY, 1);
      updateFocus();
      return;
    }
    var keyField = textField(holder, Z.KEY, typed, tr('API Read Access Token or API Key'), tr('TMDB key'));
    // A v3 key is lowercase hex: the TV's keyboard mustn't capitalize it (the city's field wants capitals).
    keyField.setAttribute('autocapitalize', 'none');
    keyField.setAttribute('autocorrect', 'off');
    var save = el('div', 'row', holder, tr('Save'));
    sym('chevron_right', el('span', 'value', save));
    hover(save, Z.KEY, 1);
    if (Prefs.tmdbKeyOnTV()) hover(el('div', 'row', holder, tr('Remove the key')), Z.KEY, 2);
    if (keyStatus) setClass(el('div', 'hint', box, keyStatus), 'warn', keyWarn);
    el('div', 'hint steps', box, keySteps());
    if (inField) openField('keypick');
    updateFocus();
  }

  function openKey() {
    setClass($('settings'), 'open', false);
    st.zone = Z.KEY;
    st.key = 0;
    keyStatus = '';
    keyAsking = false;
    $('keypick').firstChild.innerHTML = '';
    renderKey();
    setClass($('keypick'), 'open', true);
    openField('keypick');
  }

  function setKeyStatus(text, warn) {
    keyStatus = text;
    keyWarn = !!warn;
    clearTimeout(keyTimer);
    if (text && text !== tr('Checking the key with TMDB…')) keyTimer = setTimeout(function () {
      keyStatus = '';
      var line = st.zone === Z.KEY && $('keypick').querySelector('.hint:not(.steps)');
      if (line) line.parentNode.removeChild(line);
    }, 6000);
    if (st.zone === Z.KEY) renderKey();
  }

  function cleanKey(typed) {
    var key = typed.replace(/\s+/g, '');
    return /^[A-Za-z0-9._-]{16,1024}$/.test(key) ? key : '';
  }

  function saveKey() {
    var f = fieldOf('keypick'), typed = f ? f.value : '', key = cleanKey(typed);
    closeField('keypick');
    if (!typed.replace(/\s+/g, '')) { st.key = 0; openField('keypick'); updateFocus(); return; }
    if (keyStatus === tr('Checking the key with TMDB…')) return;
    if (!key) { setKeyStatus(tr("That doesn't look like a TMDB key."), true); return; }
    setKeyStatus(tr('Checking the key with TMDB…'));
    var mine = ++keySeq;   // an answer for a sheet already closed is dropped
    Data.checkKey(key, function (err) {
      if (mine !== keySeq || st.zone !== Z.KEY) return;
      if (err) { setKeyStatus(err.rejected ? tr('TMDB refused this key.') : trf("Couldn't reach TMDB: {error}", {error: err.message}), true); return; }
      Prefs.set('tmdbKey', key);
      if (fieldOf('keypick')) fieldOf('keypick').value = '';
      Data.keyChanged();
      setKeyStatus(tr('Saved. The picks arrive in a moment.'));
    });
  }

  /** Back to config.properties' key (none in the releases): the picks go. */
  function removeKey() {
    Prefs.set('tmdbKey', undefined);   // left out of the saved settings
    closeKey();
    Data.keyChanged();
  }

  /** Back on the TMDB key row of Home Settings. */
  function closeKey() {
    closeField('keypick');
    setClass($('keypick'), 'open', false);
    keySeq++;
    clearTimeout(keyTimer);
    keyStatus = '';
    keyAsking = false;
    var f = fieldOf('keypick');
    if (f) f.value = '';
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].tmdb) st.row = i;
    updateFocus();
  }

  function askRemoveKey(on) {
    keyAsking = on;
    keyStatus = '';
    clearTimeout(keyTimer);
    st.key = on ? 0 : 2;
    renderKey();
  }

  function activateKey() {
    if (keyAsking) { if (st.key === 1) removeKey(); else askRemoveKey(false); }
    else if (st.key === 0) openField('keypick');
    else if (st.key === 1) saveKey();
    else askRemoveKey(true);
  }

  // MARK: - About this TV: what to quote when reporting a problem, without LG's or Samsung's slow menus

  function renderAbout(info) {
    var box = $('about').firstChild;
    box.innerHTML = '';
    el('div', 'title', box, tr('About this TV'));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    var rows = [
      [tr('Model'), info && info.model], [tr('Firmware'), info && info.firmware], [tr('System'), info && info.system],
      [tr('IP address'), info && info.ip], [tr('Time zone'), TV.zone()], ['Free My TV', info && info.version]
    ];
    for (var i = 0; i < rows.length; i++) {
      var row = el('div', 'row', holder), label = el('span', '', row, rows[i][0]);
      fitValue(row, label, el('span', 'value', row, info ? rows[i][1] || tr('Unavailable') : '…'));
    }
    el('div', 'hint', box, tr('Back closes.'));
  }

  /** A long value (Samsung's firmware) gets smaller instead of running over its label, and ends in "…" if even the smallest size is too wide. */
  function fitValue(row, label, value) {
    var room = row.clientWidth - label.offsetWidth - 2 * 24 - 24;   // the row's padding, and a gap after the label
    for (var size = 30; value.offsetWidth > room && size > 18; size -= 2) value.style.fontSize = size - 2 + 'px';
    if (value.offsetWidth > room) { value.style.maxWidth = room + 'px'; setClass(value, 'cut', true); }
  }

  function openAbout() {
    setClass($('settings'), 'open', false);
    st.zone = Z.ABOUT;
    renderAbout(null);
    setClass($('about'), 'open', true);
    updateFocus();
    TV.about(function (info) { if (st.zone === Z.ABOUT) renderAbout(info); });
  }

  function closeAbout() {
    setClass($('about'), 'open', false);
    openSettings();
    for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].about) st.row = i;
    updateFocus();
  }

  // MARK: - Shelf editor: which apps, in what order

  function editList() {
    var ids = shelf.filter(function (a) { return !a.allApps && !a.input; }).map(function (a) { return a.id; });
    return {ids: ids, rows: apps.slice().sort(function (a, b) {
      var ia = ids.indexOf(a.id), ib = ids.indexOf(b.id);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.title.toLowerCase() < b.title.toLowerCase() ? -1 : 1;
    })};
  }

  function renderShelfEdit() {
    var box = $('shelfedit').firstChild, e = editList();
    box.innerHTML = '';
    var title = el('div', 'title', box);
    sym('apps', title);
    title.appendChild(document.createTextNode(tr('Shelf')));
    var list = el('div', 'list', box), holder = el('div', 'rows', list);
    list.style.height = Math.min(e.rows.length, 7) * 78 + 'px';
    for (var i = 0; i < e.rows.length; i++) {
      var a = e.rows[i], at = e.ids.indexOf(a.id), row = el('div', 'row', holder, a.title);
      var place = el('span', 'value', row, at >= 0 ? '#' + (at + 1) : tr('shelf|Off'));
      if (at >= 0) sym('check', place).style.marginLeft = '16px';   // on the shelf: a check, as in the pickers
      hover(row, Z.EDIT, i);
    }
    el('div', 'hint', box, tr('OK adds or removes an app. ← → change the order.'));
    updateFocus();
  }

  function openShelfEdit() {
    setClass($('settings'), 'open', false);
    st.zone = Z.EDIT;
    st.edit = 0;
    renderShelfEdit();
    setClass($('shelfedit'), 'open', true);
    updateFocus();
  }

  function editShelf(dx) {
    var e = editList(), app = e.rows[st.edit];
    if (!app) return;
    var ids = e.ids.slice(), at = ids.indexOf(app.id);
    if (dx === 0) {
      if (at >= 0) ids.splice(at, 1);
      else ids.push(app.id);
    } else {
      if (at < 0) return;
      var to = Math.max(0, Math.min(ids.length - 1, at + dx));
      ids.splice(at, 1);
      ids.splice(to, 0, app.id);
    }
    Prefs.set('shelf', ids);
    pickShelf();
    renderShelf();
    var again = editList();
    for (var i = 0; i < again.rows.length; i++) if (again.rows[i].id === app.id) st.edit = i;
    renderShelfEdit();
  }

  // MARK: - Opening things

  /** Nuvio, when the TV has it: picks can open on its page there (Home Settings, Open picks in). LG only for now:
   *  Samsung's launch passes no data, so Nuvio would open on its Home. */
  function nuvio() {
    if (TV.name !== 'webos') return null;
    for (var i = 0; i < apps.length; i++) if (/nuvio/i.test(apps[i].id) || /^nuvio\b/i.test(apps[i].title)) return apps[i];
    return null;
  }

  function pickTarget(p) {
    if (!p) return null;
    var via = Prefs.openPicks() === 'nuvio' ? nuvio() : null;
    var app = via || Data.appFor(p.app);
    if (via) return {app: app, params: {contentTarget: 'nuvio://tmdb/' + (p.kind === 'tv' ? 'series' : 'movie') + '/' + p.id}};
    if (app) return {app: app, params: null};
    // On none of the TV's apps: Stremio, on the title's page where it reads the link (by its IMDb id).
    var s = stremio();
    if (!s) return null;
    return {app: s, params: p.imdb ? {link: 'stremio:///detail/' + (p.kind === 'tv' ? 'series' : 'movie') + '/' + p.imdb} : null};
  }

  /** Stremio, when the TV has it. */
  function stremio() {
    for (var i = 0; i < apps.length; i++) if (/stremio/i.test(apps[i].id) || /^stremio\b/i.test(apps[i].title)) return apps[i];
    return null;
  }

  /** The app a pick opens in, as a small mark at its poster's top right (its glyph, else its name's first letter). */
  /**
   * A pick opened: begun on Trakt (Data.started), then its app, on the title's page when Watchmode knows it. On none of
   * the TV's apps by TMDB, Watchmode is asked first whether one of them has it; else Stremio.
   */
  function openPick(pick, target) {
    Data.started(pick);
    if (target.params && !(stremio() && target.app === stremio())) { launcher(target.app.id, target.app.title, target.params)(); return; }
    if (stremio() && target.app === stremio()) {
      Data.serviceFor(pick, function (found) {
        if (found) launcher(found.app.id, found.app.title, TV.takesTitle(found.service) ? {link: found.link, service: found.service} : null)();
        else launcher(target.app.id, target.app.title, target.params)();
      });
      return;
    }
    // Only an app that takes a title here is looked up (TV.takesTitle: Prime Video on Samsung); the rest open at home.
    if (!TV.takesTitle(pick.app)) { launcher(target.app.id, target.app.title, null)(); return; }
    Data.titleLink(pick, function (link) { launcher(target.app.id, target.app.title, link ? {link: link, service: pick.app} : null)(); });
  }

  /** Continue's date for a show's coming episode: a small calendar at the poster's top left, dd/mm. */
  function airBadge(p, img) {
    var at = dataTab() === 2 && Data.nextAiring(p);
    if (!at) return;
    var d = new Date(at), b = el('div', 'airs', img), m = el('span', 'mark', b);
    m.style.webkitMaskImage = m.style.maskImage = 'url(icons/glyph-calendar.svg)';
    el('span', 'day', b, ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2));
  }

  function badge(p, img) {
    var t = pickTarget(p);
    if (!t) return;
    var b = el('div', 'badge', img), g = el('div', 'mark', b);
    if (t.app.glyph) g.style.webkitMaskImage = g.style.maskImage = 'url(' + t.app.glyph + ')';
    else { g.className = 'letter'; g.textContent = String(t.app.title).charAt(0).toUpperCase(); }
  }

  function launcher(id, name, params) {
    return function () {
      noteUse(id);
      TV.launch(id, params || null, function (ok) {
        if (!ok) toast(trf("Couldn't open {app}.", {app: name || id}));
      });
    };
  }

  function tvSettings() {
    TV.settings(function (ok) {
      if (!ok) toast(tr("Couldn't open TV Settings"));
    });
  }

  function liveTV() {
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === 'live') return inputs[i];
    return null;
  }

  /** The input the first top button opens, picked in Home Settings > Live TV button: Live TV or an HDMI port. */
  function boxTV() {
    var want = Prefs.boxInput();
    for (var i = 0; i < inputs.length; i++) if (inputs[i].key === want) return inputs[i];
    return liveTV();
  }

  /** Its name, for the button's tip and the settings row: the TV's own ("HDMI 2", or a name the person gave the input). */
  function boxLabel() {
    var box = boxTV();
    return box && box !== liveTV() && box.label ? box.label : tr('Live TV');
  }

  function activate() {
    switch (st.zone) {
      case Z.TOP:
        if (st.top < tabsN()) return;
        if (topItems[st.top - tabsN()]) topItems[st.top - tabsN()][2]();
        return;
      case Z.CARDS:
        var pick = cards[st.card];
        if (pick && pick.more) { startMore(); return; }
        if (pick) openDetails(pick);   // its page, where its buttons are (Play first)
        return;
      case Z.SHELF:
        if (shelf[st.shelf] && shelf[st.shelf].allApps) openDrawer();
        else if (shelf[st.shelf]) launcher(shelf[st.shelf].id, shelf[st.shelf].title)();
        return;
      case Z.DRAWER:
        if (drawerItems[st.drawer]) drawerItems[st.drawer].run();
        return;
      case Z.SEARCH:
        openField('searchbar');   // the keyboard again
        return;
      case Z.ACT:
        if (actionsFor()[st.act]) doAction(actionsFor()[st.act][0]);
        return;
      case Z.SPIDER:
        springHold();
        return;
      case Z.DETAIL:
        detailActivate();
        return;
      case Z.APPS:
        if (apps[st.grid]) launcher(apps[st.grid].id, apps[st.grid].title)();
        return;
      case Z.SETTINGS:
        if (rowsNow[st.row]) { rowsNow[st.row].step(1); if (st.zone === Z.SETTINGS) renderSettings(); }
        return;
      case Z.EDIT:
        editShelf(0);
        return;
      case Z.LANG:
        closeLanguages(true);
        return;
      case Z.CITY:
        activateCity();
        return;
      case Z.KEY:
        activateKey();
        return;
      case Z.ABOUT:
        closeAbout();
        return;
    }
  }

  /**
   * The three rows as a table: the tabs after the house, the genres and the kinds share columns, each as wide as its
   * widest word in any of the rows (measured, so any language fits), every word at its column's left; the rows start
   * where Explore does.
   */
  function alignRows() {
    var tabs = $('tabs'), ex = tabs && tabs.children[Trakt.signedIn() ? 1 : 0];
    if (!ex) return;
    var rows = [[].slice.call(tabs.children, Trakt.signedIn() ? 1 : 0)];
    if (hasSubs() && $('genres')) rows.push([].slice.call($('genres').children), [].slice.call($('subtabs').children));
    var widths = [], r, c;
    for (r = 0; r < rows.length; r++) for (c = 0; c < rows[r].length; c++) rows[r][c].style.width = '';
    for (r = 0; r < rows.length; r++) {
      for (c = 0; c < rows[r].length; c++) widths[c] = Math.max(widths[c] || 0, Math.ceil(rows[r][c].offsetWidth * 1.04));   // room for bold
    }
    if (rows.length > 1) {
      for (r = 0; r < rows.length; r++) {
        for (c = 0; c < rows[r].length; c++) { rows[r][c].style.width = widths[c] + 'px'; setClass(rows[r][c], 'col', true); }
      }
    }
    var left = (tabs.offsetLeft + ex.offsetLeft) + 'px';
    if ($('genres')) $('genres').style.left = left;
    if ($('subtabs')) $('subtabs').style.left = left;
  }

  function renderSubs() {
    var sub = $('subtabs');
    if (!sub) { sub = el('div', '', $('tabs').parentNode); sub.id = 'subtabs'; }
    sub.innerHTML = '';
    if ($('genres')) $('genres').innerHTML = '';
    if (!hasSubs()) return;
    var names = [tr('kind|All'), tr('Movies'), tr('Shows')];
    for (var i = 0; i < names.length; i++) hover(el('button', 'sub', sub, names[i]), Z.SUB, i);
    // Above the kinds, the big genres (Data's GENRES, in this order).
    var row = $('genres');
    if (!row) { row = el('div', '', $('tabs').parentNode); row.id = 'genres'; }
    row.innerHTML = '';
    var genres = [tr('kind|All'), tr('genre|Adventure'), tr('genre|Comedy'), tr('genre|Drama'), tr('genre|Thriller'),
      tr('genre|Animation'), tr('genre|Documentary')];
    for (var g = 0; g < genres.length; g++) hover(el('button', 'sub', row, genres[g]), Z.GENRE, g);
    alignRows();
  }

  /** A genre, as a sub-tab: its picks at once, from the row's start. */
  function selectGenre(i) { st.genre = i; selectSub(st.sub || 0, true); }

  /** A sub-tab, as a tab: focusing it shows its picks, from the row's start. */
  function selectSub(i) {
    st.sub = i;
    if (searchMode) { searchMode = false; searchOpen = false; renderTop(); }
    st.card = 0;
    var holder = $('cards');
    holder.style.webkitTransition = holder.style.transition = 'none';
    cards = [];
    renderCards();
    layoutCards();
    void holder.offsetWidth;
    holder.style.webkitTransition = holder.style.transition = '';
    updateFocus();
  }

  function selectTab(i) {
    if (searchMode) { searchMode = false; searchOpen = false; renderTop(); cards = []; renderCards(); }
    if (i === st.tab) return;
    st.tab = i;
    // A tab opens at its first pick, its row at the start: at once, as on Android, not sliding from the last tab's place.
    st.card = 0;
    var holder = $('cards');
    holder.style.webkitTransition = holder.style.transition = 'none';
    renderCards();
    layoutCards();   // renderCards returns early when this tab's picks are the same
    void holder.offsetWidth;   // the row is laid out where it lands before the slide comes back
    holder.style.webkitTransition = holder.style.transition = '';
  }

  function move(dx, dy) {
    var tiles = $('tiles').children, cardNodes = $('cards').children;
    switch (st.zone) {
      case Z.SHELF:
        if (dx) st.shelf = Math.max(0, Math.min(shelf.length - 1, st.shelf + dx));
        else if (dy > 0) { openDrawer(); return; }
        else if (dy < 0) {
          if (cards.length) { st.zone = Z.CARDS; st.card = nearest(cardNodes, centerX(tiles[st.shelf])); }
          else if (spiderShown()) st.zone = Z.SPIDER;
          else { st.zone = Z.TOP; st.top = Data.hasKey() ? st.tab : tabsN(); }
        }
        break;
      case Z.CARDS:
        if (dx) st.card = Math.max(0, Math.min(cards.length - 1, st.card + dx));
        else if (dy < 0) { if (hasSubs() && !searchMode) st.zone = Z.SUB; else { st.zone = Z.TOP; st.top = st.tab; } }
        else if (actionsFor().length) { st.zone = Z.ACT; st.act = 0; }   // the buttons under the focused poster first
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.TOP:
        if (dx) {
          st.top = Math.max(Data.hasKey() ? 0 : tabsN(), Math.min(tabsN() - 1 + topItems.length, st.top + dx));   // without the picks the tabs can't hold focus
          if (st.top < tabsN()) selectTab(st.top);
          else if (topItems[st.top - tabsN()] && topItems[st.top - tabsN()][2] === openSearch) { openSearch(); return; }   // focus opens the field   // as on Apple TV: focusing a tab selects it
        } else if (dy > 0) {
          if (st.top < tabsN() && hasSubs() && !searchMode) { st.zone = Z.GENRE; st.genre = st.genre || 0; }
          else if (cards.length) { st.zone = Z.CARDS; st.card = Math.min(cards.length - 1, st.top < tabsN() ? 0 : cards.length - 1); }
          else st.zone = Z.SHELF;
        }
        break;
      case Z.DETAIL:
        detailMove(dx, dy);
        return;
      case Z.SPIDER:
        if (dy < 0) st.zone = hasSubs() ? Z.SUB : Z.TOP;
        else if (dy > 0 && shelf.length) st.zone = Z.SHELF;
        break;
      case Z.ACT:
        if (dx) st.act = Math.max(0, Math.min(actionsFor().length - 1, (st.act || 0) + dx));
        else if (dy < 0) st.zone = Z.CARDS;
        else if (shelf.length) { st.zone = Z.SHELF; st.shelf = nearest(tiles, centerX(cardNodes[st.card])); }
        break;
      case Z.SUB:
        if (dx) selectSub(Math.max(0, Math.min(SUB_KIND.length - 1, (st.sub || 0) + dx)));
        else if (dy < 0) st.zone = Z.GENRE;
        else if (cards.length) st.zone = Z.CARDS;
        else if (spiderShown()) st.zone = Z.SPIDER;   // an empty row: the spider can be picked
        else if (shelf.length) st.zone = Z.SHELF;
        break;
      case Z.GENRE:
        if (dx) selectGenre(Math.max(0, Math.min($('genres').children.length - 1, (st.genre || 0) + dx)));
        else if (dy < 0) { st.zone = Z.TOP; st.top = st.tab; }
        else { st.zone = Z.SUB; st.sub = st.sub || 0; }
        break;
      case Z.SEARCH:
        if (dy > 0) { closeField('searchbar'); st.zone = cards.length ? Z.CARDS : Z.SHELF; }
        else if (dx < 0) { closeSearch(); st.top = tabsN() - 1; selectTab(st.top); }   // to the last tab, past the magnifier
        break;
      case Z.DRAWER:
        var cols = DRAWER_COLS, at = st.drawer + dx + dy * cols;
        if (dy < 0 && st.drawer < cols) { closeDrawer(); return; }
        if (dx && Math.floor(at / cols) === Math.floor(st.drawer / cols) && at >= 0 && at < drawerItems.length) st.drawer = at;
        else if (dy > 0 && Math.floor(st.drawer / cols) < Math.floor((drawerItems.length - 1) / cols)) st.drawer = Math.min(drawerItems.length - 1, at);
        else if (dy < 0) st.drawer = at;
        break;
      case Z.APPS:
        var g = st.grid + dx + dy * APP_COLS;
        if (g >= 0 && g < apps.length && (dx === 0 || Math.floor(g / APP_COLS) === Math.floor(st.grid / APP_COLS))) st.grid = g;
        break;
      case Z.SETTINGS:
        if (dy) st.row = Math.max(0, Math.min(rowsNow.length - 1, st.row + dy));
        else if (dx && rowsNow[st.row]) {
          var r = rowsNow[st.row];
          if (r.value !== '›') { r.step(dx); if (st.zone === Z.SETTINGS) renderSettings(); }
        }
        break;
      case Z.EDIT:
        if (dy) st.edit = Math.max(0, Math.min(apps.length - 1, st.edit + dy));
        else if (dx) editShelf(dx);
        break;
      case Z.LANG:
        if (dy) st.lang = Math.max(0, Math.min(languageChoices().length - 1, st.lang + dy));
        break;
      case Z.CITY:
        if (dy) st.city = Math.max(0, Math.min(cityRows() - 1, st.city + dy));
        break;
      case Z.KEY:
        if (dy) st.key = Math.max(0, Math.min(keyRows() - 1, st.key + dy));
        break;
    }
    updateFocus();
  }

  function back() {
    if (st.zone === Z.DETAIL) { detailBack(); return; }   // as the page's ← when it has one (a related title's), else it closes
    if (st.zone === Z.EDIT) {
      setClass($('shelfedit'), 'open', false);
      openSettings();
      for (var i = 0; i < rowsNow.length; i++) if (rowsNow[i].shelf) st.row = i;   // back on the Shelf row, whatever follows it
      updateFocus();
      return;
    }
    if (st.zone === Z.LANG) { closeLanguages(false); return; }
    if (st.zone === Z.CITY) { closeCities(false); return; }
    if (st.zone === Z.KEY) { if (keyAsking) askRemoveKey(false); else closeKey(); return; }
    if (st.zone === Z.ABOUT) { closeAbout(); return; }
    if (sheetOpen()) { closeSheets(); return; }
    if (st.zone === Z.DRAWER) { closeDrawer(); return; }
    if (st.zone === Z.ACT) { st.zone = Z.CARDS; updateFocus(); return; }
    if (st.zone === Z.SEARCH || (searchMode && st.zone === Z.CARDS)) { closeSearch(); return; }
    if (st.zone !== Z.SHELF && shelf.length) { st.zone = Z.SHELF; updateFocus(); return; }
    TV.back();
  }

  /** The pointer focuses what it's over (the Magic Remote, or a mouse when previewing). */
  function hover(node, zone, index) {
    node.onmouseover = function () {
      if (saverOn || (sheetOpen() !== (zone === Z.DETAIL || zone === Z.APPS || zone === Z.SETTINGS || zone === Z.EDIT || zone === Z.LANG || zone === Z.CITY || zone === Z.KEY || zone === Z.ABOUT))) return;
      if (zone === Z.DRAWER && st.zone !== Z.DRAWER) return;
      if (zone !== Z.DRAWER && st.zone === Z.DRAWER && zone !== Z.SHELF) return;
      if (zone === Z.TOP && index < tabsN() && !Data.hasKey()) return;   // the tabs are hidden without the picks
      if (zone === Z.SHELF && st.zone === Z.DRAWER) closeDrawer();
      st.zone = zone;
      if (zone === Z.TOP) { st.top = index; if (index < tabsN()) selectTab(index); }
      else if (zone === Z.SUB) selectSub(index);
      else if (zone === Z.GENRE) selectGenre(index);
      else if (zone === Z.ACT) st.act = index;
      else if (zone === Z.CARDS) st.card = index;
      else if (zone === Z.SHELF) st.shelf = index;
      else if (zone === Z.DRAWER) st.drawer = index;
      else if (zone === Z.APPS) st.grid = index;
      else if (zone === Z.SETTINGS) st.row = index;
      else if (zone === Z.EDIT) st.edit = index;
      else if (zone === Z.LANG) st.lang = index;
      else if (zone === Z.CITY) st.city = index;
      else if (zone === Z.KEY) st.key = index;
      updateFocus();
    };
    node.onclick = function () { node.onmouseover(); activate(); };
  }

  // MARK: - Toast

  var toastTimer = 0;
  function toast(text) {
    var t = $('toast');
    t.textContent = text;
    setClass(t, 'on', true);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { setClass(t, 'on', false); }, 6000);
  }

  // MARK: - Night, clock, screensaver

  var lastNight = null;

  function checkNight() {
    var night = Data.isNight(Date.now());
    setClass(body, 'night', night);
    if (night === lastNight) return;
    lastNight = night;
    document.documentElement.style.background = night ? '#0B0B0D' : '';
    try { localStorage.setItem('fmtv.night', night ? 'true' : 'false'); } catch (e) {}   // for index.html, next start
  }

  var saverOn = false, idleAt = Date.now(), saverIndex = 0, saverTimer = 0, saverPick = null, SAVER_AFTER = 5 * 60000;

  /** "photos" (the picks' photos, as it always was) or "clock": what the screen shows when nobody touches it. */
  function saverMode() { return Prefs.saver(); }

  /** Dim, as the person picked it: off, low, medium, high, or automatic (medium from 22:00 to 07:00). */
  function dimName() {
    var v = Prefs.dim();
    return v === 'low' ? tr('dim|Low') : v === 'medium' ? tr('dim|Medium') : v === 'high' ? tr('dim|High')
      : v === 'auto' ? tr('Automatic') : tr('Off');
  }

  function dimLevel() {
    var v = Prefs.dim();
    if (v === 'auto') { var h = new Date().getHours(); return h >= 22 || h < 7 ? 2 : 0; }
    return v === 'low' ? 1 : v === 'medium' ? 2 : v === 'high' ? 3 : 0;
  }

  /** The panel's brightness is a private API: this is a black layer over the picture instead. */
  function applyDim() {
    var level = dimLevel();
    $('dim').className = 'layer' + (level ? ' d' + level : '');
  }

  /** The screensaver's photos: picks with an app on the TV. */
  function saverPhotos() {
    return Data.showcase().filter(function (p) { return p.backdrop && Data.usable(p.app); });
  }

  function showSaver() {
    var photos = saverPhotos();
    saverOn = true;
    saverPick = null;
    var s = $('saver');
    s.innerHTML = '';
    var a = el('div', 'photo', s), b = el('div', 'photo', s);
    el('div', 'shade', s);
    var clock = el('div', 'clock', s);
    el('div', 'time', clock);
    el('div', 'date', clock);
    el('div', 'title', clock);
    var hint = el('div', 'hint', clock);
    var front = a;
    function next() {
      if (!saverOn) return;
      var p = photos.length ? photos[saverIndex++ % photos.length] : null;
      var back = front === a ? b : a;
      if (p) {
        back.style.backgroundImage = 'url(' + Data.image(p.backdrop, 'original') + ')';
        back.style.webkitTransform = back.style.transform = 'scale(1.0)';
        clock.children[2].textContent = p.title;
        saverPick = p;
        // With Watch from the screensaver on, OK opens this title's app (any other key only closes).
        var target = Prefs.saverWatch() ? pickTarget(p) : null;
        hint.textContent = target ? trf('Press OK to watch on {app} · any other button to close', {app: target.app.title}) : '';
        setTimeout(function () {
          setClass(back, 'on', true);
          setClass(front, 'on', false);
          back.style.webkitTransform = back.style.transform = 'scale(1.08) translateX(-1.5%)';
          front = back;
        }, 60);
      }
      tickSaverClock(clock);
      saverTimer = setTimeout(next, 12000);
    }
    setClass(s, 'on', true);
    next();
  }

  function tickSaverClock(clock) {
    var d = new Date();
    clock.firstChild.textContent = formatDate('format|h:mm', d.getTime());
    clock.children[1].textContent = formatDate('format|EEEE, MMMM d', d.getTime());
  }

  function hideSaver() {
    saverOn = false;
    clearTimeout(saverTimer);
    setClass($('saver'), 'on', false);
  }

  // MARK: - The clock screensaver: a clock, the date and the weather, drifting slowly for OLED panels

  var ambientOn = false, ambientTimer = 0;

  function showAmbient() {
    if (ambientOn) return;
    var a = $('ambient');
    a.innerHTML = '';
    var shift = el('div', 'shift', a);
    el('div', 'clock', shift);
    el('div', 'date', shift);
    var side = el('div', 'side', shift);
    hangSpider(el('div', 'clip amb-spider', a));   // the itsy bitsy spider, hanging on the right
    el('div', 'temp', side);
    el('div', 'cond', side);
    ambientOn = true;
    setClass(a, 'on', true);
    ambientTimer = setInterval(tickAmbient, 30000);
    tickAmbient();
  }

  function tickAmbient() {
    if (!ambientOn) return;
    var a = $('ambient'), d = new Date(), w = Prefs.weather() ? Data.weather : null;
    a.querySelector('.clock').textContent = formatDate('format|h:mm', d.getTime());
    a.querySelector('.date').textContent = formatDate('format|EEEE, MMMM d', d.getTime());
    // The forecast as it is now (a new one comes every 30 minutes), and only with the weather card on, as on Android.
    a.querySelector('.temp').textContent = w ? Data.degrees(w.temp) : '';
    a.querySelector('.cond').textContent = w ? Data.condition(w.code, w.isDay) : '';
    // A clock that never moves burns into an OLED: the drift of Android's clock without photos (40 × 26 px, 10 minutes).
    var phase = 2 * Math.PI * (d.getTime() / 1000 % 600) / 600, shift = a.querySelector('.shift');
    shift.style.webkitTransform = shift.style.transform =
      'translate(' + Math.round(40 * Math.sin(phase)) + 'px,' + Math.round(26 * Math.sin(2 * phase + 0.7)) + 'px)';
  }

  function hideAmbient() {
    ambientOn = false;
    clearInterval(ambientTimer);
    setClass($('ambient'), 'on', false);
  }

  function poke(ok) {
    idleAt = Date.now();
    if (ambientOn) { hideAmbient(); return true; }
    if (!saverOn) return false;
    var target = ok && Prefs.saverWatch() ? pickTarget(saverPick) : null;
    hideSaver();
    if (target) launcher(target.app.id, target.app.title, target.params)();
    return true;
  }

  // MARK: - Keys

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (poke(k === TV.keys.ok)) { e.preventDefault(); return; }   // the first press only wakes the screen (or OK watches)
    if (typing(k)) return;
    if (k === TV.keys.left) move(-1, 0);
    else if (k === TV.keys.right) move(1, 0);
    else if (k === TV.keys.up) move(0, -1);
    else if (k === TV.keys.down) move(0, 1);
    else if (k === TV.keys.ok) activate();
    else if (k === TV.keys.back || k === 27 || k === 8) back();
    else return;
    e.preventDefault();
  });
  // Letting go of OK: the spider's spring (springHold) springs back.
  document.addEventListener('keyup', function (e) { if (e.keyCode === TV.keys.ok && spring.holding) springRelease(); });
  document.addEventListener('mousemove', function () { poke(); });
  window.addEventListener('load', alignRows);   // once the fonts are in, Explore's place is final

  /**
   * In a text field, the keys type (← → move in the text, Delete erases). OK or the keyboard's Done searches (or saves); Back,
   * its Cancel or ↑ ↓ leave the field. Samsung's keyboard sends Done as 65376 and Cancel as 65385. True: handled here.
   */
  function typing(k) {
    var sheet = st.zone === Z.CITY ? 'citypick' : st.zone === Z.KEY ? 'keypick' : st.zone === Z.SEARCH ? 'searchbar' : '';
    if (!sheet || !typingIn(sheet)) return false;
    if (k === TV.keys.ok || k === 65376) { if (st.zone === Z.CITY) searchCity(); else if (st.zone === Z.SEARCH) runSearch(); else saveKey(); }
    else if (k === TV.keys.back || k === 27 || k === 65385) { closeField(sheet); if (st.zone === Z.SEARCH) closeSearch(); updateFocus(); }
    else if (k === TV.keys.up || k === TV.keys.down) { closeField(sheet); move(0, k === TV.keys.up ? -1 : 1); }
    return true;   // anything else types into the field
  }

  // MARK: - Start

  function renderAll() {
    renderTop();
    renderQuotes();
    cards = [];
    renderCards();
    renderShelf();
    renderDrawer();
    renderClock();
    checkNight();
    if (st.zone === Z.SETTINGS) renderSettings();
    updateFocus();
  }

  /** hide_apps in config.properties: left out of the shelf, All Apps and the picks, by id or name (part of it). */
  var HIDE = (CONFIG.hideApps || []).map(function (s) { return s.toLowerCase(); });
  function hidden(app) {
    var id = (app.id || '').toLowerCase(), title = (app.title || '').toLowerCase();
    for (var i = 0; i < HIDE.length; i++) if (id.indexOf(HIDE[i]) >= 0 || title.indexOf(HIDE[i]) >= 0) return true;
    return false;
  }

  function loadApps(done) {
    TV.apps(function (list) {
      apps = list.filter(function (a) { return !hidden(a); });
      Data.setApps(apps);
      pickShelf();
      TV.inputs(function (list2) {
        inputs = list2;
        pickShelf();   // again: Live TV and the inputs join the shelf
        if (done) done();
      });
    });
  }

  /** Back to the home screen (the app was opened again): the shelf, everything closed, the first tab at its first pick. */
  /**
   * Every entry to the screen (the app opened, opened again, or come back to from another app or Live TV) starts the
   * same: Explore, All, All, no search, the shelf's first app focused, the first title's photo behind.
   */
  function reset() {
    hideSaver();
    hideAmbient();
    closeSheets();
    if (searchOpen || searchMode) closeField('searchbar');
    searchOpen = false;
    searchMode = false;
    searchText = '';
    searchStatus = '';
    st.tab = startTab();
    st.sub = 0;
    st.genre = 0;
    st.card = 0;
    st.zone = Z.SHELF;
    st.shelf = 0;
    shelfFirst = 0;
    cards = [];
    if ($('tiles')) { renderTop(); renderCards(); renderShelf(); }
    updateFocus();
    restInDrawer();   // drawer_first: out again at once, not only after the TV lists its apps
  }

  // Trakt: signs in with a code shown at the top while it isn't; signed in, the tabs become the account's.
  var traktWas = Trakt.signedIn();
  Trakt.onChange(function () {
    if (Trakt.signedIn() !== traktWas) { traktWas = Trakt.signedIn(); cards = []; st.tab = startTab(); Data.traktChanged(); }
    renderTop();
    renderCards();
    updateFocus();
  });
  if (Trakt.available() && !Trakt.signedIn()) Trakt.signIn();

  Data.onChange(function () {
    renderQuotes();
    renderCards();
    renderPanels();
    checkNight();
  });

  /** drawer_first: the home screen rests with the drawer open (shelf in the middle, inputs and weather below). */
  function restInDrawer() {
    if (!CONFIG.drawerFirst || !drawerItems.length || st.zone !== Z.SHELF) return;
    st.zone = Z.DRAWER;
    st.drawer = 0;
    updateFocus();
  }

  function reopened() {
    // LG: with handlesRelaunch the app has to come to the front itself, or opening it again while it runs shows nothing.
    if (window.PalmSystem && window.PalmSystem.activate) window.PalmSystem.activate();
    reset();
    loadApps(function () { renderTop(); renderShelf(); renderDrawer(); restInDrawer(); Data.refresh(); });
  }

  window.addEventListener('resize', fit);
  document.addEventListener('webOSRelaunch', reopened);   // LG: opened again while running
  window.addEventListener('appcontrol', reopened);        // Samsung: the same
  document.addEventListener('visibilitychange', function () {
    // Going behind another app or coming back, the screensaver goes: coming back (Back from Netflix, say, which is no
    // relaunch) shows the home screen, never a screensaver that started while the app was out of sight.
    hideSaver();
    hideAmbient();
    if (document.hidden) return;
    idleAt = Date.now();
    TV.noteChannel();   // back from the viewer: the antenna channel it played, for Live TV
    reset();   // back from another app: the same start as opening it
    loadApps(function () { renderTop(); renderShelf(); renderDrawer(); updateFocus(); Data.refresh(); });
  });

  I18N.set(Prefs.language());
  I18N.setClock(Prefs.clockFormat());
  checkNight();   // now, from the last forecast: not after the TV lists its apps, with the day look until then
  // LG's screensaver waits only when ours will show: not under a sheet (ours waits there), and not without photos.
  TV.holdScreenSaver(function () { return !sheetOpen() && (saverMode() === 'clock' || saverPhotos().length > 0); });
  fit();
  renderTop();
  applyDim();
  tickClock();
  loadApps(function () {
    st.tab = startTab();
    renderAll();
    restInDrawer();
    Data.refresh();
    // The browser preview opened as index.html?saver: the screensaver at once (a key or the mouse closes it).
    if (/[?&]saver(&|=|$)/.test(location.search)) setTimeout(function () { if (saverMode() === 'clock') showAmbient(); else showSaver(); }, 1500);
  });
  setInterval(function () {
    checkNight();
    Data.refresh();
    applyDim();   // automatic: medium from 22:00, off again at 07:00
    // Only on screen: behind another app nobody presses our keys, so idleAt grows old and the screensaver would start
    // there, turning photos every 12 s for nothing while Netflix or YouTube plays.
    if (!document.hidden && !saverOn && !ambientOn && !sheetOpen() && Date.now() - idleAt > SAVER_AFTER) {
      if (saverMode() === 'clock') showAmbient(); else showSaver();
    }
    if (saverOn) tickSaverClock($('saver').querySelector('.clock'));
    if (ambientOn) tickAmbient();
  }, 30000);

  // For the browser preview and tests.
  window.FreeMyTV = {state: st, move: move, activate: activate, back: back, showSaver: showSaver, hideSaver: hideSaver, toast: toast,
    showAmbient: showAmbient, hideAmbient: hideAmbient, applyDim: applyDim};
})();
