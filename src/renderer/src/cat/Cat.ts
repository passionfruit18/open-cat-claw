export type CatState = 'idle' | 'dragging' | 'falling' | 'landing'

interface Point {
  x: number
  y: number
}

interface DragSample extends Point {
  t: number
}

const GRAVITY = 2600 // px/s^2
const LANDING_VELOCITY_THRESHOLD = 240 // px/s, min fall speed that triggers a squash landing
const LANDING_DURATION = 0.3 // seconds
const GROUND_FRICTION = 6.5 // 1/s decay rate for horizontal velocity once grounded
const TAIL_THUMP_PERIOD = 1.18 // seconds

export const CAT_WIDTH = 108
export const CAT_TOTAL_HEIGHT = 148

function easeInQuad(p: number): number {
  return p * p
}

function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// 0 = tail tip touching the floor, 1 = fully lifted. Fast down-thump, brief
// hold on the floor, slower rise back up — mirrors a cat's idle tail flick.
function tailLift(t: number): number {
  const phase = (t % TAIL_THUMP_PERIOD) / TAIL_THUMP_PERIOD
  if (phase < 0.22) return 1 - easeInQuad(phase / 0.22)
  if (phase < 0.4) return 0
  return easeOutCubic((phase - 0.4) / 0.6)
}

function landingSquash(p: number): Point {
  if (p < 0.35) {
    const d = p / 0.35
    return { x: lerp(1, 1.28, d), y: lerp(1, 0.68, d) }
  }
  if (p < 0.7) {
    const d = (p - 0.35) / 0.35
    return { x: lerp(1.28, 0.92, d), y: lerp(0.68, 1.08, d) }
  }
  const d = (p - 0.7) / 0.3
  return { x: lerp(0.92, 1, d), y: lerp(1.08, 1, d) }
}

class Poof {
  private t = 0
  done = false

  constructor(
    private readonly x: number,
    private readonly y: number
  ) {}

  update(dt: number): void {
    this.t += dt
    if (this.t > 0.34) this.done = true
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const p = clamp(this.t / 0.34, 0, 1)
    ctx.save()
    ctx.globalAlpha = (1 - p) * 0.35
    for (let i = 0; i < 3; i++) {
      const ang = -Math.PI + (i / 2) * Math.PI
      const dist = p * (26 + i * 10)
      ctx.beginPath()
      ctx.arc(this.x + Math.cos(ang) * dist, this.y - Math.abs(Math.sin(ang)) * dist * 0.4, 5 - p * 3, 0, Math.PI * 2)
      ctx.fillStyle = '#f4ecd8'
      ctx.fill()
    }
    ctx.restore()
  }
}

/**
 * Sitting desktop-pet cat with a small state machine: it idles on the floor
 * with a periodic tail thump, can be picked up and dragged, and falls under
 * gravity (with release momentum) whenever it isn't resting on the floor —
 * landing with a squash animation if it lands hard.
 */
export class Cat {
  x: number
  private anchorY: number
  private vx = 0
  private vy = 0
  state: CatState = 'falling'
  private t = 0
  private landingT = 0
  private blinkT = Math.random() * 3
  private lean = 0
  private tailSwing = 0
  private dragOffset: Point = { x: 0, y: 0 }
  private dragHistory: DragSample[] = []
  private poofs: Poof[] = []

  constructor(
    private floorY: number,
    spawnX: number,
    private readonly reduceMotion: boolean
  ) {
    this.x = spawnX
    this.anchorY = -80
  }

  setFloorY(floorY: number): void {
    this.floorY = floorY
    if (this.state === 'idle') this.anchorY = floorY
  }

  containsPoint(px: number, py: number): boolean {
    const halfW = CAT_WIDTH / 2 + 8
    return (
      px >= this.x - halfW &&
      px <= this.x + halfW &&
      py >= this.anchorY - CAT_TOTAL_HEIGHT - 8 &&
      py <= this.anchorY + 8
    )
  }

  beginDrag(px: number, py: number): void {
    this.state = 'dragging'
    this.dragOffset = { x: px - this.x, y: py - this.anchorY }
    this.dragHistory = [{ x: px, y: py, t: performance.now() }]
    this.vx = 0
    this.vy = 0
  }

  updateDrag(px: number, py: number, clampX: (x: number) => number): void {
    this.x = clampX(px - this.dragOffset.x)
    this.anchorY = Math.min(py - this.dragOffset.y, this.floorY)
    this.dragHistory.push({ x: px, y: py, t: performance.now() })
    if (this.dragHistory.length > 6) this.dragHistory.shift()
  }

  endDrag(): void {
    const hist = this.dragHistory
    if (hist.length >= 2) {
      const a = hist[0]
      const b = hist[hist.length - 1]
      const dt = Math.max(1, b.t - a.t) / 1000
      this.vx = (b.x - a.x) / dt
      this.vy = (b.y - a.y) / dt
    } else {
      this.vx = 0
      this.vy = 0
    }
    if (this.anchorY >= this.floorY - 1) {
      this.landOrSettle()
    } else {
      this.state = 'falling'
    }
  }

  private landOrSettle(): void {
    const wasHard = Math.abs(this.vy) > LANDING_VELOCITY_THRESHOLD
    this.anchorY = this.floorY
    if (wasHard && !this.reduceMotion) {
      this.state = 'landing'
      this.landingT = 0
      this.poofs.push(new Poof(this.x, this.floorY + 2))
    } else {
      this.state = 'idle'
      this.vx = 0
      this.vy = 0
      this.t = 0
    }
  }

  update(dt: number, clampX: (x: number) => number): void {
    this.t += dt
    this.blinkT += dt

    for (let i = this.poofs.length - 1; i >= 0; i--) {
      this.poofs[i].update(dt)
      if (this.poofs[i].done) this.poofs.splice(i, 1)
    }

    switch (this.state) {
      case 'idle':
        this.anchorY = this.floorY
        this.lean += (0 - this.lean) * Math.min(1, dt * 8)
        break
      case 'falling':
        this.vy += GRAVITY * dt
        this.anchorY += this.vy * dt
        this.x = clampX(this.x + this.vx * dt)
        this.vx *= Math.max(0, 1 - 0.6 * dt)
        this.lean = clamp(this.vx * 0.0022, -0.4, 0.4)
        if (this.anchorY >= this.floorY) this.landOrSettle()
        break
      case 'landing':
        this.landingT += dt
        this.x = clampX(this.x + this.vx * dt)
        this.vx *= Math.max(0, 1 - GROUND_FRICTION * dt)
        this.lean += (0 - this.lean) * Math.min(1, dt * 10)
        if (this.landingT >= LANDING_DURATION) {
          this.state = 'idle'
          this.vx = 0
          this.t = 0
        }
        break
      case 'dragging': {
        const dvx = this.dragVelocityX()
        this.lean += (clamp(dvx * 0.0018, -0.3, 0.3) - this.lean) * Math.min(1, dt * 10)
        break
      }
    }

    const targetSwing = this.state === 'dragging' || this.state === 'falling' ? -this.lean * 1.6 : 0
    this.tailSwing += (targetSwing - this.tailSwing) * Math.min(1, dt * 6)
  }

  private dragVelocityX(): number {
    const hist = this.dragHistory
    if (hist.length < 2) return 0
    const a = hist[hist.length - 2]
    const b = hist[hist.length - 1]
    const dt = Math.max(1, b.t - a.t) / 1000
    return (b.x - a.x) / dt
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const poof of this.poofs) poof.draw(ctx)

    const squash =
      this.state === 'landing' && !this.reduceMotion
        ? landingSquash(this.landingT / LANDING_DURATION)
        : { x: 1, y: 1 }

    ctx.save()
    ctx.translate(this.x, this.anchorY)

    const shadowScale = clamp(1 - (this.floorY - this.anchorY) / 260, 0.35, 1)
    ctx.beginPath()
    ctx.ellipse(0, 6, CAT_WIDTH * 0.4 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(6,4,12,0.4)'
    ctx.fill()

    ctx.rotate(this.lean)
    ctx.scale(squash.x, squash.y)

    const alert = this.state === 'falling' || this.state === 'dragging'
    const tipLift = this.state === 'idle' && !this.reduceMotion ? tailLift(this.t) : alert ? 0.9 : 0.5

    this.drawTail(ctx, tipLift, alert)
    this.drawBody(ctx)
    this.drawHead(ctx, alert)

    ctx.restore()
  }

  private drawTail(ctx: CanvasRenderingContext2D, tipLift: number, alert: boolean): void {
    const baseX = 24
    const baseY = -22
    const liftH = alert ? 46 : 34
    const swing = this.tailSwing * 40
    const tipX = baseX + 30 + swing
    const tipY = -tipLift * liftH
    const ctrl1X = baseX + 26 + swing * 0.6
    const ctrl1Y = baseY - 6
    const ctrl2X = tipX + 6
    const ctrl2Y = tipY - 14

    ctx.beginPath()
    ctx.moveTo(baseX, baseY)
    ctx.bezierCurveTo(ctrl1X, ctrl1Y, ctrl2X, ctrl2Y, tipX, tipY)
    ctx.lineWidth = 15
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#cf7638'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(tipX, tipY, 7.2, 0, Math.PI * 2)
    ctx.fillStyle = '#cf7638'
    ctx.fill()
  }

  private drawBody(ctx: CanvasRenderingContext2D): void {
    ctx.beginPath()
    ctx.ellipse(0, -50, 36, 50, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#e2853f'
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(0, -34, 16, 26, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fbe7c4'
    ctx.fill()

    ctx.strokeStyle = 'rgba(173, 95, 39, 0.55)'
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    for (const [x1, y1, x2, y2] of [
      [-24, -78, -30, -66],
      [22, -80, 30, -68],
      [-28, -60, -34, -46]
    ]) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    ctx.fillStyle = '#fbe7c4'
    for (const dx of [-15, 15]) {
      ctx.beginPath()
      ctx.ellipse(dx, -6, 10, 8, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawHead(ctx: CanvasRenderingContext2D, alert: boolean): void {
    const hy = -104

    this.drawEar(ctx, -19, hy - 6, -1, alert)
    this.drawEar(ctx, 19, hy - 6, 1, alert)

    ctx.beginPath()
    ctx.arc(0, hy, 29, 0, Math.PI * 2)
    ctx.fillStyle = '#e2853f'
    ctx.fill()

    ctx.beginPath()
    ctx.ellipse(0, hy + 10, 15, 11, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#fbe7c4'
    ctx.fill()

    const blinking = !alert && !this.reduceMotion && this.blinkT % 4.2 > 4.06
    this.drawEye(ctx, -11, hy - 3, alert, blinking)
    this.drawEye(ctx, 11, hy - 3, alert, blinking)

    ctx.beginPath()
    ctx.moveTo(-4, hy + 6)
    ctx.lineTo(4, hy + 6)
    ctx.lineTo(0, hy + 11)
    ctx.closePath()
    ctx.fillStyle = '#ff8f9c'
    ctx.fill()

    ctx.strokeStyle = 'rgba(244,236,216,0.55)'
    ctx.lineWidth = 1.4
    for (const [x1, y1, x2, y2] of [
      [-16, hy + 8, -34, hy + 4],
      [-16, hy + 12, -34, hy + 13],
      [16, hy + 8, 34, hy + 4],
      [16, hy + 12, 34, hy + 13]
    ]) {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }

  private drawEar(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, alert: boolean): void {
    const tilt = alert ? dir * -0.08 : dir * 0.18
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tilt)
    ctx.beginPath()
    ctx.moveTo(-11, 6)
    ctx.lineTo(0, -24)
    ctx.lineTo(11, 6)
    ctx.closePath()
    ctx.fillStyle = '#e2853f'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(-6, 3)
    ctx.lineTo(0, -14)
    ctx.lineTo(6, 3)
    ctx.closePath()
    ctx.fillStyle = '#ff8f9c'
    ctx.fill()
    ctx.restore()
  }

  private drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, alert: boolean, blinking: boolean): void {
    if (blinking) {
      ctx.beginPath()
      ctx.moveTo(x - 5, y)
      ctx.quadraticCurveTo(x, y + 3, x + 5, y)
      ctx.strokeStyle = '#2a1c12'
      ctx.lineWidth = 2
      ctx.lineCap = 'round'
      ctx.stroke()
      return
    }
    const r = alert ? 5.6 : 4.2
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = '#2a1c12'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.32, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(244,236,216,0.9)'
    ctx.fill()
  }
}
