// MathPad Kara Delik Gözlemevi — WebGL 2 (GLSL ES 3.00) & WebGL 1 (GLSL ES 1.00) Shader Kaynakları
// Saf ES modülü: DOM veya tarayıcı API bağımlılığı yoktur; node testlerinde doğrudan içe aktarılır.
//
// Fizik özeti (geometrik birimler G = c = M = 1, r_s = 2):
// - Sıfır jeodezik (ışık ışını) denklemi: d²x/dλ² = -3 h² x / r⁵, burada h = |x × v| korunan özgül açısal momentumdur.
//   (r_s = 1 biriminde -(3/2) h² x / r⁵ olan denklem, M = 1 ve r_s = 2 biriminde -3 h² x / r⁵ biçimindedir.)
// - Sonlu kamera uzaklığı r0 için yerel statik ortonormal tetrad başlatması:
//   v0 = (d·r̂) r̂ + d_⊥ / √(1 - 2/r0) -> h = b = r0 sin(α) / √(1 - 2/r0) ve sonsuzda |v| → 1.
//   Bu sayede görünen gölge yarıçapı her r0 > 3M için tam GR açısı sin(α_sh) = (3√3 / r0) √(1 - 2/r0) ile örtüşür.
// - İnce yığılma diski: ekvator düzlemi (y = 0) geçişleriyle tespit edilir; Shakura-Sunyaev sıcaklık profili,
//   Kepler dönmeli prosedürel türbülans, kara cisim rengi blackbodyToRGB(g · T_emit) ve bolometrik g⁴ ışınlaması.

/** Ray-tracing ve sunum geçişlerinin beklediği tüm uniform adları. */
export const SHADER_UNIFORMS = Object.freeze({
  raytrace: Object.freeze([
    'uResolution',
    'uCamPos',
    'uCamRight',
    'uCamUp',
    'uCamFwd',
    'uTanHalfFov',
    'uAspect',
    'uSpin',
    'uDiskInner',
    'uDiskOuter',
    'uTempScale',
    'uDiskBrightness',
    'uTime',
    'uShowDisk',
    'uUseDoppler',
    'uUseGravRedshift',
    'uUseLensing',
    'uMaxSteps',
    'uStepScale',
    'uShipBeta',
    'uSkyGravBlue',
    'uSkyTex',
    'uHasSkyTex',
  ]),
  present: Object.freeze([
    'uFrameTex',
  ]),
});

// Ortak GLSL gövdesi (hem ES 3.00 hem ES 1.00 için sürüm uyumlu yardımcı makro/fonksiyonlarla kurulur).
const SHARED_PHYSICS_GLSL = /* glsl */`
const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;
const float INV_PI = 0.31830988618;
const float INV_TWO_PI = 0.15915494309;
const float B_CRIT = 5.19615242271; // 3 * sqrt(3)

// js/bh-core.js içindeki blackbodyToRGB(tempK) fonksiyonunun birebir GLSL karşılığı
vec3 blackbodyToRGB(float tempK) {
  if (tempK <= 0.0) return vec3(0.0);
  float T = clamp(tempK, 1000.0, 40000.0);
  float t = T * 0.01;
  float r, g, b;
  if (t <= 66.0) {
    r = 1.0;
    g = clamp((99.4708025861 * log(max(t, 1.0)) - 161.1195681661) / 255.0, 0.0, 1.0);
    b = (t <= 19.0) ? 0.0 : clamp((138.5177312231 * log(max(t - 10.0, 1.0)) - 305.0447927307) / 255.0, 0.0, 1.0);
  } else {
    float tm = max(t - 60.0, 0.01);
    r = clamp((329.698727446 * pow(tm, -0.1332047592)) / 255.0, 0.0, 1.0);
    g = clamp((288.1221695283 * pow(tm, -0.0755148492)) / 255.0, 0.0, 1.0);
    b = 1.0;
  }
  if (tempK < 1000.0) {
    float fade = clamp(tempK / 1000.0, 0.0, 1.0);
    float sc = fade * fade;
    return vec3(r, g, b) * sc;
  }
  return vec3(r, g, b);
}

// Hızlı ve dikişsiz 3B değer gürültüsü (yığılma diski türbülansı ve yedek yıldız alanı için)
float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float x00 = mix(n000, n100, u.x);
  float x10 = mix(n010, n110, u.x);
  float x01 = mix(n001, n101, u.x);
  float x11 = mix(n011, n111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

float fbm3(vec3 p) {
  float s = 0.0;
  float a = 0.52;
  for (int i = 0; i < 3; i++) {
    s += a * vnoise3(p);
    p = p * 2.07 + vec3(1.7, 9.2, 3.1);
    a *= 0.48;
  }
  return s;
}

vec3 safePow3(vec3 v, float p) {
  return pow(max(v, vec3(1e-7)), vec3(p)) * step(vec3(1e-7), v);
}

// Doku yüklenmeden önce veya eksikse keskin prosedürel Samanyolu + yıldız alanı
vec3 proceduralSky(vec3 dir) {
  vec3 d = normalize(dir);
  // Galaktik düzlem bandı (hafif eğik)
  vec3 gNorm = normalize(vec3(0.18, 0.88, -0.44));
  float lat = dot(d, gNorm);
  float band = exp(-lat * lat * 18.0);
  float dust = fbm3(d * 5.2 + vec3(2.1, -1.4, 0.7));
  float coreDot = max(dot(d, normalize(vec3(0.98, -0.06, 0.14))), 0.0);
  float core2 = coreDot * coreDot;
  float core = core2 * core2 * core2;
  vec3 milky = mix(vec3(0.03, 0.045, 0.085), vec3(0.24, 0.21, 0.28), dust) * band * (0.65 + 1.4 * core);
  milky += vec3(0.008, 0.011, 0.022);

  // Keskin çok katmanlı yıldız noktaları
  vec3 stars = vec3(0.0);
  vec3 cell1 = floor(d * 130.0);
  float h1 = hash31(cell1);
  if (h1 > 0.992) {
    vec3 center1 = normalize(cell1 + 0.5);
    float dist1 = length(d - center1) * 130.0;
    float br1 = exp(-dist1 * dist1 * 14.0) * smoothstep(0.992, 0.9995, h1);
    vec3 tint1 = blackbodyToRGB(mix(3400.0, 18000.0, fract(h1 * 173.1)));
    stars += tint1 * br1 * 2.8;
  }
  vec3 cell2 = floor(d * 240.0);
  float h2 = hash31(cell2 + 19.3);
  if (h2 > 0.995) {
    vec3 center2 = normalize(cell2 + 0.5);
    float dist2 = length(d - center2) * 240.0;
    float br2 = exp(-dist2 * dist2 * 18.0) * smoothstep(0.995, 0.9998, h2);
    stars += vec3(0.85, 0.91, 1.0) * br2 * 1.4;
  }
  return milky + stars;
}

// 3B Schwarzschild sıfır jeodezik ivmesi (M = 1, r_s = 2): a = -3 h² x / r⁵
vec3 geodesicAccel(vec3 p, float h2) {
  float r2 = max(dot(p, p), 0.25);
  float r = sqrt(r2);
  float r5 = r2 * r2 * r;
  return (-3.0 * h2 / r5) * p;
}

// Ekvatoral ince yığılma diski (y = 0) yayımı ve göreli renk/parlaklık kayması
vec4 shadeDisk(vec3 hitPos, float rHit, float rInEff, float bz, float obsShift, float crossings) {
  float x = clamp(rInEff / max(rHit, rInEff), 0.0, 1.0);
  // Shakura-Sunyaev normalize profili (r_peak = 49/36 r_in noktasında 1.0; 7^(7/4)/6^(3/2) ≈ 2.04972073)
  float sx = sqrt(x);
  float ss = (sx * sqrt(sx)) * sqrt(sqrt(max(1.0 - sx, 0.0))) * 2.04972073;
  float innerFade = smoothstep(rInEff, rInEff * 1.055, rHit);
  float outerFade = smoothstep(uDiskOuter, uDiskOuter * 0.70, rHit);

  // Kepler (Kerr yaklaşık) açısal hızı ve dikişsiz sarmal türbülans
  float r32 = rHit * sqrt(rHit);
  float omega = 1.0 / max(r32 + uSpin, 0.5);
  float phi = (abs(hitPos.x) + abs(hitPos.z) > 1e-6) ? atan(hitPos.z, hitPos.x) : 0.0;
  // +y ekseninden bakıldığında saat yönünün tersine dönüş: phi(t) = phi0 - omega * t -> phi_mat = phi + omega * t
  float phiMat = phi + omega * uTime * 9.0;
  float logR = log(max(rHit, 1.0));
  float sp1 = phiMat + logR * 5.2;
  float sp2 = phiMat * 2.0 + logR * 9.0;
  float n1 = fbm3(vec3(cos(sp1) * 2.1, sin(sp1) * 2.1, logR * 4.4));
  float n2 = vnoise3(vec3(cos(sp2) * 3.8, sin(sp2) * 3.8, logR * 7.8 + 4.1));
  // İnce dairesel akış şeritleri + türbülanslı plazma düğümleri
  float rings = 0.84 + 0.16 * sin(logR * 26.0 + n1 * 4.5);
  float turb = clamp((0.52 + 0.62 * n1 + 0.24 * n2) * rings, 0.28, 1.55);

  // Birleşik kütleçekimsel kırmızıya kayma + Doppler ışınlaması g = 1 / (1 + z)
  float gGrav = sqrt(max(1.0 - 2.0 / rHit, 0.025));
  float denomUt2 = max(rHit * rHit * rHit - 3.0 * rHit * rHit + 2.0 * uSpin * r32, 0.06 * rHit * rHit);
  float ut = (r32 + uSpin) / sqrt(denomUt2);
  float oneMinusOmegaB = clamp(1.0 - omega * bz, 0.22, 4.5);
  float gFull = 1.0 / (ut * oneMinusOmegaB);
  float gDoppler = clamp(gFull / max(gGrav, 0.05), 0.25, 3.2);

  float g = 1.0;
  if (uUseGravRedshift > 0.5) g *= gGrav;
  if (uUseDoppler > 0.5) g *= gDoppler;
  g *= obsShift;
  g = clamp(g, 0.14, 3.6);

  // Gözlenen sıcaklık T_obs = g * T_emit ve bolometrik g⁴ parlaklık ölçeği (I_obs ∝ (g * T_emit)⁴)
  float tEmit = 5800.0 * uTempScale * ss * (0.86 + 0.24 * turb);
  float tObs = g * tEmit;
  vec3 bb = blackbodyToRGB(tObs);

  float ssg = ss * g;
  float ssg2 = ssg * ssg;
  float bolom = ssg2 * ssg2; // tam (ss * g)^4
  // İkincil merceklenmiş geçişler (foton halkası) gerçekte daha optik olarak ince bir yayım katkısı ekler
  float orderBoost = (crossings > 0.5) ? 1.18 : 1.0;
  float intensity = bolom * turb * innerFade * outerFade * uDiskBrightness * orderBoost * 1.65;
  float alpha = clamp((0.36 + 0.54 * ss * turb) * innerFade * outerFade, 0.0, 0.92);
  return vec4(bb * intensity, alpha);
}

// ACES filmik ton eşleme (yüksek dinamik aralıklı g⁴ Doppler parlamasını doğal korur)
vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 traceBlackHole(vec2 fragCoord) {
  vec2 uv = fragCoord / max(uResolution, vec2(1.0));
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 dShip = normalize(
    uCamFwd +
    ndc.x * uAspect * uTanHalfFov * uCamRight +
    ndc.y * uTanHalfFov * uCamUp
  );

  // Gemi hareketi varsa yerel çerçevede tam özel görelilik sapması (aberration) + Doppler
  float beta2 = dot(uShipBeta, uShipBeta);
  float invGamma = sqrt(max(1.0 - beta2, 1e-4));
  float bd = dot(dShip, uShipBeta);
  float lDenom = max(1.0 - bd, 1e-4);
  vec3 dLoc = normalize((dShip * invGamma + uShipBeta * (bd / (1.0 + invGamma) - 1.0)) / lDenom);
  float skyDoppler = invGamma / lDenom;

  vec3 pos = uCamPos;
  float r0 = length(pos);
  vec3 rHat0 = pos / max(r0, 1e-5);
  float f0 = max(1.0 - 2.0 / max(r0, 2.01), 1e-4);
  float invSqrtF0 = inversesqrt(f0);
  float obsShift = (uSkyGravBlue > 0.5) ? clamp(skyDoppler * invSqrtF0, 0.35, 3.2) : 1.0;
  float rInEff = max(uDiskInner, 2.04);

  vec3 accColor = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  vec3 escapeDir = dLoc;

  if (uUseLensing < 0.5) {
    // Düz Minkowski uzayı karşılaştırması (analitik ışın-küre ve ışın-düzlem kesişimi)
    float bzFlat = -cross(pos, dLoc).y;
    float bS = dot(pos, dLoc);
    float cS = dot(pos, pos) - 4.0;
    float disc = bS * bS - cS;
    float tBh = 1e9;
    if (disc >= 0.0) {
      float tHit = -bS - sqrt(max(disc, 0.0));
      if (tHit > 0.0) tBh = tHit;
    }
    if (uShowDisk > 0.5 && abs(dLoc.y) > 1e-5) {
      float tDisk = -pos.y / dLoc.y;
      if (tDisk > 0.0 && tDisk < tBh) {
        vec3 hitPos = pos + dLoc * tDisk;
        float rHit = length(hitPos);
        if (rHit >= rInEff && rHit <= uDiskOuter) {
          vec4 dCol = shadeDisk(hitPos, rHit, rInEff, bzFlat, 1.0, 0.0);
          accColor += transmittance * dCol.rgb;
          transmittance *= (1.0 - dCol.a);
        }
      }
    }
    if (tBh < 1e8) {
      captured = true;
    }
    escapeDir = dLoc;
  } else {
    // Tam Schwarzschild sıfır jeodezik RK4 izleyici (M = 1)
    float dRad = dot(dLoc, rHat0);
    vec3 dPerp = dLoc - dRad * rHat0;
    vec3 vel = dRad * rHat0 + dPerp * invSqrtF0;
    vec3 hVec = cross(pos, vel);
    float h2 = dot(hVec, hVec);
    float bz = -hVec.y;
    float rFar = max(145.0, r0 * 2.3 + 45.0);
    float outerSpeedupR = max(uDiskOuter + 8.0, 28.0);
    float crossings = 0.0;
    float minR = r0;

    for (int i = 0; i < 200; i++) {
      if (float(i) >= uMaxSteps) break;
      float r = length(pos);
      if (r < minR) minR = r;
      if (r <= 2.008) {
        captured = true;
        break;
      }
      if (r > rFar && dot(pos, vel) > 0.0) {
        break;
      }

      vec3 prevPos = pos;
      float rSafe = max(r, 2.01);
      float nearFactor = clamp((rSafe - 1.82) * 0.45, 0.11, 1.0);
      float hStep = uStepScale * rSafe * nearFactor;
      if (rSafe > outerSpeedupR) {
        if (dot(pos, vel) > 0.0) {
          hStep = max(hStep, 0.22 * rSafe);
        } else {
          float farMargin = rSafe - outerSpeedupR;
          hStep = max(hStep, min(0.14 * rSafe, farMargin * 0.55 + hStep));
        }
      }
      hStep = clamp(hStep, 0.022, 22.0);

      vec3 k1x = vel;
      vec3 k1v = geodesicAccel(pos, h2);

      vec3 p2 = pos + 0.5 * hStep * k1x;
      vec3 v2 = vel + 0.5 * hStep * k1v;
      vec3 k2x = v2;
      vec3 k2v = geodesicAccel(p2, h2);

      vec3 p3 = pos + 0.5 * hStep * k2x;
      vec3 v3 = vel + 0.5 * hStep * k2v;
      vec3 k3x = v3;
      vec3 k3v = geodesicAccel(p3, h2);

      vec3 p4 = pos + hStep * k3x;
      vec3 v4 = vel + hStep * k3v;
      vec3 k4x = v4;
      vec3 k4v = geodesicAccel(p4, h2);

      pos += (hStep / 6.0) * (k1x + 2.0 * k2x + 2.0 * k3x + k4x);
      vel += (hStep / 6.0) * (k1v + 2.0 * k2v + 2.0 * k3v + k4v);

      // Ekvatoral disk düzlemi (y = 0) geçiş kontrolü
      if (uShowDisk > 0.5 && transmittance > 0.02) {
        if ((prevPos.y > 0.0 && pos.y <= 0.0) || (prevPos.y < 0.0 && pos.y >= 0.0)) {
          float dy = prevPos.y - pos.y;
          float frac = (abs(dy) > 1e-6) ? clamp(prevPos.y / dy, 0.0, 1.0) : 0.5;
          vec3 hitPos = mix(prevPos, pos, frac);
          float rHit = length(hitPos);
          if (rHit >= rInEff && rHit <= uDiskOuter) {
            vec4 dCol = shadeDisk(hitPos, rHit, rInEff, bz, obsShift, crossings);
            accColor += transmittance * dCol.rgb;
            transmittance *= (1.0 - dCol.a);
            crossings += 1.0;
          }
        }
      }
    }

    // Adım bütçesi dolduğunda foton küresi içine düşmüş ışın yakalanmış sayılır
    float rEnd = length(pos);
    if (!captured && rEnd < 3.15 && (rEnd < 2.6 || dot(pos, vel) < 0.0)) {
      captured = true;
    }
    escapeDir = normalize(vel);
  }

  // Kaçan ışınlar için Samanyolu arka plan gökyüzünü örnekle (türev tekdüzeliği için koşulsuz çağrı)
  bool wantSky = !captured && transmittance > 0.005;
  vec3 skyCol = sampleSkyDir(escapeDir, wantSky);
  if (wantSky) {
    float skyShift = skyDoppler * (uSkyGravBlue > 0.5 ? invSqrtF0 : 1.0);
    if (abs(skyShift - 1.0) > 0.015) {
      vec3 shiftTint = blackbodyToRGB(clamp(5800.0 * skyShift, 1400.0, 38000.0));
      vec3 neutral = blackbodyToRGB(5800.0);
      vec3 relTint = shiftTint / max(neutral, vec3(0.08));
      float skyBoost = clamp(skyShift * skyShift, 0.18, 3.0);
      skyCol *= relTint * skyBoost;
    }
    accColor += transmittance * skyCol;
  }

  // HDR -> ACES filmik ton eşleme -> sRGB gama kodlama (RGBA8 FBO için)
  vec3 mapped = acesToneMap(accColor * 0.3);
  return safePow3(mapped, 1.0 / 2.2);
}
`;

// =====================================================================
// WebGL 2 (GLSL ES 3.00) SHADER KAYNAKLARI
// =====================================================================

/** WebGL 2 tam ekran üçgen/dörtgen köşe gölgelendiricisi (ray-tracing geçişi). */
export const RAYTRACE_VERT_300 = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/** WebGL 2 tam ekran Schwarzschild sıfır jeodezik ışın izleyicisi (GLSL ES 3.00). */
export const RAYTRACE_FRAG_300 = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uSpin;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uTempScale;
uniform float uDiskBrightness;
uniform float uTime;
uniform float uShowDisk;
uniform float uUseDoppler;
uniform float uUseGravRedshift;
uniform float uUseLensing;
uniform float uMaxSteps;
uniform float uStepScale;
uniform vec3 uShipBeta;
uniform float uSkyGravBlue;
uniform sampler2D uSkyTex;
uniform float uHasSkyTex;

out vec4 fragColor;

vec3 proceduralSky(vec3 dir);

// Dikişsiz equirectangular mipmap örneklemesi: u sarmasını tekdüze akışta dFdx/dFdy ile düzeltir
vec3 sampleSkyDir(vec3 dir, bool wantSample) {
  vec3 d = normalize(dir);
  float phi = (abs(d.x) + abs(d.z) > 1e-6) ? atan(d.z, d.x) : 0.0;
  float u = phi * 0.15915494309 + 0.5;
  float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830988618 + 0.5;
  vec2 ddx = vec2(fract(dFdx(u) + 0.5) - 0.5, dFdx(v));
  vec2 ddy = vec2(fract(dFdy(u) + 0.5) - 0.5, dFdy(v));
  if (!wantSample) return vec3(0.0);
  if (uHasSkyTex < 0.5) return proceduralSky(d);
  float maxGrad = 0.065;
  ddx = clamp(ddx, vec2(-maxGrad), vec2(maxGrad));
  ddy = clamp(ddy, vec2(-maxGrad), vec2(maxGrad));
  vec3 srgb = textureGrad(uSkyTex, vec2(u, v), ddx, ddy).rgb;
  return pow(max(srgb, vec3(1e-7)), vec3(2.2)) * step(vec3(1e-7), srgb) * 1.12;
}
${SHARED_PHYSICS_GLSL}
void main() {
  fragColor = vec4(traceBlackHole(gl_FragCoord.xy), 1.0);
}
`;

/** WebGL 2 ekran-dışı FBO görüntüsünü doğrusal filtrelemeyle ölçekleyen sunum köşe gölgelendiricisi. */
export const PRESENT_VERT_300 = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/** WebGL 2 doğrusal ölçekleme sunum parça gölgelendiricisi. */
export const PRESENT_FRAG_300 = `#version 300 es
precision mediump float;
uniform sampler2D uFrameTex;
in vec2 vUv;
out vec4 fragColor;
void main() {
  fragColor = vec4(texture(uFrameTex, vUv).rgb, 1.0);
}
`;

// =====================================================================
// WebGL 1 (GLSL ES 1.00) GERİ DÖNÜŞ SHADER KAYNAKLARI
// =====================================================================

/** WebGL 1 köşe gölgelendiricisi (ray-tracing geçişi). */
export const RAYTRACE_VERT_100 = `attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/** WebGL 1 Schwarzschild sıfır jeodezik ışın izleyicisi (GLSL ES 1.00). */
export const RAYTRACE_FRAG_100 = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uSpin;
uniform float uDiskInner;
uniform float uDiskOuter;
uniform float uTempScale;
uniform float uDiskBrightness;
uniform float uTime;
uniform float uShowDisk;
uniform float uUseDoppler;
uniform float uUseGravRedshift;
uniform float uUseLensing;
uniform float uMaxSteps;
uniform float uStepScale;
uniform vec3 uShipBeta;
uniform float uSkyGravBlue;
uniform sampler2D uSkyTex;
uniform float uHasSkyTex;

vec3 proceduralSky(vec3 dir);

vec3 sampleSkyDir(vec3 dir, bool wantSample) {
  if (!wantSample) return vec3(0.0);
  if (uHasSkyTex < 0.5) return proceduralSky(dir);
  vec3 d = normalize(dir);
  float phi = (abs(d.x) + abs(d.z) > 1e-6) ? atan(d.z, d.x) : 0.0;
  float u = phi * 0.15915494309 + 0.5;
  float v = asin(clamp(d.y, -1.0, 1.0)) * 0.31830988618 + 0.5;
  vec3 srgb = texture2D(uSkyTex, vec2(u, v)).rgb;
  return pow(max(srgb, vec3(1e-7)), vec3(2.2)) * step(vec3(1e-7), srgb) * 1.12;
}
${SHARED_PHYSICS_GLSL}
void main() {
  gl_FragColor = vec4(traceBlackHole(gl_FragCoord.xy), 1.0);
}
`;

/** WebGL 1 doğrusal ölçekleme sunum köşe gölgelendiricisi. */
export const PRESENT_VERT_100 = `attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/** WebGL 1 doğrusal ölçekleme sunum parça gölgelendiricisi. */
export const PRESENT_FRAG_100 = `precision mediump float;
uniform sampler2D uFrameTex;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uFrameTex, vUv).rgb, 1.0);
}
`;
