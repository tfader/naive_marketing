<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  NH2,
  NCard,
  NTag,
  NSpace,
  NButton,
  NTimeline,
  NTimelineItem,
  NText,
  NSpin,
  NIcon,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NCheckbox,
  NDatePicker,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import type { SelectOption } from 'naive-ui'
import api from '../api/client'
import PromotionSkeleton from '../components/PromotionSkeleton.vue'
import CampaignMiniCalendar from '../components/CampaignMiniCalendar.vue'
import { BagHandleOutline, CreateOutline, TrashOutline, CloseOutline, GitNetworkOutline, EyeOutline, NewspaperOutline } from '@vicons/ionicons5'
import { setBreadcrumbs, clearBreadcrumbs } from '../composables/breadcrumbs'
import { loadParameters, formatNumber, formatNumberInput, parseNumberInput } from '../composables/parameters'
import MoneyValue from '../components/MoneyValue.vue'
import ProductPreview from '../components/ProductPreview.vue'
import FieldMeta from '../components/FieldMeta.vue'
import { loadSummary } from '../composables/commentSummary'
import { commentsVersion } from '../composables/comments'
import { loadStatusSummary } from '../composables/statusSummary'
import { statusVersion } from '../composables/statuses'
import type { Campaign, CampaignItem, CampaignCategory, PromotionType, PromotionProduct } from '../types/campaign'
import type { Category } from '../types/category'

const STAGE_TYPE: Record<string, 'default' | 'info' | 'success' | 'error'> = {
  pending: 'default', active: 'info', completed: 'success', skipped: 'default', blocked: 'error',
}
const STATUS_TAG: Record<string, 'success' | 'default' | 'error'> = {
  active: 'success', completed: 'default', cancelled: 'error',
}
const ITEM_STATUS_TAG: Record<string, 'default' | 'info' | 'success'> = {
  draft: 'default', ready: 'info', approved: 'success',
}
const PRODUCTS_STATUS_TAG: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  none: 'default', incomplete: 'warning', complete: 'success', over: 'error',
}
const ITEM_STATUS_OPTIONS: SelectOption[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Approved', value: 'approved' },
]

const route = useRoute()
const message = useMessage()
const campaignId = route.params.id as string

const campaign = ref<Campaign | null>(null)
const loading = ref(false)
const promotionTypes = ref<PromotionType[]>([])
const allCategories = ref<Category[]>([])

// --- Add category modal ---
const showCatModal = ref(false)
const showProcessModal = ref(false)
const showCampaignEditModal = ref(false)
const campaignForm = ref({
  name: '',
  status: 'active',
  pages_count: null as number | null,
  start_date: null as string | null,
  end_date: null as string | null,
  target_margin: 10 as number | null,
})

const CAMPAIGN_STATUS_OPTIONS: SelectOption[] = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

function openCampaignEdit() {
  const c = campaign.value
  if (!c) return
  campaignForm.value = {
    name: c.name,
    status: c.status,
    pages_count: c.pages_count ?? null,
    start_date: c.start_date,
    end_date: c.end_date,
    target_margin: c.target_margin == null ? 10 : Number(c.target_margin),
  }
  showCampaignEditModal.value = true
}
async function saveCampaign() {
  try {
    await api.patch(`/campaigns/${campaignId}`, campaignForm.value)
    message.success('Campaign updated')
    showCampaignEditModal.value = false
    await loadCampaign()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save campaign')
  }
}
const catForm = ref({ multi: false, category_ids: [] as number[], planned_items_count: 1 })
const showCatEditModal = ref(false)
const editingCatId = ref<number | null>(null)
const catEditForm = ref({ multi: false, category_ids: [] as number[], planned_items_count: 1 })

// --- Item modal ---
const showItemModal = ref(false)
const editingItem = ref<CampaignItem | null>(null)
const activeCategoryId = ref<number | null>(null) // campaign_category id we're adding/editing under
const itemForm = ref({
  promotion_type_id: null as number | null,
  name: '',
  status: 'draft',
  page_no: null as number | null,
  order_on_page: null as number | null,
  new_sale_price: null as number | null, // empty = auto (sum of products); value = manual override
  buy_quantity: null as number | null,
  pay_quantity: null as number | null,
})
// Code of the promotion type currently selected in the item dialog (for type-specific fields).
const itemTypeCode = computed(() => promotionTypes.value.find((t) => t.id === itemForm.value.promotion_type_id)?.code ?? null)
const editingSetAutoPrice = ref<string | number | null>(null) // current auto sum, shown as hint

const hasPages = computed(() => campaign.value?.campaign_type?.has_pages ?? false)

const durationDays = computed(() => {
  const c = campaign.value
  if (!c?.start_date || !c?.end_date) return null
  const [sy, sm, sd] = c.start_date.split('-').map(Number)
  const [ey, em, ed] = c.end_date.split('-').map(Number)
  return Math.round((new Date(ey, em - 1, ed).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86_400_000) + 1
})
const startWeekday = computed(() => {
  const c = campaign.value
  if (!c?.start_date) return ''
  const [y, m, d] = c.start_date.split('-').map(Number)
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(y, m - 1, d).getDay()]
})

// Category selection: all categories shown as pills, currentIndex = the open one.
const currentIndex = ref(0)
const categories = computed<CampaignCategory[]>(() => campaign.value?.categories ?? [])
const currentCategory = computed(() => categories.value[currentIndex.value] ?? null)
// Health summary across all categories, bucketed by margin band.
const catBands = computed(() => {
  const acc = { good: 0, mid: 0, low: 0 }
  for (const cc of categories.value) acc[marginBand(cc.metrics.margin_pct)]++
  return acc
})
function catWithProducts(cc: CampaignCategory): number {
  return cc.items.filter((i) => i.products_status === 'complete').length
}
function catTotalProducts(cc: CampaignCategory): number {
  return cc.items.reduce((sum, i) => sum + i.products_count, 0)
}

// --- Add-product picker (one product at a time) ---
interface CatalogProduct {
  id: number
  code: string
  name: string
  current_cost_price: string | number | null
  current_sale_price: string | number | null
  avg_daily_sales: string | number | null
  lower_sale_price_last_30_days: string | number | null
  supplier: { id: number; name: string } | null
}

const showProductsModal = ref(false)
const productItem = ref<CampaignItem | null>(null)
const categoryProducts = ref<CatalogProduct[]>([])
const addProductId = ref<number | null>(null)
const addPromotionFactor = ref<number>(100)
const addDiscountPercent = ref<number | null>(null)
const addNewPrice = ref<number | null>(null)

// Products from the category that aren't yet on this item.
const addProductOptions = computed<SelectOption[]>(() => {
  const assigned = new Set(productItem.value?.product_ids ?? [])
  return categoryProducts.value
    .filter((p) => !assigned.has(p.id))
    .map((p) => ({ label: `${p.code} — ${p.name}`, value: p.id }))
})
const selectedProduct = computed(() => categoryProducts.value.find((p) => p.id === addProductId.value) ?? null)
const productLimitsHint = computed(() => {
  const it = productItem.value
  if (!it) return ''
  const min = it.min_products ?? 1
  const max = it.max_products
  return `Assigned ${it.products_count} · min ${min}${max ? ` · max ${max}` : ''}`
})


const headerColor = computed(() => campaign.value?.campaign_type?.color || '#cbd5e1')
const typeOptions = computed<SelectOption[]>(() => promotionTypes.value.map((t) => ({ label: t.name, value: t.id })))
const itemModalTitle = computed(() => (editingItem.value ? 'Edit Promotion' : 'New Promotion'))

function categoryLabel(c: Category): string {
  const parent = c.parent_id ? allCategories.value.find((p) => p.id === c.parent_id) : null
  return parent ? `${parent.name} › ${c.name}` : c.name
}
const usedCategoryIds = computed(() => new Set((campaign.value?.categories ?? []).map((c) => c.category_id)))
// All categories (used for the MIX multi-select — overlap allowed).
const allCategoryOptions = computed<SelectOption[]>(() =>
  allCategories.value.map((c) => ({ label: categoryLabel(c), value: c.id }))
)
// Single-select options for the Add dialog: exclude categories already used as a primary bucket.
const availableCategoryOptions = computed<SelectOption[]>(() =>
  allCategories.value.filter((c) => !usedCategoryIds.value.has(c.id)).map((c) => ({ label: categoryLabel(c), value: c.id }))
)
// Single-select options for the Edit dialog: same, but keep the bucket's current primary.
const editCategoryOptions = computed<SelectOption[]>(() => {
  const cc = (campaign.value?.categories ?? []).find((c) => c.id === editingCatId.value)
  const currentCatId = cc?.category_id
  return allCategories.value
    .filter((c) => !usedCategoryIds.value.has(c.id) || c.id === currentCatId)
    .map((c) => ({ label: categoryLabel(c), value: c.id }))
})

function typeLayout(typeId: number) {
  return promotionTypes.value.find((t) => t.id === typeId)?.layout ?? null
}
function statusLabel(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// --- Presentational helpers (cockpit redesign) ---
type MarginBand = 'good' | 'mid' | 'low'
// Per-campaign target margin (%) drives the colour bands and gauge. Default 10.
const targetMargin = computed(() => Number(campaign.value?.target_margin ?? 10) || 10)
const gaugeMax = computed(() => targetMargin.value * 1.5)
function marginBand(pct: string | number | null | undefined): MarginBand {
  const n = toNum(pct)
  if (n == null) return 'mid'
  if (n >= targetMargin.value) return 'good'
  if (n >= targetMargin.value * 0.6) return 'mid'
  return 'low'
}
function gaugeWidth(pct: string | number | null | undefined): string {
  const n = toNum(pct) ?? 0
  const clamped = Math.max(0, Math.min(gaugeMax.value, n))
  return ((clamped / gaugeMax.value) * 100).toFixed(1) + '%'
}
function marginClass(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n == null) return ''
  return n > 0 ? 'pos' : n < 0 ? 'neg' : ''
}

function stageTime(s: { started_at: string | null; completed_at: string | null }): string {
  if (s.completed_at) return `Done ${s.completed_at.slice(0, 10)}`
  if (s.started_at) return `Started ${s.started_at.slice(0, 10)}`
  return ''
}

// --- Categories ---
// When MIX is off only the first selected category counts.
function categoryIdsPayload(form: { multi: boolean; category_ids: number[] }): number[] {
  return form.multi ? form.category_ids : form.category_ids.slice(0, 1)
}

function openAddCategory() {
  const first = availableCategoryOptions.value[0]?.value as number | undefined
  catForm.value = { multi: false, category_ids: first != null ? [first] : [], planned_items_count: 1 }
  showCatModal.value = true
}
async function saveCategory() {
  try {
    await api.post(`/campaigns/${campaignId}/campaign_categories`, {
      category_ids: categoryIdsPayload(catForm.value),
      planned_items_count: catForm.value.planned_items_count,
    })
    message.success('Category added')
    showCatModal.value = false
    await loadCampaign()
    currentIndex.value = Math.max(0, categories.value.length - 1) // jump to the new one
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to add category')
  }
}
function openEditCategory(cc: CampaignCategory) {
  editingCatId.value = cc.id
  catEditForm.value = {
    multi: cc.mixed,
    category_ids: cc.source_categories.map((c) => c.id),
    planned_items_count: cc.planned_items_count,
  }
  showCatEditModal.value = true
}
async function saveCategoryEdit() {
  if (editingCatId.value == null) return
  try {
    await api.patch(`/campaigns/${campaignId}/campaign_categories/${editingCatId.value}`, {
      category_ids: categoryIdsPayload(catEditForm.value),
      planned_items_count: catEditForm.value.planned_items_count,
    })
    message.success('Category updated')
    showCatEditModal.value = false
    await loadCampaign()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to update category')
  }
}
async function deleteCategory(cc: CampaignCategory) {
  try {
    await api.delete(`/campaigns/${campaignId}/campaign_categories/${cc.id}`)
    message.success('Category removed')
    await loadCampaign()
  } catch {
    message.error('Failed to remove category')
  }
}

// --- Items ---
function openNewItem(ccId: number) {
  editingItem.value = null
  activeCategoryId.value = ccId
  editingSetAutoPrice.value = null
  itemForm.value = { promotion_type_id: promotionTypes.value[0]?.id ?? null, name: '', status: 'draft', page_no: null, order_on_page: null, new_sale_price: null, buy_quantity: null, pay_quantity: null }
  showItemModal.value = true
}
function openEditItem(item: CampaignItem) {
  editingItem.value = item
  activeCategoryId.value = item.campaign_category_id
  editingSetAutoPrice.value = item.new_sale_price // current value (= auto sum when not manual)
  itemForm.value = {
    promotion_type_id: item.promotion_type_id,
    name: item.name ?? '',
    status: item.status,
    page_no: item.page_no,
    order_on_page: item.order_on_page,
    // Field empty when auto → saving empty keeps it auto; filled only when overridden.
    new_sale_price: item.new_sale_price_manual ? Number(item.new_sale_price) : null,
    buy_quantity: item.buy_quantity,
    pay_quantity: item.pay_quantity,
  }
  showItemModal.value = true
}
async function saveItem() {
  const base = `/campaigns/${campaignId}/campaign_categories/${activeCategoryId.value}/items`
  try {
    if (editingItem.value) {
      await api.patch(`${base}/${editingItem.value.id}`, itemForm.value)
      message.success('Promotion updated')
    } else {
      await api.post(base, itemForm.value)
      message.success('Promotion added')
    }
    showItemModal.value = false
    await loadCampaign()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to save')
  }
}
async function deleteItem(item: CampaignItem) {
  try {
    await api.delete(`/campaigns/${campaignId}/campaign_categories/${item.campaign_category_id}/items/${item.id}`)
    message.success('Promotion deleted')
    await loadCampaign()
  } catch {
    message.error('Failed to delete')
  }
}

// --- Products ---
function itemProductsUrl(item: CampaignItem): string {
  return `/campaigns/${campaignId}/campaign_categories/${item.campaign_category_id}/items/${item.id}/products`
}

async function openAddProduct(item: CampaignItem, cc: CampaignCategory) {
  productItem.value = item
  addProductId.value = null
  addPromotionFactor.value = 100
  addDiscountPercent.value = null
  addNewPrice.value = null
  categoryProducts.value = []
  showProductsModal.value = true
  try {
    const categoryIds = cc.source_categories.map((c) => c.id)
    const { data } = await api.get('/products', { params: { category_ids: categoryIds } })
    categoryProducts.value = data
  } catch {
    message.error('Failed to load products')
  }
}

async function addProduct() {
  const it = productItem.value
  if (!it || addProductId.value == null) return
  try {
    await api.post(itemProductsUrl(it), {
      product_id: addProductId.value,
      promotion_factor: addPromotionFactor.value,
      discount_percent: addDiscountPercent.value,
      new_price: addNewPrice.value,
    })
    message.success('Product added')
    showProductsModal.value = false
    await loadCampaign()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to add product')
  }
}

async function removeProductFromItem(item: CampaignItem, linkId: number) {
  try {
    await api.delete(`${itemProductsUrl(item)}/${linkId}`)
    message.success('Product removed')
    await loadCampaign()
  } catch {
    message.error('Failed to remove product')
  }
}

// --- Product preview (read-only) ---
const showPreviewModal = ref(false)
const previewItemId = ref<number | null>(null)
const previewLinkId = ref<number | null>(null)
const previewItem = computed<CampaignItem | null>(() => {
  if (previewItemId.value == null) return null
  for (const cc of campaign.value?.categories ?? []) {
    const f = cc.items.find((i) => i.id === previewItemId.value)
    if (f) return f
  }
  return null
})
const previewCip = computed<PromotionProduct | null>(
  () => previewItem.value?.products.find((p) => p.link_id === previewLinkId.value) ?? null
)
function openPreview(item: CampaignItem, cip: PromotionProduct) {
  previewItemId.value = item.id
  previewLinkId.value = cip.link_id
  showPreviewModal.value = true
}

// --- Product table (campaign view) ---
function toNum(v: string | number | null | undefined): number | null {
  return v == null || v === '' ? null : Number(v)
}
function fmt(v: string | number | null | undefined): string {
  return formatNumber(v)
}

async function patchProduct(item: CampaignItem, row: PromotionProduct, payload: Record<string, unknown>) {
  try {
    await api.patch(`${itemProductsUrl(item)}/${row.link_id}`, payload)
    await loadCampaign()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to update product')
  }
}

// Product margin (sales value − cost) for the 2-line product rows.
function productMargin(row: PromotionProduct): number | null {
  const v = toNum(row.product_sales_value)
  const c = toNum(row.product_cost)
  if (v == null || c == null) return null
  return v - c
}

// --- Edit product in promotion (promotion_factor + supplier purchase conditions) ---
const showProductEditModal = ref(false)
const editCipItemId = ref<number | null>(null)
const editCipLinkId = ref<number | null>(null)
const editCipFactor = ref<number>(100)
const suppliers = ref<{ id: number; name: string; code: string }[]>([])
const conditionForm = ref({
  supplier_id: null as number | null,
  quantity_min: null as number | null,
  purchase_price: null as number | null,
  backmargin_value: null as number | null,
})

// Resolve item + product (CIP) from live campaign data so the dialog refreshes after reload.
const editCipItem = computed<CampaignItem | null>(() => {
  if (editCipItemId.value == null) return null
  for (const cc of campaign.value?.categories ?? []) {
    const found = cc.items.find((i) => i.id === editCipItemId.value)
    if (found) return found
  }
  return null
})
const editingCip = computed<PromotionProduct | null>(
  () => editCipItem.value?.products.find((p) => p.link_id === editCipLinkId.value) ?? null
)
const supplierOptions = computed<SelectOption[]>(() => suppliers.value.map((s) => ({ label: s.name, value: s.id })))

function cipUrl(): string | null {
  const it = editCipItem.value
  if (!it || editCipLinkId.value == null) return null
  return `/campaigns/${campaignId}/campaign_categories/${it.campaign_category_id}/items/${it.id}/products/${editCipLinkId.value}`
}

async function openEditProduct(item: CampaignItem, cip: PromotionProduct) {
  editCipItemId.value = item.id
  editCipLinkId.value = cip.link_id
  editCipFactor.value = Number(cip.promotion_factor ?? 100)
  conditionForm.value = { supplier_id: cip.supplier?.id ?? null, quantity_min: null, purchase_price: null, backmargin_value: null }
  showProductEditModal.value = true
  if (!suppliers.value.length) {
    try {
      const { data } = await api.get('/suppliers')
      suppliers.value = data
    } catch {
      message.error('Failed to load suppliers')
    }
  }
}

async function saveFactor(val: number | null) {
  editCipFactor.value = val ?? 100
  const url = cipUrl()
  if (!url) return
  try {
    await api.patch(url, { promotion_factor: val })
    await loadCampaign()
  } catch {
    message.error('Failed to update factor')
  }
}

async function patchEditCip(payload: Record<string, unknown>) {
  const it = editCipItem.value
  const cip = editingCip.value
  if (!it || !cip) return
  await patchProduct(it, cip, payload)
}

async function addCondition() {
  const url = cipUrl()
  if (!url || conditionForm.value.supplier_id == null || conditionForm.value.purchase_price == null) return
  try {
    await api.post(`${url}/conditions`, conditionForm.value)
    message.success('Condition added')
    await loadCampaign()
    conditionForm.value.quantity_min = null
    conditionForm.value.purchase_price = null
    conditionForm.value.backmargin_value = null
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to add condition')
  }
}

async function deleteCondition(conditionId: number) {
  const url = cipUrl()
  if (!url) return
  try {
    await api.delete(`${url}/conditions/${conditionId}`)
    message.success('Condition removed')
    await loadCampaign()
  } catch {
    message.error('Failed to remove condition')
  }
}

async function loadCampaign() {
  loading.value = true
  try {
    const { data } = await api.get(`/campaigns/${campaignId}`)
    campaign.value = data
    const cats = data.categories ?? []
    if (currentIndex.value > cats.length - 1) {
      currentIndex.value = Math.max(0, cats.length - 1)
    }
  } catch {
    message.error('Failed to load campaign')
  } finally {
    loading.value = false
  }
}
async function loadLookups() {
  try {
    const [types, cats] = await Promise.all([api.get('/promotion_types'), api.get('/categories')])
    promotionTypes.value = types.data
    allCategories.value = cats.data
  } catch {
    message.error('Failed to load lookups')
  }
}

// Drive the app top-bar breadcrumb from the loaded campaign.
watch(
  campaign,
  (c) => {
    setBreadcrumbs([
      { label: '← Campaigns', to: '/campaigns' },
      ...(c ? [{ label: c.name }] : []),
    ])
  },
  { immediate: true }
)
onUnmounted(clearBreadcrumbs)

// Comment indicators: one batched summary per screen, refreshed only when comments change.
function commentTargets() {
  const c = campaign.value
  if (!c) return []
  const itemIds: number[] = []
  const cipIds: number[] = []
  for (const cc of c.categories ?? []) {
    for (const it of cc.items) {
      itemIds.push(it.id)
      for (const p of it.products) cipIds.push(p.link_id)
    }
  }
  return [
    { ref_model: 'Campaign', ref_ids: [c.id] },
    { ref_model: 'CampaignItem', ref_ids: itemIds },
    { ref_model: 'CampaignItemProduct', ref_ids: cipIds },
  ]
}

async function refreshAnnotations() {
  const targets = commentTargets()
  await Promise.all([loadSummary(targets), loadStatusSummary(targets)])
}

onMounted(async () => {
  await Promise.all([loadCampaign(), loadLookups(), loadParameters()])
  await refreshAnnotations()
})
watch(commentsVersion, () => loadSummary(commentTargets()))
watch(statusVersion, () => loadStatusSummary(commentTargets()))
</script>

<template>
  <div class="cockpit">
    <NSpin :show="loading">
      <template v-if="campaign">
        <!-- ===== CAMPAIGN HEADER ===== -->
        <section class="ck-card ck-header" :style="{ borderTop: '3px solid ' + headerColor }">
          <div class="ck-head-main">
            <div class="ck-title-row">
              <span class="ck-dot" :style="`background:${headerColor}`"></span>
              <FieldMeta ref-model="Campaign" :ref-id="campaign.id" :attribute="null" label="Campaign" :size="16" />
              <span class="chip-comment"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="name" label="Campaign name" :size="16" /><NH2 class="ck-h1" style="margin: 0">{{ campaign.name }}</NH2></span>
              <NTag v-if="campaign.campaign_type" class="ck-type-tag" size="small" :bordered="false">{{ campaign.campaign_type.name }}</NTag>
              <span class="chip-comment"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="status" label="Status" /><NTag :type="STATUS_TAG[campaign.status] ?? 'default'" size="small" round :bordered="false">{{ statusLabel(campaign.status) }}</NTag></span>
            </div>
            <div class="ck-meta-row">
              <button class="ck-stage" @click="showProcessModal = true">
                <NIcon class="ck-stage-ico"><GitNetworkOutline /></NIcon>
                {{ campaign.current_stage ? `${campaign.current_stage.position}. ${campaign.current_stage.name}` : 'Process' }}
              </button>
              <button class="ck-stage" @click="$router.push({ name: 'CampaignLeaflet', params: { id: campaign.id } })">
                <NIcon class="ck-stage-ico"><NewspaperOutline /></NIcon>
                Leaflet preview
              </button>
              <span class="ck-meta-chip">Duration <b>{{ durationDays }} days</b></span>
              <span class="ck-meta-chip">Starts <b>{{ startWeekday }}</b></span>
              <button class="ck-icon-btn" title="Edit campaign" @click="openCampaignEdit">
                <NIcon><CreateOutline /></NIcon>
              </button>
            </div>
          </div>
          <div class="ck-cal">
            <CampaignMiniCalendar :start="campaign.start_date" :end="campaign.end_date" :color="headerColor" />
          </div>
        </section>

        <!-- ===== CAMPAIGN KPI HERO ===== -->
        <section v-if="campaign.metrics" class="ck-card ck-kpi">
          <div class="ck-kpi-counts">
            <div class="ck-count"><span class="ck-count-l">Flow</span><span class="ck-count-v">{{ campaign.process_template?.name ?? '—' }}</span></div>
            <span class="ck-vsep"></span>
            <div class="ck-count"><span class="ck-count-l">Promotions</span><span class="ck-count-v mono">{{ campaign.items_count }} / {{ campaign.planned_items_total }}</span></div>
            <div class="ck-count"><span class="ck-count-l">Categories</span><span class="ck-count-v mono">{{ campaign.categories_count }}</span></div>
            <div v-if="hasPages" class="ck-count"><span class="ck-count-l">Pages</span><span class="ck-count-v mono"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="pages_count" label="Pages" />{{ campaign.pages_count ?? '—' }}</span></div>
            <span class="ck-spacer"></span>
            <NTag v-if="!campaign.metrics.fully_priced" size="small" type="warning" :bordered="false">pricing incomplete</NTag>
            <span class="ck-totals-lbl">Campaign totals</span>
          </div>
          <div class="ck-kpi-row">
            <div class="ck-kpi-cell">
              <span class="ck-kpi-l">Est. volume</span>
              <span class="ck-kpi-v mono">{{ fmt(campaign.metrics.volume) }}</span>
            </div>
            <div class="ck-kpi-cell">
              <span class="ck-kpi-l">Cost</span>
              <span class="ck-kpi-v mono"><MoneyValue :value="campaign.metrics.cost" /></span>
            </div>
            <div class="ck-kpi-cell">
              <span class="ck-kpi-l">Sales value</span>
              <span class="ck-kpi-v mono"><MoneyValue :value="campaign.metrics.sales_value" /></span>
            </div>
            <div class="ck-kpi-cell">
              <span class="ck-kpi-l">Margin</span>
              <span class="ck-kpi-v mono" :class="marginClass(campaign.metrics.margin)"><MoneyValue :value="campaign.metrics.margin" /></span>
            </div>
            <div class="ck-kpi-hero" :class="`band-${marginBand(campaign.metrics.margin_pct)}`">
              <div class="ck-hero-top">
                <span class="ck-kpi-l">Margin %</span>
                <span class="ck-hero-v mono">{{ campaign.metrics.margin_pct == null ? '—' : campaign.metrics.margin_pct + '%' }}</span>
              </div>
              <div class="ck-gauge"><div class="ck-gauge-fill" :style="`width:${gaugeWidth(campaign.metrics.margin_pct)}`"></div><div class="ck-gauge-target"></div></div>
              <div class="ck-gauge-scale"><span>0%</span><span>target {{ targetMargin }}%</span><span>{{ gaugeMax }}%</span></div>
            </div>
          </div>
        </section>

        <!-- ===== CATEGORY PILLS (replaces carousel) ===== -->
        <section class="ck-cats">
          <div class="ck-pills">
            <span class="ck-pills-lbl">Categories</span>
            <span class="ck-band-summary">
              <span v-if="catBands.good" class="ck-band-chip is-good"><span class="ck-band-dot"></span>{{ catBands.good }} on target</span>
              <span v-if="catBands.mid" class="ck-band-chip is-mid"><span class="ck-band-dot"></span>{{ catBands.mid }} watch</span>
              <span v-if="catBands.low" class="ck-band-chip is-low"><span class="ck-band-dot"></span>{{ catBands.low }} below</span>
            </span>
            <button
              v-for="(cc, i) in categories"
              :key="cc.id"
              class="ck-pill"
              :class="[`band-${marginBand(cc.metrics.margin_pct)}`, { active: i === currentIndex }]"
              @click="currentIndex = i"
            >
              <span class="ck-pill-bar"></span>
              <div class="ck-pill-top">
                <span class="ck-pill-name">{{ cc.name }}</span>
                <NTag v-if="cc.mixed" size="tiny" type="success" :bordered="false">MIX</NTag>
                <span class="ck-pill-pct mono">{{ cc.metrics.margin_pct == null ? '—' : cc.metrics.margin_pct + '%' }}</span>
              </div>
              <span class="ck-pill-sub">{{ cc.items.length }} / {{ cc.planned_items_count }} promotions</span>
            </button>
            <button class="ck-pill-add" @click="openAddCategory">+ Category</button>
          </div>

          <div v-if="!categories.length" class="empty-cat-card">
            No categories yet. Add a category to start planning promotions.
          </div>

          <div v-else-if="currentCategory" class="ck-card ck-cat-panel">
            <div class="ck-cat-head">
              <div class="ck-cat-title">
                <NH2 class="ck-cat-name" style="margin: 0">{{ currentCategory.name }}</NH2>
                <NTag v-if="currentCategory.mixed" size="small" type="success" :bordered="false">MIX</NTag>
                <span class="ck-muted">{{ currentCategory.items.length }} / {{ currentCategory.planned_items_count }} promotions</span>
              </div>
              <NSpace size="small">
                <NButton size="small" tertiary @click="openEditCategory(currentCategory)">
                  <template #icon><NIcon><CreateOutline /></NIcon></template>
                  Edit
                </NButton>
                <NPopconfirm @positive-click="() => deleteCategory(currentCategory!)">
                  <template #trigger><NButton size="small" type="error" tertiary>Remove</NButton></template>
                  Remove category "{{ currentCategory.name }}" and its promotions?
                </NPopconfirm>
              </NSpace>
            </div>

            <!-- slim category summary -->
            <div class="ck-summary">
              <div class="ck-sum"><span class="ck-sum-l">Promotions</span><span class="ck-sum-v mono">{{ currentCategory.items.length }} / {{ currentCategory.planned_items_count }}</span></div>
              <div class="ck-sum"><span class="ck-sum-l">With products</span><span class="ck-sum-v mono">{{ catWithProducts(currentCategory) }} / {{ currentCategory.items.length }}</span></div>
              <div class="ck-sum"><span class="ck-sum-l">Products</span><span class="ck-sum-v mono">{{ catTotalProducts(currentCategory) }}</span></div>
              <span class="ck-vsep"></span>
              <div class="ck-sum"><span class="ck-sum-l">Est. volume</span><span class="ck-sum-v mono">{{ fmt(currentCategory.metrics.volume) }}</span></div>
              <div class="ck-sum"><span class="ck-sum-l">Cost</span><span class="ck-sum-v mono"><MoneyValue :value="currentCategory.metrics.cost" /></span></div>
              <div class="ck-sum"><span class="ck-sum-l">Sales value</span><span class="ck-sum-v mono"><MoneyValue :value="currentCategory.metrics.sales_value" /></span></div>
              <div class="ck-sum"><span class="ck-sum-l">Margin</span><span class="ck-sum-v mono" :class="marginClass(currentCategory.metrics.margin)"><MoneyValue :value="currentCategory.metrics.margin" /></span></div>
              <span class="ck-spacer"></span>
              <div class="ck-sum ck-sum-end">
                <span class="ck-sum-l">Margin %</span>
                <span class="ck-sum-pct mono" :class="`txt-${marginBand(currentCategory.metrics.margin_pct)}`">{{ currentCategory.metrics.margin_pct == null ? '—' : currentCategory.metrics.margin_pct + '%' }}</span>
              </div>
              <NTag v-if="currentCategory.items.length && !currentCategory.metrics.fully_priced" size="small" type="warning" :bordered="false">pricing incomplete</NTag>
            </div>

            <div class="ck-promo-toolbar">
              <span class="ck-section-lbl">Promotions</span>
              <NButton type="primary" size="small" @click="openNewItem(currentCategory.id)">+ Promotion</NButton>
            </div>

            <div v-if="!currentCategory.items.length" class="promo-empty">No promotions yet — click "+ Promotion".</div>

            <div class="ck-promo-grid">
              <div v-for="item in currentCategory.items" :key="item.id" class="ck-promo">
                <div class="ck-promo-head">
                  <div class="ck-promo-left">
                    <FieldMeta ref-model="CampaignItem" :ref-id="item.id" :attribute="null" label="Promotion" :size="15" />
                    <span v-if="item.name" class="chip-comment ck-promo-name"><FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="name" label="Promotion name" />{{ item.name }}</span>
                    <span class="ck-promo-type">{{ item.promotion_type.name }}</span>
                    <span class="chip-comment"><FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="status" label="Status" /><NTag size="small" :bordered="false" :type="ITEM_STATUS_TAG[item.status] ?? 'default'">{{ statusLabel(item.status) }}</NTag></span>
                    <NTag size="small" :bordered="false" :type="PRODUCTS_STATUS_TAG[item.products_status] ?? 'default'">{{ item.products_count }} products{{ item.min_products ? ` / min ${item.min_products}` : '' }}</NTag>
                    <span v-if="hasPages && item.page_no" class="chip-comment"><FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="page_no" label="Page" /><NTag size="small" type="info" :bordered="false">p.{{ item.page_no }} · #{{ item.order_on_page ?? '—' }}</NTag></span>
                    <NTag v-if="item.promotion_type.code === 'quantity' && item.buy_quantity && item.pay_quantity" size="small" type="warning" :bordered="false">buy {{ item.buy_quantity }} pay {{ item.pay_quantity }}</NTag>
                  </div>
                  <div class="ck-promo-right">
                    <div class="ck-promo-metrics">
                      <span class="ck-pm"><span class="ck-pm-l">Vol</span><span class="ck-pm-v mono">{{ fmt(item.metrics.volume) }}</span></span>
                      <span class="ck-pm"><span class="ck-pm-l">Margin</span><span class="ck-pm-v mono" :class="marginClass(item.metrics.margin)"><MoneyValue :value="item.metrics.margin" /></span></span>
                      <span class="ck-pm"><span class="ck-pm-l">Margin %</span><span class="ck-pm-v mono" :class="`txt-${marginBand(item.metrics.margin_pct)}`">{{ item.metrics.margin_pct == null ? '—' : item.metrics.margin_pct + '%' }}</span></span>
                      <NTag v-if="item.products.length && !item.metrics.fully_priced" size="tiny" type="warning" :bordered="false">pricing incomplete</NTag>
                    </div>
                    <div class="ck-skeleton">
                      <PromotionSkeleton :layout="typeLayout(item.promotion_type_id)" />
                    </div>
                    <NSpace size="small">
                      <NButton size="small" circle tertiary title="Add product" @click="openAddProduct(item, currentCategory!)">
                        <template #icon><NIcon><BagHandleOutline /></NIcon></template>
                      </NButton>
                      <NButton size="small" circle tertiary title="Edit promotion" @click="openEditItem(item)">
                        <template #icon><NIcon><CreateOutline /></NIcon></template>
                      </NButton>
                      <NPopconfirm @positive-click="() => deleteItem(item)">
                        <template #trigger>
                          <NButton size="small" circle tertiary type="error" title="Delete promotion">
                            <template #icon><NIcon><TrashOutline /></NIcon></template>
                          </NButton>
                        </template>
                        Delete this promotion?
                      </NPopconfirm>
                    </NSpace>
                  </div>
                </div>

                <div v-if="item.promotion_type.code === 'set'" class="ck-set-banner">
                  <div class="ck-set-cell">
                    <span class="ck-set-lbl">Products total</span>
                    <span class="ck-set-sum mono" :class="{ 'ck-strike': item.new_sale_price_manual && Number(item.products_price_sum) !== Number(item.new_sale_price) }"><MoneyValue :value="item.products_price_sum" /></span>
                  </div>
                  <span class="ck-set-arrow">→</span>
                  <div class="ck-set-cell ck-set-cell-main">
                    <span class="ck-set-lbl">Set price<span v-if="item.new_sale_price_manual" class="ck-set-manual">manual</span></span>
                    <span class="ck-set-val mono"><FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="new_sale_price" label="Set sale price" /><MoneyValue :value="item.new_sale_price" /></span>
                  </div>
                  <span v-if="item.new_sale_price_manual && Number(item.products_price_sum) > Number(item.new_sale_price)" class="ck-set-save mono">
                    −<MoneyValue :value="Number(item.products_price_sum) - Number(item.new_sale_price)" />
                  </span>
                </div>

                <div v-if="item.products.length" class="ck-prod-list">
                  <div v-for="row in item.products" :key="row.link_id" class="ck-prod">
                    <div class="ck-prod-l1">
                      <div class="ck-prod-id tcell-click" title="Preview product" @click="openPreview(item, row)">
                        <span class="ck-prod-name">{{ row.name }}</span>
                        <span class="ck-prod-sub">{{ row.code }}<template v-if="row.supplier"> · {{ row.supplier.name }}</template></span>
                      </div>
                      <div class="ck-prod-right">
                        <div class="ck-prod-price">
                          <span class="chip-comment"><FieldMeta ref-model="CampaignItemProduct" :ref-id="row.link_id" attribute="current_sale_price" label="Sale price" /><span class="ck-old"><MoneyValue :value="row.current_sale_price" /></span></span>
                          <span class="ck-arrow">→</span>
                          <span class="chip-comment"><FieldMeta ref-model="CampaignItemProduct" :ref-id="row.link_id" attribute="new_price" label="New price" /><span class="ck-new"><MoneyValue :value="row.new_price" /></span></span>
                          <span class="chip-comment"><FieldMeta ref-model="CampaignItemProduct" :ref-id="row.link_id" attribute="discount_percent" label="Discount %" /><span v-if="row.discount_percent != null" class="ck-disc">-{{ row.discount_percent }}%</span></span>
                        </div>
                        <NSpace size="small">
                          <NButton size="tiny" quaternary circle title="Preview product" @click="openPreview(item, row)"><template #icon><NIcon><EyeOutline /></NIcon></template></NButton>
                          <NButton size="tiny" quaternary circle :title="`Edit (factor, ${row.conditions.length} conditions)`" @click="openEditProduct(item, row)"><template #icon><NIcon><CreateOutline /></NIcon></template></NButton>
                          <NButton size="tiny" quaternary circle type="error" title="Remove product" @click="removeProductFromItem(item, row.link_id)"><template #icon><NIcon><CloseOutline /></NIcon></template></NButton>
                        </NSpace>
                      </div>
                    </div>
                    <div class="ck-prod-l2">
                      <div class="ck-stat"><span class="ck-stat-l">Est. volume</span><span class="ck-stat-v mono">{{ fmt(row.estimated_volume) }}</span></div>
                      <div class="ck-stat"><span class="ck-stat-l">Cost</span><span class="ck-stat-v mono"><MoneyValue :value="row.product_cost" /></span></div>
                      <div class="ck-stat"><span class="ck-stat-l">Sales value</span><span class="ck-stat-v mono"><MoneyValue :value="row.product_sales_value" /></span></div>
                      <span class="ck-spacer"></span>
                      <div class="ck-stat ck-stat-end"><span class="ck-stat-l">Margin</span><span class="ck-stat-v mono" :class="marginClass(productMargin(row))"><MoneyValue :value="productMargin(row)" /></span></div>
                    </div>
                  </div>
                </div>
                <div v-else class="promo-products-empty">No products assigned yet</div>
              </div>
            </div>
          </div>
        </section>

      </template>
    </NSpin>

    <!-- Process / flow statuses modal -->
    <NModal v-model:show="showProcessModal">
      <NCard title="Process — stages" style="width: 560px" closable @close="showProcessModal = false">
        <NTimeline>
          <NTimelineItem
            v-for="s in campaign?.stages"
            :key="s.id"
            :type="STAGE_TYPE[s.status] ?? 'default'"
            :title="`${s.position}. ${s.name}`"
            :time="stageTime(s)"
          >
            <NSpace size="small" align="center">
              <NTag size="small" :type="STAGE_TYPE[s.status] ?? 'default'">{{ s.status }}</NTag>
              <NTag v-if="s.is_gate" size="small" type="warning">Gate</NTag>
              <NText depth="3" style="font-size:12px">{{ s.stage_type }}</NText>
            </NSpace>
          </NTimelineItem>
        </NTimeline>
      </NCard>
    </NModal>

    <!-- Edit campaign modal -->
    <NModal v-model:show="showCampaignEditModal">
      <NCard title="Edit campaign" style="width: 460px" closable @close="showCampaignEditModal = false">
        <NForm @submit.prevent="saveCampaign">
          <NFormItem label="Name">
            <NInput v-model:value="campaignForm.name" />
          </NFormItem>
          <NFormItem label="Status">
            <NSelect v-model:value="campaignForm.status" :options="CAMPAIGN_STATUS_OPTIONS" />
          </NFormItem>
          <NFormItem label="Start date">
            <NDatePicker v-model:formatted-value="campaignForm.start_date" type="date" value-format="yyyy-MM-dd" style="width: 100%" />
          </NFormItem>
          <NFormItem label="End date">
            <NDatePicker v-model:formatted-value="campaignForm.end_date" type="date" value-format="yyyy-MM-dd" style="width: 100%" />
          </NFormItem>
          <NFormItem label="Target margin (%)">
            <NInputNumber v-model:value="campaignForm.target_margin" :min="0" :precision="2" style="width: 100%" />
          </NFormItem>
          <NFormItem v-if="hasPages" label="Pages">
            <NInputNumber v-model:value="campaignForm.pages_count" :min="1" style="width: 100%" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showCampaignEditModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>

    <!-- Product preview (read-only) modal -->
    <NModal v-model:show="showPreviewModal">
      <NCard
        v-if="previewCip && previewItem"
        title="Product preview"
        style="width: 1080px; max-width: 94vw"
        closable
        @close="showPreviewModal = false"
      >
        <ProductPreview
          :product="previewCip"
          :promotion-type-name="previewItem.promotion_type.name"
          :category-name="currentCategory?.name ?? ''"
          :layout="typeLayout(previewItem.promotion_type_id)"
        />
      </NCard>
    </NModal>

    <!-- Edit product in promotion modal -->
    <NModal v-model:show="showProductEditModal">
      <NCard v-if="editingCip" :title="editingCip.name" style="width: 760px" closable @close="showProductEditModal = false">
        <NText depth="3" style="display:block; margin-bottom: 6px">
          {{ editingCip.code }}<template v-if="editingCip.supplier"> · {{ editingCip.supplier.name }}</template>
        </NText>
        <div class="ap-prices">
          <div class="meta"><span class="stat-lbl">Sale price</span><span class="meta-val"><MoneyValue :value="editingCip.current_sale_price" /></span></div>
          <div class="meta"><span class="stat-lbl">Cost price</span><span class="meta-val"><MoneyValue :value="editingCip.current_cost_price" /></span></div>
          <div class="meta"><span class="stat-lbl">Lowest 30d</span><span class="meta-val"><MoneyValue :value="editingCip.lower_sale_price_last_30_days" /></span></div>
          <div class="meta"><span class="stat-lbl">Avg / day</span><span class="meta-val">{{ editingCip.avg_daily_sales ?? '—' }}</span></div>
          <div class="meta"><span class="stat-lbl">Est. volume</span><span class="meta-val">{{ editingCip.estimated_volume ?? '—' }}</span></div>
        </div>

        <div class="ap-factor">
          <span class="stat-lbl">Promotion factor (%)</span>
          <NInputNumber :value="editCipFactor" :min="0" :step="20" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" @update:value="saveFactor" />
          <NText depth="3" style="font-size:12px">expected sales uplift during the promotion</NText>
        </div>
        <div class="ap-factor">
          <span class="stat-lbl">Discount (%)</span>
          <NInputNumber :value="toNum(editingCip.discount_percent)" :min="0" :max="100" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" placeholder="—" @update:value="(v) => patchEditCip({ discount_percent: v, new_price: null })" />
          <span class="stat-lbl">New price</span>
          <NInputNumber :value="toNum(editingCip.new_price)" :min="0" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" placeholder="—" @update:value="(v) => patchEditCip({ new_price: v, discount_percent: null })" />
        </div>

        <div class="cond-title">Supplier purchase conditions</div>

        <div v-if="editingCip.conditions.length" class="cond-list">
          <div v-for="c in editingCip.conditions" :key="c.id" class="cond-row">
            <div class="cond-main">
              <span class="cond-product">{{ c.supplier?.name ?? '—' }}</span>
            </div>
            <div class="cond-vals">
              <span><span class="stat-lbl">Qty min</span> {{ c.quantity_min ?? '—' }}</span>
              <span><span class="stat-lbl">Purchase</span> <MoneyValue :value="c.purchase_price" /></span>
              <span><span class="stat-lbl">Backmargin</span> <MoneyValue :value="c.backmargin_value" /></span>
            </div>
            <NButton size="tiny" circle quaternary type="error" title="Remove" @click="deleteCondition(c.id)">
              <template #icon><NIcon><TrashOutline /></NIcon></template>
            </NButton>
          </div>
        </div>
        <div v-else class="promo-empty">No supplier conditions yet.</div>

        <NForm @submit.prevent="addCondition" style="margin-top: 14px">
          <div class="cond-form">
            <NFormItem label="Supplier">
              <NSelect v-model:value="conditionForm.supplier_id" :options="supplierOptions" filterable placeholder="Supplier" />
            </NFormItem>
            <NFormItem label="Qty min">
              <NInputNumber v-model:value="conditionForm.quantity_min" :min="0" style="width: 100%" />
            </NFormItem>
            <NFormItem label="Purchase price">
              <NInputNumber v-model:value="conditionForm.purchase_price" :min="0" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" style="width: 100%" />
            </NFormItem>
            <NFormItem label="Backmargin (amount)">
              <NInputNumber v-model:value="conditionForm.backmargin_value" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" style="width: 100%" />
            </NFormItem>
          </div>
          <NSpace justify="end">
            <NButton type="primary" attr-type="submit" :disabled="conditionForm.supplier_id == null || conditionForm.purchase_price == null">Add condition</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>

    <!-- Add category modal -->
    <NModal v-model:show="showCatModal">
      <NCard title="Add Category" style="width: 460px" closable @close="showCatModal = false">
        <NForm @submit.prevent="saveCategory">
          <NFormItem>
            <NCheckbox v-model:checked="catForm.multi">Multi category (MIX)</NCheckbox>
          </NFormItem>
          <NFormItem :label="catForm.multi ? 'Categories' : 'Category'">
            <NSelect
              v-if="catForm.multi"
              v-model:value="catForm.category_ids"
              :options="allCategoryOptions"
              multiple
              filterable
              placeholder="Select categories"
            />
            <NSelect
              v-else
              :value="catForm.category_ids[0] ?? null"
              :options="availableCategoryOptions"
              filterable
              placeholder="Select category"
              @update:value="(v: number | null) => (catForm.category_ids = v == null ? [] : [v])"
            />
          </NFormItem>
          <div v-if="catForm.multi" class="mix-hint">Products from all selected categories can go into one promotion (e.g. a SET).</div>
          <NFormItem label="Planned promotions">
            <NInputNumber v-model:value="catForm.planned_items_count" :min="0" style="width: 100%" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showCatModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>

    <!-- Edit category modal -->
    <NModal v-model:show="showCatEditModal">
      <NCard title="Edit category" style="width: 460px" closable @close="showCatEditModal = false">
        <NForm @submit.prevent="saveCategoryEdit">
          <NFormItem>
            <NCheckbox v-model:checked="catEditForm.multi">Multi category (MIX)</NCheckbox>
          </NFormItem>
          <NFormItem :label="catEditForm.multi ? 'Categories' : 'Category'">
            <NSelect
              v-if="catEditForm.multi"
              v-model:value="catEditForm.category_ids"
              :options="allCategoryOptions"
              multiple
              filterable
              placeholder="Select categories"
            />
            <NSelect
              v-else
              :value="catEditForm.category_ids[0] ?? null"
              :options="editCategoryOptions"
              filterable
              placeholder="Select category"
              @update:value="(v: number | null) => (catEditForm.category_ids = v == null ? [] : [v])"
            />
          </NFormItem>
          <div v-if="catEditForm.multi" class="mix-hint">Products from all selected categories can go into one promotion (e.g. a SET).</div>
          <NFormItem label="Planned promotions">
            <NInputNumber v-model:value="catEditForm.planned_items_count" :min="0" style="width: 100%" />
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showCatEditModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>

    <!-- Add one product modal -->
    <NModal v-model:show="showProductsModal">
      <NCard title="Add product" style="width: 720px" closable @close="showProductsModal = false">
        <NText depth="3" style="display:block; margin-bottom: 10px">{{ productLimitsHint }}</NText>
        <NSelect
          v-model:value="addProductId"
          :options="addProductOptions"
          filterable
          clearable
          placeholder="Select one product from this category"
        />

        <div v-if="selectedProduct" class="ap-prices">
          <div class="meta"><span class="stat-lbl">Supplier</span><span class="meta-val">{{ selectedProduct.supplier?.name ?? '—' }}</span></div>
          <div class="meta"><span class="stat-lbl">Sale price</span><span class="meta-val"><MoneyValue :value="selectedProduct.current_sale_price" /></span></div>
          <div class="meta"><span class="stat-lbl">Cost price</span><span class="meta-val"><MoneyValue :value="selectedProduct.current_cost_price" /></span></div>
          <div class="meta"><span class="stat-lbl">Lowest 30d</span><span class="meta-val"><MoneyValue :value="selectedProduct.lower_sale_price_last_30_days" /></span></div>
          <div class="meta"><span class="stat-lbl">Avg / day</span><span class="meta-val">{{ selectedProduct.avg_daily_sales ?? '—' }}</span></div>
        </div>

        <div class="ap-factor">
          <span class="stat-lbl">Promotion factor (%)</span>
          <NInputNumber v-model:value="addPromotionFactor" :min="0" :step="20" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" />
          <NText depth="3" style="font-size:12px">expected sales uplift during the promotion</NText>
        </div>
        <div class="ap-factor">
          <span class="stat-lbl">Discount (%)</span>
          <NInputNumber :value="addDiscountPercent" :min="0" :max="100" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" placeholder="—" @update:value="(v) => { addDiscountPercent = v; if (v != null) addNewPrice = null }" />
          <span class="stat-lbl">New price</span>
          <NInputNumber :value="addNewPrice" :min="0" :precision="2" :format="formatNumberInput" :parse="parseNumberInput" style="width: 140px" placeholder="—" @update:value="(v) => { addNewPrice = v; if (v != null) addDiscountPercent = null }" />
        </div>

        <NSpace justify="end" style="margin-top: 16px">
          <NButton @click="showProductsModal = false">Cancel</NButton>
          <NButton type="primary" :disabled="addProductId == null" @click="addProduct">Add</NButton>
        </NSpace>
      </NCard>
    </NModal>

    <!-- Add/edit item modal -->
    <NModal v-model:show="showItemModal">
      <NCard :title="itemModalTitle" style="width: 480px" closable @close="showItemModal = false">
        <NForm @submit.prevent="saveItem">
          <NFormItem label="Promotion Type">
            <NSelect v-model:value="itemForm.promotion_type_id" :options="typeOptions" placeholder="Select type" />
          </NFormItem>
          <NFormItem label="Name (optional)">
            <NInput v-model:value="itemForm.name" placeholder="e.g. Charcoal -30%" />
          </NFormItem>
          <NFormItem label="Status">
            <NSelect v-model:value="itemForm.status" :options="ITEM_STATUS_OPTIONS" />
          </NFormItem>
          <NFormItem v-if="itemTypeCode === 'quantity'" label="Buy X pay Y">
            <NSpace align="center">
              <span style="font-size:12px;color:#9aa0ab">Buy</span>
              <NInputNumber v-model:value="itemForm.buy_quantity" :min="1" placeholder="X" style="width: 110px" />
              <span style="font-size:12px;color:#9aa0ab">pay</span>
              <NInputNumber v-model:value="itemForm.pay_quantity" :min="1" placeholder="Y" style="width: 110px" />
            </NSpace>
          </NFormItem>
          <NFormItem v-if="hasPages" label="Page / order on page">
            <NSpace>
              <NInputNumber v-model:value="itemForm.page_no" :min="1" placeholder="Page" style="width: 120px" />
              <NInputNumber v-model:value="itemForm.order_on_page" :min="1" placeholder="Order" style="width: 120px" />
            </NSpace>
          </NFormItem>
          <NFormItem v-if="editingItem" label="Set sale price">
            <NInputNumber
              v-model:value="itemForm.new_sale_price"
              :min="0"
              :precision="2"
              :format="formatNumberInput"
              :parse="parseNumberInput"
              clearable
              :placeholder="editingSetAutoPrice == null ? 'Auto = sum of products' : `Auto = ${editingSetAutoPrice}`"
              style="width: 100%"
            />
            <template #feedback>
              <span style="font-size:12px;color:#9aa0ab">Leave empty = auto (sum of product prices). Enter a value to override (e.g. set/bundle price).</span>
            </template>
          </NFormItem>
          <NSpace justify="end">
            <NButton @click="showItemModal = false">Cancel</NButton>
            <NButton type="primary" attr-type="submit">Save</NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NModal>
  </div>
</template>

<style scoped>
/* =========================================================
   Cockpit redesign — IBM Plex, margin-driven colour system
   ========================================================= */
.cockpit {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}
.mono {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
.ck-card {
  background: #fff;
  border: 1px solid #e7e9ee;
  border-radius: 14px;
  margin-bottom: 18px;
}

/* ---- header ---- */
.ck-header {
  display: flex;
  justify-content: space-between;
  gap: 30px;
  flex-wrap: wrap;
  padding: 22px 24px;
}
.ck-head-main {
  min-width: 0;
  flex: 1 1 auto;
}
.ck-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.ck-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 4px;
}
.ck-h1 {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.ck-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 15px;
}
.ck-stage {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  background: #f5f6f8;
  border: 1px solid #e7e9ee;
  padding: 7px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}
.ck-stage:hover {
  border-color: #cfd3da;
}
.ck-stage-ico {
  font-size: 15px;
  color: #5b50d6;
}
.ck-meta-chip {
  font-size: 13px;
  color: #6b7280;
  background: #fff;
  border: 1px solid #e7e9ee;
  padding: 7px 12px;
  border-radius: 8px;
}
.ck-meta-chip b {
  color: #1a1d23;
}
.ck-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e7e9ee;
  background: #fff;
  border-radius: 8px;
  color: #9aa0ab;
  cursor: pointer;
}
.ck-icon-btn:hover {
  color: #3f37a8;
  border-color: #cfcbf0;
}
.ck-cal {
  flex: 0 0 auto;
}

/* ---- KPI hero ---- */
.ck-kpi {
  overflow: hidden;
}
.ck-kpi-counts {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 14px 24px;
  border-bottom: 1px solid #f0f1f4;
  flex-wrap: wrap;
}
.ck-count {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ck-count-l {
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
}
.ck-count-v {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}
.ck-vsep {
  width: 1px;
  align-self: stretch;
  background: #eef0f3;
}
.ck-spacer {
  flex: 1;
}
.ck-totals-lbl {
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b8bdc7;
  font-weight: 600;
}
.ck-kpi-row {
  display: flex;
  align-items: stretch;
  flex-wrap: wrap;
}
.ck-kpi-cell {
  flex: 1 1 0;
  min-width: 205px;
  padding: 18px 18px;
  border-right: 1px solid #f0f1f4;
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.ck-kpi-l {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
}
.ck-kpi-v {
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.ck-kpi-v.pos {
  color: #15935b;
}
.ck-kpi-v.neg {
  color: #d83a45;
}
.ck-kpi-hero {
  flex: 1.3 1 0;
  min-width: 230px;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: center;
}
.ck-kpi-hero.band-good {
  background: #eef6f1;
}
.ck-kpi-hero.band-mid {
  background: #faf3e6;
}
.ck-kpi-hero.band-low {
  background: #fceeef;
}
.ck-hero-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.ck-hero-v {
  font-size: 36px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.02em;
}
.band-good .ck-hero-v {
  color: #15935b;
}
.band-mid .ck-hero-v {
  color: #c98410;
}
.band-low .ck-hero-v {
  color: #d83a45;
}
.ck-gauge {
  height: 8px;
  border-radius: 5px;
  position: relative;
  overflow: hidden;
}
.band-good .ck-gauge {
  background: #d6e9df;
}
.band-mid .ck-gauge {
  background: #efe2c8;
}
.band-low .ck-gauge {
  background: #f3d4d7;
}
.ck-gauge-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 5px;
}
.band-good .ck-gauge-fill {
  background: #15935b;
}
.band-mid .ck-gauge-fill {
  background: #c98410;
}
.band-low .ck-gauge-fill {
  background: #d83a45;
}
.ck-gauge-target {
  position: absolute;
  left: 66.7%;
  top: -2px;
  bottom: -2px;
  width: 2px;
  background: rgba(0, 0, 0, 0.28);
}
.ck-gauge-scale {
  display: flex;
  justify-content: space-between;
  font-size: 10.5px;
  color: #9aa0ab;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
}

/* ---- category pills ---- */
.ck-cats {
  margin-bottom: 18px;
}
.ck-pills {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.ck-pills-lbl {
  align-self: center;
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
  margin-right: 2px;
}
.ck-pill {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 158px;
  text-align: left;
  background: #fff;
  border: 1px solid #e7e9ee;
  border-radius: 12px;
  padding: 13px 16px 14px;
  cursor: pointer;
  font-family: inherit;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ck-pill:hover {
  border-color: #cfd3da;
}
.ck-pill.active {
  border-color: #5b50d6;
  box-shadow: inset 0 0 0 1px #5b50d6;
}
.ck-pill-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.ck-pill.band-good .ck-pill-bar {
  background: #15935b;
}
.ck-pill.band-mid .ck-pill-bar {
  background: #c98410;
}
.ck-pill.band-low .ck-pill-bar {
  background: #d83a45;
}
.ck-pill-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.ck-pill-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.ck-pill-pct {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
}
.ck-pill.band-good .ck-pill-pct {
  color: #0f7a4a;
  background: #e3f4ec;
}
.ck-pill.band-mid .ck-pill-pct {
  color: #9a6608;
  background: #f7eedb;
}
.ck-pill.band-low .ck-pill-pct {
  color: #b32630;
  background: #fbe7e8;
}
.ck-pill-sub {
  font-size: 11.5px;
  color: #9aa0ab;
}
.ck-pill-add {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #5b50d6;
  border: none;
  border-radius: 9px;
  padding: 9px 16px;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s, box-shadow 0.12s;
}
.ck-pill-add:hover {
  background: #4a40c2;
  box-shadow: 0 2px 8px rgba(91, 80, 214, 0.3);
}

/* ---- category panel ---- */
.ck-cat-panel {
  padding: 22px 24px;
}
.ck-cat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ck-cat-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ck-cat-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.ck-muted {
  font-size: 12.5px;
  color: #9aa0ab;
}

/* ---- slim category summary ---- */
.ck-summary {
  display: flex;
  align-items: center;
  background: #f6f7f9;
  border: 1px solid #eef0f3;
  border-radius: 10px;
  padding: 13px 6px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.ck-sum {
  padding: 0 18px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ck-sum-end {
  align-items: flex-end;
}
.ck-sum-l {
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
}
.ck-sum-v {
  font-size: 14px;
  font-weight: 700;
}
.ck-sum-v.pos {
  color: #15935b;
}
.ck-sum-v.neg {
  color: #d83a45;
}
.ck-sum-pct {
  font-size: 18px;
  font-weight: 700;
}

/* ---- promotions ---- */
.ck-promo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.ck-section-lbl {
  font-size: 11px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
}
.ck-promo-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ck-promo {
  border: 1px solid #eef0f3;
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ck-promo:hover {
  border-color: #e0e2e8;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}
.ck-promo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.ck-promo-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.ck-promo-name {
  font-weight: 700;
  font-size: 15px;
}
.ck-promo-type {
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.ck-promo-right {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.ck-promo-metrics {
  display: flex;
  align-items: center;
  gap: 18px;
}
.ck-pm {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
.ck-pm-l {
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
}
.ck-pm-v {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.ck-pm-v.pos {
  color: #15935b;
}
.ck-pm-v.neg {
  color: #d83a45;
}
.ck-skeleton {
  flex: 0 0 auto;
  transform: scale(0.62);
  transform-origin: right center;
}

/* margin band text colours */
.txt-good {
  color: #15935b;
}
.txt-mid {
  color: #c98410;
}
.txt-low {
  color: #d83a45;
}

/* ---- product table restyle ---- */
.ck-promo :deep(.n-data-table) {
  font-variant-numeric: tabular-nums;
}
.ck-promo :deep(.n-data-table-th) {
  background: #f6f7f9;
}
.ck-promo :deep(.n-data-table-th__title) {
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9aa0ab;
  font-weight: 600;
  white-space: nowrap;
}
.ck-promo :deep(.n-data-table-td) {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ck-promo :deep(.tcell-name),
.ck-promo :deep(.tcell-sub) {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
}

/* shared value colouring (used inside NDataTable render fns) */
:deep(.pos) {
  color: #15935b;
}
:deep(.neg) {
  color: #d83a45;
}

/* table cell helpers (kept) */
.cell-comment {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.tcell-product {
  min-width: 0;
}
.tcell-click {
  cursor: pointer;
}
.tcell-click:hover .tcell-name {
  color: #5b50d6;
  text-decoration: underline;
}
.tcell-name {
  font-weight: 600;
  color: #1a1d23;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tcell-sub {
  font-size: 11px;
  color: #9aa0ab;
}
.chip-comment {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

/* states */
.empty-cat-card {
  margin-bottom: 18px;
  text-align: center;
  color: #9aa0ab;
  padding: 40px;
  border: 1px dashed #d7dae1;
  border-radius: 12px;
  background: #fff;
}
.promo-empty {
  color: #9aa0ab;
  padding: 8px 0;
}
.promo-products-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 1px dashed #e2e5ea;
  border-radius: 10px;
  background: #fafbfc;
  color: #9aa0ab;
  font-size: 13px;
}
.mix-hint {
  font-size: 12px;
  color: #9aa0ab;
  margin: -6px 0 14px;
}

/* ---- category band-health summary chips ---- */
.ck-band-summary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: 4px;
}
.ck-band-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 20px;
  white-space: nowrap;
}
.ck-band-chip.is-good { color: #0f7a4a; background: #e3f4ec; }
.ck-band-chip.is-mid { color: #9a6608; background: #f7eedb; }
.ck-band-chip.is-low { color: #b32630; background: #fbe7e8; }
.ck-band-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ---- focus-visible (accessibility) ---- */
.ck-pill:focus-visible,
.ck-pill-add:focus-visible,
.ck-stage:focus-visible,
.ck-icon-btn:focus-visible {
  outline: 2px solid #5b50d6;
  outline-offset: 2px;
}

/* ---- responsive ---- */
@media (max-width: 1080px) {
  .ck-kpi-cell { min-width: 50%; border-bottom: 1px solid #f0f1f4; }
  .ck-kpi-hero { min-width: 100%; }
  .ck-promo-head { align-items: flex-start; }
  .ck-promo-right { width: 100%; justify-content: space-between; }
}
@media (max-width: 720px) {
  .ck-header { flex-direction: column; }
  .ck-cal { align-self: flex-start; }
  .ck-summary { padding: 13px 0; }
  .ck-sum { padding: 6px 14px; }
}

/* ---- SET price banner ---- */
.ck-set-banner {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 14px 20px;
  background: rgba(216, 58, 69, 0.16);
  border: 1px solid rgba(216, 58, 69, 0.32);
  border-radius: 12px;
}
.ck-set-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.ck-set-lbl {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9aa0ab;
}
.ck-set-manual {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 700;
  color: #d83a45;
  background: #fff;
  padding: 0 6px;
  border-radius: 6px;
}
.ck-set-sum {
  font-size: 17px;
  font-weight: 600;
  color: #6b7280;
}
.ck-set-sum.ck-strike {
  text-decoration: line-through;
  color: #b8bdc7;
}
.ck-set-arrow {
  font-size: 18px;
  color: #b8bdc7;
}
.ck-set-cell-main .ck-set-val {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #c0202c;
}
.ck-set-save {
  margin-left: auto;
  font-size: 13px;
  font-weight: 700;
  color: #15935b;
  background: #e3f4ec;
  padding: 5px 11px;
  border-radius: 8px;
}

/* ---- product list (2 lines per row) ---- */
.ck-prod-list { display: flex; flex-direction: column; }
.ck-prod { padding: 14px 16px; border-bottom: 1px solid #f4f5f7; }
.ck-prod:last-child { border-bottom: none; }
.ck-prod:hover { background: #fafbfc; }
.ck-prod-l1 { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ck-prod-id { min-width: 0; display: flex; flex-direction: column; gap: 1px; cursor: pointer; }
.ck-prod-id:hover .ck-prod-name { color: #5b50d6; text-decoration: underline; }
.ck-prod-name { font-weight: 600; color: #1a1d23; font-size: 14px; }
.ck-prod-sub { font-size: 11.5px; color: #9aa0ab; }
.ck-prod-right { display: flex; align-items: center; gap: 16px; flex: 0 0 auto; }
.ck-prod-price { display: flex; align-items: center; gap: 9px; }
.ck-old { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 13px; color: #aab0ba; text-decoration: line-through; }
.ck-arrow { color: #cfd3da; font-size: 13px; }
.ck-new { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 16px; font-weight: 700; color: #1a1d23; }
.ck-disc { font-size: 11px; font-weight: 600; color: #3f37a8; background: #f0eefc; padding: 2px 7px; border-radius: 5px; }
.ck-prod-l2 { display: flex; align-items: center; gap: 34px; margin-top: 11px; padding-top: 11px; border-top: 1px dashed #eef0f3; flex-wrap: wrap; row-gap: 8px; }
.ck-stat { display: flex; flex-direction: column; gap: 2px; }
.ck-stat-end { align-items: flex-end; }
.ck-stat-l { font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; color: #9aa0ab; font-weight: 600; }
.ck-stat-v { font-size: 13.5px; font-weight: 600; color: #374151; }
.ck-stat-v.pos { color: #15935b; }
.ck-stat-v.neg { color: #d83a45; }

/* =========================================================
   Modal styles (kept from original)
   ========================================================= */
.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.meta-val {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}
.ap-prices {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 24px;
  margin-top: 14px;
  padding: 16px 18px;
  background: #f7f7fb;
  border-radius: 8px;
}
.ap-prices .stat-lbl {
  font-size: 12px;
}
.ap-prices .meta-val {
  font-size: 18px;
}
.ap-factor {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.cond-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cond-row {
  display: flex;
  align-items: center;
  gap: 16px;
  border: 1px solid #eef0f4;
  border-radius: 8px;
  padding: 10px 14px;
}
.cond-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cond-product {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}
.cond-supplier {
  font-size: 12px;
  color: #888;
}
.cond-vals {
  display: flex;
  gap: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}
.cond-vals .stat-lbl {
  display: block;
  font-weight: normal;
}
.cond-title {
  font-weight: 600;
  color: #333;
  margin: 18px 0 10px;
}
.cond-form {
  display: grid;
  grid-template-columns: 2fr 1fr 1.3fr 1.5fr;
  gap: 10px;
}
.stat-lbl {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
</style>
