// Interactive 3D Solar System engine (Canvas 2D with custom perspective projection).
// Zero external dependencies; pre-renders textures & starfield once; zero per-frame allocations in hot loops.
import { S } from './db.js';
import { esc } from './ui.js';
import { motion as fxMotion } from './fx.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const SPEEDS = [0.5, 1, 5, 20];
const ORBIT_SEGS = 72;
const SHADOW_GRID = 7;
const SHADOW_STEPS = SHADOW_GRID * SHADOW_GRID; // 49 uniform phase-angle frames (3.75°/step)
const SHADOW_SZ = 96;
const SHADOW_PAD = 2;
const SHADOW_STRIDE = SHADOW_SZ + SHADOW_PAD * 2;
const MAX_REV_SATS = 12;

const reduceQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
function motionMode() {
  if (document.documentElement.dataset.motion === 'off') return 'off';
  return fxMotion();
}

// ---------- Astronomical & visual model (compressed log-ish scales for clear legibility) ----------
const SUN_DEF = {
  id: 'sun',
  isSun: true,
  name: 'Güneş',
  subtitle: 'G2V Sarı Cüce Yıldız',
  r: 24,
  color: '#ffbe4f',
  facts: [
    ['Güneşe uzaklık', 'Merkez (0 km)'],
    ['Çap', '1.392.700 km'],
    ['Bir gün', '25,4 gün (ekvator)'],
    ['Bir yıl', '~230 milyon yıl (galaktik)'],
    ['Uydu sayısı', '8 gezegen'],
  ],
  funFact: "Güneş'ten çıkan bir foton Dünya'ya 8 dakika 20 saniyede ulaşır; ancak çekirdekten yüzeye çıkması yüz binlerce yıl sürer.",
};

const PLANET_DEFS = [
  {
    id: 'mercury', name: 'Merkür', subtitle: 'Karasal Gezegen',
    a: 45, e: 0.08, incl: 5.5, node: 48, r: 3.7, omega: 0.60, spin: 0.14, tilt: 0.03, a0: 0.62,
    texW: 160, texH: 80, color: '#b4afa7',
    facts: [
      ['Güneşe uzaklık', '57,9 milyon km (0,39 AB)'],
      ['Çap', '4.879 km'],
      ['Bir gün', '58,6 Dünya günü'],
      ['Bir yıl', '88 Dünya günü'],
      ['Uydu sayısı', '0'],
    ],
    funFact: "Güneş'e en yakın gezegen olmasına rağmen çok ince atmosferi yüzünden gece sıcaklığı -180 °C'ye kadar düşer.",
  },
  {
    id: 'venus', name: 'Venüs', subtitle: 'Karasal Gezegen',
    a: 66, e: 0.01, incl: 3.0, node: 77, r: 5.5, omega: 0.40, spin: -0.08, tilt: 177.4, a0: 2.38,
    texW: 224, texH: 112, color: '#e8cd8c', atmo: 'venus',
    facts: [
      ['Güneşe uzaklık', '108,2 milyon km (0,72 AB)'],
      ['Çap', '12.104 km'],
      ['Bir gün', '243 Dünya günü (ters)'],
      ['Bir yıl', '225 Dünya günü'],
      ['Uydu sayısı', '0'],
    ],
    funFact: "Kendi ekseni etrafında ters yönde o kadar yavaş döner ki Venüs'te bir gün, bir yıldan daha uzundur.",
  },
  {
    id: 'earth', name: 'Dünya', subtitle: 'Karasal Gezegen',
    a: 91, e: 0.02, incl: 0.0, node: 0, r: 6.2, omega: 0.28, spin: 0.72, tilt: 23.4, a0: -0.82,
    texW: 256, texH: 128, color: '#58a8ff', atmo: 'earth', hasMoon: true,
    facts: [
      ['Güneşe uzaklık', '149,6 milyon km (1,00 AB)'],
      ['Çap', '12.742 km'],
      ['Bir gün', '23 sa 56 dk'],
      ['Bir yıl', '365,25 gün'],
      ['Uydu sayısı', '1 (Ay)'],
    ],
    funFact: 'Yüzeyinde sıvı su barındırdığı ve yaşamı desteklediği bilinen tek gezegendir; manyetik alanı güneş rüzgârına kalkan olur.',
  },
  {
    id: 'mars', name: 'Mars', subtitle: 'Karasal Gezegen',
    a: 119, e: 0.06, incl: 1.85, node: 49, r: 4.8, omega: 0.20, spin: 0.68, tilt: 25.2, a0: 1.48,
    texW: 224, texH: 112, color: '#d86c44',
    facts: [
      ['Güneşe uzaklık', '227,9 milyon km (1,52 AB)'],
      ['Çap', '6.779 km'],
      ['Bir gün', '24 sa 37 dk'],
      ['Bir yıl', '687 Dünya günü'],
      ['Uydu sayısı', '2 (Phobos, Deimos)'],
    ],
    funFact: "Güneş Sistemi'nin en yüksek yanardağı Olympus Mons (21,9 km) buradadır — Everest'in yaklaşık 2,5 katı.",
  },
  {
    id: 'jupiter', name: 'Jüpiter', subtitle: 'Gaz Devi',
    a: 176, e: 0.03, incl: 1.3, node: 100, r: 14.5, omega: 0.105, spin: 1.45, tilt: 3.1, a0: -2.18,
    texW: 256, texH: 128, color: '#dfb284',
    facts: [
      ['Güneşe uzaklık', '778,5 milyon km (5,20 AB)'],
      ['Çap', '139.820 km'],
      ['Bir gün', '9 sa 55 dk'],
      ['Bir yıl', '11,86 Dünya yılı'],
      ['Uydu sayısı', '95'],
    ],
    funFact: 'Diğer tüm gezegenlerin toplam kütlesinin 2,5 katından daha ağırdır; Büyük Kırmızı Leke yüzyıllardır süren dev bir fırtınadır.',
  },
  {
    id: 'saturn', name: 'Satürn', subtitle: 'Gaz Devi',
    a: 232, e: 0.03, incl: 2.45, node: 113, r: 12.0, omega: 0.068, spin: 1.30, tilt: 26.7, a0: 0.34,
    texW: 256, texH: 128, color: '#e6cf99',
    ring: { inner: 1.32, outer: 2.38, tilt: 26.7, node: 112, kind: 'saturn' },
    facts: [
      ['Güneşe uzaklık', '1,43 milyar km (9,58 AB)'],
      ['Çap', '116.460 km'],
      ['Bir gün', '10 sa 33 dk'],
      ['Bir yıl', '29,45 Dünya yılı'],
      ['Uydu sayısı', '146'],
    ],
    funFact: 'Ortalama yoğunluğu sudan düşüktür; buz ve kaya parçalarından oluşan dev halkaları yer yer yalnızca 10 metre kalınlığındadır.',
  },
  {
    id: 'uranus', name: 'Uranüs', subtitle: 'Buz Devi',
    a: 294, e: 0.03, incl: 0.8, node: 74, r: 8.4, omega: 0.044, spin: -0.95, tilt: 97.8, a0: 3.72,
    texW: 160, texH: 80, color: '#8ee2ec',
    ring: { inner: 1.44, outer: 1.98, tilt: 82.0, node: 118, kind: 'uranus' },
    facts: [
      ['Güneşe uzaklık', '2,87 milyar km (19,2 AB)'],
      ['Çap', '50.724 km'],
      ['Bir gün', '17 sa 14 dk (ters)'],
      ['Bir yıl', '84 Dünya yılı'],
      ['Uydu sayısı', '28'],
    ],
    funFact: 'Ekseni yörüngesine neredeyse yatay (98°) eğiktir; Güneş etrafında adeta yan yatmış bir varil gibi yuvarlanarak döner.',
  },
  {
    id: 'neptune', name: 'Neptün', subtitle: 'Buz Devi',
    a: 338, e: 0.01, incl: 1.75, node: 131, r: 8.2, omega: 0.030, spin: 0.98, tilt: 28.3, a0: -1.32,
    texW: 224, texH: 112, color: '#4c7dff', atmo: 'neptune',
    facts: [
      ['Güneşe uzaklık', '4,50 milyar km (30,1 AB)'],
      ['Çap', '49.244 km'],
      ['Bir gün', '16 sa 6 dk'],
      ['Bir yıl', '164,8 Dünya yılı'],
      ['Uydu sayısı', '16'],
    ],
    funFact: "Güneş Sistemi'nin en şiddetli rüzgârları buradadır — saatte 2.100 km hıza ulaşarak ses hızını aşar.",
  },
];

// ---------- Deterministic PRNG & fast 3D periodic sphere noise ----------
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 2147483647) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  const n000 = hash3(ix, iy, iz, seed);
  const n100 = hash3(ix + 1, iy, iz, seed);
  const n010 = hash3(ix, iy + 1, iz, seed);
  const n110 = hash3(ix + 1, iy + 1, iz, seed);
  const n001 = hash3(ix, iy, iz + 1, seed);
  const n101 = hash3(ix + 1, iy, iz + 1, seed);
  const n011 = hash3(ix, iy + 1, iz + 1, seed);
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  const x00 = n000 + (n100 - n000) * u;
  const x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u;
  const x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

function fbm3(x, y, z, seed, oct = 3) {
  let sum = 0, amp = 0.54, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * noise3(x * freq, y * freq, z * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return sum / norm;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Build a seamless 2*W x H offscreen canvas mapped with orthographic latitude (sy = (py/(H-1))*2 - 1)
// so vertical spherical foreshortening is baked in cleanly and horizontal spin wraps with zero seams.
function buildSphereTex(W, H, shadeFn) {
  const cv = document.createElement('canvas');
  cv.width = W * 2;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const data = img.data;
  const rgb = [0, 0, 0];
  for (let py = 0; py < H; py++) {
    const sy = ((py + 0.5) / H) * 2 - 1; // -1 (north) to +1 (south)
    const cosLat = Math.sqrt(Math.max(0, 1 - sy * sy));
    const lat = Math.asin(clamp(sy, -1, 1));
    for (let px = 0; px < W; px++) {
      const lon = (px / W) * TAU;
      const sx = Math.cos(lon) * cosLat;
      const sz = Math.sin(lon) * cosLat;
      shadeFn(sx, sy, sz, lon, lat, rgb);
      const o = (py * W + px) * 4;
      data[o] = clamp(rgb[0] | 0, 0, 255);
      data[o + 1] = clamp(rgb[1] | 0, 0, 255);
      data[o + 2] = clamp(rgb[2] | 0, 0, 255);
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.drawImage(cv, 0, 0, W, H, W, 0, W, H); // horizontal double-tile for seamless wrap
  return { cv, w: W, h: H };
}

function makeCraters(seed, count) {
  const r = makeRng(seed);
  const list = [];
  for (let i = 0; i < count; i++) {
    const z = r() * 2 - 1;
    const a = r() * TAU;
    const c = Math.sqrt(Math.max(0, 1 - z * z));
    list.push({
      x: Math.cos(a) * c,
      y: z,
      z: Math.sin(a) * c,
      rad: 0.065 + r() * r() * 0.21,
      depth: 0.55 + r() * 0.45,
    });
  }
  return list;
}

function craterProfile(sx, sy, sz, craters) {
  let delta = 0;
  for (let i = 0; i < craters.length; i++) {
    const cr = craters[i];
    const dx = sx - cr.x, dy = sy - cr.y, dz = sz - cr.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    const r2 = cr.rad * cr.rad;
    if (d2 < r2 * 1.45) {
      const d = Math.sqrt(d2) / cr.rad;
      if (d < 0.78) {
        delta -= (1 - (d / 0.78) * (d / 0.78)) * 0.28 * cr.depth;
      } else if (d < 1.18) {
        const rim = 1 - Math.abs(d - 0.94) / 0.24;
        if (rim > 0) delta += rim * 0.16 * cr.depth;
      }
    }
  }
  return delta;
}

function buildPlanetTextures() {
  const tex = {};

  // 1. Mercury: grey cratered silicate crust
  const mercCraters = makeCraters(101, 34);
  tex.mercury = buildSphereTex(160, 80, (sx, sy, sz, _lon, _lat, out) => {
    const base = fbm3(sx * 3.1, sy * 3.1, sz * 3.1, 11, 3);
    const fine = noise3(sx * 11, sy * 11, sz * 11, 19);
    const cr = craterProfile(sx, sy, sz, mercCraters);
    const v = clamp(0.46 + (base - 0.5) * 0.34 + (fine - 0.5) * 0.12 + cr, 0.16, 0.92);
    out[0] = v * 218;
    out[1] = v * 210;
    out[2] = v * 200;
  });

  // 2. Venus: pale yellow swirling sulfuric cloud deck
  tex.venus = buildSphereTex(224, 112, (sx, sy, sz, _lon, _lat, out) => {
    const warp = fbm3(sx * 2.1, sy * 3.4, sz * 2.1, 23, 3);
    const band = Math.sin(sy * 12 + warp * 4.2) * 0.5 + 0.5;
    const cloud = fbm3(sx * 3.4 + warp * 0.9, sy * 5.2, sz * 3.4 - warp * 0.9, 29, 3);
    const t = clamp(band * 0.45 + cloud * 0.55, 0, 1);
    const polar = smoothstep(0.68, 0.98, Math.abs(sy)) * 0.12;
    out[0] = lerp(208, 250, t) - polar * 28;
    out[1] = lerp(164, 232, t) - polar * 22;
    out[2] = lerp(94, 178, t) - polar * 12;
  });

  // 3. Earth: sapphire oceans, green/ochre continents, polar ice caps & wispy white clouds
  tex.earth = buildSphereTex(256, 128, (sx, sy, sz, _lon, _lat, out) => {
    const cont = fbm3(sx * 2.15 + 0.7, sy * 2.15 - 0.3, sz * 2.15 + 0.4, 37, 4);
    const detail = fbm3(sx * 6.5, sy * 6.5, sz * 6.5, 43, 3);
    const absY = Math.abs(sy);
    const ice = smoothstep(0.84, 0.95, absY + (detail - 0.5) * 0.08);
    let r, g, b;
    if (cont > 0.515) {
      // Land: lush forest -> savanna -> desert -> highlands
      const elev = clamp((cont - 0.515) / 0.28, 0, 1);
      const arid = clamp(1 - Math.abs(absY - 0.34) * 3.6, 0, 1) * smoothstep(0.38, 0.72, detail);
      r = lerp(38, 134, elev);
      g = lerp(116, 122, elev);
      b = lerp(62, 64, elev);
      r = lerp(r, 186, arid * 0.75);
      g = lerp(g, 158, arid * 0.65);
      b = lerp(b, 102, arid * 0.55);
      if (elev > 0.65) {
        const m = (elev - 0.65) / 0.35;
        r = lerp(r, 160, m * 0.6);
        g = lerp(g, 146, m * 0.55);
        b = lerp(b, 134, m * 0.55);
      }
    } else {
      // Ocean depth gradient with coastal turquoise shelf
      const coast = smoothstep(0.455, 0.515, cont);
      const deep = clamp(cont / 0.515, 0, 1);
      r = lerp(10, 26, deep) + coast * 26;
      g = lerp(42, 98, deep) + coast * 52;
      b = lerp(106, 178, deep) + coast * 28;
    }
    // Polar ice caps
    r = lerp(r, 240, ice);
    g = lerp(g, 246, ice);
    b = lerp(b, 252, ice);
    // Wispy white clouds
    const cw = fbm3(sx * 3.2 - 1.4, sy * 4.4 + 0.6, sz * 3.2 + 1.1, 53, 3);
    const cl = smoothstep(0.55, 0.78, cw + (noise3(sx * 8, sy * 9, sz * 8, 59) - 0.5) * 0.14) * 0.82;
    out[0] = lerp(r, 248, cl);
    out[1] = lerp(g, 251, cl);
    out[2] = lerp(b, 255, cl);
  });

  // Earth's Moon: crisp silver-grey cratered disc
  const moonCraters = makeCraters(202, 26);
  tex.moon = buildSphereTex(128, 64, (sx, sy, sz, _lon, _lat, out) => {
    const mare = fbm3(sx * 2.2, sy * 2.2, sz * 2.2, 61, 3);
    const cr = craterProfile(sx, sy, sz, moonCraters);
    const v = clamp(0.56 + (mare - 0.5) * 0.42 + cr, 0.22, 0.94);
    out[0] = v * 224;
    out[1] = v * 222;
    out[2] = v * 218;
  });

  // 4. Mars: iron-oxide rust reds, dark basalt plains & bright polar ice caps
  const marsCraters = makeCraters(303, 18);
  tex.mars = buildSphereTex(224, 112, (sx, sy, sz, _lon, _lat, out) => {
    const n1 = fbm3(sx * 2.6, sy * 2.6, sz * 2.6, 67, 4);
    const n2 = noise3(sx * 9.5, sy * 9.5, sz * 9.5, 71);
    const cr = craterProfile(sx, sy, sz, marsCraters) * 0.55;
    const t = clamp(n1 + (n2 - 0.5) * 0.14 + cr, 0, 1);
    const darkBasalt = smoothstep(0.32, 0.46, n1);
    let r = lerp(128, 224, t) * lerp(0.74, 1, darkBasalt);
    let g = lerp(48, 122, t) * lerp(0.72, 1, darkBasalt);
    let b = lerp(28, 72, t) * lerp(0.75, 1, darkBasalt);
    // North & south polar caps
    const cap = smoothstep(0.87, 0.95, Math.abs(sy) + (n2 - 0.5) * 0.05);
    out[0] = lerp(r, 245, cap);
    out[1] = lerp(g, 240, cap);
    out[2] = lerp(b, 234, cap);
  });

  // 5. Jupiter: rich turbulent bands + iconic Great Red Spot
  tex.jupiter = buildSphereTex(256, 128, (sx, sy, sz, lon, _lat, out) => {
    const turb = fbm3(sx * 3.8, sy * 7.5, sz * 3.8, 79, 3);
    const eddy = fbm3(sx * 7.5, sy * 12.0, sz * 7.5, 83, 2);
    const yw = sy + (turb - 0.5) * 0.085 + (eddy - 0.5) * 0.03;
    const b1 = Math.sin(yw * 21.0);
    const b2 = Math.cos(yw * 11.5 + 0.6);
    const b3 = Math.sin(yw * 35.0 + turb * 3.5);
    const zone = clamp(0.5 + b1 * 0.30 + b2 * 0.18 + b3 * 0.08, 0, 1);
    // Warm cream zones vs terracotta/ochre belts
    let r = lerp(156, 242, zone);
    let g = lerp(96, 218, zone);
    let b = lerp(64, 182, zone);
    // Equatorial darker rust belt
    const eqBelt = Math.exp(-Math.pow((yw - 0.16) / 0.11, 2)) + Math.exp(-Math.pow((yw + 0.18) / 0.10, 2));
    r = lerp(r, 178, clamp(eqBelt * 0.55, 0, 0.65));
    g = lerp(g, 92, clamp(eqBelt * 0.55, 0, 0.65));
    b = lerp(b, 56, clamp(eqBelt * 0.55, 0, 0.65));
    // Polar slate-taupe darkening
    const pol = smoothstep(0.72, 0.98, Math.abs(sy));
    r = lerp(r, 134, pol * 0.65);
    g = lerp(g, 118, pol * 0.65);
    b = lerp(b, 108, pol * 0.65);
    // Great Red Spot at south ~22° (sy ≈ 0.34, lon ≈ 1.85)
    let dl = lon - 1.85;
    if (dl > Math.PI) dl -= TAU;
    if (dl < -Math.PI) dl += TAU;
    const rx = dl / 0.34, ry = (sy - 0.33) / 0.135;
    const d2 = rx * rx + ry * ry;
    if (d2 < 1.55) {
      const d = Math.sqrt(d2);
      const collar = smoothstep(1.25, 0.92, d) * smoothstep(0.68, 0.95, d);
      r = lerp(r, 245, collar * 0.5);
      g = lerp(g, 224, collar * 0.45);
      b = lerp(b, 198, collar * 0.4);
      if (d < 1.0) {
        const core = 1 - d * d;
        const swirl = Math.sin(d * 10 - Math.atan2(ry, rx) * 2) * 0.5 + 0.5;
        r = lerp(r, lerp(196, 224, swirl), core * 0.92);
        g = lerp(g, lerp(64, 96, swirl), core * 0.92);
        b = lerp(b, lerp(40, 56, swirl), core * 0.92);
      }
    }
    out[0] = r; out[1] = g; out[2] = b;
  });

  // 6. Saturn: silky butterscotch, champagne gold & soft amber horizontal bands
  tex.saturn = buildSphereTex(256, 128, (sx, sy, sz, _lon, _lat, out) => {
    const w = fbm3(sx * 2.4, sy * 6.5, sz * 2.4, 97, 3);
    const yw = sy + (w - 0.5) * 0.04;
    const band = Math.sin(yw * 18) * 0.32 + Math.cos(yw * 9.5 - 0.5) * 0.25 + 0.5;
    const t = clamp(band + (w - 0.5) * 0.12, 0, 1);
    let r = lerp(186, 244, t);
    let g = lerp(152, 224, t);
    let b = lerp(102, 174, t);
    const pol = smoothstep(0.74, 0.99, Math.abs(sy));
    r = lerp(r, 126, pol * 0.6);
    g = lerp(g, 134, pol * 0.52);
    b = lerp(b, 132, pol * 0.42);
    out[0] = r; out[1] = g; out[2] = b;
  });

  // 7. Uranus: pale serene cyan/aquamarine ice giant with gentle atmospheric bands
  tex.uranus = buildSphereTex(160, 80, (sx, sy, sz, _lon, _lat, out) => {
    const n = fbm3(sx * 2.0, sy * 4.5, sz * 2.0, 107, 2);
    const band = Math.sin(sy * 11 + n * 1.4) * 0.14 + 0.5;
    const t = clamp(band + (n - 0.5) * 0.1, 0, 1);
    const poleBright = smoothstep(0.55, 0.96, -sy) * 0.2;
    out[0] = lerp(126, 182, t) + poleBright * 38;
    out[1] = lerp(210, 240, t) + poleBright * 14;
    out[2] = lerp(220, 246, t) + poleBright * 8;
  });

  // 8. Neptune: deep electric azure blue with bright cirrus streaks & Great Dark Spot
  tex.neptune = buildSphereTex(224, 112, (sx, sy, sz, lon, _lat, out) => {
    const n = fbm3(sx * 3.0, sy * 6.5, sz * 3.0, 113, 3);
    const band = Math.sin(sy * 15 + n * 2.4) * 0.26 + Math.cos(sy * 7) * 0.18 + 0.5;
    const t = clamp(band + (n - 0.5) * 0.16, 0, 1);
    let r = lerp(22, 64, t);
    let g = lerp(54, 126, t);
    let b = lerp(152, 232, t);
    // High-altitude pale methane cirrus streaks
    const cirrus = smoothstep(0.69, 0.84, fbm3(sx * 4.8, sy * 14.0, sz * 4.8, 127, 2));
    r = lerp(r, 178, cirrus * 0.65);
    g = lerp(g, 214, cirrus * 0.68);
    b = lerp(b, 255, cirrus * 0.72);
    // Great Dark Spot (sy ≈ 0.28, lon ≈ 4.1)
    let dl = lon - 4.1;
    if (dl > Math.PI) dl -= TAU;
    if (dl < -Math.PI) dl += TAU;
    const rx = dl / 0.30, ry = (sy - 0.28) / 0.13;
    const d2 = rx * rx + ry * ry;
    if (d2 < 1.35) {
      const d = Math.sqrt(d2);
      if (d < 1.0) {
        const core = 1 - d * d;
        r = lerp(r, 14, core * 0.78);
        g = lerp(g, 28, core * 0.78);
        b = lerp(b, 98, core * 0.72);
      } else {
        const edge = (1.35 - d2) / 0.35;
        r = lerp(r, 130, edge * 0.35);
        g = lerp(g, 182, edge * 0.35);
        b = lerp(b, 250, edge * 0.35);
      }
    }
    out[0] = r; out[1] = g; out[2] = b;
  });

  // Sun photosphere granulation texture (subtle convective cells, warm solar plasma)
  tex.sun = buildSphereTex(192, 96, (sx, sy, sz, _lon, _lat, out) => {
    const g1 = fbm3(sx * 5.6, sy * 5.6, sz * 5.6, 137, 3);
    const g2 = noise3(sx * 15, sy * 15, sz * 15, 149);
    const cell = clamp(g1 * 0.68 + g2 * 0.32, 0, 1);
    const spot = smoothstep(0.14, 0.26, g1);
    const t = clamp(0.32 + cell * 0.68 * lerp(0.76, 1, spot), 0, 1);
    out[0] = lerp(244, 255, t);
    out[1] = lerp(164, 246, t);
    out[2] = lerp(64, 200, Math.pow(t, 1.8));
  });

  return tex;
}

// 49-frame (7x7 padded grid) physically-based 3D spherical shading atlas indexed uniformly by phase angle φ ∈ [0, π].
// Smooth atmospheric-wrap Lambertian + curved elliptical terminator + spherical limb darkening + faint night side.
function buildShadowAtlas() {
  const dim = SHADOW_GRID * SHADOW_STRIDE;
  const cv = document.createElement('canvas');
  cv.width = dim;
  cv.height = dim;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(dim, dim);
  const data = img.data;
  const half = SHADOW_SZ * 0.5;
  const wrap = 0.22;
  const nightFloor = 0.04;

  for (let k = 0; k < SHADOW_STEPS; k++) {
    const phase = (k / (SHADOW_STEPS - 1)) * Math.PI; // 0 = full, π/2 = quarter, π = new/backlit
    const lz = Math.cos(phase);
    const lxy = Math.sin(phase);
    const ox = (k % SHADOW_GRID) * SHADOW_STRIDE + SHADOW_PAD;
    const oy = ((k / SHADOW_GRID) | 0) * SHADOW_STRIDE + SHADOW_PAD;

    for (let py = -1; py <= SHADOW_SZ; py++) {
      const v0 = (py + 0.5) / half - 1;
      for (let px = -1; px <= SHADOW_SZ; px++) {
        const u0 = (px + 0.5) / half - 1;
        const r2 = u0 * u0 + v0 * v0;
        if (r2 > 1.16) continue;
        // Clamp slightly outside unit disc onto the limb so bilinear filtering never bleeds alpha=0 onto the dark edge
        let u = u0, v = v0, w = 0;
        if (r2 < 1) {
          w = Math.sqrt(1 - r2);
        } else {
          const inv = 1 / Math.sqrt(r2);
          u = u0 * inv;
          v = v0 * inv;
        }
        const ndotl = u * lxy + w * lz;
        const d = clamp((ndotl + wrap) / (1 + wrap), 0, 1);
        // C1-continuous smooth diffuse curve across the entire lit dome (no flat plateau, no hard terminator band)
        const diffuse = d * d * (2.2 - 1.2 * d) * 0.45 + Math.pow(d, 1.35) * 0.55;
        // Gentle spherical limb darkening
        const limb = 0.66 + 0.34 * Math.pow(w, 0.55);
        const illum = clamp(nightFloor + (1 - nightFloor) * diffuse * limb, nightFloor, 1);
        const dark = 1 - illum;
        const o = ((oy + py) * dim + (ox + px)) * 4;
        data[o] = 2;
        data[o + 1] = 4;
        data[o + 2] = 11;
        data[o + 3] = clamp((dark * 255) | 0, 0, 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function buildRingTex(kind) {
  const S = kind === 'saturn' ? 256 : 160;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const half = S * 0.5;
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const rInner = kind === 'saturn' ? 1.32 / 2.38 : 1.44 / 1.98;
  for (let py = 0; py < S; py++) {
    const dy = (py + 0.5 - half) / half;
    for (let px = 0; px < S; px++) {
      const dx = (px + 0.5 - half) / half;
      const dist = Math.hypot(dx, dy);
      if (dist < rInner || dist > 0.995) continue;
      const t = (dist - rInner) / (0.995 - rInner); // 0 = inner edge, 1 = outer edge
      let r = 220, g = 205, b = 175, a = 0;
      if (kind === 'saturn') {
        const fine = Math.sin(t * 145) * 0.08 + Math.sin(t * 62 + 1.1) * 0.10 + Math.cos(t * 230) * 0.04;
        if (t < 0.16) {
          // Faint translucent inner C-ring
          a = smoothstep(0, 0.05, t) * (0.16 + 0.12 * (t / 0.16));
          r = 166; g = 148; b = 126;
        } else if (t < 0.62) {
          // Dense luminous B-ring
          const bt = (t - 0.16) / 0.46;
          a = clamp(0.68 + 0.24 * Math.sin(bt * Math.PI) + fine, 0.35, 0.94);
          r = lerp(218, 245, bt * 0.5 + 0.3 + fine);
          g = lerp(194, 224, bt * 0.5 + 0.3 + fine);
          b = lerp(152, 184, bt * 0.5 + 0.3 + fine);
        } else if (t < 0.69) {
          // Cassini Division (iconic dark gap)
          a = 0.04;
          r = 110; g = 98; b = 82;
        } else if (t < 0.96) {
          // Outer A-ring with subtle Encke gap
          const encke = Math.abs(t - 0.885) < 0.011 ? 0.14 : 1;
          a = clamp((0.56 - (t - 0.69) * 0.48 + fine * 0.8) * encke, 0.05, 0.72);
          r = 216; g = 198; b = 166;
        } else {
          // Faint F-ring edge taper
          a = (1 - (t - 0.96) / 0.04) * 0.22;
          r = 210; g = 196; b = 172;
        }
      } else {
        // Uranus: faint gossamer ice-cyan rings (epsilon & inner delicate bands)
        const b1 = Math.exp(-Math.pow((t - 0.84) / 0.055, 2)) * 0.34;
        const b2 = Math.exp(-Math.pow((t - 0.52) / 0.08, 2)) * 0.15;
        const b3 = Math.exp(-Math.pow((t - 0.25) / 0.07, 2)) * 0.10;
        const haze = smoothstep(0, 0.1, t) * smoothstep(1, 0.9, t) * 0.06;
        a = clamp(b1 + b2 + b3 + haze, 0, 0.42);
        r = 158; g = 228; b = 240;
      }
      const o = (py * S + px) * 4;
      d[o] = clamp(r | 0, 0, 255);
      d[o + 1] = clamp(g | 0, 0, 255);
      d[o + 2] = clamp(b | 0, 0, 255);
      d[o + 3] = clamp((a * 255) | 0, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Directional Fresnel atmosphere rim sprite (sunlit +X side brightest, soft halo around radius 0.80)
function buildAtmoSprite(rCol, gCol, bCol) {
  const S = 96;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const half = S * 0.5;
  const R = 0.78;
  for (let py = 0; py < S; py++) {
    const v = (py + 0.5) / half - 1;
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) / half - 1;
      const dist = Math.hypot(u, v);
      let rim = 0;
      if (dist <= R) {
        // Inner Fresnel scatter near planet limb
        const n = dist / R;
        rim = Math.pow(n, 4.2) * 0.72;
      } else if (dist < 0.99) {
        // Outer soft atmospheric scatter fading into space
        const t = (dist - R) / (0.99 - R);
        rim = Math.pow(1 - t, 2.3) * 0.62;
      }
      if (rim <= 0.002) continue;
      // Bias strongly toward +X (sunlit side) while preserving a delicate twilight limb
      const sunBias = smoothstep(-0.55, 0.75, u / Math.max(0.001, dist));
      const a = clamp(rim * (0.14 + 0.86 * sunBias), 0, 0.95);
      const o = (py * S + px) * 4;
      d[o] = rCol; d[o + 1] = gCol; d[o + 2] = bCol;
      d[o + 3] = (a * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function buildSunGlowSprite() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const h = S * 0.5;
  const g = ctx.createRadialGradient(h, h, h * 0.16, h, h, h);
  g.addColorStop(0.00, 'rgba(255, 248, 224, 0.90)');
  g.addColorStop(0.18, 'rgba(255, 214, 128, 0.56)');
  g.addColorStop(0.36, 'rgba(255, 162, 64, 0.24)');
  g.addColorStop(0.58, 'rgba(235, 110, 32, 0.085)');
  g.addColorStop(0.80, 'rgba(195, 72, 18, 0.022)');
  g.addColorStop(1.00, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return cv;
}

// Ultra-smooth feathered corona halo with gentle radial streamers (zero jagged edges)
function buildSunCoronaSprite() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const half = S * 0.5;
  for (let py = 0; py < S; py++) {
    const v = (py + 0.5) / half - 1;
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) / half - 1;
      const r = Math.hypot(u, v);
      if (r >= 0.995) continue;
      const ang = Math.atan2(v, u);
      // Soft broad azimuthal coronal radiance (low-frequency smooth cosines only)
      const stream = 0.5
        + 0.24 * Math.cos(ang * 2 + 0.4)
        + 0.16 * Math.cos(ang * 3 - 1.1)
        + 0.10 * Math.cos(ang * 5 + 2.2);
      const decay = 0.22 + 0.12 * stream;
      const radial = r < 0.22 ? 1 : Math.exp(-Math.pow((r - 0.22) / decay, 1.55));
      const edgeFade = smoothstep(0.99, 0.68, r);
      const a = clamp(radial * edgeFade * (0.48 + 0.36 * stream), 0, 0.85);
      const warm = clamp((r - 0.20) / 0.55, 0, 1);
      const o = (py * S + px) * 4;
      d[o] = 255;
      d[o + 1] = lerp(236, 152, warm) | 0;
      d[o + 2] = lerp(176, 54, warm) | 0;
      d[o + 3] = (a * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Smooth Eddington solar limb darkening overlay for a clean spherical photosphere
function buildSunLimbSprite() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  const half = S * 0.5;
  for (let py = 0; py < S; py++) {
    const v = (py + 0.5) / half - 1;
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) / half - 1;
      const r2 = u * u + v * v;
      if (r2 > 1.08) continue;
      const mu = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
      const limb = Math.pow(1 - mu, 1.55);
      const o = (py * S + px) * 4;
      d[o] = 196;
      d[o + 1] = 66;
      d[o + 2] = 10;
      d[o + 3] = clamp((limb * 0.72 * 255) | 0, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function buildSoftAuraSprite() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const h = S * 0.5;
  const g = ctx.createRadialGradient(h, h, h * 0.16, h, h, h);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return cv;
}

// Pre-rendered seamless panoramic starfield with faint diagonal Milky Way band
function buildStarfield() {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // Deep cosmic void base
  ctx.fillStyle = '#010205';
  ctx.fillRect(0, 0, W, H);

  // Subtle Milky Way galactic band (wraps horizontally seamlessly via sinusoidal path!)
  const rng = makeRng(9001);
  for (let i = 0; i < 42; i++) {
    const u = i / 42;
    const x = u * W;
    const y = H * 0.5 + Math.sin(u * TAU + 0.5) * H * 0.24 + (rng() - 0.5) * 34;
    const rad = 68 + rng() * 96;
    const tint = i % 3 === 0 ? [124, 152, 224] : i % 3 === 1 ? [168, 154, 212] : [192, 174, 156];
    const alpha = 0.022 + rng() * 0.026;
    // Draw wrapped copies at x-W, x, x+W so horizontal seam is 100% invisible
    for (let dx = -W; dx <= W; dx += W) {
      if (x + dx + rad < 0 || x + dx - rad > W) continue;
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      g.addColorStop(0, `rgba(${tint[0]},${tint[1]},${tint[2]},${alpha.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(${tint[0]},${tint[1]},${tint[2]},${(alpha * 0.35).toFixed(3)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y, rad, 0, TAU);
      ctx.fill();
    }
  }
  // Faint dark dust lane down the center of the Milky Way
  for (let i = 0; i < 24; i++) {
    const u = (i + 0.5) / 24;
    const x = u * W;
    const y = H * 0.5 + Math.sin(u * TAU + 0.5) * H * 0.24 + (rng() - 0.5) * 14;
    const rad = 26 + rng() * 34;
    for (let dx = -W; dx <= W; dx += W) {
      if (x + dx + rad < 0 || x + dx - rad > W) continue;
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      g.addColorStop(0, 'rgba(1,2,6,0.22)');
      g.addColorStop(1, 'rgba(1,2,6,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y, rad, 0, TAU);
      ctx.fill();
    }
  }

  // Dense unresolved star dust along the Milky Way + deep background field stars
  const starCols = ['#ffffff', '#dce9ff', '#fff3dc', '#c4d8ff', '#ffe2c2'];
  for (let i = 0; i < 680; i++) {
    const inBand = i < 290;
    const u = rng();
    const x = u * W;
    let y;
    if (inBand) {
      const bandY = H * 0.5 + Math.sin(u * TAU + 0.5) * H * 0.24;
      const spread = (rng() + rng() + rng() - 1.5) * 62;
      y = clamp(bandY + spread, 2, H - 2);
    } else {
      y = rng() * H;
    }
    const mag = rng();
    const r = inBand ? (0.35 + mag * mag * 0.85) : (0.4 + mag * mag * 1.15);
    ctx.fillStyle = starCols[(rng() * starCols.length) | 0];
    ctx.globalAlpha = inBand ? (0.16 + mag * 0.52) : (0.18 + mag * 0.68);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return cv;
}

let ASSETS = null;
function getAssets() {
  if (ASSETS) return ASSETS;
  ASSETS = {
    tex: buildPlanetTextures(),
    shadow: buildShadowAtlas(),
    rings: {
      saturn: buildRingTex('saturn'),
      uranus: buildRingTex('uranus'),
    },
    atmo: {
      earth: buildAtmoSprite(94, 196, 255),
      venus: buildAtmoSprite(248, 214, 134),
      neptune: buildAtmoSprite(84, 142, 255),
    },
    sunGlow: buildSunGlowSprite(),
    sunCorona: buildSunCoronaSprite(),
    sunLimb: buildSunLimbSprite(),
    aura: buildSoftAuraSprite(),
    sky: buildStarfield(),
    coloredAuras: new Map(),
  };
  return ASSETS;
}

// Cache tinted radial aura sprites by hex color (at most ~10 colors total, zero per-frame allocs!)
function getColoredAura(color) {
  const assets = getAssets();
  const key = color || '#f4f4f5';
  let cv = assets.coloredAuras.get(key);
  if (cv) return cv;
  const S = 128;
  cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const h = S * 0.5;
  ctx.fillStyle = key;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(assets.aura, 0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
  assets.coloredAuras.set(key, cv);
  return cv;
}

// ---------- 3D geometry helpers (zero allocations) ----------
function makeRingBasis(tiltDeg, nodeDeg) {
  const ob = tiltDeg * DEG;
  const psi = nodeDeg * DEG;
  const so = Math.sin(ob), co = Math.cos(ob);
  const sp = Math.sin(psi), cp = Math.cos(psi);
  // Start with u0=(1,0,0), v0=(0,so,co), n0=(0,co,-so), then rotate around Y by psi
  return {
    ux: cp,          uy: 0,   uz: -sp,
    vx: co * sp,     vy: so,  vz: co * cp,
    nx: -so * sp,    ny: co,  nz: -so * cp,
  };
}

function makeAxisVec(tiltDeg, nodeDeg) {
  const ob = tiltDeg * DEG;
  const psi = nodeDeg * DEG;
  const so = Math.sin(ob), co = Math.cos(ob);
  return { x: -so * Math.sin(psi), y: co, z: -so * Math.cos(psi) };
}

function orbitPoint3D(def, theta, out) {
  const b = def.a * Math.sqrt(1 - def.e * def.e);
  const xo = def.a * (Math.cos(theta) - def.e);
  const zo = b * Math.sin(theta);
  const inc = def.incl * DEG;
  const y1 = zo * Math.sin(inc);
  const z1 = zo * Math.cos(inc);
  const om = def.node * DEG;
  const co = Math.cos(om), so = Math.sin(om);
  out[0] = xo * co + z1 * so;
  out[1] = y1;
  out[2] = -xo * so + z1 * co;
}

function precomputeOrbit(def) {
  const arr = new Float32Array(ORBIT_SEGS * 3);
  const tmp = [0, 0, 0];
  for (let i = 0; i < ORBIT_SEGS; i++) {
    orbitPoint3D(def, (i / ORBIT_SEGS) * TAU, tmp);
    arr[i * 3] = tmp[0];
    arr[i * 3 + 1] = tmp[1];
    arr[i * 3 + 2] = tmp[2];
  }
  return arr;
}

// Read-only course assignment snapshot from db.js S
function buildCourseMap() {
  const courses = Array.isArray(S?.courses) ? S.courses : [];
  const problems = Array.isArray(S?.problems) ? S.problems : [];
  const map = new Array(PLANET_DEFS.length).fill(null);
  const count = Math.min(courses.length, PLANET_DEFS.length);
  for (let i = 0; i < count; i++) {
    const c = courses[i];
    if (!c) continue;
    let total = 0, solved = 0, review = 0, open = 0;
    for (let j = 0; j < problems.length; j++) {
      const p = problems[j];
      if (p.course !== c.id) continue;
      total++;
      if (p.status === 'solved') solved++;
      else if (p.status === 'review') review++;
      else open++;
    }
    map[i] = {
      course: c,
      total,
      solved,
      review,
      open,
      ratio: total > 0 ? solved / total : 0,
    };
  }
  return map;
}

// ---------- UI SVG micro-icons (self-contained, matches .i stroke style) ----------
const ICONS = {
  play: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
  pause: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14"/><path d="M16 5v14"/></svg>',
  reset: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/></svg>',
  book: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h14"/></svg>',
  back: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  minus: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
};

// =====================================================================
// Main entry point: mountSolar(canvasContainer, options) -> cleanup
// =====================================================================
export function mountSolar(container, options = {}) {
  if (!container) return () => {};
  const preview = !!options.preview;
  const assets = getAssets();
  const maxDpr = preview ? 1 : 2;
  const astCount = preview ? 85 : 320;
  const twCount = preview ? 18 : 54;
  const previewInterval = 42; // ~24 fps cap for dashboard preview

  // Build DOM inside container
  container.textContent = '';
  const stage = document.createElement('div');
  stage.className = preview ? 'solar-preview-stage' : 'solar-stage';

  const cv = document.createElement('canvas');
  cv.className = preview ? 'solar-canvas solar-preview-cv' : 'solar-canvas';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', preview ? 'Güneş Sistemi canlı önizleme' : 'Etkileşimli 3B Güneş Sistemi');
  stage.append(cv);

  // Full-page HUD & Info Panel
  let hudEl = null, infoEl = null, hintEl = null;
  let playBtn = null, coursesBtn = null, resetBtn = null, speedBtns = [];
  if (!preview) {
    hudEl = document.createElement('div');
    hudEl.className = 'solar-hud';
    hudEl.innerHTML = `
      <div class="solar-top">
        <div class="solar-head">
          <p class="eyebrow">Evren Gözlemevi</p>
          <h1>Güneş Sistemi</h1>
        </div>
        <div class="solar-top-acts">
          <button type="button" class="solar-pill" data-solar-courses aria-pressed="false" aria-label="Derslerim modunu aç veya kapat">
            ${ICONS.book}<span>Derslerim</span>
          </button>
          <button type="button" class="solar-pill solar-icon-pill" data-solar-reset title="Görünümü sıfırla (R)" aria-label="Görünümü sıfırla">
            ${ICONS.reset}<span class="solar-hide-xs">Sıfırla</span>
          </button>
        </div>
      </div>
      <div class="solar-bottom">
        <div class="solar-bar" role="toolbar" aria-label="Zaman ve kamera kontrolleri">
          <button type="button" class="solar-ctl" data-solar-play aria-label="Duraklat" aria-pressed="false">${ICONS.pause}</button>
          <div class="solar-speeds" role="group" aria-label="Zaman hızı">
            ${SPEEDS.map(sp => `<button type="button" class="solar-sp ${sp === 1 ? 'on' : ''}" data-solar-speed="${sp}" aria-label="${sp} kat hız" aria-pressed="${sp === 1}">${sp}x</button>`).join('')}
          </div>
          <span class="solar-sep" aria-hidden="true"></span>
          <button type="button" class="solar-ctl" data-solar-zoom="out" aria-label="Uzaklaştır">${ICONS.minus}</button>
          <button type="button" class="solar-ctl" data-solar-zoom="in" aria-label="Yakınlaştır">${ICONS.plus}</button>
        </div>
        <p class="solar-note">Ölçek: uzaklık ve boyutlar görünürlük için sıkıştırılmıştır</p>
      </div>
      <p class="solar-hint" aria-hidden="true">Sürükle: döndür · Yakınlaştır · Gezegene dokun</p>`;
    stage.append(hudEl);

    infoEl = document.createElement('aside');
    infoEl.className = 'solar-info';
    infoEl.setAttribute('aria-label', 'Gezegen bilgileri');
    infoEl.hidden = true;
    stage.append(infoEl);

    playBtn = hudEl.querySelector('[data-solar-play]');
    coursesBtn = hudEl.querySelector('[data-solar-courses]');
    resetBtn = hudEl.querySelector('[data-solar-reset]');
    speedBtns = [...hudEl.querySelectorAll('[data-solar-speed]')];
    hintEl = hudEl.querySelector('.solar-hint');
  }

  container.append(stage);

  const ctx = cv.getContext('2d', { alpha: false });
  let W = 1, H = 1, dpr = 1;
  let accentHex = '#f4f4f5';
  const readAccent = () => {
    accentHex = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#f4f4f5';
  };
  readAccent();

  // ---------- Pre-allocated simulation structures (zero per-frame heap allocations) ----------
  const allDefs = [SUN_DEF, ...PLANET_DEFS];
  const orbits3D = PLANET_DEFS.map(precomputeOrbit);
  const ringBases = PLANET_DEFS.map(d => (d.ring ? makeRingBasis(d.ring.tilt, d.ring.node) : null));
  const axes3D = PLANET_DEFS.map((d, i) => (
    ringBases[i]
      ? { x: ringBases[i].nx, y: ringBases[i].ny, z: ringBases[i].nz }
      : makeAxisVec(d.tilt > 90 ? 180 - d.tilt : d.tilt, d.node + 22)
  ));
  const projX = new Float32Array(ORBIT_SEGS);
  const projY = new Float32Array(ORBIT_SEGS);
  const projOk = new Uint8Array(ORBIT_SEGS);

  const bodies = allDefs.map((def, idx) => ({
    idx, // 0 = Sun, 1..8 = Mercury..Neptune
    pIdx: idx - 1,
    def,
    wx: 0, wy: 0, wz: 0,
    sx: 0, sy: 0, depth: 0, scale: 1, screenR: 0,
    lx: 0, ly: 0, lz: 1,
    orbAngle: def.a0 || 0,
    rot: (idx * 1.17) % TAU,
    visible: false,
    lblX: 0, lblY: 0, lblW: 0, lblH: 0, lblShown: false,
  }));

  const moonState = {
    angle: 0.7,
    wx: 0, wy: 0, wz: 0,
    sx: 0, sy: 0, depth: 0, scale: 1, screenR: 0,
    lx: 0, ly: 0, lz: 1,
    visible: false,
  };

  // Pre-allocated pool for Derslerim review satellites
  const revSats = Array.from({ length: MAX_REV_SATS }, () => ({
    sx: 0, sy: 0, depth: 0, screenR: 0, visible: false,
  }));

  // Pre-allocated asteroid belt typed arrays (between Mars 119 and Jupiter 176)
  const astR = new Float32Array(astCount);
  const astAng = new Float32Array(astCount);
  const astY = new Float32Array(astCount);
  const astSpd = new Float32Array(astCount);
  const astSz = new Float32Array(astCount);
  const astBri = new Float32Array(astCount);
  const astSX = new Float32Array(astCount);
  const astSY = new Float32Array(astCount);
  const astD = new Float32Array(astCount);
  const astVis = new Uint8Array(astCount);
  {
    const rng = makeRng(4242);
    for (let i = 0; i < astCount; i++) {
      const u = (rng() + rng()) * 0.5; // bell-shaped concentration in middle of belt
      astR[i] = 133 + u * 21;
      astAng[i] = rng() * TAU;
      astY[i] = (rng() - 0.5) * 9.5;
      astSpd[i] = (0.125 + (1 - u) * 0.045) * (0.9 + rng() * 0.2);
      astSz[i] = 0.65 + rng() * rng() * 1.35;
      astBri[i] = 0.30 + rng() * 0.52;
    }
  }

  // Pre-allocated foreground twinkle stars on sky dome
  const twU = new Float32Array(twCount);
  const twV = new Float32Array(twCount);
  const twR = new Float32Array(twCount);
  const twPh = new Float32Array(twCount);
  const twSp = new Float32Array(twCount);
  const twCol = new Uint8Array(twCount);
  const TW_COLS = ['#ffffff', '#d8e8ff', '#fff0d6', '#b8d4ff'];
  {
    const rng = makeRng(7717);
    for (let i = 0; i < twCount; i++) {
      twU[i] = rng();
      twV[i] = rng();
      twR[i] = 0.85 + rng() * rng() * 1.45;
      twPh[i] = rng() * TAU;
      twSp[i] = 1.2 + rng() * 2.4;
      twCol[i] = (rng() * TW_COLS.length) | 0;
    }
  }

  // Occasional comet state (active only in full motion & non-preview)
  const comet = {
    active: false,
    cooldown: 5.5,
    t: 0,
    duration: 24,
    node: 0.9,
    incl: 0.36,
    wx: 0, wy: 0, wz: 0,
    vx: 0, vy: 0, vz: 0,
    sx: 0, sy: 0, depth: 0, scale: 1,
    alpha: 0,
    visible: false,
  };

  // Painter draw order indices: 0..8 = Sun + 8 planets, 9 = comet
  const drawOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const drawDepth = new Float32Array(10);

  // Scratch buffers for projection & vectors
  const tmp3 = [0, 0, 0];
  const projOut = { sx: 0, sy: 0, depth: 0, scale: 0, ok: false };
  const rotOut = { x: 0, y: 0, z: 0 };
  const labelBoxes = Array.from({ length: 9 }, () => ({ x0: 0, y0: 0, x1: 0, y1: 0 }));

  // ---------- Camera & interaction state ----------
  const DEF_YAW = preview ? 0.35 : 0.42;
  const DEF_PITCH = preview ? 0.44 : 0.48;
  const DEF_DIST = preview ? 590 : 620;
  const MIN_DIST_OVERVIEW = 140;
  const MAX_DIST = 1280;

  let yaw = DEF_YAW;
  let pitch = DEF_PITCH;
  let dist = DEF_DIST;
  let targetDist = DEF_DIST;
  let velYaw = 0;
  let velPitch = 0;
  let camTx = 0, camTy = 0, camTz = 0; // current camera target in world space
  let shiftPxX = 0, shiftPxY = 0;      // current viewport center shift (px) when info panel is open
  let goalShiftPxX = 0, goalShiftPxY = 0;
  let availW = 600, availH = 600;

  // Time-based smooth fly-to transition state (real elapsed ms, frame-rate independent)
  let flying = false;
  let flyStartMs = 0;
  const FLY_DUR_MS = 1200;
  let flyStartTx = 0, flyStartTy = 0, flyStartTz = 0;
  let flyStartDist = DEF_DIST, flyGoalDist = DEF_DIST;
  let flyStartPitch = DEF_PITCH, flyGoalPitch = DEF_PITCH;
  let flyStartShiftX = 0, flyStartShiftY = 0;
  let flyResetYaw = false, flyStartYaw = DEF_YAW, flyDeltaYaw = 0;

  let focusIdx = -1; // -1 = overview, 0 = Sun, 1..8 = planet
  let hoverIdx = -1;
  let paused = false;
  let speed = 1;
  let coursesMode = false;
  let courseMap = buildCourseMap();
  let simTime = 0;
  let wallTime = 0;
  let lastFrameMs = 0;
  let lastPreviewDrawMs = 0;
  let hintHidden = false;

  // Cached camera trig, world position & up vector per frame
  let cosYaw = 1, sinYaw = 0, cosPitch = 1, sinPitch = 0, focal = 400, cx = 0, cy = 0;
  let camWx = 0, camWy = 0, camWz = DEF_DIST;
  let camUpx = 0, camUpy = 1, camUpz = 0;

  function updateCamBasis() {
    cosYaw = Math.cos(yaw);
    sinYaw = Math.sin(yaw);
    cosPitch = Math.cos(pitch);
    sinPitch = Math.sin(pitch);
    focal = preview
      ? Math.min(W * 0.88, H * 1.72) * 0.96
      : Math.min(W, H * 1.14) * 0.94;
    cx = W * 0.5 + shiftPxX;
    cy = H * 0.5 + shiftPxY;
    camWx = camTx + dist * cosPitch * sinYaw;
    camWy = camTy + dist * sinPitch;
    camWz = camTz + dist * cosPitch * cosYaw;
    camUpx = -sinPitch * sinYaw;
    camUpy = cosPitch;
    camUpz = -sinPitch * cosYaw;
  }

  function measurePanelFraming() {
    if (preview || !infoEl || infoEl.hidden || focusIdx < 0) {
      goalShiftPxX = 0;
      goalShiftPxY = 0;
      availW = W;
      availH = H;
      return;
    }
    const sr = stage.getBoundingClientRect();
    const sw = sr.width || W;
    const sh = sr.height || H;
    const pr = infoEl.getBoundingClientRect();
    const pW = pr.width || infoEl.offsetWidth;
    const pH = pr.height || infoEl.offsetHeight;
    if (!(pW > 0 && pH > 0 && sw > 0 && sh > 0)) {
      goalShiftPxX = 0;
      goalShiftPxY = 0;
      availW = sw;
      availH = sh;
      return;
    }
    // Use resting offset within stage so the slide-in CSS transform never biases the target center
    const pLeft = infoEl.offsetParent === stage ? infoEl.offsetLeft : (pr.left - sr.left);
    const pTop = infoEl.offsetParent === stage ? infoEl.offsetTop : (pr.top - sr.top);
    const isBottomSheet = pW > sw * 0.62 && pTop > sh * 0.20;

    if (isBottomSheet) {
      const topBar = hudEl?.querySelector('.solar-top');
      const topRect = topBar ? topBar.getBoundingClientRect() : null;
      const visTop = topRect && topRect.height > 0 ? Math.max(0, topRect.bottom - sr.top + 6) : 0;
      const visBottom = Math.max(visTop + 44, pTop - 6);
      availW = sw;
      availH = Math.max(60, visBottom - visTop);
      goalShiftPxX = 0;
      goalShiftPxY = (visTop + visBottom) * 0.5 - sh * 0.5;
    } else {
      const visRight = Math.max(120, pLeft - 8);
      availW = visRight;
      availH = sh;
      goalShiftPxX = visRight * 0.5 - sw * 0.5;
      goalShiftPxY = 0;
    }
  }

  function camRotateVec(vx, vy, vz, out) {
    const x1 = vx * cosYaw - vz * sinYaw;
    const z1 = vx * sinYaw + vz * cosYaw;
    out.x = x1;
    out.y = vy * cosPitch - z1 * sinPitch;
    out.z = vy * sinPitch + z1 * cosPitch;
  }

  function projectPoint(wx, wy, wz, out) {
    const dx = wx - camTx;
    const dy = wy - camTy;
    const dz = wz - camTz;
    const x1 = dx * cosYaw - dz * sinYaw;
    const z1 = dx * sinYaw + dz * cosYaw;
    const yc = dy * cosPitch - z1 * sinPitch;
    const zc = dy * sinPitch + z1 * cosPitch;
    const depth = dist - zc;
    if (depth <= 4) {
      out.ok = false;
      out.depth = depth;
      return false;
    }
    const s = focal / depth;
    out.sx = cx + x1 * s;
    out.sy = cy - yc * s;
    out.depth = depth;
    out.scale = s;
    out.ok = true;
    return true;
  }

  function getMinDist() {
    if (focusIdx < 0) return MIN_DIST_OVERVIEW;
    const b = bodies[focusIdx];
    return b.def.isSun ? 64 : Math.max(18, b.def.r * 2.5);
  }

  function focusDistFor(idx) {
    const b = bodies[idx];
    const baseDist = b.def.isSun
      ? 145
      : b.def.ring
        ? b.def.r * 8.2
        : clamp(b.def.r * 6.4, 34, 108);
    if (preview) return baseDist;
    const curFocal = Math.min(W, H * 1.14) * 0.94;
    const outerWorldR = b.def.ring ? b.def.r * (b.def.ring.outer * 0.85) : b.def.r * 1.18;
    const fitR = Math.max(46, Math.min(availW, availH) * 0.36);
    const minFitDist = (outerWorldR * curFocal) / fitR;
    return clamp(Math.max(baseDist, minFitDist), getMinDist(), MAX_DIST);
  }

  function saturnFocusPitch(targetYaw, curPitch) {
    const basis = ringBases[5];
    if (!basis) return clamp(curPitch, -0.85, 0.85);
    const A = basis.nx * Math.sin(targetYaw) + basis.nz * Math.cos(targetYaw);
    const B = basis.ny;
    const rab = Math.hypot(A, B) || 1;
    const curSin = A * Math.cos(curPitch) + B * Math.sin(curPitch);
    const absSin = Math.abs(curSin);
    if (absSin >= Math.sin(20 * DEG) && absSin <= Math.sin(27 * DEG)) {
      return clamp(curPitch, -1.15, 1.15);
    }
    const side = curSin < -0.12 ? -1 : 1;
    const wantSin = side * Math.sin(24 * DEG);
    const delta = Math.atan2(A, B);
    return clamp(Math.asin(clamp(wantSin / rab, -0.96, 0.96)) - delta, -1.15, 1.15);
  }

  function hideHint() {
    if (hintHidden || !hintEl) return;
    hintHidden = true;
    hintEl.classList.add('out');
  }

  // ---------- Info panel HTML (accessible, real text) ----------
  function renderInfoPanel() {
    if (!infoEl) return;
    if (focusIdx < 0) {
      infoEl.hidden = true;
      infoEl.classList.remove('open');
      return;
    }
    const b = bodies[focusIdx];
    const def = b.def;
    const cInfo = coursesMode && b.pIdx >= 0 ? courseMap[b.pIdx] : null;
    const pct = cInfo && cInfo.total ? Math.round(cInfo.ratio * 100) : 0;

    let courseBlock = '';
    if (coursesMode && b.pIdx >= 0) {
      if (cInfo) {
        const c = cInfo.course;
        courseBlock = `
          <div class="solar-course-box" style="--cc:${esc(c.color || '#f4f4f5')}">
            <div class="solar-course-top">
              <i class="cglyph" style="--cc:${esc(c.color || '#f4f4f5')}" aria-hidden="true">${esc(c.icon || '•')}</i>
              <div class="solar-course-meta">
                <strong>${esc(c.name)}</strong>
                <span class="mono small">${cInfo.solved}/${cInfo.total} çözüldü · %${pct}${cInfo.review ? ` · ${cInfo.review} tekrar` : ''}</span>
              </div>
            </div>
            <div class="progress"><i style="width:${pct}%"></i></div>
            <a class="btn primary small wide solar-open-course" href="#/c/${esc(c.id)}">Dersi aç →</a>
          </div>`;
      } else {
        courseBlock = `<p class="solar-no-course small">Bu gezegene atanmış ders yok.</p>`;
      }
    }

    const heading = cInfo ? esc(cInfo.course.name) : esc(def.name);
    const sub = cInfo ? `${esc(def.name)} · ${esc(def.subtitle)}` : esc(def.subtitle);

    infoEl.innerHTML = `
      <div class="solar-info-head">
        <button type="button" class="solar-back" data-solar-back aria-label="Tüm sisteme dön">
          ${ICONS.back}<span>Tüm sistem</span>
        </button>
        <button type="button" class="solar-x" data-solar-back aria-label="Bilgi panelini kapat">${ICONS.x}</button>
      </div>
      <div class="solar-info-title">
        <span class="solar-swatch" style="--pc:${esc(cInfo ? (cInfo.course.color || def.color) : def.color)}" aria-hidden="true"></span>
        <div>
          <h2>${heading}</h2>
          <p class="solar-info-sub">${sub}</p>
        </div>
      </div>
      ${courseBlock}
      <dl class="solar-facts">
        ${def.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}
      </dl>
      <div class="solar-fun">
        <span class="solar-fun-lbl">Biliyor muydun?</span>
        <p>${esc(def.funFact)}</p>
      </div>
      <div class="solar-info-nav">
        <button type="button" class="solar-nav-btn" data-solar-step="-1" aria-label="Önceki gök cismi">${ICONS.back} Önceki</button>
        <button type="button" class="solar-nav-btn" data-solar-step="1" aria-label="Sonraki gök cismi">Sonraki ${ICONS.next}</button>
      </div>`;
    infoEl.hidden = false;
    measurePanelFraming();
    requestAnimationFrame(() => {
      if (!destroyed && focusIdx >= 0) {
        infoEl.classList.add('open');
        measurePanelFraming();
        if (motionMode() !== 'full') {
          shiftPxX = goalShiftPxX;
          shiftPxY = goalShiftPxY;
          drawFrame();
        }
      }
    });
  }

  function startFlyTo(idx, resetYaw = false) {
    focusIdx = idx;
    velYaw = 0;
    velPitch = 0;
    renderInfoPanel();
    measurePanelFraming();
    const goalDist = idx >= 0 ? focusDistFor(idx) : DEF_DIST;
    const goalPitch = idx < 0
      ? DEF_PITCH
      : bodies[idx].def.id === 'saturn'
        ? saturnFocusPitch(yaw, pitch)
        : clamp(pitch, -0.85, 0.85);
    targetDist = goalDist;

    if (motionMode() !== 'full') {
      // Jump immediately in reduced / off motion
      flying = false;
      if (idx >= 0) {
        const b = bodies[idx];
        camTx = b.wx; camTy = b.wy; camTz = b.wz;
      } else {
        camTx = 0; camTy = 0; camTz = 0;
        if (resetYaw) yaw = DEF_YAW;
      }
      dist = goalDist;
      pitch = goalPitch;
      shiftPxX = goalShiftPxX;
      shiftPxY = goalShiftPxY;
      drawFrame();
      return;
    }

    flying = true;
    flyStartMs = performance.now();
    flyStartTx = camTx;
    flyStartTy = camTy;
    flyStartTz = camTz;
    flyStartDist = dist;
    flyGoalDist = goalDist;
    flyStartPitch = pitch;
    flyGoalPitch = goalPitch;
    flyStartShiftX = shiftPxX;
    flyStartShiftY = shiftPxY;
    flyResetYaw = resetYaw;
    flyStartYaw = yaw;
    flyDeltaYaw = resetYaw ? ((((DEF_YAW - yaw + Math.PI) % TAU) + TAU) % TAU - Math.PI) : 0;
  }

  function resetCamera() {
    hideHint();
    startFlyTo(-1, true);
  }

  // ---------- Simulation step (planets, Moon, asteroids, comet, camera) ----------
  function updateBodyPositions() {
    // Sun at origin
    bodies[0].wx = 0; bodies[0].wy = 0; bodies[0].wz = 0;
    for (let i = 0; i < PLANET_DEFS.length; i++) {
      const b = bodies[i + 1];
      orbitPoint3D(PLANET_DEFS[i], b.orbAngle, tmp3);
      b.wx = tmp3[0]; b.wy = tmp3[1]; b.wz = tmp3[2];
    }
    // Earth's Moon
    const earth = bodies[3];
    const ma = moonState.angle;
    const mR = 11.8;
    const mInc = 6.5 * DEG;
    const mz = Math.sin(ma) * mR;
    moonState.wx = earth.wx + Math.cos(ma) * mR;
    moonState.wy = earth.wy + mz * Math.sin(mInc);
    moonState.wz = earth.wz + mz * Math.cos(mInc);
  }

  function updateComet(dt, fullMotion) {
    if (!fullMotion || preview) {
      comet.active = false;
      comet.visible = false;
      return;
    }
    if (!comet.active) {
      comet.cooldown -= dt;
      if (comet.cooldown <= 0) {
        comet.active = true;
        comet.t = 0;
        comet.duration = 22 + (Math.sin(wallTime * 1.7) * 0.5 + 0.5) * 6;
        comet.node = ((wallTime * 0.73) % TAU);
        comet.incl = (0.24 + ((wallTime * 0.31) % 0.34)) * (Math.sin(wallTime) > 0 ? 1 : -1);
      }
      return;
    }
    comet.t += dt;
    const u = comet.t / comet.duration;
    if (u >= 1) {
      comet.active = false;
      comet.visible = false;
      comet.cooldown = 12 + (Math.cos(wallTime * 0.9) * 0.5 + 0.5) * 10;
      return;
    }
    // Sweep anomaly from -2.15 to +2.15 around perihelion
    const ang = lerp(-2.15, 2.15, u);
    const a = 215, e = 0.79, b = a * Math.sqrt(1 - e * e);
    const xo = a * (Math.cos(ang) - e);
    const zo = b * Math.sin(ang);
    const si = Math.sin(comet.incl), ci = Math.cos(comet.incl);
    const y1 = zo * si, z1 = zo * ci;
    const cn = Math.cos(comet.node), sn = Math.sin(comet.node);
    const nx = xo * cn + z1 * sn;
    const ny = y1;
    const nz = -xo * sn + z1 * cn;
    comet.vx = nx - comet.wx;
    comet.vy = ny - comet.wy;
    comet.vz = nz - comet.wz;
    comet.wx = nx; comet.wy = ny; comet.wz = nz;
    comet.alpha = smoothstep(0, 0.14, u) * smoothstep(1, 0.84, u);
  }

  function step(dt, realDt, now) {
    const mode = motionMode();
    const isFull = mode === 'full';
    wallTime += dt;

    // Orbital & rotational motion
    const effSpeed = paused ? 0 : mode === 'off' ? 0 : mode === 'reduced' ? speed * 0.10 : speed;
    const simDt = dt * effSpeed;
    if (simDt > 0) {
      simTime += simDt;
      bodies[0].rot = (bodies[0].rot + simDt * 0.18) % TAU;
      for (let i = 0; i < PLANET_DEFS.length; i++) {
        const b = bodies[i + 1];
        const def = PLANET_DEFS[i];
        b.orbAngle = (b.orbAngle + simDt * def.omega) % TAU;
        b.rot = (b.rot + simDt * def.spin) % TAU;
        if (b.rot < 0) b.rot += TAU;
      }
      moonState.angle = (moonState.angle + simDt * 2.1) % TAU;
      for (let i = 0; i < astCount; i++) {
        astAng[i] = (astAng[i] + simDt * astSpd[i]) % TAU;
      }
    }

    updateBodyPositions();
    updateComet(dt, isFull);

    // Subtle gentle auto-drift on dashboard preview
    if (preview && isFull) {
      yaw = (yaw + dt * 0.045) % TAU;
    }

    // Camera inertia, time-based fly-to & framing shift
    if (!preview) {
      if (isFull && !ptrs.size) {
        if (Math.abs(velYaw) > 1e-4 || Math.abs(velPitch) > 1e-4) {
          yaw += velYaw * dt * 60;
          pitch = clamp(pitch + velPitch * dt * 60, -1.42, 1.42);
          const damp = Math.pow(0.90, dt * 60);
          velYaw *= damp;
          velPitch *= damp;
        } else {
          velYaw = 0; velPitch = 0;
        }
      }

      if (flying) {
        // Real elapsed wall-clock progress so fly-to always finishes in ~1.2 s regardless of FPS
        const k = clamp((now - flyStartMs) / FLY_DUR_MS, 0, 1);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) * 0.5;
        const gx = focusIdx >= 0 ? bodies[focusIdx].wx : 0;
        const gy = focusIdx >= 0 ? bodies[focusIdx].wy : 0;
        const gz = focusIdx >= 0 ? bodies[focusIdx].wz : 0;
        camTx = lerp(flyStartTx, gx, ease);
        camTy = lerp(flyStartTy, gy, ease);
        camTz = lerp(flyStartTz, gz, ease);
        dist = lerp(flyStartDist, flyGoalDist, ease);
        targetDist = dist;
        pitch = lerp(flyStartPitch, flyGoalPitch, ease);
        shiftPxX = lerp(flyStartShiftX, goalShiftPxX, ease);
        shiftPxY = lerp(flyStartShiftY, goalShiftPxY, ease);
        if (flyResetYaw) yaw = flyStartYaw + flyDeltaYaw * ease;
        if (k >= 1) flying = false;
      } else {
        if (focusIdx >= 0) {
          const b = bodies[focusIdx];
          camTx = b.wx; camTy = b.wy; camTz = b.wz;
        }
        const zK = isFull ? 1 - Math.exp(-realDt * 11) : 1;
        dist = lerp(dist, targetDist, zK);
        const sK = isFull ? 1 - Math.exp(-realDt * 9) : 1;
        shiftPxX = lerp(shiftPxX, goalShiftPxX, sK);
        shiftPxY = lerp(shiftPxY, goalShiftPxY, sK);
      }
    }
  }

  // ---------- Rendering passes ----------
  function drawSky(isFull) {
    const sky = assets.sky;
    const sw = sky.width, sh = sky.height;
    // Map camera yaw & pitch onto seamless sky panorama with parallax
    const uNorm = (((yaw / TAU) * 0.72) % 1 + 1) % 1;
    const vNorm = clamp(0.5 + (pitch / Math.PI) * 0.40, 0.28, 0.72);
    const drawH = Math.max(H * 1.66, W * 0.72);
    const drawW = drawH * (sw / sh);
    const ox = -uNorm * drawW;
    const oy = clamp(H * 0.5 - vNorm * drawH, H - drawH, 0);

    // Tile across viewport width seamlessly
    let startX = ox % drawW;
    if (startX > 0) startX -= drawW;
    for (let x = startX; x < W; x += drawW) {
      ctx.drawImage(sky, x, oy, drawW + 1, drawH);
    }

    // Foreground twinkling stars locked to sky dome
    for (let i = 0; i < twCount; i++) {
      let sx = (twU[i] - uNorm) * drawW;
      sx = ((sx % drawW) + drawW) % drawW;
      if (sx > W + 8) continue;
      const sy = oy + twV[i] * drawH;
      if (sy < -8 || sy > H + 8) continue;
      const tw = isFull ? 0.52 + 0.48 * Math.sin(wallTime * twSp[i] + twPh[i]) : 0.78;
      const rad = twR[i];
      ctx.globalAlpha = tw * 0.92;
      ctx.fillStyle = TW_COLS[twCol[i]];
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, TAU);
      ctx.fill();
      // Subtle 4-point diffraction glint on the brightest stars
      if (!preview && rad > 1.75 && tw > 0.72) {
        const gl = rad * 3.1 * tw;
        ctx.globalAlpha = tw * 0.42;
        ctx.fillRect(sx - gl, sy - 0.45, gl * 2, 0.9);
        ctx.fillRect(sx - 0.45, sy - gl, 0.9, gl * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawOrbits() {
    ctx.lineCap = 'round';
    for (let i = 0; i < PLANET_DEFS.length; i++) {
      const b = bodies[i + 1];
      const pts = orbits3D[i];
      const isHi = focusIdx === b.idx || hoverIdx === b.idx;
      const cInfo = coursesMode ? courseMap[i] : null;
      let any = false;
      for (let s = 0; s < ORBIT_SEGS; s++) {
        const ok = projectPoint(pts[s * 3], pts[s * 3 + 1], pts[s * 3 + 2], projOut);
        projOk[s] = ok ? 1 : 0;
        if (ok) {
          projX[s] = projOut.sx;
          projY[s] = projOut.sy;
          any = true;
        }
      }
      if (!any) continue;

      ctx.beginPath();
      let pen = false;
      for (let s = 0; s <= ORBIT_SEGS; s++) {
        const k = s === ORBIT_SEGS ? 0 : s;
        if (!projOk[k]) { pen = false; continue; }
        if (!pen) { ctx.moveTo(projX[k], projY[k]); pen = true; }
        else ctx.lineTo(projX[k], projY[k]);
      }
      if (isHi) {
        ctx.strokeStyle = cInfo ? (cInfo.course.color || accentHex) : accentHex;
        ctx.globalAlpha = 0.46;
        ctx.lineWidth = 1.45;
      } else if (cInfo) {
        ctx.strokeStyle = cInfo.course.color || '#ffffff';
        ctx.globalAlpha = 0.14 + cInfo.ratio * 0.20;
        ctx.lineWidth = 1.05;
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = preview ? 0.13 : 0.115;
        ctx.lineWidth = 0.95;
      }
      ctx.stroke();

      // Subtle orbital wake arc trailing behind each planet
      if (!preview && b.visible) {
        const wakeSteps = 10;
        const wakeSpan = 0.42;
        ctx.beginPath();
        let wPen = false;
        for (let k = 0; k <= wakeSteps; k++) {
          const ang = b.orbAngle - (k / wakeSteps) * wakeSpan;
          orbitPoint3D(PLANET_DEFS[i], ang, tmp3);
          if (projectPoint(tmp3[0], tmp3[1], tmp3[2], projOut)) {
            if (!wPen) { ctx.moveTo(projOut.sx, projOut.sy); wPen = true; }
            else ctx.lineTo(projOut.sx, projOut.sy);
          } else {
            wPen = false;
          }
        }
        ctx.strokeStyle = cInfo ? (cInfo.course.color || b.def.color) : b.def.color;
        ctx.globalAlpha = isHi ? 0.55 : 0.24;
        ctx.lineWidth = isHi ? 1.8 : 1.25;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(b, isFull) {
    const R = b.screenR;
    if (R < 0.8) return;
    const x = b.sx, y = b.sy;
    const breathe = isFull ? 1 + 0.025 * Math.sin(wallTime * 1.35) + 0.012 * Math.cos(wallTime * 2.6) : 1;

    // 1. Smooth, soft layered radial corona (zero jagged outlines or hard polygon edges)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowR = R * 4.5 * breathe;
    ctx.globalAlpha = 0.86;
    ctx.drawImage(assets.sunGlow, x - glowR, y - glowR, glowR * 2, glowR * 2);

    // Two softly counter-rotating feathered corona layers for gentle living radiance
    if (!preview) {
      const corR1 = R * 3.15 * breathe;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(isFull ? wallTime * 0.036 : 0.2);
      ctx.globalAlpha = isFull ? 0.34 + 0.06 * Math.sin(wallTime * 1.1) : 0.32;
      ctx.drawImage(assets.sunCorona, -corR1, -corR1, corR1 * 2, corR1 * 2);
      ctx.restore();

      const corR2 = R * 2.45 * (2 - breathe);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(isFull ? -wallTime * 0.024 + 1.2 : 1.4);
      ctx.globalAlpha = isFull ? 0.28 + 0.05 * Math.cos(wallTime * 1.55) : 0.26;
      ctx.drawImage(assets.sunCorona, -corR2, -corR2, corR2 * 2, corR2 * 2);
      ctx.restore();
    }

    // Tight smooth inner chromosphere bloom hugging the clean circular limb
    const innerR = R * 1.68;
    ctx.globalAlpha = 0.56;
    ctx.drawImage(assets.sunGlow, x - innerR, y - innerR, innerR * 2, innerR * 2);
    ctx.restore();

    // 2. Clean round photosphere sphere with subtle granulation & smooth Eddington limb darkening
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.clip();
    const sunTex = assets.tex.sun;
    const uPx = (((-b.rot / TAU) % 1) + 1) % 1 * sunTex.w;
    ctx.drawImage(sunTex.cv, uPx, 0, sunTex.w * 0.5, sunTex.h, x - R, y - R, R * 2, R * 2);
    // Smooth spherical limb darkening toward warm solar orange-amber at the edge
    ctx.drawImage(assets.sunLimb, x - R - 0.5, y - R - 0.5, R * 2 + 1, R * 2 + 1);
    // Soft luminous incandescent core lift
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.34;
    ctx.drawImage(assets.sunGlow, x - R * 1.22, y - R * 1.22, R * 2.44, R * 2.44);
    ctx.restore();
  }

  function drawTexturedSphere(texObj, rot, R, poleAngle, lx, ly, lz, saturnShadowAz, ringBow) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.clip();

    // Rotate to planet's projected axial tilt
    ctx.rotate(poleAngle);
    const tw = texObj.w;
    const th = texObj.h;
    const uBase = (((-rot / TAU) % 1) + 1) % 1 * tw;

    if (R < 7.5 || preview) {
      // Fast single-pass hemisphere mapping for tiny discs & dashboard preview
      ctx.drawImage(texObj.cv, uBase, 0, tw * 0.5, th, -R, -R, R * 2, R * 2);
    } else {
      // Adaptive curved-sphere longitude slices (true orthographic limb foreshortening!)
      const slices = clamp(Math.round(R * 0.52), 8, 22);
      const pad = 0.65;
      for (let i = 0; i < slices; i++) {
        const x0 = clamp(-1 + (2 * i) / slices, -1, 1);
        const x1 = clamp(-1 + (2 * (i + 1)) / slices, -1, 1);
        const su0 = uBase + (Math.asin(x0) / TAU + 0.25) * tw;
        const su1 = uBase + (Math.asin(x1) / TAU + 0.25) * tw;
        const sw = Math.max(0.5, su1 - su0);
        const dx0 = x0 * R - (i > 0 ? pad : 0);
        const dx1 = x1 * R + (i < slices - 1 ? pad : 0);
        ctx.drawImage(texObj.cv, su0, 0, sw, th, dx0, -R, dx1 - dx0, R * 2);
      }
    }

    // Ring shadow cast onto Saturn's globe (curved to match viewing elevation above/below ring plane)
    if (saturnShadowAz !== 0 && Math.abs(saturnShadowAz) > 0.04 && R > 5) {
      const yOff = -saturnShadowAz * R * 0.78;
      const bow = ringBow || 0;
      const bw = Math.max(1.2, Math.abs(saturnShadowAz) * R * 0.34);
      ctx.strokeStyle = 'rgba(6, 5, 10, 0.36)';
      ctx.lineWidth = bw;
      ctx.beginPath();
      ctx.moveTo(-R * 1.08, yOff - bow * R * 0.22);
      ctx.quadraticCurveTo(0, yOff + bow * R * 0.44, R * 1.08, yOff - bow * R * 0.22);
      ctx.stroke();
    }

    // Undo axial tilt, apply physically-based 3D spherical shading from 49-phase padded atlas
    ctx.rotate(-poleAngle);
    const lightAng = Math.atan2(ly, lx);
    ctx.rotate(lightAng);
    const phase = Math.acos(clamp(lz, -1, 1)); // 0 = full, π/2 = quarter, π = backlit new
    const k = clamp(Math.round((phase / Math.PI) * (SHADOW_STEPS - 1)), 0, SHADOW_STEPS - 1);
    const sx = (k % SHADOW_GRID) * SHADOW_STRIDE + SHADOW_PAD;
    const sy = ((k / SHADOW_GRID) | 0) * SHADOW_STRIDE + SHADOW_PAD;
    ctx.drawImage(assets.shadow, sx, sy, SHADOW_SZ, SHADOW_SZ, -R - 0.6, -R - 0.6, R * 2 + 1.2, R * 2 + 1.2);
    ctx.restore();
  }

  // Draw either back half (front=false) or front half (front=true) of tilted 3D planetary rings
  function drawRingHalf(b, basis, ringDef, front) {
    camRotateVec(basis.ux, basis.uy, basis.uz, rotOut);
    const ux = rotOut.x, uy = rotOut.y, uz = rotOut.z;
    camRotateVec(basis.vx, basis.vy, basis.vz, rotOut);
    const vx = rotOut.x, vy = rotOut.y, vz = rotOut.z;

    const s = b.scale;
    const outerR = b.def.r * ringDef.outer;
    const innerR = b.def.r * ringDef.inner;
    if (outerR * s < 2.2) return;

    const a = ux * s, bb = -uy * s, c = vx * s, d = -vy * s;
    const det = a * d - bb * c;
    const ringTex = assets.rings[ringDef.kind];

    // Guard against degenerate exact edge-on matrix
    if (Math.abs(det) < 0.02) {
      if (!front) return;
      const ex = (ux * ux + vx * vx) >= (uy * uy + vy * vy) ? ux : vx;
      const ey = (ux * ux + vx * vx) >= (uy * uy + vy * vy) ? -uy : -vy;
      const el = Math.hypot(ex, ey) || 1;
      ctx.save();
      ctx.strokeStyle = ringDef.kind === 'saturn' ? 'rgba(232, 212, 172, 0.72)' : 'rgba(158, 228, 240, 0.35)';
      ctx.lineWidth = Math.max(1, b.screenR * 0.08);
      ctx.beginPath();
      ctx.moveTo(b.sx - (ex / el) * outerR * s, b.sy - (ey / el) * outerR * s);
      ctx.lineTo(b.sx + (ex / el) * outerR * s, b.sy + (ey / el) * outerR * s);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const lenZ = Math.hypot(uz, vz);
    const alpha0 = lenZ > 1e-5 ? Math.atan2(vz, uz) : 0;

    ctx.save();
    ctx.transform(a, bb, c, d, b.sx, b.sy);

    // Clip to strictly front (x' >= -eps) or back (x' <= +eps) half-plane in depth order
    if (lenZ > 1e-5) {
      ctx.rotate(alpha0);
      ctx.beginPath();
      const pad = b.def.r * 0.015;
      if (front) ctx.rect(-pad, -outerR * 1.15, outerR * 1.2 + pad, outerR * 2.3);
      else ctx.rect(-outerR * 1.2, -outerR * 1.15, outerR * 1.2 + pad, outerR * 2.3);
      ctx.clip();
      ctx.rotate(-alpha0);
    } else if (!front) {
      ctx.restore();
      return;
    }

    ctx.drawImage(ringTex, -outerR, -outerR, outerR * 2, outerR * 2);

    // Cast Saturn's cylindrical night shadow onto its rings (always pointing away from the Sun)
    if (ringDef.kind === 'saturn') {
      const distP = Math.hypot(b.wx, b.wy, b.wz) || 1;
      const axw = b.wx / distP, ayw = b.wy / distP, azw = b.wz / distP;
      const projU = axw * basis.ux + ayw * basis.uy + azw * basis.uz;
      const projV = axw * basis.vx + ayw * basis.vy + azw * basis.vz;
      if (Math.hypot(projU, projV) > 0.08) {
        const shAng = Math.atan2(projV, projU);
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, outerR * 0.995, 0, TAU);
        ctx.arc(0, 0, innerR, 0, TAU, true);
        ctx.clip('evenodd');
        ctx.rotate(shAng);
        ctx.fillStyle = 'rgba(2, 3, 9, 0.44)';
        ctx.fillRect(0, -b.def.r * 1.06, outerR * 1.15, b.def.r * 2.12);
        ctx.fillStyle = 'rgba(2, 3, 9, 0.56)';
        ctx.fillRect(0, -b.def.r * 0.93, outerR * 1.15, b.def.r * 1.86);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  function drawMoon(m) {
    if (!m.visible || m.screenR < 0.5) return;
    if (m.screenR < 2.2) {
      ctx.fillStyle = '#cfcdc8';
      ctx.beginPath();
      ctx.arc(m.sx, m.sy, Math.max(1.1, m.screenR), 0, TAU);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(m.sx, m.sy);
    drawTexturedSphere(assets.tex.moon, m.angle, m.screenR, 0, m.lx, m.ly, m.lz, 0, 0);
    ctx.restore();
  }

  function drawPlanet(b) {
    const def = b.def;
    const pIdx = b.pIdx;
    const R = b.screenR;
    if (R < 0.4) return;

    const cInfo = coursesMode ? courseMap[pIdx] : null;
    const ringDef = def.ring;
    const basis = ringBases[pIdx];

    // Prepare Earth's Moon screen coordinates if this is Earth
    let moonReady = false;
    if (def.hasMoon) {
      if (projectPoint(moonState.wx, moonState.wy, moonState.wz, projOut)) {
        moonState.sx = projOut.sx;
        moonState.sy = projOut.sy;
        moonState.depth = projOut.depth;
        moonState.scale = projOut.scale;
        moonState.screenR = 1.65 * projOut.scale;
        moonState.lx = b.lx;
        moonState.ly = b.ly;
        moonState.lz = b.lz;
        moonState.visible = true;
        moonReady = true;
      } else {
        moonState.visible = false;
      }
    }

    // Prepare Derslerim review satellites if active
    const revCount = cInfo ? Math.min(cInfo.review, MAX_REV_SATS) : 0;
    if (revCount > 0) {
      const satOrbitBase = def.r * (ringDef ? 2.55 : def.hasMoon ? 2.4 : 1.95);
      for (let k = 0; k < revCount; k++) {
        const tier = k % 3;
        const rad = satOrbitBase + tier * (def.r * 0.42 + 1.8);
        const ang = simTime * (1.55 - tier * 0.28) + (k / revCount) * TAU + pIdx * 1.1;
        const tilt = ((k % 4) - 1.5) * 0.36;
        const lx = Math.cos(ang) * rad;
        const lz0 = Math.sin(ang) * rad;
        const ly = lz0 * Math.sin(tilt);
        const lz = lz0 * Math.cos(tilt);
        const sat = revSats[k];
        if (projectPoint(b.wx + lx, b.wy + ly, b.wz + lz, projOut)) {
          sat.sx = projOut.sx;
          sat.sy = projOut.sy;
          sat.depth = projOut.depth;
          sat.screenR = clamp(1.15 * projOut.scale, 1.35, 3.6);
          sat.visible = true;
        } else {
          sat.visible = false;
        }
      }
    }

    // Faint Moon orbit ring around Earth when zoomed close
    if (def.hasMoon && !preview && R > 9) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      const segs = 32;
      const mR = 11.8, mInc = 6.5 * DEG;
      let pen = false;
      for (let s = 0; s <= segs; s++) {
        const a = (s / segs) * TAU;
        const mz = Math.sin(a) * mR;
        if (projectPoint(b.wx + Math.cos(a) * mR, b.wy + mz * Math.sin(mInc), b.wz + mz * Math.cos(mInc), projOut)) {
          if (!pen) { ctx.moveTo(projOut.sx, projOut.sy); pen = true; }
          else ctx.lineTo(projOut.sx, projOut.sy);
        } else pen = false;
      }
      ctx.stroke();
      ctx.restore();
    }

    // 1. Derslerim solved-ratio glow halo behind planet
    if (cInfo) {
      const auraCol = cInfo.course.color || accentHex;
      const auraCv = getColoredAura(auraCol);
      const glowStrength = 0.16 + cInfo.ratio * 0.72;
      const auraR = R * (1.85 + cInfo.ratio * 1.45);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glowStrength;
      ctx.drawImage(auraCv, b.sx - auraR, b.sy - auraR, auraR * 2, auraR * 2);
      ctx.restore();
    }

    // 2. Back moons & review satellites
    if (moonReady && moonState.depth > b.depth) drawMoon(moonState);
    if (revCount > 0) {
      const satCol = cInfo.course.color || accentHex;
      for (let k = 0; k < revCount; k++) {
        const sat = revSats[k];
        if (!sat.visible || sat.depth <= b.depth) continue;
        drawReviewSat(sat, satCol);
      }
    }

    // 3. Back half of planetary rings (Saturn / Uranus)
    if (ringDef && basis) drawRingHalf(b, basis, ringDef, false);

    // 4. Planet sphere with procedural texture + terminator + Saturn ring shadow
    const ax = axes3D[pIdx];
    camRotateVec(ax.x, ax.y, ax.z, rotOut);
    const poleAngle = Math.atan2(rotOut.x, rotOut.y);
    let saturnShadowAz = 0;
    let ringBow = 0;
    if (ringDef && ringDef.kind === 'saturn' && basis) {
      const dp = Math.hypot(b.wx, b.wy, b.wz) || 1;
      saturnShadowAz = (b.wx * basis.nx + b.wy * basis.ny + b.wz * basis.nz) / dp;
      const vx = camWx - b.wx, vy = camWy - b.wy, vz = camWz - b.wz;
      const vl = Math.hypot(vx, vy, vz) || 1;
      ringBow = (vx * basis.nx + vy * basis.ny + vz * basis.nz) / vl;
    }

    ctx.save();
    ctx.translate(b.sx, b.sy);
    drawTexturedSphere(assets.tex[def.id], b.rot, R, poleAngle, b.lx, b.ly, b.lz, saturnShadowAz, ringBow);

    // 5. Atmospheric rim glow for Earth, Venus, Neptune
    if (def.atmo && R > 2.4) {
      const atmoCv = assets.atmo[def.atmo];
      const lightAng = Math.atan2(b.ly, b.lx);
      const haloR = R / 0.78;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.rotate(lightAng);
      ctx.globalAlpha = def.atmo === 'earth' ? 0.82 : def.atmo === 'neptune' ? 0.76 : 0.56;
      ctx.drawImage(atmoCv, -haloR, -haloR, haloR * 2, haloR * 2);
      // Subtle backlit eclipse rim when planet passes in front of the Sun
      if (b.lz < -0.25) {
        ctx.rotate(Math.PI);
        ctx.globalAlpha = (-b.lz - 0.25) * 0.42;
        ctx.drawImage(atmoCv, -haloR, -haloR, haloR * 2, haloR * 2);
      }
      ctx.restore();
    }

    // Hover / selection subtle reticle ring
    if (!preview && (hoverIdx === b.idx || focusIdx === b.idx)) {
      const ringRad = Math.max(R + 5, 11);
      ctx.strokeStyle = cInfo ? (cInfo.course.color || accentHex) : accentHex;
      ctx.globalAlpha = focusIdx === b.idx ? 0.52 : 0.35;
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, ringRad, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 6. Front half of planetary rings
    if (ringDef && basis) drawRingHalf(b, basis, ringDef, true);

    // 7. Front moons & review satellites
    if (moonReady && moonState.depth <= b.depth) drawMoon(moonState);
    if (revCount > 0) {
      const satCol = cInfo.course.color || accentHex;
      for (let k = 0; k < revCount; k++) {
        const sat = revSats[k];
        if (!sat.visible || sat.depth > b.depth) continue;
        drawReviewSat(sat, satCol);
      }
    }
  }

  function drawReviewSat(sat, color) {
    const aura = getColoredAura(color);
    const gr = sat.screenR * 3.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.78;
    ctx.drawImage(aura, sat.sx - gr, sat.sy - gr, gr * 2, gr * 2);
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sat.sx, sat.sy, sat.screenR * 0.78, 0, TAU);
    ctx.fill();
  }

  function drawComet() {
    if (!comet.visible || comet.alpha <= 0.01) return;
    const distSun = Math.hypot(comet.wx, comet.wy, comet.wz) || 1;
    // Anti-solar unit vector (tail ALWAYS points away from the Sun!)
    const ax = comet.wx / distSun, ay = comet.wy / distSun, az = comet.wz / distSun;
    const prox = clamp(125 / Math.max(35, distSun), 0.35, 2.2);
    const tailLen = 36 * prox;

    // Project ion tail tip (straight away from Sun)
    const hasIon = projectPoint(comet.wx + ax * tailLen, comet.wy + ay * tailLen, comet.wz + az * tailLen, projOut);
    const ionX = hasIon ? projOut.sx : comet.sx;
    const ionY = hasIon ? projOut.sy : comet.sy;

    // Dust tail lags slightly opposite velocity vector
    const vLen = Math.hypot(comet.vx, comet.vy, comet.vz) || 1;
    const dx = ax * 0.82 - (comet.vx / vLen) * 0.35;
    const dy = ay * 0.82 - (comet.vy / vLen) * 0.35;
    const dz = az * 0.82 - (comet.vz / vLen) * 0.35;
    const dLen = Math.hypot(dx, dy, dz) || 1;
    const hasDust = projectPoint(
      comet.wx + (dx / dLen) * tailLen * 0.72,
      comet.wy + (dy / dLen) * tailLen * 0.72,
      comet.wz + (dz / dLen) * tailLen * 0.72,
      projOut,
    );
    const dustX = hasDust ? projOut.sx : ionX;
    const dustY = hasDust ? projOut.sy : ionY;

    const headR = clamp(2.1 * comet.scale, 1.4, 5.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Ion tail (luminous blue-cyan plasma wedge)
    if (hasIon) {
      const ix = ionX - comet.sx, iy = ionY - comet.sy;
      const il = Math.hypot(ix, iy) || 1;
      const px = -iy / il, py = ix / il;
      ctx.fillStyle = 'rgba(130, 210, 255, 0.24)';
      ctx.globalAlpha = comet.alpha * clamp(prox * 0.65, 0.2, 0.9);
      ctx.beginPath();
      ctx.moveTo(comet.sx + px * headR * 0.65, comet.sy + py * headR * 0.65);
      ctx.lineTo(ionX, ionY);
      ctx.lineTo(comet.sx - px * headR * 0.65, comet.sy - py * headR * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(190, 236, 255, 0.48)';
      ctx.lineWidth = Math.max(0.8, headR * 0.32);
      ctx.beginPath();
      ctx.moveTo(comet.sx, comet.sy);
      ctx.lineTo(comet.sx + ix * 0.62, comet.sy + iy * 0.62);
      ctx.stroke();
    }

    // Warm dust tail fan
    if (hasDust) {
      const jx = dustX - comet.sx, jy = dustY - comet.sy;
      const jl = Math.hypot(jx, jy) || 1;
      const px = -jy / jl, py = jx / jl;
      ctx.fillStyle = 'rgba(255, 236, 198, 0.16)';
      ctx.globalAlpha = comet.alpha * clamp(prox * 0.55, 0.15, 0.8);
      ctx.beginPath();
      ctx.moveTo(comet.sx + px * headR * 0.95, comet.sy + py * headR * 0.95);
      ctx.lineTo(dustX + px * headR * 2.2, dustY + py * headR * 2.2);
      ctx.lineTo(dustX - px * headR * 1.4, dustY - py * headR * 1.4);
      ctx.lineTo(comet.sx - px * headR * 0.95, comet.sy - py * headR * 0.95);
      ctx.closePath();
      ctx.fill();
    }

    // Coma glow + icy white core
    const comaR = headR * 4.2;
    ctx.globalAlpha = comet.alpha * 0.85;
    ctx.drawImage(getColoredAura('#9edcff'), comet.sx - comaR, comet.sy - comaR, comaR * 2, comaR * 2);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = comet.alpha;
    ctx.beginPath();
    ctx.arc(comet.sx, comet.sy, headR * 0.72, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawAsteroidsInRange(maxDepth, minDepth) {
    ctx.fillStyle = '#b9b2a8';
    for (let i = 0; i < astCount; i++) {
      if (!astVis[i]) continue;
      const d = astD[i];
      if (d <= minDepth || d > maxDepth) continue;
      const sz = astSz[i] * clamp(focal / d * 0.55, 0.5, 2.2);
      ctx.globalAlpha = astBri[i] * clamp(580 / d, 0.25, 0.95);
      ctx.fillRect(astSX[i] - sz * 0.5, astSY[i] - sz * 0.5, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  function drawLabels() {
    if (preview) return;
    let placed = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Order labels by priority: focused/hovered first, then closest to camera
    for (let k = drawOrder.length - 1; k >= 0; k--) {
      const idx = drawOrder[k];
      if (idx === 9) continue; // skip comet
      const b = bodies[idx];
      b.lblShown = false;
      if (!b.visible) continue;
      if (b.sx < -40 || b.sx > W + 40 || b.sy < -30 || b.sy > H + 30) continue;
      // Don't label the Sun unless hovered/focused
      if (idx === 0 && focusIdx !== 0 && hoverIdx !== 0) continue;

      const cInfo = coursesMode && b.pIdx >= 0 ? courseMap[b.pIdx] : null;
      const isActive = focusIdx === idx || hoverIdx === idx;
      let label = b.def.name;
      if (cInfo) {
        const iconStr = cInfo.course.icon ? cInfo.course.icon + ' ' : '';
        label = iconStr + cInfo.course.name;
        if (label.length > 22 && !isActive) label = label.slice(0, 20) + '…';
      }

      const fontSize = isActive ? 12 : 11;
      ctx.font = `${isActive ? 600 : 500} ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
      const tw = ctx.measureText(label).width;
      const padX = 7;
      const bw = tw + padX * 2;
      const bh = fontSize + 6;
      const extraY = b.def.ring ? b.screenR * 1.42 : b.screenR;
      const lx = b.sx;
      const ly = b.sy + Math.max(extraY, 6) + 8;

      const x0 = lx - bw * 0.5, y0 = ly, x1 = lx + bw * 0.5, y1 = ly + bh;

      // Declutter overlapping labels (never hide focused or hovered label)
      if (!isActive) {
        let overlap = false;
        for (let m = 0; m < placed; m++) {
          const o = labelBoxes[m];
          if (x0 < o.x1 + 4 && x1 > o.x0 - 4 && y0 < o.y1 + 2 && y1 > o.y0 - 2) {
            overlap = true;
            break;
          }
        }
        if (overlap) continue;
      }

      if (placed < labelBoxes.length) {
        labelBoxes[placed].x0 = x0;
        labelBoxes[placed].y0 = y0;
        labelBoxes[placed].x1 = x1;
        labelBoxes[placed].y1 = y1;
        placed++;
      }

      b.lblX = x0; b.lblY = y0; b.lblW = bw; b.lblH = bh; b.lblShown = true;

      // Subtle translucent dark pill backing when active or in Derslerim mode
      if (isActive || cInfo) {
        ctx.fillStyle = 'rgba(5, 6, 12, 0.72)';
        const rr = 6;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x0, y0, bw, bh, rr) : ctx.rect(x0, y0, bw, bh);
        ctx.fill();
        ctx.strokeStyle = cInfo ? (cInfo.course.color || accentHex) : accentHex;
        ctx.globalAlpha = isActive ? 0.65 : 0.32;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      if (cInfo) {
        ctx.fillStyle = cInfo.course.color || '#f4f4f5';
        ctx.globalAlpha = isActive ? 1 : 0.92;
      } else if (coursesMode && b.pIdx >= 0) {
        ctx.fillStyle = '#8b8b94';
        ctx.globalAlpha = isActive ? 0.9 : 0.45;
      } else {
        ctx.fillStyle = isActive ? '#ffffff' : '#d8d8e0';
        ctx.globalAlpha = isActive ? 1 : 0.78;
      }
      ctx.fillText(label, lx, y0 + 3);
      ctx.globalAlpha = 1;
    }
  }

  function drawFrame() {
    if (W <= 0 || H <= 0) return;
    const isFull = motionMode() === 'full';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateCamBasis();

    // 1. Deep-space starfield + Milky Way + twinkle
    drawSky(isFull);

    // 2. Project Sun + 8 planets + compute exact planet-to-camera / planet-to-Sun phase vectors
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (projectPoint(b.wx, b.wy, b.wz, projOut)) {
        b.sx = projOut.sx;
        b.sy = projOut.sy;
        b.depth = projOut.depth;
        b.scale = projOut.scale;
        b.screenR = b.def.r * projOut.scale;
        b.visible = true;
        drawDepth[i] = b.depth;
        if (i > 0) {
          const dSun = Math.hypot(b.wx, b.wy, b.wz) || 1;
          const lwx = -b.wx / dSun, lwy = -b.wy / dSun, lwz = -b.wz / dSun;
          // True view ray V from planet to camera (handles off-axis perspective phases accurately!)
          const vx = camWx - b.wx, vy = camWy - b.wy, vz = camWz - b.wz;
          const vl = Math.hypot(vx, vy, vz) || 1;
          const vnx = vx / vl, vny = vy / vl, vnz = vz / vl;
          // Local screen-right R = norm(camUp x V) and screen-up U = V x R
          let rx = camUpy * vnz - camUpz * vny;
          let ry = camUpz * vnx - camUpx * vnz;
          let rz = camUpx * vny - camUpy * vnx;
          const rl = Math.hypot(rx, ry, rz);
          if (rl > 1e-5) {
            rx /= rl; ry /= rl; rz /= rl;
          } else {
            rx = cosYaw; ry = 0; rz = -sinYaw;
          }
          const ux = vny * rz - vnz * ry;
          const uy = vnz * rx - vnx * rz;
          const uz = vnx * ry - vny * rx;
          b.lx = lwx * rx + lwy * ry + lwz * rz;
          b.ly = -(lwx * ux + lwy * uy + lwz * uz);
          b.lz = lwx * vnx + lwy * vny + lwz * vnz;
        }
      } else {
        b.visible = false;
        drawDepth[i] = -1e9;
      }
    }

    // Project comet
    if (comet.active && projectPoint(comet.wx, comet.wy, comet.wz, projOut)) {
      comet.sx = projOut.sx;
      comet.sy = projOut.sy;
      comet.depth = projOut.depth;
      comet.scale = projOut.scale;
      comet.visible = true;
      drawDepth[9] = comet.depth;
    } else {
      comet.visible = false;
      drawDepth[9] = -1e9;
    }

    // Project asteroid belt particles once into flat typed arrays
    for (let i = 0; i < astCount; i++) {
      const a = astAng[i], r = astR[i];
      if (projectPoint(Math.cos(a) * r, astY[i], Math.sin(a) * r, projOut)) {
        astSX[i] = projOut.sx;
        astSY[i] = projOut.sy;
        astD[i] = projOut.depth;
        astVis[i] = (projOut.sx >= -4 && projOut.sx <= W + 4 && projOut.sy >= -4 && projOut.sy <= H + 4) ? 1 : 0;
      } else {
        astVis[i] = 0;
      }
    }

    // 3. Elliptical 3D orbits & wake arcs
    drawOrbits();

    // 4. In-place insertion sort of drawOrder (descending depth = farthest first, ZERO allocations)
    for (let i = 0; i < 10; i++) drawOrder[i] = i;
    for (let i = 1; i < 10; i++) {
      const key = drawOrder[i];
      const kd = drawDepth[key];
      let j = i - 1;
      while (j >= 0 && drawDepth[drawOrder[j]] < kd) {
        drawOrder[j + 1] = drawOrder[j];
        j--;
      }
      drawOrder[j + 1] = key;
    }

    // 5. Interleaved back-to-front draw of asteroids, Sun, planets (with split rings/moons), and comet
    let prevDepth = Infinity;
    for (let k = 0; k < 10; k++) {
      const idx = drawOrder[k];
      const d = drawDepth[idx];
      if (d <= 0) continue;
      drawAsteroidsInRange(prevDepth, d);
      if (idx === 0) drawSun(bodies[0], isFull);
      else if (idx === 9) drawComet();
      else drawPlanet(bodies[idx]);
      prevDepth = d;
    }
    drawAsteroidsInRange(prevDepth, 0);

    // 6. Clean decluttered labels (full view only)
    drawLabels();
  }

  // ---------- Loop lifecycle (IntersectionObserver + visibilitychange + motion settings) ----------
  let raf = 0;
  let inView = true;
  let destroyed = false;

  function shouldAnimate() {
    if (destroyed || document.hidden || !inView) return false;
    const m = motionMode();
    if (m === 'off') return false;
    if (preview && m === 'reduced') return false;
    return true;
  }

  function frame() {
    raf = 0;
    if (!shouldAnimate()) return;
    const now = performance.now();
    if (preview && now - lastPreviewDrawMs < previewInterval) {
      raf = requestAnimationFrame(frame);
      return;
    }
    const rawDt = lastFrameMs ? Math.max(0, (now - lastFrameMs) / 1000) : 0.016;
    const dt = Math.min(0.05, rawDt);
    const realDt = Math.min(0.25, rawDt);
    lastFrameMs = now;
    if (preview) lastPreviewDrawMs = now;
    step(dt, realDt, now);
    drawFrame();
    raf = requestAnimationFrame(frame);
  }

  function syncLoop() {
    if (destroyed) return;
    if (shouldAnimate()) {
      if (!raf) {
        lastFrameMs = performance.now();
        raf = requestAnimationFrame(frame);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function resize() {
    if (destroyed) return;
    const rect = stage.getBoundingClientRect();
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    const ndpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const cw = Math.max(1, Math.round(nw * ndpr));
    const ch = Math.max(1, Math.round(nh * ndpr));
    if (nw !== W || nh !== H || ndpr !== dpr || cv.width !== cw || cv.height !== ch) {
      W = nw; H = nh; dpr = ndpr;
      cv.width = cw;
      cv.height = ch;
    }
    measurePanelFraming();
    if (!flying && (motionMode() !== 'full' || focusIdx >= 0)) {
      shiftPxX = goalShiftPxX;
      shiftPxY = goalShiftPxY;
    }
    updateBodyPositions();
    drawFrame();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  if (infoEl) ro.observe(infoEl);

  const onPanelTransitionEnd = () => {
    if (destroyed || focusIdx < 0) return;
    measurePanelFraming();
    if (!raf) {
      shiftPxX = goalShiftPxX;
      shiftPxY = goalShiftPxY;
      drawFrame();
    }
  };

  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(entries => {
      for (const entry of entries) inView = entry.isIntersecting;
      syncLoop();
    }, { threshold: 0.01 });
    io.observe(stage);
  }

  const onVis = () => syncLoop();
  const onPrefs = () => {
    readAccent();
    if (motionMode() !== 'full') {
      flying = false;
      velYaw = 0;
      velPitch = 0;
      comet.active = false;
      comet.visible = false;
    }
    syncLoop();
    drawFrame();
  };
  const onDataChanged = () => {
    courseMap = buildCourseMap();
    if (coursesMode && focusIdx >= 0) renderInfoPanel();
    if (!raf) drawFrame();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('mp-theme', onPrefs);
  window.addEventListener('mp-changed', onDataChanged);
  reduceQ.addEventListener?.('change', onPrefs);

  // ---------- Pointer / Wheel / Touch / Keyboard input ----------
  const ptrs = new Map();
  let dragMoved = false;
  let wasPinch = false;
  let downTime = 0;
  let downX = 0, downY = 0;
  let prevPinchDist = 0;
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

  function hitTest(clientX, clientY, coarse) {
    const r = cv.getBoundingClientRect();
    const mx = clientX - r.left;
    const my = clientY - r.top;
    const pad = coarse ? 14 : 8;
    const minHit = coarse ? 24 : 16;

    // Check front-to-back (closest to camera first)
    for (let k = drawOrder.length - 1; k >= 0; k--) {
      const idx = drawOrder[k];
      if (idx === 9) continue;
      const b = bodies[idx];
      if (!b.visible) continue;
      const hr = Math.max(b.screenR + pad, minHit);
      const dx = mx - b.sx, dy = my - b.sy;
      if (dx * dx + dy * dy <= hr * hr) return idx;
      if (b.lblShown && mx >= b.lblX - 4 && mx <= b.lblX + b.lblW + 4 && my >= b.lblY - 3 && my <= b.lblY + b.lblH + 3) {
        return idx;
      }
    }
    return -1;
  }

  const onPreviewClick = () => {
    location.hash = '#/evren';
  };

  const onPointerDown = e => {
    if (e.button > 0) return;
    hideHint();
    try { cv.setPointerCapture(e.pointerId); } catch {}
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    velYaw = 0;
    velPitch = 0;
    if (ptrs.size === 1) {
      dragMoved = false;
      wasPinch = false;
      downTime = performance.now();
      downX = e.clientX;
      downY = e.clientY;
    } else if (ptrs.size === 2) {
      wasPinch = true;
      dragMoved = true;
      flying = false;
      const [p1, p2] = ptrs.values();
      prevPinchDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
  };

  const onPointerMove = e => {
    const p = ptrs.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') {
        const hit = hitTest(e.clientX, e.clientY, false);
        if (hit !== hoverIdx) {
          hoverIdx = hit;
          cv.style.cursor = hit >= 0 ? 'pointer' : 'grab';
          if (!raf) drawFrame();
        }
      }
      return;
    }

    const prevX = p.x, prevY = p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (ptrs.size === 2) {
      const [p1, p2] = ptrs.values();
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (prevPinchDist > 8 && d > 8) {
        const factor = clamp(prevPinchDist / d, 0.75, 1.35);
        targetDist = clamp(targetDist * factor, getMinDist(), MAX_DIST);
        if (motionMode() !== 'full') dist = targetDist;
      }
      prevPinchDist = d;
      if (!raf) drawFrame();
      return;
    }

    if (ptrs.size === 1) {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      if (!dragMoved && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) {
        dragMoved = true;
        flying = false;
        cv.style.cursor = 'grabbing';
      }
      if (dragMoved) {
        const sens = 0.0056;
        const dYaw = -dx * sens;
        const dPitch = dy * sens;
        yaw += dYaw;
        pitch = clamp(pitch + dPitch, -1.42, 1.42);
        if (motionMode() === 'full') {
          velYaw = velYaw * 0.45 + dYaw * 0.55;
          velPitch = velPitch * 0.45 + dPitch * 0.55;
        }
        if (!raf) drawFrame();
      }
    }
  };

  const onPointerUp = e => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    try { if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); } catch {}
    if (ptrs.size === 1) {
      // One finger lifted from a 2-finger pinch: resync remaining finger cleanly
      const [rem] = ptrs.values();
      downX = rem.x; downY = rem.y;
      dragMoved = true;
      prevPinchDist = 0;
      return;
    }
    if (ptrs.size === 0) {
      cv.style.cursor = hoverIdx >= 0 ? 'pointer' : 'grab';
      if (p && !dragMoved && !wasPinch && e.type === 'pointerup' && (performance.now() - downTime) < 460) {
        const hit = hitTest(e.clientX, e.clientY, e.pointerType !== 'mouse');
        if (hit >= 0) {
          lastTapTime = 0;
          startFlyTo(hit);
        } else {
          const now = performance.now();
          if (now - lastTapTime < 340 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 30) {
            lastTapTime = 0;
            resetCamera();
          } else {
            lastTapTime = now;
            lastTapX = e.clientX;
            lastTapY = e.clientY;
          }
        }
      }
      wasPinch = false;
    }
  };

  const onPointerLeave = () => {
    if (hoverIdx !== -1 && !ptrs.size) {
      hoverIdx = -1;
      cv.style.cursor = 'grab';
      if (!raf) drawFrame();
    }
  };

  const onWheel = e => {
    e.preventDefault();
    hideHint();
    flying = false;
    const delta = clamp(e.deltaY, -160, 160);
    targetDist = clamp(targetDist * Math.exp(delta * 0.0014), getMinDist(), MAX_DIST);
    if (motionMode() !== 'full') {
      dist = targetDist;
      drawFrame();
    }
  };

  const onKeyDown = e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'Escape' && focusIdx >= 0) {
      e.preventDefault();
      resetCamera();
    } else if (e.key === 'r' || e.key === 'R') {
      resetCamera();
    } else if (e.key === ' ') {
      e.preventDefault();
      togglePause();
    } else if (focusIdx >= 0 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      stepFocus(e.key === 'ArrowRight' ? 1 : -1);
    }
  };

  function togglePause() {
    paused = !paused;
    if (playBtn) {
      playBtn.innerHTML = paused ? ICONS.play : ICONS.pause;
      playBtn.setAttribute('aria-label', paused ? 'Oynat' : 'Duraklat');
      playBtn.setAttribute('aria-pressed', String(paused));
    }
    if (!raf) drawFrame();
  }

  function setSpeed(sp) {
    speed = sp;
    for (const b of speedBtns) {
      const on = +b.dataset.solarSpeed === sp;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    if (paused) togglePause();
  }

  function toggleCourses() {
    coursesMode = !coursesMode;
    courseMap = buildCourseMap();
    if (coursesBtn) {
      coursesBtn.classList.toggle('on', coursesMode);
      coursesBtn.setAttribute('aria-pressed', String(coursesMode));
    }
    if (focusIdx >= 0) renderInfoPanel();
    drawFrame();
  }

  function stepFocus(dir) {
    const next = (focusIdx + dir + bodies.length) % bodies.length;
    startFlyTo(next);
  }

  const onHudClick = e => {
    const sp = e.target.closest('[data-solar-speed]');
    if (sp) { hideHint(); setSpeed(+sp.dataset.solarSpeed); return; }
    if (e.target.closest('[data-solar-play]')) { hideHint(); togglePause(); return; }
    if (e.target.closest('[data-solar-courses]')) { hideHint(); toggleCourses(); return; }
    if (e.target.closest('[data-solar-reset]')) { resetCamera(); return; }
    const zm = e.target.closest('[data-solar-zoom]');
    if (zm) {
      hideHint();
      flying = false;
      const factor = zm.dataset.solarZoom === 'in' ? 0.78 : 1.28;
      targetDist = clamp(targetDist * factor, getMinDist(), MAX_DIST);
      if (motionMode() !== 'full') { dist = targetDist; drawFrame(); }
    }
  };

  const onInfoClick = e => {
    if (e.target.closest('[data-solar-back]')) { resetCamera(); return; }
    const st = e.target.closest('[data-solar-step]');
    if (st) { stepFocus(+st.dataset.solarStep); }
  };

  if (preview) {
    // Preview card: click only (never blocks vertical scrolling on touch devices)
    stage.addEventListener('click', onPreviewClick);
  } else {
    cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', onPointerUp);
    cv.addEventListener('pointercancel', onPointerUp);
    cv.addEventListener('pointerleave', onPointerLeave);
    cv.addEventListener('wheel', onWheel, { passive: false });
    hudEl.addEventListener('click', onHudClick);
    infoEl.addEventListener('click', onInfoClick);
    infoEl.addEventListener('transitionend', onPanelTransitionEnd);
    window.addEventListener('keydown', onKeyDown);
  }

  // Initial layout, render & loop start
  updateBodyPositions();
  resize();
  syncLoop();

  return function cleanup() {
    destroyed = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    ro.disconnect();
    io?.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('mp-theme', onPrefs);
    window.removeEventListener('mp-changed', onDataChanged);
    reduceQ.removeEventListener?.('change', onPrefs);
    if (preview) {
      stage.removeEventListener('click', onPreviewClick);
    } else {
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', onPointerUp);
      cv.removeEventListener('pointercancel', onPointerUp);
      cv.removeEventListener('pointerleave', onPointerLeave);
      cv.removeEventListener('wheel', onWheel);
      hudEl?.removeEventListener('click', onHudClick);
      infoEl?.removeEventListener('click', onInfoClick);
      infoEl?.removeEventListener('transitionend', onPanelTransitionEnd);
      window.removeEventListener('keydown', onKeyDown);
    }
    ptrs.clear();
  };
}

// shared with the WebGL renderer (js/solar3d.js)
export { SUN_DEF, PLANET_DEFS, SPEEDS, ICONS, buildCourseMap, makeRng, fbm3 };
