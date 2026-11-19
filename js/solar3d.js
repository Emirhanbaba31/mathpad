// WebGL solar system (three.js). Planet surfaces are procedural GPU shaders (sharp at any zoom, no startup
// texture cost); Saturn's ring/planet shadows are analytic ray tests; the Sun glows through bloom.
// mountSolar3D(container, { preview }) -> cleanup, or null when WebGL is unavailable (caller falls back to canvas 2D).
import * as THREE from '../vendor/three.mjs';
import { SUN_DEF, PLANET_DEFS, SPEEDS, ICONS, buildCourseMap, makeRng, fbm3 } from './solar.js';
import { esc } from './ui.js';
import { motion } from './fx.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const KIND = { mercury: 0, venus: 1, earth: 2, mars: 3, jupiter: 4, saturn: 5, uranus: 6, neptune: 7, moon: 8 };
const ATMO = { venus: [1.0, 0.8, 0.45, 0.9], earth: [0.35, 0.62, 1.0, 1.25], mars: [1.0, 0.55, 0.35, 0.35], uranus: [0.55, 0.9, 1.0, 0.7], neptune: [0.35, 0.55, 1.0, 0.9] };
const RING_KIND = { saturn: 0, uranus: 1 };
const motionMode = () => document.documentElement.dataset.motion === 'off' ? 'off' : motion();

// ---------- GLSL ----------
// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) + fbm
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 105.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
float fbm3(vec3 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
`;

// Ring density profile shared by the ring shader and Saturn's ring-shadow test. u: 0 inner edge .. 1 outer edge.
const RING_FN = /* glsl */`
float ringDensity(float u, float kind){
  if(u<0.||u>1.) return 0.;
  if(kind>.5){ // Uranus: a few thin dark rings
    float d=smoothstep(.02,0.,abs(u-.92))*.9+smoothstep(.015,0.,abs(u-.55))*.4+smoothstep(.012,0.,abs(u-.3))*.3;
    return d*.55;
  }
  float d=.6+.2*sin(u*46.)+.12*sin(u*113.+1.3)+.06*sin(u*197.+.4); // few, broad ringlets: no moire at small sizes
  d*=smoothstep(0.,.08,u);                       // faint C ring fades in
  d*=mix(.35,1.,smoothstep(.18,.24,u));          // C ring thinner than B
  d*=1.-.96*smoothstep(.035,.0,abs(u-.585));     // Cassini division
  d*=1.-.8*smoothstep(.012,.0,abs(u-.86));       // Encke gap
  d*=1.-smoothstep(.93,1.,u)*.6;
  return clamp(d,0.,1.);
}
`;

const PLANET_VS = /* glsl */`
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
void main(){
  vObj=normalize(position);
  vec4 w=modelMatrix*vec4(position,1.); vPw=w.xyz;
  vNw=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

const PLANET_FS = /* glsl */`
uniform float kind; uniform float seed; uniform float time;
uniform vec3 ringN; uniform vec3 center; uniform float ringIn; uniform float ringOut; uniform float hasRing; uniform float ringKind;
uniform vec3 atmo; uniform float atmoStr; uniform float aura; uniform vec3 auraCol;
varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
${RING_FN}
vec3 surface(vec3 p, out float spec, out float lights){
  spec=0.; lights=0.;
  float lat=p.y, alat=abs(lat);
  vec3 q=p+seed;
  if(kind<.5){ // Mercury
    float n=fbm(q*3.)*.5+.5; vec3 c=mix(vec3(.20,.19,.18),vec3(.52,.49,.46),n);
    float cr=snoise(q*14.); c*=1.-.35*smoothstep(.55,.8,cr); c+=.08*smoothstep(.8,.9,cr);
    return c;
  }
  if(kind<1.5){ // Venus: thick swirling clouds
    float w=fbm(q*1.6); float b=sin(lat*7.+w*3.5)*.5+.5;
    return mix(vec3(.72,.55,.30),vec3(.95,.84,.60),b)*(.85+.15*fbm(q*5.));
  }
  if(kind<2.5){ // Earth
    float h=fbm(q*1.5);
    float land=smoothstep(.03,.07,h);
    vec3 ocean=mix(vec3(.004,.02,.09),vec3(.01,.07,.2),smoothstep(-.45,.03,h));
    vec3 lc=mix(vec3(.05,.13,.03),vec3(.22,.17,.08),smoothstep(.08,.4,h));
    lc=mix(lc,vec3(.45,.35,.18),exp(-pow((alat-.33)/.09,2.))*.75*smoothstep(.1,.25,fbm(q*3.)+.2));
    float ice=smoothstep(.8,.88,alat+.06*fbm(q*4.));
    vec3 c=mix(ocean,lc,land); c=mix(c,vec3(.85,.9,.95),ice);
    spec=(1.-land)*(1.-ice);
    lights=land*(1.-ice)*smoothstep(.45,.85,snoise(q*38.)*.5+.5)*smoothstep(-.1,.3,fbm(q*6.));
    return c;
  }
  if(kind<3.5){ // Mars
    float n=fbm(q*2.4)*.5+.5; vec3 c=mix(vec3(.30,.09,.03),vec3(.62,.25,.10),n);
    c=mix(c,vec3(.17,.07,.04),smoothstep(.05,.35,fbm(q*1.2+7.))*.55);
    c=mix(c,vec3(.85,.82,.8),smoothstep(.91,.95,alat+.03*fbm(q*5.)));
    return c;
  }
  if(kind<4.5 || (kind>4.5&&kind<5.5)){ // Jupiter / Saturn bands
    bool sat=kind>4.5;
    float w=fbm(q*vec3(1.5,5.,1.5)+vec3(time*.004,0.,0.));
    float y=lat+w*(sat?.025:.05);
    float b1=sin(y*(sat?30.:26.))*.5+.5, b2=sin(y*(sat?13.:11.)+1.3)*.5+.5;
    vec3 c=sat ? mix(vec3(.70,.58,.36),vec3(.92,.83,.60),b1) : mix(vec3(.62,.45,.30),vec3(.93,.86,.74),b1);
    c=mix(c, sat?vec3(.62,.50,.32):vec3(.45,.27,.16), b2*(sat?.35:.55)*smoothstep(.02,.5,alat));
    c*=.9+.1*fbm(q*vec3(4.,14.,4.));
    if(!sat){ // Great Red Spot
      float lon=atan(p.z,p.x), la=asin(clamp(lat,-1.,1.));
      float dx=(lon-1.)*cos(la)/.2, dy=(la+.38)/.085, e=dx*dx+dy*dy;
      c=mix(c,vec3(.66,.24,.12),smoothstep(1.,.45,e)); c=mix(c,vec3(.9,.8,.7),smoothstep(1.25,1.,e)*smoothstep(.85,1.,e)*.5);
    }
    if(sat) c=mix(c,vec3(.55,.62,.62),smoothstep(.8,.95,alat)*.5); // greyish pole
    return c;
  }
  if(kind<6.5){ // Uranus
    return vec3(.48,.76,.80)*(.94+.06*sin(lat*18.+fbm(q*2.)*1.5));
  }
  if(kind<7.5){ // Neptune
    float w=fbm(q*vec3(1.5,4.,1.5)); vec3 c=mix(vec3(.05,.13,.48),vec3(.13,.28,.75),sin(lat*9.+w*2.)*.5+.5);
    float lon=atan(p.z,p.x), la=asin(clamp(lat,-1.,1.));
    float dx=(lon+.6)*cos(la)/.17, dy=(la+.35)/.08; c=mix(c,vec3(.02,.05,.2),smoothstep(1.,.4,dx*dx+dy*dy));
    c+=vec3(.6,.7,.8)*smoothstep(.55,.85,fbm(q*vec3(2.,10.,2.)+3.))*.45;
    return c;
  }
  // Moon
  float n=fbm(q*2.5)*.5+.5; vec3 c=mix(vec3(.25,.25,.26),vec3(.55,.55,.56),n);
  c*=1.-.3*smoothstep(.5,.8,snoise(q*11.)); c=mix(c,vec3(.18),smoothstep(.2,.5,fbm(q*1.1+4.))*.5);
  return c;
}
void main(){
  vec3 N=normalize(vNw); vec3 L=normalize(-vPw); vec3 V=normalize(cameraPosition-vPw);
  float spec, lights; vec3 col=surface(normalize(vObj), spec, lights);
  float ndl=dot(N,L);
  float lit=smoothstep(-.06,.35,ndl)*(.35+.65*max(ndl,0.)); // soft curved terminator with wrap
  // Saturn: shadow of the rings on the globe (ray from surface towards the Sun hits the ring plane)
  if(hasRing>.5){
    float dn=dot(L,ringN);
    if(abs(dn)>1e-4){
      float t=dot(center-vPw,ringN)/dn;
      if(t>0.){ float r=length(vPw+L*t-center); lit*=1.-.85*ringDensity((r-ringIn)/(ringOut-ringIn),ringKind); }
    }
  }
  vec3 c=col*lit*1.25;
  vec3 H=normalize(L+V); c+=vec3(1.,.95,.85)*pow(max(dot(N,H),0.),70.)*spec*.9*step(0.,ndl)*lit;
  c+=vec3(1.,.72,.38)*lights*smoothstep(.05,-.25,ndl)*1.6;   // city lights on the night side
  c+=col*.012;                                                 // faint earthshine
  float fr=pow(1.-max(dot(N,V),0.),3.);
  c+=atmo*fr*atmoStr*smoothstep(-.35,.45,ndl);                 // atmosphere rim on the day side
  c+=auraCol*fr*aura*1.6;                                      // Derslerim progress glow
  gl_FragColor=vec4(c,1.);
}`;

const CLOUD_FS = /* glsl */`
uniform float time; varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
void main(){
  vec3 p=normalize(vObj);
  float a=smoothstep(.08,.5,fbm(p*vec3(2.6,4.2,2.6)+vec3(time*.012,0.,time*.006)))*.85;
  vec3 N=normalize(vNw), L=normalize(-vPw);
  float lit=smoothstep(-.06,.35,dot(N,L))*(.4+.6*max(dot(N,L),0.));
  gl_FragColor=vec4(vec3(.95)*lit*1.2,a);
}`;

const ATMO_FS = /* glsl */`
uniform vec3 atmo; uniform float atmoStr; varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
void main(){
  vec3 N=normalize(vNw), V=normalize(cameraPosition-vPw), L=normalize(-vPw);
  float fr=pow(1.-abs(dot(N,V)),4.);
  float day=smoothstep(-.4,.5,dot(N,L));
  gl_FragColor=vec4(atmo*fr*day*atmoStr*.9,1.);
}`;

const SUN_FS = /* glsl */`
uniform float time; varying vec3 vObj; varying vec3 vNw; varying vec3 vPw;
${NOISE}
void main(){
  vec3 p=normalize(vObj);
  float n=fbm(p*5.+vec3(0.,0.,time*.02));
  float g=snoise(p*28.+time*.06)*.5+.5;                   // granulation
  vec3 c=mix(vec3(.95,.28,.02),vec3(1.,.66,.18),n*.5+.5); c=mix(c*.72,c*1.18,g);
  float mu=max(dot(normalize(vNw),normalize(cameraPosition-vPw)),0.);
  c*=.45+.55*pow(mu,.45);                                // limb darkening
  gl_FragColor=vec4(c*1.12,1.);
}`;

const RING_VS = /* glsl */`
varying vec3 vPw; varying vec2 vLoc;
void main(){ vLoc=position.xy; vec4 w=modelMatrix*vec4(position,1.); vPw=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;

const RING_FS = /* glsl */`
uniform float rIn; uniform float rOut; uniform float kind; uniform vec3 center; uniform float R; uniform vec3 ringN;
varying vec3 vPw; varying vec2 vLoc;
${RING_FN}
void main(){
  float u=(length(vLoc)-rIn)/(rOut-rIn);
  float d=ringDensity(u,kind); if(d<.01) discard;
  vec3 L=normalize(-vPw), V=normalize(cameraPosition-vPw);
  // planet's shadow on the rings: does the ray towards the Sun hit the globe?
  vec3 oc=vPw-center; float b=dot(oc,L), c=dot(oc,oc)-R*R, h=b*b-c;
  float sh=(h>0. && -b-sqrt(h)>0.) ? .06 : 1.;
  float sunSide=sign(dot(ringN,L)), viewSide=sign(dot(ringN,V));
  float bright=sunSide==viewSide ? .7+.5*abs(dot(ringN,L)) : .38+.25*(1.-d);  // unlit face: light scattered through the ice
  vec3 col=(kind>.5) ? vec3(.55,.6,.62) : mix(vec3(.62,.54,.42),vec3(.92,.86,.72),smoothstep(.2,.7,u));
  gl_FragColor=vec4(col*bright*sh*1.25,d*(kind>.5?.7:.95));
}`;

const STAR_VS = /* glsl */`
attribute float size; attribute vec3 tint; attribute float phase; uniform float time; uniform float pr; uniform float tw;
varying vec3 vT; varying float vA;
void main(){ vT=tint; vA=.65+.35*sin(time*(1.3+phase*.8)+phase*6.28)*tw+(1.-tw)*.35;
  gl_PointSize=size*pr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const STAR_FS = /* glsl */`
varying vec3 vT; varying float vA;
void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; float a=exp(-r*18.)*vA; gl_FragColor=vec4(vT*a*1.4,1.); }`;

const SKY_VS = /* glsl */`varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const SKY_FS = /* glsl */`
uniform sampler2D map; varying vec3 vD;
void main(){ vec3 d=normalize(vD); vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5, asin(clamp(d.y,-1.,1.))/3.14159265+.5);
  gl_FragColor=vec4(texture2D(map,uv).rgb,1.); }`;

const TAIL_VS = /* glsl */`
attribute float fade; uniform float pr; varying float vF;
void main(){ vF=fade; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(2.+6.*fade)*pr*(300./-mv.z); gl_Position=projectionMatrix*mv; }`;
const TAIL_FS = /* glsl */`
uniform vec3 col; varying float vF;
void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; gl_FragColor=vec4(col*exp(-r*12.)*vF*.55,1.); }`;

// ---------- cached CPU-side assets (canvases survive between mounts; GPU textures are per mount) ----------
let milkyWay = null;
function buildMilkyWay() {
  if (milkyWay) return milkyWay;
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const tilt = 62 * DEG, nx = 0, ny = Math.cos(tilt), nz = Math.sin(tilt); // galactic plane normal
  for (let y = 0; y < H; y++) {
    const la = (y / (H - 1) - .5) * Math.PI, cl = Math.cos(la), sy = Math.sin(la);
    for (let x = 0; x < W; x++) {
      const lo = (x / W - .5) * TAU, dx = Math.cos(lo) * cl, dz = Math.sin(lo) * cl;
      const gal = dx * nx + sy * ny + dz * nz;
      const band = Math.exp(-(gal * gal) / .02);
      const n = fbm3(dx * 3 + 11, sy * 3, dz * 3, 5, 4);
      const dust = fbm3(dx * 7, sy * 7 + 3, dz * 7, 9, 3);
      const v = band * Math.max(0, n * 1.4 - .35) * (1 - .7 * Math.max(0, dust - .5) * 2) + .012;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, v * 48); d[i + 1] = Math.min(255, v * 46); d[i + 2] = Math.min(255, v * 58); d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return (milkyWay = cv);
}
let glowCanvas = null;
function buildGlow() {
  if (glowCanvas) return glowCanvas;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.15, 'rgba(255,255,255,.55)');
  gr.addColorStop(.4, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return (glowCanvas = cv);
}

const orbitPos = (def, theta, out) => {
  const r = def.a * (1 - def.e * def.e) / (1 + def.e * Math.cos(theta));
  out.set(r * Math.cos(theta), 0, r * Math.sin(theta));
  out.applyAxisAngle(X_AXIS, def.incl * DEG).applyAxisAngle(Y_AXIS, def.node * DEG);
  return out;
};
const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// =====================================================================
export function mountSolar3D(container, options = {}) {
  if (!container || !webglAvailable()) return null;
  const preview = !!options.preview;
  const phone = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;

  container.textContent = '';
  const stage = document.createElement('div');
  stage.className = preview ? 'solar-preview-stage' : 'solar-stage';
  const cv = document.createElement('canvas');
  cv.className = preview ? 'solar-canvas solar-preview-cv' : 'solar-canvas';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', preview ? 'Güneş Sistemi canlı önizleme' : 'Etkileşimli 3B Güneş Sistemi');
  stage.append(cv);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !preview, powerPreference: 'high-performance', stencil: false });
  } catch { return null; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const maxDpr = preview ? 1 : (phone ? 1.5 : 2);

  // ---------- HUD (same markup/classes as the canvas version, styled by css/solar.css) ----------
  let hudEl = null, infoEl = null, labelsEl = null, playBtn = null, coursesBtn = null, speedBtns = [];
  if (!preview) {
    hudEl = document.createElement('div');
    hudEl.className = 'solar-hud';
    hudEl.innerHTML = `
      <div class="solar-top">
        <div class="solar-head"><p class="eyebrow">Evren Gözlemevi</p><h1>Güneş Sistemi</h1></div>
        <div class="solar-top-acts">
          <button type="button" class="solar-pill" data-solar-courses aria-pressed="false" aria-label="Derslerim modunu aç veya kapat">${ICONS.book}<span>Derslerim</span></button>
          <button type="button" class="solar-pill solar-icon-pill" data-solar-reset title="Görünümü sıfırla (R)" aria-label="Görünümü sıfırla">${ICONS.reset}<span class="solar-hide-xs">Sıfırla</span></button>
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
    labelsEl = document.createElement('div');
    labelsEl.className = 'solar3d-labels';
    infoEl = document.createElement('aside');
    infoEl.className = 'solar-info';
    infoEl.setAttribute('aria-label', 'Gezegen bilgileri');
    infoEl.hidden = true;
    stage.append(labelsEl, hudEl, infoEl);
    playBtn = hudEl.querySelector('[data-solar-play]');
    coursesBtn = hudEl.querySelector('[data-solar-courses]');
    speedBtns = [...hudEl.querySelectorAll('[data-solar-speed]')];
  }
  container.append(stage);

  // ---------- scene ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .5, 30000);
  const disposables = [];
  const keep = x => (disposables.push(x), x);

  // sky: Milky Way + twinkling stars
  const skyTex = keep(new THREE.CanvasTexture(buildMilkyWay()));
  skyTex.colorSpace = THREE.NoColorSpace;
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(9000, 32, 16)), keep(new THREE.ShaderMaterial({
    uniforms: { map: { value: skyTex } }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
  })));
  scene.add(sky);
  const starU = { time: { value: 0 }, pr: { value: 1 }, tw: { value: 1 } };
  {
    const n = preview ? 1200 : 3200, rng = makeRng(99), pos = new Float32Array(n * 3), size = new Float32Array(n), tint = new Float32Array(n * 3), ph = new Float32Array(n);
    const tints = [[1, 1, 1], [.75, .85, 1], [1, .92, .78], [1, .8, .7]];
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - u * u), R = 8000;
      pos.set([R * s * Math.cos(a), R * u, R * s * Math.sin(a)], i * 3);
      const big = rng(); size[i] = big > .985 ? 3.6 + rng() * 2 : 1 + rng() * rng() * 2.4;
      tint.set(tints[(rng() * tints.length) | 0], i * 3); ph[i] = rng();
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    scene.add(new THREE.Points(g, keep(new THREE.ShaderMaterial({ uniforms: starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))));
  }

  // lights for the standard-material asteroids
  scene.add(new THREE.PointLight(0xfff1dc, 2.6, 0, 0));
  scene.add(new THREE.AmbientLight(0x404858, .35));

  // the Sun
  const segs = preview ? [40, 28] : [96, 64];
  const sphereGeo = keep(new THREE.SphereGeometry(1, segs[0], segs[1]));
  const timeU = { value: 0 };
  const sun = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { time: timeU }, vertexShader: PLANET_VS, fragmentShader: SUN_FS })));
  sun.scale.setScalar(SUN_DEF.r);
  scene.add(sun);
  const glowTex = keep(new THREE.CanvasTexture(buildGlow()));
  const mkGlow = (scale, color, op) => {
    const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })));
    s.scale.setScalar(scale); scene.add(s); return s;
  };
  const sunGlows = [mkGlow(SUN_DEF.r * 6, 0xff9a3c, .32), mkGlow(SUN_DEF.r * 3.1, 0xffd890, .5)];

  // planets
  const bodies = [{ def: SUN_DEF, obj: sun, r: SUN_DEF.r, pos: new THREE.Vector3(), isSun: true }];
  const orbitLines = [];
  PLANET_DEFS.forEach((def, i) => {
    const tiltG = new THREE.Group(), spinG = new THREE.Group();
    tiltG.rotation.z = def.tilt * DEG;
    tiltG.scale.setScalar(def.r);
    tiltG.add(spinG); scene.add(tiltG);
    const a = ATMO[def.id] || [0, 0, 0, 0];
    const uni = {
      kind: { value: KIND[def.id] }, seed: { value: i * 3.17 }, time: timeU,
      ringN: { value: new THREE.Vector3(0, 1, 0) }, center: { value: new THREE.Vector3() },
      ringIn: { value: 1 }, ringOut: { value: 2 }, hasRing: { value: def.id === 'saturn' ? 1 : 0 }, ringKind: { value: 0 },
      atmo: { value: new THREE.Vector3(a[0], a[1], a[2]) }, atmoStr: { value: a[3] },
      aura: { value: 0 }, auraCol: { value: new THREE.Color(1, 1, 1) },
    };
    const mesh = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: uni, vertexShader: PLANET_VS, fragmentShader: PLANET_FS })));
    spinG.add(mesh);
    if (def.id === 'earth') {
      const clouds = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { time: timeU }, vertexShader: PLANET_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false })));
      clouds.scale.setScalar(1.012); spinG.add(clouds);
    }
    if (ATMO[def.id]) {
      const shell = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { atmo: uni.atmo, atmoStr: uni.atmoStr }, vertexShader: PLANET_VS, fragmentShader: ATMO_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide })));
      shell.scale.setScalar(1.045); tiltG.add(shell);
    }
    let ring = null;
    if (def.ring) {
      const rk = RING_KIND[def.ring.kind];
      const ru = { rIn: { value: def.ring.inner }, rOut: { value: def.ring.outer }, kind: { value: rk }, center: uni.center, R: { value: def.r }, ringN: uni.ringN };
      ring = new THREE.Mesh(keep(new THREE.RingGeometry(def.ring.inner, def.ring.outer, preview ? 96 : 192, 1)), keep(new THREE.ShaderMaterial({ uniforms: ru, vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false })));
      ring.rotation.x = -Math.PI / 2;
      tiltG.add(ring);
      uni.ringIn.value = def.ring.inner * def.r; uni.ringOut.value = def.ring.outer * def.r; uni.ringKind.value = rk;
    }
    // orbit line
    const pts = [], v = new THREE.Vector3();
    for (let k = 0; k <= 256; k++) pts.push(orbitPos(def, k / 256 * TAU, v).clone());
    const ol = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), keep(new THREE.LineBasicMaterial({ color: 0x9aa6bd, transparent: true, opacity: .16, depthWrite: false })));
    scene.add(ol); orbitLines.push(ol);
    // Derslerim: review satellites + progress aura
    const sats = new THREE.Group(); tiltG.add(sats);
    bodies.push({ def, obj: tiltG, spin: spinG, mesh, uni, ring, sats, r: def.r, pos: new THREE.Vector3(), theta: def.a0 || 0 });
  });

  // the Moon
  const moon = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({
    uniforms: { kind: { value: KIND.moon }, seed: { value: 42 }, time: timeU, ringN: { value: new THREE.Vector3(0, 1, 0) }, center: { value: new THREE.Vector3() }, ringIn: { value: 1 }, ringOut: { value: 2 }, hasRing: { value: 0 }, ringKind: { value: 0 }, atmo: { value: new THREE.Vector3() }, atmoStr: { value: 0 }, aura: { value: 0 }, auraCol: { value: new THREE.Color() } },
    vertexShader: PLANET_VS, fragmentShader: PLANET_FS,
  })));
  moon.scale.setScalar(1.7); scene.add(moon);
  const earth = bodies.find(b => b.def.id === 'earth');

  // asteroid belt (instanced, lit)
  const belt = new THREE.Group(); scene.add(belt);
  {
    const n = preview ? 350 : (phone ? 900 : 1600), rng = makeRng(4242);
    const im = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(1, 0)), keep(new THREE.MeshStandardMaterial({ color: 0x8c8378, roughness: 1, metalness: 0, flatShading: true })), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < n; i++) {
      const u = (rng() + rng()) / 2, r = 133 + u * 22, ang = rng() * TAU;
      p.set(r * Math.cos(ang), (rng() - .5) * 7 * (1 - Math.abs(u - .5)), r * Math.sin(ang));
      e.set(rng() * TAU, rng() * TAU, rng() * TAU); q.setFromEuler(e);
      const sz = .25 + rng() * rng() * 1.1; s.set(sz, sz * (.6 + rng() * .5), sz * (.7 + rng() * .4));
      im.setMatrixAt(i, m.compose(p, q, s));
    }
    belt.add(im);
  }

  // comet: head + particle tail pointing away from the Sun
  const comet = { active: false, t: 0, wait: 6, dur: 26, head: null, tail: null, pos: new THREE.Vector3(), off: null, n: preview ? 0 : 260 };
  if (comet.n) {
    comet.head = mkGlow(9, 0xcfe8ff, 0);
    const g = keep(new THREE.BufferGeometry()), pos = new Float32Array(comet.n * 3), fade = new Float32Array(comet.n), rng = makeRng(77);
    comet.off = new Float32Array(comet.n * 4);
    for (let i = 0; i < comet.n; i++) { const f = rng(); fade[i] = 1 - f; comet.off.set([f, (rng() - .5), (rng() - .5), rng()], i * 4); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('fade', new THREE.BufferAttribute(fade, 1));
    comet.tail = new THREE.Points(g, keep(new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(.6, .8, 1) }, pr: starU.pr }, vertexShader: TAIL_VS, fragmentShader: TAIL_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
    comet.tail.visible = false; comet.tail.frustumCulled = false; scene.add(comet.tail);
  }

  // post-processing: bloom makes the Sun (and only the Sun) glow
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), preview ? .6 : .7, .45, 1.05);
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());

  // ---------- labels ----------
  const labels = [];
  if (labelsEl) bodies.forEach((b, i) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'solar3d-label'; el.dataset.idx = i; el.style.visibility = 'hidden';
    labelsEl.append(el); labels.push(el);
  });

  // ---------- Derslerim ----------
  let coursesMode = false, courseMap = buildCourseMap();
  const satGeo = keep(new THREE.SphereGeometry(1, 12, 8));
  function applyCourses() {
    courseMap = buildCourseMap();
    bodies.forEach((b, i) => {
      if (b.isSun) return;
      const ci = coursesMode ? courseMap[i - 1] : null;
      b.uni.aura.value = ci ? .25 + .75 * ci.ratio : 0;
      if (ci) b.uni.auraCol.value.set(ci.course.color || '#f4f4f5');
      b.sats.clear();
      if (ci) for (let k = 0; k < Math.min(ci.review, 12); k++) {
        const s = new THREE.Mesh(satGeo, keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(ci.course.color || '#ffffff').multiplyScalar(2) })));
        s.scale.setScalar(.09); s.userData = { a: k / Math.max(1, ci.review) * TAU, rr: 1.7 + (k % 3) * .25, inc: (k % 4) * .4 };
        b.sats.add(s);
      }
    });
    labels.forEach((el, i) => {
      const b = bodies[i], ci = coursesMode && !b.isSun ? courseMap[i - 1] : null;
      el.innerHTML = ci ? `<i style="color:${esc(ci.course.color || '#fff')}">${esc(ci.course.icon || '•')}</i>${esc(ci.course.name)}` : esc(b.def.name);
      el.classList.toggle('course', !!ci);
      el.setAttribute('aria-label', `${ci ? ci.course.name + ' · ' : ''}${b.def.name} — bilgileri göster`);
    });
    if (focusIdx >= 0) renderInfo();
  }

  // ---------- camera ----------
  const DEF = { yaw: preview ? .35 : .42, pitch: preview ? .42 : .46, dist: preview ? 560 : 640 };
  const cam = { yaw: DEF.yaw, pitch: DEF.pitch, dist: DEF.dist, target: new THREE.Vector3() };
  let vYaw = 0, vPitch = 0, focusIdx = -1, fly = null, shift = { x: 0, y: 0, gx: 0, gy: 0 };
  // free part of the stage next to/above the info panel (geometry mirrors css/solar.css: bottom sheet up to 820px, side panel above)
  const freeArea = () => {
    if (preview || !infoEl) return { w: W, h: H, cx: W / 2, cy: H / 2 };
    if (W <= 820) { const sheet = Math.min(H * .47, 360) + 74, top = 72, h = Math.max(120, H - sheet - top); return { w: W, h, cx: W / 2, cy: top + h / 2 }; }
    const w = W - 364; return { w, h: H - 80, cx: w / 2, cy: H / 2 + 20 };
  };
  // distance at which the body (rings included) fills ~36% of the free area
  const focusDist = b => {
    const rEff = b.def.ring ? b.r * b.def.ring.outer : b.r, a = freeArea(), px = Math.min(a.w, a.h) * .36;
    return Math.max(rEff * 1.8, rEff * (H / 2) / (px * Math.tan(camera.fov * DEG / 2)));
  };
  function placeCamera() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.target.x + cam.dist * cp * Math.sin(cam.yaw), cam.target.y + cam.dist * Math.sin(cam.pitch), cam.target.z + cam.dist * cp * Math.cos(cam.yaw));
    camera.lookAt(cam.target);
  }
  function flyTo(idx) {
    focusIdx = idx;
    const b = bodies[idx];
    const to = { dist: focusDist(b), pitch: b.def.id === 'saturn' ? .42 : Math.min(Math.max(cam.pitch, .12), .5), yaw: cam.yaw };
    if (!b.isSun) { // look from the Sun's side, ~32° off, so the planet shows a lit three-quarter face instead of its night side
      let d = Math.atan2(-b.pos.x, -b.pos.z) + .55 - cam.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d)); to.yaw = cam.yaw + d;
    }
    if (motionMode() !== 'full') { cam.dist = to.dist; cam.pitch = to.pitch; cam.yaw = to.yaw; fly = null; }
    else fly = { t0: performance.now(), from: { target: cam.target.clone(), dist: cam.dist, pitch: cam.pitch, yaw: cam.yaw }, to };
    vYaw = vPitch = 0;
    renderInfo(); kick();
  }
  function unfocus() {
    focusIdx = -1;
    if (motionMode() !== 'full') { cam.target.set(0, 0, 0); cam.dist = DEF.dist; fly = null; }
    else fly = { t0: performance.now(), from: { target: cam.target.clone(), dist: cam.dist, pitch: cam.pitch }, to: { dist: DEF.dist, pitch: cam.pitch }, home: true };
    renderInfo(); kick();
  }
  function resetView() { cam.yaw = DEF.yaw; cam.pitch = DEF.pitch; unfocus(); }

  // info panel
  function renderInfo() {
    if (!infoEl) return;
    if (focusIdx < 0) { infoEl.classList.remove('open'); infoEl.hidden = true; shift.gx = shift.gy = 0; return; }
    const b = bodies[focusIdx], def = b.def, ci = coursesMode && !b.isSun ? courseMap[focusIdx - 1] : null;
    const pct = ci && ci.total ? Math.round(ci.ratio * 100) : 0;
    const courseBlock = coursesMode && !b.isSun ? (ci ? `
      <div class="solar-course-box" style="--cc:${esc(ci.course.color || '#f4f4f5')}">
        <div class="solar-course-top"><i class="cglyph" style="--cc:${esc(ci.course.color || '#f4f4f5')}" aria-hidden="true">${esc(ci.course.icon || '•')}</i>
          <div class="solar-course-meta"><strong>${esc(ci.course.name)}</strong><span class="mono small">${ci.solved}/${ci.total} çözüldü · %${pct}${ci.review ? ` · ${ci.review} tekrar` : ''}</span></div></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <a class="btn primary small wide solar-open-course" href="#/c/${esc(ci.course.id)}">Dersi aç →</a>
      </div>` : `<p class="solar-no-course small">Bu gezegene atanmış ders yok.</p>`) : '';
    infoEl.innerHTML = `
      <div class="solar-info-head">
        <button type="button" class="solar-back" data-solar-back aria-label="Tüm sisteme dön">${ICONS.back}<span>Tüm sistem</span></button>
        <button type="button" class="solar-x" data-solar-back aria-label="Bilgi panelini kapat">${ICONS.x}</button>
      </div>
      <div class="solar-info-title"><span class="solar-swatch" style="--pc:${esc(ci ? (ci.course.color || def.color) : def.color)}" aria-hidden="true"></span>
        <div><h2>${esc(ci ? ci.course.name : def.name)}</h2><p class="solar-info-sub">${ci ? `${esc(def.name)} · ` : ''}${esc(def.subtitle)}</p></div></div>
      ${courseBlock}
      <dl class="solar-facts">${def.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}</dl>
      <div class="solar-fun"><span class="solar-fun-lbl">Biliyor muydun?</span><p>${esc(def.funFact)}</p></div>
      <div class="solar-info-nav">
        <button type="button" class="solar-nav-btn" data-solar-step="-1" aria-label="Önceki gök cismi">${ICONS.back} Önceki</button>
        <button type="button" class="solar-nav-btn" data-solar-step="1" aria-label="Sonraki gök cismi">Sonraki ${ICONS.next}</button>
      </div>`;
    infoEl.hidden = false;
    measureFraming();
    requestAnimationFrame(() => { if (!dead && focusIdx >= 0) infoEl.classList.add('open'); });
  }
  // keep the focused planet in the part of the stage the info panel does not cover
  function measureFraming() {
    if (!infoEl || focusIdx < 0) { shift.gx = shift.gy = 0; return; }
    const a = freeArea(); shift.gx = a.cx - W / 2; shift.gy = a.cy - H / 2;
    if (motionMode() !== 'full') { shift.x = shift.gx; shift.y = shift.gy; }
    kick();
  }

  // ---------- sizing ----------
  let W = 1, H = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    const dpr = Math.min(devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    composer.setPixelRatio(dpr); composer.setSize(W, H);
    starU.pr.value = dpr;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    measureFraming(); kick();
  }

  // ---------- simulation ----------
  let simT = 0, speed = 1, paused = false, last = performance.now(), raf = 0, dead = false, visible = true, lastDraw = 0, rawDt = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3();
  function update(dt) {
    const mm = motionMode();
    const rate = paused ? 0 : speed * (mm === 'full' ? 1 : mm === 'reduced' ? .2 : 0);
    simT += dt * rate;
    timeU.value += dt * (mm === 'full' ? 1 : 0);
    starU.time.value = timeU.value; starU.tw.value = mm === 'full' ? 1 : 0;
    for (const b of bodies) {
      if (b.isSun) { sun.rotation.y = simT * .02; continue; }
      orbitPos(b.def, (b.def.a0 || 0) + b.def.omega * simT, b.pos);
      b.obj.position.copy(b.pos);
      b.spin.rotation.y = simT * b.def.spin * 1.6;
      b.uni.center.value.copy(b.pos);
      up.set(0, 1, 0).applyQuaternion(b.obj.quaternion); b.uni.ringN.value.copy(up);
      b.sats.children.forEach((s, k) => {
        const d = s.userData, a = d.a + simT * (1.4 + k * .07);
        s.position.set(Math.cos(a) * d.rr, Math.sin(a + d.inc) * .35, Math.sin(a) * d.rr);
      });
    }
    // Moon around Earth
    const ma = simT * 1.9 + .7;
    moon.position.set(earth.pos.x + Math.cos(ma) * 13, earth.pos.y + Math.sin(ma) * 1.6, earth.pos.z + Math.sin(ma) * 13);
    moon.rotation.y = -ma;
    belt.rotation.y = simT * .02;
    for (const g of sunGlows) g.material.rotation = timeU.value * .01;
    sunGlows[0].scale.setScalar(SUN_DEF.r * (6 + Math.sin(timeU.value * .8) * .2));
    // comet on a long elliptic pass, tail always pointing away from the Sun
    if (comet.n) {
      if (!comet.active) {
        comet.wait -= dt;
        if (comet.wait < 0 && mm === 'full') { comet.active = true; comet.t = 0; comet.tail.visible = true; }
      } else {
        comet.t += dt * Math.max(1, speed * .5);
        const k = comet.t / comet.dur;
        if (k >= 1) { comet.active = false; comet.wait = 25 + Math.random() * 20; comet.tail.visible = false; comet.head.material.opacity = 0; }
        else {
          const th = -1.7 + k * 3.4, r = 300 / (1 + .82 * Math.cos(th));
          comet.pos.set(r * Math.cos(th), 0, r * Math.sin(th)).applyAxisAngle(X_AXIS, .45).applyAxisAngle(Y_AXIS, 2.2);
          const fadeIn = Math.min(1, k * 6, (1 - k) * 6);
          comet.head.position.copy(comet.pos); comet.head.material.opacity = .9 * fadeIn;
          const len = 40 + 900 / Math.max(60, comet.pos.length()) * 40;
          tmp.copy(comet.pos).normalize();
          const arr = comet.tail.geometry.attributes.position.array, off = comet.off;
          for (let i = 0; i < comet.n; i++) {
            const f = off[i * 4], spread = f * len * .12;
            arr[i * 3] = comet.pos.x + tmp.x * f * len + off[i * 4 + 1] * spread;
            arr[i * 3 + 1] = comet.pos.y + tmp.y * f * len + off[i * 4 + 2] * spread;
            arr[i * 3 + 2] = comet.pos.z + tmp.z * f * len + (off[i * 4 + 3] - .5) * spread;
          }
          comet.tail.geometry.attributes.position.needsUpdate = true;
          comet.tail.material.uniforms.col.value.setRGB(.6 * fadeIn, .8 * fadeIn, 1 * fadeIn);
        }
      }
    }
    // camera: fly-to (time based, ~1.2 s), then follow the moving planet
    if (fly) {
      const k = Math.min(1, (performance.now() - fly.t0) / 1200), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const dest = fly.home ? tmp2.set(0, 0, 0) : bodies[focusIdx].isSun ? tmp2.set(0, 0, 0) : bodies[focusIdx].pos;
      cam.target.lerpVectors(fly.from.target, dest, e);
      cam.dist = fly.from.dist + (fly.to.dist - fly.from.dist) * e;
      cam.pitch = fly.from.pitch + (fly.to.pitch - fly.from.pitch) * e;
      if (fly.to.yaw != null && fly.from.yaw != null) cam.yaw = fly.from.yaw + (fly.to.yaw - fly.from.yaw) * e;
      if (k >= 1) fly = null;
    } else if (focusIdx > 0) cam.target.copy(bodies[focusIdx].pos);
    if (!drag && mm === 'full' && (Math.abs(vYaw) > 1e-5 || Math.abs(vPitch) > 1e-5)) {
      cam.yaw += vYaw; cam.pitch = Math.min(1.45, Math.max(-1.2, cam.pitch + vPitch));
      vYaw *= .92; vPitch *= .92;
    }
    if (preview && mm === 'full') cam.yaw += dt * .03;
    // panel framing via a projection offset
    const sk = mm === 'full' ? 1 - Math.exp(-rawDt * 7) : 1; // real elapsed time: settles fast even on slow devices
    shift.x += (shift.gx - shift.x) * sk; shift.y += (shift.gy - shift.y) * sk;
    if (Math.abs(shift.x) > .5 || Math.abs(shift.y) > .5) camera.setViewOffset(W, H, -shift.x, -shift.y, W, H);
    else camera.clearViewOffset();
    placeCamera();
    // orbit highlight
    orbitLines.forEach((l, i) => { l.material.opacity = focusIdx === i + 1 ? .5 : .16; });
  }
  const proj = new THREE.Vector3();
  function screenOf(b, out) {
    proj.copy(b.isSun ? tmp.set(0, 0, 0) : b.pos).project(camera);
    out.x = (proj.x * .5 + .5) * W; out.y = (-proj.y * .5 + .5) * H; out.z = proj.z;
    const d = camera.position.distanceTo(b.isSun ? tmp.set(0, 0, 0) : b.pos);
    out.r = b.r / (d * Math.tan(camera.fov * DEG / 2)) * H / 2;
    return out;
  }
  const sp = { x: 0, y: 0, z: 0, r: 0 };
  function placeLabels() {
    labels.forEach((el, i) => {
      screenOf(bodies[i], sp);
      const show = sp.z < 1 && sp.x > -60 && sp.x < W + 60 && sp.y > -40 && sp.y < H + 40 && (i === focusIdx || sp.r < H * .22);
      el.style.visibility = show ? '' : 'hidden';
      if (show) el.style.transform = `translate(${sp.x.toFixed(1)}px, ${(sp.y + Math.max(sp.r, 4) + 8).toFixed(1)}px) translateX(-50%)`;
      el.classList.toggle('on', i === focusIdx);
    });
  }

  function frame(now) {
    raf = 0;
    if (dead) return;
    rawDt = Math.min(1, (now - last) / 1000); const dt = Math.min(.05, rawDt); last = now;
    if (preview && now - lastDraw < 33) { schedule(); return; } // ~30 fps cap for the dashboard card
    lastDraw = now;
    update(dt);
    composer.render(dt);
    placeLabels();
    if (motionMode() !== 'off' || fly || drag || Math.abs(vYaw) > 1e-5) schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function kick() { last = performance.now(); schedule(); }

  // ---------- input ----------
  const ptrs = new Map();
  let drag = false, downAt = null, pinch0 = 0, dist0 = 0, lastTap = 0;
  function pick(x, y) {
    let best = -1, bd = 1e9;
    bodies.forEach((b, i) => {
      screenOf(b, sp); if (sp.z >= 1) return;
      const d = Math.hypot(sp.x - x, sp.y - y), lim = Math.max(sp.r + 12, phone ? 26 : 18);
      if (d < lim && d < bd) { bd = d; best = i; }
    });
    return best;
  }
  const onDown = e => {
    if (preview) return;
    cv.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = cam.dist; }
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    drag = true; vYaw = vPitch = 0; kick();
  };
  const onMove = e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      cam.dist = clampDist(dist0 * pinch0 / Math.max(1, d)); fly = null; kick(); return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    vYaw = -dx * .005; vPitch = dy * .004;
    cam.yaw += vYaw; cam.pitch = Math.min(1.45, Math.max(-1.2, cam.pitch + vPitch));
    kick();
  };
  const onUp = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size) return;
    drag = false;
    const r = cv.getBoundingClientRect();
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 7 && performance.now() - downAt.t < 450) {
      const now = performance.now(), i = pick(e.clientX - r.left, e.clientY - r.top);
      if (i >= 0) flyTo(i);
      else if (now - lastTap < 320) resetView();
      lastTap = now;
      vYaw = vPitch = 0;
    }
    kick();
  };
  const clampDist = d => Math.min(2400, Math.max(focusIdx >= 0 ? bodies[focusIdx].r * 2.4 : 90, d));
  const onWheel = e => { if (preview) return; e.preventDefault(); cam.dist = clampDist(cam.dist * Math.exp(e.deltaY * .0012)); fly = null; kick(); };
  const onHud = e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('solarPlay' in b.dataset) { paused = !paused; b.innerHTML = paused ? ICONS.play : ICONS.pause; b.setAttribute('aria-label', paused ? 'Oynat' : 'Duraklat'); b.setAttribute('aria-pressed', paused); }
    else if (b.dataset.solarSpeed) { speed = +b.dataset.solarSpeed; speedBtns.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); }
    else if (b.dataset.solarZoom) { cam.dist = clampDist(cam.dist * (b.dataset.solarZoom === 'in' ? .78 : 1.28)); fly = null; }
    else if ('solarCourses' in b.dataset) { coursesMode = !coursesMode; b.setAttribute('aria-pressed', coursesMode); b.classList.toggle('on', coursesMode); applyCourses(); }
    else if ('solarReset' in b.dataset) resetView();
    kick();
  };
  const onInfo = e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('solarBack' in b.dataset) unfocus();
    else if (b.dataset.solarStep) flyTo((focusIdx + +b.dataset.solarStep + bodies.length) % bodies.length);
  };
  const onLabel = e => { const b = e.target.closest('.solar3d-label'); if (b) flyTo(+b.dataset.idx); };
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'r' || e.key === 'R') resetView();
    else if (e.key === 'Escape' && focusIdx >= 0) unfocus();
    else if (e.key === ' ') { e.preventDefault(); playBtn?.click(); }
    else if (e.key === 'ArrowRight' && focusIdx >= 0) flyTo((focusIdx + 1) % bodies.length);
    else if (e.key === 'ArrowLeft' && focusIdx >= 0) flyTo((focusIdx - 1 + bodies.length) % bodies.length);
  };
  const onPreviewClick = () => { location.hash = '#/evren'; };
  const onVis = () => { if (!document.hidden) kick(); };
  const onLost = e => { e.preventDefault(); dead = true; };

  if (preview) stage.addEventListener('click', onPreviewClick);
  else {
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('wheel', onWheel, { passive: false });
    hudEl.addEventListener('click', onHud);
    infoEl.addEventListener('click', onInfo);
    labelsEl.addEventListener('click', onLabel);
    addEventListener('keydown', onKey);
  }
  document.addEventListener('visibilitychange', onVis);
  addEventListener('mp-theme', kick);
  cv.addEventListener('webglcontextlost', onLost);
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) kick(); });
  io.observe(stage);

  applyCourses();
  resize();
  update(0);
  kick();

  return () => {
    dead = true; cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('mp-theme', kick);
    removeEventListener('keydown', onKey);
    cv.removeEventListener('webglcontextlost', onLost);
    scene.traverse(o => { if (o.material?.dispose && !disposables.includes(o.material)) o.material.dispose(); });
    disposables.forEach(d => d.dispose?.());
    bloom.dispose(); composer.dispose?.();
    renderer.dispose(); renderer.forceContextLoss();
    stage.remove();
  };
}
