interface Point {
  x: number
  y: number
}

/**
 * Renders a small marker that eases toward the last known cursor position
 * every animation frame, producing a smooth trailing-delay effect rather
 * than snapping straight to the pointer.
 */
export class CursorFollower {
  private target: Point
  private current: Point
  private readonly easing: number
  private readonly radius: number

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    initial: Point,
    options: { easing?: number; radius?: number } = {}
  ) {
    this.target = initial
    this.current = { ...initial }
    this.easing = options.easing ?? 0.15
    this.radius = options.radius ?? 8
  }

  setTarget(point: Point): void {
    this.target = point
  }

  update(): void {
    this.current.x += (this.target.x - this.current.x) * this.easing
    this.current.y += (this.target.y - this.current.y) * this.easing
  }

  draw(): void {
    const { ctx, current, radius } = this
    ctx.beginPath()
    ctx.arc(current.x, current.y, radius, 0, Math.PI * 2)
    ctx.fillStyle = '#ff4d5e'
    ctx.shadowColor = 'rgba(255, 77, 94, 0.6)'
    ctx.shadowBlur = 12
    ctx.fill()
  }
}
