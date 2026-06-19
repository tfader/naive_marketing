<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NCard, NText, NRadioGroup, NRadioButton, NInputNumber, NButton, NSpace, NTag } from 'naive-ui'
import api from '../api/client'
import MoneyValue from './MoneyValue.vue'
import CompetitorPricesDialog from './CompetitorPricesDialog.vue'
import { formatNumber, formatNumberInput, parseNumberInput } from '../composables/parameters'
import type { PromotionProduct } from '../types/campaign'

const props = defineProps<{
  show: boolean
  cip: PromotionProduct | null
  baseUrl: string | null
  targetMargin: number
}>()

const emit = defineEmits<{ (e: 'update:show', v: boolean): void; (e: 'saved'): void }>()

interface Preview {
  new_price: number | null
  estimated_volume: number | null
  unit_cost: number | null
  unit_margin: number | null
  unit_margin_pct: number | null
  total_sales_value: number | null
  total_cost: number | null
  total_margin: number | null
  total_margin_pct: number | null
  end_stock: number | null
  end_stock_value_cost: number | null
  end_stock_value_sale: number | null
  stockout_day: number | null
}

const mode = ref<'percent' | 'amount'>('amount')
const discountPercent = ref<number | null>(null)
const newPrice = ref<number | null>(null)
const promotionFactor = ref<number>(100)
const preview = ref<Preview | null>(null)
const previewing = ref(false)
const saving = ref(false)
const dirty = ref(false) // inputs changed since the last Apply — preview is stale
const showCompetitors = ref(false)

function num(v: string | number | null | undefined): number | null {
  return v == null || v === '' ? null : Number(v)
}
const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

// Seed the form from the product whenever the dialog opens.
watch(
  () => props.show,
  (open) => {
    if (!open || !props.cip) return
    const c = props.cip
    promotionFactor.value = Number(c.promotion_factor ?? 100)
    if (c.discount_percent != null) {
      mode.value = 'percent'
      discountPercent.value = num(c.discount_percent)
      newPrice.value = null
    } else if (c.new_price != null) {
      mode.value = 'amount'
      newPrice.value = num(c.new_price)
      discountPercent.value = null
    } else {
      mode.value = 'amount'
      discountPercent.value = null
      newPrice.value = null
    }
    preview.value = null
    refreshPreview().then(() => (dirty.value = false))
  }
)

// Proposed pricing payload for the active mode.
function payload(): Record<string, unknown> {
  return {
    promotion_factor: promotionFactor.value,
    discount_percent: mode.value === 'percent' ? discountPercent.value : null,
    new_price: mode.value === 'amount' ? newPrice.value : null,
  }
}

const hasPrice = computed(() =>
  mode.value === 'percent' ? discountPercent.value != null : newPrice.value != null
)

// --- Reference figures -----------------------------------------------------
const currentSale = computed(() => num(props.cip?.current_sale_price))
const costPrice = computed(() => num(props.cip?.current_cost_price))
const unitCost = computed(() => preview.value?.unit_cost ?? costPrice.value)
const volume = computed(() => preview.value?.estimated_volume ?? num(props.cip?.estimated_volume))

// Are we (at the applied new price) more expensive than the cheapest competitor?
const aboveCompetitor = computed<boolean>(() => {
  const comp = num(props.cip?.lowest_competitor_price)
  return comp != null && preview.value?.new_price != null && preview.value.new_price > comp
})
const hasCompetitor = computed(() => num(props.cip?.lowest_competitor_price) != null)

// Omnibus check: the new price must not exceed the lowest price of the last 30 days.
const omnibusViolation = computed<boolean>(() => {
  const low = num(props.cip?.lower_sale_price_last_30_days)
  return low != null && preview.value?.new_price != null && preview.value.new_price > low
})

// Signed % difference of the (applied) new price vs the current sale price, e.g. -15.0.
const priceDeltaPct = computed<number | null>(() => {
  if (currentSale.value == null || currentSale.value === 0 || preview.value?.new_price == null) return null
  return r1((preview.value.new_price / currentSale.value - 1) * 100)
})

// --- Current-price baseline margins (cost is price-independent → reuse preview cost) ---
const curUnitMargin = computed(() =>
  currentSale.value != null && unitCost.value != null ? r2(currentSale.value - unitCost.value) : null
)
const curUnitMarginPct = computed(() =>
  curUnitMargin.value != null && currentSale.value ? r1((curUnitMargin.value / currentSale.value) * 100) : null
)
const curTotalSales = computed(() =>
  currentSale.value != null && volume.value != null ? currentSale.value * volume.value : null
)
const curTotalMargin = computed(() => {
  const cost = preview.value?.total_cost
  return curTotalSales.value != null && cost != null ? r2(curTotalSales.value - cost) : null
})
const curTotalMarginPct = computed(() =>
  curTotalMargin.value != null && curTotalSales.value ? r1((curTotalMargin.value / curTotalSales.value) * 100) : null
)

// --- Stock value --------------------------------------------------------
const stockQty = computed(() => num(props.cip?.start_promo_stock))
const curStockCost = computed(() =>
  stockQty.value != null && costPrice.value != null ? r2(stockQty.value * costPrice.value) : null
)
const curStockSale = computed(() =>
  stockQty.value != null && currentSale.value != null ? r2(stockQty.value * currentSale.value) : null
)

async function refreshPreview() {
  if (!props.baseUrl) return
  previewing.value = true
  try {
    const { data } = await api.post(`${props.baseUrl}/preview`, payload())
    preview.value = data
  } catch {
    preview.value = null
  } finally {
    previewing.value = false
  }
}

// Recalculate only on explicit Apply; mark the preview stale meanwhile.
async function apply() {
  await refreshPreview()
  dirty.value = false
}

watch([mode, discountPercent, newPrice, promotionFactor], () => (dirty.value = true))

async function confirm() {
  if (!props.baseUrl || !hasPrice.value) return
  saving.value = true
  try {
    await api.patch(props.baseUrl, { ...payload(), priced: true })
    emit('saved')
    emit('update:show', false)
  } finally {
    saving.value = false
  }
}

// Margin colour band (mirrors the cockpit: good ≥ target, mid ≥ 60% of target, else low).
function band(pct: number | null | undefined): string {
  if (pct == null) return 'none'
  if (pct >= props.targetMargin) return 'good'
  if (pct >= props.targetMargin * 0.6) return 'mid'
  return 'low'
}

// The headline figure — unit margin at the new price. Fixed thresholds:
// ≤ 0% red, 0–2% amber, > 2% green.
const unitNewBand = computed<string>(() => {
  const pct = preview.value?.unit_margin_pct
  if (pct == null) return 'none'
  if (pct <= 0) return 'low'
  if (pct <= 2) return 'mid'
  return 'good'
})

function pctText(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}
</script>

<template>
  <NModal :show="show" @update:show="(v) => emit('update:show', v)">
    <NCard v-if="cip" :title="cip.name" style="width: 1040px; max-width: 94vw" closable @close="emit('update:show', false)">
      <NText depth="3" style="display:block; margin-bottom: 14px">
        {{ cip.code }}<template v-if="cip.supplier"> · {{ cip.supplier.name }}</template>
        <NTag v-if="cip.priced" size="small" type="success" :bordered="false" style="margin-left: 8px">priced</NTag>
      </NText>

      <!-- 1. Price: current → new → difference -->
      <div class="sp-heroes">
        <div class="sp-hero">
          <span class="sp-hero-l">Current sale price</span>
          <span class="sp-hero-v mono"><MoneyValue :value="cip.current_sale_price" /></span>
        </div>
        <div class="sp-hero sp-hero-new" :class="{ pending: dirty }">
          <span class="sp-hero-l">New price</span>
          <span class="sp-hero-v mono">
            <MoneyValue :value="preview?.new_price" />
            <span v-if="priceDeltaPct != null" class="sp-hero-sub mono"><strong>{{ priceDeltaPct }}%</strong> vs current</span>
          </span>
        </div>
        <div class="sp-hero sp-hero-margin" :class="[`band-${unitNewBand}`, { pending: dirty }]">
          <span class="sp-hero-l">Margin % (new price)</span>
          <span class="sp-hero-v mono" :class="`txt-${unitNewBand}`">{{ pctText(preview?.unit_margin_pct) }}</span>
        </div>
      </div>

      <!-- Controls -->
      <div class="sp-controls">
        <div class="sp-ctl">
          <span class="sp-lbl">Price</span>
          <NRadioGroup v-model:value="mode" size="small">
            <NRadioButton value="amount">New price</NRadioButton>
            <NRadioButton value="percent">Discount %</NRadioButton>
          </NRadioGroup>
          <NInputNumber
            v-if="mode === 'percent'"
            v-model:value="discountPercent"
            :min="0" :max="100"
            :format="formatNumberInput" :parse="parseNumberInput"
            placeholder="—" style="width: 140px"
          />
          <NInputNumber
            v-else
            v-model:value="newPrice"
            :min="0" :precision="2"
            :format="formatNumberInput" :parse="parseNumberInput"
            placeholder="—" style="width: 140px"
          />
        </div>
        <div class="sp-ctl">
          <span class="sp-lbl">Factor</span>
          <NInputNumber
            v-model:value="promotionFactor"
            :min="0" :step="20"
            :format="formatNumberInput" :parse="parseNumberInput"
            style="width: 130px"
          />
          <NText depth="3" style="font-size: 12px">% sales uplift</NText>
        </div>
        <NButton :type="dirty ? 'primary' : 'default'" :disabled="!hasPrice" :loading="previewing" @click="apply">Apply</NButton>
      </div>

      <!-- 2. Stock: current vs end-of-promo -->
      <div class="sp-cols">
        <div class="sp-panel">
          <div class="sp-panel-head"><span class="sp-panel-title">Current stock</span></div>
          <div class="sp-grid">
            <div class="sp-cell"><span class="sp-cell-l">Quantity</span><span class="sp-cell-v mono">{{ formatNumber(stockQty) }}</span></div>
            <div class="sp-cell"><span class="sp-cell-l">Value (cost)</span><span class="sp-cell-v mono"><MoneyValue :value="curStockCost" /></span></div>
            <div class="sp-cell"><span class="sp-cell-l">Value (sale)</span><span class="sp-cell-v mono"><MoneyValue :value="curStockSale" /></span></div>
          </div>
        </div>
        <div class="sp-panel" :class="{ pending: dirty }">
          <div class="sp-panel-head">
            <span class="sp-panel-title">End-of-promo stock</span>
            <NTag v-if="preview?.stockout_day" size="small" type="error" :bordered="false">stock-out on day {{ preview.stockout_day }}</NTag>
          </div>
          <div class="sp-grid">
            <div class="sp-cell"><span class="sp-cell-l">Quantity</span><span class="sp-cell-v mono">{{ formatNumber(preview?.end_stock) }}</span></div>
            <div class="sp-cell"><span class="sp-cell-l">Value (cost)</span><span class="sp-cell-v mono"><MoneyValue :value="preview?.end_stock_value_cost" /></span></div>
            <div class="sp-cell"><span class="sp-cell-l">Value (sale)</span><span class="sp-cell-v mono"><MoneyValue :value="preview?.end_stock_value_sale" /></span></div>
          </div>
        </div>
      </div>

      <!-- 3. Margin: current vs new price -->
      <div class="sp-cols">
        <div class="sp-panel sp-panel-key">
          <div class="sp-panel-head"><span class="sp-panel-title">Unit margin</span></div>
          <div class="sp-cmp">
            <div class="sp-cmp-side">
              <span class="sp-cell-l">At current price</span>
              <span class="sp-cmp-v mono"><MoneyValue :value="curUnitMargin" /></span>
              <span class="sp-cmp-pct mono" :class="`txt-${band(curUnitMarginPct)}`">{{ pctText(curUnitMarginPct) }}</span>
            </div>
            <span class="sp-cmp-arrow">→</span>
            <div class="sp-cmp-side sp-cmp-key" :class="[`band-${unitNewBand}`, { pending: dirty }]">
              <span class="sp-cell-l">At new price</span>
              <span class="sp-cmp-v sp-cmp-v-hero mono" :class="`txt-${unitNewBand}`"><MoneyValue :value="preview?.unit_margin" /></span>
              <span class="sp-cmp-pct mono" :class="`txt-${unitNewBand}`">{{ pctText(preview?.unit_margin_pct) }}</span>
            </div>
          </div>
        </div>
        <div class="sp-panel">
          <div class="sp-panel-head"><span class="sp-panel-title">Total margin</span></div>
          <div class="sp-cmp">
            <div class="sp-cmp-side">
              <span class="sp-cell-l">At current price</span>
              <span class="sp-cmp-v mono"><MoneyValue :value="curTotalMargin" /></span>
              <span class="sp-cmp-pct mono" :class="`txt-${band(curTotalMarginPct)}`">{{ pctText(curTotalMarginPct) }}</span>
            </div>
            <span class="sp-cmp-arrow">→</span>
            <div class="sp-cmp-side" :class="{ pending: dirty }">
              <span class="sp-cell-l">At new price</span>
              <span class="sp-cmp-v mono"><MoneyValue :value="preview?.total_margin" /></span>
              <span class="sp-cmp-pct mono" :class="`txt-${band(preview?.total_margin_pct)}`">{{ pctText(preview?.total_margin_pct) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Supporting reference -->
      <div class="sp-strip">
        <span class="sp-strip-i"><span class="sp-cell-l">Cost</span><MoneyValue :value="cip.current_cost_price" /></span>
        <span class="sp-strip-i" :class="{ 'sp-omnibus': omnibusViolation }" :title="omnibusViolation ? 'New price is above the lowest price of the last 30 days (Omnibus)' : undefined"><span class="sp-cell-l">Lowest 30d</span><MoneyValue :value="cip.lower_sale_price_last_30_days" /></span>
        <span class="sp-strip-i sp-strip-comp">
          <span class="sp-cell-l">Lowest competitor</span>
          <span class="sp-comp-row">
            <MoneyValue :value="cip.lowest_competitor_price" />
            <NTag v-if="hasCompetitor && aboveCompetitor" size="tiny" type="warning" :bordered="false">above</NTag>
            <NTag v-else-if="hasCompetitor" size="tiny" type="success" :bordered="false">cheaper</NTag>
            <NButton v-if="hasCompetitor" size="tiny" tertiary @click="showCompetitors = true">Details</NButton>
          </span>
        </span>
        <span class="sp-strip-i"><span class="sp-cell-l">Avg / day</span>{{ formatNumber(cip.avg_daily_sales) }}</span>
        <span class="sp-strip-i"><span class="sp-cell-l">Est. volume</span>{{ formatNumber(volume) }}</span>
      </div>

      <NSpace justify="end" style="margin-top: 18px">
        <NButton @click="emit('update:show', false)">Cancel</NButton>
        <NButton type="primary" :disabled="!hasPrice" :loading="saving" @click="confirm">Confirm price</NButton>
      </NSpace>

      <CompetitorPricesDialog
        v-model:show="showCompetitors"
        :product-id="cip.id"
        :product-name="cip.name"
        :current-sale="num(cip.current_sale_price)"
        :new-price="preview?.new_price"
      />
    </NCard>
  </NModal>
</template>

<style scoped>
/* 1. Price heroes */
.sp-heroes { display: flex; gap: 16px; margin-bottom: 16px; }
.sp-hero {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 16px 20px;
  background: #f1effb;
  border: 1px solid #d9d4f5;
  border-radius: 10px;
}
.sp-hero-l { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #6a5fd0; font-weight: 600; }
.sp-hero-v { font-size: 34px; font-weight: 700; color: #4a40c2; line-height: 1.05; }
.sp-hero-new { background: #ecf7f1; border-color: #bfe3cf; }
.sp-hero-new .sp-hero-l, .sp-hero-new .sp-hero-v { color: #15935b; }
.sp-hero-sub { display: block; font-size: 16px; font-weight: 400; opacity: 0.8; margin-top: 3px; }
.sp-hero-sub strong { font-weight: 800; }

/* Margin % (new price) — headline figure, tile coloured by band */
.sp-hero-margin.band-good { background: #eaf6f0; border-color: #bfe3cf; }
.sp-hero-margin.band-good .sp-hero-l { color: #15935b; }
.sp-hero-margin.band-mid { background: #fdf3e7; border-color: #f0d9b8; }
.sp-hero-margin.band-mid .sp-hero-l { color: #c98410; }
.sp-hero-margin.band-low { background: #fcebec; border-color: #f3c4c8; }
.sp-hero-margin.band-low .sp-hero-l { color: #d83a45; }
.sp-hero-margin.band-none { background: #f5f6f9; border-color: #e6e8ef; }
.sp-hero-margin.band-none .sp-hero-l { color: #8b95a7; }
.pending { opacity: 0.5; transition: opacity 0.15s; }

/* Controls */
.sp-controls { display: flex; align-items: center; gap: 28px; flex-wrap: wrap; margin-bottom: 18px; }
.sp-ctl { display: flex; align-items: center; gap: 10px; }
.sp-lbl { font-size: 12px; color: #8b95a7; }

/* 2 & 3. Two-column panels */
.sp-cols { display: flex; gap: 16px; margin-bottom: 16px; }
.sp-panel {
  flex: 1 1 0;
  border: 1px solid #e6e8ef;
  border-radius: 9px;
  padding: 14px 16px;
}
.sp-panel-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.sp-panel-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #8b95a7; }
.sp-grid { display: flex; gap: 28px; }
.sp-cell { display: flex; flex-direction: column; gap: 3px; }
.sp-cell-l { font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #aab; }
.sp-cell-v { font-size: 18px; font-weight: 700; color: #2b2b33; }

/* Margin comparison */
.sp-cmp { display: flex; align-items: center; gap: 16px; }
.sp-cmp-side { flex: 1 1 0; display: flex; flex-direction: column; gap: 2px; }
.sp-cmp-v { font-size: 22px; font-weight: 700; color: #2b2b33; line-height: 1.1; }
.sp-cmp-pct { font-size: 13px; font-weight: 600; }
.sp-cmp-arrow { color: #c2c7d0; font-size: 20px; flex: 0 0 auto; }

/* Supporting strip */
.sp-strip { display: flex; gap: 32px; padding: 12px 16px; background: #f7f8fb; border-radius: 8px; }
.sp-strip-i { display: flex; flex-direction: column; gap: 3px; font-size: 15px; font-weight: 600; color: #333; }
.sp-comp-row { display: inline-flex; align-items: center; gap: 8px; }
.sp-omnibus, .sp-omnibus .sp-cell-l { color: #d83a45; animation: sp-blink 1s ease-in-out infinite; }
@keyframes sp-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }

/* Margin band colours (scoped — global ones don't reach this component) */
.txt-good { color: #15935b; }
.txt-mid { color: #c98410; }
.txt-low { color: #d83a45; }

/* The key figure: unit margin at the new price */
.sp-panel-key { border-color: #d9d4f5; }
.sp-cmp-key { border-radius: 8px; padding: 8px 12px; margin: -8px -4px -8px 0; }
.sp-cmp-key.band-good { background: #eaf6f0; }
.sp-cmp-key.band-mid { background: #fdf3e7; }
.sp-cmp-key.band-low { background: #fcebec; }
.sp-cmp-key.band-none { background: transparent; }
.sp-cmp-v-hero { font-size: 30px; }
</style>
