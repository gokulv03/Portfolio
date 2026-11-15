import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SignalScope from './SignalScope.jsx'
import Decode from './Decode.jsx'

gsap.registerPlugin(ScrollTrigger)

const NAME = ['Gokul', 'Vemulapalli']

export default function Hero({ ready }) {
  const heroRef = useRef(null)
  const contentRef = useRef(null)
  const scopeRef = useRef(null)

  // pointer position drives a sprung 3D tilt on the scope (no React re-renders)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 110, damping: 18, mass: 0.6 })
  const sy = useSpring(my, { stiffness: 110, damping: 18, mass: 0.6 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-10, 10])
  const rotateX = useTransform(sy, [-0.5, 0.5], [8, -8])

  const onPointerMove = (e) => {
    if (e.pointerType !== 'mouse') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onPointerLeave = () => { mx.set(0); my.set(0) }

  // Scroll scene. Wide screens: the hero holds while the copy clears and the
  // camera dives through the scope into the world. Narrow screens: a light lift.
  useEffect(() => {
    const hero = heroRef.current
    const scope = scopeRef.current
    const content = contentRef.current
    const mm = gsap.matchMedia()

    mm.add('(min-width: 881px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)', () => {
      const dx = () => hero.clientWidth / 2 - (scope.offsetLeft + scope.offsetWidth / 2)
      const dy = () => hero.clientHeight / 2 - (scope.offsetTop + scope.offsetHeight / 2)
      const cover = () =>
        Math.max(hero.clientWidth / scope.offsetWidth, hero.clientHeight / scope.offsetHeight) * 1.3

      gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero, start: 'top top', end: '+=150%',
          pin: true, scrub: 0.7, invalidateOnRefresh: true,
        },
      })
        .to(content, { xPercent: -10, autoAlpha: 0, duration: 0.26, ease: 'power1.in' }, 0)
        .to(scope, { x: dx, y: dy, scale: cover, duration: 0.6, ease: 'power2.in' }, 0)
        .to(scope, { autoAlpha: 0, duration: 0.17 }, 0.43)
        // the screen is clear from here: the rest of the hold belongs to the
        // world behind the page, as its camera drops to the board (World.jsx)
        .to({}, { duration: 0.4 }, 0.6)
    })

    mm.add('(max-width: 880px) and (prefers-reduced-motion: no-preference)', () => {
      const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 1.4 }
      gsap.to(content, { y: '-4%', opacity: 0.3, ease: 'none', scrollTrigger: st })
      gsap.to(scope, {
        yPercent: -6, rotateX: 16, scale: 0.93, opacity: 0.2,
        transformPerspective: 1000, transformOrigin: '50% 100%',
        ease: 'none', scrollTrigger: st,
      })
    })

    return () => mm.revert()
  }, [])

  const hidden = { opacity: 0, y: 16 }
  const fade = (d) => ({
    initial: hidden,
    animate: ready ? { opacity: 1, y: 0 } : hidden,
    transition: { duration: 0.7, delay: d, ease: [0.16, 1, 0.3, 1] },
  })

  const scrollTo = (id) => (e) => {
    e.preventDefault()
    window.__lenis?.scrollTo(id, { offset: -40, duration: 1.3 })
  }

  let charIndex = 0

  return (
    <section
      className={`hero${ready ? ' is-ready' : ''}`}
      id="hero"
      ref={heroRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="hero-inner">
        <div className="hero-content" ref={contentRef}>
          <motion.span className="hero-eyebrow" {...fade(0.1)}>
            <Decode text="Electrical engineer" active={ready} />
          </motion.span>

          <h1 className="hero-title" aria-label={NAME.join(' ')}>
            {NAME.map((word) => [
              <span className="ht-word" key={word} aria-hidden="true">
                {word.split('').map((ch, i) => (
                  <span className="ht-char" key={i} style={{ '--i': charIndex++ }}>{ch}</span>
                ))}
              </span>,
              ' ',
            ])}
          </h1>

          <motion.p className="hero-lede" {...fade(0.55)}>
            Master&rsquo;s student working on buck converter layout and EMI,
            with a background in STM32 firmware, PLC control logic and signal
            processing.
          </motion.p>

          <motion.div className="hero-actions" {...fade(0.72)}>
            <a className="btn-solid" href="#contact" onClick={scrollTo('#contact')}>
              Get in touch
            </a>
            <a className="btn-line" href="#projects" onClick={scrollTo('#projects')}>
              View work <span aria-hidden="true">↓</span>
            </a>
          </motion.div>
        </div>

        <div className="hero-scope" ref={scopeRef}>
          <motion.div
            className="scope-tilt"
            style={{ rotateX, rotateY }}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={ready ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <SignalScope />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
