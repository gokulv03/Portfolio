import { useEffect, useState } from 'react'

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
  // three linked nodes: the network on the personal page
  personal: (
    <><circle cx="6" cy="7" r="2.3" /><circle cx="18" cy="9" r="2.3" /><circle cx="11" cy="18" r="2.3" /><path d="m8.2 7.6 7.5 1M7 9.1l3 6.8M16.6 10.8l-4.2 5.4" /></>
  ),
}

/* sections of the work page: these scroll */
const NAV = [
  { id: 'hero',      label: 'Home',      icon: 'home' },
  { id: 'about',     label: 'About',     icon: 'about' },
  { id: 'projects',  label: 'Projects',  icon: 'projects' },
  { id: 'education', label: 'Education', icon: 'education' },
  { id: 'contact',   label: 'Contact',   icon: 'contact' },
]

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {Ic[name]}
  </svg>
)

/**
 * Header — the brand mark and the nav rail. On the work page the rail scrolls
 * to its sections and, set apart below them, has one entry that leaves for the
 * personal page. On the personal page it is just the way back and that entry.
 */
export default function Header({ page = 'home', onNavigate }) {
  const [active, setActive] = useState('hero')
  const personal = page === 'personal'

  useEffect(() => {
    if (personal) return
    setActive('hero')
    const els = NAV.map((n) => document.getElementById(n.id)).filter(Boolean)
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-40% 0px -55% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [personal])

  const go = (e, id) => {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: id === 'hero' ? -200 : -40, duration: 1.3 })
    else el.scrollIntoView({ behavior: 'smooth' })
  }
  const leave = (e, to) => { e.preventDefault(); onNavigate?.(to) }

  return (
    <>
      <a
        className="brand"
        href={personal ? '/' : '#hero'}
        onClick={(e) => (personal ? leave(e, 'home') : go(e, 'hero'))}
      >
        gv
      </a>

      <nav className="navrail" aria-label="Primary">
        <div className="navrail-inner">
          {personal ? (
            <a href="/" className="navrail-btn" onClick={(e) => leave(e, 'home')} aria-label="Back to the work">
              <Icon name="home" />
              <span className="navrail-tip">Back to the work</span>
            </a>
          ) : (
            NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className={`navrail-btn${active === n.id ? ' active' : ''}`}
                onClick={(e) => go(e, n.id)}
                aria-label={n.label}
                aria-current={active === n.id ? 'true' : undefined}
              >
                <Icon name={n.icon} />
                <span className="navrail-tip">{n.label}</span>
              </a>
            ))
          )}

          <span className="navrail-sep" aria-hidden="true" />

          <a
            href="/personal"
            className={`navrail-btn${personal ? ' active' : ''}`}
            onClick={(e) => leave(e, 'personal')}
            aria-label="Personal"
            aria-current={personal ? 'page' : undefined}
          >
            <Icon name="personal" />
            <span className="navrail-tip">Personal</span>
          </a>
        </div>
      </nav>
    </>
  )
}
