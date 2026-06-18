<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NInput, NButton, NTag, NText, useMessage } from 'naive-ui'
import api from '../api/client'

const props = defineProps<{ refModel: string; refId: number }>()
const message = useMessage()

interface CommentItem {
  id: number
  ref_attribute: string | null
  ref_value: string | null
  current_value: string | null
  stale: boolean
  body: string | null
  deleted: boolean
  author: { id: number; name: string } | null
  created_at: string
}
interface SchemaAttr { name: string; label: string; enabled: boolean }
interface SchemaModel { model: string; label: string; whole_enabled: boolean; attributes: SchemaAttr[] }

const cfg = ref<SchemaModel | null>(null)
const comments = ref<CommentItem[]>([])
const drafts = ref<Record<string, string>>({})

const WHOLE = '__whole__'

const sections = computed(() => {
  const list: { key: string; label: string; attribute: string | null }[] = []
  if (!cfg.value) return list
  if (cfg.value.whole_enabled) list.push({ key: WHOLE, label: 'Whole object', attribute: null })
  for (const a of cfg.value.attributes) if (a.enabled) list.push({ key: a.name, label: a.label, attribute: a.name })
  return list
})

function commentsFor(attribute: string | null): CommentItem[] {
  return comments.value.filter((c) => c.ref_attribute === attribute)
}

async function loadConfig() {
  try {
    const { data } = await api.get('/commentable_settings')
    cfg.value = (data as SchemaModel[]).find((m) => m.model === props.refModel) ?? null
  } catch {
    cfg.value = null
  }
}
async function loadComments() {
  try {
    const { data } = await api.get('/comments', { params: { ref_model: props.refModel, ref_id: props.refId } })
    comments.value = data
  } catch {
    comments.value = []
  }
}

async function add(section: { key: string; attribute: string | null }) {
  const body = (drafts.value[section.key] ?? '').trim()
  if (!body) return
  try {
    await api.post('/comments', { ref_model: props.refModel, ref_id: props.refId, ref_attribute: section.attribute, body })
    drafts.value[section.key] = ''
    await loadComments()
  } catch (err: any) {
    const errors = err.response?.data?.errors
    message.error(Array.isArray(errors) ? errors.join(', ') : 'Failed to add comment')
  }
}
async function remove(id: number) {
  try {
    await api.delete(`/comments/${id}`)
    await loadComments()
  } catch {
    message.error('Failed to delete comment')
  }
}

function when(ts: string): string {
  return ts ? ts.slice(0, 16).replace('T', ' ') : ''
}

watch(
  () => props.refId,
  () => loadComments()
)
onMounted(async () => {
  await Promise.all([loadConfig(), loadComments()])
})
</script>

<template>
  <div v-if="sections.length" class="cp">
    <div class="cp-title">Comments</div>
    <div v-for="section in sections" :key="section.key" class="cp-section">
      <div class="cp-section-head">
        <NTag size="small" :type="section.attribute ? 'default' : 'info'" :bordered="false">{{ section.label }}</NTag>
      </div>

      <div v-for="c in commentsFor(section.attribute)" :key="c.id" class="cp-comment">
        <div class="cp-comment-head">
          <span class="cp-author">{{ c.author?.name ?? 'Unknown' }}</span>
          <span class="cp-time">{{ when(c.created_at) }}</span>
          <NButton v-if="!c.deleted" size="tiny" quaternary type="error" class="cp-del" @click="remove(c.id)">delete</NButton>
        </div>
        <div v-if="c.deleted" class="cp-deleted">(deleted)</div>
        <div v-else class="cp-body">{{ c.body }}</div>
        <div v-if="!c.deleted && c.ref_attribute" class="cp-meta">
          <span>at comment: <b>{{ c.ref_value ?? '—' }}</b></span>
          <NTag v-if="c.stale" size="small" type="warning" :bordered="false">changed → {{ c.current_value ?? '—' }}</NTag>
        </div>
      </div>

      <div class="cp-add">
        <NInput
          v-model:value="drafts[section.key]"
          type="textarea"
          :autosize="{ minRows: 1, maxRows: 4 }"
          size="small"
          placeholder="Add a comment…"
        />
        <NButton size="small" type="primary" :disabled="!(drafts[section.key] ?? '').trim()" @click="add(section)">Comment</NButton>
      </div>
    </div>
  </div>
  <div v-else class="cp-none"><NText depth="3" style="font-size:12px">Commenting is not enabled for this object.</NText></div>
</template>

<style scoped>
.cp {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cp-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #98a0ad;
}
.cp-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #eef0f4;
  border-radius: 8px;
}
.cp-comment {
  background: #f7f8fa;
  border-radius: 6px;
  padding: 8px 10px;
}
.cp-comment-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-author {
  font-weight: 600;
  font-size: 13px;
  color: #2b2b33;
}
.cp-time {
  font-size: 11px;
  color: #9aa0ab;
}
.cp-del {
  margin-left: auto;
}
.cp-body {
  font-size: 13px;
  color: #333;
  margin-top: 2px;
  white-space: pre-wrap;
}
.cp-deleted {
  font-size: 13px;
  color: #b0b0bb;
  font-style: italic;
  margin-top: 2px;
}
.cp-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #888;
  margin-top: 4px;
}
.cp-add {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.cp-none {
  margin-top: 8px;
}
</style>
