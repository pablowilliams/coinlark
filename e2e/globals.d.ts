export {};
declare global {
  interface Window {
    __feedPerf?: {
      n: number;
      virtual: boolean;
      generateMs: number;
      readyAt: number;
      renderMs?: number;
      done: boolean;
    };
  }
}
