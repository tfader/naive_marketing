<script setup lang="ts">
import { h, ref, computed, onMounted } from 'vue'
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
  NMenu,
  NText,
  NAvatar,
  NDropdown,
  NButton,
} from 'naive-ui'
import type { MenuOption } from 'naive-ui'
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
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useAuthStore } from '../stores/auth'
import { breadcrumbs } from '../composables/breadcrumbs'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const collapsed = ref(false)

function renderIcon(icon: any) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

onMounted(() => {
  loadCommentable()
  loadStatusable()
})

const menuOptions: MenuOption[] = [
  {
    label: 'Dashboard',
    key: 'Dashboard',
    icon: renderIcon(HomeOutline),
  },
  {
    label: 'Calendar',
    key: 'Calendar',
    icon: renderIcon(CalendarOutline),
  },
  {
    label: 'Campaigns',
    key: 'Campaigns',
    icon: renderIcon(MegaphoneOutline),
  },
  {
    label: 'Roles',
    key: 'Roles',
    icon: renderIcon(PeopleOutline),
  },
  {
    label: 'Process',
    key: 'Process',
    icon: renderIcon(GitNetworkOutline),
  },
  {
    label: 'Users',
    key: 'Users',
    icon: renderIcon(PersonOutline),
  },
  {
    label: 'Campaign Types',
    key: 'CampaignTypes',
    icon: renderIcon(ListOutline),
  },
  {
    label: 'Promotion Types',
    key: 'PromotionTypes',
    icon: renderIcon(PricetagsOutline),
  },
  {
    label: 'Categories',
    key: 'Categories',
    icon: renderIcon(GridOutline),
  },
  {
    label: 'Parameters',
    key: 'Parameters',
    icon: renderIcon(SettingsOutline),
  },
  {
    label: 'Commentable',
    key: 'Commentable',
    icon: renderIcon(ChatbubblesOutline),
  },
  {
    label: 'Statuses',
    key: 'Statuses',
    icon: renderIcon(FlagOutline),
  },
  {
    label: 'Statusable',
    key: 'Statusable',
    icon: renderIcon(OptionsOutline),
  },
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
      :width="220"
      :collapsed="collapsed"
      show-trigger
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo" :class="{ collapsed }">
        <span v-if="!collapsed">Naive Marketing</span>
        <span v-else>NM</span>
      </div>
      <NMenu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuUpdate"
      />
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
              <NAvatar round size="small" style="cursor: pointer; background: #36ad6a">
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
.logo {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  color: #333;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  white-space: nowrap;
  overflow: hidden;
  transition: all 0.3s;
}

.logo.collapsed {
  font-size: 18px;
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
