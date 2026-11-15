import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitHeading from './SplitHeading.jsx'
import Decode from './Decode.jsx'

gsap.registerPlugin(ScrollTrigger)

const EMAIL    = 'gokulv0331@gmail.com'
const PHONE    = '+4915510176813'
const GITHUB   = 'https://github.com/gokulv03'
const LINKEDIN = 'https://www.linkedin.com/in/gokul-vemulapalli'

const localTime = () =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date())

export default function Contact() {
  const sectionRef = useRef(null)
  const [copied, setCopied] = useState(false)
  const [time, setTime] = useState(localTime)

  useEffect(() => {
    const id = setInterval(() => setTime(localTime()), 20000)
    return () => clearInterval(id)
  }, [])

  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(EMAIL)
      ok = true
    } catch {
      // older or locked-down browsers: copy through a throwaway field instead
      const field = document.createElement('textarea')
      field.value = EMAIL
      field.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
      document.body.appendChild(field)
      field.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      field.remove()
    }
    if (!ok) return // the mailto link above still works
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const ctx = gsap.context(() => {
      // closing shot: the whole block rises and settles into place
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.from(el.querySelector('.contact-content'), {
          scale: 0.88, y: 90, transformOrigin: '50% 100%', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 30%', scrub: 1 },
        })
        gsap.from(el.querySelector('.contact-blob'), {
          scaleY: 0.3, opacity: 0, transformOrigin: '50% 100%', ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom bottom', scrub: 1 },
        })
      }
      gsap.from(el.querySelector('.contact-lede'), {
        opacity: 0, y: 30, ease: 'power2.out',
        scrollTrigger: { trigger: el.querySelector('.contact-lede'), start: 'top 92%', end: 'top 60%', scrub: 1.3 },
      })
      gsap.from(el.querySelector('.contact-email'), {
        opacity: 0, y: 34, ease: 'power2.out',
        scrollTrigger: { trigger: el.querySelector('.contact-email'), start: 'top 92%', end: 'top 58%', scrub: 1.4 },
      })
      gsap.from(el.querySelectorAll('.contact-col'), {
        opacity: 0, y: 28, stagger: { each: 0.08 }, ease: 'power2.out',
        scrollTrigger: { trigger: el.querySelector('.contact-grid'), start: 'top 98%', end: 'top 84%', scrub: 1.4 },
      })
    }, el)

    return () => ctx.revert()
  }, [])

  const smoothTo = (e, id) => {
    e.preventDefault()
    const t = document.getElementById(id)
    if (!t) return
    if (window.__lenis) window.__lenis.scrollTo(t, { offset: -72, duration: 1.4 })
    else t.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="contact" id="contact" ref={sectionRef}>
      <div className="contact-blob" />

      <div className="contact-content">
        {/* the page ends here, so the reveal has to finish before the last pixel */}
        <SplitHeading as="h2" className="section-title contact-title" end="top 62%">
          Let&rsquo;s build something
        </SplitHeading>

        <p className="contact-lede">
          Currently writing my master&rsquo;s thesis on buck converter layout and
          EMI. Open to working student roles and collaborations. The quickest
          way to reach me is a direct line.
        </p>

        <a className="contact-email" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        <button type="button" className={`contact-copy${copied ? ' is-done' : ''}`} onClick={copy} aria-live="polite">
          <Decode text={copied ? 'Copied' : 'Copy address'} />
        </button>

        <div className="contact-grid">
          <div className="contact-col">
            <span className="contact-col-h"><Decode text="Based in" /></span>
            <span>Nürnberg, Germany</span>
            <span>Local time {time}</span>
            <span className="contact-muted">© 2026 Gokul Vemulapalli</span>
          </div>

          <div className="contact-col">
            <span className="contact-col-h"><Decode text="Social" /></span>
            <a href={GITHUB} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href={LINKEDIN} target="_blank" rel="noreferrer">LinkedIn ↗</a>
            <a href={`tel:${PHONE}`}>Call ↗</a>
          </div>

          <div className="contact-col">
            <span className="contact-col-h"><Decode text="Navigate" /></span>
            <a href="#about" onClick={(e) => smoothTo(e, 'about')}>About</a>
            <a href="#projects" onClick={(e) => smoothTo(e, 'projects')}>Projects</a>
            <a href="#education" onClick={(e) => smoothTo(e, 'education')}>Education</a>
          </div>
        </div>
      </div>
    </section>
  )
}
