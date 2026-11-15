import { useEffect, useRef } from 'react'

/**
 * SignalScope — a live oscilloscope trace on a graticule.
 * The hero's right-hand asset: an honest, domain-representative visual for a
 * firmware/DSP engineer (waveforms, sampling, filtering), rendered on <canvas>
 * with requestAnimationFrame — no React state in the hot path, DPI-aware,
 * and degraded to a single static frame under prefers-reduced-motion.
 *
 * The beam is drawn like a phosphor screen: a wide halo, a bright body and a
 * hot core, on its own layer that fades instead of being wiped, so the trace
 * leaves a short afterglow where it has just been.
 */
export default function SignalScope() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // the beam's own layer (kept between frames so it can decay)
    const beam = document.createElement('canvas')
    const bctx = beam.getContext('2d')

    let w = 0, h = 0, dpr = 1
    const resize = () => {
      // layout size, not the on-screen box: the hero dive scales this element
      // up several times, and the backing store must not grow with it
      dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      w = canvas.clientWidth
      h = canvas.clientHeight
      if (!w || !h) return
      canvas.width = beam.width = Math.round(w * dpr)
      canvas.height = beam.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const GRID = 'rgba(150, 170, 175, 0.09)'
    const GRID_HAIR = 'rgba(150, 170, 175, 0.045)'
    const SIG = '#ffb020'

    const drawGraticule = () => {
      ctx.clearRect(0, 0, w, h)
      const div = 40
      // fine hairlines
      ctx.lineWidth = 1
      ctx.strokeStyle = GRID_HAIR
      ctx.beginPath()
      for (let x = 0; x <= w; x += div / 5) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
      for (let y = 0; y <= h; y += div / 5) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
      ctx.stroke()
      // major divisions
      ctx.strokeStyle = GRID
      ctx.beginPath()
      for (let x = 0; x <= w; x += div) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
      for (let y = 0; y <= h; y += div) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
      ctx.stroke()
      // centre axes, slightly brighter
      ctx.strokeStyle = 'rgba(150, 170, 175, 0.16)'
      ctx.beginPath()
      ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2)
      ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h)
      ctx.stroke()
    }

    // A composed signal: carrier + harmonic + a slow envelope, with a little
    // sampled jitter so it reads as a captured waveform rather than a clean sine.
    const sample = (x, t) => {
      const nx = x / w
      const env = 0.62 + 0.24 * Math.sin(nx * Math.PI * 1.0 - t * 0.6)
      const carrier = Math.sin(nx * Math.PI * 8 - t * 2.2)
      const harmonic = 0.34 * Math.sin(nx * Math.PI * 20 - t * 3.1)
      const jitter = 0.05 * Math.sin(nx * Math.PI * 60 + t * 5)
      return (carrier + harmonic + jitter) * env
    }

    const drawTrace = (c, t) => {
      const midY = h / 2
      const amp = h * 0.30
      const path = () => {
        c.beginPath()
        for (let x = 0; x <= w; x += 2) {
          const y = midY - sample(x, t) * amp
          x === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
        }
        c.stroke()
      }
      c.lineJoin = 'round'
      c.lineCap = 'round'

      // wide halo: the light the beam spills onto the screen around it
      c.shadowColor = SIG
      c.shadowBlur = 22
      c.strokeStyle = 'rgba(255, 176, 32, 0.15)'
      c.lineWidth = 5
      path()

      // the beam itself
      c.shadowBlur = 12
      c.strokeStyle = SIG
      c.lineWidth = 2.2
      path()
      c.shadowBlur = 0

      // hot core
      c.strokeStyle = 'rgba(255, 238, 200, 0.95)'
      c.lineWidth = 1
      path()

      // leading sample dot
      const headX = w - 2
      const headY = midY - sample(headX, t) * amp
      c.fillStyle = '#ffe7b8'
      c.shadowColor = SIG
      c.shadowBlur = 18
      c.beginPath()
      c.arc(headX, headY, 3, 0, Math.PI * 2)
      c.fill()
      c.shadowBlur = 0
    }

    // only draw while the scope can actually be seen: on screen, and not faded
    // out by the hero dive (which hides it without moving it off screen)
    let onScreen = true
    let shown = true
    let checks = 0
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting })
    io.observe(canvas)

    let raf = 0
    const start = performance.now()
    let last = start
    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (checks++ % 12 === 0) {
        shown = canvas.checkVisibility
          ? canvas.checkVisibility({ visibilityProperty: true, opacityProperty: true })
          : true
      }
      if (!onScreen || !shown) { last = now; return }
      const t = (now - start) / 1000
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // let the old beam decay, then lay the new one over it
      bctx.globalCompositeOperation = 'destination-out'
      bctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.exp(-dt * 8)})`
      bctx.fillRect(0, 0, w, h)
      bctx.globalCompositeOperation = 'source-over'
      drawTrace(bctx, t)

      drawGraticule()
      ctx.drawImage(beam, 0, 0, w, h)
    }

    if (reduce) {
      drawGraticule()
      drawTrace(ctx, 0.8)
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <div className="scope" aria-hidden="true">
      <div className="scope-frame">
        <canvas ref={canvasRef} className="scope-canvas" />
        <div className="scope-labels">
          <span>CH1</span>
          <span>2.00 V/div</span>
          <span>10 µs/div</span>
        </div>
        <div className="scope-corner tl" />
        <div className="scope-corner tr" />
        <div className="scope-corner bl" />
        <div className="scope-corner br" />
      </div>
    </div>
  )
}
