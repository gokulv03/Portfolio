import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import Miniature from './Miniature.jsx'

/**
 * ProjectModal — detail view that opens on click: a draggable 3D miniature
 * of the project beside its overview, highlights, role, metric and stack.
 *
 * It switches on like a screen (a line that opens into the panel), then the
 * content settles in. Focus moves into the dialog, Tab stays inside it, and
 * focus returns to where it was on close.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
const CLOSED = 'inset(49.6% 0% 49.6% 0%)'
const OPEN = 'inset(0% 0% 0% 0%)'

const settle = (delay) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] },
})

export default function ProjectModal({ project, onClose }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const before = document.activeElement
    const panel = panelRef.current
    window.__lenis?.stop()
    panel?.querySelector('.pm-close')?.focus({ preventScroll: true })

    const onKey = (e) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !panel) return
      const items = panel.querySelectorAll(FOCUSABLE)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const at = document.activeElement
      if (!panel.contains(at)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.__lenis?.start()
      window.removeEventListener('keydown', onKey)
      before?.focus?.({ preventScroll: true })
    }
  }, [])

  const p = project

  return (
    <motion.div
      className="pm-backdrop"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.article
        className="pm"
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0.6, clipPath: CLOSED }}
        animate={{ opacity: 1, clipPath: OPEN }}
        exit={{ opacity: 0, clipPath: CLOSED }}
        transition={{ duration: 0.5, ease: [0.76, 0, 0.24, 1] }}
        role="dialog"
        aria-modal="true"
        aria-label={p.title}
      >
        <button className="pm-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="pm-scroll" data-lenis-prevent>
          <header className="pm-head">
            <motion.div className="pm-head-text" {...settle(0.28)}>
              <div className="pm-eyebrow">
                <span className="pm-num">{p.id}</span>
                <span>{p.type}</span>
              </div>
              <h2 className="pm-title">{p.title}</h2>
              <p className="pm-lede">{p.desc}</p>
            </motion.div>
            {p.mini && (
              <div className="pm-mini">
                <Miniature kind={p.mini} fill={0x0a0e11} label={`3D model: ${p.title}`} />
              </div>
            )}
          </header>

          <div className="pm-body">
            <motion.div className="pm-col-main" {...settle(0.38)}>
              <span className="pm-label">Overview</span>
              <p className="pm-text">{p.overview}</p>

              <span className="pm-label">Highlights</span>
              <ul className="pm-list">
                {p.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>
            </motion.div>

            <motion.aside className="pm-col-side" {...settle(0.46)}>
              <div className="pm-meta">
                <span className="pm-label">{p.metricLabel || 'Outcome'}</span>
                <span className="pm-metric">{p.metric}</span>
              </div>
              <div className="pm-meta">
                <span className="pm-label">Role</span>
                <span className="pm-side-val">{p.role}</span>
              </div>
              <div className="pm-meta">
                <span className="pm-label">Stack</span>
                <div className="project-tags">
                  {p.tags.map((t) => <span className="project-tag" key={t}>{t}</span>)}
                </div>
              </div>
              {p.repo && (
                <a className="project-btn" href={p.repo} target="_blank" rel="noreferrer">View on GitHub ↗</a>
              )}
            </motion.aside>
          </div>
        </div>
      </motion.article>
    </motion.div>
  )
}
