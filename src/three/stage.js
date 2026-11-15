import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, LineSegments, EdgesGeometry,
  BoxGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, BufferGeometry,
  Float32BufferAttribute, LineBasicMaterial, MeshBasicMaterial, Vector3, Vector2,
  WebGLRenderTarget, HalfFloatType,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/**
 * Procedural "technical illustration" miniatures: dark filled faces that hide
 * back edges, 1px edge lines on top, amber for the live parts. No model files,
 * no lights. Loaded lazily, so three.js never blocks first paint.
 */
const AMBER = 0xffb020
const COOL = 0x93a7ab

/* ── per-stage material / geometry kit (so one dispose() frees everything) ── */
function makeKit(fillColor) {
  const mats = []
  const geos = []
  const keep = (m) => { mats.push(m); return m }
  const fill = keep(new MeshBasicMaterial({
    color: fillColor, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  }))
  return {
    line: (color, opacity = 1) => keep(new LineBasicMaterial({ color, transparent: true, opacity })),
    solid: (color, opacity = 1) => keep(new MeshBasicMaterial({ color, transparent: true, opacity })),
    part(geo, mat, threshold = 18) {
      const g = new Group()
      const edges = new EdgesGeometry(geo, threshold)
      geos.push(geo, edges)
      g.add(new Mesh(geo, fill))
      g.add(new LineSegments(edges, mat))
      return g
    },
    mesh(geo, mat) { geos.push(geo); return new Mesh(geo, mat) },
    lines(points, mat) {
      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(points, 3))
      geos.push(geo)
      return new LineSegments(geo, mat)
    },
    dispose() { mats.forEach((m) => m.dispose()); geos.forEach((g) => g.dispose()) },
  }
}

const place = (parent, obj, x = 0, y = 0, z = 0) => { obj.position.set(x, y, z); parent.add(obj); return obj }

function along(path, u, out) {
  const n = path.length - 1
  const f = Math.min(Math.max(u, 0), 0.9999) * n
  const i = Math.floor(f)
  const a = path[i], b = path[i + 1], k = f - i
  out.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k)
}

/* ── STM32-style development board. `p` (0..1) is scroll progress through the
      profile scene: the parts lift off the board mid-way, then settle back. ── */
function buildMcu(k) {
  const g = new Group()
  const cool = k.line(COOL, 0.8)
  const dim = k.line(COOL, 0.34)
  const amber = k.line(AMBER, 1)
  const amberDim = k.line(AMBER, 0.42)
  const top = 0.035
  const cx = 0.25

  const lifted = []
  const lift = (obj, amount) => { lifted.push({ obj, y: obj.position.y, amount }); return obj }

  place(g, k.part(new BoxGeometry(3.4, 0.07, 2.2), cool))

  // main MCU with its leads; the fan-out traces stay on the board
  const chip = new Group()
  place(chip, k.part(new BoxGeometry(0.86, 0.1, 0.86), amber), cx, top + 0.05, 0)
  const pins = []
  const traces = []
  let pulsePath = null
  const y = top + 0.004
  for (let i = 0; i < 9; i++) {
    const o = -0.36 + i * 0.09
    pins.push(cx + 0.43, top + 0.02, o, cx + 0.54, top + 0.02, o)
    pins.push(cx - 0.43, top + 0.02, o, cx - 0.54, top + 0.02, o)
    for (const s of [1, -1]) {
      pins.push(cx + o, top + 0.02, s * 0.43, cx + o, top + 0.02, s * 0.54)
      const x0 = cx + o, x1 = cx + o * 2.6
      const a = [x0, y, s * 0.54], b = [x0, y, s * 0.62], c = [x1, y, s * 0.78], d = [x1, y, s * 0.88]
      traces.push(...a, ...b, ...b, ...c, ...c, ...d)
      if (s === 1 && i === 7) pulsePath = [a, b, c, d]
    }
  }
  chip.add(k.lines(pins, amberDim))
  g.add(chip)
  lift(chip, 1.0)
  g.add(k.lines(traces, amberDim))

  // pin headers with their pin stubs
  for (const z of [-0.95, 0.95]) {
    const header = new Group()
    place(header, k.part(new BoxGeometry(2.9, 0.16, 0.14), cool), 0.1, top + 0.08, z)
    const stubs = []
    for (let i = 0; i < 19; i++) {
      const x = -1.25 + i * 0.15
      stubs.push(x, top + 0.16, z, x, top + 0.36, z)
    }
    header.add(k.lines(stubs, dim))
    g.add(header)
    lift(header, 0.46)
  }

  lift(place(g, k.part(new BoxGeometry(0.46, 0.2, 0.5), cool), -1.52, top + 0.1, 0), 0.8)          // USB
  lift(place(g, k.part(new BoxGeometry(0.44, 0.07, 0.44), cool), -0.82, top + 0.035, 0.1), 0.62)   // debug MCU
  lift(place(g, k.part(new BoxGeometry(0.14, 0.1, 0.3), cool), -0.42, top + 0.05, 0.1), 0.42)      // crystal
  lift(place(g, k.part(new CylinderGeometry(0.09, 0.09, 0.09, 14), cool), 1.38, top + 0.045, 0.52), 0.52) // button
  const passives = [[-0.42, -0.3], [-0.42, -0.45], [-1.15, 0.55], [-1.0, 0.55], [-1.15, -0.55], [-1.0, -0.55], [1.3, 0.1], [1.3, -0.1]]
  passives.forEach(([x, z], i) =>
    lift(place(g, k.part(new BoxGeometry(0.1, 0.05, 0.06), dim), x, top + 0.025, z), 0.24 + (i % 3) * 0.08))

  const led = lift(place(g, k.mesh(new BoxGeometry(0.1, 0.05, 0.07), k.solid(AMBER, 1)), 1.38, top + 0.025, -0.52), 0.36)
  const pulse = place(g, k.mesh(new SphereGeometry(0.035, 10, 8), k.solid(AMBER, 1)))

  g.scale.setScalar(0.86)
  return {
    group: g,
    update(t, p = 0) {
      const e = Math.sin(Math.PI * Math.min(Math.max(p, 0), 1))
      const spread = e * e * (3 - 2 * e)
      for (const it of lifted) it.obj.position.y = it.y + it.amount * spread
      led.material.opacity = Math.sin(t * 3.2) > 0.1 ? 1 : 0.18
      along(pulsePath, (t * 0.55) % 1, pulse.position)
    },
  }
}

/* ── Electromagnetic rail launcher ── */
function buildRail(k) {
  const g = new Group()
  const cool = k.line(COOL, 0.8)
  const dim = k.line(COOL, 0.34)

  place(g, k.part(new BoxGeometry(3.9, 0.06, 1.3), dim), 0, -0.52, 0)
  for (const x of [-1.62, 1.62]) place(g, k.part(new BoxGeometry(0.1, 0.5, 0.86), cool), x, -0.24, 0)
  for (const z of [-0.15, 0.15]) place(g, k.part(new BoxGeometry(3.5, 0.07, 0.09), cool), 0, 0, z)

  const coils = []
  for (let i = 0; i < 5; i++) {
    const mat = k.line(AMBER, 0.5)
    const coil = place(g, k.part(new TorusGeometry(0.36, 0.075, 6, 22), mat, 1), -1.2 + i * 0.6, 0, 0)
    coil.rotation.y = Math.PI / 2
    coils.push({ x: coil.position.x, mat })
  }

  // capacitor bank + feed lines to the coils
  const feeds = []
  for (let i = 0; i < 4; i++) {
    const x = -1.35 + i * 0.4
    place(g, k.part(new CylinderGeometry(0.15, 0.15, 0.44, 16), cool), x, -0.27, 0.42)
    feeds.push(x, -0.05, 0.42, x, -0.05, 0.2)
  }
  g.add(k.lines(feeds, dim))

  const shot = place(g, k.mesh(new BoxGeometry(0.3, 0.11, 0.11), k.solid(AMBER, 1)))

  g.scale.setScalar(0.84)
  return {
    group: g,
    update(t) {
      const c = (t % 2.8) / 2.8
      const firing = c < 0.72
      const u = firing ? Math.pow(c / 0.72, 2.2) : 0
      const x = -1.75 + u * 3.9
      shot.visible = firing
      shot.position.set(x, 0, 0)
      for (const coil of coils) {
        const d = x - coil.x
        coil.mat.opacity = 0.38 + (firing ? 0.62 * Math.exp(-(d * d) / 0.06) : 0)
      }
    },
  }
}

/* ── Vehicle-to-vehicle visible-light link ── */
function buildV2V(k) {
  const g = new Group()
  const cool = k.line(COOL, 0.8)
  const dim = k.line(COOL, 0.3)
  const amberDim = k.line(AMBER, 0.28)

  const car = (x) => {
    const c = new Group()
    place(c, k.part(new BoxGeometry(1.3, 0.26, 0.62), cool), 0, 0.24, 0)
    place(c, k.part(new BoxGeometry(0.66, 0.22, 0.54), cool), -0.1, 0.48, 0)
    for (const wx of [-0.42, 0.42]) for (const wz of [-0.32, 0.32]) {
      const w = place(c, k.part(new CylinderGeometry(0.13, 0.13, 0.08, 14), cool), wx, 0.13, wz)
      w.rotation.x = Math.PI / 2
    }
    return place(g, c, x, 0, 0)
  }
  car(-1.45)
  car(1.45)

  // road edges + dashed centre line
  const road = [-2.3, 0, -0.62, 2.3, 0, -0.62, -2.3, 0, 0.62, 2.3, 0, 0.62]
  for (let x = -2.2; x < 2.2; x += 0.5) road.push(x, 0, 0, x + 0.24, 0, 0)
  g.add(k.lines(road, dim))

  // light path: emitter on the lead car's front, photodiode on the follower's rear
  const x0 = -0.78, x1 = 0.78, y = 0.26
  g.add(k.lines([x0, y, -0.2, x1, y, -0.06, x0, y, 0.2, x1, y, 0.06], amberDim))
  const lamp = place(g, k.mesh(new BoxGeometry(0.05, 0.1, 0.44), k.solid(AMBER, 1)), x0 - 0.02, y, 0)
  place(g, k.part(new BoxGeometry(0.05, 0.14, 0.2), k.line(AMBER, 0.9)), x1 + 0.02, y, 0)

  // Manchester-coded bit slabs travelling down the beam
  const pattern = [1, 0, 1, 1, 0, 1, 0, 0, 1, 0]
  const bits = pattern.map(() => place(g, k.mesh(new BoxGeometry(0.06, 0.1, 0.24), k.solid(AMBER, 1))))

  g.scale.setScalar(0.78)
  return {
    group: g,
    update(t) {
      const flow = t * 0.32
      bits.forEach((bit, i) => {
        const u = (flow + i / bits.length) % 1
        bit.position.set(x0 + 0.08 + u * (x1 - x0 - 0.16), y, 0)
        bit.scale.z = 1 - u * 0.55
        bit.material.opacity = pattern[i] ? 0.95 : 0.14
      })
      lamp.material.opacity = pattern[Math.floor(flow * pattern.length) % pattern.length] ? 1 : 0.3
    },
  }
}

/* ── Automotive IoT hub with eight peripherals ── */
function buildIot(k) {
  const g = new Group()
  const cool = k.line(COOL, 0.8)
  const dim = k.line(COOL, 0.3)
  const amber = k.line(AMBER, 1)
  const top = 0.035

  place(g, k.part(new BoxGeometry(1.5, 0.07, 1.0), cool))
  place(g, k.part(new BoxGeometry(0.62, 0.09, 0.44), amber), -0.2, top + 0.045, 0)

  // PCB meander antenna
  const ant = []
  for (let i = 0; i < 6; i++) {
    const z = -0.3 + i * 0.12
    const xa = i % 2 ? 0.62 : 0.4, xb = i % 2 ? 0.4 : 0.62
    ant.push(xa, top + 0.004, z, xb, top + 0.004, z, xb, top + 0.004, z, xb, top + 0.004, z + 0.12)
  }
  g.add(k.lines(ant, k.line(AMBER, 0.5)))

  // radiating arcs above the antenna
  const arcs = [0.34, 0.54, 0.74].map((r) => {
    const pts = []
    const steps = 14
    for (let i = 0; i < steps; i++) {
      const a0 = (55 + (70 * i) / steps) * (Math.PI / 180)
      const a1 = (55 + (70 * (i + 1)) / steps) * (Math.PI / 180)
      pts.push(0.5 + r * Math.cos(a0), top + r * Math.sin(a0), 0, 0.5 + r * Math.cos(a1), top + r * Math.sin(a1), 0)
    }
    const mat = k.line(AMBER, 0.3)
    g.add(k.lines(pts, mat))
    return mat
  })

  // eight peripherals on a ring, each with a link and a travelling packet
  const links = []
  const packets = []
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    const nx = Math.cos(a) * 1.72, nz = Math.sin(a) * 1.5
    const geo = i % 2 ? new CylinderGeometry(0.11, 0.11, 0.14, 12) : new BoxGeometry(0.24, 0.12, 0.24)
    place(g, k.part(geo, cool), nx, top + 0.03, nz)
    const hx = Math.cos(a) * 0.72, hz = Math.sin(a) * 0.5
    links.push(nx, top, nz, hx, top, hz)
    packets.push({
      path: [[nx, top + 0.02, nz], [hx, top + 0.02, hz]],
      dot: place(g, k.mesh(new SphereGeometry(0.036, 10, 8), k.solid(AMBER, 1))),
      offset: (i * 0.37) % 1,
    })
  }
  g.add(k.lines(links, dim))

  g.scale.setScalar(0.9)
  return {
    group: g,
    update(t) {
      packets.forEach((p) => {
        const u = (t * 0.45 + p.offset) % 1
        along(p.path, u, p.dot.position)
        p.dot.material.opacity = Math.sin(u * Math.PI)
      })
      arcs.forEach((mat, i) => {
        const ph = (t * 0.9 - i * 0.22) % 1
        mat.opacity = 0.16 + 0.7 * Math.max(0, 1 - Math.abs(((ph + 1) % 1) - 0.3) * 3.2)
      })
    },
  }
}

/* ── Buck converter board: the thesis subject. The amber loop is the
      commutation loop (input cap, switch, diode) whose area the layout sets;
      the faint outline is the same loop on a deliberately poor layout. ── */
function buildBuck(k) {
  const g = new Group()
  const cool = k.line(COOL, 0.8)
  const dim = k.line(COOL, 0.34)
  const amber = k.line(AMBER, 1)
  const top = 0.035
  const y = top + 0.004

  place(g, k.part(new BoxGeometry(3.4, 0.07, 2.4), cool))

  // converter IC (SO-20) with its two rows of leads
  place(g, k.part(new BoxGeometry(0.64, 0.12, 0.38), amber), -0.15, top + 0.06, -0.1)
  const leads = []
  for (let i = 0; i < 10; i++) {
    const x = -0.15 - 0.27 + i * 0.06
    leads.push(x, top + 0.02, 0.09, x, top + 0.02, 0.17, x, top + 0.02, -0.29, x, top + 0.02, -0.37)
  }
  g.add(k.lines(leads, k.line(AMBER, 0.42)))

  place(g, k.part(new BoxGeometry(0.62, 0.32, 0.62), cool), 0.72, top + 0.16, -0.1)      // power inductor
  place(g, k.part(new BoxGeometry(0.35, 0.12, 0.3), cool), 0.02, top + 0.06, 0.46)       // Schottky diode
  place(g, k.part(new BoxGeometry(0.16, 0.08, 0.12), cool), -0.5, top + 0.04, 0.46)      // ceramic input cap
  for (const [x, z] of [[-0.82, -0.72], [-0.36, -0.78]])                                  // input electrolytics
    place(g, k.part(new CylinderGeometry(0.2, 0.2, 0.52, 18), cool), x, top + 0.26, z)
  for (const z of [-0.36, 0.36])                                                          // output electrolytics
    place(g, k.part(new CylinderGeometry(0.2, 0.2, 0.52, 18), cool), 1.28, top + 0.26, z)
  for (const z of [-0.36, 0.36])                                                          // input-filter inductors
    place(g, k.part(new BoxGeometry(0.36, 0.14, 0.33), cool), -1.2, top + 0.07, z)
  for (const x of [-1.56, 1.56])                                                          // terminals
    place(g, k.part(new BoxGeometry(0.2, 0.22, 0.52), dim), x, top + 0.11, 0)
  const small = [[0.3, -0.62], [0.46, -0.62], [0.3, 0.86], [-0.02, -0.62], [0.7, 0.62], [0.86, 0.62]]
  small.forEach(([x, z]) => place(g, k.part(new BoxGeometry(0.1, 0.05, 0.06), dim), x, top + 0.025, z))

  // power path: terminal -> filter -> IC, switch node -> inductor -> output
  g.add(k.lines([
    -1.46, y, -0.36, -1.38, y, -0.36, -1.02, y, -0.36, -0.82, y, -0.36,
    -1.46, y, 0.36, -1.38, y, 0.36,
    0.17, y, -0.1, 0.41, y, -0.1, 1.03, y, -0.1, 1.28, y, -0.1, 1.28, y, -0.1, 1.46, y, -0.1,
  ], dim))

  const loop = (x0, x1, z0, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [x0, y, z0]]
  const segs = (path) => path.slice(0, -1).flatMap((a, i) => [...a, ...path[i + 1]])
  const tight = loop(-0.5, 0.02, 0.2, 0.6)
  const tightMat = k.line(AMBER, 1)
  g.add(k.lines(segs(tight), tightMat))
  g.add(k.lines(segs(loop(-0.95, 0.34, 0.2, 1.05)), k.line(AMBER, 0.22)))
  const pulse = place(g, k.mesh(new SphereGeometry(0.038, 10, 8), k.solid(AMBER, 1)))

  g.scale.setScalar(0.84)
  return {
    group: g,
    update(t) {
      along(tight, (t * 1.1) % 1, pulse.position)
      tightMat.opacity = 0.7 + 0.3 * Math.sin(t * 6)
    },
  }
}

const BUILDERS = { mcu: buildMcu, buck: buildBuck, rail: buildRail, v2v: buildV2V, iot: buildIot }

/**
 * createStage — owns one canvas: renderer, camera, the current miniature,
 * drag-to-rotate, and a render loop that only runs while the canvas is on
 * screen, the tab is visible and motion is allowed.
 */
export function createStage(canvas, { kind = 'mcu', reduce = false, fill = 0x070a0c } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(30, 1, 0.1, 60)
  const target = new Vector3(0, -0.05, 0)
  const pivot = new Group()
  scene.add(pivot)

  // bloom: the amber (live) parts glow, matching the world behind the page.
  // The threshold sits above the cool outline colour, so only amber blooms.
  // The canvas stays transparent; the pass carries alpha through.
  const buf = renderer.getDrawingBufferSize(new Vector2())
  const rt = new WebGLRenderTarget(Math.max(buf.x, 2), Math.max(buf.y, 2), { type: HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer, rt)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(buf.x, buf.y), 0.62, 0.45, 0.4)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  // models are built once and kept, so swapping between them costs nothing
  const built = new Map() // kind -> { kit, model }
  const build = (name) => {
    let entry = built.get(name)
    if (!entry) {
      const kit = makeKit(fill)
      entry = { kit, model: (BUILDERS[name] || buildMcu)(kit) }
      built.set(name, entry)
    }
    return entry
  }
  let model = null
  let disposed = false
  const setKind = (next) => {
    if (model) pivot.remove(model.group)
    model = build(next).model
    pivot.add(model.group)
    if (!running) renderOnce()
  }
  // build the others ahead of time, one per idle moment, so the first swap to
  // each is as smooth as the later ones
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 250))
  const preload = (names) => {
    const queue = names.filter((n) => !built.has(n))
    const step = () => {
      const name = queue.shift()
      if (!name || disposed) return
      build(name)
      idle(step)
    }
    idle(step)
  }

  // rotation: a slow sway plus whatever the visitor has dragged
  let userY = -0.62, userX = 0, spin = 0, dragging = false, lastX = 0, lastY = 0
  let progress = 0 // scroll progress handed in by a pinned scene (0 when unused)
  let running = false, visible = false, paused = false, raf = 0
  const clock = { t: 0, last: 0 }

  const draw = () => {
    const sway = reduce ? 0 : Math.sin(clock.t * 0.32) * 0.42
    pivot.rotation.set(userX, userY + sway + progress * Math.PI * 1.1, 0)
    model?.update(reduce ? 0.6 : clock.t, progress)
    composer.render()
  }
  function renderOnce() { if (model) draw() }

  const loop = (now) => {
    if (!running) return
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - clock.last) / 1000, 0.05)
    clock.last = now
    clock.t += dt
    if (!dragging) { userY += spin; spin *= 0.93 }
    draw()
  }
  const sync = () => {
    const should = visible && !paused && !document.hidden && !reduce
    if (should && !running) {
      running = true
      clock.last = performance.now()
      raf = requestAnimationFrame(loop)
    } else if (!should && running) {
      running = false
      cancelAnimationFrame(raf)
    }
  }

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.setSize(w, h)
    camera.aspect = w / h
    // keep the model framed when the canvas is taller than it is wide
    const dist = 6.9 * Math.max(1, 1 / camera.aspect)
    camera.position.set(0, dist * 0.53, dist * 0.85)
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    if (!running) renderOnce()
  }

  const onDown = (e) => {
    dragging = true
    lastX = e.clientX; lastY = e.clientY
    spin = 0
    canvas.setPointerCapture?.(e.pointerId)
    canvas.classList.add('is-grabbing')
  }
  const onMove = (e) => {
    if (!dragging) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    lastX = e.clientX; lastY = e.clientY
    userY += dx * 0.011
    userX = Math.min(0.6, Math.max(-0.45, userX + dy * 0.007))
    spin = dx * 0.011
    if (!running) renderOnce()
  }
  const onUp = () => { dragging = false; canvas.classList.remove('is-grabbing') }

  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  document.addEventListener('visibilitychange', sync)

  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() }, { rootMargin: '80px' })
  io.observe(canvas)

  setKind(kind)
  resize()

  return {
    setKind,
    preload,
    setPaused(next) { paused = next; sync() },
    setProgress(next) { progress = next; if (!running) renderOnce() },
    dispose() {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      disposed = true
      built.forEach((entry) => entry.kit.dispose())
      bloom.dispose()
      composer.dispose()
      rt.dispose()
      renderer.dispose()
    },
  }
}
