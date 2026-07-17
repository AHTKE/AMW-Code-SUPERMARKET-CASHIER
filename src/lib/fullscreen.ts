type FullscreenElectronApi = {
  toggleFullscreen?: () => Promise<boolean>;
  isFullscreen?: () => Promise<boolean>;
};

export async function toggleAppFullscreen(): Promise<boolean> {
  const electronApi = (window as unknown as { electronAPI?: FullscreenElectronApi }).electronAPI;
  if (electronApi?.toggleFullscreen) {
    return Boolean(await electronApi.toggleFullscreen());
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen?.();
    return false;
  }
  await document.documentElement.requestFullscreen?.();
  return true;
}

export async function getAppFullscreenState(): Promise<boolean> {
  const electronApi = (window as unknown as { electronAPI?: FullscreenElectronApi }).electronAPI;
  if (electronApi?.isFullscreen) {
    return Boolean(await electronApi.isFullscreen());
  }
  return Boolean(document.fullscreenElement);
}
