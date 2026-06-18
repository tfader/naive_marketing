<script setup lang="ts">
import { computed } from 'vue'
import { formatNumber } from '../composables/parameters'

// Loosely typed: `item` is a CampaignItem (+ computed new_sale_price added by backend).
const props = defineProps<{ item: any; category: string; hero?: boolean }>()

function fmt(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return formatNumber(v)
}

const products = computed<any[]>(() => props.item?.products ?? [])
const lead = computed<any>(() => products.value[0] ?? null)
const typeName = computed<string>(() => props.item?.promotion_type?.name ?? 'Promotion')

// Headline price for the whole promotion/set (backend-computed), with fallbacks.
const setPrice = computed(() => props.item?.new_sale_price ?? lead.value?.new_price ?? lead.value?.current_sale_price ?? null)
const oldPrice = computed(() => lead.value?.current_sale_price ?? null)
const discount = computed<number | null>(() => {
  const d = lead.value?.discount_percent
  return d == null ? null : Number(d)
})
const minQty = computed<number | null>(() => props.item?.min_products ?? null)

const kind = computed(() => {
  const s = String(props.item?.promotion_type?.code || props.item?.promotion_type?.name || '').toLowerCase()
  if (/set|bundle/.test(s)) return 'set'
  if (/gift|prezent|gratis/.test(s)) return 'gift'
  if (/loyal|app/.test(s)) return 'loyalty'
  if (/second|drugi/.test(s)) return 'second'
  if (/threshold|spend|prog/.test(s)) return 'threshold'
  if (/pay|quantity|ilo/.test(s)) return 'quantity'
  if (/unit|each|szt/.test(s)) return 'unit'
  if (/percent|%|rabat|discount/.test(s)) return 'percent'
  return 'simple'
})

const setProducts = computed(() => products.value.slice(0, 3))
const setTotal = computed<number | null>(() => {
  const s = products.value.reduce((sum, p) => {
    const v = Number(p?.current_sale_price)
    return Number.isFinite(v) ? sum + v : sum
  }, 0)
  return s > 0 ? s : null
})
</script>

<template>
  <article class="lp" :class="[`k-${kind}`, { hero }]">
    <div class="lp-top">
      <span class="lp-cat">{{ category }}</span>
      <span class="lp-type">{{ typeName }}</span>
    </div>

    <!-- SET / bundle: products joined with + then = bundle price -->
    <template v-if="kind === 'set'">
      <div class="lp-setrow">
        <template v-for="(p, i) in setProducts" :key="p.link_id">
          <div class="lp-setitem">
            <div class="lp-img sm"><span>PRODUCT</span></div>
            <div class="lp-setname">{{ p.name }}</div>
          </div>
          <span v-if="i < setProducts.length - 1" class="lp-op">+</span>
        </template>
        <span class="lp-op">=</span>
        <div class="lp-setprice">
          <span v-if="setTotal != null" class="lp-totlbl">regular total</span>
          <span v-if="setTotal != null" class="lp-old">{{ fmt(setTotal) }}</span>
          <span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span>
          <span class="lp-mech">bundle price</span>
        </div>
      </div>
    </template>

    <!-- SECOND item discount: two items, combined price -->
    <template v-else-if="kind === 'second'">
      <div class="lp-pairrow">
        <div class="lp-img"><span>PRODUCT</span></div>
        <span class="lp-op">+</span>
        <div class="lp-img"><span>2ND ITEM</span></div>
      </div>
      <div class="lp-body">
        <div class="lp-name">{{ lead?.name }}</div>
        <span class="lp-ribbon">2nd item <b v-if="discount != null">−{{ discount }}%</b></span>
        <div class="lp-price"><span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span><span class="lp-mech">for both</span></div>
      </div>
    </template>

    <!-- GIFT with purchase -->
    <template v-else-if="kind === 'gift'">
      <div class="lp-pairrow">
        <div class="lp-img"><span>PRODUCT</span></div>
        <span class="lp-op">+</span>
        <div class="lp-gift"><span class="lp-gift-tag">GRATIS</span><span>GIFT</span></div>
      </div>
      <div class="lp-body">
        <div class="lp-name">{{ lead?.name }}</div>
        <span class="lp-ribbon is-gift">+ free gift</span>
        <div class="lp-price"><span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span></div>
      </div>
    </template>

    <!-- PERCENT discount: big −X% hero -->
    <template v-else-if="kind === 'percent'">
      <div class="lp-prod">
        <div class="lp-img"><span>PRODUCT</span></div>
        <div class="lp-body">
          <div class="lp-name">{{ lead?.name }}</div>
          <div class="lp-sub">{{ lead?.code }}</div>
          <div class="lp-percent" v-if="discount != null">−{{ discount }}<span class="lp-pct">%</span></div>
          <div class="lp-price">
            <span v-if="oldPrice != null" class="lp-old">{{ fmt(oldPrice) }}</span>
            <span class="lp-new sm">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span>
          </div>
        </div>
      </div>
    </template>

    <!-- QUANTITY (buy X pay Y) / UNIT (buy X each) -->
    <template v-else-if="kind === 'quantity' || kind === 'unit'">
      <div class="lp-prod">
        <div class="lp-img">
          <span>PRODUCT</span>
          <span class="lp-qty-badge">{{ minQty ?? 'X' }}<small>{{ kind === 'quantity' ? ' szt.' : '+ szt.' }}</small></span>
        </div>
        <div class="lp-body">
          <div class="lp-name">{{ lead?.name }}</div>
          <div class="lp-sub">{{ lead?.code }}</div>
          <span class="lp-ribbon">{{ kind === 'quantity' ? 'Multibuy set' : 'Per unit from ' + (minQty ?? 'X') + ' pcs' }}</span>
          <div class="lp-price">
            <span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span>
            <span class="lp-mech">{{ kind === 'quantity' ? 'per set' : '/ unit' }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- LOYALTY / app price -->
    <template v-else-if="kind === 'loyalty'">
      <div class="lp-prod">
        <div class="lp-img"><span>PRODUCT</span></div>
        <div class="lp-body">
          <span class="lp-app">APP PRICE</span>
          <div class="lp-name">{{ lead?.name }}</div>
          <div class="lp-sub">{{ lead?.code }}</div>
          <div class="lp-price"><span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span><span class="lp-mech">with app</span></div>
        </div>
      </div>
    </template>

    <!-- SPEND THRESHOLD reward -->
    <template v-else-if="kind === 'threshold'">
      <div class="lp-threshold">
        <span class="lp-th-badge">SPEND &amp; SAVE</span>
        <div class="lp-img wide"><span>REWARD</span></div>
        <div class="lp-name">{{ lead?.name || 'Threshold reward' }}</div>
        <div class="lp-price"><span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span><span class="lp-mech">on threshold</span></div>
      </div>
    </template>

    <!-- SIMPLE (old -> new) — default -->
    <template v-else>
      <div class="lp-prod">
        <div class="lp-img"><span>PRODUCT</span></div>
        <div class="lp-body">
          <div class="lp-name">{{ lead?.name }}</div>
          <div class="lp-sub">{{ lead?.code }}<template v-if="lead?.supplier"> · {{ lead.supplier.name }}</template></div>
          <div class="lp-price">
            <span v-if="oldPrice != null && setPrice != null && Number(oldPrice) !== Number(setPrice)" class="lp-old">{{ fmt(oldPrice) }}</span>
            <span class="lp-new">{{ fmt(setPrice) }}<span class="lp-cur">PLN</span></span>
            <span v-if="discount != null" class="lp-disc">−{{ discount }}%</span>
          </div>
        </div>
      </div>
    </template>
  </article>
</template>

<style scoped>
.lp {
  display: flex; flex-direction: column; gap: 10px;
  border: 1px solid #eef0f3; border-radius: 10px; padding: 12px; background: #fff;
  font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1a1d23; height: 100%;
}
.lp-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lp-cat { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #3f37a8; background: #f0eefc; padding: 2px 8px; border-radius: 5px; }
.lp-type { font-size: 11px; color: #9aa0ab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* image placeholder */
.lp-img {
  position: relative; height: 96px; border-radius: 8px;
  background-color: #f6f7f9;
  background-image: repeating-linear-gradient(45deg, #eceef2 0, #eceef2 8px, #f6f7f9 8px, #f6f7f9 16px);
  border: 1px solid #eef0f3; display: flex; align-items: center; justify-content: center;
}
.lp-img.sm { height: 124px; }
.lp-img.wide { height: 120px; }
.lp-img > span { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; color: #b8bdc7; }
.lp-qty-badge {
  position: absolute; top: 6px; left: 6px;
  background: #5b50d6; color: #fff; border-radius: 7px; padding: 3px 8px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 14px; font-weight: 700;
}
.lp-qty-badge small { font-size: 9px; font-weight: 600; }

.lp-prod { display: flex; flex-direction: column; gap: 8px; }
.lp-body { display: flex; flex-direction: column; gap: 2px; }
.lp-name { font-size: 13.5px; font-weight: 700; line-height: 1.25; }
.lp-sub { font-size: 11px; color: #9aa0ab; }

/* price */
.lp-price { display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
.lp-old { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 12px; color: #aab0ba; text-decoration: line-through; }
.lp-new { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 22px; font-weight: 700; color: #d83a45; letter-spacing: -0.02em; line-height: 1; }
.lp-new.sm { font-size: 18px; }
.lp-cur { font-size: 0.5em; font-weight: 600; margin-left: 3px; }
.lp-mech { font-size: 10.5px; color: #9aa0ab; align-self: flex-end; white-space: nowrap; }
.lp-disc { font-size: 11px; font-weight: 700; color: #fff; background: #d83a45; padding: 2px 7px; border-radius: 5px; }

/* mechanic ribbon / badges */
.lp-ribbon { align-self: flex-start; margin-top: 4px; font-size: 11px; font-weight: 700; color: #3f37a8; background: #f0eefc; padding: 3px 9px; border-radius: 6px; }
.lp-ribbon.is-gift { color: #0f7a4a; background: #e3f4ec; }
.lp-ribbon b { color: #d83a45; }
.lp-app { align-self: flex-start; font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; color: #fff; background: #1a1d23; padding: 3px 9px; border-radius: 6px; }

/* set / pair rows */
.lp-setrow, .lp-pairrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.lp-setitem { display: flex; flex-direction: column; gap: 4px; width: 124px; }
.lp-setname { font-size: 12px; font-weight: 600; line-height: 1.2; }
.lp-totlbl { font-size: 10px; color: #9aa0ab; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
.lp-op { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 20px; font-weight: 700; color: #cfd3da; }
.lp-setprice { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-left: 2px; flex: 0 0 auto; }
.lp-pairrow .lp-img { flex: 1 1 0; }
.lp-gift {
  flex: 1 1 0; position: relative; height: 96px; border-radius: 8px;
  background: #eef6f1; border: 1px dashed #b9e0c9;
  display: flex; align-items: center; justify-content: center;
  font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 10px; letter-spacing: 0.1em; color: #6f9a85;
}
.lp-gift-tag { position: absolute; top: 6px; left: 6px; background: #15935b; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 7px; border-radius: 5px; letter-spacing: 0.05em; }

/* percent hero number */
.lp-percent { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 34px; font-weight: 800; color: #d83a45; line-height: 1; margin-top: 6px; }
.lp-percent .lp-pct { font-size: 0.5em; }

/* threshold */
.lp-threshold { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.lp-th-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; color: #9a6608; background: #f7eedb; padding: 3px 9px; border-radius: 6px; }
.lp-threshold .lp-img.wide { width: 100%; }

/* hero: single promotion fills the page */
.lp.hero { border: none; padding: 4px 0; gap: 14px; }
.lp.hero .lp-prod { flex-direction: row; gap: 26px; align-items: center; }
.lp.hero .lp-prod .lp-img { flex: 0 0 46%; height: 320px; border-radius: 12px; }
.lp.hero .lp-body { flex: 1 1 auto; }
.lp.hero .lp-name { font-size: 28px; letter-spacing: -0.02em; line-height: 1.1; }
.lp.hero .lp-sub { font-size: 14px; margin-top: 4px; }
.lp.hero .lp-new { font-size: 50px; }
.lp.hero .lp-new.sm { font-size: 36px; }
.lp.hero .lp-old { font-size: 20px; }
.lp.hero .lp-percent { font-size: 72px; }
.lp.hero .lp-disc { font-size: 16px; padding: 4px 12px; }
.lp.hero .lp-setitem { width: 160px; }
.lp.hero .lp-img.sm { height: 150px; flex: none; }
@media (max-width: 640px) {
  .lp.hero .lp-prod { flex-direction: column; align-items: stretch; }
  .lp.hero .lp-img { flex: none; height: 220px; }
}
</style>
