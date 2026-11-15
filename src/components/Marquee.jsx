import { useEffect, useRef } from 'react'
import gsap from 'gsap'

const ITEMS = ['STM32', 'Embedded C', 'CAN Bus', 'PLC', 'SCADA', 'MATLAB', 'Python', 'DSP']

/**
 * Marquee — one band of the working stack between the hero and the profile.
 * It drifts on its own, and scrolling speeds it up, leans it and sets its
 * direction, so the page's momentum is visible. Static under reduced motion.
 */
export default function Marquee() {
  const trackRef = useRef(null)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const set = track.firstElementChild
    let x = 0, dir = -1, skew = 0
    const tick = (_time, deltaMs) => {
      const width = set.offsetWidth
      if (!width) return
      const vel = window.__lenis?.velocity ?? 0
      if (Math.abs(vel) > 0.4) dir = vel > 0 ? -1 : 1
      x += dir * (0.045 * deltaMs + Math.abs(vel) * 0.55)
      if (x <= -width) x += width
      if (x > 0) x -= width
      skew += (Math.max(-7, Math.min(7, vel * 0.22)) - skew) * 0.12
      track.style.transform = `translate3d(${x}px, 0, 0) skewX(${-skew}deg)`
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" ref={trackRef}>
        {[0, 1].map((n) => (
          <div className="marquee-set" key={n}>
            {ITEMS.map((item) => (
              <span className="marquee-item" key={item}>{item}<i>/</i></span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
