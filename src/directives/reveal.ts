// v-reveal — fade an element up as it scrolls into view.
//
// Deliberately not a library. The whole effect is a scroll listener and two CSS
// classes, and a landing page that argues for lightness should not ship 50KB of
// animation framework to achieve it.
//
//   <div v-reveal>            fades up when it enters the viewport
//   <div v-reveal="2">        same, delayed by 2 steps (for staggering a row)
//
// Elements start hidden only when motion is actually going to run, so with
// JavaScript disabled — or reduced motion requested — the page renders fully
// visible rather than blank.
//
// Why a scroll listener rather than IntersectionObserver: an observer only
// reports when an intersection *changes*, and a fast scroll can carry an
// element from below the viewport to above it between two samples, so it is
// never reported and stays invisible forever. On a page whose job is to be
// read, content that never appears is a far worse failure than an animation
// nobody watched. Checking position directly cannot miss.

import type { Directive } from 'vue'

const STEP_MS = 90
/** Reveal once the top edge is this far into the viewport. */
const TRIGGER = 0.92

const pending = new Set<HTMLElement>()
let listening = false
let queued = false

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function check() {
  queued = false
  const height = window.innerHeight

  for (const el of pending) {
    const box = el.getBoundingClientRect()
    if (box.top >= height * TRIGGER) continue

    // Already scrolled past: show it immediately rather than animating
    // something the reader has gone by.
    if (box.bottom < 0) el.style.transitionDuration = '0ms'

    el.classList.add('is-revealed')
    pending.delete(el)
  }

  if (!pending.size) stopListening()
}

function schedule() {
  if (queued) return
  queued = true
  requestAnimationFrame(check)
}

function startListening() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}

function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    if (prefersReducedMotion()) return

    el.classList.add('reveal')
    const step = Number(binding.value) || 0
    if (step) el.style.transitionDelay = `${step * STEP_MS}ms`

    pending.add(el)
    startListening()
    // Anything already on screen at load (the hero) plays immediately rather
    // than waiting for a scroll that may never come.
    schedule()
  },
  unmounted(el) {
    pending.delete(el)
    if (!pending.size) stopListening()
  },
}
