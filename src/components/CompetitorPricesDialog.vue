<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NCard, NSpin, NTag, NEmpty } from 'naive-ui'
import api from '../api/client'
import MoneyValue from './MoneyValue.vue'

const props = defineProps<{
  show: boolean
  productId: number | null
  productName?: string | null
  currentSale: number | null | undefined
  newPrice: number | null | undefined
}>()

const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>()

interface Row {
  id: number
  competitor: { id: number; name: string }
  price: number | null
  observed_at: string | null
}

const loading = ref(false)
const rows = ref<Row[]>([])

watch(
  () => props.show,
  async (open) => {
    if (!open || props.productId == null) return
    loading.value = true
    rows.value = []
    try {
      const { data } = await api.get(`/products/${props.productId}/competitor_prices`)
      rows.value = data.prices
    } finally {
      loading.value = false
    }
  }
)

// Our reference for "are we cheaper" — the proposed new price if set, else current sale.
function ref_price(): number | null {
  return props.newPrice ?? props.currentSale ?? null
}
function cheaperThanUs(price: number | null): boolean {
  const r = ref_price()
  return r != null && price != null && price < r
}
</script>

<template>
  <NModal :show="show" @update:show="(v) => emit('update:show', v)">
    <NCard style="width: 520px" closable @close="emit('update:show', false)">
      <template #header>
        Competitor prices<template v-if="productName"> · {{ productName }}</template>
      </template>

      <div class="cp-ours">
        <span class="cp-our"><span class="cp-l">Our current</span><span class="cp-v mono"><MoneyValue :value="currentSale" /></span></span>
        <span class="cp-our cp-our-new"><span class="cp-l">Our new price</span><span class="cp-v mono"><MoneyValue :value="newPrice" /></span></span>
      </div>

      <NSpin :show="loading">
        <div v-if="rows.length" class="cp-list">
          <div v-for="(r, i) in rows" :key="r.id" class="cp-row" :class="{ lowest: i === 0 }">
            <span class="cp-name">{{ r.competitor.name }}</span>
            <span class="cp-tags">
              <NTag v-if="i === 0" size="tiny" type="info" :bordered="false">lowest</NTag>
              <NTag v-if="cheaperThanUs(r.price)" size="tiny" type="warning" :bordered="false">cheaper than us</NTag>
            </span>
            <span class="cp-price mono"><MoneyValue :value="r.price" /></span>
          </div>
        </div>
        <NEmpty v-else-if="!loading" description="No competitor prices for this product" style="padding: 20px 0" />
      </NSpin>
    </NCard>
  </NModal>
</template>

<style scoped>
.cp-ours { display: flex; gap: 14px; margin-bottom: 16px; }
.cp-our {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 14px;
  background: #f1effb;
  border: 1px solid #d9d4f5;
  border-radius: 8px;
}
.cp-our-new { background: #ecf7f1; border-color: #bfe3cf; }
.cp-our-new .cp-l, .cp-our-new .cp-v { color: #15935b; }
.cp-l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #6a5fd0; font-weight: 600; }
.cp-our-new .cp-l { color: #15935b; }
.cp-v { font-size: 22px; font-weight: 700; color: #4a40c2; }

.cp-list { display: flex; flex-direction: column; }
.cp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #f4f5f7;
}
.cp-row.lowest { background: #f0f6ff; border-radius: 8px; }
.cp-name { font-weight: 600; color: #2b2b33; }
.cp-tags { display: inline-flex; gap: 6px; }
.cp-price { margin-left: auto; font-size: 17px; font-weight: 700; color: #2b2b33; }
</style>
