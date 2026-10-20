<template>
  <!-- One unconditional root element. An earlier version put v-if/v-else at the
       root, which left <Transition> unable to track the component across a swap:
       it would play the leave, then render nothing at all. -->
  <div class="relative mx-auto" :class="kind === 'phone' ? 'w-[clamp(220px,26vw,290px)]' : 'w-full max-w-xl'">
    <div class="absolute -inset-6 bg-primary-blue/20 blur-3xl rounded-full"></div>

    <!-- Phone -->
    <div v-if="kind === 'phone'"
      class="relative rounded-[2.2rem] border border-white/15 bg-gray-950 p-2 shadow-2xl ring-1 ring-black/40">
      <div class="absolute left-1/2 top-3 -translate-x-1/2 h-1.5 w-16 rounded-full bg-white/15 z-10"></div>
      <img :src="src" :alt="alt" loading="lazy"
        class="rounded-[1.8rem] w-full object-cover object-top aspect-[9/19]" />
    </div>

    <!-- Browser -->
    <div v-else class="relative rounded-xl border border-white/15 bg-gray-950 shadow-2xl overflow-hidden">
      <div class="flex items-center gap-1.5 px-3 py-2.5 border-b border-white/10 bg-white/5">
        <span class="w-2.5 h-2.5 rounded-full bg-white/20"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-white/20"></span>
        <span class="w-2.5 h-2.5 rounded-full bg-white/20"></span>
        <div class="ml-2 flex-1 h-5 rounded bg-white/5 border border-white/10"></div>
      </div>
      <img :src="src" :alt="alt" loading="lazy" class="w-full block" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  kind: 'phone' | 'browser'
  src: string
  alt: string
}>()
</script>
