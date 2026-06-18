import { ref } from 'vue'

export interface StatusTarget {
  refModel: string
  refId: number
  attribute: string | null
  label: string
}

const statusTarget = ref<StatusTarget | null>(null)
const showStatusDialog = ref(false)
const statusVersion = ref(0)

export function bumpStatus(): void {
  statusVersion.value++
}
export function openStatus(target: StatusTarget): void {
  statusTarget.value = target
  showStatusDialog.value = true
}

export { statusTarget, showStatusDialog, statusVersion }
