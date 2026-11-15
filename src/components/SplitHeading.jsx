import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * Splits text into word spans with overflow:hidden masks.
 * Each word is revealed directly proportional to scroll position —
 * scroll fast → words appear fast, scroll back → words retreat.
 * This is the scrub-linked reveal used on Lenis/darkroom.engineering sites.
 */
export default function SplitHeading({
  children,
  as: Tag   = 'h2',
  className = '',
  delay     = 0,
  end       = 'top 18%', // where the reveal completes; raise it for headings near the page end
}) {
  const ref  = useRef(null)
  const text = String(children)
  const words = text.split(' ')

  useEffect(() => {
    const container = ref.current
    if (!container) return

    const wordEls = container.querySelectorAll('.sh-word')

    const ctx = gsap.context(() => {
      // Build a staggered timeline that plays scrubbed with scroll
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start:   'top 88%',
          end,
          scrub:   1.8,          // smoothing on the scrub (feels weighted)
        },
      })

      tl.from(wordEls, {
        y:       '112%',
        opacity: 0,
        x:       -6,
        stagger: { each: 0.06 },
        ease:    'power2.out',
        delay,
      })
    }, container)

    return () => ctx.revert()
  }, [delay, end])

  return (
    <Tag className={className} ref={ref} aria-label={text}>
      {words.map((word, i) => (
        <span
          key={i}
          className="sh-mask"
          style={{
            display:       'inline-block',
            overflow:      'hidden',
            verticalAlign: 'bottom',
            lineHeight:    '1.08',
          }}
        >
          <span className="sh-word" style={{ display: 'inline-block' }}>
            {word}
          </span>
          {i < words.length - 1 && (
            <span style={{ display: 'inline-block', width: '0.26em' }}>&nbsp;</span>
          )}
        </span>
      ))}
    </Tag>
  )
}
