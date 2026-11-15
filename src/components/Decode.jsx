import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Decode — a short mono label that resolves out of signal noise, left to
 * right, the first time it scrolls into view, and again whenever its text
 * changes while on screen. Meant for monospaced labels (the width stays put).
 *
 * `active={false}` holds it back (the hero waits for the boot to finish).
 * Under reduced motion it is plain text.
 */
const NOISE = '01/\\<>[]#+=-_:'

export default function Decode({ text, active = true, className }) {
  const ref = useRef(null)
  const seen = useRef(false)

  // this component owns the span's text, so React never fights the animation
  useLayoutEffect(() => {
    if (ref.current && !seen.current) ref.current.textContent = text
  }, [text])

  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = text
      return
    }
    let raf = 0
    let io = null
    const run = () => {
      const t0 = performance.now()
      const dur = Math.min(900, 280 + text.length * 26)
      const tick = (now) => {
        const k = Math.min((now - t0) / dur, 1)
        const solved = Math.floor(k * text.length)
        let out = text.slice(0, solved)
        for (let i = solved; i < text.length; i++) {
          out += text[i] === ' ' ? ' ' : NOISE[(Math.random() * NOISE.length) | 0]
        }
        el.textContent = out
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    if (seen.current) {
      run()
    } else {
      io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return
        seen.current = true
        io.disconnect()
        run()
      }, { threshold: 0.6 })
      io.observe(el)
    }
    return () => {
      cancelAnimationFrame(raf)
      io?.disconnect()
      el.textContent = text
    }
  }, [text, active])

  return <span ref={ref} className={className} />
}
