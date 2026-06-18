<script setup lang="ts">
import { NIcon, NButton } from 'naive-ui'
import { CubeOutline, CloseOutline, CreateOutline } from '@vicons/ionicons5'

interface ProductLike {
  id: number
  code: string
  name: string
  current_cost_price?: string | number | null
  current_sale_price?: string | number | null
  avg_daily_sales?: string | number | null
  lower_sale_price_last_30_days?: string | number | null
  promotion_factor?: number | null
  estimated_volume?: string | number | null
  supplier?: { id: number; name: string } | null
  conditions?: { id: number }[]
}

const props = defineProps<{
  product: ProductLike
  removable?: boolean
  editable?: boolean
}>()

defineEmits<{ (e: 'remove'): void; (e: 'edit'): void }>()

function money(v: string | number | null | undefined): string {
  return v == null ? '—' : Number(v).toFixed(2)
}

const hasPricing = () => props.product.current_sale_price != null
</script>

<template>
  <div class="product-card">
    <div class="pc-icon">
      <NIcon :size="24"><CubeOutline /></NIcon>
    </div>
    <div class="pc-info">
      <div class="pc-name" :title="product.name">{{ product.name }}</div>
      <div class="pc-code">
        {{ product.code }}
        <span v-if="product.supplier" class="pc-supplier"> · {{ product.supplier.name }}</span>
      </div>
      <div v-if="hasPricing()" class="pc-metrics">
        <span class="pc-m"><span class="pc-m-lbl">Sale</span><span class="pc-m-val">{{ money(product.current_sale_price) }}</span></span>
        <span class="pc-m"><span class="pc-m-lbl">Cost</span><span class="pc-m-val">{{ money(product.current_cost_price) }}</span></span>
        <span class="pc-m"><span class="pc-m-lbl">Low 30d</span><span class="pc-m-val">{{ money(product.lower_sale_price_last_30_days) }}</span></span>
        <span class="pc-m"><span class="pc-m-lbl">Avg/day</span><span class="pc-m-val">{{ product.avg_daily_sales ?? '—' }}</span></span>
        <span v-if="product.promotion_factor != null" class="pc-m"><span class="pc-m-lbl">Factor</span><span class="pc-m-val">{{ product.promotion_factor }}%</span></span>
        <span v-if="product.estimated_volume != null" class="pc-m"><span class="pc-m-lbl">Est. volume</span><span class="pc-m-val">{{ product.estimated_volume }}</span></span>
        <span v-if="product.conditions" class="pc-m"><span class="pc-m-lbl">Conditions</span><span class="pc-m-val">{{ product.conditions.length }}</span></span>
      </div>
    </div>
    <div class="pc-actions">
      <NButton
        v-if="editable"
        size="tiny"
        circle
        quaternary
        title="Edit product in promotion"
        @click="$emit('edit')"
      >
        <template #icon><NIcon><CreateOutline /></NIcon></template>
      </NButton>
      <NButton
        v-if="removable"
        size="tiny"
        circle
        quaternary
        title="Remove product"
        @click="$emit('remove')"
      >
        <template #icon><NIcon><CloseOutline /></NIcon></template>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.product-card {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid #e6e8ef;
  border-radius: 9px;
  padding: 12px 14px;
  background: #fbfbfd;
}
.pc-icon {
  flex: 0 0 auto;
  color: #8b95a7;
  display: flex;
  align-self: flex-start;
  margin-top: 2px;
}
.pc-info {
  flex: 1 1 auto;
  min-width: 0;
}
.pc-name {
  font-size: 15px;
  font-weight: 600;
  color: #2b2b33;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pc-code {
  font-size: 12px;
  color: #9aa0ab;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}
.pc-supplier {
  font-variant-numeric: normal;
  color: #7a8290;
}
.pc-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 8px;
}
.pc-m {
  display: flex;
  flex-direction: column;
}
.pc-m-lbl {
  font-size: 9px;
  color: #aab;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pc-m-val {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}
.pc-actions {
  flex: 0 0 auto;
  align-self: flex-start;
  display: flex;
  gap: 4px;
  color: #b0b0bb;
}
</style>
