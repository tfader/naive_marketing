<script setup lang="ts">
import { computed } from 'vue'
import { currency, numberLocale } from '../composables/parameters'

const props = defineProps<{ value: string | number | null | undefined }>()

const parts = computed(() => {
  if (props.value == null || props.value === '') return null
  const n = Number(props.value)
  if (Number.isNaN(n)) return null
  const cur = currency()
  try {
    const p = new Intl.NumberFormat(numberLocale(), {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(n)
    const symbol = p.find((x) => x.type === 'currency')?.value ?? cur
    const number = p
      .filter((x) => x.type !== 'currency')
      .map((x) => x.value)
      .join('')
      .trim()
    return { number, symbol }
  } catch {
    return { number: n.toFixed(2), symbol: cur }
  }
})
</script>

<template>
  <span v-if="parts" class="money"><span class="money-num">{{ parts.number }}</span><span class="money-cur">{{ parts.symbol }}</span></span>
  <span v-else>—</span>
</template>

<style scoped>
.money {
  white-space: nowrap;
}
.money-cur {
  font-size: 0.76em;
  color: #8a909c;
  margin-left: 3px;
}
</style>
