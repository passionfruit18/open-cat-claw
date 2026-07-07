export {}

declare global {
  interface Window {
    overlay: {
      setInteractive(interactive: boolean): void
    }
  }
}
