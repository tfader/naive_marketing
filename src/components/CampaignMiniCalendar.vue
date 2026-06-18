<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  start: string | null
  end: string | null
  color?: string | null
}>()

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parse(d: string): Date {
  const [y, m, dd] = d.split('-').map(Number)
  return new Date(y, m - 1, dd)
}

const accent = computed(() => props.color || '#3b82f6')
const startD = computed(() => (props.start ? parse(props.start) : null))
const endD = computed(() => (props.end ? parse(props.end) : null))

// Every month the campaign spans, contiguously (so middle months aren't skipped).
const monthsToRender = computed(() => {
  if (!startD.value) return []
  const end = endD.value ?? startD.value
  const list: { year: number; month: number }[] = []
  let y = startD.value.getFullYear()
  let m = startD.value.getMonth()
  while ((y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) && list.length < 6) {
    list.push({ year: y, month: m })
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
  return list
})

function monthWeeks(year: number, month: number): (number | null)[][] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = (first.getDay() + 6) % 7 // Monday-first
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

function sameDay(d: Date | null, year: number, month: number, day: number): boolean {
  return !!d && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
}

function cellStyle(year: number, month: number, day: number | null) {
  if (day == null || !startD.value || !endD.value) return {}
  const isEdge = sameDay(startD.value, year, month, day) || sameDay(endD.value, year, month, day)
  if (isEdge) return { background: accent.value, color: '#fff', fontWeight: '700' }
  const d = new Date(year, month, day)
  if (d >= startD.value && d <= endD.value) return { background: `${accent.value}22` }
  return {}
}
</script>

<template>
  <div v-if="startD" class="mini-cal">
    <div class="mc-months">
      <div v-for="m in monthsToRender" :key="`${m.year}-${m.month}`" class="mc-month">
        <div class="mc-title">{{ MONTHS[m.month] }} {{ m.year }}</div>
        <div class="mc-grid">
          <div v-for="wd in WEEKDAYS" :key="wd" class="mc-wd">{{ wd }}</div>
          <template v-for="(week, wi) in monthWeeks(m.year, m.month)" :key="wi">
            <div
              v-for="(day, di) in week"
              :key="di"
              class="mc-day"
              :class="{ empty: day == null }"
              :style="cellStyle(m.year, m.month, day)"
            >
              {{ day }}
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mini-cal {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.mc-months {
  display: flex;
  gap: 14px;
}
.mc-month {
  width: 138px;
}
.mc-title {
  font-size: 11px;
  font-weight: 600;
  color: #555;
  text-align: center;
  margin-bottom: 4px;
}
.mc-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.mc-wd {
  font-size: 9px;
  color: #aaa;
  text-align: center;
  padding-bottom: 1px;
}
.mc-day {
  font-size: 10px;
  text-align: center;
  line-height: 18px;
  height: 18px;
  border-radius: 4px;
  color: #444;
}
.mc-day.empty {
  visibility: hidden;
}
</style>
