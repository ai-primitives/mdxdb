export type { ExecutionContext } from '@cloudflare/workers-types'

export interface ScheduledEvent {
  cron: string
  scheduledTime: number
  type: string
}
