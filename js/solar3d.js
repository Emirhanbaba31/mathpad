// WebGL solar system (three.js) with real planet textures (Solar System Scope, CC BY 4.0, from NASA imagery).
// Lighting is per body type: Lommel-Seeliger + texture bump for rocky worlds, limb darkening for gas giants,
// Earth with ocean glint, city lights, cloud shadows and a twilight band; Saturn's ring and globe shadow each other
// analytically. A spaceship cinematic flies between planets and switches the app's planet theme on arrival.
// mountSolar3D(container, { preview }) -> cleanup, or null when WebGL is unavailable (caller falls back to canvas 2D).
import * as THREE from '../vendor/three.mjs';
import { SUN_DEF, PLANET_DEFS, SPEEDS, ICONS, buildCourseMap, makeRng } from './solar.js';
import { esc } from './ui.js';
import { motion } from './fx.js';

const DEG = Math.PI / 180, TAU = Math.PI * 2;
const motionMode = () => document.documentElement.dataset.motion === 'off' ? 'off' : motion();
const TEX = {
  sun: '2k_sun.jpg', mercury: '2k_mercury.jpg', venus: '2k_venus_atmosphere.jpg', earth: '2k_earth_daymap.jpg',
  earthNight: '2k_earth_nightmap.jpg', earthClouds: '2k_earth_clouds.jpg', moon: '2k_moon.jpg', mars: '2k_mars.jpg',
  jupiter: '2k_jupiter.jpg', saturn: '2k_saturn.jpg', saturnRing: '2k_saturn_ring_alpha.png', uranus: '2k_uranus.jpg',
  neptune: '2k_neptune.jpg', sky: '2k_stars_milky_way.jpg',
};
// type: 0 rocky (Lommel-Seeliger + bump), 1 gas/clouds (limb darkened), 2 Earth
const LOOK = {
  mercury: { type: 0, bump: .9 }, venus: { type: 1, atmo: [1, .78, .42], atmoStr: .8 }, earth: { type: 2, atmo: [.32, .6, 1], atmoStr: 1.2 },
  mars: { type: 0, bump: .6, atmo: [1, .52, .32], atmoStr: .35 }, jupiter: { type: 1 }, saturn: { type: 1 },
  uranus: { type: 1, atmo: [.55, .9, 1], atmoStr: .6 }, neptune: { type: 1, atmo: [.35, .55, 1], atmoStr: .8 }, moon: { type: 0, bump: 1.1 },
};

// ---------- GLSL ----------
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
float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
`;

const VS = /* glsl */`
varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
void main(){
  vUv=uv; vObj=normalize(position);
  vec4 w=modelMatrix*vec4(position,1.); vPw=w.xyz;
  vNw=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*w;
}`;

const PLANET_FS = /* glsl */`
uniform sampler2D map; uniform sampler2D nightMap; uniform sampler2D cloudMap; uniform sampler2D ringTex;
uniform float type; uniform float bump; uniform float time;
uniform vec3 atmo; uniform float atmoStr; uniform float aura; uniform vec3 auraCol;
uniform float hasRing; uniform vec3 ringN; uniform vec3 center; uniform float ringIn; uniform float ringOut;
varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
float luma(vec3 c){ return dot(c,vec3(.299,.587,.114)); }
// bump from the albedo's luminance via screen-space derivatives (Mikkelsen's perturbNormalArb)
vec3 bumpN(vec3 N, float h){
  vec3 dpx=dFdx(vPw), dpy=dFdy(vPw); float dhx=dFdx(h), dhy=dFdy(h);
  vec3 r1=cross(dpy,N), r2=cross(N,dpx); float det=dot(dpx,r1);
  return normalize(abs(det)*N-sign(det)*(dhx*r1+dhy*r2));
}
void main(){
  vec3 N=normalize(vNw), L=normalize(-vPw), V=normalize(cameraPosition-vPw);
  vec3 alb=texture2D(map,vUv).rgb;
  float ndv0=max(dot(N,V),0.);
  if(type<.5) N=bumpN(N, luma(alb)*bump*length(dFdx(vPw)+dFdy(vPw))*6.*smoothstep(.05,.35,ndv0)); // no bump noise at the limb
  float ndl=dot(N,L), ndv=max(dot(N,V),0.), ndlG=dot(normalize(vNw),L);
  float lit;
  if(type<.5){ // rocky: Lommel-Seeliger blended with Lambert, crisp terminator like the Moon
    float ls=max(ndl,0.)/(max(ndl,0.)+ndv+1e-4)*2.;
    lit=mix(max(ndl,0.),min(ls,1.2),.35)*smoothstep(-.02,.06,ndlG);
  } else { // gaseous: soft terminator, limb darkening
    lit=smoothstep(-.12,.4,ndl)*(.25+.75*max(ndl,0.))*(.55+.45*pow(ndv,.35));
  }
  // Saturn: the rings' shadow on the globe
  if(hasRing>.5){
    float dn=dot(L,ringN);
    if(abs(dn)>1e-4){ float t=dot(center-vPw,ringN)/dn;
      if(t>0.){ float u=(length(vPw+L*t-center)-ringIn)/(ringOut-ringIn);
        if(u>0.&&u<1.) lit*=1.-.85*texture2D(ringTex,vec2(u,.5)).a; } }
  }
  vec3 c=alb*lit*(type<.5 ? 1.55 : type>1.5 ? 1.45 : 1.18);
  if(type>1.5){ // Earth
    float ocean=smoothstep(.04,.12,alb.b-max(alb.r,alb.g)*.9);
    float cl=texture2D(cloudMap,vUv+vec2(.0018,-.0008)).r;            // cloud shadows
    c*=1.-.45*cl*smoothstep(0.,.3,ndlG);
    vec3 H=normalize(L+V); float fres=.04+.96*pow(1.-ndv,5.);
    float nh=max(dot(normalize(vNw),H),0.);
    c+=vec3(1.,.93,.8)*(pow(nh,260.)*.55+pow(nh,28.)*.08)*ocean*(.6+fres)*step(0.,ndlG); // tight glint + soft sheen
    vec3 night=texture2D(nightMap,vUv).rgb;
    c+=night*vec3(1.,.78,.5)*smoothstep(.08,-.2,ndlG)*2.2*(1.-cl*.8);
    c+=vec3(1.,.42,.15)*exp(-pow(ndlG/.07,2.))*.09;                  // twilight band
  }
  float fr=pow(1.-ndv,3.);
  float scatter=smoothstep(-.35,.5,ndlG)+1.4*pow(max(dot(V,-L),0.),6.);  // day side + forward scattering when backlit
  c+=atmo*fr*atmoStr*scatter*.9;
  c+=auraCol*fr*aura*1.8;
  c+=alb*.006;
  gl_FragColor=vec4(c,1.);
}`;

const CLOUD_FS = /* glsl */`
uniform sampler2D cloudMap; uniform float time;
varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
void main(){
  float a=texture2D(cloudMap,vUv+vec2(time*.0015,0.)).r;
  vec3 N=normalize(vNw), L=normalize(-vPw);
  float ndl=dot(N,L), lit=smoothstep(-.08,.3,ndl)*(.3+.7*max(ndl,0.));
  vec3 col=mix(vec3(1.,.55,.3),vec3(1.),smoothstep(-.05,.25,ndl));     // clouds blush orange at sunset
  gl_FragColor=vec4(col*lit*1.55,a*.92);
}`;

const ATMO_FS = /* glsl */`
uniform vec3 atmo; uniform float atmoStr;
varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
void main(){
  vec3 N=normalize(vNw), V=normalize(cameraPosition-vPw), L=normalize(-vPw);
  float fr=pow(1.-abs(dot(N,V)),3.5);
  float ndl=dot(N,L), day=smoothstep(-.45,.4,ndl);
  vec3 col=mix(vec3(1.,.5,.25),atmo,smoothstep(-.15,.35,ndl));          // orange at the terminator, blue by day
  float fwd=pow(max(dot(V,-L),0.),5.)*1.6;
  gl_FragColor=vec4(col*fr*(day+fwd)*atmoStr*.85,1.);
}`;

const SUN_FS = /* glsl */`
uniform sampler2D map; uniform float time;
varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
${NOISE}
void main(){
  vec3 p=vObj;
  vec2 w=vec2(fbm(p*3.+vec3(0.,0.,time*.03)),fbm(p*3.+vec3(5.2,1.3,time*.03)))*.012;
  vec3 c=texture2D(map,vUv+w+vec2(time*.002,0.)).rgb;
  float g=snoise(p*40.+time*.08)*.5+.5;
  c=mix(c*.75,c*1.25,g);
  float mu=max(dot(normalize(vNw),normalize(cameraPosition-vPw)),0.);
  c*=.4+.6*pow(mu,.5);
  gl_FragColor=vec4(c*vec3(2.3,1.75,1.25),1.);
}`;

// corona: a camera-facing quad with animated rays
const CORONA_VS = /* glsl */`varying vec2 vQ; void main(){ vQ=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const CORONA_FS = /* glsl */`
uniform float time; varying vec2 vQ;
${NOISE}
void main(){
  float r=length(vQ); if(r>1.) discard;
  float a=atan(vQ.y,vQ.x);
  float rays=pow(snoise(vec3(cos(a)*3.,sin(a)*3.,time*.08))*.5+.5,2.)*.7+.3;
  float rr=(r-.2)/.8;
  float glow=exp(-rr*5.5)*rays+exp(-rr*12.)*1.4;
  glow*=smoothstep(.17,.23,r);
  gl_FragColor=vec4(vec3(1.,.62,.28)*glow*1.4,1.);
}`;

const RING_VS = /* glsl */`varying vec3 vPw; varying vec2 vLoc;
void main(){ vLoc=position.xy; vec4 w=modelMatrix*vec4(position,1.); vPw=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`;
const RING_FS = /* glsl */`
uniform sampler2D ringTex; uniform float rIn; uniform float rOut; uniform vec3 center; uniform float R; uniform vec3 ringN; uniform float tint;
varying vec3 vPw; varying vec2 vLoc;
void main(){
  float u=(length(vLoc)-rIn)/(rOut-rIn); if(u<0.||u>1.) discard;
  vec4 t=texture2D(ringTex,vec2(u,.5)); if(t.a<.02) discard;
  vec3 L=normalize(-vPw), V=normalize(cameraPosition-vPw);
  vec3 oc=vPw-center; float b=dot(oc,L), c=dot(oc,oc)-R*R, h=b*b-c;
  float sh=(h>0. && -b-sqrt(h)>0.) ? .05 : 1.;                       // the planet's shadow on the rings
  bool lit=sign(dot(ringN,L))==sign(dot(ringN,V));
  float bright=lit ? .75+.45*abs(dot(ringN,L)) : .35+.4*(1.-t.a);       // unlit face glows by forward scatter
  float fwd=pow(max(dot(V,-L),0.),6.)*(1.-t.a)*1.5;
  vec3 col=mix(t.rgb,vec3(.6,.75,.85),tint);
  gl_FragColor=vec4(col*(bright+fwd)*sh*1.35,t.a*(tint>.5?.55:.96));
}`;

const SKY_VS = /* glsl */`varying vec3 vD; void main(){ vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const SKY_FS = /* glsl */`uniform sampler2D map; varying vec3 vD;
void main(){ vec3 d=normalize(vD); vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5, asin(clamp(d.y,-1.,1.))/3.14159265+.5);
  gl_FragColor=vec4(texture2D(map,uv).rgb*.42,1.); }`;

const STAR_VS = /* glsl */`
attribute float size; attribute vec3 tint; attribute float phase; uniform float time; uniform float pr; uniform float tw;
varying vec3 vT; varying float vA;
void main(){ vT=tint; vA=.6+.4*sin(time*(1.3+phase*.8)+phase*6.28)*tw+(1.-tw)*.4;
  gl_PointSize=size*pr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const STAR_FS = /* glsl */`varying vec3 vT; varying float vA;
void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; gl_FragColor=vec4(vT*exp(-r*18.)*vA*1.5,1.); }`;

const FLAME_FS = /* glsl */`
uniform float time; uniform float power; varying vec2 vUv; varying vec3 vNw; varying vec3 vPw; varying vec3 vObj;
${NOISE}
void main(){
  float y=vUv.y;                                    // 0 at the nozzle .. 1 at the tip
  float n=snoise(vec3(vUv.x*6.,y*4.-time*14.,time*3.))*.5+.5;
  float a=(1.-y)*(.6+.4*n)*power;
  vec3 col=mix(vec3(.55,.75,1.),vec3(1.),pow(1.-y,3.));
  gl_FragColor=vec4(col*a*2.2,1.);
}`;

const TAIL_VS = /* glsl */`attribute float fade; uniform float pr; varying float vF;
void main(){ vF=fade; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=(2.+7.*fade)*pr*(300./-mv.z); gl_Position=projectionMatrix*mv; }`;
const TAIL_FS = /* glsl */`uniform vec3 col; varying float vF;
void main(){ vec2 d=gl_PointCoord-.5; float r=dot(d,d); if(r>.25) discard; gl_FragColor=vec4(col*exp(-r*12.)*vF*.55,1.); }`;

const X_AXIS = new THREE.Vector3(1, 0, 0), Y_AXIS = new THREE.Vector3(0, 1, 0);
const orbitPos = (def, theta, out) => {
  const r = def.a * (1 - def.e * def.e) / (1 + def.e * Math.cos(theta));
  return out.set(r * Math.cos(theta), 0, r * Math.sin(theta)).applyAxisAngle(X_AXIS, def.incl * DEG).applyAxisAngle(Y_AXIS, def.node * DEG);
};

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// irregular rock shapes for the asteroid belt: noise-displaced icosahedra
function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, rng = makeRng(seed), v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => [new THREE.Vector3(rng() - .5, rng() - .5, rng() - .5).normalize(), .15 + rng() * .3]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let s = .82;
    for (const [d, k] of bumps) s += k * Math.max(0, v.dot(d)) ** 3;
    p.setXYZ(i, v.x * s, v.y * s * .85, v.z * s);
  }
  g.computeVertexNormals();
  return g;
}

// Nova's ship: a sleek line-art inspired hull, glowing engines, wing lights
function makeShip(keep, flameU) {
  const g = new THREE.Group();
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0xe6e9ef, metalness: .8, roughness: .25 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: 0x1d2433, metalness: .7, roughness: .4 }));
  const glass = keep(new THREE.MeshStandardMaterial({ color: 0x0b1830, metalness: .3, roughness: .05, emissive: 0x2a63c4, emissiveIntensity: .7 }));
  const prof = [[0, -2.1], [.5, -2], [.74, -1.3], [.8, 0], [.64, 1.2], [.34, 2.1], [.08, 2.6], [0, 2.65]].map(([r, z]) => new THREE.Vector2(r, z));
  const hull = new THREE.Mesh(keep(new THREE.LatheGeometry(prof, 40)), metal); hull.rotation.x = Math.PI / 2; g.add(hull);
  const cockpit = new THREE.Mesh(keep(new THREE.SphereGeometry(.42, 24, 16)), glass); cockpit.scale.set(1, .7, 1.7); cockpit.position.set(0, .42, .95); g.add(cockpit);
  const wing = new THREE.Mesh(keep(new THREE.BoxGeometry(3.8, .07, 1.1)), dark); wing.position.set(0, -.12, -.55); g.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(keep(new THREE.SphereGeometry(.09, 10, 8)), keep(new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff4d4d : 0x4dff9a })));
    tip.position.set(s * 1.9, -.12, -.55); g.add(tip);
    const eng = new THREE.Mesh(keep(new THREE.CylinderGeometry(.22, .3, .9, 20)), dark); eng.rotation.x = Math.PI / 2; eng.position.set(s * .55, -.12, -2.05); g.add(eng);
    const flame = new THREE.Mesh(keep(new THREE.ConeGeometry(.24, 2.2, 20, 1, true)), keep(new THREE.ShaderMaterial({ uniforms: flameU, vertexShader: VS, fragmentShader: FLAME_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide })));
    flame.rotation.x = -Math.PI / 2; flame.position.set(s * .55, -.12, -3.6); g.add(flame);
  }
  const fin = new THREE.Mesh(keep(new THREE.BoxGeometry(.06, .95, .85)), metal); fin.position.set(0, .62, -1.55); fin.rotation.x = -.35; g.add(fin);
  const light = new THREE.PointLight(0x8fbfff, 0, 40, 2); light.position.set(0, 0, -3.4); g.add(light);
  g.userData.light = light;
  return g;
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
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance', stencil: false }); }
  catch { return null; }
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.15;
  const maxDpr = preview ? 1 : (phone ? 1.6 : 2);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // ---------- HUD ----------
  let hudEl = null, infoEl = null, labelsEl = null, capEl = null, playBtn = null, speedBtns = [];
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
        <p class="solar-note">Ölçek sıkıştırılmıştır · Dokular: Solar System Scope (CC BY 4.0)</p>
      </div>
      <p class="solar-hint" aria-hidden="true">Gezegene dokun · Buraya uç ile temanı değiştir</p>`;
    labelsEl = document.createElement('div'); labelsEl.className = 'solar3d-labels';
    infoEl = document.createElement('aside'); infoEl.className = 'solar-info'; infoEl.setAttribute('aria-label', 'Gezegen bilgileri'); infoEl.hidden = true;
    capEl = document.createElement('div'); capEl.className = 'solar-cine-cap'; capEl.hidden = true;
    stage.append(labelsEl, hudEl, infoEl, capEl);
    playBtn = hudEl.querySelector('[data-solar-play]');
    speedBtns = [...hudEl.querySelectorAll('[data-solar-speed]')];
  }
  const flash = document.createElement('div'); flash.className = 'solar-flash';
  stage.append(flash);
  container.append(stage);

  // ---------- scene ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .3, 30000);
  scene.add(camera);
  const disposables = [];
  const keep = x => (disposables.push(x), x);
  let dead = false;
  const loader = new THREE.TextureLoader();
  const tex = (name, srgb = true) => {
    const t = keep(loader.load('textures/' + TEX[name], () => kick()));
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  // sky: real Milky Way panorama + twinkling foreground stars
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(9000, 48, 24)), keep(new THREE.ShaderMaterial({
    uniforms: { map: { value: tex('sky') } }, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false,
  })));
  scene.add(sky);
  const starU = { time: { value: 0 }, pr: { value: 1 }, tw: { value: 1 } };
  {
    const n = preview ? 900 : 2200, rng = makeRng(99), pos = new Float32Array(n * 3), size = new Float32Array(n), tint = new Float32Array(n * 3), ph = new Float32Array(n);
    const tints = [[1, 1, 1], [.75, .85, 1], [1, .92, .78], [1, .8, .7]];
    for (let i = 0; i < n; i++) {
      const u = rng() * 2 - 1, a = rng() * TAU, s = Math.sqrt(1 - u * u), R = 8000;
      pos.set([R * s * Math.cos(a), R * u, R * s * Math.sin(a)], i * 3);
      size[i] = rng() > .985 ? 3.4 + rng() * 2 : .9 + rng() * rng() * 2.2;
      tint.set(tints[(rng() * tints.length) | 0], i * 3); ph[i] = rng();
    }
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3)); g.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    scene.add(new THREE.Points(g, keep(new THREE.ShaderMaterial({ uniforms: starU, vertexShader: STAR_VS, fragmentShader: STAR_FS, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))));
  }
  scene.add(new THREE.PointLight(0xfff1dc, 3.2, 0, 0));
  scene.add(new THREE.AmbientLight(0x3a4252, .25));

  const timeU = { value: 0 };
  const segs = preview ? [48, 32] : (phone ? [96, 64] : [160, 112]);
  const sphereGeo = keep(new THREE.SphereGeometry(1, segs[0], segs[1]));

  // the Sun: animated real surface + ray corona + bloom
  const sun = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { map: { value: tex('sun') }, time: timeU }, vertexShader: VS, fragmentShader: SUN_FS })));
  sun.scale.setScalar(SUN_DEF.r); scene.add(sun);
  const corona = new THREE.Mesh(keep(new THREE.PlaneGeometry(2, 2)), keep(new THREE.ShaderMaterial({ uniforms: { time: timeU }, vertexShader: CORONA_VS, fragmentShader: CORONA_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  corona.scale.setScalar(SUN_DEF.r * 5.2); scene.add(corona);

  // planets
  const empty = keep(new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)); empty.needsUpdate = true;
  const ringTex = tex('saturnRing');
  const bodies = [{ def: SUN_DEF, id: 'sun', obj: sun, r: SUN_DEF.r, pos: new THREE.Vector3(), isSun: true }];
  const orbitLines = [];
  const mkPlanetMat = (id, extra = {}) => {
    const look = LOOK[id], a = look.atmo || [0, 0, 0];
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex(id) }, nightMap: { value: empty }, cloudMap: { value: empty }, ringTex: { value: ringTex },
        type: { value: look.type }, bump: { value: look.bump || 0 }, time: timeU,
        atmo: { value: new THREE.Vector3(...a) }, atmoStr: { value: look.atmoStr || 0 }, aura: { value: 0 }, auraCol: { value: new THREE.Color(1, 1, 1) },
        hasRing: { value: 0 }, ringN: { value: new THREE.Vector3(0, 1, 0) }, center: { value: new THREE.Vector3() }, ringIn: { value: 1 }, ringOut: { value: 2 },
        ...extra,
      },
      vertexShader: VS, fragmentShader: PLANET_FS,
    });
  };
  PLANET_DEFS.forEach(def => {
    const tiltG = new THREE.Group(), spinG = new THREE.Group();
    tiltG.rotation.z = def.tilt * DEG; tiltG.scale.setScalar(def.r);
    tiltG.add(spinG); scene.add(tiltG);
    const mat = keep(mkPlanetMat(def.id));
    const uni = mat.uniforms;
    spinG.add(new THREE.Mesh(sphereGeo, mat));
    if (def.id === 'earth') {
      const clouds = tex('earthClouds', false);
      uni.nightMap.value = tex('earthNight'); uni.cloudMap.value = clouds;
      const cm = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { cloudMap: { value: clouds }, time: timeU }, vertexShader: VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false })));
      cm.scale.setScalar(1.01); spinG.add(cm);
    }
    if (LOOK[def.id].atmo) {
      const shell = new THREE.Mesh(sphereGeo, keep(new THREE.ShaderMaterial({ uniforms: { atmo: uni.atmo, atmoStr: uni.atmoStr }, vertexShader: VS, fragmentShader: ATMO_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide })));
      shell.scale.setScalar(def.id === 'earth' ? 1.05 : 1.04); tiltG.add(shell);
    }
    if (def.ring) {
      const isU = def.ring.kind === 'uranus';
      const ring = new THREE.Mesh(keep(new THREE.RingGeometry(def.ring.inner, def.ring.outer, preview ? 128 : 256, 1)), keep(new THREE.ShaderMaterial({
        uniforms: { ringTex: { value: ringTex }, rIn: { value: def.ring.inner }, rOut: { value: def.ring.outer }, center: uni.center, R: { value: def.r }, ringN: uni.ringN, tint: { value: isU ? 1 : 0 } },
        vertexShader: RING_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false,
      })));
      ring.rotation.x = -Math.PI / 2; tiltG.add(ring);
      if (!isU) { uni.hasRing.value = 1; uni.ringIn.value = def.ring.inner * def.r; uni.ringOut.value = def.ring.outer * def.r; }
    }
    const pts = [], v = new THREE.Vector3();
    for (let k = 0; k <= 256; k++) pts.push(orbitPos(def, k / 256 * TAU, v).clone());
    const ol = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), keep(new THREE.LineBasicMaterial({ color: 0x9aa6bd, transparent: true, opacity: .14, depthWrite: false })));
    scene.add(ol); orbitLines.push(ol);
    const sats = new THREE.Group(); tiltG.add(sats);
    bodies.push({ def, id: def.id, obj: tiltG, spin: spinG, uni, sats, r: def.r, pos: new THREE.Vector3() });
  });
  const earth = bodies.find(b => b.id === 'earth');
  const moon = new THREE.Mesh(sphereGeo, keep(mkPlanetMat('moon')));
  moon.scale.setScalar(1.7); scene.add(moon);

  // asteroid belt: three irregular rock shapes, moon-textured, lit by the Sun
  const belt = new THREE.Group(); scene.add(belt);
  {
    const total = preview ? 360 : (phone ? 900 : 1700), rng = makeRng(4242);
    const rockMat = keep(new THREE.MeshStandardMaterial({ map: tex('moon'), color: 0xb0a596, roughness: .95, metalness: 0 }));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
    for (let k = 0; k < 3; k++) {
      const n = Math.round(total / 3), im = new THREE.InstancedMesh(keep(rockGeometry(11 + k)), rockMat, n);
      for (let i = 0; i < n; i++) {
        const u = (rng() + rng()) / 2, r = 133 + u * 22, ang = rng() * TAU;
        p.set(r * Math.cos(ang), (rng() - .5) * 7 * (1 - Math.abs(u - .5)), r * Math.sin(ang));
        e.set(rng() * TAU, rng() * TAU, rng() * TAU); q.setFromEuler(e);
        const sz = .22 + rng() * rng() * 1.2; s.set(sz, sz * (.6 + rng() * .5), sz * (.7 + rng() * .4));
        im.setMatrixAt(i, m.compose(p, q, s));
      }
      belt.add(im);
    }
  }

  // comet: glowing head + particle tail pointing away from the Sun
  const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128;
  { const g = glowCv.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const glowTex = keep(new THREE.CanvasTexture(glowCv));
  const comet = { active: false, t: 0, wait: 6, dur: 26, n: preview ? 0 : 260, pos: new THREE.Vector3() };
  if (comet.n) {
    comet.head = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTex, color: 0xcfe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    comet.head.scale.setScalar(8); scene.add(comet.head);
    const g = keep(new THREE.BufferGeometry()), pos = new Float32Array(comet.n * 3), fade = new Float32Array(comet.n), rng = makeRng(77);
    comet.off = new Float32Array(comet.n * 4);
    for (let i = 0; i < comet.n; i++) { const f = rng(); fade[i] = 1 - f; comet.off.set([f, rng() - .5, rng() - .5, rng()], i * 4); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('fade', new THREE.BufferAttribute(fade, 1));
    comet.tail = new THREE.Points(g, keep(new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(.6, .8, 1) }, pr: starU.pr }, vertexShader: TAIL_VS, fragmentShader: TAIL_FS, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
    comet.tail.visible = false; comet.tail.frustumCulled = false; scene.add(comet.tail);
  }

  // the ship (only on the full page) + warp streaks parented to the camera
  const flameU = { time: timeU, power: { value: 0 } };
  const ship = preview ? null : makeShip(keep, flameU);
  if (ship) { ship.visible = false; scene.add(ship); }
  let warp = null;
  if (!preview) {
    const n = 420, pos = new Float32Array(n * 6), rng = makeRng(5);
    for (let i = 0; i < n; i++) {
      const a = rng() * TAU, r = 6 + rng() * 60, z = -40 - rng() * 600;
      pos.set([Math.cos(a) * r, Math.sin(a) * r, z, Math.cos(a) * r, Math.sin(a) * r, z - 30], i * 6);
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    warp = new THREE.LineSegments(g, keep(new THREE.LineBasicMaterial({ color: 0xa8c8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
    warp.frustumCulled = false; camera.add(warp);
  }

  // post-processing: multisampled HDR target (smooth edges) -> bloom -> AgX tone mapping
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: preview ? 0 : 4 });
  const composer = new THREE.EffectComposer(renderer, rt);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), preview ? .55 : .62, .5, 1.35);
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());

  // ---------- planet themes (js/planets.js) ----------
  let themes = null;
  import('./planets.js').then(m => { themes = m; applyCourses(); }).catch(() => { });
  const homeId = () => themes?.currentPlanet?.() || 'earth';
  const onPlanet = () => { applyCourses(); };

  // ---------- labels ----------
  const labels = [];
  if (labelsEl) bodies.forEach((b, i) => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'solar3d-label'; el.dataset.idx = i; el.style.visibility = 'hidden';
    labelsEl.append(el); labels.push(el);
  });

  // ---------- Derslerim ----------
  let coursesMode = false, courseMap = buildCourseMap(), focusIdx = -1;
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
    const home = homeId();
    labels.forEach((el, i) => {
      const b = bodies[i], ci = coursesMode && !b.isSun ? courseMap[i - 1] : null;
      el.innerHTML = (b.id === home ? '<b class="home" aria-hidden="true">✦</b>' : '') + (ci ? `<i style="color:${esc(ci.course.color || '#fff')}">${esc(ci.course.icon || '•')}</i>${esc(ci.course.name)}` : esc(b.def.name));
      el.classList.toggle('course', !!ci); el.classList.toggle('home', b.id === home);
      el.setAttribute('aria-label', `${ci ? ci.course.name + ' · ' : ''}${b.def.name}${b.id === home ? ' (şu anki tema)' : ''} — bilgileri göster`);
    });
    if (focusIdx >= 0) renderInfo();
  }

  // ---------- camera ----------
  const DEF = { yaw: preview ? .35 : .42, pitch: preview ? .42 : .46, dist: preview ? 560 : 640 };
  const cam = { yaw: DEF.yaw, pitch: DEF.pitch, dist: DEF.dist, target: new THREE.Vector3() };
  let vYaw = 0, vPitch = 0, fly = null, cine = null;
  const shift = { x: 0, y: 0, gx: 0, gy: 0 };
  let W = 1, H = 1;
  const freeArea = () => {
    if (preview || !infoEl) return { w: W, h: H, cx: W / 2, cy: H / 2 };
    if (W <= 820) { const sheet = Math.min(H * .47, 360) + 74, top = 72, h = Math.max(120, H - sheet - top); return { w: W, h, cx: W / 2, cy: top + h / 2 }; }
    const w = W - 364; return { w, h: H - 80, cx: w / 2, cy: H / 2 + 20 };
  };
  const focusDist = b => {
    const rEff = b.def.ring ? b.r * b.def.ring.outer : b.r, a = freeArea(), px = Math.min(a.w, a.h) * .36;
    return Math.max(rEff * 1.8, rEff * (H / 2) / (px * Math.tan(camera.fov * DEG / 2)));
  };
  const sunSideYaw = b => Math.atan2(-b.pos.x, -b.pos.z) + .55; // look from the lit side, ~32° off the Sun line
  function placeCamera() {
    const cp = Math.cos(cam.pitch);
    camera.position.set(cam.target.x + cam.dist * cp * Math.sin(cam.yaw), cam.target.y + cam.dist * Math.sin(cam.pitch), cam.target.z + cam.dist * cp * Math.cos(cam.yaw));
    camera.lookAt(cam.target);
  }
  function flyTo(idx) {
    focusIdx = idx;
    const b = bodies[idx];
    const to = { dist: focusDist(b), pitch: b.id === 'saturn' ? .42 : Math.min(Math.max(cam.pitch, .12), .5), yaw: cam.yaw };
    if (!b.isSun) { let d = sunSideYaw(b) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); to.yaw = cam.yaw + d; }
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

  // ---------- info panel ----------
  function renderInfo() {
    if (!infoEl) return;
    if (focusIdx < 0 || cine) { infoEl.classList.remove('open'); infoEl.hidden = true; shift.gx = shift.gy = 0; return; }
    const b = bodies[focusIdx], def = b.def, ci = coursesMode && !b.isSun ? courseMap[focusIdx - 1] : null;
    const pct = ci && ci.total ? Math.round(ci.ratio * 100) : 0;
    const courseBlock = coursesMode && !b.isSun ? (ci ? `
      <div class="solar-course-box" style="--cc:${esc(ci.course.color || '#f4f4f5')}">
        <div class="solar-course-top"><i class="cglyph" style="--cc:${esc(ci.course.color || '#f4f4f5')}" aria-hidden="true">${esc(ci.course.icon || '•')}</i>
          <div class="solar-course-meta"><strong>${esc(ci.course.name)}</strong><span class="mono small">${ci.solved}/${ci.total} çözüldü · %${pct}${ci.review ? ` · ${ci.review} tekrar` : ''}</span></div></div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <a class="btn primary small wide solar-open-course" href="#/c/${esc(ci.course.id)}">Dersi aç →</a>
      </div>` : `<p class="solar-no-course small">Bu gezegene atanmış ders yok.</p>`) : '';
    const theme = themes?.PLANET_THEMES?.find(t => t.id === b.id);
    const travel = theme ? (homeId() === b.id
      ? `<p class="solar-home-note">✦ Şu an <b>${esc(theme.name)}</b> temasındasın${theme.tagline ? ` · ${esc(theme.tagline)}` : ''}</p>`
      : `<button type="button" class="btn primary wide solar-travel" data-solar-travel>🚀 Buraya uç · ${esc(theme.name)} teması</button>`) : '';
    infoEl.innerHTML = `
      <div class="solar-info-head">
        <button type="button" class="solar-back" data-solar-back aria-label="Tüm sisteme dön">${ICONS.back}<span>Tüm sistem</span></button>
        <button type="button" class="solar-x" data-solar-back aria-label="Bilgi panelini kapat">${ICONS.x}</button>
      </div>
      <div class="solar-info-title"><span class="solar-swatch" style="--pc:${esc(ci ? (ci.course.color || def.color) : def.color)}" aria-hidden="true"></span>
        <div><h2>${esc(ci ? ci.course.name : def.name)}</h2><p class="solar-info-sub">${ci ? `${esc(def.name)} · ` : ''}${esc(def.subtitle)}</p></div></div>
      ${travel}
      ${courseBlock}
      <dl class="solar-facts">${def.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="mono">${esc(v)}</dd></div>`).join('')}</dl>
      <div class="solar-fun"><span class="solar-fun-lbl">Biliyor muydun?</span><p>${esc(def.funFact)}</p></div>
      <div class="solar-info-nav">
        <button type="button" class="solar-nav-btn" data-solar-step="-1" aria-label="Önceki gök cismi">${ICONS.back} Önceki</button>
        <button type="button" class="solar-nav-btn" data-solar-step="1" aria-label="Sonraki gök cismi">Sonraki ${ICONS.next}</button>
      </div>`;
    infoEl.hidden = false;
    measureFraming();
    requestAnimationFrame(() => { if (!dead && focusIdx >= 0 && !cine) infoEl.classList.add('open'); });
  }
  function measureFraming() {
    if (!infoEl || focusIdx < 0 || cine) { shift.gx = shift.gy = 0; return; }
    const a = freeArea(); shift.gx = a.cx - W / 2; shift.gy = a.cy - H / 2;
    if (motionMode() !== 'full') { shift.x = shift.gx; shift.y = shift.gy; }
    kick();
  }

  // ---------- the travel cinematic: launch -> warp -> arrival flash -> theme switch ----------
  const bodyPos = (b, out) => b.isSun ? out.set(0, 0, 0) : out.copy(b.pos);
  function travelTo(idx) {
    const to = bodies[idx], fromIdx = Math.max(0, bodies.findIndex(b => b.id === homeId()));
    if (!themes?.setPlanetTheme) return;
    if (motionMode() !== 'full' || !ship) { themes.setPlanetTheme(to.id, { animate: motionMode() !== 'off' }); flyTo(idx); return; }
    const from = bodies[fromIdx], A = bodyPos(from, new THREE.Vector3()), B = bodyPos(to, new THREE.Vector3());
    const dir = B.clone().sub(A).normalize(), up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3().crossVectors(dir, up).normalize();
    const S = A.clone().addScaledVector(dir, from.r * 1.5).addScaledVector(up, from.r * .4);
    const E = B.clone().addScaledVector(dir, -to.r * (to.def.ring ? 3.4 : 2.6)).addScaledVector(up, to.r * .3);
    const span = A.distanceTo(B);
    const mid = S.clone().lerp(E, .5).addScaledVector(up, span * .22).addScaledVector(side, span * .12);
    // final camera pose: the destination planet seen from its lit side
    const yawT = to.isSun ? cam.yaw : sunSideYaw(to), pitchT = to.id === 'saturn' ? .42 : .28, distT = focusDist(to);
    cine = {
      t: 0, dur: 6.4, to: idx, curve: new THREE.QuadraticBezierCurve3(S, mid, E), themed: false,
      startCam: camera.position.clone(), startLook: cam.target.clone(), B, yawT, pitchT, distT,
      endCam: new THREE.Vector3(B.x + distT * Math.cos(pitchT) * Math.sin(yawT), B.y + distT * Math.sin(pitchT), B.z + distT * Math.cos(pitchT) * Math.cos(yawT)),
      chase: new THREE.Vector3(), look: new THREE.Vector3(), name: to.def.name, fromName: from.def.name,
    };
    focusIdx = -1; fly = null; vYaw = vPitch = 0;
    ship.visible = true; ship.position.copy(S); ship.lookAt(E);
    stage.classList.add('cine');
    renderInfo();
    capEl.hidden = false;
    capEl.innerHTML = `<span class="solar-cine-route">${esc(from.def.name)} <i>→</i> ${esc(to.def.name)}</span><span class="solar-cine-bar"><i></i></span><button type="button" class="solar-cine-skip" data-solar-skip>Atla</button>`;
    kick();
  }
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const tA = new THREE.Vector3(), tB = new THREE.Vector3(), fwd = new THREE.Vector3();
  function runCine(dt) {
    const c = cine; c.t += dt;
    const T = c.t, u = sstep(.9, 4.9, T);                       // progress along the route
    c.curve.getPoint(u, tA); c.curve.getPoint(Math.min(1, u + .02), tB);
    ship.position.copy(tA); if (tA.distanceToSquared(tB) > 1e-6) ship.lookAt(tB);
    fwd.subVectors(tB, tA).normalize(); if (!fwd.lengthSq()) fwd.set(0, 0, 1);
    const thrust = sstep(.2, 1, T) * (1 - sstep(4.7, 5.6, T) * .85);
    flameU.power.value = thrust * (1 + .6 * Math.sin(T * 40) * .1); ship.userData.light.intensity = thrust * 6;
    const w = sstep(1.3, 2.4, T) * (1 - sstep(3.9, 4.8, T));     // warp amount
    warp.material.opacity = w * .85; bloom.strength = .62 + w * .6;
    const arr = warp.geometry.attributes.position.array;
    for (let i = 0; i < arr.length; i += 6) { arr[i + 2] += dt * 900 * w; arr[i + 5] = arr[i + 2] - 30 - w * 90; if (arr[i + 2] > -10) { arr[i + 2] -= 600; arr[i + 5] = arr[i + 2] - 30; } }
    warp.geometry.attributes.position.needsUpdate = true;
    camera.fov = 42 + w * 30; camera.updateProjectionMatrix();
    // camera: ease from the current view into a chase cam, then out to the destination framing
    c.chase.copy(tA).addScaledVector(fwd, -13).add(tB.set(0, 2.6, 0));   // just behind and above: ship sits in the lower-middle
    c.look.copy(tA).addScaledVector(fwd, 30).add(tB.set(0, 3.2, 0));
    const into = sstep(0, 1.1, T), out = sstep(4.6, 6.2, T);
    camera.position.lerpVectors(c.startCam, c.chase, into).lerp(c.endCam, out);
    tB.lerpVectors(c.startLook, c.look, into).lerp(c.B, out);
    camera.lookAt(tB);
    if (capEl) capEl.querySelector('.solar-cine-bar i').style.transform = `scaleX(${Math.min(1, T / c.dur).toFixed(3)})`;
    if (!c.themed && T > 5.0) { // arrival: flash + theme switch
      c.themed = true;
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      themes.setPlanetTheme(bodies[c.to].id, { animate: true });
    }
    if (T >= c.dur) endCine();
  }
  function endCine() {
    const c = cine; if (!c) return;
    if (!c.themed) themes.setPlanetTheme(bodies[c.to].id, { animate: true });
    cine = null;
    ship.visible = false; flameU.power.value = 0; ship.userData.light.intensity = 0;
    warp.material.opacity = 0; bloom.strength = .62; camera.fov = 42; camera.updateProjectionMatrix();
    stage.classList.remove('cine'); capEl.hidden = true;
    cam.target.copy(c.B); cam.dist = c.distT; cam.yaw = c.yawT; cam.pitch = c.pitchT;
    focusIdx = c.to; applyCourses(); renderInfo(); kick();
  }

  // ---------- sizing ----------
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
  let simT = 0, speed = 1, paused = false, last = performance.now(), raf = 0, visible = true, lastDraw = 0, rawDt = 0, drag = false;
  const up = new THREE.Vector3(), tmp = new THREE.Vector3();
  function update(dt) {
    const mm = motionMode();
    const rate = paused || cine ? 0 : speed * (mm === 'full' ? 1 : mm === 'reduced' ? .2 : 0);
    simT += dt * rate;
    timeU.value += dt * (mm === 'full' ? 1 : 0);
    starU.time.value = timeU.value; starU.tw.value = mm === 'full' ? 1 : 0;
    sun.rotation.y = simT * .02;
    for (const b of bodies) {
      if (b.isSun) continue;
      orbitPos(b.def, (b.def.a0 || 0) + b.def.omega * simT, b.pos);
      b.obj.position.copy(b.pos);
      b.spin.rotation.y = simT * b.def.spin * 1.6;
      b.uni.center.value.copy(b.pos);
      up.set(0, 1, 0).applyQuaternion(b.obj.quaternion); b.uni.ringN.value.copy(up);
      b.sats.children.forEach((s, k) => { const d = s.userData, a = d.a + simT * (1.4 + k * .07); s.position.set(Math.cos(a) * d.rr, Math.sin(a + d.inc) * .35, Math.sin(a) * d.rr); });
    }
    const ma = simT * 1.9 + .7;
    moon.position.set(earth.pos.x + Math.cos(ma) * 13, earth.pos.y + Math.sin(ma) * 1.6, earth.pos.z + Math.sin(ma) * 13);
    moon.rotation.y = -ma;
    belt.rotation.y = simT * .02;
    corona.quaternion.copy(camera.quaternion);
    if (comet.n) updateComet(dt, mm);
    if (cine) { runCine(dt); return; }
    if (fly) {
      const k = Math.min(1, (performance.now() - fly.t0) / 1200), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const dest = fly.home || bodies[focusIdx].isSun ? tmp.set(0, 0, 0) : bodies[focusIdx].pos;
      cam.target.lerpVectors(fly.from.target, dest, e);
      cam.dist = fly.from.dist + (fly.to.dist - fly.from.dist) * e;
      cam.pitch = fly.from.pitch + (fly.to.pitch - fly.from.pitch) * e;
      if (fly.to.yaw != null && fly.from.yaw != null) cam.yaw = fly.from.yaw + (fly.to.yaw - fly.from.yaw) * e;
      if (k >= 1) fly = null;
    } else if (focusIdx > 0) cam.target.copy(bodies[focusIdx].pos);
    if (!drag && mm === 'full' && (Math.abs(vYaw) > 1e-5 || Math.abs(vPitch) > 1e-5)) {
      cam.yaw += vYaw; cam.pitch = Math.min(1.45, Math.max(-1.2, cam.pitch + vPitch)); vYaw *= .92; vPitch *= .92;
    }
    if (preview && mm === 'full') cam.yaw += dt * .03;
    const sk = mm === 'full' ? 1 - Math.exp(-rawDt * 7) : 1;
    shift.x += (shift.gx - shift.x) * sk; shift.y += (shift.gy - shift.y) * sk;
    if (Math.abs(shift.x) > .5 || Math.abs(shift.y) > .5) camera.setViewOffset(W, H, -shift.x, -shift.y, W, H);
    else camera.clearViewOffset();
    placeCamera();
    orbitLines.forEach((l, i) => { l.material.opacity = focusIdx === i + 1 ? .45 : .14; });
  }
  function updateComet(dt, mm) {
    if (!comet.active) {
      comet.wait -= dt;
      if (comet.wait < 0 && mm === 'full') { comet.active = true; comet.t = 0; comet.tail.visible = true; }
      return;
    }
    comet.t += dt * Math.max(1, speed * .5);
    const k = comet.t / comet.dur;
    if (k >= 1) { comet.active = false; comet.wait = 25 + Math.random() * 20; comet.tail.visible = false; comet.head.material.opacity = 0; return; }
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
    comet.tail.material.uniforms.col.value.setRGB(.6 * fadeIn, .8 * fadeIn, fadeIn);
  }
  const proj = new THREE.Vector3(), sp = { x: 0, y: 0, z: 0, r: 0 };
  function screenOf(b, out) {
    bodyPos(b, proj); const d = camera.position.distanceTo(proj);
    proj.project(camera);
    out.x = (proj.x * .5 + .5) * W; out.y = (-proj.y * .5 + .5) * H; out.z = proj.z;
    out.r = b.r / (d * Math.tan(camera.fov * DEG / 2)) * H / 2;
    return out;
  }
  function placeLabels() {
    labels.forEach((el, i) => {
      screenOf(bodies[i], sp);
      const show = !cine && sp.z < 1 && sp.x > -60 && sp.x < W + 60 && sp.y > -40 && sp.y < H + 40 && (i === focusIdx || sp.r < H * .22);
      el.style.visibility = show ? '' : 'hidden';
      if (show) el.style.transform = `translate(${sp.x.toFixed(1)}px, ${(sp.y + Math.max(sp.r, 4) + 8).toFixed(1)}px) translateX(-50%)`;
      el.classList.toggle('on', i === focusIdx);
    });
  }
  function frame(now) {
    raf = 0;
    if (dead) return;
    rawDt = Math.min(1, (now - last) / 1000); const dt = Math.min(.05, rawDt); last = now;
    if (preview && now - lastDraw < 33) { schedule(); return; }
    lastDraw = now;
    update(dt);
    composer.render(dt);
    placeLabels();
    if (motionMode() !== 'off' || fly || drag || cine || Math.abs(vYaw) > 1e-5) schedule();
  }
  function schedule() { if (!raf && !dead && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function kick() { last = performance.now(); schedule(); }

  // ---------- input ----------
  const ptrs = new Map();
  let downAt = null, pinch0 = 0, dist0 = 0, lastTap = 0;
  const clampDist = d => Math.min(2400, Math.max(focusIdx >= 0 ? bodies[focusIdx].r * 2.4 : 90, d));
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
    if (cine) return;
    cv.setPointerCapture?.(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]); dist0 = cam.dist; }
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    drag = true; vYaw = vPitch = 0; kick();
  };
  const onMove = e => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; cam.dist = clampDist(dist0 * pinch0 / Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))); fly = null; kick(); return; }
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
      if (i >= 0) flyTo(i); else if (now - lastTap < 320) resetView();
      lastTap = now; vYaw = vPitch = 0;
    }
    kick();
  };
  const onWheel = e => { if (cine) return; e.preventDefault(); cam.dist = clampDist(cam.dist * Math.exp(e.deltaY * .0012)); fly = null; kick(); };
  const onHud = e => {
    const b = e.target.closest('button'); if (!b || cine) return;
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
    else if ('solarTravel' in b.dataset) travelTo(focusIdx);
    else if (b.dataset.solarStep) flyTo((focusIdx + +b.dataset.solarStep + bodies.length) % bodies.length);
  };
  const onCap = e => { if (e.target.closest('[data-solar-skip]')) endCine(); };
  const onLabel = e => { const b = e.target.closest('.solar3d-label'); if (b && !cine) flyTo(+b.dataset.idx); };
  const onKey = e => {
    if (e.target.closest?.('input, textarea, select')) return;
    if (cine) { if (e.key === 'Escape') endCine(); return; }
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
    capEl.addEventListener('click', onCap);
    labelsEl.addEventListener('click', onLabel);
    addEventListener('keydown', onKey);
  }
  document.addEventListener('visibilitychange', onVis);
  addEventListener('mp-theme', kick);
  addEventListener('mp-planet', onPlanet);
  cv.addEventListener('webglcontextlost', onLost);
  const ro = new ResizeObserver(resize); ro.observe(stage);
  const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; if (visible) kick(); });
  io.observe(stage);

  applyCourses();
  resize();
  update(0);
  kick();

  return () => {
    if (cine && themes) endCine();
    dead = true; cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('mp-theme', kick);
    removeEventListener('mp-planet', onPlanet);
    removeEventListener('keydown', onKey);
    cv.removeEventListener('webglcontextlost', onLost);
    disposables.forEach(d => d.dispose?.());
    rt.dispose(); bloom.dispose(); composer.dispose?.();
    renderer.dispose(); renderer.forceContextLoss();
    stage.remove();
  };
}
