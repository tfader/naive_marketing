<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, h } from 'vue'
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
  NDataTable,
  useMessage,
} from 'naive-ui'
import type { SelectOption, DataTableColumns } from 'naive-ui'
import api from '../api/client'
import PromotionSkeleton from '../components/PromotionSkeleton.vue'
import CampaignMiniCalendar from '../components/CampaignMiniCalendar.vue'
import { BagHandleOutline, CreateOutline, TrashOutline, CloseOutline, GitNetworkOutline, EyeOutline } from '@vicons/ionicons5'
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
})

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

// Carousel navigation: one category visible at a time, prev/next cycle through them.
const currentIndex = ref(0)
const categories = computed<CampaignCategory[]>(() => campaign.value?.categories ?? [])
const currentCategory = computed(() => categories.value[currentIndex.value] ?? null)
const prevCategory = computed(() => {
  const n = categories.value.length
  return n ? categories.value[(currentIndex.value - 1 + n) % n] : null
})
const nextCategory = computed(() => {
  const n = categories.value.length
  return n ? categories.value[(currentIndex.value + 1) % n] : null
})
function goPrev() {
  const n = categories.value.length
  if (n) currentIndex.value = (currentIndex.value - 1 + n) % n
}
function goNext() {
  const n = categories.value.length
  if (n) currentIndex.value = (currentIndex.value + 1) % n
}
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
  itemForm.value = { promotion_type_id: promotionTypes.value[0]?.id ?? null, name: '', status: 'draft', page_no: null, order_on_page: null }
  showItemModal.value = true
}
function openEditItem(item: CampaignItem) {
  editingItem.value = item
  activeCategoryId.value = item.campaign_category_id
  itemForm.value = {
    promotion_type_id: item.promotion_type_id,
    name: item.name ?? '',
    status: item.status,
    page_no: item.page_no,
    order_on_page: item.order_on_page,
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

// Inline (not scoped) so it applies inside NDataTable's own render context.
const CELL_COMMENT_STYLE = 'display:inline-flex;align-items:center;justify-content:flex-end;gap:5px'

function columnsFor(item: CampaignItem): DataTableColumns<PromotionProduct> {
  return [
    {
      title: 'Product',
      key: 'product',
      minWidth: 200,
      render: (row) =>
        h('div', { class: 'tcell-product tcell-click', title: 'Preview product', onClick: () => openPreview(item, row) }, [
          h('div', { class: 'tcell-name', title: row.name }, row.name),
          h('div', { class: 'tcell-sub' }, row.code + (row.supplier ? ` · ${row.supplier.name}` : '')),
        ]),
    },
    {
      title: 'Sale price',
      key: 'sale',
      width: 124,
      align: 'right',
      render: (row) =>
        h('span', { class: 'cell-comment', style: CELL_COMMENT_STYLE }, [
          h(FieldMeta, { refModel: 'CampaignItemProduct', refId: row.link_id, attribute: 'current_sale_price', label: 'Sale price' }),
          h(MoneyValue, { value: row.current_sale_price }),
        ]),
    },
    {
      title: 'Disc %',
      key: 'discount_percent',
      width: 104,
      align: 'right',
      render: (row) =>
        h('span', { class: 'cell-comment', style: CELL_COMMENT_STYLE }, [
          h(FieldMeta, { refModel: 'CampaignItemProduct', refId: row.link_id, attribute: 'discount_percent', label: 'Discount %' }),
          h('span', row.discount_percent == null ? '—' : `${row.discount_percent}%`),
        ]),
    },
    {
      title: 'New price',
      key: 'new_price',
      width: 124,
      align: 'right',
      render: (row) =>
        h('span', { class: 'cell-comment', style: CELL_COMMENT_STYLE }, [
          h(FieldMeta, { refModel: 'CampaignItemProduct', refId: row.link_id, attribute: 'new_price', label: 'New price' }),
          h(MoneyValue, { value: row.new_price }),
        ]),
    },
    { title: 'Est. volume', key: 'estimated_volume', width: 104, align: 'right', render: (row) => fmt(row.estimated_volume) },
    { title: 'Cost', key: 'product_cost', width: 124, align: 'right', render: (row) => h(MoneyValue, { value: row.product_cost }) },
    { title: 'Sales value', key: 'product_sales_value', width: 124, align: 'right', render: (row) => h(MoneyValue, { value: row.product_sales_value }) },
    { title: 'Margin', key: 'margin', width: 124, align: 'right', render: (row) => renderMargin(row) },
    {
      title: '',
      key: 'actions',
      width: 108,
      render: (row) =>
        h(NSpace, { size: 4, wrapItem: false, justify: 'end' }, () => [
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              circle: true,
              title: 'Preview product',
              onClick: () => openPreview(item, row),
            },
            { icon: () => h(NIcon, null, () => h(EyeOutline)) }
          ),
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              circle: true,
              title: `Edit (factor, ${row.conditions.length} conditions)`,
              onClick: () => openEditProduct(item, row),
            },
            { icon: () => h(NIcon, null, () => h(CreateOutline)) }
          ),
          h(
            NButton,
            {
              size: 'tiny',
              quaternary: true,
              circle: true,
              type: 'error',
              title: 'Remove product',
              onClick: () => removeProductFromItem(item, row.link_id),
            },
            { icon: () => h(NIcon, null, () => h(CloseOutline)) }
          ),
        ]),
    },
  ]
}

function renderMargin(row: PromotionProduct) {
  const v = toNum(row.product_sales_value)
  const c = toNum(row.product_cost)
  if (v == null || c == null) return '—'
  const m = v - c
  return h('span', { class: m > 0 ? 'pos' : m < 0 ? 'neg' : '' }, h(MoneyValue, { value: m }))
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
  if (!url || conditionForm.value.supplier_id == null) return
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
  <div>
    <NSpin :show="loading">
      <template v-if="campaign">
        <NCard style="margin-bottom: 16px">
          <div class="camp-layout">
            <div class="camp-left">
              <div class="camp-head">
                <span class="camp-dot" :style="`background:${headerColor}`"></span>
                <FieldMeta ref-model="Campaign" :ref-id="campaign.id" :attribute="null" label="Campaign" :size="16" />
                <span class="chip-comment"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="name" label="Campaign name" :size="16" /><NH2 style="margin: 0">{{ campaign.name }}</NH2></span>
                <NTag v-if="campaign.campaign_type" size="small">{{ campaign.campaign_type.name }}</NTag>
                <span class="chip-comment"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="status" label="Status" /><NTag :type="STATUS_TAG[campaign.status] ?? 'default'" size="small">{{ statusLabel(campaign.status) }}</NTag></span>
                <NButton size="small" tertiary @click="showProcessModal = true">
                  <template #icon><NIcon><GitNetworkOutline /></NIcon></template>
                  {{ campaign.current_stage ? `${campaign.current_stage.position}. ${campaign.current_stage.name}` : 'Process' }}
                </NButton>
                <NButton size="small" circle tertiary title="Edit campaign" @click="openCampaignEdit">
                  <template #icon><NIcon><CreateOutline /></NIcon></template>
                </NButton>
              </div>
              <div class="camp-meta">
                <div class="meta"><NTag size="large" round :bordered="false" type="info">Duration — {{ durationDays }} days</NTag></div>
                <div class="meta"><NTag size="large" round :bordered="false" type="info">Starts at — {{ startWeekday }}</NTag></div>
              </div>
            </div>
            <div class="camp-right">
              <CampaignMiniCalendar :start="campaign.start_date" :end="campaign.end_date" :color="headerColor" />
            </div>
          </div>

          <div v-if="campaign.metrics" class="promo-metrics cat-metrics camp-metrics">
            <div class="pm-group">
              <span class="pm"><span class="pm-l">Flow</span><span class="pm-v">{{ campaign.process_template?.name ?? '—' }}</span></span>
              <span class="pm"><span class="pm-l">Promotions</span><span class="pm-v">{{ campaign.items_count }} / {{ campaign.planned_items_total }}</span></span>
              <span class="pm"><span class="pm-l">Categories</span><span class="pm-v">{{ campaign.categories_count }}</span></span>
              <span v-if="hasPages" class="pm"><span class="pm-l">Pages</span><span class="pm-v"><FieldMeta ref-model="Campaign" :ref-id="campaign.id" attribute="pages_count" label="Pages" />{{ campaign.pages_count ?? '—' }}</span></span>
              <span class="pm-sep"></span>
              <span class="pm"><span class="pm-l">Est. volume</span><span class="pm-v">{{ fmt(campaign.metrics.volume) }}</span></span>
              <span class="pm"><span class="pm-l">Cost</span><span class="pm-v"><MoneyValue :value="campaign.metrics.cost" /></span></span>
              <span class="pm"><span class="pm-l">Sales value</span><span class="pm-v"><MoneyValue :value="campaign.metrics.sales_value" /></span></span>
              <span class="pm"><span class="pm-l">Margin</span><span class="pm-v" :class="{ pos: Number(campaign.metrics.margin) > 0, neg: Number(campaign.metrics.margin) < 0 }"><MoneyValue :value="campaign.metrics.margin" /></span></span>
              <span class="pm"><span class="pm-l">Margin %</span><span class="pm-v" :class="{ pos: Number(campaign.metrics.margin_pct) > 0, neg: Number(campaign.metrics.margin_pct) < 0 }">{{ campaign.metrics.margin_pct == null ? '—' : campaign.metrics.margin_pct + '%' }}</span></span>
              <NTag v-if="!campaign.metrics.fully_priced" size="small" type="warning">pricing incomplete</NTag>
            </div>
          </div>
        </NCard>

        <!-- Categories carousel: one big category card in the centre, arrow nav with neighbour names -->
        <div class="carousel-bar">
          <button class="nav-arrow" :class="{ 'nav-hidden': categories.length < 2 }" @click="goPrev">
            <span class="nav-chevron">‹</span>
            <span class="nav-name">{{ prevCategory?.name || '' }}</span>
          </button>
          <div class="carousel-center">
            <span v-if="currentCategory" class="carousel-counter">
              <span class="cc-name">{{ currentCategory.name }}</span>
              <NTag v-if="currentCategory.mixed" size="small" type="success" :bordered="false">MIX</NTag>
              <span class="cc-pos">({{ currentIndex + 1 }} / {{ categories.length }})</span>
            </span>
            <NButton type="primary" size="tiny" ghost @click="openAddCategory">+ Category</NButton>
          </div>
          <button class="nav-arrow nav-arrow-right" :class="{ 'nav-hidden': categories.length < 2 }" @click="goNext">
            <span class="nav-name">{{ nextCategory?.name || '' }}</span>
            <span class="nav-chevron">›</span>
          </button>
        </div>

        <div v-if="!categories.length" class="empty-cat-card">
          No categories yet. Add a category to start planning promotions.
        </div>

        <NCard v-else-if="currentCategory" class="cat-big-card">
          <template #header-extra>
            <NSpace size="small">
              <NButton size="small" tertiary @click="openEditCategory(currentCategory)">
                <template #icon><NIcon><CreateOutline /></NIcon></template>
                Edit
              </NButton>
              <NPopconfirm @positive-click="() => deleteCategory(currentCategory!)">
                <template #trigger>
                  <NButton size="small" type="error" tertiary>Remove category</NButton>
                </template>
                Remove category "{{ currentCategory.name }}" and its promotions?
              </NPopconfirm>
            </NSpace>
          </template>

          <div class="promo-metrics cat-metrics">
            <div class="pm-group">
              <span class="pm"><span class="pm-l">Promotions</span><span class="pm-v">{{ currentCategory.items.length }} / {{ currentCategory.planned_items_count }}</span></span>
              <span class="pm"><span class="pm-l">With products</span><span class="pm-v">{{ catWithProducts(currentCategory) }} / {{ currentCategory.items.length }}</span></span>
              <span class="pm"><span class="pm-l">Products</span><span class="pm-v">{{ catTotalProducts(currentCategory) }}</span></span>
              <span class="pm-sep"></span>
              <span class="pm"><span class="pm-l">Est. volume</span><span class="pm-v">{{ fmt(currentCategory.metrics.volume) }}</span></span>
              <span class="pm"><span class="pm-l">Cost</span><span class="pm-v"><MoneyValue :value="currentCategory.metrics.cost" /></span></span>
              <span class="pm"><span class="pm-l">Sales value</span><span class="pm-v"><MoneyValue :value="currentCategory.metrics.sales_value" /></span></span>
              <span class="pm"><span class="pm-l">Margin</span><span class="pm-v" :class="{ pos: Number(currentCategory.metrics.margin) > 0, neg: Number(currentCategory.metrics.margin) < 0 }"><MoneyValue :value="currentCategory.metrics.margin" /></span></span>
              <span class="pm"><span class="pm-l">Margin %</span><span class="pm-v" :class="{ pos: Number(currentCategory.metrics.margin_pct) > 0, neg: Number(currentCategory.metrics.margin_pct) < 0 }">{{ currentCategory.metrics.margin_pct == null ? '—' : currentCategory.metrics.margin_pct + '%' }}</span></span>
              <NTag v-if="currentCategory.items.length && !currentCategory.metrics.fully_priced" size="small" type="warning">pricing incomplete</NTag>
            </div>
          </div>

          <div class="cat-toolbar">
            <span></span>
            <NButton type="primary" size="tiny" ghost @click="openNewItem(currentCategory.id)">+ Promotion</NButton>
          </div>

          <div v-if="!currentCategory.items.length" class="promo-empty">
            No promotions yet — click "Add Promotion".
          </div>
          <div class="promo-grid">
            <div v-for="item in currentCategory.items" :key="item.id" class="promo-card">
              <div class="promo-head">
                <div class="promo-top-left">
                  <FieldMeta ref-model="CampaignItem" :ref-id="item.id" :attribute="null" label="Promotion" :size="15" />
                  <span v-if="item.name" class="chip-comment promo-type"><FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="name" label="Promotion name" />{{ item.name }}</span>
                  <span class="promo-type-name">{{ item.promotion_type.name }}</span>
                  <span class="chip-comment">
                    <FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="status" label="Status" />
                    <NTag size="small" :type="ITEM_STATUS_TAG[item.status] ?? 'default'">{{ statusLabel(item.status) }}</NTag>
                  </span>
                  <NTag size="small" :type="PRODUCTS_STATUS_TAG[item.products_status] ?? 'default'">
                    {{ item.products_count }} products{{ item.min_products ? ` / min ${item.min_products}` : '' }}
                  </NTag>
                  <span v-if="hasPages && item.page_no" class="chip-comment">
                    <FieldMeta ref-model="CampaignItem" :ref-id="item.id" attribute="page_no" label="Page" />
                    <NTag size="small" type="info">p.{{ item.page_no }} · #{{ item.order_on_page ?? '—' }}</NTag>
                  </span>
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

              <div class="promo-metrics">
                <div class="pm-group">
                  <span class="pm"><span class="pm-l">Est. volume</span><span class="pm-v">{{ fmt(item.metrics.volume) }}</span></span>
                  <span class="pm"><span class="pm-l">Cost</span><span class="pm-v"><MoneyValue :value="item.metrics.cost" /></span></span>
                  <span class="pm"><span class="pm-l">Sales value</span><span class="pm-v"><MoneyValue :value="item.metrics.sales_value" /></span></span>
                  <span class="pm"><span class="pm-l">Margin</span><span class="pm-v" :class="{ pos: Number(item.metrics.margin) > 0, neg: Number(item.metrics.margin) < 0 }"><MoneyValue :value="item.metrics.margin" /></span></span>
                  <span class="pm"><span class="pm-l">Margin %</span><span class="pm-v" :class="{ pos: Number(item.metrics.margin_pct) > 0, neg: Number(item.metrics.margin_pct) < 0 }">{{ item.metrics.margin_pct == null ? '—' : item.metrics.margin_pct + '%' }}</span></span>
                  <NTag v-if="item.products.length && !item.metrics.fully_priced" size="small" type="warning">pricing incomplete</NTag>
                </div>
                <div class="promo-skeleton-mini">
                  <PromotionSkeleton :layout="typeLayout(item.promotion_type_id)" />
                </div>
              </div>

              <NDataTable
                v-if="item.products.length"
                :columns="columnsFor(item)"
                :data="item.products"
                :row-key="(row) => row.link_id"
                size="small"
                :bordered="false"
              />
              <div v-else class="promo-products-empty">No products assigned yet</div>
            </div>
          </div>
        </NCard>

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
        style="width: 880px"
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
            <NButton type="primary" attr-type="submit" :disabled="conditionForm.supplier_id == null">Add condition</NButton>
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
          <NFormItem v-if="hasPages" label="Page / order on page">
            <NSpace>
              <NInputNumber v-model:value="itemForm.page_no" :min="1" placeholder="Page" style="width: 120px" />
              <NInputNumber v-model:value="itemForm.order_on_page" :min="1" placeholder="Order" style="width: 120px" />
            </NSpace>
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
/* Header */
.camp-layout {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}
.camp-left {
  min-width: 0;
  flex: 1 1 auto;
}
.camp-right {
  flex: 0 0 auto;
}
.camp-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.camp-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}
.camp-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 28px;
  margin-top: 14px;
}
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

/* Add-product dialog */
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

/* Supplier conditions dialog */
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

/* Carousel */
.carousel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.carousel-center {
  display: flex;
  align-items: center;
  gap: 14px;
}
.carousel-counter {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}
.cc-name {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}
.cc-pos {
  font-size: 12px;
  color: #999;
}
.nav-arrow {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #efeff5;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  color: #555;
  font-size: 14px;
  max-width: 240px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.nav-arrow:hover:not(:disabled) {
  border-color: #c9c9d6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}
.nav-arrow.nav-hidden {
  visibility: hidden;
}
.nav-arrow-right {
  flex-direction: row;
}
.nav-chevron {
  font-size: 20px;
  line-height: 1;
  color: #888;
}
.nav-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Big centred category card */
.cat-big-card {
  margin-bottom: 16px;
}
.empty-cat-card {
  margin-bottom: 16px;
  text-align: center;
  color: #aaa;
  padding: 40px;
  border: 1px dashed #e0e0ea;
  border-radius: 10px;
}
.cat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0;
}
.cat-card-stats {
  display: flex;
  gap: 36px;
}
.stat {
  display: flex;
  flex-direction: column;
}
.stat-val {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}
.stat-lbl {
  font-size: 11px;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.promo-empty {
  color: #aaa;
  padding: 8px 0;
}
.mix-hint {
  font-size: 12px;
  color: #999;
  margin: -6px 0 14px;
}
.promo-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.promo-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #efeff5;
  border-radius: 10px;
  padding: 16px 18px;
  background: #fff;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.promo-card:hover {
  border-color: #e0e0ea;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}
.promo-products-empty {
  color: #bbb;
  font-size: 13px;
  font-style: italic;
}
.promo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.promo-top-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.chip-comment {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.promo-type {
  font-weight: 600;
  font-size: 15px;
}
.promo-type-name {
  font-weight: 600;
  font-size: 14px;
  color: #555;
}
.promo-metrics {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 14px;
}
.cat-metrics {
  justify-content: flex-start;
  gap: 24px;
  background: #eef1f6;
  margin-bottom: 14px;
  padding: 12px 16px;
}
.camp-metrics {
  margin-top: 18px;
  margin-bottom: 0;
}
.pm-sep {
  width: 1px;
  align-self: stretch;
  background: #d6dbe4;
  margin: 2px 0;
}
.pm-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  flex: 1;
  justify-content: space-between;
}
.pm {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.pm-l {
  font-size: 9px;
  color: #9aa1ad;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pm-v {
  font-size: 15px;
  font-weight: 700;
  color: #2b2b33;
  font-variant-numeric: tabular-nums;
}
.pm-v.pos {
  color: #18a058;
}
.pm-v.neg {
  color: #f0a020;
}
.promo-skeleton-mini {
  flex: 0 0 auto;
  transform: scale(0.62);
  transform-origin: right center;
}
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
  color: #16a34a;
  text-decoration: underline;
}
.tcell-name {
  font-weight: 600;
  color: #2b2b33;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tcell-sub {
  font-size: 11px;
  color: #9aa0ab;
}
:deep(.pos) {
  color: #18a058;
}
:deep(.neg) {
  color: #f0a020;
}
.promo-card :deep(.n-data-table-td),
.promo-card :deep(.n-data-table-th__title) {
  white-space: nowrap;
}
</style>
