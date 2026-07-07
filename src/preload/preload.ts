import { contextBridge } from 'electron'

const overlayApi = {
  // Placeholder surface for renderer <-> main IPC as agent features land.
}

contextBridge.exposeInMainWorld('overlay', overlayApi)

export type OverlayApi = typeof overlayApi
