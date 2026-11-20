window.landscapeFragment = `
precision highp float;

uniform sampler2D uBase;
uniform sampler2D uArt;
uniform sampler2D uMasks;
uniform sampler2D uCloud;
uniform sampler2D uMist;

uniform vec2 uSize;
uniform float uTime;

varying vec2 vUV;

const vec2 SRC_SIZE = vec2(1672.0, 941.0);
const vec2 CLOUD_TEX_SIZE = vec2(1672.0, 140.0);
const vec2 MIST_TEX_SIZE = vec2(640.0, 152.0);

// vUV is top-left based. The source is mapped with a center-cover fit and
// sampled with the same top-left convention, matching the unflipped uploads.
vec2 sourcePosition() {
  float cover = max(uSize.x / SRC_SIZE.x, uSize.y / SRC_SIZE.y);
  vec2 drawnSize = SRC_SIZE * cover;
  vec2 origin = (uSize - drawnSize) * 0.5;
  return (vUV * uSize - origin) / cover;
}

vec2 artUV(vec2 p) {
  return clamp(p, vec2(0.5), SRC_SIZE - vec2(0.5)) / SRC_SIZE;
}

float softEdge(vec2 uv) {
  vec2 lo = smoothstep(vec2(0.0), vec2(0.055), uv);
  vec2 hi = vec2(1.0) - smoothstep(vec2(0.945), vec2(1.0), uv);
  vec2 fade = lo * hi;
  return fade.x * fade.y;
}

// Monotone cubic centerline through the river waypoints:
// (500,650) -> (930,720) -> (590,778) -> (1100,860).
// The returned value is dx/dy. Flow runs toward increasing source y.
float riverSlope(float y) {
  float t;
  float h;
  float xa;
  float xb;
  float ma;
  float mb;

  if (y < 720.0) {
    t = clamp((y - 650.0) / 70.0, 0.0, 1.0);
    h = 70.0;
    xa = 500.0;
    xb = 930.0;
    ma = 4.6;
    mb = 0.0;
  } else if (y < 778.0) {
    t = clamp((y - 720.0) / 58.0, 0.0, 1.0);
    h = 58.0;
    xa = 930.0;
    xb = 590.0;
    ma = 0.0;
    mb = 0.0;
  } else {
    t = clamp((y - 778.0) / 82.0, 0.0, 1.0);
    h = 82.0;
    xa = 590.0;
    xb = 1100.0;
    ma = 0.0;
    mb = 4.4;
  }

  float t2 = t * t;
  float t3 = t2 * t;
  float slope = ((6.0 * t2 - 6.0 * t) * xa
              + (3.0 * t2 - 4.0 * t + 1.0) * h * ma
              + (-6.0 * t2 + 6.0 * t) * xb
              + (3.0 * t2 - 2.0 * t) * h * mb) / h;
  return slope;
}

// Step backward along the curved river to find the previous ink position.
vec2 advectBack(vec2 p, float travel) {
  vec2 q = p;
  float stepLength = travel / 3.0;
  for (int i = 0; i < 3; i++) {
    float slope = riverSlope(q.y);
    vec2 flow = normalize(vec2(slope, 1.0));
    q -= flow * stepLength;
  }
  return q;
}

// One feathering helper shared by every needle tuft. The elliptical distance
// saturates before the rim, so the weight is EXACTLY zero outside the patch
// and cannot leak onto bark, trunk splits, or the rock beneath.
float tuftFeather(vec2 p, vec2 center, vec2 radii) {
  vec2 q = (p - center) / radii;
  float d = length(q);
  return 1.0 - smoothstep(0.34, 1.0, d);
}

// One small peripheral tuft. The motion is a slow, lightly asymmetric nod:
// mostly vertical, with a small shared lean and a little lag between the two
// tufts of a tree. depth scales the same gesture down for distant sprays.
void addPine(vec2 p, vec2 center, vec2 radii, float phase, float depth,
             float gust, float windPull, inout vec2 motion) {
  float w = tuftFeather(p, center, radii);
  if (w <= 0.0) {
    return;
  }

  float t = uTime;
  float nod = 0.73 * sin(t * 0.72 + phase)
            + 0.19 * sin(t * 1.47 + phase * 0.83 + 0.6)
            + 0.08 * sin(t * 2.23 + phase * 1.91);
  float lean = 0.25 * sin(t * 0.43 + phase * 1.31 + 0.9)
             + 0.08 * sin(t * 0.91 + phase * 0.57)
             + 0.07 * windPull
             + 0.04 * (0.5 + 0.5 * sin(phase * 1.7));

  motion += vec2(lean, nod) * (1.82 * depth * gust * w);
}

vec2 pineMotion(vec2 p) {
  vec2 motion = vec2(0.0);

  // One slow shared gust: long swells and an occasional genuine lull.
  float gustWave = 0.5 + 0.5 * sin(uTime * 0.21 + 0.6);
  float gust = smoothstep(0.10, 0.78, gustWave);

  // Common horizontal pressure keeps all ten tufts in the same air mass.
  float windPull = sin(uTime * 0.27 + 1.1);

  // Top pine (nearest) and its two right-hand peripheral needle tufts.
  addPine(p, vec2(329.0, 142.0), vec2(28.0, 12.0), 0.20, 1.00,
          gust, windPull, motion);
  addPine(p, vec2(254.0, 110.0), vec2(21.0, 9.0), 0.38, 1.00,
          gust, windPull, motion);

  // Second pine, stepping farther back down the left bank.
  addPine(p, vec2(181.0, 317.0), vec2(26.0, 12.0), 1.90, 0.86,
          gust, windPull, motion);
  addPine(p, vec2(145.0, 292.0), vec2(19.0, 9.0), 2.08, 0.86,
          gust, windPull, motion);

  // Third pine.
  addPine(p, vec2(225.0, 434.0), vec2(24.0, 11.0), 3.20, 0.76,
          gust, windPull, motion);
  addPine(p, vec2(198.0, 416.0), vec2(18.0, 9.0), 3.38, 0.76,
          gust, windPull, motion);

  // Fourth pine.
  addPine(p, vec2(242.0, 549.0), vec2(23.0, 10.0), 4.35, 0.68,
          gust, windPull, motion);
  addPine(p, vec2(227.0, 520.0), vec2(18.0, 8.0), 4.53, 0.68,
          gust, windPull, motion);

  // Fifth, most distant spray on the lower-right branch.
  addPine(p, vec2(455.0, 616.0), vec2(32.0, 15.0), 5.15, 0.60,
          gust, windPull, motion);
  addPine(p, vec2(437.0, 594.0), vec2(26.0, 12.0), 5.33, 0.60,
          gust, windPull, motion);

  // Hard bound independent of overlap: never more than 2.2 source pixels.
  float travel = length(motion);
  if (travel > 2.2) {
    motion *= 2.2 / travel;
  }
  return motion;
}

void main() {
  vec2 srcPx = sourcePosition();
  vec2 baseUV = artUV(srcPx);
  vec3 color = texture2D(uBase, baseUV).rgb;

  vec4 packedMasks = texture2D(uMasks, baseUV);
  float waterMask = packedMasks.g;
  float foregroundVisible = smoothstep(0.02, 0.35, packedMasks.b);

  // ── Drifting sky clouds, always behind the pine and the terrain ─────────
  // The 140 px panorama occupies the upper-cloud band of the plate.
  float cloudY = (srcPx.y - 242.0) / CLOUD_TEX_SIZE.y;
  float cloudX = fract((srcPx.x - uTime * 14.2) / CLOUD_TEX_SIZE.x);
  vec4 skyCloud = texture2D(uCloud, vec2(cloudX, clamp(cloudY, 0.0, 1.0)));
  float cloudBand = smoothstep(0.0, 0.04, cloudY)
                  * (1.0 - smoothstep(0.96, 1.0, cloudY));
  float cloudAlpha = skyCloud.a * cloudBand * foregroundVisible;
  float overSun = 1.0 - smoothstep(57.0, 59.0, distance(srcPx, vec2(1249.6, 300.7)));
  vec3 cloudInk = mix(skyCloud.rgb, vec3(0.99, 0.85, 0.65), overSun * 0.88);
  color = mix(color, cloudInk, clamp(cloudAlpha, 0.0, 1.0));

  // ── Two valley-mist veils at different heights ──────────────────────────
  // They drift for the opening beat and lock permanently at 13 seconds.
  float fogClock = clamp(uTime / 13.0, 0.0, 1.0);
  float fadeA = 1.0 - pow(1.0 - fogClock, 2.35);
  float fadeB = 1.0 - pow(1.0 - fogClock, 1.85);
  float driftA = 176.0 * fadeA;
  float driftB = 130.0 * fadeB;

  vec2 mistUvA = vec2((srcPx.x - 500.0 - driftA) / 1172.0,
                      (srcPx.y - 435.0 + fadeA * 18.0) / 196.0);
  vec2 mistUvB = vec2((srcPx.x - 575.0 - driftB) / 1055.0,
                      (srcPx.y - 496.0 + fadeB * 16.0) / 184.0);
  vec4 mistA = texture2D(uMist, clamp(mistUvA, 0.0, 1.0));
  vec4 mistB = texture2D(uMist, clamp(mistUvB, 0.0, 1.0));

  float fogZone = smoothstep(490.0, 560.0, srcPx.x)
                * (1.0 - smoothstep(1590.0, 1665.0, srcPx.x))
                * smoothstep(415.0, 470.0, srcPx.y)
                * (1.0 - smoothstep(640.0, 690.0, srcPx.y));
  float aA = mistA.a * softEdge(mistUvA) * fogZone * foregroundVisible;
  float aB = mistB.a * softEdge(mistUvB) * fogZone * foregroundVisible;
  float fogAlpha = min(0.51, aA * 0.37 + aB * 0.28);
  vec3 fogColor = (mistA.rgb * aA * 0.37 + mistB.rgb * aB * 0.28)
                / max(aA * 0.37 + aB * 0.28, 0.0001);
  color = mix(color, fogColor, fogAlpha);

  // ── River: two triangular-crossfaded ink phases along the S-bend ────────
  // 18 source px/s; each layer wraps while at zero weight, so no reversal.
  float waterSafe = smoothstep(0.01, 0.22, waterMask);
  if (waterSafe > 0.0) {
    float phase = fract(uTime * (18.0 / 54.0) + 0.19);
    float phaseB = fract(phase + 0.5);
    float offsetA = phase * 54.0;
    float offsetB = phaseB * 54.0;
    float weightA = 1.0 - abs(phase * 2.0 - 1.0);
    float weightB = 1.0 - abs(phaseB * 2.0 - 1.0);

    vec2 advectedA = artUV(advectBack(srcPx, offsetA));
    vec2 advectedB = artUV(advectBack(srcPx, offsetB));
    vec3 inkA = texture2D(uArt, advectedA).rgb;
    vec3 inkB = texture2D(uArt, advectedB).rgb;
    float waterA = texture2D(uMasks, advectedA).g;
    float waterB = texture2D(uMasks, advectedB).g;

    float usableA = weightA * smoothstep(0.015, 0.45, waterA);
    float usableB = weightB * smoothstep(0.015, 0.45, waterB);
    float inkCoverage = usableA + usableB;
    vec3 flowingInk = (inkA * usableA + inkB * usableB)
                    / max(inkCoverage, 0.0001);

    float waterMix = waterSafe * inkCoverage * 0.85;
    color = mix(color, flowingInk, clamp(waterMix, 0.0, 1.0));

    // Shimmer is gated by the native ink darkness and travels with the flow.
    float inkLuma = dot(flowingInk, vec3(0.299, 0.587, 0.114));
    float flowSlope = riverSlope(srcPx.y);
    vec2 flowDir = normalize(vec2(flowSlope, 1.0));
    float glintWave = 0.5 + 0.5 * sin(dot(srcPx, flowDir) * 0.095
                                    - uTime * 1.70 + 1.40);
    float glint = smoothstep(0.55, 0.86, inkLuma)
                * smoothstep(0.30, 0.95, glintWave)
                * waterSafe * min(inkCoverage, 1.0) * 0.045;
    color += vec3(1.0, 0.84, 0.52) * glint;
  }

  // ── Pines last: one moved sample of original ink, masked by moved R ─────
  if (srcPx.x < 515.0 && srcPx.y < 730.0) {
    vec2 pineOffset = pineMotion(srcPx);
    vec2 pineUV = artUV(srcPx - pineOffset);
    vec3 pineInk = texture2D(uArt, pineUV).rgb;
    float pineAlpha = texture2D(uMasks, pineUV).r;
    color = mix(color, pineInk, clamp(pineAlpha, 0.0, 1.0));
  }

  gl_FragColor = vec4(color, 1.0);
}
`;
