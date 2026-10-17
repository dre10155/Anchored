<template>
  <div class="min-h-screen">
    <!-- Hero -->
    <section class="relative overflow-hidden pt-28 pb-20 sm:pt-36 sm:pb-28 px-4 sm:px-6 lg:px-8">
      <div class="absolute inset-0 bg-gradient-to-br from-brand-black via-gray-900 to-brand-black"></div>
      <div class="absolute inset-0">
        <div class="absolute -top-20 right-1/4 w-[32rem] h-[32rem] bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div class="absolute bottom-0 left-1/4 w-[28rem] h-[28rem] bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000"></div>
      </div>

      <div class="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <span v-reveal class="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-xs font-medium tracking-wide text-gray-300 uppercase">
            <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-ring"></span>
            Live on XRPL testnet
          </span>

          <h1 v-reveal="1" class="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05]">
            Impossible to forge.<br />
            <span class="text-primary-blue">Free to verify.</span>
          </h1>

          <p v-reveal="2" class="mt-6 text-lg sm:text-xl text-gray-300 max-w-xl">
            Anchored lets any institution or regulator issue licences, certifications and
            diplomas that anyone can check in seconds — with no fee, no account, and no
            phone call to your office.
          </p>

          <div v-reveal="3" class="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <router-link to="/verify" class="px-7 py-3.5 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30 text-center">
              Verify a credential
            </router-link>
            <router-link to="/issue" class="px-7 py-3.5 bg-white/10 border border-white/15 text-white rounded-lg hover:bg-white/15 transition-all font-medium text-center">
              Issue credentials
            </router-link>
          </div>

          <p v-reveal="4" class="mt-5 text-sm text-gray-500">
            Open source · No personal data on the ledger · Verification free forever
          </p>
        </div>

        <div v-reveal="3" class="relative">
          <div class="absolute -inset-4 bg-primary-blue/20 blur-3xl rounded-full"></div>
          <img src="/screens/verified.webp" alt="A credential verifying successfully in Anchored"
            width="1400" height="1188" fetchpriority="high"
            class="relative rounded-xl border border-white/10 shadow-2xl" />
        </div>
      </div>
    </section>

    <!-- The problem -->
    <section class="bg-brand-black border-y border-white/10 py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div class="max-w-5xl mx-auto">
        <h2 v-reveal class="text-2xl sm:text-3xl font-bold text-white text-center max-w-3xl mx-auto">
          A credential is only worth what someone can confirm about it.
        </h2>
        <div class="mt-12 grid sm:grid-cols-3 gap-6">
          <CountUpStat :to="10" suffix=" days" text="Typical wait for an institution to confirm a credential by email or phone." />
          <CountUpStat :to="25" prefix="$" suffix=" per check" text="Charged by commercial verification services — every time, forever." />
          <CountUpStat :to="7600" group text="Fraudulent nursing credentials uncovered in a single 2023 US scheme." />
        </div>
      </div>
    </section>

    <!-- Proof: the three outcomes -->
    <section class="bg-gradient-to-b from-brand-black to-gray-900 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <div v-reveal class="text-center max-w-2xl mx-auto">
          <h2 class="text-3xl sm:text-4xl font-bold text-white">Three answers, in seconds</h2>
          <p class="mt-4 text-gray-400">
            Every check returns one of these. No judgement call, no phone call, no waiting.
            These are screenshots of the live system.
          </p>
        </div>

        <div class="mt-12 grid md:grid-cols-3 gap-6">
          <figure v-for="(state, i) in states" :key="state.title" v-reveal="i" class="flex flex-col">
            <img :src="state.img" :alt="state.alt" loading="lazy" width="1400" height="1188"
              class="rounded-lg border border-white/10 shadow-xl" />
            <figcaption class="mt-4">
              <div class="font-semibold" :class="state.colour">{{ state.title }}</div>
              <p class="mt-1 text-sm text-gray-400">{{ state.text }}</p>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="bg-gray-900 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div class="max-w-6xl mx-auto">
        <div v-reveal class="text-center max-w-2xl mx-auto">
          <h2 class="text-3xl sm:text-4xl font-bold text-white">Four steps, and your office is out of the loop</h2>
          <p class="mt-4 text-gray-400">
            Set up once. After that, verification happens without anyone contacting you.
          </p>
        </div>

        <div class="mt-14 space-y-16 sm:space-y-24">
          <div v-for="(step, i) in steps" :key="step.title"
            class="grid lg:grid-cols-2 gap-8 lg:gap-14 items-center">
            <div v-reveal :class="[i % 2 === 1 ? 'lg:order-2' : '', i % 2 === 1 ? 'reveal-right' : 'reveal-left']">
              <span class="text-primary-blue font-mono text-sm">0{{ i + 1 }}</span>
              <h3 class="mt-2 text-2xl font-bold text-white">{{ step.title }}</h3>
              <p class="mt-3 text-gray-400">{{ step.text }}</p>
              <ul class="mt-4 space-y-2">
                <li v-for="point in step.points" :key="point" class="flex gap-2.5 text-sm text-gray-300">
                  <span class="text-primary-blue mt-0.5">&#10003;</span>{{ point }}
                </li>
              </ul>
            </div>
            <img :src="step.img" :alt="step.alt" loading="lazy" v-reveal="1"
              class="rounded-xl border border-white/10 shadow-2xl"
              :class="[i % 2 === 1 ? 'lg:order-1' : '', i % 2 === 1 ? 'reveal-left' : 'reveal-right']" />
          </div>
        </div>
      </div>
    </section>

    <!-- Why trust it -->
    <section class="bg-brand-black border-t border-white/10 py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div class="max-w-5xl mx-auto">
        <h2 v-reveal class="text-3xl sm:text-4xl font-bold text-white text-center">Why you can trust it</h2>
        <div class="mt-12 grid sm:grid-cols-3 gap-6">
          <div v-for="(pillar, i) in pillars" :key="pillar.title" v-reveal="i" class="bg-white/5 border border-white/10 rounded-xl p-6">
            <h3 class="font-semibold text-white">{{ pillar.title }}</h3>
            <p class="mt-2 text-sm text-gray-400">{{ pillar.text }}</p>
          </div>
        </div>
        <p v-reveal class="mt-10 text-center text-sm text-gray-500">
          Open source under BUSL&#8209;1.1, with a published whitepaper and security policy.
        </p>
      </div>
    </section>

    <!-- Close -->
    <section class="relative overflow-hidden bg-gradient-to-br from-brand-black via-gray-900 to-brand-black py-20 sm:py-28 px-4 sm:px-6 lg:px-8">
      <div class="absolute inset-0">
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-primary-blue rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
      </div>
      <div v-reveal class="relative z-10 max-w-2xl mx-auto text-center">
        <h2 class="text-3xl sm:text-4xl font-bold text-white">See it for yourself</h2>
        <p class="mt-4 text-gray-300">
          Issue a credential, alter it, and watch verification fail — in about two minutes,
          with nothing to install.
        </p>
        <div class="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <router-link to="/issue" class="px-7 py-3.5 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all font-medium shadow-lg shadow-blue-500/30">
            Try it now
          </router-link>
          <a href="https://github.com/dre10155/Anchored" target="_blank" rel="noreferrer"
            class="px-7 py-3.5 bg-white/10 border border-white/15 text-white rounded-lg hover:bg-white/15 transition-all font-medium">
            Read the code
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import CountUpStat from '../components/CountUpStat.vue'


const states = [
  {
    title: 'Verified',
    colour: 'text-green-400',
    img: '/screens/verified.webp',
    alt: 'A genuine credential verifying, naming the issuing institution',
    text: 'Genuine, unaltered, and issued by the organisation it names — confirmed against that organisation’s own domain.',
  },
  {
    title: 'Altered',
    colour: 'text-red-400',
    img: '/screens/rejected.webp',
    alt: 'An altered credential failing verification',
    text: 'One field changed and nothing else. Any edit to any value breaks it, instantly.',
  },
  {
    title: 'Revoked',
    colour: 'text-amber-400',
    img: '/screens/revoked.webp',
    alt: 'A revoked credential reported as withdrawn',
    text: 'Withdrawn by the issuer. Every check from that moment reports it — no bulletin, no stale copy still circulating.',
  },
]

const steps = [
  {
    title: 'Prove who you are, once',
    img: '/screens/identity.webp',
    alt: 'The institution identity page, binding a domain to an issuing wallet',
    text: 'Bind your own domain to your issuing account, in both directions. Verified credentials then display your institution’s name rather than an anonymous identifier.',
    points: [
      'Impersonation requires compromising your website and your keys',
      'Anyone can check the binding independently, forever',
    ],
  },
  {
    title: 'Issue one, or a whole class',
    img: '/screens/issue.webp',
    alt: 'The issuing form, filled in with a credential',
    text: 'Issue a single credential, or anchor an entire graduating class under one signature. Recipients get their credential and a QR code automatically.',
    points: [
      'Forty credentials or four hundred — the same single signature',
      'Only a fingerprint is published; no personal data reaches the ledger',
    ],
  },
  {
    title: 'Anyone verifies, free',
    img: '/screens/verified.webp',
    alt: 'An employer verifying a credential',
    text: 'An employer, university or licensing board uploads the file or scans the QR. They get an answer in seconds, with no account and no fee — and your office never hears about it.',
    points: [
      'Free and permanent — no link that expires after seven days',
      'Expired credentials are flagged automatically',
    ],
  },
  {
    title: 'Withdraw when you must',
    img: '/screens/revoke.webp',
    alt: 'The revocation page listing anchored credentials',
    text: 'Rescind a credential and every future check reflects it immediately — the one thing paper can never do.',
    points: [
      'No bulletin to publish, no copies to chase',
      'The holder’s document is unchanged, and still reports as revoked',
    ],
  },
]

const pillars = [
  {
    title: 'We never hold your keys',
    text: 'You sign with your own wallet, on your own device. A total compromise of our systems could not issue a single fraudulent credential.',
  },
  {
    title: 'No personal data is published',
    text: 'Only a salted fingerprint reaches the ledger. Names, grades and licence details stay with you and the holder — not now, not in twenty years.',
  },
  {
    title: 'It outlives us',
    text: 'Verification relies on a public ledger and open specifications. If Anchored disappeared tomorrow, every credential issued through it would still verify.',
  },
]
</script>
