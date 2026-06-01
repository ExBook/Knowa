import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Question } from '../../src/shared/types';

const { createPdfMock } = vi.hoisted(() => ({
  createPdfMock: vi.fn(() => ({ getBlob: vi.fn(() => Promise.resolve(new Blob(['pdf']))) })),
}));

vi.mock('pdfmake/build/pdfmake', () => ({
  default: {
    addVirtualFileSystem: vi.fn(),
    addFonts: vi.fn(),
    createPdf: createPdfMock,
  },
}));

vi.mock('pdfmake/build/vfs_fonts', () => ({ default: {} }));

const { generatePrecisePDF, normalizePdfTextForLayout } = await import('../../src/services/pdfExportService');

const textDoc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
const imageDoc = (src: string, width = 45, align = 'right') => ({
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: '题干配图' }] },
    { type: 'image', attrs: { src, alt: 'diagram', width, align } },
  ],
});

function firstImageNode(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const node = value as Record<string, unknown>;
  if ('image' in node || 'svg' in node) {
    return node;
  }

  for (const child of Object.values(node)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const result = firstImageNode(item);
        if (result) {
          return result;
        }
      }
    } else {
      const result = firstImageNode(child);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function sampleQuestion(body: object): Question {
  return {
    id: 'question-1',
    bankId: 'bank-1',
    type: 'single',
    body,
    options: [
      { index: 0, content: textDoc('选项 A') },
      { index: 1, content: textDoc('选项 B') },
    ],
    answer: [0],
    explanation: textDoc('解析'),
    tags: [],
    order: 1,
    createdAt: 1,
  };
}

describe('pdfExportService', () => {
  beforeEach(() => {
    createPdfMock.mockClear();
  });

  it('adds break hints to very long unspaced text for pdf layout', () => {
    const longText = '是否会丢失水分呢'.repeat(20);
    const normalized = normalizePdfTextForLayout(longText);

    expect(normalized).toContain('\u200B');
    expect(normalized.replace(/\u200B/g, '')).toBe(longText);
  });

  it('keeps rich text images in precise PDF content with bounded size and alignment', async () => {
    const imageSrc = 'data:image/png;base64,iVBORw0KGgo=';

    await generatePrecisePDF([{ question: sampleQuestion(imageDoc(imageSrc, 45, 'right')) }], {
      bankName: '图片题库',
      includeAnswers: true,
      includeExplanations: true,
      includeNotes: false,
      includeStats: false,
    });

    const docDefinition = createPdfMock.mock.calls[0][0] as { content: unknown[] };
    const imageNode = firstImageNode(docDefinition.content);

    expect(JSON.stringify(docDefinition.content)).not.toContain('[图片');
    expect(imageNode).toMatchObject({
      image: imageSrc,
      alignment: 'right',
      fit: [220, 180],
    });
  });

  it('keeps non-base64 SVG images in precise PDF content', async () => {
    const svgSrc = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>';

    await generatePrecisePDF([{ question: sampleQuestion(imageDoc(svgSrc, 80, 'center')) }], {
      bankName: 'SVG 题库',
      includeAnswers: true,
      includeExplanations: true,
      includeNotes: false,
      includeStats: false,
    });

    const docDefinition = createPdfMock.mock.calls[0][0] as { content: unknown[] };
    const imageNode = firstImageNode(docDefinition.content);

    expect(imageNode).toMatchObject({
      svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>diagram</text></svg>',
      alignment: 'center',
      fit: [392, 180],
    });
  });
});
