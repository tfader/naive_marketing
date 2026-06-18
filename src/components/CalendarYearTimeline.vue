<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarEvent } from '../types/calendar'

const props = defineProps<{
  events: CalendarEvent[]
  year: number
}>()

defineEmits<{
  (e: 'event-click', event: CalendarEvent): void
}>()

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MS_PER_DAY = 86_400_000

function parseLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY)
}

const totalDays = computed(() => {
  const start = new Date(props.year, 0, 1)
  const end = new Date(props.year + 1, 0, 1)
  return diffDays(start, end)
})

// 12 month columns sized by their real day-count (so bars align with month boundaries).
const monthCols = computed(() => {
  const yearStart = new Date(props.year, 0, 1)
  return MONTH_LABELS.map((label, m) => {
    const first = new Date(props.year, m, 1)
    const daysInMonth = new Date(props.year, m + 1, 0).getDate()
    return {
      label,
      left: (diffDays(yearStart, first) / totalDays.value) * 100,
      width: (daysInMonth / totalDays.value) * 100,
    }
  })
})

// Events that intersect the year, positioned as bars (clipped to year bounds).
// The label sits *outside* the bar so it's never clipped by the bar's width;
// near the right edge it flips to the left side of the bar.
const bars = computed(() => {
  const lo = new Date(props.year, 0, 1)
  const hi = new Date(props.year, 11, 31)
  return props.events
    .map((ev) => {
      const s = parseLocal(ev.start_date)
      const e = parseLocal(ev.end_date)
      if (e < lo || s > hi) return null
      const cs = s < lo ? lo : s
      const ce = e > hi ? hi : e
      const startDay = diffDays(lo, cs)
      const endDay = diffDays(lo, ce)
      const left = (startDay / totalDays.value) * 100
      const width = ((endDay - startDay + 1) / totalDays.value) * 100
      return {
        ev,
        left,
        width,
        labelSide: left + width > 65 ? 'left' : 'right',
      }
    })
    .filter(
      (b): b is { ev: CalendarEvent; left: number; width: number; labelSide: 'left' | 'right' } =>
        b !== null
    )
})

const todayLeft = computed(() => {
  const now = new Date()
  if (now.getFullYear() !== props.year) return null
  const lo = new Date(props.year, 0, 1)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return (diffDays(lo, today) / totalDays.value) * 100
})
</script>

<template>
  <div class="timeline">
    <div class="timeline-inner">
      <!-- Month header -->
      <div class="row header-row">
        <div class="label-col"></div>
        <div class="track">
          <div
            v-for="c in monthCols"
            :key="c.label"
            class="month-label"
            :style="{ left: c.left + '%', width: c.width + '%' }"
          >
            {{ c.label }}
          </div>
        </div>
      </div>

      <!-- Event rows -->
      <div v-for="b in bars" :key="b.ev.id" class="row">
        <div class="label-col" :title="b.ev.name">{{ b.ev.name }}</div>
        <div class="track">
          <div
            v-for="c in monthCols"
            :key="c.label"
            class="gridline"
            :style="{ left: c.left + '%' }"
          ></div>
          <div v-if="todayLeft !== null" class="today-line" :style="{ left: todayLeft + '%' }"></div>
          <div
            class="bar"
            :class="{ cancelled: b.ev.cancelled }"
            :style="{ left: b.left + '%', width: b.width + '%', background: b.ev.color || '#94a3b8' }"
            :title="`${b.ev.name} · ${b.ev.campaign_type.code} (${b.ev.start_date} → ${b.ev.end_date})`"
            @click="$emit('event-click', b.ev)"
          ></div>
          <div
            class="bar-name"
            :class="{ 'on-left': b.labelSide === 'left', cancelled: b.ev.cancelled }"
            :style="b.labelSide === 'left' ? { right: 100 - b.left + '%' } : { left: b.left + b.width + '%' }"
            :title="b.ev.campaign_type.name"
            @click="$emit('event-click', b.ev)"
          >
            {{ b.ev.campaign_type.code }}
          </div>
        </div>
      </div>

      <div v-if="!bars.length" class="empty">No campaigns in {{ year }}</div>
    </div>
  </div>
</template>

<style scoped>
.timeline {
  border: 1px solid #efeff5;
  border-radius: 6px;
  overflow-x: auto;
  background: #fff;
}
.timeline-inner {
  min-width: 900px;
}
.row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #f4f4f8;
}
.row:last-child {
  border-bottom: none;
}
.header-row {
  background: #fafafc;
}
.label-col {
  flex: 0 0 180px;
  width: 180px;
  padding: 6px 12px;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-right: 1px solid #efeff5;
  display: flex;
  align-items: center;
}
.header-row .label-col {
  font-weight: 600;
}
.track {
  position: relative;
  flex: 1 1 auto;
  height: 32px;
}
.month-label {
  position: absolute;
  top: 0;
  height: 32px;
  line-height: 32px;
  text-align: center;
  font-size: 12px;
  color: #888;
}
.gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #f0f0f4;
}
.today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #f5222d;
  opacity: 0.5;
  z-index: 2;
}
.bar {
  position: absolute;
  top: 7px;
  height: 18px;
  min-width: 6px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 3;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}
.bar:hover {
  filter: brightness(1.05);
}
.bar.cancelled {
  opacity: 0.45;
}
.bar-name {
  position: absolute;
  top: 0;
  height: 32px;
  line-height: 32px;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  padding-left: 8px;
  cursor: pointer;
  z-index: 3;
}
.bar-name.on-left {
  padding-left: 0;
  padding-right: 8px;
  text-align: right;
}
.bar-name.cancelled {
  opacity: 0.55;
  text-decoration: line-through;
}
.empty {
  padding: 24px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
}
</style>
