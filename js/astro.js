// Nova — the astronaut tutor. Talks to Claude (Anthropic SDK) or Gemini (Google REST) with the student's own API key.
import Anthropic from '../vendor/anthropic.mjs';
import { esc, icon, toast } from './ui.js';
import { renderNote } from './tools.js';
import * as db from './db.js';
import { full, motion, asleep } from './fx.js';

let svgUid = 0;
const reduceQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const motionMode = () => (typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off') ? 'off' : motion();

const POKE_VARIANTS = ['giggle', 'highfive', 'spin', 'blush'];
const REACT_DURS = { celebrate: 2600, think: Infinity, talk: Infinity, done: 2100, error: 2600, review: 2600, hello: 2000, poke: 1900, wake: 750 };
const ALL_REACT_CLS = ['react-celebrate', 'react-think', 'react-talk', 'react-done', 'react-error', 'react-review', 'react-hello', 'react-poke', 'react-poke-giggle', 'react-poke-highfive', 'react-poke-spin', 'react-poke-blush', 'react-wake'];
const ALL_ACT_CLS = ['act-somersault', 'act-wave', 'act-stretch', 'act-catch', 'act-juggle', 'act-peek', 'act-boost', 'act-book'];

// Dispatches a reaction event to every mounted Nova (board roamer, chat header, empty state).
export function novaReact(kind) {
  if (typeof window === 'undefined' || !kind) return;
  window.dispatchEvent(new CustomEvent('nova-react', { detail: kind }));
}

function clearNovaStates(svg) {
  svg.classList.remove(...ALL_REACT_CLS, ...ALL_ACT_CLS, 'mood-sleep', 'is-blinking');
}

// Lightweight controller for CSS-animated Novas (chat header and empty state):
// random-interval blinking, nova-react responses, optional idle acts, click-to-poke, visibility pause.
function attachNova(svg, { idleActs = null, clickable = true } = {}) {
  if (!svg || typeof window === 'undefined') return () => { };
  svg.dataset.novaLive = '1';
  let blinkTimer = 0, blinkOff = 0, doubleTimer = 0, reactTimer = 0, idleTimer = 0, actEnd = 0;
  let lastPoke = '', lastIdle = '', activeReact = null, dead = false;

  const stopBlink = () => { clearTimeout(blinkTimer); clearTimeout(blinkOff); clearTimeout(doubleTimer); blinkTimer = blinkOff = doubleTimer = 0; svg.classList.remove('is-blinking'); };
  const stopIdle = () => { clearTimeout(idleTimer); clearTimeout(actEnd); idleTimer = actEnd = 0; svg.classList.remove(...ALL_ACT_CLS); };

  const alive = () => !dead && svg.isConnected;
  const doBlink = (again = false) => {
    if (!alive() || document.hidden || motionMode() !== 'full') return;
    if (!activeReact || activeReact === 'talk' || activeReact === 'review') {
      svg.classList.add('is-blinking');
      blinkOff = setTimeout(() => svg.classList.remove('is-blinking'), 155);
    }
    if (!again && Math.random() < .24) doubleTimer = setTimeout(() => doBlink(true), 240);
    else scheduleBlink();
  };
  const scheduleBlink = () => {
    clearTimeout(blinkTimer);
    if (!alive() || document.hidden || motionMode() !== 'full') return;
    blinkTimer = setTimeout(() => doBlink(false), 2100 + Math.random() * 4300);
  };

  const scheduleIdle = () => {
    clearTimeout(idleTimer);
    if (!idleActs?.length || !alive() || document.hidden || motionMode() !== 'full') return;
    idleTimer = setTimeout(() => {
      if (!alive() || document.hidden || motionMode() !== 'full') return;
      if (activeReact) { scheduleIdle(); return; }
      const choices = idleActs.filter(a => a !== lastIdle);
      const act = choices[Math.floor(Math.random() * choices.length)] || idleActs[0];
      lastIdle = act;
      const dur = act === 'juggle' ? 3800 : 2600;
      svg.classList.remove(...ALL_ACT_CLS);
      svg.getBoundingClientRect();
      svg.classList.add('act-' + act);
      clearTimeout(actEnd);
      actEnd = setTimeout(() => { svg.classList.remove('act-' + act); scheduleIdle(); }, dur);
    }, 6500 + Math.random() * 7500);
  };

  const syncMode = () => {
    if (!alive()) return destroy();
    const m = motionMode();
    if (m === 'full' && !document.hidden) {
      svg.dataset.novaBlink = 'js';
      if (!blinkTimer) scheduleBlink();
      if (idleActs?.length && !idleTimer && !actEnd) scheduleIdle();
    } else {
      stopBlink();
      stopIdle();
      delete svg.dataset.novaBlink;
      if (m === 'off') { clearTimeout(reactTimer); activeReact = null; clearNovaStates(svg); }
    }
  };

  const onReact = e => {
    if (!alive()) return destroy();
    const kind = e.detail;
    if (!kind || !(kind in REACT_DURS) || motionMode() === 'off') return;
    clearTimeout(reactTimer); reactTimer = 0;
    stopIdle();
    svg.classList.remove(...ALL_REACT_CLS, 'mood-sleep');
    svg.getBoundingClientRect();
    activeReact = kind;
    if (kind === 'poke') {
      const opts = POKE_VARIANTS.filter(v => v !== lastPoke);
      const v = opts[Math.floor(Math.random() * opts.length)];
      lastPoke = v;
      svg.classList.add('react-poke', 'react-poke-' + v);
    } else {
      svg.classList.add('react-' + kind);
    }
    const dur = REACT_DURS[kind];
    if (Number.isFinite(dur)) {
      reactTimer = setTimeout(() => {
        svg.classList.remove(...ALL_REACT_CLS);
        activeReact = null;
        if (idleActs?.length) scheduleIdle();
      }, dur);
    }
  };

  const onClick = () => { if (motionMode() !== 'off') novaReact('poke'); };
  const onVis = () => syncMode();
  const onTheme = () => syncMode();

  window.addEventListener('nova-react', onReact);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('mp-theme', onTheme);
  reduceQ.addEventListener?.('change', onTheme);
  if (clickable) svg.addEventListener('click', onClick);
  syncMode();

  function destroy() {
    if (dead) return;
    dead = true;
    stopBlink(); stopIdle(); clearTimeout(reactTimer);
    window.removeEventListener('nova-react', onReact);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('mp-theme', onTheme);
    reduceQ.removeEventListener?.('change', onTheme);
    if (clickable) svg.removeEventListener('click', onClick);
  }
  return destroy;
}

let emptyScan = false;
function scheduleEmptyNovas() {
  if (emptyScan || typeof document === 'undefined') return;
  emptyScan = true;
  const run = () => {
    emptyScan = false;
    document.querySelectorAll('.astro.float:not([data-nova-live])').forEach(svg => {
      attachNova(svg, { idleActs: ['wave', 'juggle'], clickable: true });
    });
  };
  queueMicrotask(() => { run(); setTimeout(run, 0); });
}

// Nova the astronaut, designed by Gemini 4 Neon. Loops & character choreography live in app.css.
export const astronaut = (cls = '') => {
  const vid = `av-${++svgUid}`;
  const bd = (-Math.random() * 4.5).toFixed(2);
  const bdur = (4.2 + Math.random() * 2.4).toFixed(2);
  if (/\bfloat\b/.test(cls)) scheduleEmptyNovas();
  return `<svg class='astro loop ${cls}' viewBox='0 0 100 124' style='--bd:${bd}s;--b-dur:${bdur}s' aria-hidden='true'><defs><clipPath id='${vid}'><path d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/></clipPath></defs><g class='astro-body'><g class='a-jet'><g class='a-jet-l'><path class='a-jet-outer' d='M 30.2 86 Q 33.5 100 36.8 86 Z'/><path class='a-jet-core' d='M 31.8 86 Q 33.5 94 35.2 86 Z'/></g><g class='a-jet-r'><path class='a-jet-outer' d='M 63.2 86 Q 66.5 100 69.8 86 Z'/><path class='a-jet-core' d='M 64.8 86 Q 66.5 94 68.2 86 Z'/></g></g><rect class='a-pack' x='26.5' y='55.5' width='47' height='31' rx='7'/><g class='a-leg-l'><path class='a-suit' d='M 35 86 L 34.5 104.5 C 32.2 106.5 31.8 110.5 33.5 112.8 C 34.8 114.2 36.8 114.5 39.5 114.5 L 44.5 114.5 C 46.8 114.5 47.5 113 47.5 110.5 L 47.5 86 Z'/><path class='a-line' d='M 34.8 105.2 Q 41 106.6 47.2 105.2'/><rect class='a-line' x='38.2' y='94.5' width='5.6' height='4.6' rx='2'/></g><g class='a-leg-r'><path class='a-suit' d='M 65 86 L 65.5 104.5 C 67.8 106.5 68.2 110.5 66.5 112.8 C 65.2 114.2 63.2 114.5 60.5 114.5 L 55.5 114.5 C 53.2 114.5 52.5 113 52.5 110.5 L 52.5 86 Z'/><path class='a-line' d='M 52.8 105.2 Q 59 106.6 65.2 105.2'/><rect class='a-line' x='56.2' y='94.5' width='5.6' height='4.6' rx='2'/></g><g class='a-arm-l'><path class='a-suit' d='M 34 67.4 C 27.5 68 23.5 74 22.2 83.5 C 20.5 87.5 22.5 91.8 26.2 91.5 C 29.8 91.2 31.5 88.2 30.5 85 C 31.5 81 32.5 78 34 76.6 Z'/><path class='a-line' d='M 22.5 83.6 Q 26.5 85.4 30.3 85'/></g><g class='astro-wave'><path class='a-suit' d='M 66 67.4 C 71 67.4 74.5 64 77 58.5 C 75.5 56 76 52.5 79 51 C 82 48.2 87 49 88.2 52.5 C 89.2 55.5 87.5 59 84.5 61 C 82 67.5 76 76 66 76.6 A 4.6 4.6 0 0 1 66 67.4 Z'/><path class='a-line' d='M 77.2 58.6 Q 81.2 58.4 84.3 60.8'/></g><path class='a-suit' d='M 36.5 64 C 34 65 34 69 34 74 L 34.5 85 C 34.5 88.5 37 90 41 90 L 59 90 C 63 90 65.5 88.5 65.5 85 L 66 74 C 66 69 66 65 63.5 64 Z'/><path class='a-line' d='M 34.5 84.5 Q 50 86.2 65.5 84.5'/><rect class='a-fill' x='46.5' y='83.5' width='7' height='3.6' rx='1.4'/><path class='a-line' d='M 30 59.5 C 29 66.5 32.5 74.5 41 75.8'/><rect class='a-suit' x='40.5' y='71' width='19' height='9.6' rx='2.6'/><circle class='a-blink' cx='45' cy='75.8' r='1.6'/><circle class='a-blink' cx='50' cy='75.8' r='1.6'/><circle class='a-fill' cx='55' cy='75.8' r='1.7'/><path class='a-suit' d='M 36.5 58.5 L 63.5 58.5 L 63 64.5 Q 50 68.5 37 64.5 Z'/><g class='a-head'><rect class='a-suit' x='22.2' y='35' width='6' height='10' rx='3'/><rect class='a-suit' x='71.8' y='35' width='6' height='10' rx='3'/><line class='a-line' x1='50' y1='18.2' x2='50' y2='11.8'/><circle class='a-blink' cx='50' cy='9.2' r='2.6'/><g class='a-fx-sparks'><circle class='a-spark-ring' cx='50' cy='9.2' r='4.2'/><path class='a-spark-ray' d='M 50 3.2 L 50 -1.2 M 44.6 5.2 L 41 2.2 M 55.4 5.2 L 59 2.2 M 42.6 10.4 L 38.2 11.2 M 57.4 10.4 L 61.8 11.2'/></g><ellipse class='a-suit' cx='50' cy='40' rx='24.5' ry='22'/><path class='a-visor' d='M 50 27.5 C 63.5 27.5 69 32.5 69 42 C 69 51 63 55.5 50 55.5 C 37 55.5 31 51 31 42 C 31 32.5 36.5 27.5 50 27.5 Z'/><g clip-path='url(#${vid})'><g class='a-face'><g class='a-gaze'><g class='a-eyes'><g class='a-eyes-norm'><rect class='a-eye' x='40.8' y='37.5' width='4.4' height='6.4' rx='2.2'/><rect class='a-eye' x='54.8' y='37.5' width='4.4' height='6.4' rx='2.2'/><circle class='a-pupil' cx='43.8' cy='39.3' r='0.95'/><circle class='a-pupil' cx='57.8' cy='39.3' r='0.95'/></g><g class='a-eyes-happy'><path class='a-eye-arc' d='M 39.6 42.2 Q 43 37.2 46.4 42.2'/><path class='a-eye-arc' d='M 53.6 42.2 Q 57 37.2 60.4 42.2'/></g><g class='a-eyes-sleep'><path class='a-eye-arc' d='M 39.8 41.2 Q 43 44.4 46.2 41.2'/><path class='a-eye-arc' d='M 53.8 41.2 Q 57 44.4 60.2 41.2'/></g><g class='a-eyes-dizzy'><path class='a-eye-arc' d='M 40.6 38.6 L 45.4 43.4 M 45.4 38.6 L 40.6 43.4 M 54.6 38.6 L 59.4 43.4 M 59.4 38.6 L 54.6 43.4'/></g></g><g class='a-blush'><ellipse cx='38' cy='46' rx='2.8' ry='1.4'/><ellipse cx='62' cy='46' rx='2.8' ry='1.4'/></g><g class='a-mouth'><path class='a-m-smile' d='M 47.4 47.4 Q 50 49.5 52.6 47.4'/><path class='a-m-happy' d='M 46 46.6 Q 50 51.4 54 46.6'/><ellipse class='a-m-o' cx='50' cy='48.2' rx='2.1' ry='2.5'/><path class='a-m-think' d='M 47.2 48.2 Q 50 47.2 52.8 48.4'/></g></g><g class='a-v-think'><g class='a-v-orb-spin'><ellipse class='a-v-orb' cx='50' cy='41.5' rx='12.5' ry='5.2' transform='rotate(-15 50 41.5)'/><circle class='a-v-orb-dot' cx='62.1' cy='38.3' r='1.7'/></g><circle class='a-v-dot d1' cx='44' cy='49.2' r='1.35'/><circle class='a-v-dot d2' cx='50' cy='49.2' r='1.35'/><circle class='a-v-dot d3' cx='56' cy='49.2' r='1.35'/></g><g class='a-v-talk'><rect class='a-eq b1' x='41' y='45.8' width='2.2' height='6.4' rx='1.1'/><rect class='a-eq b2' x='44.9' y='45.8' width='2.2' height='6.4' rx='1.1'/><rect class='a-eq b3' x='48.9' y='45.8' width='2.2' height='6.4' rx='1.1'/><rect class='a-eq b4' x='52.9' y='45.8' width='2.2' height='6.4' rx='1.1'/><rect class='a-eq b5' x='56.8' y='45.8' width='2.2' height='6.4' rx='1.1'/></g></g><rect class='a-glint' x='38' y='24' width='8' height='35' transform='rotate(18 42 41.5)'/></g><path class='a-shine' d='M 36.5 39 C 36.5 35 39.5 32.5 44.5 32'/><g class='a-fx-dizzy'><g class='dz-x' style='--dd:0s'><g class='dz-y'><path class='a-star-acc' d='M 50 10.6 L 50.9 13.1 L 53.4 14 L 50.9 14.9 L 50 17.4 L 49.1 14.9 L 46.6 14 L 49.1 13.1 Z'/></g></g><g class='dz-x' style='--dd:-0.53s'><g class='dz-y'><path class='a-star-w' d='M 50 11 L 50.8 13.2 L 53 14 L 50.8 14.8 L 50 17 L 49.2 14.8 L 47 14 L 49.2 13.2 Z'/></g></g><g class='dz-x' style='--dd:-1.06s'><g class='dz-y'><path class='a-star-acc' d='M 50 10.8 L 50.8 13.2 L 53.2 14 L 50.8 14.8 L 50 17.2 L 49.2 14.8 L 46.8 14 L 49.2 13.2 Z'/></g></g></g><g class='a-fx-review'><circle class='a-rev-dot' cx='72' cy='25' r='1.3'/><circle class='a-rev-dot' cx='75.5' cy='20.5' r='1.7'/><text class='a-rev-q' x='78' y='15' text-anchor='middle'>?</text></g><g class='a-fx-wake'><path class='a-wake-ray' d='M 70 16 L 76 11 M 73.5 20 L 80 18.5 M 66.5 13 L 69 7'/></g><g class='a-fx-poke'><path class='a-star-acc a-pk1' d='M 74 20 L 75.1 22.9 L 78 24 L 75.1 25.1 L 74 28 L 72.9 25.1 L 70 24 L 72.9 22.9 Z'/><path class='a-star-w a-pk2' d='M 26 23 L 26.8 25.2 L 29 26 L 26.8 26.8 L 26 29 L 25.2 26.8 L 23 26 L 25.2 25.2 Z'/></g></g><g class='a-fx-hand'><circle class='a-hand-ring' cx='84' cy='52' r='6'/><path class='a-hand-ray' d='M 84 42 L 84 38.5 M 92 46 L 95 43.5 M 93.5 54 L 97 54.5 M 78 44 L 75.5 41.5'/><path class='a-star-acc a-hand-star' d='M 84 47.6 L 85.1 50.9 L 88.4 52 L 85.1 53.1 L 84 56.4 L 82.9 53.1 L 79.6 52 L 82.9 50.9 Z'/></g><g class='a-prop-star'><path class='a-fall-tail' d='M 88 47 L 99 35'/><path class='a-star-acc a-fall-body' d='M 84 46.5 L 85.4 50.6 L 89.5 52 L 85.4 53.4 L 84 57.5 L 82.6 53.4 L 78.5 52 L 82.6 50.6 Z'/><circle class='a-fall-ring' cx='84' cy='52' r='5.5'/></g><g class='a-prop-book'><path class='a-suit' d='M 50 61 Q 42 58 34 61 L 34 73 Q 42 70 50 73 Z'/><path class='a-suit' d='M 50 61 Q 58 58 66 61 L 66 73 Q 58 70 50 73 Z'/><line class='a-line' x1='50' y1='61' x2='50' y2='73'/><path class='a-book-txt' d='M 37.5 64.5 L 46 63.8 M 37.5 68 L 45.5 67.4 M 54 63.8 L 62.5 64.5 M 54.5 67.4 L 62 68'/></g></g><g class='a-prop-juggle'><text class='a-jglyph j1' x='50' y='52' text-anchor='middle'>Σ</text><text class='a-jglyph j2' x='50' y='52' text-anchor='middle'>∫</text><text class='a-jglyph j3' x='50' y='52' text-anchor='middle'>π</text><text class='a-jglyph j4' x='50' y='52' text-anchor='middle'>∞</text></g><g class='a-prop-zzz'><text class='a-zzz z1' x='68' y='24'>Z</text><text class='a-zzz z2' x='68' y='24'>z</text><text class='a-zzz z3' x='68' y='24'>z</text></g><g class='a-fx-celebrate'><path class='a-cstar a-star-acc' style='--tx:-34px;--ty:-36px;--r:-45deg;--d:0ms' d='M 50 47.8 L 51 51 L 54.2 52 L 51 53 L 50 56.2 L 49 53 L 45.8 52 L 49 51 Z'/><path class='a-cstar a-star-w' style='--tx:36px;--ty:-34px;--r:55deg;--d:60ms' d='M 50 48.2 L 50.9 51.1 L 53.8 52 L 50.9 52.9 L 50 55.8 L 49.1 52.9 L 46.2 52 L 49.1 51.1 Z'/><path class='a-cstar a-star-w' style='--tx:-40px;--ty:14px;--r:-70deg;--d:110ms' d='M 50 48.4 L 50.8 51.2 L 53.6 52 L 50.8 52.8 L 50 55.6 L 49.2 52.8 L 46.4 52 L 49.2 51.2 Z'/><path class='a-cstar a-star-acc' style='--tx:38px;--ty:16px;--r:65deg;--d:80ms' d='M 50 48 L 51 51 L 54 52 L 51 53 L 50 56 L 49 53 L 46 52 L 49 51 Z'/><rect class='a-cstar a-conf-w' style='--tx:-16px;--ty:-46px;--r:-120deg;--d:40ms' x='47.5' y='51' width='5' height='2' rx='1'/><rect class='a-cstar a-conf-acc' style='--tx:18px;--ty:-44px;--r:135deg;--d:90ms' x='47.5' y='51' width='5' height='2' rx='1'/><rect class='a-cstar a-conf-acc' style='--tx:-30px;--ty:-12px;--r:-95deg;--d:140ms' x='47.5' y='51' width='5' height='2' rx='1'/><rect class='a-cstar a-conf-w' style='--tx:32px;--ty:-10px;--r:110deg;--d:50ms' x='47.5' y='51' width='5' height='2' rx='1'/></g></svg>`;
};

// Nova's ship, designed by Gemini 4 Neon. The tether leaves from the s-port ring at (46, 66).
export const ship = (cls = '') => {
  const cid = `sc-${++svgUid}`;
  return `<svg class='ship ${cls}' viewBox='0 0 160 90' aria-hidden='true'><defs><clipPath id='${cid}'><path d='M 23.5 36 C 25.5 22.5 37.5 18 48.5 19.5 C 55.5 20.5 60 25.5 59.5 32.5 C 59 38 52.5 40.5 42 41 C 30.5 41.5 23 40.5 23.5 36 Z'/></clipPath></defs><g class='s-flame'><path d='M 118 41.5 Q 132 41.5 141 47 Q 132 52.5 118 52.5 Z'/><path d='M 118 44.2 Q 126.5 44.2 131.5 47 Q 126.5 49.8 118 49.8 Z'/></g><g class='s-hull'><line class='a-pack' x1='91' y1='60' x2='93' y2='72.5'/><line class='a-pack' x1='85' y1='72.5' x2='100' y2='72.5'/><path class='a-pack' d='M 78 29 C 87 20 98 14 109 14 C 113 14 113.5 18 110.5 23 C 107.5 28 106 32.5 105.5 37.5 Z'/><path class='a-pack' d='M 93 55 C 103 57.5 111.5 60.5 112.5 63.5 C 113.5 66 108.5 67 101 65 L 90 61.5 Z'/><line class='a-line' x1='69.5' y1='26' x2='69.5' y2='14.5'/><path class='a-line' d='M 65 18 Q 69.5 21.5 74 18'/><circle class='s-beacon-ring' cx='69.5' cy='12' r='2.5'/><circle class='s-beacon' cx='69.5' cy='12' r='2.5'/><line class='a-line' x1='62' y1='63.5' x2='60' y2='77'/><line class='a-line' x1='81' y1='62' x2='83' y2='77'/><path class='a-line' d='M 53.5 73.5 Q 56 77 61 77 L 89 77'/><path class='a-suit' d='M 106 40.5 L 120 38.5 C 122.8 38.5 122.8 55.5 120 55.5 L 106 53.5 Z'/><line class='a-line' x1='114.5' y1='39.3' x2='114.5' y2='54.7'/><path class='a-suit' d='M 14 48 C 14 34 30 25 56 25 C 80 25 99 30 108 37 C 111.5 41 111.5 52 108 56 C 99 61 80 64.5 54 64.5 C 29 64.5 14 58.5 14 48 Z'/><path class='a-line' d='M 28 40.5 C 25.5 48.5 27 56.5 31.5 62.3'/><path class='a-line' d='M 99.4 32.2 C 95.8 41 95.8 51 99.4 59.4'/><path class='s-hatch-beam' d='M 41 61.5 L 51 61.5 L 57.5 74 L 34.5 74 Z'/><rect class='s-hatch-frame' x='40' y='49' width='12' height='12.5' rx='2'/><rect class='s-hatch-glow' x='41.4' y='54.6' width='9.2' height='5.6' rx='1'/><rect class='s-hatch-light' x='42.2' y='51.2' width='7.6' height='2.2' rx='1.1'/><path class='a-visor' d='M 23.5 36 C 25.5 22.5 37.5 18 48.5 19.5 C 55.5 20.5 60 25.5 59.5 32.5 C 59 38 52.5 40.5 42 41 C 30.5 41.5 23 40.5 23.5 36 Z'/><g clip-path='url(#${cid})'><rect class='s-glint' x='12' y='16' width='7' height='28'/></g><circle class='s-window' cx='69' cy='40.5' r='4.2'/><circle class='s-window' cx='83.5' cy='42' r='4.2'/><path class='a-suit' d='M 61 54.5 C 71 52 82 52 90 55 C 96 57.5 98.5 61.5 96 64.5 C 93.5 67 85 66.5 74.5 63.5 C 65 61 58 58 61 54.5 Z'/><circle class='a-blink' cx='20.5' cy='50.5' r='1.8'/><circle class='a-blink' cx='90.5' cy='60.5' r='1.8'/><circle class='a-fill' cx='33.5' cy='47.5' r='1.5'/><circle class='a-fill' cx='34' cy='55.5' r='1.5'/><circle class='a-fill' cx='93' cy='36.5' r='1.5'/><circle class='a-fill' cx='92' cy='48' r='1.5'/><circle class='s-port' cx='46' cy='66' r='3'/></g></svg>`;
};

// ---------- providers & models (all kept in this browser only; never in backups) ----------
const LS = {
  get(k, d = '') { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { } },
};
export const PROVIDERS = {
  claude: { name: 'Claude', by: 'Anthropic', keyLs: 'mp.apiKey', hint: 'sk-ant-…', re: /^sk-ant-/, link: 'https://console.anthropic.com/settings/keys', site: 'console.anthropic.com', def: 'claude-opus-5-5' },
  gemini: { name: 'Gemini', by: 'Google', keyLs: 'mp.geminiKey', hint: 'AIza…', re: /^AIza/, link: 'https://aistudio.google.com/apikey', site: 'aistudio.google.com', def: 'gemini-2.5-flash' },
};
export const provider = () => PROVIDERS[LS.get('mp.aiProvider')] ? LS.get('mp.aiProvider') : 'claude';
export const getKey = (p = provider()) => LS.get(PROVIDERS[p].keyLs);
const setKey = (p, k) => LS.set(PROVIDERS[p].keyLs, k);
export const model = (p = provider()) => LS.get('mp.aiModel.' + p, PROVIDERS[p].def);
const setModel = (p, m) => LS.set('mp.aiModel.' + p, m);
const cachedModels = p => { try { return JSON.parse(LS.get('mp.aiModels.' + p, '[]')); } catch { return []; } };

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
// Fetch the models this key can use; newest first. Cached so the pickers fill instantly next time.
async function listModels(p) {
  const key = getKey(p); if (!key) return [];
  let list;
  if (p === 'claude') {
    const page = await new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }).models.list({ limit: 100 });
    list = page.data.map(m => ({ id: m.id, name: m.display_name || m.id }));
  } else {
    const res = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw await geminiError(res);
    list = ((await res.json()).models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent') && /gemini/.test(m.name) && !/tts|embed|image|audio|live/.test(m.name))
      .map(m => ({ id: m.name.replace(/^models\//, ''), name: m.displayName || m.name })).reverse();
  }
  LS.set('mp.aiModels.' + p, JSON.stringify(list));
  if (list.length && !list.some(m => m.id === model(p))) setModel(p, (list.find(m => /flash/.test(m.id)) || list[0]).id);
  return list;
}

async function geminiError(res) {
  const j = await res.json().catch(() => null), msg = j?.error?.message || res.statusText;
  return Object.assign(new Error(msg), { status: res.status, gemini: true, keyBad: /API key not valid|API_KEY_INVALID/i.test(msg) });
}

const SYSTEM = `Sen "Nova" adında, MathPad uygulamasının içindeki astronot ders asistanısın. Mühendislik öğrencilerine (özellikle Elektrik-Elektronik) soru çözmede yardım ediyorsun.
- Türkçe yaz; samimi ama kısa ve net ol.
- Varsayılan olarak öğret: önce yol göster ve ipucu ver. Öğrenci açıkça çözüm istemedikçe tam çözümü tek seferde verme.
- Matematiği LaTeX ile yaz: satır içinde $...$, ayrı satırda $$...$$. Başlık için "# ", madde için "- ", vurgu için **kalın** kullan; tablo veya kod bloğu kullanma.
- Gelen görsel, öğrencinin tahtasının o anki halidir: soru fotoğrafı ve el yazısıyla çözümü içerebilir. Okuyamadığın bir yer varsa bunu söyle, uydurma.
- Sayısal sonuçları birimiyle ver. Emin olmadığın yerde bunu belirt.`;
const ACTIONS = [
  ['hint', 'İpucu ver', 'Bu soru için bir sonraki adımı gösterecek kısa bir ipucu ver. Çözümü verme.'],
  ['check', 'Çözümümü kontrol et', 'Tahtadaki çözümümü kontrol et: doğru mu, hata varsa nerede? Hatayı göster ama soruyu baştan çözme.'],
  ['steps', 'Adım adım çöz', 'Bu soruyu adım adım çöz; her adımı kısaca açıkla.'],
  ['explain', 'Konuyu anlat', 'Bu sorunun konusunu kısa ve sezgisel anlat, kullanılan temel formülleri ver.'],
  ['similar', 'Benzer soru üret', 'Bu soruya benzeyen ama sayıları ve koşulları farklı yeni bir alıştırma sorusu yaz. Çözümünü verme, sadece soruyu yaz; en sonda tek satırda **Cevap:** ile sadece sonucu ver.'],
];

function friendlyError(err) {
  if (err?.gemini) {
    if (err.keyBad || err.status === 401) return 'Gemini API anahtarı geçersiz görünüyor. Ayarlar → Astronot asistan bölümünden kontrol et.';
    if (err.status === 403) return 'Bu anahtarın bu modele erişimi yok.';
    if (err.status === 404) return 'Bu model bulunamadı. Ayarlar\'dan başka bir model seç.';
    if (err.status === 429) return 'Kota doldu ya da çok sık soru soruldu; biraz sonra tekrar dene.';
    return `Gemini hatası (${err.status}): ${err.message}`;
  }
  if (err instanceof TypeError) return 'İnternete bağlanılamadı. Nova\'nın çalışması için internet gerekiyor.';
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API anahtarı geçersiz görünüyor. Ayarlar → Astronot asistan bölümünden kontrol et.';
  if (err instanceof Anthropic.PermissionDeniedError) return 'Bu anahtarın bu modele erişimi yok.';
  if (err instanceof Anthropic.NotFoundError) return 'Bu model bulunamadı. Ayarlar\'dan başka bir model seç.';
  if (err instanceof Anthropic.RateLimitError) return 'Çok sık soru soruldu ya da kredi limiti doldu; biraz sonra tekrar dene.';
  if (err instanceof Anthropic.APIConnectionError) return 'İnternete bağlanılamadı. Nova\'nın çalışması için internet gerekiyor.';
  if (err instanceof Anthropic.APIError) return `Sunucu hatası (${err.status}). Biraz sonra tekrar dene.`;
  return err?.message || 'Bilinmeyen bir hata oluştu.';
}

// One streamed answer. hist: [{role:'user'|'assistant', text}], last entry is the new question.
// Returns { text, refused }. onText(snapshot) is called as text arrives.
async function ask({ hist, img, onText = () => { }, signal, system = SYSTEM }) {
  const p = provider(), m = model(p), key = getKey(p);
  const lastText = hist.at(-1).text;
  if (p === 'gemini') {
    const contents = hist.map((h, i) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [...(i === hist.length - 1 && img ? [{ inline_data: { mime_type: 'image/jpeg', data: img } }] : []), { text: h.text }],
    }));
    const res = await fetch(`${GEMINI}/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 8192 } }),
    });
    if (!res.ok) throw await geminiError(res);
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', finish = '';
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const j = JSON.parse(line.slice(5)), c = j.candidates?.[0];
        for (const part of c?.content?.parts || []) if (part.text && !part.thought) text += part.text;
        finish = c?.finishReason || finish;
        if (j.promptFeedback?.blockReason) finish = 'SAFETY';
        onText(text);
      }
    }
    return { text, refused: !text && /SAFETY|PROHIBITED|BLOCKLIST|RECITATION/.test(finish) };
  }
  // Claude
  const messages = hist.map((h, i) => ({
    role: h.role,
    content: i === hist.length - 1 && img ? [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img } }, { type: 'text', text: lastText }] : h.text,
  }));
  const modern = /claude-(opus|sonnet|haiku)-5|fable|mythos/.test(m); // effort + server-side fallbacks only on these
  const stream = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }).beta.messages.stream({
    model: m, max_tokens: 16000, system, messages,
    ...(modern && { output_config: { effort: 'medium' } }),
    ...(/^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5-[12])$/.test(m) && { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
  }, { signal });
  stream.on('text', (_d, snap) => onText(snap));
  const msg = await stream.finalMessage();
  return { text: msg.content.filter(b => b.type === 'text').map(b => b.text).join(''), refused: msg.stop_reason === 'refusal' };
}

// ---------- settings card: provider, key, model ----------
export function keyCard(el) {
  const p = provider(), P = PROVIDERS[p], has = !!getKey(p), models = cachedModels(p);
  el.innerHTML = `<h3 class="row">${astronaut('xs')} Astronot asistan Nova</h3>
    <p class="mute">Nova, soru sayfasında tahtana bakıp ipucu verir, çözümünü kontrol eder ya da adım adım anlatır. Kendi API anahtarınla çalışır.</p>
    <div class="set-row"><span>Yapay zeka</span><div class="seg" data-prov>${Object.entries(PROVIDERS).map(([k, v]) => `<button data-v="${k}" class="${k === p ? 'on' : ''}">${v.name} <small class="mute">${v.by}</small></button>`).join('')}</div></div>
    <ol class="mute small steps"><li><a href="${P.link}" target="_blank" rel="noopener">${P.site}</a> adresinde bir ${P.name} API anahtarı oluştur.</li><li>Aşağıya yapıştırıp <b>Kaydet</b>'e bas.</li></ol>
    <form class="row wrap" data-keyform><input class="inp mono" type="password" name="k" placeholder="${has ? '•••••••• (kayıtlı)' : P.hint}" autocomplete="off" style="max-width:340px" aria-label="${P.name} API anahtarı">
      <button class="btn primary">Kaydet</button>${has ? '<button type="button" class="btn ghost" data-keydel>Anahtarı sil</button>' : ''}</form>
    ${has ? `<div class="set-row"><span>Model</span><div class="row"><select class="inp" data-model style="max-width:320px" aria-label="Model">${modelOptions(p, models)}</select><button type="button" class="btn ghost small" data-refresh>Listeyi yenile</button></div></div>` : ''}
    <p class="mute small" data-note>Anahtarlar sadece bu cihazda saklanır; yedeklere ve paylaşılan ders dosyalarına girmez. Nova'ya sorduğunda tahtanın görüntüsü seçtiğin şirkete gönderilir.</p>`;
  el.querySelector('[data-prov]').onclick = e => { const v = e.target.closest('[data-v]')?.dataset.v; if (v && v !== p) { LS.set('mp.aiProvider', v); keyCard(el); } };
  const note = el.querySelector('[data-note]');
  const status = (msg, bad) => { note.textContent = msg; note.classList.toggle('err', !!bad); };
  el.querySelector('[data-keyform]').onsubmit = async e => {
    e.preventDefault();
    const k = e.target.k.value.replace(/\s+/g, '').replace(/^['"]+|['"]+$/g, ''); // pasted keys often carry spaces/quotes
    if (k.length < 20) return status('Anahtar çok kısa görünüyor; tamamını kopyaladığından emin ol.', true);
    // the key itself tells which company it belongs to: switch if the other tab was selected
    const q = Object.keys(PROVIDERS).find(x => PROVIDERS[x].re.test(k)) || p;
    if (q !== p) LS.set('mp.aiProvider', q);
    const old = getKey(q); setKey(q, k);
    e.target.querySelector('button').disabled = true;
    status(`${PROVIDERS[q].name} anahtarı kontrol ediliyor…`);
    try { await listModels(q); keyCard(el); toast(`${PROVIDERS[q].name} anahtarı doğrulandı, Nova hazır ✦`); }
    catch (err) {
      const rejected = err?.keyBad || err?.status === 400 || err?.status === 401 || err instanceof Anthropic.AuthenticationError;
      if (rejected) setKey(q, old); // keep a wrong key out; network trouble keeps it
      if (q !== p) keyCard(el);
      el.querySelector('[data-note]').textContent = `${friendlyError(err)}${err?.message ? ` — sunucunun cevabı: ${err.message}` : ''}`;
      el.querySelector('[data-note]').classList.add('err');
      el.querySelector('[data-keyform] button').disabled = false;
    }
  };
  el.querySelector('[data-keydel]')?.addEventListener('click', () => { setKey(p, ''); toast('Anahtar silindi'); keyCard(el); });
  el.querySelector('[data-model]')?.addEventListener('change', e => { setModel(p, e.target.value); toast(`Nova artık ${e.target.selectedOptions[0].text} kullanıyor ✦`); });
  el.querySelector('[data-refresh]')?.addEventListener('click', () => refresh(false));
  async function refresh(fresh) {
    try { await listModels(p); keyCard(el); toast(fresh ? 'Anahtar doğrulandı, Nova hazır ✦' : 'Model listesi yenilendi'); }
    catch (err) { toast(friendlyError(err)); }
  }
  if (has && !models.length) refresh(false);
}
const modelOptions = (p, models) => {
  const cur = model(p), list = models.some(m => m.id === cur) ? models : [{ id: cur, name: cur }, ...models];
  return list.map(m => `<option value="${esc(m.id)}" ${m.id === cur ? 'selected' : ''}>${esc(m.name)}${m.name !== m.id ? ` · ${esc(m.id)}` : ''}</option>`).join('');
};

// ---------- chat panel for one problem. getImage() → JPEG data URL of the board (or null) ----------
export function mountTutor(el, { problem, courseName, getImage, onPin, onNewProblem }) {
  let hist = [], ctrl = null;
  el.innerHTML = `<div class="astro-chat">
    <div class="astro-head">${astronaut('sm wave')}<div><b>Nova</b><span class="mute small">astronot asistanın</span></div>
      <select class="inp astro-model" data-amodel aria-label="Nova'nın modeli"></select></div>
    <div class="astro-log" aria-live="polite"></div>
    <div class="ex-row astro-quick">${ACTIONS.map(([k, l]) => `<button type="button" class="chip ex" data-q="${k}">${l}</button>`).join('')}</div>
    <form class="astro-in"><textarea class="inp" rows="2" placeholder="Nova'ya sor… (Enter gönderir)" aria-label="Nova'ya mesaj"></textarea><button class="btn primary" aria-label="Gönder">${icon('arrow')}</button></form>
    <label class="astro-att small mute"><input type="checkbox" checked data-img> Tahtanın görüntüsünü de gönder</label></div>`;
  const stopNova = attachNova(el.querySelector('.astro'), { clickable: true });
  novaReact('hello');
  const log = el.querySelector('.astro-log'), ta = el.querySelector('textarea'), form = el.querySelector('form'), sel = el.querySelector('[data-amodel]');
  // quick model switch: models of every provider that has a key
  const fillModels = () => {
    const ps = Object.keys(PROVIDERS).filter(k => getKey(k));
    sel.hidden = !ps.length;
    sel.innerHTML = ps.map(k => `<optgroup label="${PROVIDERS[k].name}">${modelOptions(k, cachedModels(k)).replaceAll('value="', `value="${k}|`)}</optgroup>`).join('');
    sel.value = `${provider()}|${model()}`;
  };
  sel.onchange = () => { const [k, m] = sel.value.split('|'); LS.set('mp.aiProvider', k); setModel(k, m); };
  fillModels();
  const actions = text => `<div class="msg-acts"><button type="button" class="chip" data-pin>📌 Tahtaya iğnele</button><button type="button" class="chip" data-newq>${icon('plus')} Yeni soru yap</button></div>`;
  log.onclick = e => {
    const msg = e.target.closest('.msg'); if (!msg?.dataset.i) return;
    const text = hist[+msg.dataset.i]?.text; if (!text) return;
    if (e.target.closest('[data-pin]')) onPin?.(text);
    if (e.target.closest('[data-newq]')) onNewProblem?.(text);
  };
  const bubble = (role, html) => {
    const d = document.createElement('div'); d.className = `msg ${role}`; d.innerHTML = html;
    log.append(d); log.scrollTop = log.scrollHeight; return d;
  };
  const showAll = () => {
    log.innerHTML = '';
    if (!hist.length) bubble('assistant', `<p>Merhaba! Ben Nova ✦ Tahtana bakıp yardım edebilirim. Aşağıdan bir şey seç ya da sorunu yaz.</p>`);
    hist.forEach((m, i) => { const b = bubble(m.role, m.role === 'user' ? `<p>${esc(m.label || m.text)}</p>` : renderNote(m.text) + actions()); b.dataset.i = i; });
  };
  db.get('ai:' + problem.id).then(h => { hist = Array.isArray(h) ? h : []; showAll(); });

  async function send(text, label) {
    if (ctrl || !text.trim()) return;
    if (!getKey()) { bubble('assistant', `<p>Önce bana bir API anahtarı vermen gerekiyor: <a href="#/settings">Ayarlar → Astronot asistan</a>.</p>`); return; }
    bubble('user', `<p>${esc(label || text)}</p>`);
    const out = bubble('assistant thinking', `<p class="dots"><i></i><i></i><i></i> Nova düşünüyor</p>`);
    el.querySelector('.astro').classList.add('talking'); document.body.classList.add('nova-talking');
    novaReact('think');
    let img = null, talked = false;
    if (el.querySelector('[data-img]').checked) { try { img = (await getImage())?.split(',')[1] || null; } catch { /* board snapshot is optional */ } }
    const q = { role: 'user', text: `[Ders: ${courseName || '-'} · Konu: ${problem.topic || '-'} · Soru: ${problem.title}]\n${text}`, ...(label && { label }) };
    const turn = [...hist.slice(-20), q];
    ctrl = new AbortController();
    try {
      const r = await ask({
        hist: turn, img, signal: ctrl.signal,
        onText: snap => {
          if (!talked && snap) { talked = true; novaReact('talk'); }
          out.className = 'msg assistant'; out.innerHTML = renderNote(snap); log.scrollTop = log.scrollHeight;
        },
      });
      const reply = r.refused ? 'Bu isteğe yardımcı olamıyorum. Soruyu farklı şekilde sormayı dener misin?' : r.text || '…';
      out.className = 'msg assistant'; out.innerHTML = renderNote(reply) + actions(); out.dataset.i = hist.length + 1;
      hist.push(q, { role: 'assistant', text: reply, by: model() });
      await db.set('ai:' + problem.id, hist.slice(-40));
      novaReact('done');
    } catch (err) {
      if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) return;
      out.className = 'msg assistant err'; out.innerHTML = `<p>${esc(friendlyError(err))}</p>`;
      novaReact('error');
    } finally {
      ctrl = null; el.querySelector('.astro')?.classList.remove('talking'); document.body.classList.remove('nova-talking');
    }
  }
  form.onsubmit = e => { e.preventDefault(); const t = ta.value; ta.value = ''; send(t); };
  ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } e.stopPropagation(); };
  el.querySelector('.astro-quick').onclick = e => { const k = e.target.closest('[data-q]')?.dataset.q; if (k) { const a = ACTIONS.find(a => a[0] === k); send(a[2], a[1]); } };
  return () => { ctrl?.abort(); stopNova(); };
}

// ---------- Nova roaming the top of the board on a tether from her ship ----------
// Returns a cleanup function. onOpen() is called when Nova or the ship is clicked.
export function mountRoamer(wrap, onOpen) {
  const NS = 'http://www.w3.org/2000/svg';
  const layer = document.createElement('div');
  layer.className = 'nova-orbit';
  layer.innerHTML = `<svg class="tether" aria-hidden="true"><path class="tether-line"/><path class="tether-pulse" pathLength="100"/><g class="trail"></g><g class="nova-fx"></g></svg>
    <button class="nova-ship" aria-label="Nova'nın gemisi — Nova'ya sor" title="Nova'ya sor">${ship()}</button>
    <button class="nova-roam" aria-label="Nova'ya sor" title="Nova'ya sor">${astronaut('swim')}</button>`;
  wrap.append(layer);
  const svg = layer.querySelector('.tether'), line = svg.querySelector('.tether-line'), pulse = svg.querySelector('.tether-pulse');
  const trailG = svg.querySelector('.trail'), fxG = svg.querySelector('.nova-fx');
  const shipBtn = layer.querySelector('.nova-ship'), shipEl = shipBtn.querySelector('.ship');
  const nova = layer.querySelector('.nova-roam'), astroSvg = nova.querySelector('.astro'), gazeG = astroSvg.querySelector('.a-gaze');

  for (const b of [shipBtn, nova]) b.onclick = () => {
    nova.classList.remove('hop'); void nova.offsetWidth; nova.classList.add('hop');
    novaReact('poke');
    onOpen();
  };

  // never get in the way of a stroke that starts on the board
  // (a press on Nova/the ship itself must stay clickable, so only presses elsewhere make the layer passive)
  const down = e => { if (!layer.contains(e.target)) layer.classList.add('passive'); };
  const up = () => layer.classList.remove('passive');
  wrap.addEventListener('pointerdown', down);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  // capped dynamic particle pool (7 permanent trail dots + max 22 dynamic nodes = <= 29 total)
  const trail = Array.from({ length: 7 }, () => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '1.4'); trailG.append(c); return { c, x: 0, y: 0, a: 0 }; });
  const MAX_PARTICLES = 22;
  const particles = [];
  function clearParticles() {
    while (particles.length) particles.pop().el.remove();
    for (const p of trail) { p.a = 0; p.c.setAttribute('opacity', '0'); }
  }
  function spawnParticle({ kind, x, y, vx = 0, vy = 0, life = .9, size = 1, rot = 0, vrot = 0, acc = true }) {
    if (!full() || document.hidden) return;
    while (particles.length >= MAX_PARTICLES) particles.shift().el.remove();
    let el;
    if (kind === 'star') {
      el = document.createElementNS(NS, 'path');
      el.setAttribute('d', 'M 0 -4.2 L 1.1 -1.1 L 4.2 0 L 1.1 1.1 L 0 4.2 L -1.1 1.1 L -4.2 0 L -1.1 -1.1 Z');
      el.setAttribute('class', acc ? 'nfx-star' : 'nfx-star is-w');
    } else if (kind === 'confetti') {
      el = document.createElementNS(NS, 'rect');
      el.setAttribute('x', '-2.5'); el.setAttribute('y', '-1'); el.setAttribute('width', '5'); el.setAttribute('height', '2'); el.setAttribute('rx', '1');
      el.setAttribute('class', acc ? 'nfx-conf' : 'nfx-conf is-w');
    } else if (kind === 'puff') {
      el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', '2.8');
      el.setAttribute('class', acc ? 'nfx-puff' : 'nfx-puff is-w');
    } else {
      el = document.createElementNS(NS, 'circle');
      el.setAttribute('r', '1.4');
      el.setAttribute('class', acc ? 'nfx-spark' : 'nfx-spark is-w');
    }
    el.setAttribute('opacity', '0');
    fxG.append(el);
    particles.push({ el, kind, x, y, vx, vy, life, maxLife: life, size, rot, vrot });
  }
  function burstStars(cx, cy, count, confetti = false) {
    if (!full() || document.hidden) return;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - .5) * .45;
      const spd = (confetti ? 36 : 26) + Math.random() * 44;
      const isConf = confetti && (i % 2 === 1);
      spawnParticle({
        kind: isConf ? 'confetti' : 'star',
        x: cx + (Math.random() - .5) * 6,
        y: cy + (Math.random() - .5) * 6,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - (confetti ? 18 : 6),
        life: .75 + Math.random() * .55,
        size: .7 + Math.random() * .55,
        rot: Math.random() * 360,
        vrot: (Math.random() - .5) * 320,
        acc: i % 2 === 0,
      });
    }
  }
  function spawnPuff(cx, cy, vx = 0, vy = 16, acc = false) {
    spawnParticle({
      kind: 'puff',
      x: cx + (Math.random() - .5) * 4,
      y: cy + (Math.random() - .5) * 4,
      vx: vx + (Math.random() - .5) * 14,
      vy: vy + (Math.random() - .5) * 10,
      life: .55 + Math.random() * .3,
      size: .85 + Math.random() * .45,
      acc,
    });
  }

  // idle acts (1.5 - 4 s, picked every 12 - 30 s, never repeating twice in a row)
  const ACTS = [
    ['somersault', 2.0],
    ['wave', 2.6],
    ['stretch', 3.2],
    ['catch', 2.8],
    ['juggle', 3.8],
    ['peek', 3.6],
    ['boost', 2.4],
    ['book', 3.8],
  ];

  let raf = 0, last = performance.now();
  let x = 0, y = 0, px = null, py = null, vxSmooth = 0;
  let phase = Math.random() * 100, tTrail = 0, ti = 0, shipPuffT = 0, shipBoostT = 0;
  let idleTime = 0, sleeping = false;
  let ptrClientX = null, ptrClientY = null, ptrAge = 99, gx = 0, gy = 0, lastGazeStr = '';
  let blinkT = 1.6 + Math.random() * 3.2, blinkHold = 0, blinkDouble = false;
  let act = null, lastAct = '', nextAct = 12 + Math.random() * 18;
  let react = null, lastPoke = '', reducedReactTimer = 0;

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const easeInOut = p => p < .5 ? 2 * p * p : 1 - ((-2 * p + 2) ** 2) / 2;

  function clearAct() {
    if (!act) return;
    astroSvg.classList.remove('act-' + act.name);
    nova.classList.remove('behind-ship');
    act = null;
  }
  function clearReact() {
    clearTimeout(reducedReactTimer); reducedReactTimer = 0;
    if (!react) return;
    astroSvg.classList.remove(...ALL_REACT_CLS);
    react = null;
  }
  function startReact(kind) {
    if (!kind || !(kind in REACT_DURS) || motionMode() === 'off') return;
    clearTimeout(reducedReactTimer); reducedReactTimer = 0;
    clearAct();
    if (sleeping) {
      sleeping = false;
      astroSvg.classList.remove('mood-sleep');
      nova.classList.remove('is-sleeping');
    }
    idleTime = 0;
    astroSvg.classList.remove(...ALL_REACT_CLS);
    astroSvg.getBoundingClientRect();
    let variant = '';
    if (kind === 'poke') {
      const opts = POKE_VARIANTS.filter(v => v !== lastPoke);
      variant = opts[Math.floor(Math.random() * opts.length)];
      lastPoke = variant;
      astroSvg.classList.add('react-poke', 'react-poke-' + variant);
    } else {
      astroSvg.classList.add('react-' + kind);
    }
    const durMs = REACT_DURS[kind];
    react = { kind, variant, t: 0, dur: Number.isFinite(durMs) ? durMs / 1000 : Infinity, burst2: false };
    if (full()) {
      const cx = (px == null ? 80 : x) + nova.offsetWidth * .5;
      const cy = (py == null ? 60 : y) + nova.offsetHeight * .45;
      if (kind === 'celebrate') { burstStars(cx, cy, 14, true); shipBoostT = 1.8; }
      else if (kind === 'hello') burstStars(cx, cy - 4, 6, false);
      else if (kind === 'done') burstStars(cx + 14, cy - 4, 5, false);
      else if (kind === 'poke') {
        if (variant === 'spin') burstStars(cx, cy, 7, false);
        else if (variant === 'highfive') burstStars(cx + 15, cy - 6, 6, false);
        else if (variant === 'giggle') burstStars(cx, cy - 8, 4, false);
      }
    } else if (Number.isFinite(durMs)) {
      reducedReactTimer = setTimeout(() => { astroSvg.classList.remove(...ALL_REACT_CLS); react = null; }, durMs);
    }
  }

  function wakeUp(startled = true) {
    idleTime = 0;
    if (!sleeping) return;
    sleeping = false;
    astroSvg.classList.remove('mood-sleep');
    nova.classList.remove('is-sleeping');
    if (startled && full()) startReact('wake');
  }
  const onBoardPtr = e => {
    ptrClientX = e.clientX; ptrClientY = e.clientY; ptrAge = 0;
    wakeUp(true);
  };
  const onAnyActivity = () => wakeUp(true);
  const onReactEvt = e => startReact(e.detail);

  wrap.addEventListener('pointermove', onBoardPtr, { passive: true });
  wrap.addEventListener('pointerdown', onBoardPtr, { passive: true });
  addEventListener('keydown', onAnyActivity, { passive: true });
  addEventListener('wheel', onAnyActivity, { passive: true });
  addEventListener('pointerdown', onAnyActivity, { passive: true });
  addEventListener('nova-react', onReactEvt);

  function frame(now) {
    if (asleep()) { raf = 0; return; } // Nova rests while the window is hidden or unfocused
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    const W = layer.clientWidth, H = layer.clientHeight;
    if (!W || !H) { raf = full() ? requestAnimationFrame(frame) : 0; return; }

    const sr = shipBtn.getBoundingClientRect(), lr = layer.getBoundingClientRect();
    const shipLeft = sr.left - lr.left, shipTop = sr.top - lr.top;
    const port = [shipLeft + sr.width * 46 / 160, shipTop + sr.height * 66 / 90];
    const nw = nova.offsetWidth || 46, nh = nova.offsetHeight || 57;
    const isFull = full();

    if (!isFull) {
      x = clamp(port[0] - nw - 50, 12, Math.max(12, W - nw - 12));
      y = clamp(port[1] - nh / 2 + 10, 6, Math.max(6, H - nh - 6));
      px = x; py = y;
      nova.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      const bx = x + nw * .5, by = y + nh * .56, dist = Math.hypot(bx - port[0], by - port[1]);
      const mx = (bx + port[0]) / 2, my = Math.max(by, port[1]) + 16 + dist * .12;
      const d = `M${port[0].toFixed(1)},${port[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
      line.setAttribute('d', d); pulse.setAttribute('d', d);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      raf = 0;
      return;
    }

    // --- active timers (full motion mode) ---
    ptrAge += dt;
    const busyAi = react && (react.kind === 'think' || react.kind === 'talk');
    if (!sleeping && !busyAi) {
      idleTime += dt;
      if (idleTime >= 60) {
        sleeping = true;
        clearAct();
        clearReact();
        astroSvg.classList.add('mood-sleep');
        nova.classList.add('is-sleeping');
      }
    }

    // advance active reaction
    if (react) {
      react.t += dt;
      if (react.kind === 'celebrate' && !react.burst2 && react.t > .78) {
        react.burst2 = true;
        burstStars(x + nw * .5, y + nh * .4, 8, true);
      }
      if (react.t >= react.dur) clearReact();
    }

    // advance or schedule idle personality act (12-30 s, never repeats twice in a row)
    const left = 20, right = Math.max(left + 48, shipLeft - nw - 18);
    const cxBand = (left + right) / 2, axBand = (right - left) / 2;
    if (act) {
      act.t += dt;
      if (act.t >= act.dur) { clearAct(); nextAct = 12 + Math.random() * 18; }
    } else if (!sleeping && !react) {
      nextAct -= dt;
      if (nextAct <= 0) {
        const pool = ACTS.filter(([n]) => n !== lastAct);
        const [name, dur] = pool[Math.floor(Math.random() * pool.length)];
        lastAct = name;
        act = { name, dur, t: 0, sx: px == null ? cxBand : x, sy: py == null ? H * .42 : y, dir: (px == null ? cxBand : x) > cxBand ? -1 : 1, puffT: 0, caught: false };
        astroSvg.classList.add('act-' + name);
      }
    }

    // random-interval blinking (with occasional double-blink)
    if (blinkHold > 0) {
      blinkHold -= dt;
      if (blinkHold <= 0) astroSvg.classList.remove('is-blinking');
    }
    blinkT -= dt;
    if (blinkT <= 0) {
      const canBlink = !sleeping && (!react || react.kind === 'talk' || react.kind === 'review') && (!act || act.name === 'book' || act.name === 'juggle' || act.name === 'peek' || act.name === 'catch');
      if (canBlink) { astroSvg.classList.add('is-blinking'); blinkHold = .155; }
      if (!blinkDouble && Math.random() < .24) { blinkDouble = true; blinkT = .25; }
      else { blinkDouble = false; blinkT = 2.1 + Math.random() * 4.3; }
    }

    // --- position & choreography ---
    const slowWander = sleeping ? .16 : (busyAi || (act && act.name !== 'boost' && act.name !== 'peek') || (react && react.kind === 'review')) ? .24 : 1;
    phase += dt * slowWander;
    const t = now / 1000;

    let targetX = cxBand + axBand * (.78 * Math.sin(phase * .075) + .22 * Math.sin(phase * .23 + 1.3));
    let targetY = clamp(H * .42 + (H * .3) * (.7 * Math.sin(phase * .17 + .6) + .3 * Math.sin(phase * .41)), 6, Math.max(6, H - nh - 6));
    let dyOff = 0, roll = 0, tiltScale = 1, followSpeed = 4.6;

    if (act) {
      const p = clamp(act.t / act.dur, 0, 1);
      if (act.name === 'somersault') {
        roll = easeInOut(p) * 360;
        dyOff = -Math.sin(p * Math.PI) * Math.min(18, H * .14);
        if ((act.puffT += dt) > .24 && p > .12 && p < .88) {
          act.puffT = 0;
          spawnParticle({ kind: 'spark', x: x + nw * .5, y: y + nh * .5, vx: (Math.random() - .5) * 20, vy: 10 + Math.random() * 14, life: .55, size: 1, acc: true });
        }
      } else if (act.name === 'peek') {
        const hideX = clamp(shipLeft + sr.width * .24 - nw * .5, left, W - nw - 6);
        const hideY = clamp(shipTop + sr.height * .26 - nh * .18, 4, Math.max(4, H - nh - 4));
        const peekX = clamp(shipLeft + sr.width * .18 - nw * .5, left, W - nw - 6);
        const peekY = clamp(shipTop - nh * .22, 2, Math.max(2, H - nh - 4));
        followSpeed = 6.2;
        if (p < .26) {
          targetX = hideX; targetY = hideY;
          if (Math.hypot(x - hideX, y - hideY) < sr.width * .6) nova.classList.add('behind-ship');
        } else if (p < .74) {
          nova.classList.add('behind-ship');
          targetX = peekX; targetY = peekY;
          roll = -10 * Math.sin(((p - .26) / .48) * Math.PI);
          tiltScale = .2;
        } else {
          if (p > .88) nova.classList.remove('behind-ship');
        }
      } else if (act.name === 'boost') {
        const rx = Math.min(84, Math.max(30, axBand * .55));
        const ry = Math.min(24, Math.max(10, (H - nh - 14) * .4));
        targetX = clamp(act.sx + act.dir * ((1 - Math.cos(p * Math.PI * 2)) * .5) * rx, left, right);
        targetY = clamp(act.sy - Math.sin(p * Math.PI * 2) * ry, 6, Math.max(6, H - nh - 6));
        followSpeed = 10;
        if (p > .1 && p < .85) shipBoostT = Math.max(shipBoostT, .25);
        if ((act.puffT += dt) > .11 && p > .05 && p < .9) {
          act.puffT = 0;
          spawnPuff(x + nw * .5 - Math.sign(vxSmooth || act.dir) * 8, y + nh * .74, -vxSmooth * .22, 22, p > .4 && p < .65);
        }
      } else if (act.name === 'book') {
        tiltScale = .15;
        if (p < .16) roll = easeInOut(p / .16) * 180;
        else if (p < .84) roll = 180 + Math.sin(act.t * 2.2) * 5;
        else roll = 180 + easeInOut((p - .84) / .16) * 180;
      } else if (act.name === 'catch') {
        tiltScale = .35;
        if (!act.caught && act.t >= 1.32) {
          act.caught = true;
          burstStars(x + nw * .82, y + nh * .42, 6, false);
        }
      } else if (act.name === 'juggle' || act.name === 'wave' || act.name === 'stretch') {
        tiltScale = .25;
      }
    }

    if (react) {
      const p = Number.isFinite(react.dur) ? clamp(react.t / react.dur, 0, 1) : 0;
      if (react.kind === 'celebrate' && p < .52) {
        const q = p / .52;
        roll = -easeInOut(q) * 360;
        dyOff = -Math.sin(q * Math.PI) * Math.min(24, H * .2);
      } else if (react.kind === 'poke' && react.variant === 'spin' && p < .68) {
        roll = easeInOut(p / .68) * 360;
      } else if (react.kind === 'poke' && react.variant === 'highfive' && p < .55) {
        dyOff = -Math.sin((p / .55) * Math.PI) * Math.min(14, H * .12);
      } else if (react.kind === 'wake') {
        dyOff = -Math.sin(p * Math.PI) * Math.min(18, H * .16);
      } else if (react.kind === 'hello' && p < .5) {
        dyOff = -Math.sin((p / .5) * Math.PI) * Math.min(14, H * .12);
      }
    }

    if (px == null) { x = targetX; y = targetY; }
    else {
      const k = Math.min(1, dt * followSpeed);
      x += (targetX - x) * k;
      y += (targetY - y) * k;
    }
    const rawVx = px == null || dt <= 0 ? 0 : (x - px) / dt;
    vxSmooth += (rawVx - vxSmooth) * Math.min(1, dt * 8);
    px = x; py = y;

    const ry = clamp(y + dyOff, 2, Math.max(2, H - nh - 2));
    const sway = sleeping ? Math.sin(t * .65) * 3 : Math.sin(t * .9) * 4;
    const tilt = (clamp(vxSmooth * .24, -16, 16) + sway) * tiltScale;
    const totalAngle = tilt + roll;
    nova.style.transform = `translate(${x.toFixed(1)}px, ${ry.toFixed(1)}px) rotate(${totalAngle.toFixed(1)}deg)`;

    // --- smooth eye gaze tracking (pointer/pen or act-directed) ---
    let tgx = 0, tgy = 0;
    if (sleeping || react?.kind === 'think' || react?.kind === 'error') {
      tgx = 0; tgy = 0;
    } else if (act?.name === 'book') {
      tgx = Math.sin(act.t * 4.2) * 2.6; tgy = 2.1;
    } else if (act?.name === 'juggle') {
      tgx = Math.sin(act.t * 5.2) * 2.5; tgy = -2.2;
    } else if (act?.name === 'catch' && act.t < 1.35) {
      tgx = 3.2; tgy = -2.4;
    } else if (ptrClientX != null && ptrAge < 12) {
      const hx = x + nw * .5, hy = ry + nh * .34;
      const dx = (ptrClientX - lr.left) - hx, dy = (ptrClientY - lr.top) - hy;
      const rad = -totalAngle * Math.PI / 180;
      const rdx = dx * Math.cos(rad) - dy * Math.sin(rad);
      const rdy = dx * Math.sin(rad) + dy * Math.cos(rad);
      const d = Math.hypot(rdx, rdy) || 1, sat = d / (d + 85);
      tgx = (rdx / d) * sat * 4.2;
      tgy = (rdy / d) * sat * 2.9;
    } else {
      tgx = Math.sin(t * .45) * 1.1; tgy = Math.cos(t * .35) * .6;
    }
    const gk = Math.min(1, dt * 9.5);
    gx += (tgx - gx) * gk; gy += (tgy - gy) * gk;
    const gazeStr = `translate(${gx.toFixed(2)}px, ${gy.toFixed(2)}px)`;
    if (gazeStr !== lastGazeStr) { gazeG.style.transform = gazeStr; lastGazeStr = gazeStr; }

    // --- tether & ship proximity hatch light / engine boost ---
    const bx = x + nw * .5, by = ry + nh * .56, dist = Math.hypot(bx - port[0], by - port[1]);
    const mx = (bx + port[0]) / 2 + Math.sin(t * .7) * 12;
    const my = Math.max(by, port[1]) + 16 + dist * .12 + Math.sin(t * 1.1) * 6;
    const dPath = `M${port[0].toFixed(1)},${port[1].toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`;
    line.setAttribute('d', dPath); pulse.setAttribute('d', dPath);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const nearShip = dist < Math.max(96, sr.width * .86) || act?.name === 'peek';
    shipEl.classList.toggle('dock-near', nearShip);
    shipBoostT = Math.max(0, shipBoostT - dt);
    const shipBoosting = shipBoostT > 0 || document.body.classList.contains('nova-talking');
    shipEl.classList.toggle('boost', shipBoostT > 0);
    if (shipBoosting && (shipPuffT += dt) > .34) {
      shipPuffT = 0;
      spawnPuff(shipLeft + sr.width * 134 / 160, shipTop + sr.height * 47 / 90, 26, (Math.random() - .5) * 8, true);
    }

    // --- stardust trail & capped dynamic particles ---
    if (!sleeping && (tTrail += dt) > .35) {
      tTrail = 0;
      const p = trail[ti++ % trail.length];
      Object.assign(p, { x: bx - Math.sign(vxSmooth || 1) * 8, y: by + 6, a: 1 });
    }
    for (const p of trail) {
      p.a = Math.max(0, p.a - dt * .7); p.y += dt * 6;
      p.c.setAttribute('cx', p.x.toFixed(1)); p.c.setAttribute('cy', p.y.toFixed(1)); p.c.setAttribute('opacity', p.a.toFixed(2));
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { p.el.remove(); particles.splice(i, 1); continue; }
      const k = 1 - p.life / p.maxLife;
      p.x += p.vx * dt; p.y += p.vy * dt;
      let sc, op;
      if (p.kind === 'puff') {
        const drag = Math.pow(.18, dt); p.vx *= drag; p.vy *= drag;
        sc = p.size * (.6 + k * 1.6);
        op = (1 - k) * .52;
      } else {
        const drag = Math.pow(p.kind === 'confetti' ? .26 : .35, dt);
        p.vx *= drag; p.vy *= drag;
        if (p.kind === 'confetti') p.vy += 32 * dt;
        sc = p.size * (k < .18 ? k / .18 : 1 - (k - .18) * .72);
        op = k < .15 ? k / .15 : 1 - (k - .15) / .85;
      }
      p.rot += p.vrot * dt;
      p.el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.rot.toFixed(0)}) scale(${Math.max(.05, sc).toFixed(2)})`);
      p.el.setAttribute('opacity', clamp(op, 0, 1).toFixed(2));
    }

    raf = requestAnimationFrame(frame);
  }

  const start = () => {
    cancelAnimationFrame(raf); raf = 0;
    const m = motionMode();
    if (m === 'full') {
      clearTimeout(reducedReactTimer); reducedReactTimer = 0;
      astroSvg.dataset.novaBlink = 'js';
      if (!asleep()) { last = performance.now(); raf = requestAnimationFrame(frame); }
    } else {
      delete astroSvg.dataset.novaBlink;
      clearAct();
      clearParticles();
      sleeping = false; idleTime = 0;
      astroSvg.classList.remove('mood-sleep', 'is-blinking');
      nova.classList.remove('is-sleeping', 'behind-ship');
      shipEl.classList.remove('dock-near', 'boost');
      gazeG.style.transform = ''; lastGazeStr = '';
      if (m === 'off') { clearReact(); clearNovaStates(astroSvg); }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };
  const onVis = () => { if (asleep()) { cancelAnimationFrame(raf); raf = 0; } else start(); };

  start();
  document.addEventListener('visibilitychange', onVis); addEventListener('mp-vis', onVis);
  addEventListener('mp-theme', start);
  addEventListener('resize', start);
  reduceQ.addEventListener?.('change', start);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(reducedReactTimer);
    clearParticles();
    layer.remove();
    wrap.removeEventListener('pointerdown', down);
    wrap.removeEventListener('pointermove', onBoardPtr);
    wrap.removeEventListener('pointerdown', onBoardPtr);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    removeEventListener('keydown', onAnyActivity);
    removeEventListener('wheel', onAnyActivity);
    removeEventListener('pointerdown', onAnyActivity);
    removeEventListener('nova-react', onReactEvt);
    document.removeEventListener('visibilitychange', onVis); removeEventListener('mp-vis', onVis);
    removeEventListener('mp-theme', start);
    removeEventListener('resize', start);
    reduceQ.removeEventListener?.('change', start);
  };
}


// ---------- one-shot helpers: auto-tagging a new problem, weekly coaching ----------
const firstJson = t => { const m = /\{[\s\S]*\}/.exec(t || ''); try { return m ? JSON.parse(m[0]) : null; } catch { return null; } };

// Reads the question photo and suggests { course, topic, title }. Returns null without a key or on any failure.
export async function classify(imgB64, courseNames) {
  if (!getKey() || !imgB64) return null;
  const system = 'Mühendislik sorularını sınıflandıran bir asistansın. Sadece JSON döndür, başka hiçbir şey yazma.';
  const text = `Fotoğraftaki soruyu incele. Şu derslerden en uygun olanı seç (yoksa en yakınını): ${courseNames.join(', ')}.\n`
    + 'JSON biçimi: {"course": "ders adı listeden aynen", "topic": "2-4 kelimelik konu, örn. Thevenin eşdeğeri", "title": "en fazla 6 kelimelik kısa soru başlığı"}';
  try {
    const r = await ask({ hist: [{ role: 'user', text }], img: imgB64, system });
    const j = firstJson(r.text);
    return j && typeof j.course === 'string' ? { course: j.course.trim(), topic: String(j.topic || '').trim().slice(0, 60), title: String(j.title || '').trim().slice(0, 80) } : null;
  } catch { return null; }
}

// Weekly coaching note from study statistics (text only, no images).
export async function coach(summary) {
  const system = `${SYSTEM}\n- Şimdi öğrencinin haftalık çalışma koçusun. Verilen istatistiklere bakarak 4-6 maddelik kısa, somut ve cesaretlendirici bir değerlendirme yaz: neler iyi gidiyor, hangi ders/konu ihmal ediliyor, bu hafta için 3 net öneri (ders + konu + kaç soru). Başlık kullanma.`;
  const r = await ask({ hist: [{ role: 'user', text: summary }], system });
  return r.refused ? null : r.text;
}
