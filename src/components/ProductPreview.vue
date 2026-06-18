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

// Mini stock-projection bar height (% of starting stock), min 2% so empty days stay visible.
function stockBarHeight(endStock: number, start: number): string {
  if (!start) return '2%'
  return `${Math.max(2, Math.round((endStock / start) * 100))}%`
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

    <div v-if="product.stock_projection" class="pp-section">
      <div class="pp-section-title">Stock projection</div>
      <div class="pp-stock-head">
        <div class="pp-stats pp-stock-stats">
          <div class="pp-stat"><span class="pp-l">Start stock</span><span class="pp-v"><FieldMeta ref-model="CampaignItemProduct" :ref-id="product.link_id" attribute="start_promo_stock" label="Start stock" :size="16" />{{ num(product.stock_projection.start) }}</span></div>
          <div class="pp-stat"><span class="pp-l">Daily sales</span><span class="pp-v">{{ num(product.stock_projection.daily_sales) }}</span></div>
          <div class="pp-stat"><span class="pp-l">End stock</span><span class="pp-v" :class="{ neg: product.stock_projection.end_stock === 0 }">{{ num(product.stock_projection.end_stock) }}</span></div>
          <div class="pp-stat"><span class="pp-l">Days of cover</span><span class="pp-v">{{ product.stock_projection.days_of_cover ?? '—' }}</span></div>
        </div>
        <NTag v-if="product.stock_projection.stockout_day" size="small" type="error" :bordered="false">
          Stock-out on day {{ product.stock_projection.stockout_day }} of {{ product.stock_projection.days.length }}
        </NTag>
        <NTag v-else size="small" type="success" :bordered="false">Stock lasts the full promotion</NTag>
      </div>
      <div class="pp-stock-bars">
        <div
          v-for="d in product.stock_projection.days"
          :key="d.day"
          class="pp-stock-bar"
          :class="{ out: d.end_stock === 0 }"
          :title="`Day ${d.day}: ${num(d.end_stock)} left`"
          :style="{ height: stockBarHeight(d.end_stock, product.stock_projection.start) }"
        />
      </div>
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
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono-num,
.pp-v,
.pp-fv,
.pp-cond-vals {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
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
  background: #f6f7f9;
  border: 1px solid #eef0f3;
  border-radius: 10px;
}
.pp-name {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1a1d23;
  line-height: 1.2;
}
.pp-sub {
  font-size: 13px;
  color: #9aa0ab;
  margin-top: 2px;
}
.pp-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.pp-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9aa0ab;
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
  gap: 4px;
  padding: 11px 13px;
  background: #f6f7f9;
  border: 1px solid #eef0f3;
  border-radius: 10px;
}
.pp-l {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9aa0ab;
}
.pp-v {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #1a1d23;
}
.pp-financials {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: #eef0f3;
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  overflow: hidden;
}
.pp-fin {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 5px;
  padding: 15px 16px;
  background: #fff;
}
.pp-fl {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9aa0ab;
}
.pp-fv {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1a1d23;
}
.pp-fv.pos {
  color: #15935b;
}
.pp-fv.neg {
  color: #d83a45;
}
.pp-stock-head {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.pp-stock-stats {
  flex: 1 1 auto;
}
.pp-stock-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 70px;
  overflow-x: auto;
  padding: 8px 0;
}
.pp-stock-bar {
  flex: 1 0 5px;
  min-width: 5px;
  background: #5b50d6;
  border-radius: 2px 2px 0 0;
}
.pp-stock-bar.out {
  background: #d83a45;
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
  padding: 11px 14px;
  border: 1px solid #eef0f3;
  border-radius: 10px;
}
.pp-cond-selected {
  border-color: #cdebd9;
  background: #eef6f1;
  box-shadow: inset 3px 0 0 #15935b;
}
.pp-cond-sup {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #1a1d23;
}
.pp-cond-vals {
  display: flex;
  gap: 18px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.pp-cond-vals .pp-l {
  font-weight: 600;
  margin-right: 3px;
}
.pp-empty {
  color: #9aa0ab;
  font-size: 13px;
  font-style: italic;
}
</style>
