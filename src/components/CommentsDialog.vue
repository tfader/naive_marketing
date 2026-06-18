<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { NModal, NCard, NInput, NButton, NTag, NSwitch, useMessage } from 'naive-ui'
import api from '../api/client'
import { commentTarget, showCommentsDialog, bumpComments } from '../composables/comments'
import { useAuthStore } from '../stores/auth'

interface CommentItem {
  id: number
  ref_attribute: string | null
  ref_value: string | null
  current_value: string | null
  stale: boolean
  body: string | null
  deleted: boolean
  seen: boolean
  author: { id: number; name: string } | null
  created_at: string
}

const CHARS_PER_SEC = 15
const MIN_READ_MS = 600

const message = useMessage()
const auth = useAuthStore()
const currentUserId = computed(() => auth.user?.id ?? null)

const comments = ref<CommentItem[]>([])
const draft = ref('')
const loading = ref(false)
const onlyNew = ref(true)
let openedAt = 0

const displayed = computed(() => (onlyNew.value ? comments.value.filter((c) => !c.seen) : comments.value))

function readingMs(body: string): number {
  return Math.max(MIN_READ_MS, (body.length / CHARS_PER_SEC) * 1000)
}

async function load() {
  const t = commentTarget.value
  if (!t) return
  loading.value = true
  try {
    const { data } = await api.get('/comments', { params: { ref_model: t.refModel, ref_id: t.refId } })
    comments.value = (data as CommentItem[]).filter((c) => c.ref_attribute === t.attribute)
  } catch {
    comments.value = []
  } finally {
    loading.value = false
    openedAt = Date.now()
  }
}

async function add() {
  const t = commentTarget.value
  const body = draft.value.trim()
  if (!t || !body) return
  try {
    await api.post('/comments', { ref_model: t.refModel, ref_id: t.refId, ref_attribute: t.attribute, body })
    draft.value = ''
    onlyNew.value = false // show the thread incl. the new comment
    await load()
    bumpComments()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to add comment')
  }
}

async function remove(id: number) {
  try {
    await api.delete(`/comments/${id}`)
    await load()
    bumpComments()
  } catch {
    message.error('Failed to delete comment')
  }
}

// On close: mark others' unseen comments as seen if the dialog was open long enough
// to read them (cumulative reading time, top to bottom).
async function markSeenOnClose() {
  const elapsed = Date.now() - openedAt
  const markable = comments.value.filter((c) => !c.seen && !c.deleted && c.author?.id !== currentUserId.value)
  let cumulative = 0
  const ids: number[] = []
  for (const c of markable) {
    cumulative += readingMs(c.body ?? '')
    if (elapsed >= cumulative) ids.push(c.id)
  }
  if (ids.length) {
    try {
      await api.post('/comments/mark_seen', { comment_ids: ids })
      bumpComments()
    } catch {
      /* best-effort */
    }
  }
}

function when(ts: string): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : ''
}

watch(showCommentsDialog, async (val, old) => {
  if (val && !old) {
    draft.value = ''
    onlyNew.value = true
    await load()
  } else if (!val && old) {
    await markSeenOnClose()
  }
})
watch(commentTarget, () => {
  if (showCommentsDialog.value) load()
})
</script>

<template>
  <NModal v-model:show="showCommentsDialog">
    <NCard
      v-if="commentTarget"
      :title="`Comments — ${commentTarget.label}`"
      style="width: 540px"
      closable
      @close="showCommentsDialog = false"
    >
      <template #header-extra>
        <div class="cd-toggle">
          <span class="cd-toggle-lbl">Only new</span>
          <NSwitch v-model:value="onlyNew" size="small" />
        </div>
      </template>

      <div class="cd-list">
        <div v-if="!displayed.length && !loading" class="cd-empty">
          {{ onlyNew ? 'No new comments.' : 'No comments yet.' }}
        </div>
        <div v-for="c in displayed" :key="c.id" class="cd-comment">
          <div class="cd-head">
            <span class="cd-author">{{ c.author?.name ?? 'Unknown' }}</span>
            <NTag v-if="!c.seen && !c.deleted" size="small" type="success" :bordered="false">new</NTag>
            <span class="cd-time">{{ when(c.created_at) }}</span>
            <NButton v-if="!c.deleted" size="tiny" quaternary type="error" class="cd-del" @click="remove(c.id)">delete</NButton>
          </div>
          <div v-if="c.deleted" class="cd-deleted">(deleted)</div>
          <div v-else class="cd-body">{{ c.body }}</div>
          <div v-if="!c.deleted && c.ref_attribute" class="cd-meta">
            <span>at comment: <b>{{ c.ref_value ?? '—' }}</b></span>
            <NTag v-if="c.stale" size="small" type="warning" :bordered="false">changed → {{ c.current_value ?? '—' }}</NTag>
          </div>
        </div>
      </div>

      <div class="cd-add">
        <NInput
          v-model:value="draft"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 5 }"
          placeholder="Add a comment…"
        />
        <NButton type="primary" :disabled="!draft.trim()" @click="add">Comment</NButton>
      </div>
    </NCard>
  </NModal>
</template>

<style scoped>
.cd-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cd-toggle-lbl {
  font-size: 12px;
  color: #888;
}
.cd-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.cd-empty {
  color: #bbb;
  font-style: italic;
  padding: 4px 0;
}
.cd-comment {
  background: #f7f8fa;
  border-radius: 6px;
  padding: 8px 10px;
}
.cd-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cd-author {
  font-weight: 600;
  font-size: 13px;
  color: #2b2b33;
}
.cd-time {
  font-size: 11px;
  color: #9aa0ab;
}
.cd-del {
  margin-left: auto;
}
.cd-body {
  font-size: 13px;
  color: #333;
  margin-top: 2px;
  white-space: pre-wrap;
}
.cd-deleted {
  font-size: 13px;
  color: #b0b0bb;
  font-style: italic;
  margin-top: 2px;
}
.cd-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}
.cd-add {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-top: 14px;
}
</style>
