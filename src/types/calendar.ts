export interface CampaignTypeRef {
  id: number
  name: string
  code: string
}

export interface TemplateRef {
  id: number
  name: string
}

export interface StageRef {
  id: number
  name: string
  code: string
  position: number
}

export interface CalendarEvent {
  id: number
  name: string
  campaign_type_id: number
  campaign_type: CampaignTypeRef
  process_template_id: number | null
  process_template: TemplateRef | null
  current_stage_id: number | null
  current_stage: StageRef | null
  cancelled: boolean
  campaign_id: number | null
  start_date: string
  end_date: string
  duration_days: number
  description: string
  color: string | null
}
