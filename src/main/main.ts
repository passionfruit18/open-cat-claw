import { app, BrowserWindow, ipcMain, screen } from 'electron'
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
    focusable: true,
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
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular')
    app.dock?.show()
  }

  createOverlayWindow()
  agentManager = new AgentManager()
  agentManager.start()

  // The renderer toggles this as the cursor enters/leaves the cat, so the
  // window is only interactive when there's actually something to click.
  ipcMain.on('overlay:set-interactive', (_event, interactive: boolean) => {
    if (!overlayWindow) return
    if (interactive) {
      overlayWindow.setIgnoreMouseEvents(false)
    } else {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true })
    }
  })

  ipcMain.on('overlay:focus-window', () => {
    if (!overlayWindow) return
    overlayWindow.focus()
  })

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
