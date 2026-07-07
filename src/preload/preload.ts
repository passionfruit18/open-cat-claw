import { contextBridge, ipcRenderer } from 'electron'

const overlayApi = {
  setInteractive(interactive: boolean): void {
    ipcRenderer.send('overlay:set-interactive', interactive)
  },
  focusWindow(): void {
    ipcRenderer.send('overlay:focus-window')
  }
}

contextBridge.exposeInMainWorld('overlay', overlayApi)

export type OverlayApi = typeof overlayApi
