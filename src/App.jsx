import { useCallback, useEffect, useRef, useState } from 'react'
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
import Personal          from './components/Personal.jsx'

/* Two pages, no router: the work (/) and the personal page (/personal). */
const PATHS = { home: '/', personal: '/personal' }
const TITLES = {
  home: 'Gokul Vemulapalli · Electrical Engineer',
  personal: 'Gokul Vemulapalli · Personal',
}
const pageFromUrl = () =>
  (window.location.pathname.replace(/\/+$/, '') === PATHS.personal ? 'personal' : 'home')

export default function App() {
  const [ready, setReady] = useState(false)
  const onBootDone = useCallback(() => setReady(true), [])

  const [page, setPage] = useState(pageFromUrl)
  const [veil, setVeil] = useState(false) // black fade between the two pages
  const pageRef = useRef(page)
  pageRef.current = page

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

  // going from one page to the other: fade to black, swap, fade back in
  const navigate = useCallback((to) => {
    if (to === pageRef.current) return
    setVeil(true)
    window.__lenis?.stop()
    setTimeout(() => {
      window.history.pushState({}, '', PATHS[to])
      setPage(to)
    }, 280)
  }, [])

  // browser back / forward
  useEffect(() => {
    const onPop = () => setPage(pageFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // a page has just been swapped in: start it from the top and re-measure
  useEffect(() => {
    document.documentElement.classList.toggle('is-personal', page === 'personal')
    document.title = TITLES[page]
    window.scrollTo(0, 0)
    window.__lenis?.scrollTo(0, { immediate: true, force: true })
    const id = setTimeout(() => {
      ScrollTrigger.refresh()
      if (!document.documentElement.classList.contains('is-booting')) window.__lenis?.start()
      setVeil(false)
    }, 90)
    return () => clearTimeout(id)
  }, [page])

  // depth: the measurement grid drifts more slowly than the page (work page only)
  useEffect(() => {
    if (page !== 'home') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tween = gsap.to('.grid-bg', {
      yPercent: -22,
      ease: 'none',
      scrollTrigger: { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: true },
    })
    return () => { tween.scrollTrigger?.kill(); tween.kill() }
  }, [page])

  return (
    <MotionConfig reducedMotion="user">
      <Preloader onDone={onBootDone} />
      <ScrollProgress />
      <Header page={page} onNavigate={navigate} />

      {page === 'personal' ? (
        <Personal ready={ready} onHome={() => navigate('home')} />
      ) : (
        <>
          {/* fixed measurement grid behind everything (see .grid-bg in index.css) */}
          <div className="grid-bg" aria-hidden="true" />
          {/* the 3D board the page flies through; replaces the flat grid when it loads */}
          <World ready={ready} />
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
        </>
      )}

      <div className={`veil${veil ? ' is-on' : ''}`} aria-hidden="true" />
    </MotionConfig>
  )
}
