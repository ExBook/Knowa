import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(String.fromCharCode(...bytes.slice(index, index + 8192)));
  }
  return btoa(chunks.join(''));
}

export async function initCJKFont(): Promise<void> {
  if (cjkFontReady) {
    return;
  }

  try {
    const response = await fetch('https://cdn.jsdelivr.net/npm/@canvas-fonts/notosanssc@1.0.0/files/notosanssc-regular.otf');
    if (!response.ok) {
      return;
    }

    const buffer = await response.arrayBuffer();
    pdf.addVirtualFileSystem({ 'NotoSansSC-Regular.otf': arrayBufferToBase64(buffer) });
    pdf.addFonts({
      NotoSansSC: {
        normal: 'NotoSansSC-Regular.otf',
        bold: 'NotoSansSC-Regular.otf',
        italics: 'NotoSansSC-Regular.otf',
        bolditalics: 'NotoSansSC-Regular.otf',
      },
    });
    cjkFontReady = true;
  } catch {
    console.warn('CJK font download failed, PDF Chinese text may not render');
  }
}

function tipTapToText(doc: unknown): string {
  const root = doc as { content?: Array<{ type?: string; text?: string; attrs?: { alt?: string; src?: string }; content?: Array<{ text?: string }> }> };
  if (!root?.content) {
    return '';
  }

  return root.content
    .map((node) => {
      if (node.type === 'paragraph') {
        return node.content?.map((child) => child.text ?? '').join('') ?? '';
      }
      if (node.type === 'codeBlock') {
        return node.content?.[0]?.text ?? '';
      }
      if (node.type === 'image') {
        return `[图片: ${node.attrs?.alt || node.attrs?.src || ''}]`;
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
  const content: unknown[] = [
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

  const font = cjkFontReady ? 'NotoSansSC' : 'Roboto';
  return pdf.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content,
    styles: {
      title: { fontSize: 18, bold: true },
      subtitle: { fontSize: 10, color: '#7a7568' },
      statText: { fontSize: 10, alignment: 'center' },
      statsBox: { fillColor: '#f3efe8', fillOpacity: 1 },
    },
    defaultStyle: {
      font,
      fontSize: 11,
      color: '#2c2416',
      lineHeight: 1.5,
    },
  }).getBlob();
}

export async function generateQuickPDF(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const document = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  });

  document.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
  document.save(`${filename}.pdf`);
}
