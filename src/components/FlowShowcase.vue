<template>
  <!-- A device pinned while the four flows scroll past it, in the order an
       institution meets them.

       The frame changes with the step: Identity, Issue and Revoke are desk
       work and appear in a browser; Verify appears in a phone, because that is
       genuinely where it happens — an employer scanning a QR. Putting a
       registrar's batch-issuing screen in a phone would look slicker and
       misrepresent how the product is used. -->
  <section class="relative bg-gray-900 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
    <div class="max-w-6xl mx-auto">
      <div v-reveal class="text-center max-w-2xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-bold text-white">Four steps, and your office is out of the loop</h2>
        <p class="mt-4 text-gray-400">
          Set up once. After that, verification happens without anyone contacting you.
        </p>
      </div>

      <div class="mt-14 grid lg:grid-cols-2 gap-10 lg:gap-16 lg:items-stretch">
        <!-- Steps -->
        <!-- Each step occupies most of a screen height, so there is real scroll
             distance between them and the pinned device has time to change. -->
        <ol class="space-y-10 lg:space-y-0">
          <li v-for="(step, i) in steps" :key="step.title" :ref="(el) => setStepRef(el, i)"
            class="transition-opacity duration-500 lg:min-h-[78vh] lg:flex lg:flex-col lg:justify-center"
            :class="active === i ? 'opacity-100' : 'lg:opacity-35'">
            <div class="flex items-center gap-3">
              <span class="flex items-center justify-center w-8 h-8 rounded-full text-sm font-mono transition-colors duration-500"
                :class="active === i ? 'bg-primary-blue text-white' : 'bg-white/10 text-gray-400'">
                {{ i + 1 }}
              </span>
              <h3 class="text-xl sm:text-2xl font-bold text-white">{{ step.title }}</h3>
            </div>
            <p class="mt-3 text-gray-400">{{ step.text }}</p>
            <ul class="mt-4 space-y-2">
              <li v-for="point in step.points" :key="point" class="flex gap-2.5 text-sm text-gray-300">
                <span class="text-primary-blue mt-0.5">&#10003;</span>{{ point }}
              </li>
            </ul>

            <!-- On narrow screens the device sits with its step instead of being pinned. -->
            <div class="mt-6 lg:hidden">
              <DeviceFrame :kind="step.device" :src="step.img" :alt="step.alt" />
            </div>
          </li>
        </ol>

        <!-- Pinned device. The outer div is the grid item and stretches to the
             full row; the sticky element lives inside it, so it has the whole
             section to travel through. -->
        <div class="hidden lg:block relative">
          <div class="sticky top-24 h-[76vh] flex items-center justify-center">
            <!-- Fading a single persistent instance rather than swapping two
                 with <Transition>: out-in kept resolving to an empty container,
                 and a device that vanishes is worse than one that cross-fades. -->
            <div class="w-full transition-all duration-300"
              :class="swapping ? 'opacity-0 translate-y-3' : 'opacity-100'">
              <DeviceFrame :kind="shownStep.device" :src="shownStep.img" :alt="shownStep.alt" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import DeviceFrame from './DeviceFrame.vue'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const steps = [
  {
    title: 'Prove who you are, once',
    device: 'browser' as const,
    img: '/screens/identity.webp',
    alt: 'Binding an institution domain to its issuing wallet',
    text: 'Bind your own domain to your issuing account, in both directions. Verified credentials then display your institution’s name rather than an anonymous identifier.',
    points: [
      'Impersonation requires compromising your website and your keys',
      'Anyone can check the binding independently, forever',
    ],
  },
  {
    title: 'Issue one, or a whole class',
    device: 'browser' as const,
    img: '/screens/issue.webp',
    alt: 'Issuing a credential',
    text: 'Issue a single credential, or anchor an entire graduating class under one signature. Recipients get their credential and a QR code automatically.',
    points: [
      'Forty credentials or four hundred — the same single signature',
      'Only a fingerprint is published; no personal data reaches the ledger',
    ],
  },
  {
    title: 'Anyone verifies, free',
    device: 'phone' as const,
    img: '/screens/m-verify.webp',
    alt: 'An employer verifying a credential on a phone',
    text: 'An employer scans the QR on their phone and has an answer in seconds — no account, no fee, and your office never hears about it.',
    points: [
      'Free and permanent — no link that expires after seven days',
      'Expired credentials are flagged automatically',
    ],
  },
  {
    title: 'Withdraw when you must',
    device: 'browser' as const,
    img: '/screens/revoke.webp',
    alt: 'Revoking a credential',
    text: 'Rescind a credential and every future check reflects it immediately — the one thing paper can never do.',
    points: [
      'No bulletin to publish, no copies to chase',
      'The holder’s document is unchanged, and still reports as revoked',
    ],
  },
]

const active = ref(0)
// What the device is currently displaying. Trails `active` by half a fade, so
// the image changes while it is invisible.
const shown = ref(0)
const swapping = ref(false)
const shownStep = computed(() => steps[shown.value])
let swapTimer = 0

watch(active, (next) => {
  if (next === shown.value) return
  if (prefersReducedMotion()) {
    shown.value = next
    return
  }
  swapping.value = true
  clearTimeout(swapTimer)
  swapTimer = window.setTimeout(() => {
    shown.value = active.value
    swapping.value = false
  }, 160)
})

const stepEls: (HTMLElement | null)[] = []

function setStepRef(el: any, i: number) {
  stepEls[i] = (el as HTMLElement) ?? null
}

// Which step is nearest the middle of the viewport decides what the pinned
// device shows. Position is measured directly rather than observed, for the
// same reason the reveal directive does: a fast scroll must not leave the
// device showing the wrong screen.
let queued = false
function onScroll() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    const middle = window.innerHeight / 2
    let best = 0
    let bestDistance = Infinity
    stepEls.forEach((el, i) => {
      if (!el) return
      const box = el.getBoundingClientRect()
      const distance = Math.abs(box.top + box.height / 2 - middle)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    })
    active.value = best
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  clearTimeout(swapTimer)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
})
</script>
