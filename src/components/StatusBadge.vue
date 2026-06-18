<script setup lang="ts">
import { computed } from 'vue'
import { isStatusable } from '../composables/statusable'
import { statusFor } from '../composables/statusSummary'
import { openStatus } from '../composables/statuses'

const props = defineProps<{
  refModel: string
  refId: number
  attribute?: string | null
  label: string
}>()

const show = computed(() => isStatusable(props.refModel, props.attribute ?? null))
const current = computed(() => statusFor(props.refModel, props.refId, props.attribute ?? null))

function open() {
  openStatus({ refModel: props.refModel, refId: props.refId, attribute: props.attribute ?? null, label: props.label })
}
</script>

<template>
  <button
    v-if="show"
    type="button"
    class="status-badge"
    :class="{ 'is-empty': !current }"
    :title="`Status — ${label}`"
    @click.stop="open"
  >
    <span class="dot" :style="current ? `background:${current.color}` : ''"></span>
    <span v-if="current" class="name" :style="`color:${current.color}`">{{ current.name }}</span>
  </button>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #e2e6ec;
  background: #f7f8fa;
  border-radius: 10px;
  padding: 1px 8px;
  cursor: pointer;
  line-height: 1.5;
}
.status-badge.is-empty {
  background: transparent;
  border-style: dashed;
  padding: 1px 5px;
}
.status-badge:hover {
  border-color: #c9cfd8;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c2c7d0;
  display: inline-block;
}
.name {
  font-size: 11px;
  font-weight: 700;
}
</style>
