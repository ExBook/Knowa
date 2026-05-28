import { describe, expect, it } from 'vitest';
import { normalizePdfTextForLayout } from '../../src/services/pdfExportService';

describe('pdfExportService', () => {
  it('adds break hints to very long unspaced text for pdf layout', () => {
    const longText = '是否会丢失水分呢'.repeat(20);
    const normalized = normalizePdfTextForLayout(longText);

    expect(normalized).toContain('\u200B');
    expect(normalized.replace(/\u200B/g, '')).toBe(longText);
  });
});
