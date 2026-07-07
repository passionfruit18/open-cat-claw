import './style.css'
import { CursorFollower } from './cursorFollower'

const canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement
const context2d = canvas.getContext('2d')

if (!context2d) {
  throw new Error('Could not acquire 2D canvas context')
}

const ctx: CanvasRenderingContext2D = context2d

function resizeCanvas(): void {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

resizeCanvas()
window.addEventListener('resize', resizeCanvas)

const follower = new CursorFollower(ctx, { x: window.innerWidth / 2, y: window.innerHeight / 2 })

window.addEventListener('mousemove', (event) => {
  follower.setTarget({ x: event.clientX, y: event.clientY })
})

function tick(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  follower.update()
  follower.draw()
  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
