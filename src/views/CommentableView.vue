<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NH2, NText, NCard, NSwitch, NSpin, useMessage } from 'naive-ui'
import api from '../api/client'
import { loadCommentable } from '../composables/commentable'

interface CommentableAttr {
  name: string
  label: string
  enabled: boolean
}
interface CommentableModel {
  model: string
  label: string
  whole_enabled: boolean
  attributes: CommentableAttr[]
}

const message = useMessage()
const loading = ref(false)
const models = ref<CommentableModel[]>([])

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/commentable_settings')
    models.value = data
  } catch {
    message.error('Failed to load commentable settings')
  } finally {
    loading.value = false
  }
}

async function toggle(model: CommentableModel, attribute: CommentableAttr | null, enabled: boolean) {
  try {
    await api.post('/commentable_settings/toggle', {
      ref_model: model.model,
      ref_attribute: attribute?.name ?? null,
      enabled,
    })
    if (attribute) attribute.enabled = enabled
    else model.whole_enabled = enabled
    await loadCommentable(true) // refresh the app-wide cache so comment buttons update live
  } catch {
    message.error('Failed to update')
    await load()
  }
}

onMounted(load)
</script>

<template>
  <div>
    <NH2>Commentable</NH2>
    <NText depth="3">Choose which objects (as a whole) or which attributes can hold comments. Scope: Campaign and its dependents.</NText>

    <NSpin :show="loading">
      <div class="cm-grid">
        <NCard v-for="model in models" :key="model.model" :title="model.label" size="small" class="cm-card">
          <template #header-extra>
            <div class="cm-whole">
              <span class="cm-whole-lbl">Whole object</span>
              <NSwitch :value="model.whole_enabled" @update:value="(v: boolean) => toggle(model, null, v)" />
            </div>
          </template>

          <div class="cm-attrs">
            <div v-for="attr in model.attributes" :key="attr.name" class="cm-attr">
              <div class="cm-attr-info">
                <span class="cm-attr-label">{{ attr.label }}</span>
                <span class="cm-attr-name">{{ attr.name }}</span>
              </div>
              <NSwitch size="small" :value="attr.enabled" @update:value="(v: boolean) => toggle(model, attr, v)" />
            </div>
            <div v-if="!model.attributes.length" class="cm-empty">No commentable attributes.</div>
          </div>
        </NCard>
      </div>
    </NSpin>
  </div>
</template>

<style scoped>
.cm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.cm-whole {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cm-whole-lbl {
  font-size: 12px;
  color: #888;
}
.cm-attrs {
  display: flex;
  flex-direction: column;
}
.cm-attr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 2px;
  border-bottom: 1px solid #f3f3f6;
}
.cm-attr:last-child {
  border-bottom: none;
}
.cm-attr-info {
  display: flex;
  flex-direction: column;
}
.cm-attr-label {
  font-weight: 600;
  color: #2b2b33;
}
.cm-attr-name {
  font-size: 11px;
  color: #aab;
  font-family: ui-monospace, monospace;
}
.cm-empty {
  color: #bbb;
  font-style: italic;
  padding: 8px 0;
}
</style>
