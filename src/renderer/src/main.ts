import './style.css'
import { Cat, CAT_WIDTH } from './cat/Cat'

const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement
const context2d = canvas.getContext('2d')

if (!context2d) {
  throw new Error('Could not acquire 2D canvas context')
}

const ctx: CanvasRenderingContext2D = context2d
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const FLOOR_MARGIN = 20

function floorYFor(height: number): number {
  return height - FLOOR_MARGIN
}

function clampX(x: number): number {
  const half = CAT_WIDTH * 0.55
  return Math.max(half, Math.min(window.innerWidth - half, x))
}

canvas.width = window.innerWidth
canvas.height = window.innerHeight

const cat = new Cat(floorYFor(window.innerHeight), window.innerWidth / 2, reduceMotion)

function resizeCanvas(): void {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  cat.setFloorY(floorYFor(window.innerHeight))
}

window.addEventListener('resize', resizeCanvas)

// The overlay window is click-through by default so it doesn't block the
// desktop underneath. We flip it to interactive only while the cursor is
// over the cat, so drags land on the cat and everything else passes through.
let interactive = false
let dragging = false

function setInteractive(value: boolean): void {
  if (interactive !== value) {
    interactive = value
    window.overlay.setInteractive(value)
  }
  document.body.style.cursor = value ? 'grab' : 'default'
}

window.addEventListener('mousemove', (event) => {
  if (dragging) {
    cat.updateDrag(event.clientX, event.clientY, clampX)
    return
  }
  setInteractive(cat.containsPoint(event.clientX, event.clientY))
})

window.addEventListener('mousedown', (event) => {
  if (!interactive || !cat.containsPoint(event.clientX, event.clientY)) return
  dragging = true
  cat.beginDrag(event.clientX, event.clientY)
  document.body.style.cursor = 'grabbing'
})

window.addEventListener('mouseup', (event) => {
  if (!dragging) return
  dragging = false
  cat.endDrag()
  setInteractive(cat.containsPoint(event.clientX, event.clientY))
})

let lastTimestamp = performance.now()

function tick(timestamp: number): void {
  const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000)
  lastTimestamp = timestamp

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  cat.update(dt, clampX)
  cat.draw(ctx)

  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
