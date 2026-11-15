import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import SplitHeading from './SplitHeading.jsx'
import Decode from './Decode.jsx'
import ProjectModal from './ProjectModal.jsx'
import Miniature from './Miniature.jsx'
import { useMedia } from '../hooks/useMedia'

gsap.registerPlugin(ScrollTrigger)

const FLAGSHIP = [
  {
    id: '01', mini: 'buck',
    title: 'Buck Converter Layout Study', type: 'M.Sc. thesis · Ongoing',
    metric: '−40 dB noise, simulated', metricLabel: 'So far', role: 'Power electronics · EMC',
    desc: 'How PCB layout changes the conducted emissions of a 24 V to 12 V buck converter.',
    overview: 'My master’s thesis at Deggendorf Institute of Technology, currently in progress: a comparison of different layout configurations of buck converters. One 24 V to 12 V, 2 A converter switching at 200 kHz is laid out on two-layer boards, once carefully and then deliberately poorly, and the conducted emissions of each version are compared from 150 kHz to 110 MHz. The power stage, control loop and input filter are designed and simulated in LTspice, and the KiCad schematic of the first board is complete. Board layout, hardware and lab measurements come next.',
    highlights: [
      'Power stage designed for 24 V in and 12 V / 2 A out at 200 kHz, with parts rated for 3 A',
      'Closed loop simulated in LTspice: 6 ms soft start, and a 2 A to 3 A load step recovers in about 50 µs',
      'Own differential-mode input filter lowers the 200 kHz emission by 40 dB in simulation',
      'KiCad schematic complete: 32 parts, zero ERC errors',
    ],
    tags: ['Buck converter', 'LTspice', 'KiCad', 'EMI / EMC', 'PCB layout'], repo: null,
  },
  {
    id: '02', mini: 'rail',
    title: 'Electromagnetic Rail Launcher', type: 'Academic · 2023',
    metric: '50+ cycles validated', role: 'Embedded firmware · State machines',
    desc: 'A safety-critical control core for a high-current electromagnetic actuator.',
    overview: 'An electromagnetic rail launcher driven by a safety-critical firmware core. A four-state machine (initialise → arm → fire → shutdown) governs a high-current actuator, switching the firing stage with microsecond-precise STM32 timers while a Hall-effect loop tracks projectile position. The firmware is hardened against the heavy electromagnetic interference generated at discharge.',
    highlights: [
      'Validated across 50+ fire cycles with zero unsafe transitions',
      'Microsecond timer-driven switching of the high-current stage',
      'Hall-effect feedback for real-time projectile position',
      'Interrupt-safe, EMI-hardened firmware architecture',
    ],
    tags: ['STM32', 'C', 'State Machine', 'Hall-Effect', 'EMI'], repo: null,
  },
  {
    id: '03', mini: 'v2v',
    title: 'V2V Visible-Light Communication', type: 'Academic · 2023',
    metric: '95% detection accuracy', role: 'Embedded firmware · DSP',
    desc: 'A vehicle-to-vehicle data link carried over visible light.',
    overview: 'A vehicle-to-vehicle link that carries data over visible light. Manchester-encoded bitstreams are pushed through a PWM-driven LED stage on STM32 and recovered with FIR/IIR filtering, holding reliable detection even under noisy ambient-light conditions.',
    highlights: [
      '95% detection accuracy across test runs',
      'Bare-metal Manchester encode / decode in C',
      'FIR/IIR filtering for ambient-noise rejection',
      'Microsecond LED-driver synchronisation via PWM',
    ],
    tags: ['STM32', 'Embedded C', 'FIR/IIR', 'Manchester', 'PWM'], repo: null,
  },
  {
    id: '04', mini: 'iot',
    title: 'Automotive IoT Monitoring System', type: 'Academic · 2022',
    metric: '<500 ms fault detection', role: 'Firmware · Telemetry',
    desc: 'A telemetry and monitoring platform for automotive environments.',
    overview: 'A telemetry and monitoring platform for automotive environments. ESP8266 firmware fuses eight peripherals over UART and DMA, streaming sensor data through a custom TCP/IP protocol with sub-500 ms fault detection, verified across the full automotive temperature range.',
    highlights: [
      '8 peripherals integrated over UART / DMA',
      'Custom lightweight TCP/IP telemetry protocol',
      'Fault detection under 500 ms',
      'Validated from −10 °C to 85 °C',
    ],
    tags: ['ESP8266', 'C/C++', 'UART/DMA', 'TCP/IP'], repo: null,
  },
]

const MORE = [
  {
    id: '05', title: 'PID Digital Twin', cat: 'Simulation · Controls',
    desc: 'Discrete-time PID on a thermodynamic plant model, with SIL methodology and telemetry validation.',
    tags: ['Python', 'PID', 'SIL'], repo: 'https://github.com/gokulv03/pid_digital_twin',
  },
  {
    id: '06', title: 'Predictive Maintenance', cat: 'Industrial IoT',
    desc: 'SIL simulation of a vibration sensor network with edge anomaly detection and failure dashboards.',
    tags: ['Python', 'Anomaly Detection', 'OOP'], repo: 'https://github.com/gokulv03/predictive_maintenance_pipeline',
  },
  {
    id: '07', title: 'SCADA Dashboard', cat: 'Industrial Monitoring',
    desc: 'Real-time process visualisation and system overview dashboard for industrial automation.',
    tags: ['Python', 'SCADA', 'Data Viz'], repo: 'https://github.com/gokulv03/scada_dashboard',
  },
  {
    id: '08', title: 'PLC Conveyor System', cat: 'Automation · IEC 61131-3',
    desc: 'Sequencing, motor control and safety interlocks with a WinCC HMI in Siemens TIA Portal.',
    tags: ['TIA Portal', 'Structured Text', 'WinCC'], repo: null,
  },
]

const MINIS = FLAGSHIP.map((p) => p.mini)

export default function Projects() {
  const sectionRef = useRef(null)
  const sceneRef = useRef(null)
  const [open, setOpen] = useState(null)
  const [active, setActive] = useState(FLAGSHIP[0])
  const wide = useMedia('(min-width: 1000px)')

  // Scroll scene (wide, tall-enough screens): the section holds while scroll
  // steps through the flagship projects, swapping the 3D miniature as it goes.
  const scene = useMedia('(min-width: 1000px) and (min-height: 640px) and (prefers-reduced-motion: no-preference)')

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const ctx = gsap.context(() => {
      if (scene) {
        let last = 0
        const stage = el.querySelector('.proj-stage')
        ScrollTrigger.create({
          trigger: sceneRef.current,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * 0.55 * FLAGSHIP.length)}`,
          pin: true,
          onUpdate(self) {
            const i = Math.min(Math.floor(self.progress * FLAGSHIP.length), FLAGSHIP.length - 1)
            // how far scroll is through this project's step: draws the row's amber line
            stage.style.setProperty('--step', (self.progress * FLAGSHIP.length - i).toFixed(3))
            if (i !== last) {
              last = i
              setActive(FLAGSHIP[i])
              // the board behind the page answers each change with a ripple of light
              window.dispatchEvent(new Event('world:ripple'))
            }
          },
        })
      }
      gsap.from(el.querySelectorAll('.proj-row'), {
        opacity: 0, y: 26, stagger: 0.1, ease: 'power2.out',
        scrollTrigger: { trigger: el.querySelector('.proj-index'), start: 'top 88%', end: 'top 55%', scrub: 1.2 },
      })
      gsap.from(el.querySelectorAll('.more-row'), {
        opacity: 0, y: 26, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: el.querySelector('.more-list'), start: 'top 90%', end: 'top 55%', scrub: 1.2 },
      })
    }, el)
    // this section's triggers may be rebuilt after later sections' ones exist
    ScrollTrigger.sort()
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [scene])

  return (
    <section className="projects" id="projects" ref={sectionRef}>
      <div className="proj-scene" ref={sceneRef}>
      <SplitHeading as="h2" className="section-title">
        Selected work
      </SplitHeading>

      {/* ── Flagship — clickable index; on wide screens the hovered project's
          3D miniature shows alongside. Details open in a modal. ── */}
      <div className={`proj-stage${wide ? ' has-view' : ''}`}>
        <div className="proj-index">
          {FLAGSHIP.map((p) => (
            <button
              className={`proj-row${wide && active.id === p.id ? ' is-active' : ''}`}
              key={p.id}
              onMouseEnter={() => setActive(p)}
              onFocus={() => setActive(p)}
              onClick={() => setOpen(p)}
            >
              <span className="proj-row-num">{p.id}</span>
              <span className="proj-row-title">{p.title}</span>
              <span className="proj-row-cat">{p.type}</span>
              <span className="proj-row-go">View ↗</span>
            </button>
          ))}
        </div>

        {wide && (
          <aside className="proj-view">
            <div className="proj-view-frame">
              <Miniature kind={active.mini} preload={MINIS} paused={!!open} label={`3D model: ${active.title}`} />
              <div className="scope-corner tl" />
              <div className="scope-corner tr" />
              <div className="scope-corner bl" />
              <div className="scope-corner br" />
            </div>
            <div className="proj-view-meta">
              <Decode text={active.type} />
              <Decode text={active.metric} />
            </div>
          </aside>
        )}
      </div>
      </div>

      {/* ── More projects — text-only list ── */}
      <div className="more-head"><Decode text="More projects" /></div>
      <div className="more-list">
        {MORE.map((p) => (
          <article className="more-row" key={p.id}>
            <span className="more-num">{p.id}</span>
            <div className="more-main">
              <h3 className="more-title">{p.title}</h3>
              <span className="more-cat">{p.cat}</span>
              <p className="more-desc">{p.desc}</p>
              <div className="project-tags">
                {p.tags.map((t) => <span className="project-tag" key={t}>{t}</span>)}
              </div>
            </div>
            <div className="more-side">
              {p.repo
                ? <a className="project-btn" href={p.repo} target="_blank" rel="noreferrer">GitHub ↗</a>
                : <span className="more-norepo">Academic</span>}
            </div>
          </article>
        ))}
      </div>

      {/* portalled to <body> so it stacks above the fixed nav, not inside this section */}
      {createPortal(
        <AnimatePresence>
          {open && <ProjectModal project={open} onClose={() => setOpen(null)} />}
        </AnimatePresence>,
        document.body
      )}
    </section>
  )
}
