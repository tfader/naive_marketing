<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute, RouterView } from 'vue-router'
import CommentsDialog from '../components/CommentsDialog.vue'
import StatusDialog from '../components/StatusDialog.vue'
import { loadCommentable } from '../composables/commentable'
import { loadStatusable } from '../composables/statusable'
import {
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NLayoutHeader,
  NText,
  NAvatar,
  NDropdown,
  NButton,
} from 'naive-ui'
import {
  HomeOutline,
  CalendarOutline,
  MegaphoneOutline,
  PeopleOutline,
  GitNetworkOutline,
  PersonOutline,
  ListOutline,
  PricetagsOutline,
  GridOutline,
  SettingsOutline,
  ChatbubblesOutline,
  FlagOutline,
  OptionsOutline,
  TrendingUpOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useAuthStore } from '../stores/auth'
import { breadcrumbs } from '../composables/breadcrumbs'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)

onMounted(() => {
  loadCommentable()
  loadStatusable()
})

const navItems = [
  { key: 'Dashboard', label: 'Dashboard', icon: HomeOutline },
  { key: 'Calendar', label: 'Calendar', icon: CalendarOutline },
  { key: 'Campaigns', label: 'Campaigns', icon: MegaphoneOutline },
  { key: 'Roles', label: 'Roles', icon: PeopleOutline },
  { key: 'Process', label: 'Process', icon: GitNetworkOutline },
  { key: 'Users', label: 'Users', icon: PersonOutline },
  { key: 'CampaignTypes', label: 'Campaign Types', icon: ListOutline },
  { key: 'PromotionTypes', label: 'Promotion Types', icon: PricetagsOutline },
  { key: 'Categories', label: 'Categories', icon: GridOutline },
  { key: 'CategoryPromotionFactors', label: 'Category Factors', icon: TrendingUpOutline },
  { key: 'Parameters', label: 'Parameters', icon: SettingsOutline },
  { key: 'Commentable', label: 'Commentable', icon: ChatbubblesOutline },
  { key: 'Statuses', label: 'Statuses', icon: FlagOutline },
  { key: 'Statusable', label: 'Statusable', icon: OptionsOutline },
]

const activeKey = computed(() => route.name as string)

function handleMenuUpdate(key: string) {
  router.push({ name: key })
}

const userMenuOptions = [
  { label: 'Logout', key: 'logout' },
]

function handleUserMenu(key: string) {
  if (key === 'logout') {
    auth.logout()
    router.push({ name: 'Login' })
  }
}

const userInitials = computed(() => {
  if (!auth.user) return '?'
  return (auth.user.first_name[0] + auth.user.last_name[0]).toUpperCase()
})
</script>

<template>
  <NLayout has-sider style="height: 100vh">
    <NLayoutSider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="236"
      :collapsed="collapsed"
      show-trigger="bar"
      :native-scrollbar="false"
      content-style="display:flex; flex-direction:column; height:100%;"
      style="background:#fff;"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="ck-logo" :class="{ collapsed }">
        <span class="ck-logo-mark">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
            <path d="M3.6 11.3 11.3 3.6a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.3a2 2 0 0 1-.6 1.4l-7.7 7.7a2 2 0 0 1-2.8 0l-6.3-6.3a2 2 0 0 1 0-2.8Z" fill="#5b50d6"/>
            <circle cx="16.2" cy="7.8" r="1.7" fill="#fff"/>
          </svg>
        </span>
        <span v-if="!collapsed" class="ck-logo-text">Naive Marketing</span>
      </div>
      <nav class="ck-nav" :class="{ collapsed }">
        <div
          v-for="opt in navItems"
          :key="opt.key"
          class="ck-nav-item"
          :class="{ active: activeKey === opt.key }"
          :title="opt.label"
          tabindex="0"
          @click="handleMenuUpdate(opt.key)"
          @keydown.enter="handleMenuUpdate(opt.key)"
        >
          <NIcon class="ck-nav-ico" :component="opt.icon" /><span v-if="!collapsed" class="ck-nav-label">{{ opt.label }}</span>
        </div>
      </nav>
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered class="header">
        <div class="header-bar">
          <div class="header-left">
            <template v-for="(c, i) in breadcrumbs" :key="i">
              <NButton v-if="c.to" size="small" quaternary @click="router.push(c.to)">{{ c.label }}</NButton>
              <span v-else class="crumb-name">{{ c.label }}</span>
              <span v-if="i < breadcrumbs.length - 1" class="crumb-sep">/</span>
            </template>
          </div>
          <div class="header-right">
            <NText depth="3">
              {{ auth.user?.full_name }}
            </NText>
            <NDropdown :options="userMenuOptions" @select="handleUserMenu">
              <NAvatar round size="small" style="cursor: pointer; background: #5b50d6">
                {{ userInitials }}
              </NAvatar>
            </NDropdown>
          </div>
        </div>
      </NLayoutHeader>
      <NLayoutContent content-style="padding: 24px;" :native-scrollbar="false">
        <RouterView />
      </NLayoutContent>
    </NLayout>
    <CommentsDialog />
    <StatusDialog />
  </NLayout>
</template>

<style scoped>
.ck-logo {
  height: 60px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 22px;
  border-bottom: 1px solid #f0f1f4;
}
.ck-logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: #f0eefc;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.ck-logo-text {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.01em;
  color: #1a1d23;
  white-space: nowrap;
  overflow: hidden;
}
.ck-nav {
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ck-nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 12px;
  border-radius: 8px;
  color: #6b7280;
  font-size: 13.5px;
  font-weight: 500;
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  transition: background 0.12s, color 0.12s;
}
.ck-nav-item:hover {
  background: #f5f6f8;
}
.ck-nav-item.active {
  color: #3f37a8;
  font-weight: 600;
  background: #f3f2fd;
}
.ck-nav-item:focus-visible {
  outline: 2px solid #5b50d6;
  outline-offset: 2px;
}
.ck-nav-ico {
  font-size: 18px;
  color: #9aa0ab;
  flex: 0 0 auto;
  display: flex;
}
.ck-nav-item.active .ck-nav-ico {
  color: #5b50d6;
}

/* collapsed sidebar */
.ck-logo.collapsed {
  padding: 0;
  justify-content: center;
}
.ck-nav.collapsed {
  padding: 14px 8px;
}
.ck-nav.collapsed .ck-nav-item {
  justify-content: center;
  padding: 9px 0;
}

.header {
  height: 48px;
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.crumb-name {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crumb-sep {
  color: #ccc;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
