<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { CubeOutline, TicketOutline, GiftOutline } from '@vicons/ionicons5'
import type { PromotionLayout } from '../types/campaign'

defineProps<{ layout: PromotionLayout | null }>()
</script>

<template>
  <div v-if="layout && layout.blocks && layout.blocks.length" class="skeleton">
    <template v-for="(b, i) in layout.blocks" :key="i">
      <div v-if="b.type === 'image'" class="sk-image">
        <span v-if="b.label" class="sk-image-label">{{ b.label }}</span>
        <NIcon v-else :size="18"><CubeOutline /></NIcon>
      </div>
      <div v-else-if="b.type === 'gift'" class="sk-image sk-gift">
        <NIcon :size="22"><GiftOutline /></NIcon>
      </div>
      <div v-else-if="b.type === 'price_old'" class="sk-price-old">{{ b.text || '00.00' }}</div>
      <div v-else-if="b.type === 'price_new'" class="sk-price-new">{{ b.text || '00.00' }}</div>
      <div v-else-if="b.type === 'price'" class="sk-price">{{ b.text || '00.00' }}</div>
      <div v-else-if="b.type === 'price_drop'" class="sk-pricedrop">
        <span class="pd-old">{{ b.was || '79.99' }}</span>
        <span class="pd-new">{{ b.now || '49.99' }}</span>
      </div>
      <div v-else-if="b.type === 'qty'" class="sk-qty">{{ b.text || 'buy X pay Y' }}</div>
      <div v-else-if="b.type === 'badge'" class="sk-badge">{{ b.text || '%' }}</div>
      <div v-else-if="b.type === 'voucher'" class="sk-voucher">
        <NIcon :size="16"><TicketOutline /></NIcon>
        <span v-if="b.text">{{ b.text }}</span>
      </div>
      <span v-else-if="b.type === 'plus'" class="sk-op">+</span>
      <span v-else-if="b.type === 'equals'" class="sk-op">=</span>
      <span v-else-if="b.type === 'text'" class="sk-text">{{ b.text }}</span>
    </template>
  </div>
  <span v-else style="color:#ccc">—</span>
</template>

<style scoped>
.skeleton {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sk-image {
  width: 34px;
  height: 34px;
  border: 1.5px solid #22c55e;
  border-radius: 6px;
  background: #ecfdf5;
  color: #16a34a;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sk-image-label {
  font-size: 10px;
  font-weight: 600;
}
.sk-gift {
  color: #ec4899;
  border-color: #f9a8d4;
  background: #fdf2f8;
}
.sk-price-old {
  color: #94a3b8;
  text-decoration: line-through;
  font-size: 13px;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 2px 8px;
}
.sk-price-new {
  color: #fff;
  background: #ef4444;
  font-weight: 700;
  font-size: 14px;
  border-radius: 4px;
  padding: 3px 10px;
}
.sk-price {
  color: #334155;
  background: #e2e8f0;
  font-weight: 700;
  font-size: 14px;
  border-radius: 4px;
  padding: 3px 10px;
}
.sk-qty {
  color: #334155;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
}
.sk-badge {
  color: #fff;
  background: #10b981;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}
.sk-pricedrop {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1;
}
.pd-old {
  font-size: 11px;
  font-weight: 700;
  text-decoration: line-through;
  color: #b45309;
  background: #fde047;
  padding: 2px 6px;
  border-radius: 3px;
  transform: rotate(-3deg);
  align-self: flex-start;
}
.pd-new {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  background: #ef4444;
  padding: 3px 12px;
  border-radius: 4px;
  margin-top: -3px;
}
.sk-voucher {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #16a34a;
  background: #f0fdf4;
  border: 1px dashed #86efac;
  border-radius: 4px;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 600;
}
.sk-op {
  color: #94a3b8;
  font-weight: 700;
  font-size: 16px;
}
.sk-text {
  color: #64748b;
  font-size: 12px;
}
</style>
