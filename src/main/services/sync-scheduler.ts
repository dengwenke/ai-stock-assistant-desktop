export class SyncScheduler {
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly task: () => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.task().catch((error) => {
        console.error('[sync-scheduler] scheduled sync failed', error)
      })
    }, this.intervalMs)
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }
}
