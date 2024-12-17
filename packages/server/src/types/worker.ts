export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
}

export interface ScheduledEvent {
  cron: string
  scheduledTime: number
  type: string
}
