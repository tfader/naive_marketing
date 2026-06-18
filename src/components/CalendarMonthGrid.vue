<script setup lang="ts">
import { ref, watch } from 'vue'
import { NCalendar } from 'naive-ui'
import type { CalendarEvent } from '../types/calendar'

const props = defineProps<{
  events: CalendarEvent[]
  year: number
}>()

const emit = defineEmits<{
  (e: 'event-click', event: CalendarEvent): void
  (e: 'year-change', year: number): void
}>()

const currentDate = new Date()
const initMonth = props.year === currentDate.getFullYear() ? currentDate.getMonth() : 0
const panelTs = ref(new Date(props.year, initMonth, 1).getTime())

// Keep the panel in sync when the year filter changes elsewhere.
watch(
  () => props.year,
  (y) => {
    if (new Date(panelTs.value).getFullYear() !== y) {
      panelTs.value = new Date(y, 0, 1).getTime()
    }
  }
)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// `month` is 1-indexed (as provided by NCalendar's cell slot).
function eventsForDay(year: number, month: number, date: number): CalendarEvent[] {
  const cell = `${year}-${pad(month)}-${pad(date)}`
  return props.events.filter((ev) => ev.start_date <= cell && cell <= ev.end_date)
}

// Navigating across a year boundary reloads the right year's data upstream.
function onPanelChange(info: { year: number; month: number }) {
  if (info.year !== props.year) emit('year-change', info.year)
}
</script>

<template>
  <NCalendar v-model:value="panelTs" @panel-change="onPanelChange">
    <template #default="{ year, month, date }">
      <div class="day-events">
        <div
          v-for="ev in eventsForDay(year, month, date)"
          :key="ev.id"
          class="event-chip"
          :class="{ cancelled: ev.cancelled }"
          :style="{ background: ev.color || '#94a3b8' }"
          :title="`${ev.name} (${ev.start_date} → ${ev.end_date})`"
          @click.stop="emit('event-click', ev)"
        >
          {{ ev.name }}
        </div>
      </div>
    </template>
  </NCalendar>
</template>

<style scoped>
.day-events {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}
.event-chip {
  font-size: 11px;
  line-height: 16px;
  color: #fff;
  border-radius: 3px;
  padding: 0 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.event-chip:hover {
  filter: brightness(1.05);
}
.event-chip.cancelled {
  opacity: 0.45;
  text-decoration: line-through;
}
</style>
