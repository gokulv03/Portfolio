import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitHeading from './SplitHeading.jsx'

gsap.registerPlugin(ScrollTrigger)

const ITEMS = [
  {
    id: '01',
    period: 'Current · Expected Apr 2026',
    degree: 'M.Sc. Electrical and Information Technology',
    school: 'Deggendorf Institute of Technology',
    location: 'Germany',
    focus: ['Embedded Systems', 'DSP', 'Real-time OS', 'Power Electronics'],
    current: true,
  },
  {
    id: '02',
    period: 'Jun 2023',
    degree: 'B.E. Electronics and Communication Engineering',
    school: 'Dayananda Sagar College',
    location: 'Bangalore, India',
    focus: ['EMC', 'Embedded Systems', 'Microcontrollers', 'Communication Systems'],
    current: false,
  },
]

export default function Education() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const ctx = gsap.context(() => {

      // Timeline nodes pop in
      el.querySelectorAll('.edu-node').forEach((node) => {
        gsap.from(node, {
          scale: 0, opacity: 0,
          ease: 'back.out(2)',
          scrollTrigger: {
            trigger: node,
            start: 'top 85%', end: 'top 60%',
            scrub: 1,
          },
        })
      })

      // the amber line draws down the timeline as you scroll past it
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.querySelectorAll('.edu-fill').forEach((fill) => {
          gsap.fromTo(fill, { scaleY: 0 }, {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: fill.parentElement,
              start: 'top 62%', end: 'bottom 42%',
              scrub: 0.8,
              onUpdate: (self) => {
                const next = fill.parentElement.nextElementSibling?.querySelector('.edu-node')
                next?.classList.toggle('reached', self.progress > 0.96)
              },
            },
          })
        })
      }

      // Education rows — slide up scrubbed
      el.querySelectorAll('.edu-row').forEach((row) => {
        gsap.from(row, {
          opacity: 0, y: 56,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: row,
            start: 'top 88%', end: 'top 44%',
            scrub: 1.3,
          },
        })
      })

    }, el)

    return () => ctx.revert()
  }, [])

  return (
    <section className="education" id="education" ref={sectionRef}>
      <SplitHeading as="h2" className="section-title">
        Education
      </SplitHeading>

      <div className="edu-timeline">
        <div className="edu-items">
          {ITEMS.map((item, i) => (
            <div className="edu-row" key={item.id}>
              {i < ITEMS.length - 1 && <span className="edu-fill" />}
              <span className={`edu-node${item.current ? ' active' : ''}`} />
              <div className="edu-card">
                <div className="edu-card-head">
                  <span className="edu-num">{item.id}</span>
                  <span className={`edu-period${item.current ? ' current' : ''}`}>{item.period}</span>
                </div>
                <h3 className="edu-degree">{item.degree}</h3>
                <div className="edu-school">
                  {item.school}
                  <span className="edu-location"> · {item.location}</span>
                </div>
                <div className="edu-focus">
                  {item.focus.map((f) => (
                    <span className="edu-tag" key={f}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
