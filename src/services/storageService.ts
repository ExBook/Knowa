const isTauri = () => typeof window !== 'undefined' && '__TAURI__' in window;

export type StorageMode = 'indexeddb' | 'filesystem';

export function getStorageMode(): StorageMode {
  return isTauri() ? 'filesystem' : 'indexeddb';
}

export function getStorageDescription(storagePath?: string): string {
  const mode = getStorageMode();
  if (mode === 'filesystem') {
    return storagePath ? `文件系统: ${storagePath}` : '文件系统: 未设置目录';
  }
  return storagePath
    ? `浏览器 IndexedDB（待 Tauri 接入后将写入: ${storagePath}）`
    : '浏览器 IndexedDB（未设置持久化目录）';
}

export async function saveToDisk(storagePath: string, filename: string, data: string): Promise<void> {
  if (isTauri()) {
    const { writeTextFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(`${storagePath}/${filename}`, data);
  }
  // In browser mode, IndexedDB handles persistence — no filesystem access
}
