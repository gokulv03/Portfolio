import { useEffect, useRef } from 'react'

/**
 * Perf — a small frame-rate readout for diagnosing smoothness on a real
 * machine. Hidden unless the address ends in ?fps (for example
 * localhost:3000/?fps). Shows frames per second, the slowest frame in the
 * last half second, and, on the work page, what the 3D world has dialled its
 * own quality to and which graphics chip the browser is using.
 */
export const perfOn = new URLSearchParams(window.location.search).has('fps')

export default function Perf() {
  const ref = useRef(null)

  useEffect(() => {
    let raf = 0
    let frames = 0
    let worst = 0
    let last = performance.now()
    let mark = last
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const gap = now - last
      last = now
      frames += 1
      if (gap > worst) worst = gap
      if (now - mark < 500) return
      const world = window.__worldState?.()
      const lines = [`${Math.round((frames * 1000) / (now - mark))} fps   slowest frame ${Math.round(worst)} ms`]
      if (world) lines.push(`quality step ${world.level} of 3   glow ${world.bloom ? 'on' : 'off'}`, world.gpu)
      if (ref.current) ref.current.textContent = lines.join('\n')
      frames = 0
      worst = 0
      mark = now
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return <pre className="perf" ref={ref} aria-hidden="true" />
}
