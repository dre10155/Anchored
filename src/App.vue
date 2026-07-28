<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const menuOpen = ref(false)
const route = useRoute()

// Close the mobile menu whenever navigation happens
watch(() => route.fullPath, () => { menuOpen.value = false })

const links = [
  { to: '/issue', label: 'Issue' },
  { to: '/revoke', label: 'Revoke' },
  { to: '/identity', label: 'Identity' },
]
</script>

<template>
  <div class="min-h-screen flex flex-col bg-brand-black">
    <header class="fixed top-0 inset-x-0 z-50 bg-brand-black/90 backdrop-blur border-b border-white/10">
      <nav class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <RouterLink to="/" class="flex items-center gap-2 text-white font-bold text-lg sm:text-xl shrink-0">
          <span class="text-primary-blue text-2xl">&#9875;</span>
          <span>Anchor<span class="text-primary-blue">ed</span></span>
        </RouterLink>

        <!-- Desktop -->
        <div class="hidden md:flex items-center gap-6">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="text-gray-300 hover:text-white transition-colors font-medium"
          >{{ link.label }}</RouterLink>
          <RouterLink to="/verify" class="px-4 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium">Verify</RouterLink>
        </div>

        <!-- Mobile: keep the primary action visible, tuck the rest behind a menu -->
        <div class="flex items-center gap-2 md:hidden">
          <RouterLink to="/verify" class="px-3 py-2 bg-primary-blue text-white rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm">Verify</RouterLink>
          <button
            @click="menuOpen = !menuOpen"
            class="p-2 text-gray-300 hover:text-white transition-colors"
            :aria-expanded="menuOpen"
            aria-label="Toggle navigation menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path v-if="!menuOpen" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h16M4 17h16" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </nav>

      <div v-if="menuOpen" class="md:hidden border-t border-white/10 bg-brand-black/95 backdrop-blur">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block px-4 py-4 text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium border-b border-white/5"
        >{{ link.label }}</RouterLink>
      </div>
    </header>

    <main class="flex-grow">
      <RouterView />
    </main>

    <footer class="border-t border-white/10 py-6">
      <div class="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
        Anchored — credentials anchored on the XRP Ledger · Testnet
      </div>
    </footer>
  </div>
</template>
