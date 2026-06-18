import { ref } from 'vue'

export interface CommentTarget {
  refModel: string
  refId: number
  attribute: string | null
  label: string
}

// Global state for the single shared comments dialog.
const commentTarget = ref<CommentTarget | null>(null)
const showCommentsDialog = ref(false)

// Bumped whenever comments change (add / delete / mark-seen) so screens can refresh summaries.
const commentsVersion = ref(0)
export function bumpComments(): void {
  commentsVersion.value++
}

export function openComments(target: CommentTarget): void {
  commentTarget.value = target
  showCommentsDialog.value = true
}

export { commentTarget, showCommentsDialog, commentsVersion }
