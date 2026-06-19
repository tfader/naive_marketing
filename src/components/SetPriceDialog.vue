<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NCard, NText, NRadioGroup, NRadioButton, NInputNumber, NInput, NButton, NSpace, NTag, NIcon, NSelect } from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import { CreateOutline, TrashOutline, AddOutline } from '@vicons/ionicons5'
import api from '../api/client'
import MoneyValue from './MoneyValue.vue'
import CompetitorPricesDialog from './CompetitorPricesDialog.vue'
import { formatNumber, formatNumberInput, parseNumberInput } from '../composables/parameters'
import type { PromotionProduct, PriceVariant } from '../types/campaign'

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

// --- Editor state (the variant being created/edited) ---
const editingVariantId = ref<number | null>(null)
const label = ref<string>('')
const mode = ref<'percent' | 'amount'>('amount')
const discountPercent = ref<number | null>(null)
const newPrice = ref<number | null>(null)
const promotionFactor = ref<number>(100)
const preview = ref<Preview | null>(null)
const previewing = ref(false)
const saving = ref(false)
const dirty = ref(false)
const showCompetitors = ref(false)

// --- Supplier commercial conditions ---
const suppliers = ref<{ id: number; name: string }[]>([])
const conditionForm = ref({
  supplier_id: null as number | null,
  quantity_min: null as number | null,
  purchase_price: null as number | null,
  backmargin_value: null as number | null,
})
const supplierOptions = computed<SelectOption[]>(() => suppliers.value.map((s) => ({ label: s.name, value: s.id })))

function num(v: string | number | null | undefined): number | null {
  return v == null || v === '' ? null : Number(v)
}
const r2 = (n: number) => Math.round(n * 100) / 100
const r1 = (n: number) => Math.round(n * 10) / 10

const variants = computed<PriceVariant[]>(() => props.cip?.variants ?? [])

// --- Open: load the active variant for editing, else the first, else a fresh draft. ---
watch(
  () => props.show,
  (open) => {
    if (!open || !props.cip) return
    const active = variants.value.find((v) => v.selected) ?? variants.value[0]
    if (active) loadVariant(active)
    else newDraft()
    conditionForm.value = { supplier_id: props.cip.supplier?.id ?? null, quantity_min: null, purchase_price: null, backmargin_value: null }
    loadSuppliers()
  }
)

async function loadSuppliers() {
  if (suppliers.value.length) return
  try {
    const { data } = await api.get('/suppliers')
    suppliers.value = data
  } catch {
    /* non-fatal */
  }
}

async function addCondition() {
  if (!props.baseUrl || conditionForm.value.supplier_id == null || conditionForm.value.purchase_price == null) return
  await api.post(`${props.baseUrl}/conditions`, conditionForm.value)
  conditionForm.value = { supplier_id: props.cip?.supplier?.id ?? null, quantity_min: null, purchase_price: null, backmargin_value: null }
  await refreshPreview()
  emit('saved')
}

async function deleteCondition(id: number) {
  if (!props.baseUrl) return
  await api.delete(`${props.baseUrl}/conditions/${id}`)
  await refreshPreview()
  emit('saved')
}

function loadVariant(v: PriceVariant) {
  editingVariantId.value = v.id
  label.value = v.label ?? ''
  promotionFactor.value = Number(v.promotion_factor ?? 100)
  if (v.discount_percent != null) {
    mode.value = 'percent'
    discountPercent.value = num(v.discount_percent)
    newPrice.value = null
  } else {
    mode.value = 'amount'
    newPrice.value = num(v.new_price)
    discountPercent.value = null
  }
  preview.value = null
  refreshPreview().then(() => (dirty.value = false))
}

function newDraft() {
  editingVariantId.value = null
  label.value = ''
  mode.value = 'amount'
  discountPercent.value = null
  newPrice.value = null
  promotionFactor.value = Number(props.cip?.promotion_factor ?? 100)
  preview.value = null
  dirty.value = false
}

function payload(): Record<string, unknown> {
  return {
    label: label.value?.trim() || `Variant ${variants.value.length + 1}`,
    promotion_factor: promotionFactor.value,
    discount_percent: mode.value === 'percent' ? discountPercent.value : null,
    new_price: mode.value === 'amount' ? newPrice.value : null,
  }
}

const hasPrice = computed(() =>
  mode.value === 'percent' ? discountPercent.value != null : newPrice.value != null
)

// --- Reference / derived figures (preview drives the "new price" scenario) ---
const currentSale = computed(() => num(props.cip?.current_sale_price))
const costPrice = computed(() => num(props.cip?.current_cost_price))
const unitCost = computed(() => preview.value?.unit_cost ?? costPrice.value)
const volume = computed(() => preview.value?.estimated_volume ?? num(props.cip?.estimated_volume))

const priceDeltaPct = computed<number | null>(() => {
  if (currentSale.value == null || currentSale.value === 0 || preview.value?.new_price == null) return null
  return r1((preview.value.new_price / currentSale.value - 1) * 100)
})

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

const stockQty = computed(() => num(props.cip?.start_promo_stock))
const curStockCost = computed(() =>
  stockQty.value != null && costPrice.value != null ? r2(stockQty.value * costPrice.value) : null
)
const curStockSale = computed(() =>
  stockQty.value != null && currentSale.value != null ? r2(stockQty.value * currentSale.value) : null
)

const aboveCompetitor = computed<boolean>(() => {
  const comp = num(props.cip?.lowest_competitor_price)
  return comp != null && preview.value?.new_price != null && preview.value.new_price > comp
})
const hasCompetitor = computed(() => num(props.cip?.lowest_competitor_price) != null)

const omnibusViolation = computed<boolean>(() => {
  const low = num(props.cip?.lower_sale_price_last_30_days)
  return low != null && preview.value?.new_price != null && preview.value.new_price > low
})

const unitNewBand = computed<string>(() => fixedBand(preview.value?.unit_margin_pct))

// --- Preview (recalculated on Apply only) ---
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
async function apply() {
  await refreshPreview()
  dirty.value = false
}
watch([mode, discountPercent, newPrice, promotionFactor], () => (dirty.value = true))

// --- Variant actions ---
async function saveVariant() {
  if (!props.baseUrl || !hasPrice.value) return
  saving.value = true
  try {
    if (editingVariantId.value != null) {
      await api.patch(`${props.baseUrl}/variants/${editingVariantId.value}`, payload())
    } else {
      await api.post(`${props.baseUrl}/variants`, payload())
    }
    emit('saved')
    if (editingVariantId.value == null) newDraft() // ready for the next proposal
  } finally {
    saving.value = false
  }
}

async function selectVariant(v: PriceVariant) {
  if (!props.baseUrl) return
  await api.post(`${props.baseUrl}/variants/${v.id}/select`)
  emit('saved')
}

async function deleteVariant(v: PriceVariant) {
  if (!props.baseUrl) return
  await api.delete(`${props.baseUrl}/variants/${v.id}`)
  if (editingVariantId.value === v.id) newDraft()
  emit('saved')
}

// Fixed-threshold band for unit margin %: ≤ 0% red, 0–2% amber, > 2% green.
function fixedBand(pct: number | null | undefined): string {
  if (pct == null) return 'none'
  if (pct <= 0) return 'low'
  if (pct <= 2) return 'mid'
  return 'good'
}
function pctText(v: number | null | undefined): string {
  return v == null ? '—' : `${v}%`
}
</script>

<template>
  <NModal :show="show" @update:show="(v) => emit('update:show', v)">
    <NCard v-if="cip" :title="cip.name" style="width: 1040px; max-width: 94vw" closable @close="emit('update:show', false)">
      <NText depth="3" style="display:block; margin-bottom: 14px">
        {{ cip.code }}<template v-if="cip.supplier"> · {{ cip.supplier.name }}</template>
      </NText>

      <!-- Price variants (proposals); exactly one is active and drives the calculation -->
      <div class="sp-variants">
        <div class="sp-var-head">
          <span class="sp-panel-title">Price variants</span>
          <NButton size="tiny" tertiary :type="editingVariantId == null ? 'primary' : 'default'" @click="newDraft">
            <template #icon><NIcon><AddOutline /></NIcon></template>New variant
          </NButton>
        </div>
        <div v-if="variants.length" class="sp-var-list">
          <div
            v-for="v in variants"
            :key="v.id"
            class="sp-var"
            :class="{ active: v.selected, editing: v.id === editingVariantId }"
          >
            <span class="sp-var-active">
              <NTag v-if="v.selected" size="tiny" type="success" :bordered="false">active</NTag>
              <NButton v-else size="tiny" quaternary @click="selectVariant(v)">Set active</NButton>
            </span>
            <span class="sp-var-label">{{ v.label || 'Variant' }}</span>
            <span class="sp-var-price mono"><MoneyValue :value="v.metrics.new_price" /></span>
            <span class="sp-var-disc mono">
              <template v-if="v.discount_percent != null">−{{ v.discount_percent }}%</template>
            </span>
            <span class="sp-var-margin mono" :class="`txt-${fixedBand(v.metrics.unit_margin_pct)}`">{{ pctText(v.metrics.unit_margin_pct) }}</span>
            <span class="sp-var-actions">
              <NButton size="tiny" quaternary circle title="Edit" @click="loadVariant(v)"><template #icon><NIcon><CreateOutline /></NIcon></template></NButton>
              <NButton size="tiny" quaternary circle type="error" title="Delete" @click="deleteVariant(v)"><template #icon><NIcon><TrashOutline /></NIcon></template></NButton>
            </span>
          </div>
        </div>
        <div v-else class="sp-var-empty">No variants yet — create the first proposal below.</div>
      </div>

      <div class="sp-editor-label">{{ editingVariantId == null ? 'New variant' : 'Editing variant' }}</div>

      <!-- 1. Price: current → new → margin% -->
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

      <!-- Editor controls -->
      <div class="sp-controls">
        <div class="sp-ctl">
          <span class="sp-lbl">Label</span>
          <NInput v-model:value="label" size="small" placeholder="Variant name" style="width: 160px" />
        </div>
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
            placeholder="—" style="width: 130px"
          />
          <NInputNumber
            v-else
            v-model:value="newPrice"
            :min="0" :precision="2"
            :format="formatNumberInput" :parse="parseNumberInput"
            placeholder="—" style="width: 130px"
          />
        </div>
        <div class="sp-ctl">
          <span class="sp-lbl">Factor</span>
          <NInputNumber
            v-model:value="promotionFactor"
            :min="0" :step="20"
            :format="formatNumberInput" :parse="parseNumberInput"
            style="width: 120px"
          />
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
              <span class="sp-cmp-pct mono" :class="`txt-${fixedBand(curUnitMarginPct)}`">{{ pctText(curUnitMarginPct) }}</span>
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
              <span class="sp-cmp-pct mono" :class="`txt-${fixedBand(curTotalMarginPct)}`">{{ pctText(curTotalMarginPct) }}</span>
            </div>
            <span class="sp-cmp-arrow">→</span>
            <div class="sp-cmp-side" :class="{ pending: dirty }">
              <span class="sp-cell-l">At new price</span>
              <span class="sp-cmp-v mono"><MoneyValue :value="preview?.total_margin" /></span>
              <span class="sp-cmp-pct mono" :class="`txt-${fixedBand(preview?.total_margin_pct)}`">{{ pctText(preview?.total_margin_pct) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Supplier commercial conditions — drive the real cost -->
      <div class="sp-panel sp-conditions">
        <div class="sp-panel-head">
          <span class="sp-panel-title">Supplier commercial conditions</span>
          <NText depth="3" style="font-size: 12px">the lowest eligible purchase price drives the cost</NText>
        </div>
        <div v-if="cip.conditions.length" class="sp-cond-list">
          <div v-for="c in cip.conditions" :key="c.id" class="sp-cond-row" :class="{ used: c.id === cip.selected_condition_id }">
            <span class="sp-cond-sup">{{ c.supplier?.name ?? '—' }}</span>
            <span class="sp-cond-f"><span class="sp-cell-l">Qty min</span><span class="mono">{{ formatNumber(c.quantity_min) }}</span></span>
            <span class="sp-cond-f"><span class="sp-cell-l">Purchase</span><span class="mono"><MoneyValue :value="c.purchase_price" /></span></span>
            <span class="sp-cond-f"><span class="sp-cell-l">Backmargin</span><span class="mono"><MoneyValue :value="c.backmargin_value" /></span></span>
            <NTag v-if="c.id === cip.selected_condition_id" size="tiny" type="info" :bordered="false">used</NTag>
            <span class="sp-cond-spacer"></span>
            <NButton size="tiny" quaternary circle type="error" title="Remove" @click="deleteCondition(c.id)"><template #icon><NIcon><TrashOutline /></NIcon></template></NButton>
          </div>
        </div>
        <div v-else class="sp-var-empty">No conditions — cost falls back to the snapshot cost price.</div>

        <div class="sp-cond-form">
          <NSelect v-model:value="conditionForm.supplier_id" :options="supplierOptions" filterable size="small" placeholder="Supplier" style="width: 200px" />
          <NInputNumber v-model:value="conditionForm.quantity_min" :min="0" :format="formatNumberInput" :parse="parseNumberInput" size="small" placeholder="Qty min" style="width: 120px" />
          <NInputNumber v-model:value="conditionForm.purchase_price" :min="0" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" size="small" placeholder="Purchase" style="width: 130px" />
          <NInputNumber v-model:value="conditionForm.backmargin_value" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" size="small" placeholder="Backmargin (total)" style="width: 160px" />
          <NButton type="primary" size="small" :disabled="conditionForm.supplier_id == null || conditionForm.purchase_price == null" @click="addCondition">Add condition</NButton>
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
        <NButton @click="emit('update:show', false)">Close</NButton>
        <NButton type="primary" :disabled="!hasPrice" :loading="saving" @click="saveVariant">
          {{ editingVariantId == null ? 'Add variant' : 'Save changes' }}
        </NButton>
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
/* Variants list */
.sp-variants { border: 1px solid #e6e8ef; border-radius: 9px; padding: 12px 14px; margin-bottom: 16px; }
.sp-var-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sp-var-list { display: flex; flex-direction: column; gap: 4px; }
.sp-var {
  display: grid;
  grid-template-columns: 96px 1fr 110px 70px 70px auto;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 7px;
  border: 1px solid transparent;
}
.sp-var.active { background: #f0f6ff; }
.sp-var.editing { border-color: #d9d4f5; }
.sp-var-label { font-weight: 600; color: #2b2b33; }
.sp-var-price { font-weight: 700; }
.sp-var-disc { color: #b5760c; font-size: 12px; }
.sp-var-margin { font-weight: 700; text-align: right; }
.sp-var-actions { display: inline-flex; gap: 2px; }
.sp-var-empty { font-size: 13px; color: #b0b6c2; font-style: italic; padding: 4px 2px; }

.sp-editor-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #8b95a7; margin-bottom: 10px; }

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
.sp-controls { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; margin-bottom: 18px; }
.sp-ctl { display: flex; align-items: center; gap: 10px; }
.sp-lbl { font-size: 12px; color: #8b95a7; }

/* Two-column panels */
.sp-cols { display: flex; gap: 16px; margin-bottom: 16px; }
.sp-panel { flex: 1 1 0; border: 1px solid #e6e8ef; border-radius: 9px; padding: 14px 16px; }
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

/* Supplier conditions */
.sp-conditions { margin-bottom: 16px; }
.sp-cond-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.sp-cond-row {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 10px;
  border-radius: 7px;
  border: 1px solid #f0f1f4;
}
.sp-cond-row.used { background: #f0f6ff; border-color: #cfe0fb; }
.sp-cond-sup { font-weight: 600; color: #2b2b33; min-width: 150px; }
.sp-cond-f { display: flex; flex-direction: column; gap: 2px; }
.sp-cond-f .mono { font-weight: 600; color: #333; }
.sp-cond-spacer { flex: 1 1 auto; }
.sp-cond-form { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

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

/* Key figure */
.sp-panel-key { border-color: #d9d4f5; }
.sp-cmp-key { border-radius: 8px; padding: 8px 12px; margin: -8px -4px -8px 0; }
.sp-cmp-key.band-good { background: #eaf6f0; }
.sp-cmp-key.band-mid { background: #fdf3e7; }
.sp-cmp-key.band-low { background: #fcebec; }
.sp-cmp-key.band-none { background: transparent; }
.sp-cmp-v-hero { font-size: 30px; }
</style>
