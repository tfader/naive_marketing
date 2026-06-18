<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import api from '../api/client'
import type { Campaign, PromotionProduct } from '../types/campaign'
import LeafletPromoCell from '../components/LeafletPromoCell.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const campaignId = route.params.id as string

const campaign = ref<Campaign | null>(null)
const loading = ref(false)

interface LeafletPromo {
  id: number
  categoryName: string
  typeName: string
  pageNo: number | null
  order: number
  products: PromotionProduct[]
  item: any
}

const promos = computed<LeafletPromo[]>(() => {
  const out: LeafletPromo[] = []
  for (const cc of campaign.value?.categories ?? []) {
    for (const it of cc.items) {
      out.push({
        id: it.id,
        categoryName: cc.name,
        typeName: it.promotion_type.name,
        pageNo: it.page_no,
        order: it.order_on_page ?? 9999,
        products: it.products,
        item: it,
      })
    }
  }
  return out
})

const pageCount = computed(() => {
  const fromItems = promos.value.reduce((m, p) => Math.max(m, p.pageNo ?? 0), 0)
  return Math.max(campaign.value?.pages_count ?? 0, fromItems)
})

const pages = computed(() => {
  const arr: { no: number; promos: LeafletPromo[] }[] = []
  for (let n = 1; n <= pageCount.value; n++) {
    arr.push({
      no: n,
      promos: promos.value.filter((p) => p.pageNo === n).sort((a, b) => a.order - b.order),
    })
  }
  return arr
})

const unplaced = computed(() => promos.value.filter((p) => p.pageNo == null))
const headerColor = computed(() => campaign.value?.campaign_type?.color || '#5b50d6')

const viewMode = ref<'all' | 'single'>('all')
const currentPage = ref(1)
const visiblePages = computed(() =>
  viewMode.value === 'single'
    ? pages.value.filter((p) => p.no === currentPage.value)
    : pages.value
)
function goPage(n: number) {
  currentPage.value = Math.max(1, Math.min(pageCount.value, n))
}
function colsFor(n: number): number {
  if (n <= 1) return 1
  if (n === 2) return 2
  return 3
}

function printLeaflet() {
  window.print()
}
function backToCampaign() {
  router.push({ name: 'CampaignDetail', params: { id: campaignId } })
}

onMounted(load)
async function load() {
  loading.value = true
  try {
    const { data } = await api.get(`/campaigns/${campaignId}`)
    campaign.value = data
  } catch {
    message.error('Failed to load campaign')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="leaflet">
    <!-- chrome (hidden on print) -->
    <div class="lf-chrome">
      <div class="lf-bar">
        <div class="lf-bar-left">
          <button class="lf-back" @click="backToCampaign">← Campaign</button>
          <div class="lf-titles">
            <span class="lf-name">{{ campaign?.name || 'Campaign' }}</span>
            <span class="lf-sub">Leaflet preview · {{ pageCount }} {{ pageCount === 1 ? 'page' : 'pages' }}</span>
          </div>
        </div>
        <div class="lf-views">
          <div class="lf-seg">
            <button class="lf-seg-btn" :class="{ active: viewMode === 'all' }" @click="viewMode = 'all'">All pages</button>
            <button class="lf-seg-btn" :class="{ active: viewMode === 'single' }" @click="viewMode = 'single'">Single</button>
          </div>
          <div v-if="viewMode === 'single'" class="lf-pager">
            <button class="lf-nav" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">‹</button>
            <span class="lf-pager-lbl mono">{{ currentPage }} / {{ pageCount }}</span>
            <button class="lf-nav" :disabled="currentPage >= pageCount" @click="goPage(currentPage + 1)">›</button>
          </div>
          <button class="lf-print" @click="printLeaflet">Print / PDF</button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="lf-empty">Loading…</div>
    <div v-else-if="!pageCount && !unplaced.length" class="lf-empty">This campaign has no promotions to lay out yet.</div>

    <!-- pages -->
    <div v-else class="lf-pages">
      <section v-for="pg in visiblePages" :key="pg.no" class="lf-sheet">
        <div class="lf-sheet-head" :style="{ background: headerColor }">
          <span class="lf-sheet-name">{{ campaign?.name }}</span>
          <span class="lf-sheet-page">Page {{ pg.no }} / {{ pageCount }}</span>
        </div>

        <div v-if="pg.promos.length" class="lf-grid" :style="{ gridTemplateColumns: 'repeat(' + colsFor(pg.promos.length) + ', 1fr)' }">
          <LeafletPromoCell
            v-for="promo in pg.promos"
            :key="promo.id"
            :item="promo.item"
            :category="promo.categoryName"
            :hero="pg.promos.length === 1"
          />
        </div>
        <div v-else class="lf-page-empty">Empty page — no promotions placed here.</div>
      </section>

      <!-- promotions not yet placed on a page -->
      <section v-if="viewMode === 'all' && unplaced.length" class="lf-unplaced">
        <div class="lf-unplaced-head">Not placed on a page <span class="lf-unplaced-n">{{ unplaced.length }}</span></div>
        <div class="lf-grid">
          <LeafletPromoCell
            v-for="promo in unplaced"
            :key="promo.id"
            :item="promo.item"
            :category="promo.categoryName"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.leaflet {
  margin: -24px;
  padding: 24px;
  background: #eceef2;
  min-height: calc(100vh - 48px);
  box-sizing: border-box;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  color: #1a1d23;
}

/* chrome */
.lf-chrome { max-width: 880px; margin: 0 auto 18px; }
.lf-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px; padding: 12px 16px;
}
.lf-bar-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.lf-back {
  border: 1px solid #e7e9ee; background: #fff; cursor: pointer;
  font-family: inherit; font-size: 13px; font-weight: 600; color: #374151;
  padding: 8px 13px; border-radius: 8px;
}
.lf-back:hover { border-color: #cfd3da; }
.lf-titles { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.lf-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.lf-sub { font-size: 12px; color: #9aa0ab; }
.lf-print {
  background: #5b50d6; border: none; cursor: pointer; color: #fff;
  font-family: inherit; font-size: 13px; font-weight: 600; padding: 9px 15px; border-radius: 9px;
}
.lf-print:hover { background: #4a40c2; }

.lf-views { display: flex; align-items: center; gap: 12px; }
.lf-seg { display: inline-flex; background: #f0f1f4; border-radius: 9px; padding: 3px; gap: 2px; }
.lf-seg-btn { border: none; background: transparent; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; color: #6b7280; padding: 6px 13px; border-radius: 7px; }
.lf-seg-btn:hover { color: #1a1d23; }
.lf-seg-btn.active { background: #fff; color: #3f37a8; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
.lf-pager { display: inline-flex; align-items: center; gap: 4px; }
.lf-nav { width: 30px; height: 30px; border: 1px solid #e7e9ee; background: #fff; border-radius: 8px; cursor: pointer; color: #374151; font-size: 15px; line-height: 1; }
.lf-nav:hover:not(:disabled) { border-color: #cfd3da; }
.lf-nav:disabled { opacity: 0.4; cursor: default; }
.lf-pager-lbl { font-size: 13px; font-weight: 600; color: #374151; min-width: 52px; text-align: center; }
.mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }

.lf-empty {
  max-width: 880px; margin: 0 auto;
  background: #fff; border: 1px dashed #d7dae1; border-radius: 12px;
  padding: 48px; text-align: center; color: #9aa0ab;
}

/* pages */
.lf-pages { display: flex; flex-direction: column; align-items: center; gap: 24px; }
.lf-sheet {
  width: 100%; max-width: 880px;
  background: #fff; border: 1px solid #e2e5ea; border-radius: 4px;
  box-shadow: 0 8px 30px rgba(26, 29, 35, 0.08);
  overflow: hidden;
}
.lf-sheet-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; color: #fff;
}
.lf-sheet-name { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase; opacity: 0.95; }
.lf-sheet-page { font-size: 12px; font-weight: 600; font-family: 'IBM Plex Mono', ui-monospace, monospace; opacity: 0.9; }

.lf-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
  padding: 20px;
}
.lf-cell {
  display: flex; flex-direction: column; gap: 10px;
  border: 1px solid #eef0f3; border-radius: 10px; padding: 12px;
  background: #fff;
}
.lf-cell.is-unplaced { border-style: dashed; }
.lf-cell-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lf-cat { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3f37a8; background: #f0eefc; padding: 2px 8px; border-radius: 5px; }
.lf-type { font-size: 11px; color: #9aa0ab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lf-prods { display: flex; flex-direction: column; gap: 12px; }
.lf-prod { display: flex; flex-direction: column; gap: 8px; }
.lf-img {
  height: 92px; border-radius: 8px;
  background-color: #f6f7f9;
  background-image: repeating-linear-gradient(45deg, #eceef2 0, #eceef2 8px, #f6f7f9 8px, #f6f7f9 16px);
  border: 1px solid #eef0f3;
  display: flex; align-items: center; justify-content: center;
}
.lf-img span { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; color: #b8bdc7; }
.lf-prod-name { font-size: 13.5px; font-weight: 700; line-height: 1.25; }
.lf-prod-sub { font-size: 11px; color: #9aa0ab; margin-top: 1px; }
.lf-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.lf-old {
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px;
  color: #aab0ba; text-decoration: line-through;
}
.lf-new {
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 22px; font-weight: 700;
  color: #d83a45; letter-spacing: -0.02em; line-height: 1;
}
.lf-cur { font-size: 0.5em; font-weight: 600; margin-left: 3px; }
.lf-disc {
  font-size: 11px; font-weight: 700; color: #fff; background: #d83a45;
  padding: 2px 7px; border-radius: 5px;
}
.lf-prod-empty, .lf-page-empty {
  font-size: 12px; color: #b8bdc7; font-style: italic;
}
.lf-page-empty { padding: 24px; text-align: center; }

/* unplaced */
.lf-unplaced {
  width: 100%; max-width: 880px;
  background: #fff; border: 1px solid #e7e9ee; border-radius: 12px; overflow: hidden;
}
.lf-unplaced-head {
  padding: 13px 20px; border-bottom: 1px solid #f0f1f4;
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9aa0ab;
}
.lf-unplaced-n { color: #c2c7d0; margin-left: 4px; font-family: 'IBM Plex Mono', ui-monospace, monospace; }

@media (max-width: 760px) {
  .lf-grid { grid-template-columns: repeat(2, 1fr) !important; }
}

/* hero: a single promotion fills the page */
.lf-cell.hero { gap: 0; padding: 0; border: none; }
.lf-cell.hero .lf-cell-top { padding: 18px 22px 0; }
.lf-cell.hero .lf-prods { padding: 0 22px 22px; }
.lf-cell.hero .lf-prod { flex-direction: row; gap: 26px; align-items: center; }
.lf-cell.hero .lf-img { flex: 0 0 46%; height: 340px; border-radius: 12px; }
.lf-cell.hero .lf-img span { font-size: 12px; }
.lf-cell.hero .lf-prod-body { flex: 1 1 auto; min-width: 0; }
.lf-cell.hero .lf-prod-name { font-size: 30px; letter-spacing: -0.02em; line-height: 1.1; }
.lf-cell.hero .lf-prod-sub { font-size: 14px; margin-top: 6px; }
.lf-cell.hero .lf-price { gap: 14px; margin-top: 18px; align-items: baseline; }
.lf-cell.hero .lf-old { font-size: 20px; }
.lf-cell.hero .lf-new { font-size: 54px; }
.lf-cell.hero .lf-disc { font-size: 16px; padding: 4px 12px; border-radius: 8px; }
@media (max-width: 640px) {
  .lf-cell.hero .lf-prod { flex-direction: column; align-items: stretch; }
  .lf-cell.hero .lf-img { flex: none; height: 220px; }
}

/* print: just the sheets */
@media print {
  .leaflet { margin: 0; padding: 0; background: #fff; }
  .lf-chrome { display: none; }
  .lf-pages { gap: 0; }
  .lf-sheet { box-shadow: none; border: none; max-width: none; page-break-after: always; }
  .lf-unplaced { display: none; }
}
</style>
