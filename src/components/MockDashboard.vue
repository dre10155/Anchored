<template>
  <!-- Built in markup rather than shown as a screenshot: it stays sharp at any
       size, weighs nothing, and the numbers can animate.

       The figures are illustrative, and labelled as such. Note there is no
       "times verified" count anywhere here — verification happens between the
       holder, the verifier and the public ledger, with Anchored not involved.
       Counting it would mean logging who checked whom, which is exactly what
       the product promises not to do. -->
  <div ref="root" class="rounded-2xl border border-white/10 bg-gray-900/80 backdrop-blur p-5 sm:p-6 shadow-2xl">
    <div class="flex items-center justify-between gap-4">
      <div>
        <div class="text-xs uppercase tracking-widest text-gray-500">Issuer workspace</div>
        <div class="mt-1 font-semibold text-white">Credential dashboard</div>
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
        salcc.edu.lc
      </div>
    </div>

    <div class="mt-5 grid grid-cols-3 gap-3">
      <div v-for="stat in stats" :key="stat.label" class="rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4">
        <div class="text-xl sm:text-2xl font-bold tabular-nums" :class="stat.colour">{{ stat.shown }}</div>
        <div class="mt-0.5 text-[11px] sm:text-xs text-gray-400 leading-tight">{{ stat.label }}</div>
      </div>
    </div>

    <div class="mt-5 space-y-2">
      <div v-for="(row, i) in rows" :key="row.ref"
        class="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2.5 transition-all duration-500"
        :style="{ opacity: shown > i ? 1 : 0, transform: shown > i ? 'none' : 'translateY(8px)' }">
        <div class="min-w-0">
          <div class="text-sm text-gray-200 truncate">{{ row.label }}</div>
          <div class="text-[11px] text-gray-500 font-mono truncate">{{ row.ref }}</div>
        </div>
        <span class="text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
          :class="row.state === 'Revoked' ? 'bg-amber-400/15 text-amber-300' : 'bg-green-400/15 text-green-300'">
          {{ row.state }}
        </span>
      </div>
    </div>

    <p class="mt-4 text-[11px] text-gray-500">Illustrative data</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'

const root = ref<HTMLElement | null>(null)
const shown = ref(0)

const stats = reactive([
  { label: 'Credentials anchored', target: 412, shown: '0', colour: 'text-primary-blue' },
  { label: 'Currently valid', target: 398, shown: '0', colour: 'text-green-400' },
  { label: 'Revoked', target: 14, shown: '0', colour: 'text-amber-400' },
])

const rows = [
  { label: 'Associate Degree in Nursing — Class of 2026', ref: 'vc:merkle:2ec5884e…', state: 'Live' },
  { label: 'Explosives Handling Licence', ref: 'vc:sha256:a27fa348…', state: 'Live' },
  { label: 'Petroleum Storage Licence', ref: 'vc:sha256:77820582…', state: 'Revoked' },
]

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

let frame = 0
let observer: IntersectionObserver | null = null
let timers: number[] = []

function play() {
  const started = performance.now()
  const DURATION = 1000
  const tick = (now: number) => {
    const progress = Math.min((now - started) / DURATION, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    for (const stat of stats) stat.shown = String(Math.round(stat.target * eased))
    if (progress < 1) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  rows.forEach((_, i) => {
    timers.push(window.setTimeout(() => { shown.value = i + 1 }, 260 + i * 140))
  })
}

onMounted(() => {
  if (reduced() || !root.value) {
    for (const stat of stats) stat.shown = String(stat.target)
    shown.value = rows.length
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (!entries[0]?.isIntersecting) return
    observer?.disconnect()
    play()
  }, { threshold: 0.35 })
  observer.observe(root.value)
})

onUnmounted(() => {
  cancelAnimationFrame(frame)
  observer?.disconnect()
  timers.forEach(clearTimeout)
})
</script>
