import { ref } from 'vue'

export interface Crumb {
  label: string
  to?: string // route path; if set, the crumb is a back link
}

// Shared breadcrumb state rendered in the app top bar (left side).
export const breadcrumbs = ref<Crumb[]>([])

export function setBreadcrumbs(crumbs: Crumb[]) {
  breadcrumbs.value = crumbs
}

export function clearBreadcrumbs() {
  breadcrumbs.value = []
}
