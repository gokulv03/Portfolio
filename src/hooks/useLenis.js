import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp:        0.07,   // 0.07 = heavy, weighted momentum (default 0.1)
      smoothWheel: true,   // touch devices fall back to native momentum scroll
    })

    // Official Lenis + GSAP integration — drives Lenis from GSAP's ticker
    // so ScrollTrigger's scroll position is always in sync with Lenis's virtual scroll
    const onTick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    // Update ScrollTrigger on each Lenis scroll tick
    lenis.on('scroll', ScrollTrigger.update)

    window.__lenis = lenis

    return () => {
      gsap.ticker.remove(onTick)
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      window.__lenis = null
    }
  }, [])
}
