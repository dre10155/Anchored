<template>
  <div ref="el" class="bg-white/5 border border-white/10 rounded-xl p-6">
    <!-- tabular-nums keeps the width steady while the digits change, so the
         card does not jitter as the number climbs. -->
    <div class="text-3xl font-bold text-primary-blue tabular-nums">
      {{ prefix }}{{ display }}{{ suffix }}
    </div>
    <p class="mt-2 text-sm text-gray-400">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { useCountUp } from '../composables/useCountUp'

const props = defineProps<{
  /** Final value to count to */
  to: number
  /** e.g. "$" */
  prefix?: string
  /** e.g. " days" or "–25" */
  suffix?: string
  /** Thousand-separate the number while counting */
  group?: boolean
  text: string
}>()

const { el, display } = useCountUp(
  props.to,
  props.group ? (n: number) => n.toLocaleString('en-US') : undefined,
)
</script>
