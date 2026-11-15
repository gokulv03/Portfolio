import { useCallback, useEffect, useState } from 'react'
import { MotionConfig }  from 'framer-motion'
import gsap              from 'gsap'
import ScrollTrigger     from 'gsap/ScrollTrigger'
import { useLenis }       from './hooks/useLenis'
import Preloader         from './components/Preloader.jsx'
import World             from './components/World.jsx'
import ScrollProgress    from './components/ScrollProgress.jsx'
import Header            from './components/Header.jsx'
import Hero              from './components/Hero.jsx'
import Marquee           from './components/Marquee.jsx'
import About             from './components/About.jsx'
import Projects          from './components/Projects.jsx'
import Education         from './components/Education.jsx'
import Contact           from './components/Contact.jsx'

export default function App() {
  const [ready, setReady] = useState(false)
  const onBootDone = useCallback(() => setReady(true), [])

  useLenis()

  // hold the page still during the boot, then release it and re-measure
  useEffect(() => {
    document.documentElement.classList.toggle('is-booting', !ready)
    if (ready) {
      window.__lenis?.start()
      ScrollTrigger.refresh()
    } else {
      window.__lenis?.stop()
    }
  }, [ready])

  // depth: the measurement grid drifts more slowly than the page
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.to('.grid-bg', {
      yPercent: -22,
      ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: true },
    })
    return () => { tween.scrollTrigger?.kill(); tween.kill() }
  }, [])

  return (
    <MotionConfig reducedMotion="user">
      <Preloader onDone={onBootDone} />
      {/* fixed measurement grid behind everything (see .grid-bg in index.css) */}
      <div className="grid-bg" aria-hidden="true" />
      {/* the 3D board the page flies through; replaces the flat grid when it loads */}
      <World ready={ready} />
      <ScrollProgress />
      <Header />
      <main>
        <Hero ready={ready} />
        <Marquee />
        <About />
        {/* open air between sections: the world's launch tunnel plays here */}
        <div className="interlude" aria-hidden="true" />
        <Projects />
        <Education />
        <Contact />
      </main>
    </MotionConfig>
  )
}
