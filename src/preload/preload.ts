import { contextBridge, ipcRenderer } from 'electron'

const overlayApi = {
  setInteractive(interactive: boolean): void {
    ipcRenderer.send('overlay:set-interactive', interactive)
  }
}

contextBridge.exposeInMainWorld('overlay', overlayApi)

export type OverlayApi = typeof overlayApi
