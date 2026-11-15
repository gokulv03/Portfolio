import { useEffect, useRef, useState } from 'react'
import ScrollTrigger from 'gsap/ScrollTrigger'

/**
 * World — the fixed 3D board behind the whole page (see src/three/world.js).
 * Scroll flies a camera through it; this component only tells the world where
 * the sections sit on the page, so the flight lines up with the content.
 *
 * Not mounted under reduced motion, and if WebGL is unavailable the flat
 * measurement grid simply stays.
 */
const docTop = (selector) => {
  const el = document.querySelector(selector)
  if (!el) return null
  // a pinned element is taken out of flow; its spacer keeps the real position
  const node = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el
  return node.getBoundingClientRect().top + window.scrollY
}

export default function World({ ready }) {
  const canvasRef = useRef(null)
  const barsRef = useRef(null)
  const worldRef = useRef(null)
  const readyRef = useRef(ready)
  const [on, setOn] = useState(false)
  const [skip] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (skip) return
    let world = null
    let cancelled = false

    const measure = () => {
      if (!world) return
      const vh = window.innerHeight
      const end = Math.max(document.documentElement.scrollHeight - vh, vh)
      const marquee = docTop('.marquee') ?? vh
      const about = docTop('#about') ?? vh * 1.2
      const projects = docTop('#projects') ?? end * 0.5
      const education = docTop('#education') ?? end * 0.8
      const contact = docTop('#contact') ?? end
      // the empty stretch between profile and projects, where the launch plays
      const gap = document.querySelector('.interlude')
      const i0 = gap && gap.offsetHeight ? docTop('.interlude') : null
      const a1 = Math.max(marquee - vh * 0.8, vh * 0.35)
      world.setJourney({
        a1,
        about: Math.max(about - vh * 0.3, a1 + 1),
        i0,
        i1: i0 == null ? null : i0 + gap.offsetHeight,
        projects: projects - vh * 0.3,
        education: education - vh * 0.3,
        a5: Math.min(contact - vh, end - vh * 0.4),
        end,
        vh,
      })
    }

    import('../three/world.js')
      .then(({ createWorld }) => {
        if (cancelled || !canvasRef.current) return
        world = createWorld(canvasRef.current, {
          lite: window.matchMedia('(max-width: 880px)').matches,
          bars: barsRef.current,
        })
        worldRef.current = world
        if (import.meta.env.DEV) window.__world = world
        ScrollTrigger.addEventListener('refresh', measure)
        window.addEventListener('resize', measure)
        // this class opens the launch gap in the page, so everything below moves:
        // re-measure the scroll scenes (which also re-measures the journey)
        document.documentElement.classList.add('has-world')
        ScrollTrigger.refresh()
        measure()
        if (readyRef.current) world.power()
        setOn(true)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      ScrollTrigger.removeEventListener('refresh', measure)
      window.removeEventListener('resize', measure)
      document.documentElement.classList.remove('has-world')
      world?.dispose()
      worldRef.current = null
    }
  }, [skip])

  // the board stays dark until the boot sequence hands over, then powers up
  useEffect(() => {
    readyRef.current = ready
    if (ready) worldRef.current?.power()
  }, [ready])

  if (skip) return null

  return (
    <>
      <div className={`world${on ? ' is-on' : ''}`} aria-hidden="true">
        <canvas ref={canvasRef} />
      </div>
      {/* cinema bars; the world slides them in during its own beats */}
      <div className="letterbox" ref={barsRef} aria-hidden="true"><i /><i /></div>
    </>
  )
}
