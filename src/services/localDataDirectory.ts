const preferredDirectoryKey = 'exlocal.preferredDataDirectory';

export interface LocalDataDirectoryState {
  mode: 'web' | 'desktop';
  directory: string;
  canChooseDirectory: boolean;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getLocalDataDirectory(): LocalDataDirectoryState {
  const saved = window.localStorage.getItem(preferredDirectoryKey);
  const desktop = isTauriRuntime();

  return {
    mode: desktop ? 'desktop' : 'web',
    directory: saved ?? (desktop ? '未设置' : '浏览器 IndexedDB: exlocal'),
    canChooseDirectory: desktop,
  };
}

export function setPreferredLocalDataDirectory(directory: string): LocalDataDirectoryState {
  window.localStorage.setItem(preferredDirectoryKey, directory);
  return getLocalDataDirectory();
}

export function clearPreferredLocalDataDirectory(): LocalDataDirectoryState {
  window.localStorage.removeItem(preferredDirectoryKey);
  return getLocalDataDirectory();
}
