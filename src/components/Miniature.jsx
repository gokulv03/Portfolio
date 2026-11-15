import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

/**
 * Miniature — a small draggable 3D model (see src/three/stage.js).
 * three.js is imported on demand, so it never weighs on first paint. If WebGL
 * is unavailable the slot simply stays empty.
 *
 * A parent can hand in scroll progress through the ref (`setProgress(0..1)`)
 * to turn the model and, where the model supports it, take it apart.
 *
 * `preload` lists other kinds this slot will switch to, so they can be built
 * ahead of time and the first swap does not hitch.
 */
const Miniature = forwardRef(function Miniature(
  { kind, label, paused = false, fill, preload, className = '' },
  ref
) {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const kindRef = useRef(kind)
  const pausedRef = useRef(paused)
  const progressRef = useRef(0)
  const [state, setState] = useState('loading') // loading | ready | failed
  const [swapping, setSwapping] = useState(false)

  useImperativeHandle(ref, () => ({
    setProgress(p) {
      progressRef.current = p
      stageRef.current?.setProgress(p)
    },
  }), [])

  useEffect(() => {
    let cancelled = false
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    import('../three/stage.js')
      .then(({ createStage }) => {
        if (cancelled || !canvasRef.current) return
        const stage = createStage(canvasRef.current, { kind: kindRef.current, reduce, fill })
        stage.setPaused(pausedRef.current)
        stage.setProgress(progressRef.current)
        if (preload) stage.preload(preload)
        stageRef.current = stage
        setState('ready')
      })
      .catch(() => { if (!cancelled) setState('failed') })
    return () => {
      cancelled = true
      stageRef.current?.dispose()
      stageRef.current = null
    }
  }, [fill])

  // swap models behind a short fade
  useEffect(() => {
    if (kindRef.current === kind) return
    kindRef.current = kind
    if (!stageRef.current) return
    setSwapping(true)
    const id = setTimeout(() => {
      stageRef.current?.setKind(kind)
      setSwapping(false)
    }, 170)
    return () => clearTimeout(id)
  }, [kind])

  useEffect(() => {
    pausedRef.current = paused
    stageRef.current?.setPaused(paused)
  }, [paused])

  if (state === 'failed') return null

  return (
    <canvas
      ref={canvasRef}
      className={`mini${state === 'ready' && !swapping ? ' is-on' : ''} ${className}`}
      role="img"
      aria-label={label}
    />
  )
})

export default Miniature
