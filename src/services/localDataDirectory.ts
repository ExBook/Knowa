const preferredDirectoryKey = 'exlocal.preferredDataDirectory';

export interface LocalDataDirectoryState {
  mode: 'web' | 'desktop';
  directory: string;
  defaultDirectory: string;
  canChooseDirectory: boolean;
  canWriteBackup: boolean;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function fallbackWebDirectory(): LocalDataDirectoryState {
  return {
    mode: 'web',
    directory: '浏览器 IndexedDB: exlocal',
    defaultDirectory: '浏览器 IndexedDB: exlocal',
    canChooseDirectory: false,
    canWriteBackup: false,
  };
}

export function getInitialLocalDataDirectory(): LocalDataDirectoryState {
  if (!isTauriRuntime()) {
    return fallbackWebDirectory();
  }

  const saved = window.localStorage.getItem(preferredDirectoryKey);
  const directory = saved || '正在读取系统默认目录...';
  return {
    mode: 'desktop',
    directory,
    defaultDirectory: directory,
    canChooseDirectory: true,
    canWriteBackup: Boolean(saved),
  };
}

export async function getLocalDataDirectory(): Promise<LocalDataDirectoryState> {
  if (!isTauriRuntime()) {
    return fallbackWebDirectory();
  }

  const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
  const defaultDirectory = await join(await appLocalDataDir(), 'backups');
  const saved = window.localStorage.getItem(preferredDirectoryKey);
  const directory = saved || defaultDirectory;
  return {
    mode: 'desktop',
    directory,
    defaultDirectory,
    canChooseDirectory: true,
    canWriteBackup: true,
  };
}

export async function chooseLocalDataDirectory(): Promise<LocalDataDirectoryState | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const current = await getLocalDataDirectory();
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    title: '选择 ExLocal 本地备份目录',
    directory: true,
    multiple: false,
    recursive: true,
    canCreateDirectories: true,
    defaultPath: current.directory,
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  return setPreferredLocalDataDirectory(selected);
}

export async function setPreferredLocalDataDirectory(directory: string): Promise<LocalDataDirectoryState> {
  if (isTauriRuntime()) {
    window.localStorage.setItem(preferredDirectoryKey, directory);
  }
  return getLocalDataDirectory();
}

export async function clearPreferredLocalDataDirectory(): Promise<LocalDataDirectoryState> {
  window.localStorage.removeItem(preferredDirectoryKey);
  return getLocalDataDirectory();
}

export async function writeBlobToLocalDataDirectory(blob: Blob, filename: string, directory?: string): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('当前不是桌面端环境，无法写入本地目录');
  }

  const state = await getLocalDataDirectory();
  const targetDirectory = directory || state.directory;
  const { invoke } = await import('@tauri-apps/api/core');
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));

  return invoke<string>('write_backup_file', {
    directory: targetDirectory,
    filename,
    bytes,
  });
}
