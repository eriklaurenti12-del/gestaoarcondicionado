
declare global {
  interface Window {
    Quagga: {
      init: (config: any, callback: (err: any) => void) => void;
      start: () => void;
      stop: () => void;
      onDetected: (callback: (data: any) => void) => void;
    };
  }
}

export {};
