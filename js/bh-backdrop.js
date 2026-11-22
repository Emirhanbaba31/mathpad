// Ray-traced backdrop for the "Kara Delik" planet theme: the observatory's Schwarzschild geodesic tracer, run as a
// light background layer (low resolution, gentle frame rate, single pass). Edge-on view with a slowly drifting camera:
// lensed Milky Way, photon ring, Doppler-beamed disk arching over the shadow and an orbiting hot spot.
// Power: 20 fps in full motion, 10 fps in reduced motion, one still frame when motion is off; stops completely while
// the window is asleep (hidden / unfocused / idle), on pages that pause the backdrop, and when the canvas is removed.
import { RAYTRACE_VERT_300, RAYTRACE_FRAG_300, RAYTRACE_VERT_100, RAYTRACE_FRAG_100 } from './bh-shaders.js';
import { motion } from './fx.js';

const DEG = Math.PI / 180;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Camera basis on a sphere around the hole (inclination from the +y spin axis), same convention as the observatory. */
export function backdropCamera(yaw, inclinationDeg, distanceM, fovDeg = 46) {
  const t = inclinationDeg * DEG;
  const pos = [distanceM * Math.sin(t) * Math.sin(yaw), distanceM * Math.cos(t), distanceM * Math.sin(t) * Math.cos(yaw)];
  const fwd = norm([-pos[0], -pos[1], -pos[2]]);
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = norm(cross(right, fwd));
  return { pos, fwd, right, up, tanHalfFov: Math.tan(fovDeg * 0.5 * DEG) };
}

/** Frame interval for the motion setting (ms); 0 means a single still frame. */
export const backdropFrameMs = m => (m === 'off' ? 0 : m === 'reduced' ? 100 : 50);

const PAUSED_PAGES = new Set(['p', 'evren']); // the problem board and the 3D solar system pause the planet backdrop

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('Kara delik arka planı:', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; }
  return sh;
}

/** Mounts the ray-traced black hole into a .pl-world element. Returns a stop function, or null when WebGL is unavailable. */
export function mountBlackHoleBackdrop(world) {
  const wrap = world.querySelector('.pl-bh');
  if (!wrap) return null;
  const cv = document.createElement('canvas');
  cv.className = 'pl-bh-gl';
  cv.setAttribute('aria-hidden', 'true');
  const opts = { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
  const gl = cv.getContext('webgl2', opts) || cv.getContext('webgl', opts);
  if (!gl) return null;
  const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const vs = compile(gl, gl.VERTEX_SHADER, gl2 ? RAYTRACE_VERT_300 : RAYTRACE_VERT_100);
  const fs = compile(gl, gl.FRAGMENT_SHADER, gl2 ? RAYTRACE_FRAG_300 : RAYTRACE_FRAG_100);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.linkProgram(prog);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  const U = {};
  for (const n of ['uResolution', 'uCamPos', 'uCamRight', 'uCamUp', 'uCamFwd', 'uTanHalfFov', 'uAspect', 'uSpin', 'uDiskInner', 'uDiskOuter',
    'uTempScale', 'uDiskBrightness', 'uTime', 'uShowDisk', 'uUseDoppler', 'uUseGravRedshift', 'uUseLensing', 'uMaxSteps', 'uStepScale',
    'uShipBeta', 'uSkyGravBlue', 'uSkyTex', 'uHasSkyTex', 'uJet', 'uHotSpot']) U[n] = gl.getUniformLocation(prog, n);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  // Milky Way for the lensed sky (1k is plenty at backdrop resolution)
  const sky = gl.createTexture();
  let hasSky = false;
  gl.bindTexture(gl.TEXTURE_2D, sky);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  const img = new Image();
  img.onload = () => {
    if (dead) return;
    gl.bindTexture(gl.TEXTURE_2D, sky);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const pow2 = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
    if (gl2 || pow2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    hasSky = true;
    still = false;
    schedule();
  };
  img.src = 'textures/1k/1k_stars_milky_way.jpg';

  wrap.prepend(cv);
  world.classList.add('bh-gl-on');

  let dead = false, raf = 0, last = 0, simTime = 0, scale = 0.42, still = false;
  let emaGap = 16.7;
  const resize = () => {
    // CSS pixels only (the backdrop is soft anyway) and at most ~240k rays per frame, whatever the screen size
    const r = cv.getBoundingClientRect();
    const s = Math.min(scale, Math.sqrt(240000 / Math.max(1, r.width * r.height)));
    const w = Math.max(96, Math.round(r.width * s));
    const h = Math.max(64, Math.round(r.height * s));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; still = false; }
  };
  const draw = () => {
    resize();
    const t = simTime;
    const cam = backdropCamera(0.32 + 0.05 * Math.sin(t * 0.021), 82 - 1.5 * Math.sin(t * 0.017), 30);
    gl.viewport(0, 0, cv.width, cv.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sky);
    const f1 = (n, v) => U[n] && gl.uniform1f(U[n], v);
    const f3 = (n, v) => U[n] && gl.uniform3f(U[n], v[0], v[1], v[2]);
    gl.uniform2f(U.uResolution, cv.width, cv.height);
    f3('uCamPos', cam.pos); f3('uCamRight', cam.right); f3('uCamUp', cam.up); f3('uCamFwd', cam.fwd);
    f1('uTanHalfFov', cam.tanHalfFov); f1('uAspect', cv.width / cv.height);
    f1('uSpin', 0); f1('uDiskInner', 6); f1('uDiskOuter', 23); f1('uTempScale', 0.5); f1('uDiskBrightness', 1.1);
    f1('uTime', t * 0.45); f1('uShowDisk', 1); f1('uUseDoppler', 1); f1('uUseGravRedshift', 1); f1('uUseLensing', 1);
    f1('uMaxSteps', 96); f1('uStepScale', 0.066); f3('uShipBeta', [0, 0, 0]); f1('uSkyGravBlue', 0);
    if (U.uSkyTex) gl.uniform1i(U.uSkyTex, 0);
    f1('uHasSkyTex', hasSky ? 1 : 0); f1('uJet', 0); f1('uHotSpot', 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const paused = () => document.hidden || document.documentElement.classList.contains('tab-hidden') || PAUSED_PAGES.has(document.body?.dataset.page);
  const stop = () => {
    if (dead) return;
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const [ev, fn] of listeners) window.removeEventListener(ev, fn);
    document.removeEventListener('visibilitychange', schedule);
    try { gl.deleteProgram(prog); gl.deleteBuffer(vbo); gl.deleteTexture(sky); gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { }
    world.classList.remove('bh-gl-on');
    cv.remove();
  };
  const tick = now => {
    raf = 0;
    if (!cv.isConnected) { stop(); return; } // the theme changed and the world was removed
    if (dead || paused()) return;
    const frameMs = backdropFrameMs(motion());
    const gap = last ? now - last : 16.7;
    emaGap = emaGap * 0.9 + Math.min(gap, 100) * 0.1;
    if (frameMs === 0) { if (!still) { draw(); still = true; } return; }
    if (last && now - last < frameMs - 2) { raf = requestAnimationFrame(tick); return; }
    simTime += last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    draw();
    // the display loop slowing down means the GPU is busy: lower the backdrop resolution, raise it again when calm
    if (emaGap > 24 && scale > 0.22) scale = Math.max(0.22, scale * 0.85);
    else if (emaGap < 17.5 && scale < 0.6) scale = Math.min(0.6, scale * 1.02);
    raf = requestAnimationFrame(tick);
  };
  const schedule = () => { if (!dead && !raf && !paused()) { last = 0; raf = requestAnimationFrame(tick); } };
  const listeners = [['mp-vis', schedule], ['hashchange', () => setTimeout(schedule, 60)], ['resize', () => { still = false; schedule(); }], ['focus', schedule]];
  for (const [ev, fn] of listeners) window.addEventListener(ev, fn);
  document.addEventListener('visibilitychange', schedule);
  cv.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
  requestAnimationFrame(() => { draw(); schedule(); });
  return stop;
}
