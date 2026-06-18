<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { ChatbubbleOutline } from '@vicons/ionicons5'
import { isCommentable } from '../composables/commentable'
import { openComments } from '../composables/comments'
import { summaryFor } from '../composables/commentSummary'

const props = defineProps<{
  refModel: string
  refId: number
  attribute?: string | null
  label: string
  size?: number
}>()

const show = computed(() => isCommentable(props.refModel, props.attribute ?? null))

// grey = none, blue = has comments (all read), green = has unread.
const stat = computed(() => summaryFor(props.refModel, props.refId, props.attribute ?? null))
const stateClass = computed(() => {
  const s = stat.value
  if (!s || s.total === 0) return ''
  return s.unread > 0 ? 'has-unread' : 'has-comments'
})
</script>

<template>
  <NButton
    v-if="show"
    text
    :focusable="false"
    class="comment-btn"
    :class="stateClass"
    :title="`Comments — ${label}`"
    @click.stop="openComments({ refModel, refId, attribute: attribute ?? null, label })"
  >
    <template #icon><NIcon :size="size ?? 11"><ChatbubbleOutline /></NIcon></template>
  </NButton>
</template>

<style scoped>
/* Superscript marker: placed before the value (left) and raised. */
.comment-btn {
  color: #b3b9c4;
  align-self: flex-start;
  transform: translateY(-0.35em);
}
.comment-btn:hover {
  color: #2080f0;
}
.comment-btn.has-comments {
  color: #2080f0;
}
.comment-btn.has-unread {
  color: #18a058;
}
</style>
