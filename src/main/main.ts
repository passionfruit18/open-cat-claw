import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { AgentManager } from './agent'

let overlayWindow: BrowserWindow | null = null
let agentManager: AgentManager | null = null

function createOverlayWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Keep the overlay above other windows, including full-screen apps and other spaces.
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Let clicks fall through to whatever is beneath the overlay, while still
  // forwarding mouse-move events so the renderer can track the cursor.
  overlayWindow.setIgnoreMouseEvents(true, { forward: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

app.whenReady().then(() => {
  createOverlayWindow()
  agentManager = new AgentManager()
  agentManager.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow()
    }
  })
})

app.on('window-all-closed', () => {
  agentManager?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
