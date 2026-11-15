import { useEffect, useRef, useState } from 'react'

/* ── Inline icons (stroke, inherit colour) ── */
const Ic = {
  home: (
    <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></>
  ),
  about: (
    <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>
  ),
  projects: (
    <><rect x="3.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.4" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.4" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.4" /></>
  ),
  education: (
    <><path d="M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Z" /><path d="M6.5 10.5V15c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.5" /></>
  ),
  contact: (
    <><rect x="3" y="5" width="18" height="14" rx="2.2" /><path d="m3.5 7 8.5 6 8.5-6" /></>
  ),
}

const NAV = [
  { id: 'hero',      label: 'Home',      icon: 'home' },
  { id: 'about',     label: 'About',     icon: 'about' },
  { id: 'projects',  label: 'Projects',  icon: 'projects' },
  { id: 'education', label: 'Education', icon: 'education' },
  { id: 'contact',   label: 'Contact',   icon: 'contact' },
]

export default function Header() {
  const [active, setActive] = useState('hero')
  const railRef = useRef(null)

  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean)
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-40% 0px -55% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const go = (e, id) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: id === 'hero' ? -200 : -40, duration: 1.3 })
    else el.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <a className="brand" href="#hero" onClick={(e) => go(e, 'hero')}>gv</a>

      <nav className="navrail" aria-label="Primary" ref={railRef}>
        <div className="navrail-inner">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={`navrail-btn${active === n.id ? ' active' : ''}`}
              onClick={(e) => go(e, n.id)}
              aria-label={n.label}
              aria-current={active === n.id ? 'true' : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {Ic[n.icon]}
              </svg>
              <span className="navrail-tip">{n.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </>
  )
}
