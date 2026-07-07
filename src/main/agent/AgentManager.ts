/**
 * AgentManager owns the async background work that runs independently of the
 * overlay UI: scheduled jobs, external API polling (e.g. calendars), and LLM
 * orchestration. It is intentionally empty for now — a landing point for
 * those subsystems as they're built out.
 */
export class AgentManager {
  private running = false

  start(): void {
    if (this.running) return
    this.running = true
  }

  stop(): void {
    this.running = false
  }
}
