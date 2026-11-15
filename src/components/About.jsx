import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitHeading from './SplitHeading.jsx'
import Miniature from './Miniature.jsx'
import Decode from './Decode.jsx'

gsap.registerPlugin(ScrollTrigger)

const SKILLS = [
  { title: 'Embedded Software',     tags: ['C / C++', 'STM32', 'Register-level', 'Interrupts', 'DMA', 'Timers'] },
  { title: 'Protocols',             tags: ['CAN Bus', 'UART', 'SPI', 'I2C', 'TCP/IP', 'Modbus'] },
  { title: 'Industrial Automation', tags: ['PLC (TIA Portal)', 'SCADA (WinCC)', 'IEC 61131-3', 'Structured Text', 'HMI'] },
  { title: 'Simulation & Analysis', tags: ['MATLAB/Simulink', 'LTspice', 'Python (NumPy, Pandas)', 'SIL Methodology'] },
  { title: 'Dev Tools',             tags: ['STM32CubeIDE', 'Git', 'JTAG / SWD', 'Oscilloscope', 'Doxygen'] },
  { title: 'Methods & Languages',   tags: ['State Machines', 'Unit Testing', 'Agile', 'English C2', 'German B1→B2'] },
]

// [text, emphasised] runs; each word becomes a span so the copy can light up with scroll
const INTRO = [
  [
    ['Electrical Engineering student', true],
    [' specialising in embedded firmware and hardware-software integration. I write register-level C for STM32 microcontrollers, design PLC control logic for industrial automation, and build Python simulation pipelines.', false],
  ],
  [
    ['My work spans safety-critical academic research, including an electromagnetic rail launcher and a V2V visible-light communication system, plus independent simulation work bridging physical plant models with software. Currently pursuing an M.Sc. at ', false],
    ['Deggendorf Institute of Technology', true],
    [', deepening expertise in real-time OS, DSP, and power electronics.', false],
  ],
]

const words = (text, strong, keyBase) =>
  text.split(/(\s+)/).map((token, i) =>
    token.trim()
      ? <span className={strong ? 'w w-strong' : 'w'} key={`${keyBase}-${i}`}>{token}</span>
      : token
  )

export default function About() {
  const sectionRef = useRef(null)
  const sceneRef = useRef(null)
  const miniRef = useRef(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const mm = gsap.matchMedia()

    mm.add(
      {
        scene: '(min-width: 881px) and (min-height: 640px)',
        motion: '(prefers-reduced-motion: no-preference)',
        any: 'all',
      },
      (context) => {
        const { scene, motion } = context.conditions
        const words = el.querySelectorAll('.about-intro .w')
        const feed = (self) => miniRef.current?.setProgress(self.progress)

        if (motion && scene) {
          // Scroll scene: the section holds. The copy lights up word by word
          // while the board turns and comes apart, then settles back together.
          gsap.timeline({
            scrollTrigger: {
              trigger: sceneRef.current, start: 'top top', end: '+=130%',
              pin: true, scrub: 0.6, onUpdate: feed,
            },
          })
            .from(words, { opacity: 0.16, stagger: 0.05, ease: 'none' })
            .to({}, { duration: 0.7 })
        } else if (motion) {
          gsap.from(words, {
            opacity: 0.16, stagger: 0.05, ease: 'none',
            scrollTrigger: {
              trigger: el.querySelector('.about-intro'),
              start: 'top 82%', end: 'bottom 50%', scrub: 0.6,
            },
          })
          ScrollTrigger.create({
            trigger: el.querySelector('.about-mini'),
            start: 'top 92%', end: 'bottom 8%', onUpdate: feed,
          })
        }

        if (motion) {
          // stats count up once, when they arrive
          el.querySelectorAll('[data-count]').forEach((node) => {
            const end = Number(node.dataset.count)
            const state = { v: 0 }
            node.textContent = '00'
            gsap.to(state, {
              v: end, duration: 1.3, ease: 'power2.out', snap: { v: 1 },
              onUpdate: () => { node.textContent = String(state.v).padStart(2, '0') },
              scrollTrigger: { trigger: node, start: 'top 90%', once: true },
            })
          })
        }

        // each row's tags power on in sequence the first time it arrives
        el.querySelectorAll('.skill-card').forEach((card) => {
          ScrollTrigger.create({
            trigger: card, start: 'top 86%', once: true,
            onEnter: () => card.classList.add('is-lit'),
          })
        })

        // Skill rows — staggered scrub reveal from bottom
        gsap.from(el.querySelectorAll('.skill-card'), {
          opacity: 0, y: 60,
          stagger: { each: 0.08 },
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el.querySelector('.skills-grid'),
            start: 'top 88%', end: 'top 20%',
            scrub: 1.5,
          },
        })

        // rebuilt on breakpoint changes, so put it back in page order
        ScrollTrigger.sort()
        ScrollTrigger.refresh()
      }
    )

    return () => mm.revert()
  }, [])

  return (
    <section className="about" id="about" ref={sectionRef}>
      <div className="about-scene" ref={sceneRef}>
        <SplitHeading as="h2" className="section-title">
          Profile
        </SplitHeading>

        <div className="about-top">
          <div className="about-intro">
            {INTRO.map((para, p) => (
              <p key={p}>
                {para.map(([text, strong], s) => words(text, strong, `${p}-${s}`))}
              </p>
            ))}
          </div>

          <div className="about-mini">
            <div className="mini-slot">
              <Miniature ref={miniRef} kind="mcu" label="3D model of an STM32 development board" />
            </div>
            <span className="mini-hint">Drag to rotate</span>
          </div>
        </div>
      </div>

      <div className="about-stats">
        <div className="stat"><b data-count="7">07</b><Decode text="Projects built" /></div>
        <div className="stat"><b data-count="3">03</b><Decode text="Domains" /></div>
        <div className="stat"><b>EN · DE</b><Decode text="Languages" /></div>
      </div>

      <div className="skills-grid">
        {SKILLS.map((s) => (
          <div className="skill-card" key={s.title}>
            <div className="skill-card-title"><Decode text={s.title} /></div>
            <div className="skill-tags">
              {s.tags.map((t, i) => (
                <span className="skill-tag" key={t} style={{ '--i': i }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
