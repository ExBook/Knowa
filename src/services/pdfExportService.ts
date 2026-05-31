import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content } from 'pdfmake/interfaces';
import type { Note, Question, QuizRecord } from '../shared/types';

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

function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.split(',')[1] ?? '');
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Unable to read font file')));
    reader.readAsDataURL(new Blob([buffer]));
  });
}

export async function initCJKFont(): Promise<void> {
  if (cjkFontReady) {
    return;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${cjkFontFile}`);
    if (!response.ok) {
      return;
    }

    const buffer = await response.arrayBuffer();
    pdf.addVirtualFileSystem({ [cjkFontFile]: await arrayBufferToBase64(buffer) });
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
  attrs?: { alt?: string; src?: string; latex?: string };
  content?: RichNode[];
};

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

function imageText(attrs: RichNode['attrs']): string {
  const alt = attrs?.alt?.trim();
  return alt ? `[图片: ${normalizePdfTextForLayout(alt)}]` : '[图片]';
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

  questions.forEach(({ question, note }, index) => {
    content.push({
      text: [
        { text: `${index + 1}. `, bold: true },
        { text: `[${typeLabel(question.type)}] `, fontSize: 9, color: '#7a7568' },
        { text: question.tags.join(', '), fontSize: 9, color: '#a8a294' },
      ],
      margin: [0, 10, 0, 6],
    });
    content.push({ text: tipTapToText(question.body), margin: [0, 0, 0, 6] });

    if (question.type === 'truefalse') {
      content.push({
        text: options.includeAnswers ? `答案: ${answerText(question)}` : '答案: (已隐藏)',
        margin: [14, 2, 0, 2],
      });
    } else {
      question.options.forEach((option) => {
        const isAnswer = options.includeAnswers && question.answer.includes(option.index);
        content.push({
          text: [
            { text: `${String.fromCharCode(65 + option.index)}. `, bold: isAnswer },
            { text: tipTapToText(option.content), bold: isAnswer },
            isAnswer ? { text: ' ✓', color: '#5b8c5a', bold: true } : { text: '' },
          ],
          margin: [14, 2, 0, 2],
        });
      });
      if (options.includeAnswers) {
        content.push({ text: `答案: ${answerText(question)}`, margin: [14, 4, 0, 2], color: '#5b8c5a' });
      }
    }

    if (options.includeExplanations) {
      const explanation = tipTapToText(question.explanation);
      if (explanation.trim()) {
        content.push({
          text: [
            { text: '解析: ', bold: true, fontSize: 10 },
            { text: explanation, fontSize: 10 },
          ],
          margin: [14, 6, 0, 4],
          color: '#3b4b6b',
        });
      }
    }

    if (options.includeNotes && note?.content) {
      const noteText = tipTapToText(note.content);
      if (noteText.trim()) {
        content.push({
          text: [
            { text: '笔记: ', bold: true, fontSize: 10 },
            { text: noteText, fontSize: 10 },
          ],
          margin: [14, 4, 0, 4],
          color: '#c4823d',
        });
      }
    }

    if (index < questions.length - 1) {
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 4, x2: 515, y2: 4, lineWidth: 0.5, lineColor: '#e5e0d5' }],
        margin: [0, 8, 0, 0],
      });
    }
  });

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

export async function generateQuickPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const document = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: 'a4',
  });

  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
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
      document.addPage();
    }

    document.setFontSize(11);
    document.setTextColor(59, 75, 107);
    document.text('Knowa', margin, margin);
    document.setFontSize(8);
    document.setTextColor(122, 117, 104);
    document.text('搭建你的个人题库', margin + 52, margin);

    const sourceY = page * sliceHeight;
    const pageCanvas = window.document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = Math.min(sliceHeight, canvas.height - sourceY);
    const context = pageCanvas.getContext('2d');
    context?.drawImage(canvas, 0, sourceY, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
    document.addImage(pageCanvas.toDataURL('image/png'), 'PNG', margin, margin + headerHeight, contentWidth, pageCanvas.height * scale);

    document.setFontSize(8);
    document.setTextColor(168, 162, 148);
    document.text(`Knowa · ${filename}`, margin, pageHeight - margin + 6);
    document.text(`${page + 1} / ${pageCount}`, pageWidth - margin, pageHeight - margin + 6, { align: 'right' });
  }

  document.save(`${filename}.pdf`);
}
