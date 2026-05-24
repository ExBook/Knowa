export function getStorageDescription(storagePath?: string): string {
  return storagePath
    ? `浏览器 IndexedDB（待 Tauri 桌面版接入后将写入: ${storagePath}）`
    : '浏览器 IndexedDB（未设置持久化目录）';
}

