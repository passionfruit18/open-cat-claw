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
const SETTINGS_STORAGE_KEY = 'opencatclaw.settings'
const DEFAULT_SETTINGS = { hungerIntervalSeconds: 5 }
const TARGET_TEXT = 'salmon salmon salmon'

type Settings = typeof DEFAULT_SETTINGS

type TypedStatus = 'correct' | 'incorrect' | 'pending'

function floorYFor(height: number): number {
  return height - FLOOR_MARGIN
}

function clampX(x: number): number {
  const half = CAT_WIDTH * 0.55
  return Math.max(half, Math.min(window.innerWidth - half, x))
}

function loadSettings(): Settings {
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      hungerIntervalSeconds: parsed.hungerIntervalSeconds ?? DEFAULT_SETTINGS.hungerIntervalSeconds
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: Settings): void {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
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

const uiRoot = document.createElement('div')
uiRoot.id = 'overlay-ui'
document.body.appendChild(uiRoot)

const settingsButton = document.createElement('button')
settingsButton.id = 'settings-toggle'
settingsButton.type = 'button'
settingsButton.textContent = '⚙'
settingsButton.title = 'Open settings'
uiRoot.appendChild(settingsButton)

const bowlButton = document.createElement('button')
bowlButton.id = 'food-bowl'
bowlButton.type = 'button'
bowlButton.setAttribute('aria-label', 'Feed the cat')
bowlButton.innerHTML = '<span class="bowl-emoji">🥣</span>'
uiRoot.appendChild(bowlButton)

const settingsPanel = document.createElement('div')
settingsPanel.id = 'settings-panel'
settingsPanel.innerHTML = `
  <h2>Cat settings</h2>
  <label for="hunger-interval">Hunger every (seconds)</label>
  <input id="hunger-interval" type="number" min="1" step="1" />
  <button id="settings-save" type="button">Save</button>
`
uiRoot.appendChild(settingsPanel)

const minigameCard = document.createElement('div')
minigameCard.id = 'minigame-card'
minigameCard.innerHTML = `
  <div class="minigame-title">Feed the cat</div>
  <div id="target-text" class="target-text"></div>
  <div id="typed-preview" class="typed-preview"></div>
  <div class="minigame-hint">Type the words. Press Esc to leave.</div>
`
uiRoot.appendChild(minigameCard)

const typingInput = document.createElement('input')
typingInput.id = 'typing-input'
typingInput.type = 'text'
typingInput.autocomplete = 'off'
typingInput.autocapitalize = 'off'
typingInput.spellcheck = false
typingInput.setAttribute('aria-label', 'Type to feed the cat')
uiRoot.appendChild(typingInput)

const targetTextEl = minigameCard.querySelector('#target-text') as HTMLDivElement
const typedPreviewEl = minigameCard.querySelector('#typed-preview') as HTMLDivElement
const hungerIntervalInput = settingsPanel.querySelector('#hunger-interval') as HTMLInputElement
const settingsSaveButton = settingsPanel.querySelector('#settings-save') as HTMLButtonElement

let interactive = false
let dragging = false
let mouseX = window.innerWidth / 2
let mouseY = window.innerHeight / 2
let hungerIntervalSeconds = loadSettings().hungerIntervalSeconds
let hungry = false
let bowlVisible = false
let minigameActive = false
let settingsOpen = false
let userTyped = ''
let hungerTimer: number | null = null

function setInteractive(value: boolean): void {
  if (interactive !== value) {
    interactive = value
    window.overlay.setInteractive(value)
  }
  document.body.style.cursor = value ? 'pointer' : 'default'
}

function updateOverlayInteractionForPoint(x: number, y: number): void {
  const hitTarget = document.elementFromPoint(x, y) as HTMLElement | null
  const overUi = Boolean(hitTarget && uiRoot.contains(hitTarget))
  const overCat = cat.containsPoint(x, y)
  const shouldCapture = overUi || overCat || minigameActive || settingsOpen
  setInteractive(shouldCapture)
}

function updateBowlVisibility(): void {
  bowlButton.classList.toggle('visible', bowlVisible && !minigameActive)
}

function updateMinigameVisibility(): void {
  minigameCard.classList.toggle('visible', minigameActive)
}

function updateSettingsVisibility(): void {
  settingsPanel.classList.toggle('open', settingsOpen)
}

function renderPrompt(): void {
  const chars = TARGET_TEXT.split('').map((char, index) => {
    let status: TypedStatus = 'pending'
    if (index < userTyped.length) {
      status = userTyped[index].toLowerCase() === char.toLowerCase() ? 'correct' : 'incorrect'
    }
    const displayChar = char === ' ' ? '\u00A0' : char
    return `<span class="typing-char ${status}">${escapeHtml(displayChar)}</span>`
  })
  targetTextEl.innerHTML = chars.join('')
  typedPreviewEl.textContent = userTyped
}

function startHungerTimer(): void {
  if (hungerTimer) window.clearInterval(hungerTimer)
  hungerTimer = window.setInterval(() => {
    if (!minigameActive) {
      hungry = true
      bowlVisible = true
      updateBowlVisibility()
      cat.setChaseTarget({ x: mouseX, y: mouseY })
      setInteractive(false)
    }
  }, hungerIntervalSeconds * 1000)
}

function stopHungerTimer(): void {
  if (hungerTimer) {
    window.clearInterval(hungerTimer)
    hungerTimer = null
  }
}

function openSettings(): void {
  settingsOpen = true
  hungerIntervalInput.value = String(hungerIntervalSeconds)
  updateSettingsVisibility()
  updateOverlayInteractionForPoint(mouseX, mouseY)
}

function closeSettings(): void {
  settingsOpen = false
  updateSettingsVisibility()
  updateOverlayInteractionForPoint(mouseX, mouseY)
}

function showEatAnimation(): void {
  const catPosition = cat.getPosition()
  const startX = bowlButton.getBoundingClientRect().left + 24
  const startY = bowlButton.getBoundingClientRect().top + 24
  for (let i = 0; i < 3; i++) {
    const salmon = document.createElement('div')
    salmon.className = 'feed-salmon'
    salmon.textContent = '🐟'
    salmon.style.left = `${startX}px`
    salmon.style.top = `${startY}px`
    uiRoot.appendChild(salmon)
    requestAnimationFrame(() => {
      salmon.style.left = `${catPosition.x - 60 + i * 20}px`
      salmon.style.top = `${Math.max(24, catPosition.y - 90)}px`
      salmon.classList.add('active')
    })
    window.setTimeout(() => salmon.remove(), 900)
  }
}

function exitMinigame(): void {
  minigameActive = false
  if (hungry) {
    bowlVisible = true
  } else {
    bowlVisible = false
  }
  userTyped = ''
  typingInput.value = ''
  updateBowlVisibility()
  updateMinigameVisibility()
  renderPrompt()
  cat.setChaseTarget(hungry ? { x: mouseX, y: mouseY } : null)
  updateOverlayInteractionForPoint(mouseX, mouseY)
  typingInput.blur()
}

function enterMinigame(): void {
  if (!hungry || minigameActive) return
  minigameActive = true
  bowlVisible = false
  userTyped = ''
  typingInput.value = ''
  updateBowlVisibility()
  updateMinigameVisibility()
  renderPrompt()
  cat.setChaseTarget(null)
  updateOverlayInteractionForPoint(mouseX, mouseY)
  stopHungerTimer()
  window.overlay.focusWindow()
  typingInput.focus()
}

function finishFeeding(): void {
  hungry = false
  bowlVisible = false
  minigameActive = false
  userTyped = ''
  typingInput.value = ''
  updateBowlVisibility()
  updateMinigameVisibility()
  renderPrompt()
  cat.setChaseTarget(null)
  updateOverlayInteractionForPoint(mouseX, mouseY)
  typingInput.blur()
  showEatAnimation()
  startHungerTimer()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!minigameActive) {
    if (event.key === 'Escape' && settingsOpen) {
      event.preventDefault()
      closeSettings()
    }
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    exitMinigame()
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    userTyped = userTyped.slice(0, -1)
    renderPrompt()
    return
  }

  if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return

  event.preventDefault()
  userTyped += event.key.toLowerCase()
  renderPrompt()
  if (userTyped === TARGET_TEXT) {
    finishFeeding()
  }
}

settingsButton.addEventListener('click', () => {
  if (settingsOpen) {
    closeSettings()
  } else {
    openSettings()
  }
})

settingsSaveButton.addEventListener('click', () => {
  const nextValue = Math.max(1, Number.parseInt(hungerIntervalInput.value, 10) || DEFAULT_SETTINGS.hungerIntervalSeconds)
  hungerIntervalSeconds = nextValue
  const nextSettings: Settings = { hungerIntervalSeconds }
  saveSettings(nextSettings)
  startHungerTimer()
  closeSettings()
})

bowlButton.addEventListener('click', () => {
  enterMinigame()
})

window.addEventListener('mousemove', (event) => {
  mouseX = event.clientX
  mouseY = event.clientY

  if (dragging) {
    cat.updateDrag(event.clientX, event.clientY, clampX)
    return
  }

  if (hungry && !minigameActive && !dragging) {
    cat.setChaseTarget({ x: mouseX, y: mouseY })
  } else {
    cat.setChaseTarget(null)
  }

  updateOverlayInteractionForPoint(event.clientX, event.clientY)
})

window.addEventListener('mousedown', (event) => {
  if (minigameActive) {
    document.body.focus()
    return
  }
  if (!interactive || !cat.containsPoint(event.clientX, event.clientY)) return
  dragging = true
  cat.beginDrag(event.clientX, event.clientY)
  document.body.style.cursor = 'grabbing'
})

window.addEventListener('mouseup', () => {
  if (!dragging) return
  dragging = false
  cat.endDrag()
  setInteractive(cat.containsPoint(mouseX, mouseY))
})

window.addEventListener('keydown', handleKeyDown)

document.body.tabIndex = 0
renderPrompt()
updateBowlVisibility()
updateMinigameVisibility()
updateSettingsVisibility()
startHungerTimer()

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
