/// <reference types="vite/client" />

// Types for Vite PWA virtual module
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
  }
  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => void;
}

