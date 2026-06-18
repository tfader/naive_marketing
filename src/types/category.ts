export interface Category {
  id: number
  name: string
  code: string
  parent_id: number | null
  sort_order: number
  active: boolean
}
