<script setup lang="ts">
import StatusBadge from './StatusBadge.vue'
import CommentButton from './CommentButton.vue'

// Generic per-field annotations cluster: status badge + comment bubble.
// Each self-hides when not applicable. Always placed to the LEFT of the value.
defineProps<{
  refModel: string
  refId: number
  attribute?: string | null
  label: string
  size?: number
}>()
</script>

<template>
  <span class="field-meta">
    <StatusBadge :ref-model="refModel" :ref-id="refId" :attribute="attribute ?? null" :label="label" />
    <CommentButton :ref-model="refModel" :ref-id="refId" :attribute="attribute ?? null" :label="label" :size="size" />
  </span>
</template>

<style scoped>
.field-meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
