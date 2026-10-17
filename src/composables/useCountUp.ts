// Tick a number up from zero when it scrolls into view.
//
// Used for the three figures on the landing page. The one that matters is
// 7,600 — the fraudulent nursing credentials found in a single scheme — and
// watching it climb lands harder than reading it.

import { ref, onMounted, onUnmounted, type Ref } from 'vue'

const DURATION_MS = 1100

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useCountUp(target: number, format?: (n: number) => string) {
  const el = ref<HTMLElement | null>(null)
  const display: Ref<string> = ref(
    // Start at the final value, so the number is correct before any animation
    // runs and stays correct if none ever does.
    (format ?? String)(prefersReducedMotion() ? target : 0),
  )

  let frame = 0
  let observer: IntersectionObserver | null = null

  function run() {
    const started = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - started) / DURATION_MS, 1)
      // Ease out: fast at first, settling at the end — reads as deceleration
      // rather than a mechanical ramp.
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = (format ?? String)(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  onMounted(() => {
    if (prefersReducedMotion() || !el.value) return
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer?.disconnect()
        run()
      },
      { threshold: 0.5 },
    )
    observer.observe(el.value)
  })

  onUnmounted(() => {
    cancelAnimationFrame(frame)
    observer?.disconnect()
  })

  return { el, display }
}
