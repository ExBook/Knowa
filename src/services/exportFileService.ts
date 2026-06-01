import { saveAs } from 'file-saver';
import { isTauriRuntime } from './localDataDirectory';

const extensionLabels: Record<string, string> = {
  pdf: 'PDF 文档',
  exbank: 'Knowa 题库包',
  exlocal: 'Knowa 全量备份',
};

export function safeExportFilename(filename: string): string {
  const cleaned = Array.from(filename)
    .map((char) => (/[<>:"/\\|?*]/.test(char) || char.charCodeAt(0) < 32 ? '-' : char))
    .join('');
  return cleaned.replace(/\s+/g, ' ').trim() || 'knowa-export';
}

function extensionOf(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

async function defaultSavePath(filename: string): Promise<string> {
  try {
    const { downloadDir, join } = await import('@tauri-apps/api/path');
    return join(await downloadDir(), filename);
  } catch {
    return filename;
  }
}

export async function saveBlobToFile(blob: Blob, filename: string, title = '保存导出文件'): Promise<string | null> {
  const safeFilename = safeExportFilename(filename);

  if (!isTauriRuntime()) {
    saveAs(blob, safeFilename);
    return safeFilename;
  }

  const extension = extensionOf(safeFilename);
  const { save } = await import('@tauri-apps/plugin-dialog');
  const selectedPath = await save({
    title,
    defaultPath: await defaultSavePath(safeFilename),
    canCreateDirectories: true,
    filters: extension
      ? [
          {
            name: extensionLabels[extension] ?? `${extension.toUpperCase()} 文件`,
            extensions: [extension],
          },
        ]
      : undefined,
  });

  if (!selectedPath) {
    return null;
  }

  const { invoke } = await import('@tauri-apps/api/core');
  const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
  return invoke<string>('write_export_file', { path: selectedPath, bytes });
}
