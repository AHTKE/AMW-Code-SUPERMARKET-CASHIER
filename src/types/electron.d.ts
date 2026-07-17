export {};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      toggleFullscreen?: () => Promise<boolean>;
      isFullscreen?: () => Promise<boolean>;
      persistenceGetAll?: () => Promise<Record<string, string>>;
      persistenceSet?: (key: string, value: string) => Promise<boolean>;
      persistenceRemove?: (key: string) => Promise<boolean>;
    };
  }
}