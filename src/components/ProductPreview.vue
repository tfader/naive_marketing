<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import type { PromotionProduct, PromotionLayout } from '../types/campaign'
import { formatNumber } from '../composables/parameters'
import MoneyValue from './MoneyValue.vue'
import PromotionSkeleton from './PromotionSkeleton.vue'
import FieldMeta from './FieldMeta.vue'

const props = defineProps<{
  product: PromotionProduct
  promotionTypeName: string
  categoryName: string
  layout: PromotionLayout | null
}>()

function toNum(v: string | number | null | undefined): number | null {
  return v == null || v === '' ? null : Number(v)
}
function num(v: string | number | null | undefined): string {
  return formatNumber(v)
}

const cost = computed(() => toNum(props.product.product_cost))
const value = computed(() => toNum(props.product.product_sales_value))
const margin = computed(() => (cost.value == null || value.value == null ? null : value.value - cost.value))
const marginPct = computed(() =>
  margin.value == null || !value.value ? null : (margin.value / value.value) * 100
)

function marginClass(v: number | null) {
  return { pos: (v ?? 0) > 0, neg: (v ?? 0) < 0 }
}
</script>

<template>
  <div class="pp">
    <div class="pp-head">
      <div class="pp-head-left">
        <div class="pp-head-info">
          <div class="pp-name">{{ product.name }}</div>
          <div class="pp-sub">
            {{ product.code }}<template v-if="product.supplier"> · {{ product.supplier.name }}</template>
          </div>
          <div class="pp-tags">
            <NTag size="small" type="info">{{ promotionTypeName }}</NTag>
            <NTag size="small">{{ categoryName }}</NTag>
            <FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" :attribute="null" label="Product (whole)" :size="16" />
          </div>
        </div>
      </div>
      <div v-if="layout" class="pp-head-visual"><PromotionSkeleton :layout="layout" /></div>
    </div>

    <div class="pp-section">
      <div class="pp-section-title">Pricing snapshot</div>
      <div class="pp-stats">
        <div class="pp-stat"><span class="pp-l">Sale price</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="current_sale_price" label="Sale price" :size="16" /><MoneyValue :value="product.current_sale_price" /></span></div>
        <div class="pp-stat"><span class="pp-l">Cost price</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="current_cost_price" label="Cost price" :size="16" /><MoneyValue :value="product.current_cost_price" /></span></div>
        <div class="pp-stat"><span class="pp-l">Lowest 30d</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="lower_sale_price_last_30_days" label="Lowest 30d" :size="16" /><MoneyValue :value="product.lower_sale_price_last_30_days" /></span></div>
        <div class="pp-stat"><span class="pp-l">Avg / day</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="avg_daily_sales" label="Avg / day" :size="16" />{{ num(product.avg_daily_sales) }}</span></div>
      </div>
    </div>

    <div class="pp-section">
      <div class="pp-section-title">Promotion</div>
      <div class="pp-stats">
        <div class="pp-stat"><span class="pp-l">Discount</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="discount_percent" label="Discount %" :size="16" />{{ product.discount_percent == null ? '—' : product.discount_percent + '%' }}</span></div>
        <div class="pp-stat"><span class="pp-l">New price</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="new_price" label="New price" :size="16" /><MoneyValue :value="product.new_price" /></span></div>
        <div class="pp-stat"><span class="pp-l">Factor</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="promotion_factor" label="Promotion factor" :size="16" />{{ product.promotion_factor ?? 100 }}%</span></div>
        <div class="pp-stat"><span class="pp-l">Est. volume</span><span class="pp-v">{{ num(product.estimated_volume) }}</span></div>
      </div>
    </div>

    <div class="pp-financials">
      <div class="pp-fin"><span class="pp-fl">Cost</span><span class="pp-fv"><MoneyValue :value="product.product_cost" /></span></div>
      <div class="pp-fin"><span class="pp-fl">Sales value</span><span class="pp-fv"><MoneyValue :value="product.product_sales_value" /></span></div>
      <div class="pp-fin"><span class="pp-fl">Margin</span><span class="pp-fv" :class="marginClass(margin)"><MoneyValue :value="margin" /></span></div>
      <div class="pp-fin"><span class="pp-fl">Margin %</span><span class="pp-fv" :class="marginClass(marginPct)">{{ marginPct == null ? '—' : marginPct.toFixed(2) + '%' }}</span></div>
    </div>

    <div class="pp-section">
      <div class="pp-section-title">Supplier conditions <span class="pp-count">{{ product.conditions.length }}</span></div>
      <div v-if="product.conditions.length" class="pp-cond-list">
        <div
          v-for="c in product.conditions"
          :key="c.id"
          class="pp-cond"
          :class="{ 'pp-cond-selected': c.id === product.selected_condition_id }"
        >
          <span class="pp-cond-sup">
            {{ c.supplier?.name ?? '—' }}
            <NTag v-if="c.id === product.selected_condition_id" size="small" type="success" :bordered="false">used for cost</NTag>
          </span>
          <span class="pp-cond-vals">
            <span><span class="pp-l">Qty min</span> {{ c.quantity_min ?? '—' }}</span>
            <span><span class="pp-l">Purchase</span> <MoneyValue :value="c.purchase_price" /></span>
            <span><span class="pp-l">Backmargin</span> <MoneyValue :value="c.backmargin_value" /></span>
          </span>
        </div>
      </div>
      <div v-else class="pp-empty">No supplier conditions.</div>
    </div>
  </div>
</template>

<style scoped>
.pp {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.pp-head {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  justify-content: space-between;
}
.pp-head-left {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}
.pp-head-visual {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #fafbfc;
  border: 1px solid #f0f1f4;
  border-radius: 10px;
}
.pp-name {
  font-size: 19px;
  font-weight: 700;
  color: #1f2430;
  line-height: 1.2;
}
.pp-sub {
  font-size: 13px;
  color: #9aa0ab;
  margin-top: 2px;
}
.pp-tags {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}
.pp-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #98a0ad;
  margin-bottom: 10px;
}
.pp-count {
  color: #c2c7d0;
  margin-left: 2px;
}
.pp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.pp-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 3px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 8px;
}
.pp-l {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #9aa1ad;
}
.pp-v {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #2b2b33;
  font-variant-numeric: tabular-nums;
}
.pp-financials {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: #e7ebf0;
  border-radius: 10px;
  overflow: hidden;
}
.pp-fin {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 4px;
  padding: 14px 16px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}
.pp-fl {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #98a0ad;
}
.pp-fv {
  font-size: 19px;
  font-weight: 800;
  color: #1f2430;
  font-variant-numeric: tabular-nums;
}
.pp-fv.pos {
  color: #18a058;
}
.pp-fv.neg {
  color: #f0a020;
}
.pp-cond-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pp-cond {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  border: 1px solid #eef0f4;
  border-radius: 8px;
}
.pp-cond-selected {
  border-color: #86efac;
  background: #f0fdf4;
  box-shadow: inset 3px 0 0 #22c55e;
}
.pp-cond-sup {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2b2b33;
}
.pp-cond-vals {
  display: flex;
  gap: 18px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}
.pp-cond-vals .pp-l {
  font-weight: normal;
  margin-right: 2px;
}
.pp-empty {
  color: #bbb;
  font-size: 13px;
  font-style: italic;
}
</style>
