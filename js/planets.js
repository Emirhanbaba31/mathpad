// Planet themes for MathPad: colour palettes, real-texture celestial backdrops,
// per-planet CSS ambient effects, and a ~900 ms transition wave.
//
// Custom accent rule:
// - Switching to a new planet adopts that planet's signature accent and clears
//   S.settings.customAccentFor (and S.settings.accent).
// - When the user manually picks an accent swatch in Settings after choosing a
//   planet, Settings stores S.settings.accent and S.settings.customAccentFor = currentPlanet().
// - On reload (applyPrefs) or re-applying the same planet, S.settings.accent is
//   preserved whenever S.settings.customAccentFor === planetId (or for legacy
//   users who had saved S.settings.accent before planet themes existed).

import { S, persist } from './db.js';
import { motion, full } from './fx.js';

export const PLANET_THEMES = [
  { id: 'mercury', name: 'Merkür', accent: '#d6cfc4', tagline: 'Güneşin kıyısında keskin zihin' },
  { id: 'venus',   name: 'Venüs',  accent: '#f6cf78', tagline: 'Altın bulutların ardında dingin odak' },
  { id: 'earth',   name: 'Dünya',  accent: '#6ec6ff', tagline: 'Mavi ufkun altında derin çalışma' },
  { id: 'mars',    name: 'Mars',   accent: '#ff8559', tagline: 'Kızıl tozun altında odaklan' },
  { id: 'jupiter', name: 'Jüpiter', accent: '#f2b880', tagline: 'Dev fırtınaların kalbinde sarsılmaz ritim' },
  { id: 'saturn',  name: 'Satürn', accent: '#eed89b', tagline: 'Buz halkalarının zarafetinde denge' },
  { id: 'uranus',  name: 'Uranüs', accent: '#7ceef7', tagline: 'Eğik yörüngede berrak buz sessizliği' },
  { id: 'neptune', name: 'Neptün', accent: '#6da4ff', tagline: 'Derin mavi rüzgârlarla sınırları aş' },
  { id: 'sun',     name: 'Güneş',  accent: '#ffb84d', tagline: 'Çekirdekten taşan saf enerji' },
];

const THEME_MAP = new Map(PLANET_THEMES.map(t => [t.id, t]));
const DEFAULT_PLANET = 'earth';

// Wave origins align with where each planet rises from, so the transition wave
// radiates outward from the newly arriving world.
const WAVE_ORIGIN = {
  mercury: ['92%', '8%'],
  venus:   ['12%', '90%'],
  earth:   ['88%', '90%'],
  mars:    ['92%', '78%'],
  jupiter: ['96%', '46%'],
  saturn:  ['84%', '16%'],
  uranus:  ['14%', '88%'],
  neptune: ['88%', '14%'],
  sun:     ['76%', '98%'],
};

const getTheme = id => THEME_MAP.get(id) || THEME_MAP.get(DEFAULT_PLANET);
const isBackdropTheme = () => {
  const t = (typeof document !== 'undefined' && document.documentElement.dataset.theme) || S.settings?.theme || 'space';
  return t === 'space' || t === 'aurora';
};

export function currentPlanet() {
  const id = S.settings?.planet;
  return THEME_MAP.has(id) ? id : DEFAULT_PLANET;
}

// Deterministic pseudo-random generator for reproducible ambient particle layouts.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildParticles(seed, count, cls, makeStyle) {
  const r = rng(seed);
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<i class="${cls}" style="${makeStyle(i, r)}"></i>`;
  }
  return html;
}

function ambientMarkup(id) {
  switch (id) {
    case 'mercury': {
      // Harsh solar glare from upper-right + gentle heat shimmer ribbons + solar-wind glints (15 elements)
      const shimmer = buildParticles(101, 4, 'pl-p pl-shimmer', (i, r) =>
        `--x:${(56 + i * 10 + r() * 4).toFixed(1)}%;--y:${(4 + i * 11 + r() * 6).toFixed(1)}%;--w:${(140 + r() * 140).toFixed(0)}px;--d:${(5.5 + r() * 4).toFixed(1)}s;--dl:${(-r() * 7).toFixed(1)}s;--op:${(.14 + r() * .12).toFixed(2)}`
      );
      const glints = buildParticles(109, 10, 'pl-p pl-mglint', (i, r) =>
        `--x:${(44 + r() * 54).toFixed(1)}%;--y:${(2 + r() * 46).toFixed(1)}%;--s:${(1.5 + r() * 2.2).toFixed(1)}px;--dx:${(-60 - r() * 90).toFixed(0)}px;--dy:${(35 + r() * 75).toFixed(0)}px;--d:${(5 + r() * 6).toFixed(1)}s;--dl:${(-r() * 9).toFixed(1)}s`
      );
      return `<div class="pl-sun-glare"></div>${shimmer}${glints}`;
    }
    case 'venus': {
      // Drifting golden sulphur haze curtains + buoyant warm motes (18 elements)
      const veils = buildParticles(201, 4, 'pl-p pl-haze', (i, r) =>
        `--x:${(-10 + i * 24).toFixed(1)}%;--y:${(48 + (i % 2) * 20 + r() * 16).toFixed(1)}%;--w:${(36 + r() * 24).toFixed(0)}vw;--d:${(16 + r() * 10).toFixed(1)}s;--dl:${(-r() * 18).toFixed(1)}s;--op:${(.16 + r() * .10).toFixed(2)}`
      );
      const motes = buildParticles(211, 14, 'pl-p pl-vmote', (i, r) =>
        `--x:${(r() * 96).toFixed(1)}%;--y:${(16 + r() * 80).toFixed(1)}%;--s:${(2 + r() * 3).toFixed(1)}px;--dx:${(40 + r() * 80).toFixed(0)}px;--dy:${(-18 - r() * 36).toFixed(0)}px;--d:${(10 + r() * 9).toFixed(1)}s;--dl:${(-r() * 14).toFixed(1)}s`
      );
      return `${veils}${motes}`;
    }
    case 'earth': {
      // Delicate aurora curtains near the horizon/pole + subtle orbital/city-light glints (19 elements)
      const aurora = buildParticles(301, 3, 'pl-p pl-aurora', (i, r) =>
        `--x:${(22 + i * 26 + r() * 6).toFixed(1)}%;--y:${(-4 + i * 5).toFixed(1)}%;--w:${(24 + r() * 14).toFixed(0)}vw;--d:${(11 + r() * 7).toFixed(1)}s;--dl:${(-r() * 10).toFixed(1)}s;--op:${(.16 + r() * .09).toFixed(2)}`
      );
      const glints = buildParticles(313, 16, 'pl-p pl-eglint', (i, r) =>
        `--x:${(12 + r() * 84).toFixed(1)}%;--y:${(8 + r() * 84).toFixed(1)}%;--s:${(1.6 + r() * 2.2).toFixed(1)}px;--d:${(3.4 + r() * 4.8).toFixed(1)}s;--dl:${(-r() * 7).toFixed(1)}s`
      );
      return `${aurora}${glints}`;
    }
    case 'mars': {
      // Sweeping red dust gusts + 24 drifting Martian dust motes (26 elements)
      const gusts = buildParticles(401, 2, 'pl-p pl-mgust', (i, r) =>
        `--y:${(58 + i * 20).toFixed(1)}%;--d:${(14 + r() * 6).toFixed(1)}s;--dl:${(-i * 7).toFixed(1)}s;--op:${(.15 + r() * .07).toFixed(2)}`
      );
      const dust = buildParticles(419, 24, 'pl-p pl-mdust', (i, r) =>
        `--x:${(r() * 100).toFixed(1)}%;--y:${(10 + r() * 88).toFixed(1)}%;--s:${(1.5 + r() * 2.8).toFixed(1)}px;--dx:${(-65 - r() * 95).toFixed(0)}px;--dy:${(-18 - r() * 42).toFixed(0)}px;--d:${(8 + r() * 9).toFixed(1)}s;--dl:${(-r() * 15).toFixed(1)}s;--op:${(.25 + r() * .45).toFixed(2)}`
      );
      return `${gusts}${dust}`;
    }
    case 'jupiter': {
      // Swirling Jovian storm ribbons + sporadic lightning flickers + equatorial specks (18 elements)
      const swirls = buildParticles(501, 4, 'pl-p pl-jswirl', (i, r) =>
        `--y:${(16 + i * 21 + r() * 6).toFixed(1)}%;--w:${(32 + r() * 22).toFixed(0)}vw;--d:${(16 + r() * 10).toFixed(1)}s;--dl:${(-r() * 16).toFixed(1)}s;--op:${(.12 + r() * .08).toFixed(2)}`
      );
      const specs = buildParticles(521, 12, 'pl-p pl-jspeck', (i, r) =>
        `--x:${(35 + r() * 62).toFixed(1)}%;--y:${(10 + r() * 80).toFixed(1)}%;--s:${(1.5 + r() * 2.3).toFixed(1)}px;--dx:${(-45 - r() * 65).toFixed(0)}px;--d:${(7 + r() * 8).toFixed(1)}s;--dl:${(-r() * 12).toFixed(1)}s`
      );
      return `${swirls}${specs}`;
    }
    case 'saturn': {
      // Sparkling drifting ring-ice shards tilted along Saturn's -22deg ring plane (24 elements)
      return buildParticles(601, 24, 'pl-p pl-ice', (i, r) =>
        `--x:${(22 + r() * 76).toFixed(1)}%;--y:${(4 + r() * 72).toFixed(1)}%;--s:${(1.8 + r() * 3.0).toFixed(1)}px;--dx:${(-75 - r() * 85).toFixed(0)}px;--dy:${(30 + r() * 36).toFixed(0)}px;--d:${(8 + r() * 9).toFixed(1)}s;--dl:${(-r() * 15).toFixed(1)}s;--op:${(.3 + r() * .55).toFixed(2)}`
      );
    }
    case 'uranus': {
      // Icy tilted aurora curtains + floating cryo-diamond glints (20 elements)
      const aurora = buildParticles(701, 4, 'pl-p pl-uaurora', (i, r) =>
        `--x:${(4 + i * 22 + r() * 8).toFixed(1)}%;--y:${(14 + i * 16 + r() * 8).toFixed(1)}%;--w:${(22 + r() * 14).toFixed(0)}vw;--d:${(12 + r() * 7).toFixed(1)}s;--dl:${(-r() * 12).toFixed(1)}s;--op:${(.14 + r() * .10).toFixed(2)}`
      );
      const cryo = buildParticles(719, 16, 'pl-p pl-ucryo', (i, r) =>
        `--x:${(r() * 94).toFixed(1)}%;--y:${(8 + r() * 86).toFixed(1)}%;--s:${(1.6 + r() * 2.5).toFixed(1)}px;--dx:${(26 + r() * 44).toFixed(0)}px;--dy:${(-35 - r() * 55).toFixed(0)}px;--d:${(9 + r() * 8).toFixed(1)}s;--dl:${(-r() * 14).toFixed(1)}s`
      );
      return `${aurora}${cryo}`;
    }
    case 'neptune': {
      // Supersonic horizontal wind streaks + deep pelagic glow + methane-ice flecks (22 elements)
      const streaks = buildParticles(801, 14, 'pl-p pl-nwind', (i, r) =>
        `--y:${(6 + i * 6.5 + r() * 3).toFixed(1)}%;--w:${(85 + r() * 175).toFixed(0)}px;--d:${(2.9 + r() * 3.6).toFixed(2)}s;--dl:${(-r() * 6).toFixed(2)}s;--op:${(.14 + r() * .24).toFixed(2)}`
      );
      const flecks = buildParticles(821, 8, 'pl-p pl-nfleck', (i, r) =>
        `--x:${(20 + r() * 78).toFixed(1)}%;--y:${(8 + r() * 84).toFixed(1)}%;--s:${(1.6 + r() * 2.4).toFixed(1)}px;--d:${(4.2 + r() * 4.5).toFixed(1)}s;--dl:${(-r() * 6).toFixed(1)}s`
      );
      return `${streaks}${flecks}`;
    }
    case 'sun': {
      // Rising solar embers & glowing sparks drifting up from the fiery lower limb (22 elements)
      return buildParticles(901, 22, 'pl-p pl-ember', (i, r) =>
        `--x:${(18 + r() * 80).toFixed(1)}%;--y:${(66 + r() * 34).toFixed(1)}%;--s:${(1.8 + r() * 3.2).toFixed(1)}px;--dx:${((r() - .5) * 70).toFixed(0)}px;--dy:${(-110 - r() * 150).toFixed(0)}px;--d:${(5.5 + r() * 6.5).toFixed(1)}s;--dl:${(-r() * 10).toFixed(1)}s;--op:${(.32 + r() * .48).toFixed(2)}`
      );
    }
    default:
      return '';
  }
}

function planetBodyMarkup(id) {
  if (id === 'earth') {
    return `
      <div class="pl-moon-wrap"><div class="pl-moon"><i class="pl-moon-tex"></i><i class="pl-moon-shade"></i></div></div>
      <div class="pl-planet-wrap">
        <div class="pl-atmo"></div>
        <div class="pl-sphere">
          <i class="pl-tex"></i>
          <i class="pl-clouds"></i>
          <i class="pl-shade"></i>
          <i class="pl-night"></i>
          <i class="pl-rim"></i>
        </div>
      </div>`;
  }
  if (id === 'saturn') {
    return `
      <div class="pl-planet-wrap pl-ringed">
        <div class="pl-atmo"></div>
        <div class="pl-ring-sys">
          <div class="pl-ring pl-ring-back"></div>
          <div class="pl-sphere">
            <i class="pl-tex"></i>
            <i class="pl-shade"></i>
            <i class="pl-rim"></i>
          </div>
          <div class="pl-ring pl-ring-front"></div>
        </div>
      </div>`;
  }
  if (id === 'uranus') {
    return `
      <div class="pl-planet-wrap pl-ringed">
        <div class="pl-atmo"></div>
        <div class="pl-ring-sys pl-uranus-sys">
          <div class="pl-ring pl-ring-back"></div>
          <div class="pl-sphere">
            <i class="pl-tex"></i>
            <i class="pl-shade"></i>
            <i class="pl-rim"></i>
          </div>
          <div class="pl-ring pl-ring-front"></div>
        </div>
      </div>`;
  }
  if (id === 'jupiter') {
    return `
      <div class="pl-planet-wrap">
        <div class="pl-atmo"></div>
        <div class="pl-sphere">
          <i class="pl-tex"></i>
          <i class="pl-jup-bands"></i>
          <i class="pl-shade"></i>
          <i class="pl-jbolt jb1"></i>
          <i class="pl-jbolt jb2"></i>
          <i class="pl-jbolt jb3"></i>
          <i class="pl-rim"></i>
        </div>
      </div>`;
  }
  if (id === 'sun') {
    return `
      <div class="pl-planet-wrap">
        <div class="pl-corona"></div>
        <div class="pl-flare f1"></div>
        <div class="pl-flare f2"></div>
        <div class="pl-flare f3"></div>
        <div class="pl-sphere">
          <i class="pl-tex"></i>
          <i class="pl-shade"></i>
          <i class="pl-rim"></i>
        </div>
      </div>`;
  }
  return `
    <div class="pl-planet-wrap">
      <div class="pl-atmo"></div>
      <div class="pl-sphere">
        <i class="pl-tex"></i>
        <i class="pl-shade"></i>
        <i class="pl-rim"></i>
      </div>
    </div>`;
}

function createWorld(id) {
  const el = document.createElement('div');
  el.className = 'pl-world';
  el.dataset.p = id;
  el.innerHTML = `${planetBodyMarkup(id)}<div class="pl-ambient">${ambientMarkup(id)}</div>`;
  return el;
}

function ensureStage() {
  if (typeof document === 'undefined') return null;
  const space = document.getElementById('space');
  if (!space) return null;
  let stage = space.querySelector(':scope > .pl-stage');
  if (!stage) {
    stage = document.createElement('div');
    stage.className = 'pl-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = '<i class="pl-milky"></i>';
    space.append(stage);
  }
  return stage;
}

let activeTransition = null;

function cancelTransition() {
  if (!activeTransition) return;
  const t = activeTransition;
  activeTransition = null;
  t.cancel();
}

export function mountPlanetBackdrop() {
  if (typeof document === 'undefined') return;
  const id = currentPlanet();
  document.documentElement.dataset.planet = id;

  // On paper and night themes, keep #space free of planet DOM so no textures load.
  if (!isBackdropTheme()) {
    cancelTransition();
    document.querySelector('#space > .pl-stage')?.remove();
    return;
  }

  const stage = ensureStage();
  if (!stage) return;

  const existing = stage.querySelector(':scope > .pl-world:not(.is-leaving)');
  if (existing && existing.dataset.p === id) return;

  cancelTransition();
  stage.querySelectorAll('.pl-world').forEach(n => n.remove());
  stage.append(createWorld(id));
}

function resolveAccentFor(theme, preserveCustom) {
  if (preserveCustom && S.settings?.accent) return S.settings.accent;
  return theme.accent;
}

export function setPlanetTheme(id, { animate = true } = {}) {
  S.settings ??= { goal: 10 };
  const theme = getTheme(id);
  const prevId = currentPlanet();
  const firstPick = S.settings.planet === undefined;

  // Switching to a different planet (or picking a planet for the first time) adopts
  // its native accent. Re-applying the same planet preserves a user-chosen custom accent.
  if (prevId !== theme.id || firstPick) {
    S.settings.customAccentFor = null;
    delete S.settings.accent;
  }
  S.settings.planet = theme.id;

  const keepCustom = !!S.settings.accent && S.settings.customAccentFor === theme.id;
  const acc = resolveAccentFor(theme, keepCustom);
  persist();

  if (typeof document === 'undefined') return Promise.resolve(theme.id);

  cancelTransition();

  const h = document.documentElement;
  const prevDomId = h.dataset.planet || prevId;
  const visualActive = isBackdropTheme();
  const mode = motion();
  const changed = prevDomId !== theme.id;
  const playFull = animate && visualActive && changed && full() && !document.hidden;
  const playFade = animate && visualActive && changed && mode === 'reduced' && !document.hidden;

  h.dataset.planet = theme.id;
  h.style.setProperty('--acc', acc);

  window.dispatchEvent(new CustomEvent('mp-planet', { detail: theme.id }));
  window.dispatchEvent(new Event('mp-theme'));

  if (!visualActive) {
    mountPlanetBackdrop();
    return Promise.resolve(theme.id);
  }

  const stage = ensureStage();
  if (!stage) return Promise.resolve(theme.id);

  if (!playFull && !playFade) {
    stage.querySelectorAll('.pl-world').forEach(n => n.remove());
    stage.append(createWorld(theme.id));
    return Promise.resolve(theme.id);
  }

  const oldWorlds = [...stage.querySelectorAll(':scope > .pl-world')];
  const nextWorld = createWorld(theme.id);

  if (playFade) {
    // Reduced motion: static planets, gentle opacity crossfade only.
    nextWorld.classList.add('is-fading-in');
    stage.append(nextWorld);
    oldWorlds.forEach(w => w.classList.add('is-fading-out'));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      nextWorld.classList.add('is-settled');
    }));

    return new Promise(resolve => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (activeTransition?.finish === finish) activeTransition = null;
        oldWorlds.forEach(w => w.remove());
        nextWorld.classList.remove('is-fading-in', 'is-settled');
        resolve(theme.id);
      };
      const timer = setTimeout(finish, 340);
      activeTransition = {
        finish,
        cancel() { clearTimeout(timer); finish(); },
      };
    });
  }

  // Full motion: ~900 ms colour wave sweeping from the new planet's arrival edge,
  // old planet sliding out, new planet rising into view.
  const [wx, wy] = WAVE_ORIGIN[theme.id] || ['88%', '88%'];
  const wave = document.createElement('div');
  wave.className = 'pl-wave';
  wave.setAttribute('aria-hidden', 'true');
  wave.style.setProperty('--wx', wx);
  wave.style.setProperty('--wy', wy);
  wave.style.setProperty('--wacc', acc);
  wave.innerHTML = '<i class="pl-wave-ring"></i><i class="pl-wave-wash"></i>';
  document.body.append(wave);

  nextWorld.classList.add('is-entering');
  stage.append(nextWorld);
  oldWorlds.forEach(w => w.classList.add('is-leaving'));

  // Force style flush so the entering transform animates smoothly from its off-edge pose.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (nextWorld.isConnected) nextWorld.classList.add('is-arrived');
  }));

  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (activeTransition?.finish === finish) activeTransition = null;
      oldWorlds.forEach(w => w.remove());
      nextWorld.classList.remove('is-entering', 'is-arrived');
      wave.remove();
      resolve(theme.id);
    };
    const timer = setTimeout(finish, 900);
    activeTransition = {
      finish,
      cancel() { clearTimeout(timer); finish(); },
    };
  });
}
