import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('../layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('../views/DashboardView.vue'),
      },
      {
        path: 'calendar',
        name: 'Calendar',
        component: () => import('../views/CalendarView.vue'),
      },
      {
        path: 'campaigns',
        name: 'Campaigns',
        component: () => import('../views/CampaignsView.vue'),
      },
      {
        path: 'campaigns/:id',
        name: 'CampaignDetail',
        component: () => import('../views/CampaignDetailView.vue'),
      },
      {
        path: 'roles',
        name: 'Roles',
        component: () => import('../views/RolesView.vue'),
      },
      {
        path: 'process',
        name: 'Process',
        component: () => import('../views/ProcessView.vue'),
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('../views/UsersView.vue'),
      },
      {
        path: 'campaign-types',
        name: 'CampaignTypes',
        component: () => import('../views/CampaignTypesView.vue'),
      },
      {
        path: 'promotion-types',
        name: 'PromotionTypes',
        component: () => import('../views/PromotionTypesView.vue'),
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('../views/CategoriesView.vue'),
      },
      {
        path: 'parameters',
        name: 'Parameters',
        component: () => import('../views/ParametersView.vue'),
      },
      {
        path: 'commentable',
        name: 'Commentable',
        component: () => import('../views/CommentableView.vue'),
      },
      {
        path: 'statuses',
        name: 'Statuses',
        component: () => import('../views/StatusesView.vue'),
      },
      {
        path: 'statusable',
        name: 'Statusable',
        component: () => import('../views/StatusableView.vue'),
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth !== false && !auth.isAuthenticated) {
    if (auth.token) {
      try {
        await auth.fetchUser()
        if (auth.isAuthenticated) return true
      } catch {
        // token invalid
      }
    }
    return { name: 'Login' }
  }

  if (to.name === 'Login' && auth.isAuthenticated) {
    return { name: 'Dashboard' }
  }
})

export default router
