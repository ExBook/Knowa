export interface ParsedDataUrl {
  mime: string;
  bytes: Uint8Array;
  isBase64: boolean;
}

function decodeUrlPayload(payload: string): string {
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return binary;
}

export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const match = dataUrl.match(/^data:([^,]*),(.*)$/s);
  if (!match) {
    throw new Error('图片数据 URL 格式不合法');
  }

  const meta = match[1] || 'text/plain;charset=US-ASCII';
  const payload = match[2] ?? '';
  const segments = meta.split(';').filter(Boolean);
  const mime = (segments[0]?.includes('/') ? segments[0] : 'text/plain').toLowerCase();
  const isBase64 = segments.includes('base64');

  return {
    mime,
    isBase64,
    bytes: isBase64 ? base64ToBytes(payload) : new TextEncoder().encode(decodeUrlPayload(payload)),
  };
}

export function imageExtensionFromMime(mime: string): string {
  const subtype = mime.split('/')[1]?.toLowerCase() ?? 'png';
  if (subtype === 'svg+xml') {
    return 'svg';
  }
  if (subtype === 'jpeg') {
    return 'jpg';
  }
  return subtype.replace(/[^a-z0-9]/g, '') || 'png';
}

export function imageExtensionFromDataUrl(dataUrl: string): string {
  return imageExtensionFromMime(parseDataUrl(dataUrl).mime);
}

export function mimeFromImageFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
  if (ext === 'svg') {
    return 'image/svg+xml';
  }
  if (ext === 'jpg') {
    return 'image/jpeg';
  }
  return `image/${ext}`;
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  return parseDataUrl(dataUrl).bytes;
}

export function dataUrlToBinaryString(dataUrl: string): string {
  return bytesToBinaryString(dataUrlToBytes(dataUrl));
}

export function dataUrlToBase64DataUrl(dataUrl: string): string {
  const parsed = parseDataUrl(dataUrl);
  return `data:${parsed.mime};base64,${bytesToBase64(parsed.bytes)}`;
}
