import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content } from 'pdfmake/interfaces';
import type { Note, Question, QuizRecord } from '../shared/types';
import { bytesToBase64, dataUrlToBase64DataUrl, parseDataUrl } from './dataUrl';

type PdfMakeApi = typeof pdfMake & {
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
};

export interface QuestionData {
  question: Question;
  latestRecord?: QuizRecord;
  note?: Note;
}

export interface ExportOptions {
  bankName: string;
  includeAnswers: boolean;
  includeExplanations: boolean;
  includeNotes: boolean;
  includeStats: boolean;
}

const pdf = pdfMake as PdfMakeApi;
pdf.addVirtualFileSystem(pdfFonts as Record<string, string>);

let cjkFontReady = false;
const cjkFontFile = 'NotoSansCJKsc-Regular.otf';
const cjkFontFamily = 'NotoSansCJKsc';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buffer));
}

function assetUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${path}`;
}

export async function initCJKFont(): Promise<void> {
  if (cjkFontReady) {
    return;
  }

  try {
    const response = await fetch(assetUrl(`fonts/${cjkFontFile}`));
    if (!response.ok) {
      return;
    }

    const buffer = await response.arrayBuffer();
    pdf.addVirtualFileSystem({ [cjkFontFile]: arrayBufferToBase64(buffer) });
    pdf.addFonts({
      [cjkFontFamily]: {
        normal: cjkFontFile,
        bold: cjkFontFile,
        italics: cjkFontFile,
        bolditalics: cjkFontFile,
      },
    });
    cjkFontReady = true;
  } catch {
    console.warn('CJK font download failed, PDF Chinese text may not render');
  }
}

type RichNode = {
  type?: string;
  text?: string;
  attrs?: { alt?: string; src?: string; latex?: string; width?: number | string; align?: string };
  content?: RichNode[];
};

type PdfMargin = [number, number, number, number];
type PdfAlignment = 'left' | 'center' | 'right';

const pdfImageMaxWidth = 490;
const pdfImageMaxHeight = 180;

export function normalizePdfTextForLayout(text: string): string {
  return text.replace(/[^\s]{48,}/gu, (run) => {
    const chars = Array.from(run);
    const chunks: string[] = [];
    for (let index = 0; index < chars.length; index += 36) {
      chunks.push(chars.slice(index, index + 36).join(''));
    }
    return chunks.join('\u200B');
  });
}

function normalizeInlineDataImagesForCanvas(element: HTMLElement): () => void {
  const restored: Array<{ image: HTMLImageElement; src: string }> = [];
  element.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const src = image.getAttribute('src');
    if (!src?.startsWith('data:') || src.includes(';base64,')) {
      return;
    }

    try {
      const normalizedSrc = dataUrlToBase64DataUrl(src);
      restored.push({ image, src });
      image.setAttribute('src', normalizedSrc);
    } catch {
      // Leave unsupported inline images as-is; html2canvas will decide whether it can render them.
    }
  });

  return () => {
    restored.forEach(({ image, src }) => image.setAttribute('src', src));
  };
}

async function waitForImages(element: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(element.querySelectorAll<HTMLImageElement>('img')).map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

function imageText(attrs: RichNode['attrs']): string {
  const alt = attrs?.alt?.trim();
  return alt ? `[图片: ${normalizePdfTextForLayout(alt)}]` : '[图片]';
}

function safeImageAlignment(value: unknown): PdfAlignment {
  return value === 'left' || value === 'right' || value === 'center' ? value : 'center';
}

function safeImageWidthPercent(value: unknown): number {
  const width = Number(value ?? 60);
  if (!Number.isFinite(width)) {
    return 60;
  }
  return Math.min(100, Math.max(20, width));
}

function imageFit(attrs: RichNode['attrs']): [number, number] {
  return [Math.floor((pdfImageMaxWidth * safeImageWidthPercent(attrs?.width)) / 100), pdfImageMaxHeight];
}

function normalizeRasterImageDataUrl(src: string): string {
  const normalized = src.includes(';base64,') ? src : dataUrlToBase64DataUrl(src);
  return normalized.replace(/^data:image\/jpg;/i, 'data:image/jpeg;');
}

function dataUrlToText(dataUrl: string): string {
  return new TextDecoder().decode(parseDataUrl(dataUrl).bytes);
}

function imageFallbackContent(attrs: RichNode['attrs'], margin: PdfMargin): Content {
  return {
    text: imageText(attrs),
    margin,
    fontSize: 10,
    color: '#7a7568',
  };
}

async function convertDataImageToPngDataUrl(src: string): Promise<string | null> {
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener(
      'load',
      () => {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) {
          resolve(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      },
      { once: true },
    );
    image.addEventListener('error', () => resolve(null), { once: true });
    image.src = src.includes(';base64,') ? src : dataUrlToBase64DataUrl(src);
  });
}

async function imageToPdfContent(attrs: RichNode['attrs'], margin: PdfMargin): Promise<Content> {
  const src = attrs?.src?.trim();
  if (!src) {
    return imageFallbackContent(attrs, margin);
  }

  const base = {
    fit: imageFit(attrs),
    alignment: safeImageAlignment(attrs?.align),
    margin,
  };

  try {
    if (src.startsWith('data:image/svg+xml')) {
      return { svg: dataUrlToText(src), ...base };
    }

    if (/^data:image\/(?:png|jpe?g);/i.test(src)) {
      return { image: normalizeRasterImageDataUrl(src), ...base };
    }

    if (/^data:image\//i.test(src)) {
      const converted = await convertDataImageToPngDataUrl(src);
      return converted ? { image: converted, ...base } : imageFallbackContent(attrs, margin);
    }

    if (/^https?:\/\//i.test(src)) {
      return { image: src, ...base };
    }
  } catch {
    return imageFallbackContent(attrs, margin);
  }

  return imageFallbackContent(attrs, margin);
}

function inlineToText(nodes: RichNode[] | undefined): string {
  return normalizePdfTextForLayout(
    nodes
      ?.map((node) => {
        if (node.type === 'mathInline') {
          return `$${node.attrs?.latex ?? ''}$`;
        }
        return node.text ?? '';
      })
      .join('') ?? '',
  );
}

function tipTapToText(doc: unknown): string {
  const root = doc as { content?: RichNode[] };
  if (!root?.content) {
    return '';
  }

  return root.content
    .map((node) => {
      if (node.type === 'paragraph') {
        return inlineToText(node.content);
      }
      if (node.type === 'codeBlock') {
        return inlineToText(node.content);
      }
      if (node.type === 'image') {
        return imageText(node.attrs);
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function docHasImage(doc: unknown): boolean {
  if (Array.isArray(doc)) {
    return doc.some(docHasImage);
  }
  if (!doc || typeof doc !== 'object') {
    return false;
  }
  const node = doc as RichNode;
  return node.type === 'image' || Boolean(node.content?.some(docHasImage));
}

async function tipTapToPdfBlocks(doc: unknown, margin: PdfMargin, textStyle: Record<string, unknown> = {}): Promise<Content[]> {
  const root = doc as { content?: RichNode[] };
  if (!root?.content) {
    return [];
  }

  const blocks: Content[] = [];
  for (const node of root.content) {
    if (node.type === 'paragraph' || node.type === 'codeBlock') {
      const text = inlineToText(node.content);
      if (text.trim()) {
        blocks.push({ text, margin, ...textStyle } as Content);
      }
    } else if (node.type === 'image') {
      blocks.push(await imageToPdfContent(node.attrs, margin));
    }
  }
  return blocks;
}

function typeLabel(type: Question['type']): string {
  if (type === 'multiple') {
    return '多选题';
  }
  if (type === 'truefalse') {
    return '判断题';
  }
  return '单选题';
}

function answerText(question: Question): string {
  if (question.type === 'truefalse') {
    return question.answer[0] === 0 ? '正确 (T)' : '错误 (F)';
  }
  return question.answer.map((index) => String.fromCharCode(65 + index)).join(', ');
}

export async function generatePrecisePDF(questions: QuestionData[], options: ExportOptions): Promise<Blob> {
  const content: Content[] = [
    { text: options.bankName, style: 'title', margin: [0, 0, 0, 4] },
    {
      text: `导出日期: ${new Date().toLocaleDateString('zh-CN')} | ${questions.length} 题`,
      style: 'subtitle',
      margin: [0, 0, 0, 20],
    },
  ];

  if (options.includeStats && questions.length > 0) {
    const answered = questions.filter((item) => item.latestRecord).length;
    const correct = questions.filter((item) => item.latestRecord?.isCorrect).length;
    content.push({
      style: 'statsBox',
      table: {
        widths: ['*', '*', '*'],
        body: [
          [
            { text: `总题数: ${questions.length}`, style: 'statText' },
            { text: `已作答: ${answered}`, style: 'statText' },
            { text: `正确率: ${answered > 0 ? Math.round((correct / answered) * 100) : 0}%`, style: 'statText' },
          ],
        ],
      },
      margin: [0, 0, 0, 20],
    });
  }

  for (const [index, { question, note }] of questions.entries()) {
    content.push({
      text: [
        { text: `${index + 1}. `, bold: true },
        { text: `[${typeLabel(question.type)}] `, fontSize: 9, color: '#7a7568' },
        { text: question.tags.join(', '), fontSize: 9, color: '#a8a294' },
      ],
      margin: [0, 10, 0, 6],
    });
    content.push(...(await tipTapToPdfBlocks(question.body, [0, 0, 0, 6])));

    if (question.type === 'truefalse') {
      content.push({
        text: options.includeAnswers ? `答案: ${answerText(question)}` : '答案: (已隐藏)',
        margin: [14, 2, 0, 2],
      });
    } else {
      for (const option of question.options) {
        const isAnswer = options.includeAnswers && question.answer.includes(option.index);
        if (docHasImage(option.content)) {
          content.push({
            text: `${String.fromCharCode(65 + option.index)}.${isAnswer ? ' ✓' : ''}`,
            bold: isAnswer,
            color: isAnswer ? '#5b8c5a' : undefined,
            margin: [14, 2, 0, 0],
          });
          content.push(...(await tipTapToPdfBlocks(option.content, [32, 2, 0, 2], isAnswer ? { bold: true } : {})));
        } else {
          content.push({
            text: [
              { text: `${String.fromCharCode(65 + option.index)}. `, bold: isAnswer },
              { text: tipTapToText(option.content), bold: isAnswer },
              isAnswer ? { text: ' ✓', color: '#5b8c5a', bold: true } : { text: '' },
            ],
            margin: [14, 2, 0, 2],
          });
        }
      }
      if (options.includeAnswers) {
        content.push({ text: `答案: ${answerText(question)}`, margin: [14, 4, 0, 2], color: '#5b8c5a' });
      }
    }

    if (options.includeExplanations) {
      const explanationBlocks = await tipTapToPdfBlocks(question.explanation, [14, 2, 0, 4], { fontSize: 10, color: '#3b4b6b' });
      if (explanationBlocks.length) {
        content.push({
          text: '解析:',
          bold: true,
          fontSize: 10,
          margin: [14, 6, 0, 0],
          color: '#3b4b6b',
        });
        content.push(...explanationBlocks);
      }
    }

    if (options.includeNotes && note?.content) {
      const noteBlocks = await tipTapToPdfBlocks(note.content, [14, 2, 0, 4], { fontSize: 10, color: '#c4823d' });
      if (noteBlocks.length) {
        content.push({
          text: '笔记:',
          bold: true,
          fontSize: 10,
          margin: [14, 4, 0, 0],
          color: '#c4823d',
        });
        content.push(...noteBlocks);
      }
    }

    if (index < questions.length - 1) {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#e5e0d5' }],
        margin: [0, 8, 0, 0],
      });
    }
  }

  const font = cjkFontReady ? cjkFontFamily : 'Roboto';
  return pdf.createPdf({
    pageSize: 'A4',
    pageMargins: [42, 64, 42, 54],
    header: () => ({
      margin: [42, 22, 42, 0],
      columns: [
        {
          text: [
            { text: 'Knowa', bold: true, color: '#3b4b6b' },
            { text: '  搭建你的个人题库', fontSize: 8, color: '#7a7568' },
          ],
        },
        { text: options.bankName, alignment: 'right', fontSize: 8, color: '#7a7568' },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [42, 0, 42, 22],
      columns: [
        { text: `Knowa · ${options.bankName}`, fontSize: 8, color: '#a8a294' },
        { text: `${currentPage} / ${pageCount}`, alignment: 'right', fontSize: 8, color: '#a8a294' },
      ],
    }),
    content,
    styles: {
      title: { fontSize: 20, bold: true, alignment: 'center', lineHeight: 1.15 },
      subtitle: { fontSize: 10, color: '#7a7568', alignment: 'center' },
      statText: { fontSize: 10, alignment: 'center' },
      statsBox: { fillColor: '#f3efe8', fillOpacity: 1 },
    },
    defaultStyle: {
      font,
      fontSize: 11,
      color: '#2c2416',
      lineHeight: 1.28,
    },
  }).getBlob();
}

export async function generateQuickPDF(element: HTMLElement, filename: string): Promise<Blob> {
  const restoreImages = normalizeInlineDataImagesForCanvas(element);

  try {
    await waitForImages(element);
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const pdfDocument = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4',
    });

    const pageWidth = pdfDocument.internal.pageSize.getWidth();
    const pageHeight = pdfDocument.internal.pageSize.getHeight();
    const margin = 28;
    const headerHeight = 34;
    const footerHeight = 24;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2 - headerHeight - footerHeight;
    const scale = contentWidth / canvas.width;
    const sliceHeight = Math.floor(contentHeight / scale);
    const pageCount = Math.max(1, Math.ceil(canvas.height / sliceHeight));

    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) {
        pdfDocument.addPage();
      }

      pdfDocument.setFontSize(11);
      pdfDocument.setTextColor(59, 75, 107);
      pdfDocument.text('Knowa', margin, margin);
      pdfDocument.setFontSize(8);
      pdfDocument.setTextColor(122, 117, 104);
      pdfDocument.text('搭建你的个人题库', margin + 52, margin);

      const sourceY = page * sliceHeight;
      const pageCanvas = window.document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.min(sliceHeight, canvas.height - sourceY);
      const context = pageCanvas.getContext('2d');
      context?.drawImage(canvas, 0, sourceY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
      pdfDocument.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin + headerHeight, contentWidth, pageCanvas.height * scale);

      pdfDocument.setFontSize(8);
      pdfDocument.setTextColor(168, 162, 148);
      pdfDocument.text(`Knowa · ${filename}`, margin, pageHeight - margin + 6);
      pdfDocument.text(`${page + 1} / ${pageCount}`, pageWidth - margin, pageHeight - margin + 6, { align: 'right' });
    }

    return pdfDocument.output('blob') as Blob;
  } finally {
    restoreImages();
  }
}
