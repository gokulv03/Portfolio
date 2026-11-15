import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

/**
 * Preloader — a short instrument boot. The count runs while the web fonts
 * load, then the panel lifts away and the hero plays its entrance. Skipped
 * entirely under prefers-reduced-motion.
 */
export default function Preloader({ onDone }) {
  const rootRef = useRef(null)
  const countRef = useRef(null)
  const barRef = useRef(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setGone(true)
      onDone()
      return
    }

    let cancelled = false
    const fonts = Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ])
    const counter = { v: 0 }

    const ctx = gsap.context(() => {
      gsap.to(counter, {
        v: 100,
        duration: 1.15,
        ease: 'power2.inOut',
        onUpdate() {
          if (countRef.current) countRef.current.textContent = String(Math.round(counter.v)).padStart(3, '0')
          if (barRef.current) barRef.current.style.transform = `scaleX(${counter.v / 100})`
        },
        onComplete() {
          fonts.then(() => {
            if (cancelled) return
            onDone()
            gsap.to(rootRef.current, {
              yPercent: -100,
              duration: 0.85,
              ease: 'power4.inOut',
              onComplete: () => setGone(true),
            })
          })
        },
      })
    })

    return () => { cancelled = true; ctx.revert() }
  }, [onDone])

  if (gone) return null

  return (
    <div className="boot" ref={rootRef} aria-hidden="true">
      <div className="boot-inner">
        <div className="boot-row">
          <span className="boot-brand">GV</span>
          <span className="boot-count" ref={countRef}>000</span>
        </div>
        <div className="boot-bar"><i ref={barRef} /></div>
      </div>
    </div>
  )
}
