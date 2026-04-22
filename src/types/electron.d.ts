export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
    };
  }
}
