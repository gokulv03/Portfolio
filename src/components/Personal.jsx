import { useEffect, useRef, useState } from 'react'
import Mind from './Mind.jsx'
import Miniature from './Miniature.jsx'
import Decode from './Decode.jsx'

/**
 * Personal — a separate page (at /personal), off the main scroll: the story
 * behind the work, told as six moments. Blue on black where the main page is
 * amber on a circuit board. As each moment reaches the middle of the screen it
 * comes into focus, the network behind the page (Mind.jsx) lights one hub
 * further, and the 3D model in the middle of it changes to that moment's.
 */
const MOMENTS = [
  {
    mini: 'medic',
    tag: 'Where it started',
    title: 'Medicine came first',
    text: 'My first plan was not engineering. I wanted to study medicine. Health issues and the circumstances at the time closed that door in India, and I had to find another way forward.',
  },
  {
    mini: 'volley',
    tag: 'Growing up',
    title: 'Courts and sketchbooks',
    text: 'Alongside school there were two constants: sport, and sketching and painting. I was good at most sports, but volleyball was the one. On that court, through school and college, I felt a little like a celebrity.',
  },
  {
    mini: 'campus',
    tag: 'Bangalore',
    title: 'An engineer, reluctantly',
    text: 'I started a bachelor’s in Electronics and Communication at Dayananda Sagar College of Engineering. To be honest, it did not interest me much at first.',
  },
  {
    mini: 'rail',
    tag: 'The turn',
    title: 'The rail launcher',
    text: 'That changed with the projects, and one above all: an electromagnetic rail launcher. Somewhere in that build, electronics stopped being a degree and became something I wanted to do. I knew then that I wanted to come back to power electronics.',
  },
  {
    mini: 'five',
    tag: 'People',
    title: 'Five who became family',
    text: 'Those years also gave me my people. I had many friends then and I still do, but a group of five became family and has stayed that way. Three of us are in Germany now.',
  },
  {
    mini: 'buck',
    tag: 'Now',
    title: 'Back to power electronics',
    text: 'The rail launcher is the reason I chose a master’s in electrical engineering. The thesis I am writing now is in power electronics, which is where I had wanted to return ever since.',
  },
]

const MINIS = MOMENTS.map((m) => m.mini)
const BLUE = 0x5a9dff

export default function Personal({ ready, onHome }) {
  const rootRef = useRef(null)
  const mindRef = useRef(null)
  const [active, setActive] = useState(-1) // -1 = the opening, before the story

  // whichever moment is crossing the middle of the screen is the active one
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const items = [...root.querySelectorAll('[data-moment]')]
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const index = Number(entry.target.dataset.moment)
        items.forEach((el) => el.classList.toggle('is-active', el === entry.target))
        mindRef.current?.setActive(index)
        setActive(index)
      })
    }, { rootMargin: '-48% 0px -48% 0px' })
    items.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const home = (e) => { e.preventDefault(); onHome() }

  return (
    <main className={`personal${ready ? ' is-ready' : ''}`} ref={rootRef}>
      <Mind ref={mindRef} hubs={MOMENTS.length} />

      {/* one 3D model per moment, held in the middle of the network */}
      <aside className={`pj-stage${active >= 0 ? ' is-on' : ''}`}>
        <Miniature
          kind={MOMENTS[Math.max(active, 0)].mini}
          preload={MINIS}
          accent={BLUE}
          threshold={0.24}
          fill={0x000000}
          label={`3D model: ${MOMENTS[Math.max(active, 0)].title}`}
        />
        <span className="pj-stage-hint">Drag to rotate</span>
      </aside>

      {/* the opening counts as "before the story": nothing lit yet */}
      <header className="pj-head" data-moment="-1">
        <span className="pj-eyebrow"><Decode text="Personal" active={ready} /></span>
        <h1 className="pj-title">How I got here</h1>
        <p className="pj-lede">The part of the story that does not fit on a CV.</p>
        <span className="pj-hint">Scroll</span>
      </header>

      <ol className="pj-list">
        {MOMENTS.map((m, i) => (
          <li className="pj-moment" key={m.title} data-moment={i}>
            <span className="pj-tag">{m.tag}</span>
            <h2 className="pj-moment-title">{m.title}</h2>
            <p className="pj-moment-text">{m.text}</p>
          </li>
        ))}
      </ol>

      <footer className="pj-end" data-moment={MOMENTS.length - 1}>
        <p className="pj-end-line">That is the road so far.</p>
        <a className="btn-line" href="/" onClick={home}>
          <span aria-hidden="true">←</span> Back to the work
        </a>
      </footer>
    </main>
  )
}
