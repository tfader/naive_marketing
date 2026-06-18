export interface CampaignTypeColored {
  id: number
  name: string
  code: string
  color: string | null
  has_pages: boolean
}

export interface StageRefLite {
  id: number
  name: string
  code: string
  position: number
}

export interface CampaignStageExecution {
  id: number
  process_stage_id: number
  name: string
  code: string
  position: number
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'blocked'
  is_gate: boolean
  stage_type: string
  started_at: string | null
  completed_at: string | null
  deadline: string | null
}

export interface CampaignActivity {
  id: number
  action: string
  metadata: Record<string, any>
  user_id: number | null
  created_at: string
}

export interface LayoutBlock {
  type: 'image' | 'gift' | 'price_old' | 'price_new' | 'price' | 'price_drop' | 'qty' | 'badge' | 'voucher' | 'plus' | 'equals' | 'text'
  text?: string
  label?: string
  was?: string
  now?: string
}

export interface PromotionLayout {
  blocks: LayoutBlock[]
}

export interface PromotionType {
  id: number
  name: string
  code: string
  description: string
  active: boolean
  sort_order: number
  min_products: number
  max_products: number | null
  layout: PromotionLayout | null
}

export interface CampaignItem {
  id: number
  campaign_category_id: number
  promotion_type_id: number
  promotion_type: { id: number; name: string; code: string }
  name: string | null
  status: 'draft' | 'ready' | 'approved'
  position: number
  page_no: number | null
  order_on_page: number | null
  min_products: number | null
  max_products: number | null
  new_sale_price: string | number | null
  new_sale_price_manual: boolean
  products_price_sum: string | number | null
  buy_quantity: number | null
  pay_quantity: number | null
  products_count: number
  products_status: 'none' | 'incomplete' | 'complete' | 'over'
  product_ids: number[]
  products: PromotionProduct[]
  metrics: ItemMetrics
}

export interface SupplierCondition {
  id: number
  supplier_id: number
  supplier: { id: number; name: string } | null
  quantity_min: number | null
  purchase_price: string | number | null
  backmargin_value: string | number | null
}

export interface PromotionProduct {
  link_id: number
  id: number
  code: string
  name: string
  current_cost_price: string | number | null
  current_sale_price: string | number | null
  avg_daily_sales: string | number | null
  lower_sale_price_last_30_days: string | number | null
  promotion_factor: number | null
  discount_percent: string | number | null
  new_price: string | number | null
  estimated_volume: string | number | null
  product_cost: string | number | null
  product_sales_value: string | number | null
  selected_condition_id: number | null
  supplier: { id: number; name: string } | null
  conditions: SupplierCondition[]
}

export interface ItemMetrics {
  volume: string | number | null
  cost: string | number | null
  sales_value: string | number | null
  margin: string | number | null
  margin_pct: string | number | null
  fully_priced: boolean
}

export interface CampaignCategory {
  id: number
  category_id: number
  category: { id: number; name: string }
  name: string
  mixed: boolean
  source_categories: { id: number; name: string }[]
  planned_items_count: number
  items_count: number
  position: number
  items: CampaignItem[]
  metrics: ItemMetrics
}

export interface Campaign {
  id: number
  name: string
  status: 'active' | 'completed' | 'cancelled'
  pages_count?: number | null
  target_margin?: string | number | null
  planned_items_total?: number
  items_count?: number
  categories_count?: number
  calendar_event_id: number | null
  campaign_type: CampaignTypeColored | null
  start_date: string | null
  end_date: string | null
  process_template: { id: number; name: string } | null
  current_stage: StageRefLite | null
  created_at: string
  metrics?: ItemMetrics
  categories?: CampaignCategory[]
  stages?: CampaignStageExecution[]
  activity?: CampaignActivity[]
}
