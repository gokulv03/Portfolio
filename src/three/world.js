import {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, Mesh, LineSegments, Points, EdgesGeometry,
  BoxGeometry, CylinderGeometry, BufferGeometry, Float32BufferAttribute, BufferAttribute,
  LineBasicMaterial, MeshBasicMaterial, PointsMaterial, Vector3, Vector4, Matrix4, AdditiveBlending,
  CanvasTexture, Group, Color, Vector2, WebGLRenderTarget, HalfFloatType, SphereGeometry,
  ShaderMaterial, BackSide,
} from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

/**
 * The world behind the page: one long circuit board drawn as line art, and a
 * camera that scroll flies through it.
 *
 *   top of page   high above the board, looking down on it like a map
 *   hero dive     the camera drops and levels out just above the surface
 *   the sections  it cruises forward along an amber signal bus, one steady
 *                 distance per scrolled pixel, while pulses race ahead
 *   launch        between profile and projects the bus runs through a row of
 *                 coils (a nod to the rail launcher) and the camera is fired
 *                 down it at several times cruise speed
 *   contact       it climbs away until the whole board lies below again
 *
 * The flight is shot like a film rather than flown in a straight line: each
 * section has its own camera set-up (see the shot list in `setJourney`), and
 * letterbox bars (the `bars` element) close in on the two stretches where the
 * world has the screen to itself.
 *
 * The copper is "energised" by a small shader patch: a power-on wave lights the
 * board outward once the page has booted, ripples spread from clicks and from
 * project changes, and traces brighten around the camera like a headlight.
 *
 * Look: on larger screens a light bloom is laid over the frame (see
 * `createHalo`: the frame itself is drawn straight to the screen, and the glow
 * comes from a small blurred copy, which keeps it cheap), so lit copper
 * glows like phosphor; a sky dome puts an amber haze on the horizon, which the
 * far components stand against as silhouettes. If the frame rate drops below
 * about 50 a second, the stage steps its own quality down (resolution first,
 * then the bloom, then resolution again).
 *
 * Everything is procedural (seeded, so it is the same board on every visit).
 * Static geometry is merged into a handful of draw calls.
 */
const BG = 0x070a0c
const FILL = 0x0a0e12
const AMBER = 0xffb020
const AMBER_BR = 0xffc65c
const COOL = 0x93a7ab

/* the cruise: a gently winding lane running towards -z */
const Z0 = 40
const LEN = 440
const pathX = (t) => 7 * Math.sin(t * 7.85 + 0.6) + 3 * Math.sin(t * 17 + 2)
const pathZ = (t) => Z0 - LEN * t
const tOfZ = (z) => (Z0 - z) / LEN

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const lerp = (a, b, k) => a + (b - a) * k
const smooth = (k) => k * k * (3 - 2 * k)
const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10)

function mulberry(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* squared stroke font on a 2 x 4 grid, just the glyphs designators need */
const BOX = [[0, 0], [2, 0], [2, 4], [0, 4], [0, 0]]
const FONT = {
  0: [BOX], 1: [[[1, 0], [1, 4]]],
  2: [[[0, 4], [2, 4], [2, 2], [0, 2], [0, 0], [2, 0]]],
  3: [[[0, 4], [2, 4], [2, 0], [0, 0]], [[0, 2], [2, 2]]],
  4: [[[0, 4], [0, 2], [2, 2]], [[2, 4], [2, 0]]],
  5: [[[2, 4], [0, 4], [0, 2], [2, 2], [2, 0], [0, 0]]],
  6: [[[2, 4], [0, 4], [0, 0], [2, 0], [2, 2], [0, 2]]],
  7: [[[0, 4], [2, 4], [2, 0]]],
  8: [BOX, [[0, 2], [2, 2]]],
  9: [[[0, 0], [2, 0], [2, 4], [0, 4], [0, 2], [2, 2]]],
  U: [[[0, 4], [0, 0], [2, 0], [2, 4]]],
  C: [[[2, 4], [0, 4], [0, 0], [2, 0]]],
  R: [[[0, 0], [0, 4], [2, 4], [2, 2], [0, 2]], [[1, 2], [2, 0]]],
  L: [[[0, 4], [0, 0], [2, 0]]],
  Q: [BOX, [[1, 1], [2, 0]]],
  J: [[[2, 4], [2, 0], [0, 0], [0, 1]]],
}

/* soft round sprite, so points of light glow instead of sitting as squares */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.22, 'rgba(255,255,255,0.6)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.14)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new CanvasTexture(c)
}

/* one coil of the launch tunnel: windings inside an octagonal former */
function coilPoints() {
  const pts = []
  const R = 4.6, F = R + 0.7
  const loop = (rad, z, n, turn = 0) => {
    for (let i = 0; i < n; i++) {
      const a0 = ((i + turn) / n) * Math.PI * 2, a1 = ((i + 1 + turn) / n) * Math.PI * 2
      pts.push(Math.cos(a0) * rad, Math.sin(a0) * rad, z, Math.cos(a1) * rad, Math.sin(a1) * rad, z)
    }
  }
  for (const z of [-0.7, -0.35, 0, 0.35, 0.7]) loop(R, z, 48)
  loop(F, -0.95, 8, 0.5)
  loop(F, 0.95, 8, 0.5)
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    pts.push(Math.cos(a) * F, Math.sin(a) * F, -0.95, Math.cos(a) * F, Math.sin(a) * F, 0.95)
  }
  return pts
}

/* fragment patch shared by every line and point material (see `energise`) */
const ENERGY_GLSL = `
  float eD = distance(vWorldP.xz, uOrigin.xz);
  float eLit = 1.0 - smoothstep(uReveal - 10.0, uReveal, eD);
  float eWave = smoothstep(uReveal - 36.0, uReveal - 6.0, eD) * 1.5;
  for (int i = 0; i < 4; i++) {
    float rd = (distance(vWorldP.xz, uRipples[i].xy) - uRipples[i].z) / 3.4;
    eWave += uRipples[i].w * exp(-rd * rd);
  }
  float eNear = 1.0 - smoothstep(5.0, 40.0, distance(vWorldP, uCam));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.87, 0.62), clamp(eWave * 0.45, 0.0, 0.75));
  diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + eWave * 2.2 + eNear * 0.6)) * eLit;
`

/* ── the board ─────────────────────────────────────────────────────────── */
function buildBoard(lite) {
  const rand = mulberry(20261113)
  const r = (a, b) => a + (b - a) * rand()
  const pick = (n) => Math.floor(rand() * n)
  const zMax = Z0 + 240
  const zMin = Z0 - LEN - 280
  const xMax = 180

  const grid = [], cool = [], amber = [], bus = []
  const edgeCool = [], edgeAmber = [], pins = [], fill = [], fillWarm = []
  const silk = [], leds = []
  const polys = [] // amber polylines that pulses can travel along

  const seg = (b, x1, z1, x2, z2, y = 0.03) => { b.push(x1, y, z1, x2, y, z2) }
  const ring = (b, x, z, rad, n = 8, y = 0.03) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2
      b.push(x + Math.cos(a0) * rad, y, z + Math.sin(a0) * rad, x + Math.cos(a1) * rad, y, z + Math.sin(a1) * rad)
    }
  }
  const square = (b, x, z, s, y = 0.03) => {
    seg(b, x - s, z - s, x + s, z - s, y); seg(b, x + s, z - s, x + s, z + s, y)
    seg(b, x + s, z + s, x - s, z + s, y); seg(b, x - s, z + s, x - s, z - s, y)
  }
  // pts: flat [x, z, x, z, ...]
  const addPoly = (b, pts, track) => {
    const n = pts.length / 2
    for (let i = 0; i < n - 1; i++) seg(b, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3])
    if (!track) return
    const cum = new Float32Array(n)
    for (let i = 1; i < n; i++) {
      cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1])
    }
    polys.push({ pts: Float32Array.from(pts), cum, total: cum[n - 1], n })
  }

  // silkscreen reference designators (U12, C4 ...) in a squared stroke font,
  // laid on the floor so they read from the direction of travel
  const label = (text, x0, z0, size) => {
    const u = size / 4
    for (let i = 0; i < text.length; i++) {
      const strokes = FONT[text[i]]
      if (!strokes) continue
      for (const st of strokes) {
        for (let k = 0; k < st.length - 1; k++) {
          silk.push(
            x0 + (i * 3 + st[k][0]) * u, 0.03, z0 - st[k][1] * u,
            x0 + (i * 3 + st[k + 1][0]) * u, 0.03, z0 - st[k + 1][1] * u,
          )
        }
      }
    }
  }

  // floor graticule: the page's 2D measurement grid, laid flat
  for (let x = -xMax; x <= xMax; x += 12) seg(grid, x, zMin, x, zMax, 0)
  for (let z = Math.ceil(zMin / 12) * 12; z <= zMax; z += 12) seg(grid, -xMax, z, xMax, z, 0)

  // the signal bus the camera rides (these are polys[0..4])
  const LANES = 5
  for (let l = 0; l < LANES; l++) {
    const o = (l - (LANES - 1) / 2) * 0.9
    const pts = []
    for (let i = 0; i <= 320; i++) {
      const t = -0.5 + (i / 320) * 2.1
      pts.push(pathX(t) + o, pathZ(t))
    }
    addPoly(bus, pts, true)
  }

  // routed trace bundles: straight runs and 45° jogs, like real copper
  const nBundles = lite ? 100 : 190
  for (let b = 0; b < nBundles; b++) {
    const alongZ = rand() < 0.68
    const isAmber = rand() < 0.3
    const lanes = 1 + pick(alongZ ? 7 : 4)
    // u = cross coordinate, v = travel coordinate (decreasing)
    let u = alongZ ? (rand() + rand() + rand() - 1.5) / 1.5 * xMax : r(zMin + 20, zMax - 20)
    let v = alongZ ? r(zMin + 80, zMax) : r(-xMax + 60, xMax)
    const base = [[u, v]]
    const legs = 3 + pick(5)
    let diag = true
    for (let i = 0; i < legs; i++) {
      if (!diag && rand() < 0.5) {
        const d = r(3, 12) * (rand() < 0.5 ? -1 : 1)
        v -= Math.abs(d); u += d; diag = true
      } else {
        v -= r(10, 55); diag = false
      }
      base.push([u, v])
    }
    for (let l = 0; l < lanes; l++) {
      const o = (l - (lanes - 1) / 2) * 0.9
      const pts = []
      for (const [uu, vv] of base) {
        if (alongZ) pts.push(uu + o, vv)
        else pts.push(vv, uu + o)
      }
      addPoly(isAmber ? amber : cool, pts, isAmber)
      square(isAmber ? amber : cool, pts[0], pts[1], 0.3)
      square(isAmber ? amber : cool, pts[pts.length - 2], pts[pts.length - 1], 0.3)
    }
  }

  // vias
  for (let i = 0; i < (lite ? 120 : 280); i++) {
    const x = r(-xMax, xMax), z = r(zMin, zMax), rad = r(0.35, 0.7)
    const b = rand() < 0.25 ? amber : cool
    ring(b, x, z, rad)
    if (rand() < 0.4) ring(b, x, z, rad * 0.45, 6)
  }

  // components: filled bodies (so they hide what is behind them) + edge lines
  const M = new Matrix4()
  const append = (target, arr) => { for (let i = 0; i < arr.length; i++) target.push(arr[i]) }
  const part = (geo, x, y, z, edges) => {
    geo.applyMatrix4(M.makeTranslation(x, y, z))
    const e = new EdgesGeometry(geo, 18)
    append(edges, e.attributes.position.array)
    const flat = geo.index ? geo.toNonIndexed() : geo
    append(edges === edgeAmber ? fillWarm : fill, flat.attributes.position.array)
    e.dispose()
    if (flat !== geo) flat.dispose()
    geo.dispose()
  }
  const box = (w, h, d, x, z, edges, y0 = 0) => part(new BoxGeometry(w, h, d), x, y0 + h / 2, z, edges)
  const cyl = (rad, h, x, z, edges) => part(new CylinderGeometry(rad, rad, h, 24), x, h / 2, z, edges)

  const spec = (far) => {
    const k = rand()
    if (k < (far ? 0.3 : 0.05)) { const w = r(4.5, 8); return { kind: 'tower', w, d: w, h: r(9, far ? 26 : 14) } }
    if (k < (far ? 0.44 : 0.11)) return { kind: 'sink', w: r(5, 8), d: r(4, 6.5), h: r(3, 5.5) }
    if (k < 0.36) { const w = r(3.2, 7.5); return { kind: 'ic', w, d: rand() < 0.6 ? w : r(3.2, 7.5), h: r(0.5, 1) } }
    if (k < 0.5) return { kind: 'soic', w: r(2, 3), d: r(3.5, 6), h: 0.6 }
    if (k < 0.66) { const w = r(1.8, 4.2); return { kind: 'cap', w, d: w, h: r(1.8, 5.5) } }
    if (k < 0.74) { const w = r(3.6, 5.2); return { kind: 'coil', w, d: w, h: r(1.8, 2.6) } }
    if (k < 0.84) return { kind: 'header', w: 1.3, d: Math.round(r(5, 13)) * 1.1 + 0.6, h: 0.9 }
    return { kind: 'chips', w: 1.3, d: (3 + pick(6)) * 1.1, h: 0.45 }
  }

  const placed = []
  const free = (x, z, rad) => {
    for (const p of placed) {
      const dx = p.x - x, dz = p.z - z, m = p.rad + rad + 0.7
      if (dx * dx + dz * dz < m * m) return false
    }
    return true
  }

  const PREFIX = { tower: 'C', cap: 'C', sink: 'Q', ic: 'U', soic: 'U', coil: 'L', header: 'J', chips: 'R' }
  const build = (s, x, z) => {
    const edges = rand() < 0.16 ? edgeAmber : edgeCool
    const swap = rand() < 0.5
    const w = swap ? s.d : s.w
    const d = swap ? s.w : s.d
    const big = s.kind === 'tower' || s.kind === 'sink'
    if (rand() < 0.8) {
      const size = big ? 1.5 : 0.85
      label(PREFIX[s.kind] + (1 + pick(98)), x - w / 2, z + d / 2 + 0.7 + size, size)
    }
    // status lights: a beacon on every other tower, the odd LED elsewhere
    if (s.kind === 'tower') { if (rand() < 0.55) leds.push(x, s.h + 0.35, z) }
    else if (s.kind !== 'chips' && s.kind !== 'cap' && rand() < 0.3) leds.push(x + w / 2 - 0.45, s.h + 0.14, z + d / 2 - 0.45)
    switch (s.kind) {
      case 'tower':
        cyl(s.w / 2, s.h, x, z, edges)
        ring(edges, x, z, s.w * 0.24, 16, s.h + 0.02)
        break
      case 'cap':
        cyl(s.w / 2, s.h, x, z, edges)
        seg(edges, x - s.w * 0.3, z, x + s.w * 0.3, z, s.h + 0.02)
        break
      case 'sink': {
        box(w, 0.5, d, x, z, edges)
        const n = Math.max(3, Math.floor((swap ? w : d) / 0.75))
        for (let i = 0; i < n; i++) {
          const o = ((i + 0.5) / n - 0.5) * ((swap ? w : d) - 0.3)
          if (swap) box(0.14, s.h, d - 0.2, x + o, z, edges, 0.5)
          else box(w - 0.2, s.h, 0.14, x, z + o, edges, 0.5)
        }
        break
      }
      case 'ic': {
        box(w, s.h, d, x, z, edges)
        for (let px = -w / 2 + 0.5; px <= w / 2 - 0.45; px += 0.7) {
          seg(pins, x + px, z - d / 2, x + px, z - d / 2 - 0.55, 0.12)
          seg(pins, x + px, z + d / 2, x + px, z + d / 2 + 0.55, 0.12)
        }
        for (let pz = -d / 2 + 0.5; pz <= d / 2 - 0.45; pz += 0.7) {
          seg(pins, x - w / 2, z + pz, x - w / 2 - 0.55, z + pz, 0.12)
          seg(pins, x + w / 2, z + pz, x + w / 2 + 0.55, z + pz, 0.12)
        }
        ring(edgeAmber, x - w / 2 + 0.6, z - d / 2 + 0.6, 0.2, 8, s.h + 0.02)
        break
      }
      case 'soic':
        box(w, s.h, d, x, z, edges)
        if (swap) {
          for (let px = -w / 2 + 0.4; px <= w / 2 - 0.35; px += 0.65) {
            seg(pins, x + px, z - d / 2, x + px, z - d / 2 - 0.5, 0.12)
            seg(pins, x + px, z + d / 2, x + px, z + d / 2 + 0.5, 0.12)
          }
        } else {
          for (let pz = -d / 2 + 0.4; pz <= d / 2 - 0.35; pz += 0.65) {
            seg(pins, x - w / 2, z + pz, x - w / 2 - 0.5, z + pz, 0.12)
            seg(pins, x + w / 2, z + pz, x + w / 2 + 0.5, z + pz, 0.12)
          }
        }
        break
      case 'coil':
        box(s.w, s.h, s.w, x, z, edges)
        ring(edges, x, z, s.w * 0.36, 20, s.h + 0.02)
        break
      case 'header': {
        box(w, s.h, d, x, z, edges)
        const long = Math.max(w, d)
        for (let o = -long / 2 + 0.85; o <= long / 2 - 0.8; o += 1.1) {
          box(0.22, 1.5, 0.22, swap ? x + o : x, swap ? z : z + o, edges, s.h)
        }
        break
      }
      default: { // a row of chip passives
        const long = Math.max(w, d)
        for (let o = -long / 2 + 0.55; o <= long / 2 - 0.5; o += 1.1) {
          if (swap) box(0.6, 0.45, 1.2, x + o, z, edges)
          else box(1.2, 0.45, 0.6, x, z + o, edges)
        }
      }
    }
  }

  const scatter = (count, far) => {
    for (let i = 0; i < count; i++) {
      const s = spec(far)
      const rad = Math.hypot(s.w, s.d) / 2
      for (let tries = 0; tries < 14; tries++) {
        const z = far ? r(zMin + 10, zMax - 10) : r(zMin + 130, zMax - 90)
        const lane = pathX(tOfZ(z))
        const clear = (s.kind === 'tower' ? 13 : 6.5) + rad
        const x = far
          ? r(-xMax + 10, xMax - 10)
          : lane + (rand() < 0.5 ? -1 : 1) * (clear + Math.pow(rand(), 1.7) * 58)
        if (Math.abs(x - lane) < clear) continue
        if (!free(x, z, rad)) continue
        placed.push({ x, z, rad })
        build(s, x, z)
        break
      }
    }
  }
  scatter(lite ? 230 : 440, false)
  scatter(lite ? 60 : 150, true)

  // dust hanging in the air, for parallax
  const dust = []
  for (let i = 0; i < (lite ? 0 : 520); i++) dust.push(r(-90, 90), r(1.2, 46), r(zMin + 100, zMax - 60))

  return { grid, cool, amber, bus, edgeCool, edgeAmber, pins, silk, leds, fill, fillWarm, polys, dust, rand, lanes: LANES }
}

function pointAt(poly, s, out, o) {
  const { pts, cum, n, total } = poly
  const d = Math.min(Math.max(s, 0), total)
  let lo = 0, hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (cum[mid] <= d) lo = mid
    else hi = mid
  }
  const span = cum[hi] - cum[lo] || 1
  const k = (d - cum[lo]) / span
  out[o] = pts[lo * 2] + (pts[hi * 2] - pts[lo * 2]) * k
  out[o + 1] = 0.06
  out[o + 2] = pts[lo * 2 + 1] + (pts[hi * 2 + 1] - pts[lo * 2 + 1]) * k
}

/* keyframe track over scroll position: [[scroll, value], ...] */
function track(pairs) {
  const keys = pairs.map(([s, v]) => [s, v])
  for (let i = 1; i < keys.length; i++) keys[i][0] = Math.max(keys[i][0], keys[i - 1][0] + 1)
  return (s) => {
    if (s <= keys[0][0]) return keys[0][1]
    for (let i = 1; i < keys.length; i++) {
      if (s <= keys[i][0]) {
        const [s0, v0] = keys[i - 1], [s1, v1] = keys[i]
        return lerp(v0, v1, smooth((s - s0) / (s1 - s0)))
      }
    }
    return keys[keys.length - 1][1]
  }
}

/* ── halo: a cheap bloom ──────────────────────────────────────────────────
   The frame is drawn straight to the canvas, with the browser's own
   antialiasing. The glow is made separately: the scene is drawn again into a
   half-size buffer, everything dimmer than `cut` is dropped, the rest is
   blurred down through four ever-smaller buffers, and the result is added over
   the canvas. Nothing full-size is ever processed, which is what makes this
   affordable on integrated graphics. */
function createHalo(renderer) {
  const LEVELS = 4
  const small = new WebGLRenderTarget(2, 2, { type: HalfFloatType })
  const across = [], down = []
  for (let i = 0; i < LEVELS; i++) {
    across.push(new WebGLRenderTarget(2, 2, { type: HalfFloatType, depthBuffer: false }))
    down.push(new WebGLRenderTarget(2, 2, { type: HalfFloatType, depthBuffer: false }))
  }
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
  const blur = new ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tMap: { value: null }, uDir: { value: new Vector2() }, uCut: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D tMap; uniform vec2 uDir; uniform float uCut; varying vec2 vUv;
      vec3 tap(vec2 o) { return max(texture2D(tMap, vUv + o).rgb - uCut, 0.0); }
      void main() {
        vec3 c = tap(vec2(0.0)) * 0.227027;
        c += (tap(uDir * 1.3846) + tap(-uDir * 1.3846)) * 0.316216;
        c += (tap(uDir * 3.2308) + tap(-uDir * 3.2308)) * 0.070270;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })
  const merge = new ShaderMaterial({
    depthTest: false, depthWrite: false, transparent: true, blending: AdditiveBlending,
    uniforms: {
      t0: { value: down[0].texture }, t1: { value: down[1].texture },
      t2: { value: down[2].texture }, t3: { value: down[3].texture },
      uStrength: { value: 1 },
    },
    vertexShader: VERT,
    fragmentShader: `
      uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform sampler2D t3;
      uniform float uStrength; varying vec2 vUv;
      void main() {
        vec3 c = texture2D(t0, vUv).rgb + texture2D(t1, vUv).rgb * 0.9
               + texture2D(t2, vUv).rgb * 0.75 + texture2D(t3, vUv).rgb * 0.6;
        gl_FragColor = vec4(c * uStrength, 1.0);
        #include <colorspace_fragment>
      }`,
  })
  const quad = new FullScreenQuad(blur)
  const pass = (source, target, dx, dy, cut) => {
    blur.uniforms.tMap.value = source.texture
    blur.uniforms.uDir.value.set(dx / target.width, dy / target.height)
    blur.uniforms.uCut.value = cut
    renderer.setRenderTarget(target)
    quad.render(renderer)
  }
  const buf = new Vector2()

  return {
    resize() {
      renderer.getDrawingBufferSize(buf)
      small.setSize(Math.max(2, buf.x >> 1), Math.max(2, buf.y >> 1))
      for (let i = 0; i < LEVELS; i++) {
        const w = Math.max(2, buf.x >> (i + 1)), h = Math.max(2, buf.y >> (i + 1))
        across[i].setSize(w, h)
        down[i].setSize(w, h)
      }
    },
    render(scene, camera, strength, cut = 0.12) {
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)

      renderer.setRenderTarget(small)
      renderer.render(scene, camera)
      quad.material = blur
      let source = small
      for (let i = 0; i < LEVELS; i++) {
        pass(source, across[i], 1, 0, i === 0 ? cut : 0)
        pass(across[i], down[i], 0, 1, 0)
        source = down[i]
      }

      renderer.setRenderTarget(null)
      const auto = renderer.autoClear
      renderer.autoClear = false
      merge.uniforms.uStrength.value = strength
      quad.material = merge
      quad.render(renderer)
      renderer.autoClear = auto
    },
    dispose() {
      small.dispose()
      across.forEach((t) => t.dispose())
      down.forEach((t) => t.dispose())
      blur.dispose()
      merge.dispose()
      quad.dispose()
    },
  }
}

/* ── stage ─────────────────────────────────────────────────────────────── */
export function createWorld(canvas, { lite = false, bars = null } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75))
  renderer.setClearColor(BG, 1)
  // which graphics chip the browser picked (shown by the ?fps readout)
  const glInfo = renderer.getContext().getExtension('WEBGL_debug_renderer_info')
  const gpu = glInfo ? String(renderer.getContext().getParameter(glInfo.UNMASKED_RENDERER_WEBGL)) : 'unknown graphics'

  const scene = new Scene()
  scene.background = new Color(BG)
  scene.fog = new Fog(BG, 40, 160)
  const camera = new PerspectiveCamera(52, 1, 0.1, 1200)

  const trash = []
  const keep = (x) => { trash.push(x); return x }

  // shared uniforms for the energise patch
  const energy = {
    uReveal: { value: 0 },
    uOrigin: { value: new Vector3(0, 0, Z0 - 8) },
    uCam: { value: new Vector3() },
    uRipples: { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
  }
  const energise = (mat) => {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, energy)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nuniform float uReveal;\nuniform vec3 uOrigin;\nuniform vec3 uCam;\nuniform vec4 uRipples[4];')
        .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );\n${ENERGY_GLSL}`)
    }
    mat.customProgramCacheKey = () => 'energised'
    return keep(mat)
  }

  const board = buildBoard(lite)
  const geoOf = (arr) => {
    const g = keep(new BufferGeometry())
    g.setAttribute('position', new Float32BufferAttribute(arr, 3))
    return g
  }
  const lineMat = (color, opacity) => energise(new LineBasicMaterial({ color, transparent: true, opacity }))
  const lines = (arr, color, opacity) => {
    const o = new LineSegments(geoOf(arr), lineMat(color, opacity))
    o.frustumCulled = false
    scene.add(o)
    return o
  }

  // sky: a dome that travels with the camera, dark overhead with an amber haze
  // lying on the horizon (and showing through the open floor as ground mist)
  const sky = new Mesh(keep(new SphereGeometry(700, 32, 16)), keep(new ShaderMaterial({
    side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uBg: { value: new Color(BG) }, uGlow: { value: new Color(AMBER) }, uHaze: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uBg; uniform vec3 uGlow; uniform float uHaze; varying vec3 vDir;
      void main() {
        float h = normalize(vDir).y;
        float band = exp(-abs(h) * 16.0) * 0.9 + exp(-abs(h) * 5.0) * 0.14;
        gl_FragColor = vec4(uBg + uGlow * band * uHaze, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })))
  sky.frustumCulled = false
  sky.renderOrder = -10
  scene.add(sky)

  const bodyMat = (color) => keep(new MeshBasicMaterial({
    color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }))
  const body = new Mesh(geoOf(board.fill), bodyMat(FILL))
  body.frustumCulled = false
  scene.add(body)
  if (board.fillWarm.length) {
    const warm = new Mesh(geoOf(board.fillWarm), bodyMat(0x1d1406))
    warm.frustumCulled = false
    scene.add(warm)
  }

  // bloom (larger screens only): bright copper bleeds light into the dark
  let useBloom = !lite
  const halo = useBloom ? createHalo(renderer) : null

  lines(board.grid, COOL, 0.07)
  lines(board.cool, COOL, 0.22)
  lines(board.amber, AMBER, 0.4)
  lines(board.bus, AMBER, 0.62)
  lines(board.pins, COOL, 0.3)
  lines(board.silk, COOL, 0.3)
  lines(board.edgeCool, COOL, 0.62)
  lines(board.edgeAmber, AMBER, 0.9)

  const glow = keep(glowTexture())
  const glowMat = (size, opts = {}) => energise(new PointsMaterial({
    map: glow, size, sizeAttenuation: true, transparent: true,
    blending: AdditiveBlending, depthWrite: false, ...opts,
  }))

  if (board.dust.length) {
    const dust = new Points(geoOf(board.dust), energise(new PointsMaterial({
      color: COOL, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0.3, depthWrite: false,
    })))
    dust.frustumCulled = false
    scene.add(dust)
  }

  // status lights: each blinks to its own rhythm
  const { rand } = board
  const nLed = board.leds.length / 3
  const ledColor = new Float32Array(nLed * 3)
  const ledPlan = []
  for (let i = 0; i < nLed; i++) {
    const beacon = board.leds[i * 3 + 1] > 6
    ledPlan.push({
      period: beacon ? 2.4 + rand() * 1.6 : 0.5 + rand() * 3,
      phase: rand() * 10,
      duty: beacon ? 0.16 : rand() < 0.35 ? 1 : 0.5,
      warm: beacon || rand() < 0.75,
    })
  }
  const ledGeo = geoOf(board.leds)
  ledGeo.setAttribute('color', new BufferAttribute(ledColor, 3))
  const ledPoints = new Points(ledGeo, glowMat(1.5, { vertexColors: true, opacity: 0.95 }))
  ledPoints.frustumCulled = false
  scene.add(ledPoints)
  const blink = (time) => {
    for (let i = 0; i < nLed; i++) {
      const p = ledPlan[i]
      const on = ((time + p.phase) % p.period) / p.period < p.duty ? 1 : 0.06
      ledColor[i * 3] = (p.warm ? 1 : 0.62) * on
      ledColor[i * 3 + 1] = (p.warm ? 0.69 : 0.72) * on
      ledColor[i * 3 + 2] = (p.warm ? 0.13 : 0.75) * on
    }
    ledGeo.attributes.color.needsUpdate = true
  }

  // pulses: bright dashes that travel the amber copper
  const { polys, lanes } = board
  const nBus = lite ? 20 : 34
  const nFree = lite ? 30 : 80
  const pulses = []
  for (let i = 0; i < nBus + nFree; i++) {
    const onBus = i < nBus
    const poly = onBus ? polys[i % lanes] : polys[lanes + Math.floor(rand() * (polys.length - lanes))]
    pulses.push({
      poly,
      speed: onBus ? 24 + rand() * 22 : (7 + rand() * 15) * (rand() < 0.3 ? -1 : 1),
      off: rand() * poly.total,
      tail: onBus ? 5.5 : 2.4,
    })
  }
  const dashPos = new Float32Array(pulses.length * 6)
  const headPos = new Float32Array(pulses.length * 3)
  const dashGeo = keep(new BufferGeometry())
  dashGeo.setAttribute('position', new BufferAttribute(dashPos, 3))
  const headGeo = keep(new BufferGeometry())
  headGeo.setAttribute('position', new BufferAttribute(headPos, 3))
  const dashes = new LineSegments(dashGeo, lineMat(AMBER_BR, 1))
  const heads = new Points(headGeo, glowMat(1.7, { color: AMBER_BR, opacity: 0.9 }))
  dashes.frustumCulled = false
  heads.frustumCulled = false
  scene.add(dashes, heads)

  const movePulses = (time) => {
    for (let i = 0; i < pulses.length; i++) {
      const p = pulses[i]
      const total = p.poly.total
      const s = (((p.off + p.speed * time) % total) + total) % total
      pointAt(p.poly, s, dashPos, i * 6)
      pointAt(p.poly, s - Math.sign(p.speed) * p.tail, dashPos, i * 6 + 3)
      headPos[i * 3] = dashPos[i * 6]
      headPos[i * 3 + 1] = dashPos[i * 6 + 1] + 0.05
      headPos[i * 3 + 2] = dashPos[i * 6 + 2]
    }
    dashGeo.attributes.position.needsUpdate = true
    headGeo.attributes.position.needsUpdate = true
  }

  /* ── launch tunnel: rebuilt whenever the page layout (so the journey) changes ── */
  const coilGeo = geoOf(coilPoints())
  const COILS = 10
  const coilMats = []
  for (let i = 0; i < COILS; i++) coilMats.push(lineMat(AMBER, 0.3))
  const railMat = lineMat(AMBER, 0.75)
  let tunnel = null // { group, railGeo, ts: [t of each coil], tA, tB }
  const clearTunnel = () => {
    if (!tunnel) return
    scene.remove(tunnel.group)
    tunnel.railGeo.dispose()
    tunnel = null
  }
  const buildTunnel = (sA, sB, tOf, height) => {
    clearTunnel()
    const group = new Group()
    const ts = []
    for (let i = 0; i < COILS; i++) {
      const s = lerp(sA, sB, (i + 0.5) / COILS)
      const t = tOf(s)
      const ring = new LineSegments(coilGeo, coilMats[i])
      ring.position.set(pathX(t), height(s) + 0.25, pathZ(t))
      ring.rotation.y = Math.atan2(pathX(t + 0.002) - pathX(t - 0.002), -0.004 * LEN)
      ring.frustumCulled = false
      group.add(ring)
      ts.push(t)
    }
    // the two rails the "projectile" rides between
    const rails = []
    const tA = tOf(sA), tB = tOf(sB)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 60; i++) {
        const s0 = lerp(sA, sB, i / 60), s1 = lerp(sA, sB, (i + 1) / 60)
        const t0 = tOf(s0), t1 = tOf(s1)
        rails.push(
          pathX(t0) + side * 1.7, height(s0) - 2.3, pathZ(t0),
          pathX(t1) + side * 1.7, height(s1) - 2.3, pathZ(t1),
        )
      }
    }
    const railGeo = new BufferGeometry()
    railGeo.setAttribute('position', new Float32BufferAttribute(rails, 3))
    const railLines = new LineSegments(railGeo, railMat)
    railLines.frustumCulled = false
    group.add(railLines)
    scene.add(group)
    tunnel = { group, railGeo, ts, tA, tB }
  }
  const fireCoils = (tCam, time) => {
    if (!tunnel) return
    const inside = tCam > tunnel.tA - 0.03 && tCam < tunnel.tB + 0.01
    const wave = ((time * 13) % (COILS + 5)) - 2 // a firing sequence that runs down the barrel
    for (let i = 0; i < COILS; i++) {
      const d = (tunnel.ts[i] - tCam) * LEN
      const near = Math.exp(-(d * d) / 60)
      const chase = inside ? Math.exp(-((i - wave) * (i - wave)) / 0.7) * 0.8 : 0
      coilMats[i].opacity = 0.2 + 0.8 * Math.max(near, chase)
    }
  }

  /* ── the journey: scroll position → camera pose ── */
  let journey = null
  function setJourney({ a1, about, i0, i1, projects, education, a5, end, vh }) {
    const launch = i0 != null && i1 - i0 > vh * 0.3
    const sA = launch ? i0 - 0.42 * vh : 0
    const sB = launch ? i1 - 0.62 * vh : 0
    // distance covered per scrolled pixel: steady, except down the launch tunnel
    const weight = launch
      ? track([[i0 - 0.62 * vh, 1], [i0 - 0.3 * vh, 2.8], [i1 - 0.72 * vh, 2.8], [i1 - 0.42 * vh, 1]])
      : () => 1
    const N = 480
    const cum = new Float32Array(N + 1)
    for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + weight(a1 + ((a5 - a1) * (i - 0.5)) / N)
    const tOf = (s) => {
      const f = clamp01((s - a1) / (a5 - a1)) * N
      const i = Math.min(Math.floor(f), N - 1)
      return (cum[i] + (cum[i + 1] - cum[i]) * (f - i)) / cum[N]
    }
    // ── the shot list. Each entry is a camera set-up at a scroll position:
    //    y     height above the board
    //    drop  how far below its own height the camera looks (tilt down)
    //    side  sideways offset from the bus, aim: the same for the look target
    //    lead  how far ahead along the bus it looks
    //    lens  change in field of view (negative = longer lens)
    //    The camera eases from one set-up to the next as you scroll. Low shots
    //    stay within 3.6 of the bus (the lane the board keeps clear); wider
    //    ones only happen above the tallest ordinary part.
    const BASE = { y: 3.2, drop: 1, side: 0, aim: 0, lead: 0.055, lens: 0 }
    const shots = []
    const shot = (s, v) => shots.push([s, { ...BASE, ...v }])

    shot(a1, { y: 3.2, drop: 0.9 }) // touchdown: level, on the bus

    // profile: a low tracking shot. Starts left of the bus looking across it,
    // so the pulses race through the foreground, and dollies over to the right
    const profileEnd = launch ? sA - 0.5 * vh : projects - 0.6 * vh
    shot(about + 0.2 * vh, { y: 2.3, drop: 0.45, side: -3.6, aim: 2.6, lens: 5 })
    shot(profileEnd, { y: 3, drop: 0.7, side: 3.2, aim: -2.4, lens: 3 })

    if (launch) {
      // push in: straighten up on the bus and go down the barrel
      shot(sA - 0.2 * vh, { y: 4.4, drop: 0.5 })
      shot(sB, { y: 4.6, drop: 0.4 })
    }

    // projects: one set-up per project step (the scene steps every 0.55 screens)
    const p0 = projects + 0.3 * vh
    const step = 0.55 * vh
    shot(p0 + step * 0.5, { y: 8.5, drop: 6, side: 8.5, aim: -3, lens: -4 })  // high three-quarter view from the right
    shot(p0 + step * 1.5, { y: 2.6, drop: 0.3, side: -3.6, aim: 3, lens: 6 }) // down low on the left, wide
    shot(p0 + step * 2.5, { y: 17, drop: 15, lead: 0.03, lens: -6 })          // crane up: straight down on the copper
    shot(p0 + step * 3.5, { y: 3.2, drop: 0.8, side: 3.4, aim: -2, lens: 2 }) // back down, other side

    // the rest of the list: a slow low glide, so the final climb starts from the floor
    const glide = Math.min(p0 + step * 5.2, a5 - 0.6 * vh)
    if (glide > p0 + step * 3.5 + 0.3 * vh) shot(glide, { y: 3.4, drop: 1, side: -2.2, aim: 1.2 })
    shot(a5, { y: 3, drop: 1.2 })

    const along = (key) => track(shots.map(([s, v]) => [s, v[key]]))
    const height = along('y')
    const drop = along('drop')
    const side = along('side')
    const aim = along('aim')
    const lead = along('lead')
    const lens = along('lens')

    // letterbox: bars close in while the world has the screen to itself
    const barKeys = [[0, 0]]
    if (a1 > vh * 1.2) barKeys.push([a1 * 0.4, 0], [a1 * 0.58, 1], [a1 - 0.36 * vh, 1], [a1 - 0.06 * vh, 0])
    if (launch) barKeys.push([i0 - 0.5 * vh, 0], [i0 - 0.2 * vh, 1], [i1 - 0.5 * vh, 1], [i1 - 0.2 * vh, 0])
    barKeys.push([end, 0])
    const glowKeys = [[0, 0.34], [a1 * 0.3, 0.42], [a1 * 0.85, 1], [about - 0.45 * vh, 1], [about + 0.1 * vh, 0.5]]
    if (launch) glowKeys.push([i0 - 0.8 * vh, 0.5], [i0 - 0.35 * vh, 1], [i1 - 0.72 * vh, 1], [i1 - 0.3 * vh, 0.5])
    glowKeys.push([a5 + 0.1 * vh, 0.5], [a5 + 0.8 * vh, 0.9], [end, 1])

    journey = {
      a1, a5, end: Math.max(end, a5 + 1), tOf, weight,
      // cruise speed (bus distance per scrolled pixel) at touchdown and at lift-off
      rateIn: tOf(a1 + 4) / 4, rateOut: (1 - tOf(a5 - 4)) / 4,
      height, drop, side, aim, lead, lens,
      glow: track(glowKeys), bars: track(barKeys),
    }
    if (launch) buildTunnel(sA, sB, tOf, height)
    else clearTunnel()
  }
  const vh0 = window.innerHeight
  setJourney({ a1: vh0 * 1.6, about: vh0 * 2.2, projects: vh0 * 6, education: vh0 * 10, a5: vh0 * 11, end: vh0 * 12.5, vh: vh0 })

  const P = new Vector3(), T = new Vector3(), A = new Vector3(), B = new Vector3()
  // camera on the bus at `t`, with the current shot's offsets applied
  const view = { y: 0, drop: 0, side: 0, aim: 0, lead: 0.055 }
  const cruise = (t, pos, look) => {
    pos.set(pathX(t) + view.side, view.y, pathZ(t))
    look.set(pathX(t + view.lead) + view.aim, view.y - view.drop, pathZ(t + view.lead))
  }
  let roll = 0
  let tCam = 0
  // lean into the bends of the bus
  const bank = (t) => -((pathX(t + 0.004) - pathX(t - 0.004)) / (0.008 * LEN)) * 0.55
  function pose(s) {
    const j = journey
    view.y = j.height(s)
    view.drop = j.drop(s)
    view.side = j.side(s)
    view.aim = j.aim(s)
    view.lead = j.lead(s)
    if (s < j.a1) {
      // descent: from a map view high above, down to the surface. The point it
      // is heading for is already travelling along the bus at cruise speed
      // (t runs negative before touchdown), so the camera lands rolling and
      // hands over to the cruise with no stop and no jump.
      const e = clamp01(s / j.a1)
      const h = smoother(e)
      tCam = (s - j.a1) * j.rateIn
      cruise(tCam, A, B)
      P.set(lerp(14, A.x, h), lerp(178, A.y, h), lerp(Z0 + 62, A.z, h))
      const k = smooth(clamp01((e - 0.3) / 0.7))
      T.set(lerp(0, B.x, k), lerp(0, B.y, k), lerp(Z0 - 8, B.z, k))
      roll = (1 - h) * 0.55 + h * bank(tCam)
    } else if (s < j.a5) {
      tCam = j.tOf(s)
      cruise(tCam, P, T)
      roll = bank(tCam)
    } else {
      // ascent: climb away until the board is a map again. Same idea in
      // reverse: it keeps travelling forward as it lifts off.
      const e = clamp01((s - j.a5) / (j.end - j.a5))
      const h = smoother(e)
      tCam = 1 + (s - j.a5) * j.rateOut
      cruise(tCam, A, B)
      P.set(lerp(A.x, 0, h), lerp(A.y, 132, h), A.z - 24 * h)
      T.set(lerp(B.x, 0, h), lerp(B.y, 0, h), lerp(B.z, P.z - 52, h))
      roll = (1 - h) * bank(tCam) + h * 0.42
    }
  }

  /* ── energy: power-on wave and ripples ── */
  let powerT = null // seconds since power-on (starts slightly negative: a short delay); null = still dark
  let powered = false
  const ripples = [0, 1, 2, 3].map(() => ({ age: 99, strength: 0 }))
  let nextRipple = 0
  const ripple = (x, z, strength = 1) => {
    const i = nextRipple
    nextRipple = (nextRipple + 1) % ripples.length
    ripples[i].age = 0
    ripples[i].strength = strength
    energy.uRipples.value[i].set(x, z, 0, strength)
  }
  const stepEnergy = (dt) => {
    if (powerT !== null && !powered) {
      powerT += dt
      const R = powerT > 0 ? 70 * powerT + 45 * powerT * powerT : 0
      if (R > 1500) { powered = true; energy.uReveal.value = 1e6 }
      else energy.uReveal.value = R
    }
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i]
      const u = energy.uRipples.value[i]
      if (r.age > 4) { u.w = 0; continue }
      r.age += dt
      u.z = r.age * 58
      u.w = r.strength * Math.exp(-r.age * 1.15)
    }
    energy.uCam.value.copy(camera.position)
  }
  // where a ray from the camera through a screen point meets the board
  const ray = new Vector3()
  const groundAt = (nx, ny, out) => {
    ray.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize()
    const reach = ray.y < -0.02 ? Math.min(-camera.position.y / ray.y, 170) : 60
    out.copy(camera.position).addScaledVector(ray, reach)
    return out
  }
  const hit = new Vector3()

  /* ── loop ── */
  let raf = 0
  let running = false
  let last = 0
  let time = 0
  let sSmooth = -1
  let sPrev = 0
  let boost = 0
  let px = 0, py = 0, pxS = 0, pyS = 0
  let shown = -1
  let baseFov = 52
  let barsShown = -1
  // quality governor: average frame time, checked every couple of seconds
  let frameAvg = 0.016
  let frames = 0
  let level = 0 // 0 full, 1 lower resolution, 2 no bloom, 3 lower resolution again
  let bloomOut = false
  let bloomFade = 1

  const frame = (now) => {
    if (!running) return
    raf = requestAnimationFrame(frame)
    const gap = (now - last) / 1000
    const dt = Math.min(gap, 0.05)
    last = now
    time += dt

    const s = window.scrollY
    // first frame, or back from a long pause: jump, don't replay stale motion
    if (sSmooth < 0 || gap > 0.25) { sSmooth = s; sPrev = s }
    sSmooth += (s - sSmooth) * (1 - Math.exp(-dt * 7))
    const speed = Math.abs(s - sPrev) / Math.max(dt, 0.001)
    sPrev = s
    boost += (Math.min(speed / 260, 13) - boost) * (1 - Math.exp(-dt * 4))
    pxS += (px - pxS) * (1 - Math.exp(-dt * 3))
    pyS += (py - pyS) * (1 - Math.exp(-dt * 3))

    pose(sSmooth)
    const loft = 1 + P.y * 0.04
    P.x += (Math.sin(time * 0.23) * 0.35 + pxS * 1.5) * loft
    P.y += (Math.sin(time * 0.31) * 0.16 - pyS * 0.5) * loft
    T.x += pxS * 4
    T.y -= pyS * 1.6

    camera.position.copy(P)
    camera.lookAt(T)
    camera.rotateZ(roll + Math.sin(time * 0.17) * 0.012)
    // the view widens with scroll speed, and again down the launch tunnel
    const fov = baseFov + boost + (journey.weight(sSmooth) - 1) * 5 + journey.lens(sSmooth)
    if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix() }

    scene.fog.far = 150 + P.y * 1.7
    scene.fog.near = scene.fog.far * 0.22

    const glowNow = journey.glow(sSmooth)
    if (Math.abs(glowNow - shown) > 0.004) { shown = glowNow; canvas.style.opacity = glowNow.toFixed(3) }
    if (bars) {
      const b = journey.bars(sSmooth)
      if (Math.abs(b - barsShown) > 0.003) { barsShown = b; bars.style.setProperty('--bars', b.toFixed(3)) }
    }

    stepEnergy(dt)
    fireCoils(tCam, time)
    blink(time)
    movePulses(time)

    sky.position.copy(camera.position)
    // haze belongs to the low flight; from high above there is no horizon in view
    sky.material.uniforms.uHaze.value = 0.085 * (1 - smooth(clamp01((P.y - 20) / 80)))
    if (halo && useBloom) {
      // seen from above the copper is dense, so ease the glow off up there
      if (bloomOut) {
        bloomFade = Math.max(0, bloomFade - dt / 1.2)
        if (bloomFade === 0) useBloom = false
      }
      halo.render(scene, camera, lerp(0.42, 0.27, smooth(clamp01((P.y - 10) / 110))) * bloomFade)
    } else {
      renderer.render(scene, camera)
    }

    if (gap < 0.25 && time > 3) {
      frameAvg += (gap - frameAvg) * 0.04
      if (++frames >= 90) {
        frames = 0
        // aim for a steady 50 or more frames a second, shedding one thing at
        // a time: sharpness first, then the glow, then resolution again
        const slow = frameAvg > (level < 2 ? 0.021 : 0.028)
        if (slow && level < 3) {
          level += 1
          frameAvg = 0.016
          if (level === 1) { renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 1)); resize() }
          else if (level === 2) bloomOut = true // fades over a second, then the pass is dropped
          else { renderer.setPixelRatio(0.75); resize() }
        }
      }
    }
  }

  // requestAnimationFrame already idles in a hidden tab, so no visibility gate
  const start = () => {
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    halo?.resize()
    camera.aspect = w / h
    baseFov = camera.aspect < 1 ? 64 : 52
    camera.fov = baseFov + boost
    camera.updateProjectionMatrix()
  }
  const onPointer = (e) => {
    if (e.pointerType !== 'mouse') return
    px = e.clientX / window.innerWidth - 0.5
    py = e.clientY / window.innerHeight - 0.5
  }
  // a click or tap sends a ripple of light out from that spot on the board
  const onDown = (e) => {
    if (!powered && (powerT === null || powerT < 0.6)) return
    groundAt((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1, hit)
    ripple(hit.x, hit.z, 1)
  }
  // the page can ask for one too (project changes do): it starts ahead of the camera
  const onRipple = () => {
    groundAt(0, -0.25, hit)
    ripple(hit.x, hit.z, 0.9)
  }

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('pointerdown', onDown, { passive: true })
  window.addEventListener('world:ripple', onRipple)
  resize()
  start()

  return {
    setJourney,
    // light the board: a wave spreads out from under the hero
    // (`instant` skips the wave; a dev aid for checking the lit board)
    power(instant = false) {
      if (instant) { powered = true; powerT = 9; energy.uReveal.value = 1e6 }
      else if (powerT === null) powerT = -0.55
    },
    // dev aid: the camera pose for any scroll position (no smoothing, no render)
    probe: (s) => { pose(s); return { x: P.x, y: P.y, z: P.z, roll, lookY: T.y } },
    // dev aid: where the camera is right now
    state: () => ({
      x: P.x, y: P.y, z: P.z, t: tCam, scroll: sSmooth, glow: shown, reveal: energy.uReveal.value,
      a1: journey.a1, a5: journey.a5, end: journey.end, bloom: !!(halo && useBloom), level, gpu, frameMs: Math.round(frameAvg * 1000), tunnel: tunnel ? [tunnel.tA, tunnel.tB] : null,
    }),
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('world:ripple', onRipple)
      clearTunnel()
      trash.forEach((x) => x.dispose())
      halo?.dispose()
      renderer.dispose()
    },
  }
}
