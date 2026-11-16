import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * Mind — the backdrop of the Personal page: a slowly turning network of
 * glowing blue nodes on black, the counterpart to the amber board behind the
 * main page.
 *
 * A handful of nodes are "hubs", one per moment of the story, ordered left to
 * right. The parent calls `setActive(i)` as the reader reaches moment i: hubs
 * up to i light, light spreads from each into the nodes around it, a brighter
 * thread joins each hub to the next, and pulses start to travel the lit
 * connections. By the last moment the whole network is alight.
 *
 * Plain 2D canvas: glow comes from additive drawing of a pre-made sprite, so
 * there is no per-frame blur. Under reduced motion it is one still, fully lit
 * frame.
 */
const Mind = forwardRef(function Mind({ hubs = 6 }, ref) {
  const canvasRef = useRef(null)
  const activeRef = useRef(-1)

  useImperativeHandle(ref, () => ({
    setActive(i) { activeRef.current = i },
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // seeded, so it is the same network on every visit
    let seed = 7741
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    }
    const clamp01 = (v) => Math.min(1, Math.max(0, v))

    /* ── the network ── */
    const N = 120
    const nodes = []
    while (nodes.length < N) {
      const x = rand() * 2 - 1, y = rand() * 2 - 1, z = rand() * 2 - 1
      const r = Math.hypot(x, y, z)
      if (r > 1 || r < 0.25) continue
      // wider than tall, with a slight gap down the middle: two soft lobes
      nodes.push({ x: x * 1.25 + Math.sign(x) * 0.1, y: y * 0.85, z: z * 0.9, e: 0, sx: 0, sy: 0, sp: 1, df: 1 })
    }
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

    // hubs: start at the left-most node, then keep taking the node farthest
    // from those already chosen; read left to right, they are the story
    let first = 0
    nodes.forEach((n, i) => { if (n.x < nodes[first].x) first = i })
    const hubIdx = [first]
    while (hubIdx.length < hubs) {
      let best = -1, bestD = -1
      nodes.forEach((n, i) => {
        if (hubIdx.includes(i)) return
        const d = Math.min(...hubIdx.map((h) => dist(n, nodes[h])))
        if (d > bestD) { bestD = d; best = i }
      })
      hubIdx.push(best)
    }
    hubIdx.sort((a, b) => nodes[a].x - nodes[b].x)
    const hubOf = new Map(hubIdx.map((n, h) => [n, h]))
    const toHub = nodes.map((n) => hubIdx.map((h) => dist(n, nodes[h])))

    // connections: every node to its three nearest
    const edges = []
    const adj = nodes.map(() => [])
    const link = (a, b) => {
      if (adj[a].some(([j]) => j === b)) return
      adj[a].push([b, edges.length])
      adj[b].push([a, edges.length])
      edges.push({ a, b, thread: -1 })
    }
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => [dist(n, m), j])
        .filter(([, j]) => j !== i)
        .sort((p, q) => p[0] - q[0])
        .slice(0, 3)
        .forEach(([, j]) => link(i, j))
    })

    // the thread: the shortest chain of connections from each hub to the next
    for (let h = 0; h < hubIdx.length - 1; h++) {
      const from = hubIdx[h], to = hubIdx[h + 1]
      const prev = new Map([[from, null]])
      const queue = [from]
      while (queue.length && !prev.has(to)) {
        const cur = queue.shift()
        for (const [next, edge] of adj[cur]) {
          if (prev.has(next)) continue
          prev.set(next, [cur, edge])
          queue.push(next)
        }
      }
      if (!prev.has(to)) { link(from, to); edges[edges.length - 1].thread = h + 1; continue }
      for (let at = to; prev.get(at); at = prev.get(at)[0]) edges[prev.get(at)[1]].thread = h + 1
    }

    /* ── glow sprites ── */
    const sprite = (inner, mid) => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, inner)
      grad.addColorStop(0.25, mid)
      grad.addColorStop(1, 'rgba(40, 110, 255, 0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      return c
    }
    const glow = sprite('rgba(210, 228, 255, 1)', 'rgba(70, 140, 255, 0.55)')
    const core = sprite('rgba(255, 255, 255, 1)', 'rgba(190, 215, 255, 0.5)')

    /* ── state that eases over time ── */
    const level = hubIdx.map(() => 0) // how lit each hub is, 0..1
    const pulses = []
    let px = 0, py = 0, pxS = 0, pyS = 0
    let w = 0, h = 0, dpr = 1

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = canvas.clientWidth
      h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      if (reduce) frame(0, 0)
    }

    const step = (dt) => {
      const active = reduce ? hubIdx.length - 1 : activeRef.current
      const last = hubIdx.length - 1
      for (let i = 0; i < level.length; i++) {
        const target = i <= active ? 1 : 0
        level[i] = reduce ? target : level[i] + (target - level[i]) * (1 - Math.exp(-dt * 1.6))
      }
      nodes.forEach((n, i) => {
        let target = 0.35 * level[last] // once the story is told, nothing stays dark
        for (let k = 0; k < level.length; k++) {
          const reach = level[k] * 1.15
          if (reach > 0.01) target = Math.max(target, Math.pow(clamp01(1 - toHub[i][k] / reach), 0.8) * level[k])
        }
        n.e = reduce ? target : n.e + (target - n.e) * (1 - Math.exp(-dt * 3))
      })
      // pulses appear on lit connections and run along them
      if (!reduce && pulses.length < 46) {
        const edge = edges[(rand() * edges.length) | 0]
        if (Math.min(nodes[edge.a].e, nodes[edge.b].e) > 0.25) {
          pulses.push({ edge, t: 0, back: rand() < 0.5, speed: 0.6 + rand() * 0.9 })
        }
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        pulses[i].t += dt * pulses[i].speed
        if (pulses[i].t >= 1) pulses.splice(i, 1)
      }
    }

    const frame = (time, dt) => {
      step(dt)
      pxS += (px - pxS) * (1 - Math.exp(-dt * 3))
      pyS += (py - pyS) * (1 - Math.exp(-dt * 3))

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      // beside the text on wide screens; behind it, dimmer, on narrow ones
      const wide = w >= 881
      const cx = wide ? w * 0.7 : w * 0.5
      const cy = wide ? h * 0.5 : h * 0.3
      const scale = wide ? Math.min(w * 0.265, h * 0.48) : Math.min(w * 0.62, h * 0.34)
      const dim = wide ? 1 : 0.55

      const turn = time * 0.07 + pxS * 0.5
      const tilt = 0.2 + pyS * 0.22
      const ca = Math.cos(turn), sa = Math.sin(turn)
      const ct = Math.cos(tilt), st = Math.sin(tilt)
      for (const n of nodes) {
        const x1 = n.x * ca + n.z * sa
        const z1 = -n.x * sa + n.z * ca
        const y1 = n.y * ct - z1 * st
        const z2 = n.y * st + z1 * ct
        n.sp = 1 / (1 + z2 * 0.32)
        n.sx = cx + x1 * scale * n.sp
        n.sy = cy + y1 * scale * n.sp
        n.df = 0.45 + 0.55 * clamp01((1 - z2) / 2) // nearer is brighter
      }

      ctx.lineCap = 'round'
      for (const edge of edges) {
        const a = nodes[edge.a], b = nodes[edge.b]
        const lit = edge.thread > 0 ? level[edge.thread] : 0
        const alpha = ((0.08 + 0.4 * Math.min(a.e, b.e)) * (a.df + b.df) * 0.5 + 0.55 * lit) * dim
        ctx.strokeStyle = `rgba(70, 140, 255, ${alpha.toFixed(3)})`
        ctx.lineWidth = lit > 0.05 ? 1.6 : 1
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        ctx.lineTo(b.sx, b.sy)
        ctx.stroke()
      }

      nodes.forEach((n, i) => {
        const hub = hubOf.get(i)
        if (hub === undefined) {
          const size = (3 + 10 * n.e) * n.sp
          ctx.globalAlpha = (0.28 + 0.72 * n.e) * n.df * dim
          ctx.drawImage(glow, n.sx - size, n.sy - size, size * 2, size * 2)
          return
        }
        const lit = level[hub]
        const size = (9 + 17 * lit + (reduce ? 0 : 2.5 * lit * Math.sin(time * 1.8 + hub))) * n.sp
        ctx.globalAlpha = (0.22 + 0.78 * lit) * dim
        ctx.drawImage(glow, n.sx - size, n.sy - size, size * 2, size * 2)
        const c = size * 0.34
        ctx.globalAlpha = lit * dim
        ctx.drawImage(core, n.sx - c, n.sy - c, c * 2, c * 2)
      })

      for (const p of pulses) {
        const a = nodes[p.edge.a], b = nodes[p.edge.b]
        const k = p.back ? 1 - p.t : p.t
        const x = a.sx + (b.sx - a.sx) * k, y = a.sy + (b.sy - a.sy) * k
        const size = 4.5 * (a.sp + b.sp) * 0.5
        ctx.globalAlpha = 0.9 * Math.min(a.e, b.e) * Math.sin(Math.PI * p.t) * dim
        ctx.drawImage(core, x - size, y - size, size * 2, size * 2)
      }
      ctx.globalAlpha = 1
    }

    const onPointer = (e) => {
      if (e.pointerType !== 'mouse') return
      px = e.clientX / window.innerWidth - 0.5
      py = e.clientY / window.innerHeight - 0.5
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    let raf = 0
    let last = performance.now()
    let time = 0
    const loop = (now) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      time += dt
      frame(time, dt)
    }
    if (!reduce) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointer)
    }
  }, [hubs])

  return <canvas ref={canvasRef} className="mind" aria-hidden="true" />
})

export default Mind
